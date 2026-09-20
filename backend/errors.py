"""A single error shape for every failure the API can produce.

Clients get a stable envelope — `{"error": {"code", "message", "details",
"request_id"}}` — instead of FastAPI's default shapes, which differ between
validation failures, raised HTTP errors and unhandled exceptions.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .observability import request_id_var

logger = logging.getLogger("fraud_radar.errors")


class APIError(Exception):
    """Raised to return a controlled error response."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def _envelope(
    status_code: int, code: str, message: str, details: dict | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "request_id": request_id_var.get(),
            }
        },
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    async def _handle_api_error(_: Request, exc: APIError) -> JSONResponse:
        return _envelope(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Surface which fields were wrong; the default 422 body is verbose and
        # leaks internals such as input type reprs.
        problems = [
            {
                "field": ".".join(str(part) for part in error.get("loc", [])),
                "problem": error.get("msg", "invalid value"),
            }
            for error in exc.errors()
        ]
        return _envelope(
            422,
            "validation_error",
            "The request payload was rejected.",
            {"problems": problems},
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_error(
        _: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        return _envelope(
            exc.status_code,
            f"http_{exc.status_code}",
            str(exc.detail),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        # Log the traceback but never return it to the caller.
        logger.exception("unhandled_exception", extra={"exception_type": type(exc).__name__})
        return _envelope(
            500,
            "internal_error",
            "An unexpected error occurred while processing the request.",
        )
