"""Append-only audit trail.

Anything that changes state records an event: who acted, on what, and with what
outcome. Nothing in the API updates or deletes these rows.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .models import AuditEvent


def record_event(
    session: Session,
    *,
    event_type: str,
    actor: str,
    subject_type: str,
    subject_id: str,
    payload: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        event_type=event_type,
        actor=actor,
        subject_type=subject_type,
        subject_id=subject_id,
        payload=payload or {},
    )
    session.add(event)
    return event
