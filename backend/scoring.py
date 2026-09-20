"""Scoring service.

Batch scoring builds one feature matrix and makes a single `predict_proba` call
for the whole batch. The previous implementation looped row by row, which cost
one scaler transform and one model call per transaction and made large uploads
unusably slow.
"""

from __future__ import annotations

import time
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from .model_registry import LoadedModel


@dataclass(frozen=True)
class ScoringOutcome:
    probabilities: np.ndarray
    latency_ms: float


def build_feature_matrix(
    loaded: LoadedModel, rows: Sequence[dict[str, float]]
) -> np.ndarray:
    """Assemble the model's expected matrix and scale the continuous columns."""
    try:
        matrix = np.asarray(
            [[row[column] for column in loaded.feature_order] for row in rows],
            dtype=float,
        )
    except KeyError as exc:  # pragma: no cover - guarded by the request schema
        raise ValueError(f"Missing feature column: {exc}") from exc

    scaled_indexes = list(loaded.scaled_feature_indexes)
    if scaled_indexes:
        matrix[:, scaled_indexes] = loaded.scaler.transform(matrix[:, scaled_indexes])
    return matrix


def score_rows(
    loaded: LoadedModel, rows: Sequence[dict[str, float]]
) -> ScoringOutcome:
    """Return fraud probabilities for each row, plus measured latency."""
    started = time.perf_counter()
    if not rows:
        return ScoringOutcome(
            probabilities=np.empty(0, dtype=float),
            latency_ms=round((time.perf_counter() - started) * 1000, 3),
        )

    matrix = build_feature_matrix(loaded, rows)
    probabilities = loaded.model.predict_proba(matrix)[:, 1]
    latency_ms = round((time.perf_counter() - started) * 1000, 3)
    return ScoringOutcome(probabilities=probabilities, latency_ms=latency_ms)
