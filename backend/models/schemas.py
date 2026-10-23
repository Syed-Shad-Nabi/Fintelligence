from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr


# ─── Auth ────────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Analysis ────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    report_id: str
    status: str
    message: str


class AnalysisStatusResponse(BaseModel):
    report_id: str
    status: str
    progress: int
    error_message: Optional[str] = None


# ─── Reports ─────────────────────────────────────────────────────────────────

class MetricsOut(BaseModel):
    liquidity_ratio: Optional[float] = None
    debt_ratio: Optional[float] = None
    revenue_growth: Optional[float] = None
    stress_score: Optional[float] = None
    compliance_score: Optional[float] = None
    anomaly_count: int = 0


class AnomalyOut(BaseModel):
    row_index: int
    anomaly_score: float
    severity: str
    data: Dict[str, Any]


class ChartDataOut(BaseModel):
    revenue_trend: Optional[Dict[str, Any]] = None
    anomaly_distribution: Optional[Dict[str, int]] = None


class ReportSummary(BaseModel):
    id: str
    filename: str
    file_type: Optional[str]
    status: str
    row_count: Optional[int]
    col_count: Optional[int]
    anomaly_count: int
    summary_preview: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReportDetail(BaseModel):
    id: str
    filename: str
    file_type: Optional[str]
    status: str
    progress: int
    row_count: Optional[int]
    col_count: Optional[int]
    anomaly_count: int
    metrics: Optional[Dict[str, Any]]
    anomalies: Optional[List[Dict[str, Any]]]
    charts: Optional[Dict[str, Any]]
    summary: Optional[str]
    column_mapping: Optional[Dict[str, str]]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── Chat ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    report_id: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = []
