import os
import pickle
from pathlib import Path
from typing import Dict, Tuple

import numpy as np

ARTIFACT_DIR = Path(os.getenv("ML_ARTIFACT_DIR", "./ml_artifacts"))
RISK_MODEL_PATH = ARTIFACT_DIR / "risk_classifier.pkl"
ANOM_MODEL_PATH = ARTIFACT_DIR / "anomaly_model.pkl"

FEATURES = [
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

_risk_model = None
_anom_model = None


def _load_models() -> Tuple[object, object]:
    global _risk_model, _anom_model
    if _risk_model is None and RISK_MODEL_PATH.exists():
        with open(RISK_MODEL_PATH, "rb") as f:
            _risk_model = pickle.load(f)
    if _anom_model is None and ANOM_MODEL_PATH.exists():
        with open(ANOM_MODEL_PATH, "rb") as f:
            _anom_model = pickle.load(f)
    return _risk_model, _anom_model


def _vector_from_metrics(metrics: Dict) -> np.ndarray:
    vals = []
    for k in FEATURES:
        v = metrics.get(k)
        vals.append(0.0 if v is None else float(v))
    return np.array(vals, dtype=float).reshape(1, -1)


def _fallback(metrics: Dict) -> Dict:
    stress = float(metrics.get("stress_score") or 0.0)
    compliance = float(metrics.get("compliance_score") or 100.0)
    debt = float(metrics.get("debt_ratio") or 0.0)
    liq = float(metrics.get("liquidity_ratio") or 1.0)
    risk_points = (
        (35 if stress > 0.6 else 15 if stress > 0.3 else 0)
        + (30 if compliance < 60 else 15 if compliance < 80 else 0)
        + (20 if debt > 0.6 else 10 if debt > 0.4 else 0)
        + (15 if liq < 1.0 else 5 if liq < 1.5 else 0)
    )
    if risk_points >= 60:
        label = "risk"
    elif risk_points >= 30:
        label = "warning"
    else:
        label = "healthy"
    confidence = min(0.95, max(0.55, risk_points / 100 + 0.5))
    return {
        "ml_risk_label": label,
        "ml_risk_confidence": round(confidence, 3),
        "ml_anomaly_score": None,
        "ml_anomaly_flag": False,
        "ml_models_loaded": False,
    }


def infer_self_trained_signals(metrics: Dict) -> Dict:
    risk_model, anom_model = _load_models()
    if risk_model is None or anom_model is None:
        return _fallback(metrics)

    x = _vector_from_metrics(metrics)
    pred = risk_model.predict(x)[0]
    proba = risk_model.predict_proba(x)[0]
    confidence = float(np.max(proba))

    labels = {0: "healthy", 1: "warning", 2: "risk"}
    risk_label = labels.get(int(pred), "warning")

    anom_score = float(anom_model.score_samples(x)[0])
    anom_flag = int(anom_model.predict(x)[0]) == -1

    return {
        "ml_risk_label": risk_label,
        "ml_risk_confidence": round(confidence, 3),
        "ml_anomaly_score": round(anom_score, 5),
        "ml_anomaly_flag": bool(anom_flag),
        "ml_models_loaded": True,
    }
