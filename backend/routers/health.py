"""Liveness and readiness probes.

These are deliberately separate. Liveness must stay cheap and must not depend on
the database or model, otherwise a transient database blip would cause an
orchestrator to restart a perfectly healthy process.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from ..db import database_is_reachable, get_engine
from ..dependencies import SettingsDep
from ..schemas import HealthResponse, ReadinessResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
def health(settings: SettingsDep) -> HealthResponse:
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        environment=settings.environment,
    )


@router.get("/ready", response_model=ReadinessResponse, summary="Readiness probe")
def readiness(response: Response, request: Request) -> ReadinessResponse:
    database_ok = database_is_reachable(get_engine())
    model = getattr(request.app.state, "model", None)
    checks = {"database": database_ok, "model": model is not None}
    ready = all(checks.values())

    if not ready:
        # Non-200 so load balancers stop sending traffic to this instance.
        response.status_code = 503

    return ReadinessResponse(
        status="ready" if ready else "degraded",
        database="ok" if database_ok else "unavailable",
        model="loaded" if model is not None else "not_loaded",
        model_version=getattr(model, "version", None),
        checks=checks,
    )
