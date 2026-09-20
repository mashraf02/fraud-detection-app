"""API-key authentication.

Machine clients present a key in `X-API-Key`. Keys are compared in constant time
so the comparison does not leak their value through timing.

If no keys are configured the dependency allows the request through — that keeps
local development frictionless — but `validate_settings_or_raise` refuses to
start in production without keys, so the open mode cannot reach a real
deployment.
"""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Depends, Header, Request

from .config import Settings, get_settings
from .errors import APIError


def current_settings(request: Request) -> Settings:
    """Settings for the running app, falling back to the cached global.

    Reading from `app.state` keeps injected settings (tests, alternate
    deployments) authoritative over the process-wide default.
    """
    settings = getattr(request.app.state, "settings", None)
    return settings if settings is not None else get_settings()


def validate_settings_or_raise(settings: Settings) -> list[str]:
    """Return a list of fatal misconfigurations for the current environment."""
    problems: list[str] = []
    if settings.is_production:
        if not settings.api_key_set:
            problems.append(
                "No FRAUD_RADAR_API_KEYS configured. Production deployments must "
                "require authentication."
            )
        if not settings.cors_origin_list:
            problems.append("No FRAUD_RADAR_CORS_ORIGINS configured.")
        if any("*" in origin for origin in settings.cors_origin_list):
            problems.append(
                "Wildcard CORS origins are not allowed in production; list the "
                "exact origins that should be trusted."
            )
        if settings.auto_create_tables:
            problems.append(
                "FRAUD_RADAR_AUTO_CREATE_TABLES must be false in production; run "
                "`alembic upgrade head` instead."
            )
    return problems


def require_api_key(
    settings: Annotated[Settings, Depends(current_settings)],
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> str:
    """FastAPI dependency guarding authenticated endpoints.

    Returns the name of the principal that authenticated.
    """
    configured = settings.api_key_set
    if not configured:
        # Explicitly permitted only because startup rejects this in production.
        return "anonymous"

    if x_api_key is None:
        raise APIError(
            401,
            "missing_api_key",
            "This endpoint requires an X-API-Key header.",
        )

    for candidate in configured:
        if secrets.compare_digest(candidate, x_api_key):
            return f"api-key:{candidate[:6]}…"

    raise APIError(401, "invalid_api_key", "The supplied API key is not valid.")
