"""Database engine, session factory and the FastAPI session dependency.

SQLAlchemy is used as the abstraction so the same code runs on Postgres in
production and SQLite for local development and tests. Anything Postgres-only
(JSONB, server-side defaults, native UUID columns) is deliberately avoided.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import Settings

logger = logging.getLogger("fraud_radar.db")


class Base(DeclarativeBase):
    """Declarative base for every ORM model."""


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def create_engine_from_settings(settings: Settings) -> Engine:
    connect_args: dict[str, object] = {}
    if settings.is_sqlite:
        # SQLite connections are used from a thread pool by FastAPI.
        connect_args["check_same_thread"] = False

    engine = create_engine(
        settings.database_url,
        echo=settings.db_echo,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

    if settings.is_sqlite:
        # SQLite disables foreign key enforcement unless asked.
        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _record) -> None:  # pragma: no cover
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def configure(engine: Engine) -> None:
    """Bind the process-wide engine and session factory."""
    global _engine, _session_factory
    _engine = engine
    _session_factory = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, class_=Session
    )


def get_engine() -> Engine:
    if _engine is None:
        raise RuntimeError("Database not configured; call configure() at startup.")
    return _engine


def get_session() -> Iterator[Session]:
    """FastAPI dependency yielding a request-scoped session."""
    if _session_factory is None:
        raise RuntimeError("Database not configured; call configure() at startup.")
    session = _session_factory()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Session for scripts and startup tasks."""
    if _session_factory is None:
        raise RuntimeError("Database not configured; call configure() at startup.")
    session = _session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def database_is_reachable(engine: Engine) -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:  # pragma: no cover - depends on live infrastructure
        logger.exception("database_healthcheck_failed")
        return False
