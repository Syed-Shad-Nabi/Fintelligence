import logging
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

MIN_ROWS    = 50
MIN_COLS    = 2
CONTAMINATION = 0.03

SEVERITY_HIGH   = -0.2
SEVERITY_MEDIUM = -0.1


def classify_severity(score: float) -> str:
    if score < SEVERITY_HIGH:
        return "high"
    if score < SEVERITY_MEDIUM:
        return "medium"
    return "low"


class AnomalyDetector:
    def __init__(self, contamination: float = CONTAMINATION, random_state: int = 42):
        self.contamination = contamination
        self.random_state  = random_state

    def detect(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        if "metric" in df.columns:
            logger.info(
                "Anomaly detection skipped | reason=financial-statement-format rows=%d", len(df)
            )
            return []

        numeric_df = df.select_dtypes(include=[np.number]).copy()
        numeric_df = numeric_df.dropna(axis=1, how="all")
        numeric_df = numeric_df.fillna(numeric_df.median(numeric_only=True))

        if numeric_df.empty or numeric_df.shape[1] < MIN_COLS:
            logger.info(
                "Anomaly detection skipped | reason=insufficient-numeric-cols cols=%d",
                numeric_df.shape[1],
            )
            return []

        if len(numeric_df) < MIN_ROWS:
            logger.info(
                "Anomaly detection skipped | reason=too-few-rows rows=%d min=%d",
                len(numeric_df), MIN_ROWS,
            )
            return []

        if len(numeric_df) > 100_000:
            numeric_df = numeric_df.head(100_000)

        scaler = StandardScaler()
        try:
            X = scaler.fit_transform(numeric_df)
        except Exception as exc:
            logger.error("Scaling error | error=%s", exc)
            return []

        n_estimators = min(100, max(10, len(X) // 10))
        iso = IsolationForest(
            n_estimators=n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
        )
        try:
            iso.fit(X)
            scores      = iso.score_samples(X)
            predictions = iso.predict(X)
        except Exception as exc:
            logger.error("IsolationForest error | error=%s", exc)
            return []

        anomalies = []
        for i, (pred, score) in enumerate(zip(predictions, scores)):
            if pred == -1:
                row_data   = df.iloc[i].fillna("").to_dict()
                clean_data = {}
                for k, v in row_data.items():
                    if isinstance(v, np.integer):
                        clean_data[k] = int(v)
                    elif isinstance(v, np.floating):
                        clean_data[k] = None if np.isnan(v) else float(v)
                    else:
                        clean_data[k] = v if isinstance(v, (str, int, float, bool, type(None))) else str(v)

                anomalies.append({
                    "row_index":     i,
                    "anomaly_score": round(float(score), 6),
                    "severity":      classify_severity(float(score)),
                    "data":          clean_data,
                })

        anomalies.sort(key=lambda x: x["anomaly_score"])
        logger.info(
            "Anomaly detection complete | rows=%d anomalies=%d", len(numeric_df), len(anomalies)
        )
        return anomalies
