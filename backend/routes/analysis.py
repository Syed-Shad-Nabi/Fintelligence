import os
import uuid
import json
import asyncio
import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from models.database import get_db, Report
from models.schemas import UploadResponse, AnalysisStatusResponse, ChatRequest
from routes.auth import get_current_user
from models.database import User
from services.llm_router import LLMRouter
from services.rag_service import RAGService

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOADS_DIR = os.getenv("UPLOADS_DIR", "./uploads")
REPORTS_DIR = os.getenv("REPORTS_DIR", "./reports")

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".pdf", ".png", ".jpg", ".jpeg", ".tiff"}


async def run_analysis_pipeline(report_id: str, file_path: str, filename: str, db_url: str):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return

        def update_progress(pct: int, status: str = "processing"):
            report.progress = pct
            report.status = status
            db.commit()

        update_progress(5)
        logger.info("Pipeline start | report_id=%s file=%s", report_id, filename)

        from services.vision_service import VisionService
        ext = Path(file_path).suffix.lower()
        report.file_type = ext.lstrip(".")
        db.commit()

        structured_data = None
        if ext in {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".webp"}:
            # Quick Ollama health check — fail fast if unreachable (avoids long hangs)
            try:
                import httpx
                ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
                r = httpx.get(f"{ollama_host}/api/tags", timeout=httpx.Timeout(5.0, connect=3.0))
                r.raise_for_status()
            except Exception as ollama_err:
                report.status = "failed"
                report.error_message = (
                    "Ollama is not running or unreachable. PDF/image processing requires Ollama. "
                    "Start it with 'ollama serve' and pull models: ollama pull mistral && ollama pull llava"
                )
                db.commit()
                logger.error("Ollama unreachable | report_id=%s error=%s", report_id, ollama_err)
                return
            logger.info("Vision extraction | report_id=%s ext=%s", report_id, ext)
            vision = VisionService()
            structured_data = await asyncio.to_thread(vision.process_document, file_path)
            logger.info(
                "Vision extraction done | report_id=%s rows=%d raw_text_chars=%d",
                report_id,
                len((structured_data or {}).get("rows") or []),
                len((structured_data or {}).get("raw_text") or ""),
            )

        update_progress(20)

        from data_pipeline import load_file, normalize_dataframe
        import pandas as pd

        if structured_data and structured_data.get("rows"):
            df_raw = pd.DataFrame(structured_data["rows"])
        else:
            df_raw = await asyncio.to_thread(load_file, file_path)

        if df_raw is None or df_raw.empty:
            report.status = "failed"
            report.error_message = "Could not parse file into a usable dataset."
            db.commit()
            logger.error("Pipeline failed: empty dataframe | report_id=%s", report_id)
            return

        update_progress(35)

        result = normalize_dataframe(df_raw)
        df = result["dataframe"]
        column_mapping = result["column_mapping"]
        report.row_count = int(df.shape[0])
        report.col_count = int(df.shape[1])
        report.column_mapping_json = json.dumps(column_mapping)
        db.commit()

        update_progress(50)

        from services.financial_metrics import FinancialMetricsEngine, compute_from_llm_extracted

        raw_text = (structured_data or {}).get("raw_text", "")
        llm = LLMRouter()

        if structured_data is not None:
            if not raw_text or len(raw_text.strip()) < 100:
                rows = structured_data.get("rows") or []
                if rows:
                    headings = structured_data.get("headings") or []
                    dates    = structured_data.get("dates") or []
                    
                    all_cols = set()
                    for r in rows:
                        all_cols.update(k for k in r.keys() if k != "metric")
                    col_list = sorted(all_cols)
                    
                    header_parts = []
                    if headings:
                        header_parts.append("DOCUMENT: " + " | ".join(headings[:5]))
                    if dates:
                        header_parts.append("PERIODS: " + " | ".join(dates[:4]))
                    if col_list:
                        header_parts.append("COLUMNS: " + ", ".join(col_list))
                    
                    table_lines = []
                    for r in rows[:100]:
                        metric = r.get("metric", "")
                        if not metric or len(metric) < 2:
                            continue
                        values = " | ".join(f"{col}: {r.get(col, '')}" for col in col_list if r.get(col))
                        if values:
                            table_lines.append(f"  metric: {metric} | {values}")
                    
                    raw_text = "\n".join(header_parts) + "\n\n" + "\n".join(table_lines)
                    logger.info(
                        "Synthesised text from rows | report_id=%s rows=%d cols=%s chars=%d",
                        report_id, len(rows), col_list, len(raw_text),
                    )

            logger.info(
                "LLM metric extraction | report_id=%s text_chars=%d",
                report_id, len(raw_text),
            )
            logger.debug("Text sent to LLM for extraction:\n%s", raw_text[:2000])
            llm_extracted = await llm.extract_financial_metrics(raw_text)
            logger.debug("LLM extracted data: %s", json.dumps(llm_extracted, indent=2))
            metrics = compute_from_llm_extracted(llm_extracted)
            logger.info(
                "LLM metric extraction done | report_id=%s keys=%s",
                report_id, list(llm_extracted.keys()),
            )
        else:
            logger.info("Column-mapping metrics | report_id=%s", report_id)
            metrics_engine = FinancialMetricsEngine()
            metrics = await asyncio.to_thread(metrics_engine.compute, df, column_mapping)

        update_progress(60)

        from services.anomaly_detection import AnomalyDetector
        from services.self_trained_models import infer_self_trained_signals
        detector = AnomalyDetector()
        anomalies = await asyncio.to_thread(detector.detect, df)
        metrics["anomaly_count"] = len(anomalies)
        report.anomaly_count = len(anomalies)
        metrics.update(infer_self_trained_signals(metrics))
        logger.info("Anomaly detection done | report_id=%s count=%d", report_id, len(anomalies))
        update_progress(72)

        from data_pipeline import build_chart_data
        charts = build_chart_data(df, column_mapping, anomalies, metrics)
        update_progress(80)

        summary_dict = {
            "company":       metrics.get("company"),
            "document_type": metrics.get("document_type"),
            "period":        f"{metrics.get('period_1_label')} vs {metrics.get('period_2_label')}",
            "column_mapping": column_mapping,
            "metrics":        metrics,
            "raw_text":       raw_text[:3000] if raw_text else None,
        }
        summary_text = await llm.generate_summary(summary_dict)
        update_progress(92)

        rag = RAGService()
        await rag.index_report(report_id, summary_text, metrics, column_mapping)
        update_progress(97)

        report_dir = Path(REPORTS_DIR) / report_id
        report_dir.mkdir(parents=True, exist_ok=True)
        (report_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
        (report_dir / "anomalies.json").write_text(json.dumps(anomalies, indent=2))
        (report_dir / "charts.json").write_text(json.dumps(charts, indent=2))
        (report_dir / "summary.txt").write_text(summary_text)

        report.metrics_json   = json.dumps(metrics)
        report.anomalies_json = json.dumps(anomalies)
        report.charts_json    = json.dumps(charts)
        report.summary        = summary_text
        report.status         = "completed"
        report.progress       = 100
        report.completed_at   = datetime.utcnow()
        db.commit()
        logger.info("Pipeline complete | report_id=%s", report_id)

    except Exception as exc:
        logger.error("Pipeline error | report_id=%s error=%s", report_id, exc, exc_info=True)
        report = db.query(Report).filter(Report.id == report_id).first()
        if report:
            report.status = "failed"
            report.error_message = str(exc)
            db.commit()
    finally:
        db.close()


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, detail=f"File type '{ext}' not supported.")

    report_id   = str(uuid.uuid4())
    upload_path = Path(UPLOADS_DIR) / f"{report_id}{ext}"
    upload_path.parent.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    upload_path.write_bytes(content)
    logger.info("File uploaded | report_id=%s filename=%s size=%d", report_id, file.filename, len(content))

    report = Report(
        id=report_id,
        user_id=current_user.id,
        filename=file.filename,
        file_type=ext.lstrip("."),
        status="processing",
        progress=0,
    )
    db.add(report)
    db.commit()

    db_url = os.getenv("DATABASE_URL", "sqlite:///./db/fintelligence.db")
    background_tasks.add_task(run_analysis_pipeline, report_id, str(upload_path), file.filename, db_url)

    return UploadResponse(
        report_id=report_id,
        status="processing",
        message="File uploaded. Analysis pipeline started.",
    )


