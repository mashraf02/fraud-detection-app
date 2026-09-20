"""Dependencies that read process-wide state off `app.state`.

The model, the resolved decision threshold and the model-version row id are all
established once at startup, so endpoints simply ask for them.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from .config import Settings
from .db import get_session
from .errors import APIError
from .model_registry import LoadedModel, ThresholdChoice
from .security import current_settings, require_api_key


@dataclass(frozen=True)
class ScoringConfig:
    """How decisions are made right now: which threshold, and where it came from."""

    threshold: float
    source: str
    model_version: str
    model_version_id: int | None


def get_model(request: Request) -> LoadedModel:
    loaded = getattr(request.app.state, "model", None)
    if loaded is None:
        raise APIError(
            503,
            "model_unavailable",
            "No model is loaded; the scoring service is not ready.",
        )
    return loaded


def get_scoring_config(request: Request) -> ScoringConfig:
    config = getattr(request.app.state, "scoring_config", None)
    if config is None:
        raise APIError(
            503,
            "scoring_unavailable",
            "Scoring is not configured; the service is not ready.",
        )
    return config


SettingsDep = Annotated[Settings, Depends(current_settings)]
SessionDep = Annotated[Session, Depends(get_session)]
ModelDep = Annotated[LoadedModel, Depends(get_model)]
ScoringConfigDep = Annotated[ScoringConfig, Depends(get_scoring_config)]
ActorDep = Annotated[str, Depends(require_api_key)]

__all__ = [
    "ScoringConfig",
    "get_model",
    "get_scoring_config",
    "SettingsDep",
    "SessionDep",
    "ModelDep",
    "ScoringConfigDep",
    "ActorDep",
    "ThresholdChoice",
]
