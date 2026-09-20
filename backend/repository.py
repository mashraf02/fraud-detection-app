"""Database access helpers, kept out of the routers.

Routers stay thin and this module holds the queries a fraud operation needs:
scoring history, the pending review queue, and the audit trail for a case.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from .errors import APIError
from .models import AuditEvent, ModelVersion, Prediction, ReviewDecision, Transaction


def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def upsert_model_version(session: Session, loaded: Any) -> ModelVersion:
    """Record the loaded model version, making it the single active one."""
    record = session.scalar(
        select(ModelVersion).where(ModelVersion.version == loaded.version)
    )
    if record is None:
        record = ModelVersion(
            version=loaded.version,
            model_name=loaded.model_name,
            trained_at=_parse_timestamp(loaded.trained_at),
            artifact_sha256=loaded.artifact_sha256.get("fraud_model.pkl"),
            recommended_threshold=loaded.recommended_threshold,
            metrics=loaded.metrics,
        )
        session.add(record)
        session.flush()

    others = session.scalars(
        select(ModelVersion).where(
            ModelVersion.version != loaded.version, ModelVersion.is_active.is_(True)
        )
    )
    for other in others:
        other.is_active = False
    record.is_active = True
    session.flush()
    return record


def persist_scored_transactions(
    session: Session,
    *,
    feature_rows: Sequence[dict[str, float]],
    probabilities: Sequence[float],
    threshold: float,
    model_version_id: int | None,
    source: str,
    total_latency_ms: float,
) -> list[Transaction]:
    """Store each scored transaction with its prediction."""
    amortised_latency = (
        total_latency_ms / len(feature_rows) if feature_rows else total_latency_ms
    )
    transactions: list[Transaction] = []

    for index, row in enumerate(feature_rows):
        transaction_id = str(uuid.uuid4())
        probability = float(probabilities[index])
        transaction = Transaction(
            id=transaction_id,
            source=source,
            amount=float(row["Amount"]),
            time_offset=float(row["Time"]),
            features={key: float(value) for key, value in row.items()},
        )
        transaction.predictions.append(
            Prediction(
                model_version_id=model_version_id,
                probability=probability,
                is_flagged=probability >= threshold,
                threshold=float(threshold),
                latency_ms=round(amortised_latency, 4),
            )
        )
        transactions.append(transaction)

    session.add_all(transactions)
    session.flush()
    return transactions


def _latest_prediction_ids():
    """The most recent prediction id for each transaction."""
    return select(func.max(Prediction.id)).group_by(Prediction.transaction_id)


def list_predictions(
    session: Session,
    *,
    flagged_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Prediction], int]:
    filters = [Prediction.id.in_(_latest_prediction_ids())]
    if flagged_only:
        filters.append(Prediction.is_flagged.is_(True))

    total = session.scalar(
        select(func.count()).select_from(Prediction).where(*filters)
    )

    statement = (
        select(Prediction)
        .where(*filters)
        .options(
            joinedload(Prediction.transaction).joinedload(Transaction.decision),
            joinedload(Prediction.model_version),
        )
        .order_by(Prediction.created_at.desc(), Prediction.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(session.scalars(statement).unique()), int(total or 0)


def list_review_queue(
    session: Session,
    *,
    status: str = "pending",
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Transaction], int]:
    """Transactions whose latest prediction was flagged, by review status."""
    filters = [Prediction.id.in_(_latest_prediction_ids()), Prediction.is_flagged.is_(True)]

    statement = (
        select(Transaction)
        .join(Prediction, Prediction.transaction_id == Transaction.id)
        .outerjoin(ReviewDecision, ReviewDecision.transaction_id == Transaction.id)
        .where(*filters)
    )
    if status == "pending":
        statement = statement.where(ReviewDecision.id.is_(None))
    else:
        statement = statement.where(ReviewDecision.decision == status)

    count_statement = select(func.count()).select_from(statement.subquery())
    total = int(session.scalar(count_statement) or 0)

    rows = session.scalars(
        statement.options(
            joinedload(Transaction.decision),
            # Eager-loaded so the queue does not issue a query per row.
            selectinload(Transaction.predictions),
        )
        .order_by(Transaction.created_at.desc(), Transaction.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows.unique()), total


def get_transaction(session: Session, transaction_id: str) -> Transaction:
    transaction = session.scalar(
        select(Transaction)
        .where(Transaction.id == transaction_id)
        .options(
            selectinload(Transaction.predictions).joinedload(Prediction.model_version),
            joinedload(Transaction.decision),
        )
    )
    if transaction is None:
        raise APIError(
            404,
            "transaction_not_found",
            f"No transaction with id {transaction_id}.",
        )
    return transaction


def list_audit_events(
    session: Session, *, subject_id: str, subject_type: str = "transaction"
) -> list[AuditEvent]:
    statement = (
        select(AuditEvent)
        .where(
            AuditEvent.subject_type == subject_type,
            AuditEvent.subject_id == subject_id,
        )
        .order_by(AuditEvent.created_at.asc(), AuditEvent.id.asc())
    )
    return list(session.scalars(statement))


def record_decision(
    session: Session,
    *,
    transaction_id: str,
    decision: str,
    decided_by: str,
    note: str | None,
) -> ReviewDecision:
    transaction = session.get(Transaction, transaction_id)
    if transaction is None:
        raise APIError(
            404,
            "transaction_not_found",
            f"No transaction with id {transaction_id}.",
        )

    existing = session.scalar(
        select(ReviewDecision).where(ReviewDecision.transaction_id == transaction_id)
    )
    if existing is not None:
        raise APIError(
            409,
            "already_reviewed",
            "This transaction already has a review decision.",
            {
                "decision": existing.decision,
                "decided_by": existing.decided_by,
                "decided_at": existing.created_at.isoformat()
                if existing.created_at
                else None,
            },
        )

    record = ReviewDecision(
        transaction_id=transaction_id,
        decision=decision,
        decided_by=decided_by,
        note=note,
    )
    session.add(record)
    session.flush()
    return record
