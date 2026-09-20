"""Request and response contracts.

Field names on the prediction responses (`fraud_probability`, `is_fraud`) are
kept from the original API so existing clients keep working; everything else is
additive.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

DecisionOutcome = Literal["approved", "blocked", "escalated"]


class TransactionInput(BaseModel):
    """The 30-feature vector the model consumes."""

    model_config = ConfigDict(extra="forbid")

    Time: float = Field(description="Seconds elapsed within the dataset window")
    Amount: float = Field(description="Transaction amount")
    V1: float
    V2: float
    V3: float
    V4: float
    V5: float
    V6: float
    V7: float
    V8: float
    V9: float
    V10: float
    V11: float
    V12: float
    V13: float
    V14: float
    V15: float
    V16: float
    V17: float
    V18: float
    V19: float
    V20: float
    V21: float
    V22: float
    V23: float
    V24: float
    V25: float
    V26: float
    V27: float
    V28: float

    def as_feature_row(self) -> dict[str, float]:
        return self.model_dump()


class PredictionResponse(BaseModel):
    transaction_id: str
    fraud_probability: float
    is_fraud: bool
    threshold: float
    model_version: str
    latency_ms: float
    review_required: bool = Field(
        description="True when the transaction was routed to human review"
    )


class BatchResultItem(BaseModel):
    transaction_id: str
    Time: float
    Amount: float
    fraud_probability: float
    is_fraud: bool


class BatchPredictionResponse(BaseModel):
    results: list[BatchResultItem]
    total: int
    fraud_count: int
    threshold: float
    model_version: str
    latency_ms: float


class ModelInfoResponse(BaseModel):
    version: str
    model_name: str
    trained_at: str | None
    effective_threshold: float
    recommended_threshold: float | None
    threshold_source: Literal["config", "model_recommendation", "default"]
    features: list[str]
    metrics: dict[str, Any]
    artifact_sha256: dict[str, str]
    # Provenance of the training run. The UI reads dataset size and library
    # versions from here instead of hardcoding them, so a retrained model cannot
    # leave stale claims behind on the landing page.
    dataset: dict[str, Any] = Field(default_factory=dict)
    runtime: dict[str, Any] = Field(default_factory=dict)


class PredictionRecord(BaseModel):
    transaction_id: str
    created_at: datetime
    amount: float
    probability: float
    threshold: float
    is_flagged: bool
    model_version: str | None
    decision: str | None
    decided_by: str | None


class PredictionHistoryResponse(BaseModel):
    items: list[PredictionRecord]
    total: int
    limit: int
    offset: int


class ReviewQueueItem(BaseModel):
    transaction_id: str
    created_at: datetime
    amount: float
    probability: float
    threshold: float
    status: Literal["pending", "approved", "blocked", "escalated"]
    decided_by: str | None
    decided_at: datetime | None


class ReviewQueueResponse(BaseModel):
    items: list[ReviewQueueItem]
    total: int
    limit: int
    offset: int


class DecisionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: DecisionOutcome
    decided_by: str = Field(min_length=1, max_length=128)
    note: str | None = Field(default=None, max_length=2000)


class DecisionResponse(BaseModel):
    transaction_id: str
    decision: DecisionOutcome
    decided_by: str
    note: str | None
    decided_at: datetime


class TransactionDetailResponse(BaseModel):
    transaction_id: str
    created_at: datetime
    source: str
    amount: float
    time_offset: float
    features: dict[str, float]
    predictions: list[dict[str, Any]]
    decision: dict[str, Any] | None
    audit_trail: list[dict[str, Any]]


class HealthResponse(BaseModel):
    status: str
    app: str
    environment: str


class ReadinessResponse(BaseModel):
    status: Literal["ready", "degraded"]
    database: str
    model: str
    model_version: str | None
    checks: dict[str, bool]
