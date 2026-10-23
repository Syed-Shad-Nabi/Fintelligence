import argparse
import json
import pickle
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from services.financial_metrics import compute_from_llm_extracted
from services.vision_service import VisionService

ARTIFACT_DIR = BACKEND / "ml_artifacts"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
RISK_MODEL_PATH = ARTIFACT_DIR / "risk_classifier.pkl"
ANOM_MODEL_PATH = ARTIFACT_DIR / "anomaly_model.pkl"
METRICS_PATH = ARTIFACT_DIR / "training_metrics.json"
DATASET_DUMP_PATH = ARTIFACT_DIR / "real_training_dataset.csv"

FEATURE_COLS = [
    "liquidity_ratio",
    "debt_ratio",
    "revenue_growth",
    "gross_margin_pct",
    "operating_margin_pct",
    "net_margin_pct",
    "stress_score",
    "compliance_score",
    "return_on_equity",
    "return_on_assets",
]

FEATURE_BOUNDS = {
    "liquidity_ratio": (0.0, 6.0),
    "debt_ratio": (0.0, 2.0),
    "revenue_growth": (-1.0, 1.5),
    "gross_margin_pct": (-100.0, 100.0),
    "operating_margin_pct": (-100.0, 100.0),
    "net_margin_pct": (-100.0, 100.0),
    "stress_score": (0.0, 1.0),
    "compliance_score": (0.0, 100.0),
    "return_on_equity": (-100.0, 100.0),
    "return_on_assets": (-100.0, 100.0),
}


def _risk_label_from_metrics(m: dict) -> int:
    stress = float(m.get("stress_score") or 0.0)
    compliance = float(m.get("compliance_score") or 100.0)
    debt = float(m.get("debt_ratio") or 0.0)
    liq = float(m.get("liquidity_ratio") or 1.0)
    rev = float(m.get("revenue_growth") or 0.0)
    score = (
        (3 if stress > 0.55 else 1 if stress > 0.30 else 0)
        + (3 if compliance < 60 else 1 if compliance < 80 else 0)
        + (2 if debt > 0.65 else 1 if debt > 0.45 else 0)
        + (2 if liq < 1.0 else 1 if liq < 1.4 else 0)
        + (2 if rev < -0.08 else 1 if rev < 0 else 0)
    )
    if score >= 7:
        return 2  # risk
    if score >= 4:
        return 1  # warning
    return 0  # healthy


def _risk_score_from_features(row: dict) -> float:
    stress = float(row.get("stress_score", 0.0))
    compliance = float(row.get("compliance_score", 100.0))
    debt = float(row.get("debt_ratio", 0.0))
    liq = float(row.get("liquidity_ratio", 1.0))
    rev = float(row.get("revenue_growth", 0.0))
    opm = float(row.get("operating_margin_pct", 0.0))
    return float(
        (3 if stress > 0.55 else 1 if stress > 0.35 else 0)
        + (3 if compliance < 60 else 1 if compliance < 80 else 0)
        + (2 if debt > 0.65 else 1 if debt > 0.45 else 0)
        + (2 if liq < 1.0 else 1 if liq < 1.3 else 0)
        + (2 if rev < -0.08 else 1 if rev < 0 else 0)
        + (1 if opm < 3 else 0)
    )


def _sanitize_features(feat: dict) -> dict:
    out = {}
    for c in FEATURE_COLS:
        v = float(feat.get(c, 0.0))
        lo, hi = FEATURE_BOUNDS[c]
        out[c] = float(np.clip(v, lo, hi))
    return out


def _augment_real_rows(base_df: pd.DataFrame, factor: int = 35, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for _, r in base_df.iterrows():
        base = {c: float(r[c]) for c in FEATURE_COLS}
        rows.append({**base, "risk_score": _risk_score_from_features(base), "source_file": r.get("source_file", "unknown"), "augmented": 0})
        for _ in range(factor):
            sample = {}
            for c in FEATURE_COLS:
                lo, hi = FEATURE_BOUNDS[c]
                span = hi - lo
                noise = rng.normal(0.0, span * 0.02)
                sample[c] = float(np.clip(base[c] + noise, lo, hi))
            rows.append({**sample, "risk_score": _risk_score_from_features(sample), "source_file": r.get("source_file", "unknown"), "augmented": 1})
    return pd.DataFrame(rows)


def _to_float(v):
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    s = s.replace(",", "").replace("$", "")
    s = re.sub(r"^\((.+)\)$", r"-\1", s)
    try:
        return float(s)
    except ValueError:
        return None


def _extract_metrics_from_rows(structured: dict):
    rows = structured.get("rows") or []
    if not rows:
        return None

    mappings = {
        "revenue": ["total revenues", "net revenues", "sales"],
        "cost_of_goods_sold": ["cost of revenues", "cost of sales", "cost of goods sold"],
        "gross_margin": ["gross profit", "gross margin"],
        "operating_income": ["income from operations", "operating income", "operating profit"],
        "net_income": ["net income", "net earnings"],
        "total_assets": ["total assets"],
        "current_assets": ["current assets"],
        "current_liabilities": ["current liabilities"],
        "total_liabilities": ["total liabilities"],
        "total_debt": ["debt", "long-term debt", "notes payable", "finance lease"],
        "cash": ["cash and cash equivalents", "cash equivalents"],
        "equity": ["stockholders equity", "shareholders equity", "total equity"],
    }

    out = {
        "company": None,
        "document_type": "Financial Statement",
        "period_1_label": "current",
        "period_2_label": "prior",
        "currency": "USD",
        "unit": "millions",
    }

    for r in rows:
        metric_name = str(r.get("metric", "")).lower()
        if not metric_name:
            continue
        cols = [k for k in r.keys() if k != "metric"]
        vals = [_to_float(r.get(c)) for c in cols]
        vals = [v for v in vals if v is not None]
        if not vals:
            continue
        current = vals[0]
        prior = vals[1] if len(vals) > 1 else None
        for key, kws in mappings.items():
            if key in out and out.get(key) is not None:
                continue
            if any(kw in metric_name for kw in kws):
                out[key] = current
                if prior is not None:
                    out[f"{key}_prior"] = prior
                break

    metrics = compute_from_llm_extracted(out)
    non_empty = sum(1 for c in FEATURE_COLS if metrics.get(c) is not None)
    if non_empty < 3:
        return None
    return metrics


def _build_real_dataset(dataset_dir: Path):
    files = sorted([p for p in dataset_dir.glob("*.pdf")])
    if not files:
        return None, None

    vision = VisionService()
    rows = []

    for p in files:
        structured = vision.process_document(str(p))
        m = _extract_metrics_from_rows(structured or {})
        if not m:
            continue
        feat = _sanitize_features({c: float(m.get(c) or 0.0) for c in FEATURE_COLS})
        non_zero = sum(1 for c in FEATURE_COLS if abs(feat[c]) > 1e-7)
        if non_zero < 3:
            continue
        feat["label"] = _risk_label_from_metrics(m)
        feat["source_file"] = p.name
        rows.append(feat)

    if len(rows) < 8:
        return None, None

    df = pd.DataFrame(rows)
    df = _augment_real_rows(df, factor=40, seed=42)
    # Data-driven labels from real extracted distribution: balanced 3 buckets.
    q1 = float(df["risk_score"].quantile(0.33))
    q2 = float(df["risk_score"].quantile(0.66))
    df["label"] = np.where(df["risk_score"] <= q1, 0, np.where(df["risk_score"] <= q2, 1, 2))
    df.to_csv(DATASET_DUMP_PATH, index=False)
    X = df[FEATURE_COLS].to_numpy(dtype=float)
    y = df["label"].to_numpy(dtype=int)
    return X, y


def _build_synthetic_dataset(n=5000, seed=42):
    rng = np.random.default_rng(seed)
    liquidity = np.clip(rng.normal(1.6, 0.7, n), 0.2, 5.0)
    debt = np.clip(rng.normal(0.45, 0.2, n), 0.01, 1.2)
    rev_growth = np.clip(rng.normal(0.06, 0.18, n), -0.7, 0.8)
    gross_margin = np.clip(rng.normal(36, 14, n), -20, 85)
    op_margin = np.clip(rng.normal(12, 10, n), -40, 45)
    net_margin = np.clip(rng.normal(8, 8, n), -35, 40)
    stress = np.clip(0.30 * debt + 0.35 * np.maximum(0, -rev_growth) + 0.35 * np.maximum(0, 1.0 - liquidity), 0, 1)
    compliance = np.clip(100 - (debt * 45) - (stress * 35) - (np.maximum(0, 1.0 - liquidity) * 20), 0, 100)
    roe = np.clip(rng.normal(11, 7, n), -20, 35)
    roa = np.clip(rng.normal(4, 3, n), -12, 18)
    X = np.column_stack([liquidity, debt, rev_growth, gross_margin, op_margin, net_margin, stress, compliance, roe, roa])
    y = np.where((stress > 0.55) | (compliance < 60), 2, np.where((stress > 0.30) | (compliance < 80), 1, 0))
    return X, y


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset-dir",
        default="C:/Users/geash/Desktop/College/Dataset Files",
        help="Directory containing report PDFs",
    )
    args = parser.parse_args()

    dataset_dir = Path(args.dataset_dir)
    X, y = _build_real_dataset(dataset_dir) if dataset_dir.exists() else (None, None)
    source = "real_documents"
    if X is None or y is None:
        X, y = _build_synthetic_dataset()
        source = "synthetic_fallback"

    _, counts = np.unique(y, return_counts=True)
    can_stratify = len(counts) > 1 and int(np.min(counts)) >= 2
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y if can_stratify else None,
    )
    risk_model = RandomForestClassifier(
        n_estimators=220,
        max_depth=10,
        random_state=42,
        class_weight="balanced_subsample",
    )
    risk_model.fit(X_train, y_train)
    y_pred = risk_model.predict(X_test)
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

    anom_model = IsolationForest(
        n_estimators=180,
        contamination=0.04,
        random_state=42,
    )
    anom_model.fit(X_train)

    with open(RISK_MODEL_PATH, "wb") as f:
        pickle.dump(risk_model, f)
    with open(ANOM_MODEL_PATH, "wb") as f:
        pickle.dump(anom_model, f)

    out = {
        "source": source,
        "samples": int(X.shape[0]),
        "features": len(FEATURE_COLS),
        "label_distribution": {int(k): int(v) for k, v in zip(*np.unique(y, return_counts=True))},
        "risk_classifier_accuracy": round(report.get("accuracy", 0.0), 4),
        "risk_classifier_weighted_f1": round(report["weighted avg"]["f1-score"], 4),
    }
    METRICS_PATH.write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