@router.get("/status/{report_id}", response_model=AnalysisStatusResponse)
def get_status(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(
        Report.id == report_id, Report.user_id == current_user.id
    ).first()
    if not report:
        raise HTTPException(404, detail="Report not found")
    return AnalysisStatusResponse(
        report_id=report_id,
        status=report.status,
        progress=report.progress,
        error_message=report.error_message,
    )


@router.get("/insights/{report_id}")
async def get_insights(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(
        Report.id == report_id, Report.user_id == current_user.id
    ).first()
    if not report:
        raise HTTPException(404, detail="Report not found")
    if report.status != "completed" or not report.metrics_json:
        raise HTTPException(400, detail="Report analysis not yet complete")

    metrics  = json.loads(report.metrics_json)
    llm      = LLMRouter()
    logger.info("Insights requested | report_id=%s", report_id)
    insights = await llm.generate_metric_insights(metrics)
    return {"report_id": report_id, "insights": insights, "metrics": metrics}


@router.post("/chat")
async def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    context = ""
    if req.report_id:
        rag = RAGService()
        context = await rag.retrieve_context(req.message, req.report_id)
    logger.info(
        "Chat request | user=%s report_id=%s message_chars=%d context_chars=%d",
        current_user.id, req.report_id, len(req.message), len(context),
    )

    llm = LLMRouter()

    async def stream_generator():
        async for chunk in llm.stream_chat(req.message, context, req.history or []):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
