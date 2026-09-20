"""ORM models.

The schema exists to answer the questions a fraud operation actually asks: what
was scored, by which model version, at what risk, and what did a human decide
about it. Predictions are therefore stored rather than held in the browser.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class ModelVersion(Base):
    """A trained artifact set, recorded so decisions are traceable to a model."""

    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    model_name: Mapped[str] = mapped_column(String(64))
    trained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    artifact_sha256: Mapped[str | None] = mapped_column(String(64))
    recommended_threshold: Mapped[float | None] = mapped_column(Float)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    predictions: Mapped[list[Prediction]] = relationship(back_populates="model_version")


class Transaction(Base):
    """A scored transaction and the 30 features it was scored from."""

    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source: Mapped[str] = mapped_column(String(16))  # single | batch
    amount: Mapped[float] = mapped_column(Float)
    time_offset: Mapped[float] = mapped_column(Float)
    # The feature vector is stored inline. A high-volume deployment would move
    # this to a feature store; for now it keeps decisions reproducible.
    features: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    predictions: Mapped[list[Prediction]] = relationship(
        back_populates="transaction", cascade="all, delete-orphan"
    )
    decision: Mapped[ReviewDecision | None] = relationship(
        back_populates="transaction", cascade="all, delete-orphan", uselist=False
    )


class Prediction(Base):
    """One model decision about one transaction."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[str] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), index=True
    )
    model_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("model_versions.id", ondelete="SET NULL"), index=True
    )
    probability: Mapped[float] = mapped_column(Float)
    is_flagged: Mapped[bool] = mapped_column(Boolean, index=True)
    threshold: Mapped[float] = mapped_column(Float)
    latency_ms: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    transaction: Mapped[Transaction] = relationship(back_populates="predictions")
    model_version: Mapped[ModelVersion | None] = relationship(back_populates="predictions")


class ReviewDecision(Base):
    """An analyst's disposition of a flagged transaction."""

    __tablename__ = "review_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[str] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), index=True
    )
    decision: Mapped[str] = mapped_column(String(16))  # approved | blocked | escalated
    decided_by: Mapped[str] = mapped_column(String(128))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    transaction: Mapped[Transaction] = relationship(back_populates="decision")


class AuditEvent(Base):
    """Append-only record of everything that happened, for audit and replay."""

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    actor: Mapped[str] = mapped_column(String(128))
    subject_type: Mapped[str] = mapped_column(String(64))
    subject_id: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
