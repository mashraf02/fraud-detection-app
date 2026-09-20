"""Scoring endpoints and scoring history."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from ..audit import record_event
from ..dependencies import (
    ActorDep,
    ModelDep,
    ScoringConfigDep,
    SessionDep,
    SettingsDep,
)
from ..errors import APIError
from ..repository import list_predictions, persist_scored_transactions
from ..schemas import (
    BatchPredictionResponse,
    BatchResultItem,
    PredictionHistoryResponse,
    PredictionRecord,
    PredictionResponse,
    TransactionInput,
)
from ..scoring import score_rows

router = APIRouter(tags=["predictions"])


@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Score a single transaction",
)
def predict_transaction(
    transaction: TransactionInput,
    session: SessionDep,
    model: ModelDep,
    config: ScoringConfigDep,
    actor: ActorDep,
) -> PredictionResponse:
    feature_row = transaction.as_feature_row()
    outcome = score_rows(model, [feature_row])
    probability = float(outcome.probabilities[0])
    is_flagged = probability >= config.threshold

    stored = persist_scored_transactions(
        session,
        feature_rows=[feature_row],
        probabilities=outcome.probabilities,
        threshold=config.threshold,
        model_version_id=config.model_version_id,
        source="single",
        total_latency_ms=outcome.latency_ms,
    )
    record = stored[0]

    record_event(
        session,
        event_type="prediction.created",
        actor=actor,
        subject_type="transaction",
        subject_id=record.id,
        payload={
            "probability": round(probability, 6),
            "is_flagged": is_flagged,
            "threshold": config.threshold,
            "model_version": config.model_version,
        },
    )
    session.commit()

    return PredictionResponse(
        transaction_id=record.id,
        fraud_probability=round(probability, 6),
        is_fraud=is_flagged,
        threshold=config.threshold,
        model_version=config.model_version,
        latency_ms=outcome.latency_ms,
        review_required=is_flagged,
    )


@router.post(
    "/predict/batch",
    response_model=BatchPredictionResponse,
    summary="Score a batch of transactions",
)
def predict_batch(
    transactions: list[TransactionInput],
    session: SessionDep,
    model: ModelDep,
    config: ScoringConfigDep,
    actor: ActorDep,
    settings: SettingsDep,
) -> BatchPredictionResponse:
    if not transactions:
        raise APIError(400, "empty_batch", "The batch contains no transactions.")

    # An unbounded batch is a memory-exhaustion vector, so it is rejected
    # explicitly rather than attempted.
    if len(transactions) > settings.max_batch_size:
        raise APIError(
            413,
            "batch_too_large",
            f"A batch may contain at most {settings.max_batch_size} transactions.",
            {
                "max_batch_size": settings.max_batch_size,
                "received": len(transactions),
            },
        )

    feature_rows = [item.as_feature_row() for item in transactions]
    outcome = score_rows(model, feature_rows)
    probabilities = [float(value) for value in outcome.probabilities]
    flags = [probability >= config.threshold for probability in probabilities]

    stored = persist_scored_transactions(
        session,
        feature_rows=feature_rows,
        probabilities=outcome.probabilities,
        threshold=config.threshold,
        model_version_id=config.model_version_id,
        source="batch",
        total_latency_ms=outcome.latency_ms,
    )

    batch_id = uuid.uuid4().hex
    record_event(
        session,
        event_type="prediction.batch_created",
        actor=actor,
        subject_type="batch",
        subject_id=batch_id,
        payload={
            "count": len(stored),
            "fraud_count": int(sum(flags)),
            "threshold": config.threshold,
            "model_version": config.model_version,
            "latency_ms": outcome.latency_ms,
        },
    )
    session.commit()

    results = [
        BatchResultItem(
            transaction_id=stored[index].id,
            Time=transactions[index].Time,
            Amount=transactions[index].Amount,
            fraud_probability=round(probabilities[index], 6),
            is_fraud=flags[index],
        )
        for index in range(len(stored))
    ]

    return BatchPredictionResponse(
        results=results,
        total=len(results),
        fraud_count=int(sum(flags)),
        threshold=config.threshold,
        model_version=config.model_version,
        latency_ms=outcome.latency_ms,
    )


@router.get(
    "/predictions",
    response_model=PredictionHistoryResponse,
    summary="Scoring history",
)
def prediction_history(
    session: SessionDep,
    actor: ActorDep,
    flagged_only: bool = Query(False, description="Only return flagged transactions"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> PredictionHistoryResponse:
    rows, total = list_predictions(
        session, flagged_only=flagged_only, limit=limit, offset=offset
    )

    items = [
        PredictionRecord(
            transaction_id=row.transaction_id,
            created_at=row.created_at,
            amount=row.transaction.amount if row.transaction else 0.0,
            probability=row.probability,
            threshold=row.threshold,
            is_flagged=row.is_flagged,
            model_version=row.model_version.version if row.model_version else None,
            decision=row.transaction.decision.decision
            if row.transaction and row.transaction.decision
            else None,
            decided_by=row.transaction.decision.decided_by
            if row.transaction and row.transaction.decision
            else None,
        )
        for row in rows
    ]

    return PredictionHistoryResponse(
        items=items, total=total, limit=limit, offset=offset
    )
