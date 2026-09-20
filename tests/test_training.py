"""Training pipeline tests.

The first test is a regression guard for the original bug where the
StandardScaler was fitted on the full dataset before the train/test split.
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.preprocessing import StandardScaler

from model import train as train_module
from model.train import SCALED_FEATURES, THRESHOLD_GRID, split_dataset, train
from tests.factories import synthetic_frame

# Rows passed to each `StandardScaler.fit` call, observed by _SpyScaler.
_FITTED_ON: list[int] = []


class _SpyScaler(StandardScaler):
    """StandardScaler that records how many rows it was fitted on.

    Module level rather than nested so the artifact stays picklable.
    """

    def fit(self, X, y=None, **kwargs):  # noqa: N803
        _FITTED_ON.append(len(X))
        return super().fit(X, y, **kwargs)


def _write_dataset(tmp_path: Path, rows: int = 500) -> Path:
    dataset_path = tmp_path / "synthetic.csv"
    synthetic_frame(rows=rows).to_csv(dataset_path, index=False)
    return dataset_path


def test_scaler_is_fitted_on_training_rows_only(tmp_path, monkeypatch):
    """The scaler must only ever see the training split."""
    dataset_path = _write_dataset(tmp_path, rows=500)
    _FITTED_ON.clear()

    monkeypatch.setattr(train_module, "StandardScaler", _SpyScaler)

    metadata = train(
        dataset_path=dataset_path, out_dir=tmp_path, test_size=0.2, seed=42
    )

    assert len(_FITTED_ON) == 1, "the scaler should be fitted exactly once"
    assert _FITTED_ON[0] == int(round(500 * 0.8)), "scaler saw more than the train split"
    assert _FITTED_ON[0] < 500
    assert metadata["training"]["scaler_fit_on"] == "train_split_only"


def test_persisted_scaler_matches_an_independent_train_only_fit(tmp_path):
    """Numerical proof, not just a flag: the saved mean/scale match train-only."""
    frame = synthetic_frame(rows=600)
    dataset_path = tmp_path / "synthetic.csv"
    frame.to_csv(dataset_path, index=False)

    train(dataset_path=dataset_path, out_dir=tmp_path, test_size=0.2, seed=42)

    x_train, _, _, _ = split_dataset(frame, 0.2, 42)
    expected = StandardScaler().fit(x_train[SCALED_FEATURES].to_numpy())
    saved = joblib.load(tmp_path / "scaler.pkl")

    assert np.allclose(saved.mean_, expected.mean_)
    assert np.allclose(saved.scale_, expected.scale_)


def test_metadata_records_version_metrics_and_threshold(tmp_path):
    metadata = train(
        dataset_path=_write_dataset(tmp_path), out_dir=tmp_path, model_name="pytest"
    )

    assert metadata["version"].startswith("pytest-")
    assert metadata["recommended_threshold"] in THRESHOLD_GRID

    metrics = metadata["metrics"]
    for key in (
        "roc_auc",
        "pr_auc",
        "pr_auc_baseline",
        "brier_score",
        "expected_calibration_error",
        "mean_predicted_probability",
        "actual_prevalence",
        "operating_point",
        "at_default_threshold",
    ):
        assert key in metrics, f"metrics missing {key}"

    assert metrics["probabilities_calibrated"] is True
    # The no-skill baseline for average precision is the prevalence itself, so
    # the reported PR-AUC must be compared against it, not against 0.5.
    assert metrics["pr_auc_baseline"] == metrics["actual_prevalence"]
    assert metrics["pr_auc"] > metrics["pr_auc_baseline"]
    assert metrics["operating_point"]["threshold"] == metadata["recommended_threshold"]

    written = json.loads((tmp_path / "metadata.json").read_text(encoding="utf-8"))
    assert written["version"] == metadata["version"]
    assert "fraud_model.pkl" in written["artifact_sha256"]


def test_uncalibrated_training_is_flagged_as_such(tmp_path):
    metadata = train(
        dataset_path=_write_dataset(tmp_path),
        out_dir=tmp_path,
        calibration="none",
    )
    assert metadata["training"]["calibration"] == "none"
    assert metadata["metrics"]["probabilities_calibrated"] is False


def test_missing_dataset_raises_a_clear_error(tmp_path):
    import pytest

    with pytest.raises(FileNotFoundError, match="Dataset not found"):
        train(dataset_path=tmp_path / "nope.csv", out_dir=tmp_path)
