import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

FINANCIAL_COLUMN_ALIASES: Dict[str, List[str]] = {
    "revenue":     ["revenue", "sales", "net_sales", "total_revenue", "gross_revenue", "net_revenue"],
    "assets":      ["assets", "total_assets", "current_assets"],
    "liabilities": ["liabilities", "total_liabilities", "current_liabilities"],
    "net_income":  ["net_income", "profit", "net_profit", "earnings", "net_earnings"],
    "debt":        ["debt", "total_debt", "long_term_debt", "short_term_debt"],
    "equity":      ["equity", "shareholders_equity", "total_equity"],
    "cash":        ["cash", "cash_equivalents"],
    "expenses":    ["expenses", "total_expenses", "operating_expenses", "cogs", "cost_of_goods_sold"],
    "period":      ["period", "year", "quarter", "date", "fiscal_year", "fy", "month"],
}


def load_file(file_path: str) -> Optional[pd.DataFrame]:
    ext = Path(file_path).suffix.lower()
    try:
        if ext == ".csv":
            return pd.read_csv(file_path, encoding="utf-8", on_bad_lines="skip")
        if ext in {".xlsx", ".xls"}:
            return pd.read_excel(file_path)
        if ext == ".json":
            with open(file_path) as f:
                data = json.load(f)
            if isinstance(data, list):
                return pd.DataFrame(data)
            if isinstance(data, dict):
                for key in data:
                    if isinstance(data[key], list):
                        return pd.DataFrame(data[key])
                return pd.DataFrame([data])
    except Exception as exc:
        logger.error("load_file failed | path=%s error=%s", file_path, exc)
    return None


def normalize_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    df.columns = [
        re.sub(r"[^a-z0-9_]", "_", col.lower().strip().replace(" ", "_").replace("-", "_"))
        for col in df.columns
    ]
    df = df.dropna(how="all").reset_index(drop=True)

    if len(df) > 100_000:
        df = df.head(100_000)
        logger.warning("Dataset truncated to 100000 rows.")

    numeric_cols: List[str] = []
    date_cols: List[str] = []

    for col in df.columns:
        try:
            cleaned = (
                df[col]
                .astype(str)
                .str.replace(r"[\$\u20ac\xa3,\s]", "", regex=True)
                .str.replace(r"^\((\d+\.?\d*)\)$", r"-\1", regex=True)
            )
            converted = pd.to_numeric(cleaned, errors="coerce")
            if converted.notna().sum() / max(len(df), 1) > 0.5:
                df[col] = converted
                numeric_cols.append(col)
                continue
        except Exception:
            pass
        try:
            converted = pd.to_datetime(df[col], errors="coerce")
            if converted.notna().sum() / max(len(df), 1) > 0.3:
                df[col] = converted
                date_cols.append(col)
        except Exception:
            pass

    column_mapping = _detect_financial_columns(df.columns.tolist())
    logger.info(
        "normalize_dataframe | shape=%s numeric_cols=%d date_cols=%d mapping=%s",
        df.shape, len(numeric_cols), len(date_cols), list(column_mapping.keys()),
    )
    return {
        "dataframe":      df,
        "numeric_cols":   numeric_cols,
        "date_cols":      date_cols,
        "column_mapping": column_mapping,
        "shape":          df.shape,
        "columns":        df.columns.tolist(),
    }


def _detect_financial_columns(columns: List[str]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for standard, aliases in FINANCIAL_COLUMN_ALIASES.items():
        for alias in aliases:
            for col in columns:
                if alias == col or alias in col or col in alias:
                    if standard not in mapping:
                        mapping[standard] = col
                    break
    return mapping


def build_chart_data(
    df: pd.DataFrame,
    column_mapping: Dict[str, str],
    anomalies: List[Dict[str, Any]],
    llm_metrics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    charts: Dict[str, Any] = {}
    llm_metrics = llm_metrics or {}

    rev1 = llm_metrics.get("revenue")
    rev2 = llm_metrics.get("revenue_prior")
    lbl1 = llm_metrics.get("period_1_label") or "Current Period"
    lbl2 = llm_metrics.get("period_2_label") or "Prior Period"

    if rev1 is not None and rev2 is not None:
        charts["revenue_trend"] = {
            "labels": [str(lbl2), str(lbl1)],
            "values": [round(float(rev2), 2), round(float(rev1), 2)],
        }
    else:
        period_col  = column_mapping.get("period")
        revenue_col = column_mapping.get("revenue")
        if revenue_col and revenue_col in df.columns:
            rev_series = pd.to_numeric(df[revenue_col], errors="coerce")
            labels = (
                df[period_col].astype(str).tolist()
                if period_col and period_col in df.columns
                else [f"Period {i+1}" for i in range(len(df))]
            )
            valid_mask = rev_series.notna()
            charts["revenue_trend"] = {
                "labels": [str(l) for l, v in zip(labels, valid_mask) if v],
                "values": [round(float(v), 2) for v in rev_series[valid_mask].tolist()],
            }

    comparison_fields = [
        ("revenue",          "Revenue"),
        ("gross_margin",     "Gross Margin"),
        ("operating_income", "Operating Income"),
        ("net_income",       "Net Income"),
    ]
    comp_labels, comp_p1, comp_p2 = [], [], []
    for field, label in comparison_fields:
        v1 = llm_metrics.get(field)
        v2 = llm_metrics.get(f"{field}_prior")
        if v1 is not None and v2 is not None:
            comp_labels.append(label)
            comp_p1.append(round(float(v1), 2))
            comp_p2.append(round(float(v2), 2))
    if comp_labels:
        charts["period_comparison"] = {
            "labels":   comp_labels,
            "period_1": {"label": str(lbl1), "values": comp_p1},
            "period_2": {"label": str(lbl2), "values": comp_p2},
        }

    severity_counts = {"high": 0, "medium": 0, "low": 0}
    for a in anomalies:
        sev = a.get("severity", "low")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
    charts["anomaly_distribution"] = severity_counts

    if anomalies:
        charts["anomaly_scores"] = {
            "row_indices": [a["row_index"] for a in anomalies[:50]],
            "scores":      [a["anomaly_score"] for a in anomalies[:50]],
            "severities":  [a["severity"] for a in anomalies[:50]],
        }

    logger.info("build_chart_data | charts=%s", list(charts.keys()))
    return charts
