"""Human review workflow.

Flagged transactions become cases. An analyst records a disposition, which is
both stored against the transaction and appended to the audit trail.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query

from ..audit import record_event
from ..dependencies import ActorDep, SessionDep
from ..repository import (
    get_transaction,
    list_audit_events,
    list_review_queue,
    record_decision,
)
from ..schemas import (
    DecisionInput,
    DecisionResponse,
    ReviewQueueItem,
    ReviewQueueResponse,
    TransactionDetailResponse,
)

router = APIRouter(tags=["review"])

ReviewStatus = Literal["pending", "approved", "blocked", "escalated"]


@router.get(
    "/review-queue",
    response_model=ReviewQueueResponse,
    summary="Transactions awaiting or holding a review decision",
)
def review_queue(
    session: SessionDep,
    actor: ActorDep,
    status: ReviewStatus = Query("pending"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ReviewQueueResponse:
    transactions, total = list_review_queue(
        session, status=status, limit=limit, offset=offset
    )

    items: list[ReviewQueueItem] = []
    for transaction in transactions:
        latest = (
            max(transaction.predictions, key=lambda prediction: prediction.id)
            if transaction.predictions
            else None
        )
        decision = transaction.decision
        items.append(
            ReviewQueueItem(
                transaction_id=transaction.id,
                created_at=transaction.created_at,
                amount=transaction.amount,
                probability=latest.probability if latest else 0.0,
                threshold=latest.threshold if latest else 0.0,
                status=decision.decision if decision else "pending",
                decided_by=decision.decided_by if decision else None,
                decided_at=decision.created_at if decision else None,
            )
        )

    return ReviewQueueResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@router.post(
    "/transactions/{transaction_id}/decision",
    response_model=DecisionResponse,
    summary="Record an analyst decision",
)
def record_transaction_decision(
    transaction_id: str,
    payload: DecisionInput,
    session: SessionDep,
    actor: ActorDep,
) -> DecisionResponse:
    decision = record_decision(
        session,
        transaction_id=transaction_id,
        decision=payload.decision,
        decided_by=payload.decided_by,
        note=payload.note,
    )

    record_event(
        session,
        event_type="review.decision_recorded",
        actor=actor,
        subject_type="transaction",
        subject_id=transaction_id,
        payload={
            "decision": payload.decision,
            "decided_by": payload.decided_by,
            "note": payload.note,
        },
    )
    session.commit()

    return DecisionResponse(
        transaction_id=transaction_id,
        decision=decision.decision,
        decided_by=decision.decided_by,
        note=decision.note,
        decided_at=decision.created_at,
    )


@router.get(
    "/transactions/{transaction_id}",
    response_model=TransactionDetailResponse,
    summary="A transaction with its predictions and audit trail",
)
def transaction_detail(
    transaction_id: str,
    session: SessionDep,
    actor: ActorDep,
) -> TransactionDetailResponse:
    transaction = get_transaction(session, transaction_id)
    events = list_audit_events(session, subject_id=transaction_id)

    return TransactionDetailResponse(
        transaction_id=transaction.id,
        created_at=transaction.created_at,
        source=transaction.source,
        amount=transaction.amount,
        time_offset=transaction.time_offset,
        features=transaction.features,
        predictions=[
            {
                "prediction_id": prediction.id,
                "probability": prediction.probability,
                "is_flagged": prediction.is_flagged,
                "threshold": prediction.threshold,
                "latency_ms": prediction.latency_ms,
                "model_version": prediction.model_version.version
                if prediction.model_version
                else None,
                "created_at": prediction.created_at,
            }
            for prediction in sorted(
                transaction.predictions, key=lambda item: item.id
            )
        ],
        decision={
            "decision": transaction.decision.decision,
            "decided_by": transaction.decision.decided_by,
            "note": transaction.decision.note,
            "decided_at": transaction.decision.created_at,
        }
        if transaction.decision
        else None,
        audit_trail=[
            {
                "event_type": event.event_type,
                "actor": event.actor,
                "payload": event.payload,
                "created_at": event.created_at,
            }
            for event in events
        ],
    )
