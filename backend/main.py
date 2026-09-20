"""Fraud Radar API.

Startup is fail-fast: misconfiguration (open authentication in production,
unloadable model artifacts, unreachable database) stops the process rather than
serving traffic in a degraded or insecure state.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__, models  # noqa: F401  (registers ORM mappers)
from .config import Settings, get_settings
from .db import Base, configure, create_engine_from_settings, session_scope
from .dependencies import ScoringConfig
from .errors import register_error_handlers
from .model_registry import load_model, resolve_threshold
from .observability import RequestContextMiddleware, configure_logging
from .repository import upsert_model_version
from .routers import health, model_info, predictions, review
from .security import validate_settings_or_raise

logger = logging.getLogger("fraud_radar")


def bootstrap(settings: Settings, app: FastAPI) -> None:
    """Configure logging, storage and the model, or raise."""
    configure_logging(settings.log_level)

    problems = validate_settings_or_raise(settings)
    if problems:
        raise RuntimeError("Refusing to start: " + " ".join(problems))

    engine = create_engine_from_settings(settings)
    configure(engine)
    app.state.engine = engine

    if settings.auto_create_tables:
        if settings.is_production:
            logger.warning(
                "auto_create_tables_in_production",
                extra={"advice": "Run `alembic upgrade head` and set "
                                 "FRAUD_RADAR_AUTO_CREATE_TABLES=false."},
            )
        Base.metadata.create_all(engine)

    loaded = load_model(settings.model_dir)
    choice = resolve_threshold(
        settings.decision_threshold, loaded.recommended_threshold
    )

    with session_scope() as session:
        version_row = upsert_model_version(session, loaded)
        model_version_id = version_row.id

    app.state.model = loaded
    app.state.scoring_config = ScoringConfig(
        threshold=choice.value,
        source=choice.source,
        model_version=loaded.version,
        model_version_id=model_version_id,
    )

    logger.info(
        "startup_complete",
        extra={
            "environment": settings.environment,
            "database": settings.database_url.split("@")[-1],
            "model_version": loaded.version,
            "threshold": choice.value,
            "threshold_source": choice.source,
            "auth_required": bool(settings.api_key_set),
            "max_batch_size": settings.max_batch_size,
        },
    )
    if not settings.api_key_set:
        logger.warning(
            "authentication_disabled",
            extra={"reason": "No FRAUD_RADAR_API_KEYS configured."},
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Reads the settings resolved by create_app so callers (tests, alternate
    # deployments) can inject their own instead of the cached global.
    settings: Settings = getattr(app.state, "settings", None) or get_settings()
    bootstrap(settings, app)
    try:
        yield
    finally:
        engine = getattr(app.state, "engine", None)
        if engine is not None:
            engine.dispose()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        summary="Real-time and batch credit card fraud scoring.",
        lifespan=lifespan,
    )
    app.state.settings = settings

    # Request correlation runs inside CORS so preflight requests are answered
    # without touching the application.
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-API-Key", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    register_error_handlers(app)

    app.include_router(health.router)
    app.include_router(predictions.router)
    app.include_router(review.router)
    app.include_router(model_info.router)

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "version": __version__,
            "docs": "/docs",
            "health": "/health",
        }

    return app


app = create_app()
