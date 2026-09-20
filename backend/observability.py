"""Structured logging, request correlation and request timing.

Logs are emitted as one JSON object per line so they can be shipped to a log
aggregator without a parsing step. Every line carries the request id, which is
also returned to the caller in the `X-Request-ID` response header.
"""

from __future__ import annotations

import contextvars
import json
import logging
import sys
import time
import uuid
from datetime import UTC, datetime

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)

_LOGRECORD_FIELDS = frozenset(
    vars(logging.LogRecord("", 0, "", 0, "", (), None)).keys()
) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    """Renders a log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=UTC
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        for key, value in record.__dict__.items():
            if key not in _LOGRECORD_FIELDS and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO", json_output: bool = True) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        JsonFormatter()
        if json_output
        else logging.Formatter("%(levelname)s %(name)s %(message)s")
    )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    # httpx logs one line per outbound/test request at INFO, which buries the
    # application's own logs.
    logging.getLogger("httpx").setLevel(logging.WARNING)

    # Uvicorn installs its own handlers; route them through ours so output stays
    # uniform and gains request ids.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True


class RequestContextMiddleware:
    """Assigns a request id, times the request and logs the outcome.

    Implemented as raw ASGI rather than Starlette's BaseHTTPMiddleware so that
    streaming responses and background tasks keep working normally.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.logger = logging.getLogger("fraud_radar.request")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = MutableHeaders(scope=scope)
        request_id = headers.get("x-request-id") or uuid.uuid4().hex
        token = request_id_var.set(request_id)

        status_code = 500
        started = time.perf_counter()

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                MutableHeaders(scope=message)["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 3)
            log = self.logger.info if status_code < 500 else self.logger.error
            log(
                "request_completed",
                extra={
                    "http": {
                        "method": scope.get("method"),
                        "path": scope.get("path"),
                        "status_code": status_code,
                        "duration_ms": duration_ms,
                    }
                },
            )
            request_id_var.reset(token)
