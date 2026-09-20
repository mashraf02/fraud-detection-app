"""Loads the trained model artifacts together with their metadata.

Artifacts are resolved relative to this file rather than the working directory,
so the service no longer breaks when started from a different folder — a failure
that previously surfaced as a bare FileNotFoundError during import.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib

logger = logging.getLogger("fraud_radar.model")

ARTIFACT_MODEL = "fraud_model.pkl"
ARTIFACT_SCALER = "scaler.pkl"
ARTIFACT_FEATURES = "feature_order.pkl"
ARTIFACT_METADATA = "metadata.json"

DEFAULT_SCALED_FEATURES = ("Time", "Amount")
DEFAULT_THRESHOLD = 0.5


class ModelLoadError(RuntimeError):
    """Raised when the model artifacts are missing or inconsistent."""


@dataclass(frozen=True)
class LoadedModel:
    version: str
    model_name: str
    trained_at: str | None
    model: Any
    scaler: Any
    feature_order: list[str]
    # Indices into feature_order, precomputed so scoring avoids a lookup per row.
    scaled_feature_indexes: tuple[int, ...]
    scaled_features: tuple[str, ...]
    recommended_threshold: float | None
    metrics: dict[str, Any]
    artifact_sha256: dict[str, str]
    metadata: dict[str, Any]


def load_model(model_dir: Path) -> LoadedModel:
    model_dir = Path(model_dir)
    model_path = model_dir / ARTIFACT_MODEL
    scaler_path = model_dir / ARTIFACT_SCALER
    features_path = model_dir / ARTIFACT_FEATURES
    metadata_path = model_dir / ARTIFACT_METADATA

    missing = [
        path.name
        for path in (model_path, scaler_path, features_path)
        if not path.exists()
    ]
    if missing:
        raise ModelLoadError(
            f"Missing model artifact(s) in {model_dir}: {', '.join(missing)}. "
            "Run `python model/train.py` to generate them."
        )

    metadata: dict[str, Any] = {}
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    else:
        logger.warning(
            "model_metadata_missing",
            extra={"path": str(metadata_path)},
        )

    feature_order = list(joblib.load(features_path))
    if not feature_order:
        raise ModelLoadError(f"{features_path} contains an empty feature list.")

    training = metadata.get("training", {})
    scaled_features = tuple(training.get("scaled_features") or DEFAULT_SCALED_FEATURES)

    unknown = [name for name in scaled_features if name not in feature_order]
    if unknown:
        raise ModelLoadError(
            f"Metadata declares scaled features {unknown} that are absent from the "
            "saved feature order; the artifacts are inconsistent."
        )
    scaled_feature_indexes = tuple(
        feature_order.index(name) for name in scaled_features
    )

    scaler = joblib.load(scaler_path)
    expected = len(scaled_features)
    actual = getattr(scaler, "n_features_in_", expected)
    if actual != expected:
        raise ModelLoadError(
            f"The saved scaler expects {actual} features but metadata declares "
            f"{expected} ({list(scaled_features)}). Retrain to realign them."
        )

    model = joblib.load(model_path)

    version = metadata.get("version") or f"unversioned-{model_path.stem}"
    metrics = metadata.get("metrics", {})
    recommended = metadata.get("recommended_threshold")

    logger.info(
        "model_loaded",
        extra={
            "model_version": version,
            "model_name": metadata.get("model_name"),
            "feature_count": len(feature_order),
            "recommended_threshold": recommended,
            "has_metadata": bool(metadata),
        },
    )

    return LoadedModel(
        version=version,
        model_name=metadata.get("model_name", "unknown"),
        trained_at=metadata.get("trained_at"),
        model=model,
        scaler=scaler,
        feature_order=feature_order,
        scaled_feature_indexes=scaled_feature_indexes,
        scaled_features=scaled_features,
        recommended_threshold=float(recommended) if recommended is not None else None,
        metrics=metrics,
        artifact_sha256=metadata.get("artifact_sha256", {}),
        metadata=metadata,
    )


@dataclass(frozen=True)
class ThresholdChoice:
    value: float
    source: str  # config | model_recommendation | default


def resolve_threshold(
    configured: float | None, recommended: float | None
) -> ThresholdChoice:
    """Operators can retune the threshold without retraining the model."""
    if configured is not None:
        return ThresholdChoice(value=float(configured), source="config")
    if recommended is not None:
        return ThresholdChoice(value=float(recommended), source="model_recommendation")
    return ThresholdChoice(value=DEFAULT_THRESHOLD, source="default")
