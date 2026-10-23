import json
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db, Report
from models.schemas import ReportSummary, ReportDetail
from routes.auth import get_current_user
from models.database import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[ReportSummary])
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reports = (
        db.query(Report)
        .filter(Report.user_id == current_user.id)
        .order_by(Report.created_at.desc())
        .all()
    )
    result = []
    for r in reports:
        preview = None
        if r.summary:
            preview = r.summary[:160] + ("…" if len(r.summary) > 160 else "")
        result.append(
            ReportSummary(
                id=r.id,
                filename=r.filename,
                file_type=r.file_type,
                status=r.status,
                row_count=r.row_count,
                col_count=r.col_count,
                anomaly_count=r.anomaly_count or 0,
                summary_preview=preview,
                created_at=r.created_at,
            )
        )
    return result


@router.get("/{report_id}", response_model=ReportDetail)
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(
        Report.id == report_id, Report.user_id == current_user.id
    ).first()
    if not report:
        raise HTTPException(404, detail="Report not found")

    return ReportDetail(
        id=report.id,
        filename=report.filename,
        file_type=report.file_type,
        status=report.status,
        progress=report.progress,
        row_count=report.row_count,
        col_count=report.col_count,
        anomaly_count=report.anomaly_count or 0,
        metrics=json.loads(report.metrics_json) if report.metrics_json else None,
        anomalies=json.loads(report.anomalies_json) if report.anomalies_json else None,
        charts=json.loads(report.charts_json) if report.charts_json else None,
        summary=report.summary,
        column_mapping=json.loads(report.column_mapping_json) if report.column_mapping_json else None,
        created_at=report.created_at,
        completed_at=report.completed_at,
    )


@router.delete("/{report_id}")
def delete_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(
        Report.id == report_id, Report.user_id == current_user.id
    ).first()
    if not report:
        raise HTTPException(404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"message": "Report deleted"}
