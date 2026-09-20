"""Training pipeline for the fraud scoring model.

Produces four artifacts in the output directory:

    fraud_model.pkl   fitted classifier
    scaler.pkl        StandardScaler, fitted on the TRAINING split only
    feature_order.pkl the exact column order the model expects
    metadata.json     version, dataset fingerprint, metrics and threshold

The scaler is deliberately fitted on the training split alone. Fitting it on the
full dataset before splitting leaks test-set statistics into training and makes
the reported metrics optimistic; `tests/test_training.py` guards against that
regressing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

TARGET_COLUMN = "Class"
# Only these two columns are continuous enough to need scaling; V1-V28 are
# already PCA-transformed and roughly standardised.
SCALED_FEATURES = ["Time", "Amount"]
DEFAULT_TEST_SIZE = 0.2
DEFAULT_SEED = 42

# Operating points are chosen from a bounded grid rather than the model's raw
# unique scores. Balanced class weights saturate many probabilities to exactly
# 1.0, and searching those degenerate endpoints produces a threshold that no
# longer generalises.
THRESHOLD_GRID = tuple(round(value, 4) for value in np.arange(0.01, 1.0, 0.01))

ARTIFACT_MODEL = "fraud_model.pkl"
ARTIFACT_SCALER = "scaler.pkl"
ARTIFACT_FEATURES = "feature_order.pkl"
ARTIFACT_METADATA = "metadata.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_dataset(dataset_path: Path) -> pd.DataFrame:
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")
    frame = pd.read_csv(dataset_path)
    missing = {TARGET_COLUMN, *SCALED_FEATURES} - set(frame.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing)}")
    return frame


def split_dataset(
    frame: pd.DataFrame, test_size: float, seed: int
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    features = frame.drop(columns=[TARGET_COLUMN])
    target = frame[TARGET_COLUMN]
    return train_test_split(
        features, target, test_size=test_size, random_state=seed, stratify=target
    )


def fit_scaler(x_train: pd.DataFrame) -> StandardScaler:
    """Fit on the training split only — never on the full dataset.

    Arrays rather than DataFrames: the service scores numpy matrices, and
    fitting with feature names makes sklearn warn about (and risk diverging on)
    the name/position mismatch at serving time.
    """
    scaler = StandardScaler()
    scaler.fit(x_train[SCALED_FEATURES].to_numpy())
    return scaler


def scale_features(
    frame: pd.DataFrame, scaler: StandardScaler
) -> pd.DataFrame:
    scaled = frame.copy()
    scaled[SCALED_FEATURES] = scaler.transform(
        frame[SCALED_FEATURES].to_numpy()
    )
    return scaled


def expected_calibration_error(
    y_true: np.ndarray, y_prob: np.ndarray, bins: int = 10
) -> float:
    """Weighted mean gap between predicted confidence and observed frequency.

    Brier score alone can look great on a rare-positive problem; ECE shows
    whether the numbers are actually trustworthy bin by bin.
    """
    edges = np.linspace(0.0, 1.0, bins + 1)
    error = 0.0
    for lower, upper in zip(edges[:-1], edges[1:], strict=True):
        if upper >= 1.0:
            mask = (y_prob >= lower) & (y_prob <= upper)
        else:
            mask = (y_prob >= lower) & (y_prob < upper)
        if not mask.any():
            continue
        confidence = float(y_prob[mask].mean())
        frequency = float(y_true[mask].mean())
        error += float(mask.mean()) * abs(frequency - confidence)
    return error


def metrics_at_threshold(
    y_true: np.ndarray, y_prob: np.ndarray, threshold: float
) -> dict:
    y_pred = (y_prob >= threshold).astype(int)
    true_negative, false_positive, false_negative, true_positive = confusion_matrix(
        y_true, y_pred, labels=[0, 1]
    ).ravel()
    return {
        "threshold": round(float(threshold), 6),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 6),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 6),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 6),
        "confusion_matrix": {
            "true_negative": int(true_negative),
            "false_positive": int(false_positive),
            "false_negative": int(false_negative),
            "true_positive": int(true_positive),
        },
    }


def sweep_thresholds(
    y_true: np.ndarray, y_prob: np.ndarray, grid: tuple[float, ...] = THRESHOLD_GRID
) -> list[dict]:
    """Evaluate precision/recall/f1 at every threshold on the grid."""
    return [metrics_at_threshold(y_true, y_prob, threshold) for threshold in grid]


def choose_threshold(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    strategy: str = "best_f1",
    target_recall: float | None = None,
    grid: tuple[float, ...] = THRESHOLD_GRID,
) -> float:
    """Pick an operating point from the grid sweep.

    ``best_f1`` maximises F1, breaking ties toward higher precision.
    ``target_recall`` returns the highest threshold (best precision) that still
    reaches the requested recall, which is how a fraud team usually frames it:
    "catch at least N% of fraud, then minimise false positives".
    """
    sweep = sweep_thresholds(y_true, y_prob, grid)
    if not sweep:
        return 0.5

    if strategy == "target_recall" and target_recall is not None:
        reachable = [row for row in sweep if row["recall"] >= target_recall]
        if reachable:
            return float(max(row["threshold"] for row in reachable))
        # Target unreachable on this grid — fall back to the best F1.

    best = max(sweep, key=lambda row: (row["f1"], row["precision"]))
    return float(best["threshold"])


def build_classifier(
    max_iter: int, calibration: str = "sigmoid", seed: int = DEFAULT_SEED
):
    """Logistic regression, optionally with probability calibration.

    ``class_weight="balanced"`` is what makes the model usable at a 0.17% fraud
    rate, but it also inflates probabilities until many saturate at 1.0. Wrapping
    it in a calibrator restores a meaningful probability scale so the decision
    threshold corresponds to something an analyst can reason about.
    """
    base = LogisticRegression(
        max_iter=max_iter, class_weight="balanced", random_state=seed
    )
    if calibration == "none":
        return base
    return CalibratedClassifierCV(base, method=calibration, cv=3)


def evaluate(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    threshold: float,
    calibrated: bool = False,
) -> dict:
    prevalence = float(np.mean(y_true))
    # If the probabilities are uncalibrated they are a ranking signal, not a true
    # frequency. These diagnostics keep that visible instead of letting the UI
    # imply "0.9 means 90% likely fraud".
    return {
        "roc_auc": round(float(roc_auc_score(y_true, y_prob)), 6),
        "pr_auc": round(float(average_precision_score(y_true, y_prob)), 6),
        # A PR-AUC is only meaningful next to the no-skill baseline, which for
        # a rare-positive problem equals the prevalence.
        "pr_auc_baseline": round(prevalence, 6),
        "brier_score": round(float(brier_score_loss(y_true, y_prob)), 6),
        "expected_calibration_error": round(
            float(expected_calibration_error(y_true, y_prob)), 6
        ),
        # Calibration in the large: mean predicted risk should sit near the true
        # fraud rate. Both are reported so a mismatch is obvious.
        "mean_predicted_probability": round(float(np.mean(y_prob)), 6),
        "actual_prevalence": round(prevalence, 6),
        "probabilities_calibrated": calibrated,
        "test_rows": int(len(y_true)),
        "test_fraud_rows": int(y_true.sum()),
        "operating_point": metrics_at_threshold(y_true, y_prob, threshold),
        "at_default_threshold": metrics_at_threshold(y_true, y_prob, 0.5),
    }


def train(
    dataset_path: Path,
    out_dir: Path,
    test_size: float = DEFAULT_TEST_SIZE,
    seed: int = DEFAULT_SEED,
    threshold_strategy: str = "best_f1",
    target_recall: float | None = None,
    model_name: str = "logreg",
    max_iter: int = 1000,
    calibration: str = "sigmoid",
) -> dict:
    """Train, evaluate and persist the model. Returns the metadata dict."""
    dataset_path = Path(dataset_path)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    frame = load_dataset(dataset_path)
    x_train, x_test, y_train, y_test = split_dataset(frame, test_size, seed)

    scaler = fit_scaler(x_train)
    x_train_scaled = scale_features(x_train, scaler)
    x_test_scaled = scale_features(x_test, scaler)

    feature_order = list(x_train.columns)

    classifier = build_classifier(max_iter, calibration, seed)
    classifier.fit(
        x_train_scaled[feature_order].to_numpy(), y_train.to_numpy()
    )

    y_prob = classifier.predict_proba(
        x_test_scaled[feature_order].to_numpy()
    )[:, 1]
    threshold = choose_threshold(
        y_test.to_numpy(), y_prob, threshold_strategy, target_recall
    )
    metrics = evaluate(
        y_test.to_numpy(), y_prob, threshold, calibrated=calibration != "none"
    )

    model_path = out_dir / ARTIFACT_MODEL
    joblib.dump(classifier, model_path)
    joblib.dump(scaler, out_dir / ARTIFACT_SCALER)
    joblib.dump(feature_order, out_dir / ARTIFACT_FEATURES)

    trained_at = datetime.now(UTC)
    metadata = {
        "version": f"{model_name}-{trained_at.strftime('%Y%m%dT%H%M%SZ')}",
        "model_name": model_name,
        "trained_at": trained_at.isoformat(),
        "dataset": {
            "path": str(dataset_path),
            "sha256": sha256_file(dataset_path),
            "rows": int(len(frame)),
            "fraud_rows": int(frame[TARGET_COLUMN].sum()),
        },
        "training": {
            "test_size": test_size,
            "seed": seed,
            "max_iter": max_iter,
            "class_weight": "balanced",
            "calibration": calibration,
            "scaled_features": SCALED_FEATURES,
            "scaler_fit_on": "train_split_only",
            "threshold_strategy": threshold_strategy,
            "target_recall": target_recall,
            "threshold_grid": [min(THRESHOLD_GRID), max(THRESHOLD_GRID), len(THRESHOLD_GRID)],
            "feature_count": len(feature_order),
        },
        "recommended_threshold": round(float(threshold), 6),
        "metrics": metrics,
        "runtime": {
            "python": sys.version.split()[0],
            "scikit_learn": sklearn.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
        },
        "artifact_sha256": {
            ARTIFACT_MODEL: sha256_file(model_path),
            ARTIFACT_FEATURES: sha256_file(out_dir / ARTIFACT_FEATURES),
            ARTIFACT_SCALER: sha256_file(out_dir / ARTIFACT_SCALER),
        },
    }

    (out_dir / ARTIFACT_METADATA).write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    return metadata


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train the fraud detection model.")
    parser.add_argument(
        "--dataset", type=Path, default=Path("data/creditcard.csv"),
        help="Path to the credit card transaction CSV.",
    )
    parser.add_argument(
        "--out-dir", type=Path, default=Path("model"),
        help="Directory to write model artifacts into.",
    )
    parser.add_argument("--test-size", type=float, default=DEFAULT_TEST_SIZE)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument(
        "--threshold-strategy", choices=["best_f1", "target_recall"], default="best_f1"
    )
    parser.add_argument(
        "--target-recall", type=float, default=None,
        help="Recall to preserve when --threshold-strategy=target_recall.",
    )
    parser.add_argument("--model-name", default="logreg")
    parser.add_argument("--max-iter", type=int, default=1000)
    parser.add_argument(
        "--calibration", choices=["none", "sigmoid", "isotonic"], default="sigmoid",
        help="Probability calibration; 'sigmoid' (Platt) is the safe default for rare positives.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    metadata = train(
        dataset_path=args.dataset,
        out_dir=args.out_dir,
        test_size=args.test_size,
        seed=args.seed,
        threshold_strategy=args.threshold_strategy,
        target_recall=args.target_recall,
        model_name=args.model_name,
        max_iter=args.max_iter,
        calibration=args.calibration,
    )

    metrics = metadata["metrics"]
    operating = metrics["operating_point"]
    counts = operating["confusion_matrix"]

    print(f"version: {metadata['version']}")
    print(f"rows:    {metadata['dataset']['rows']:,} "
          f"({metadata['dataset']['fraud_rows']:,} fraud)")
    print()
    print(f"ROC-AUC: {metrics['roc_auc']:.4f}")
    print(f"PR-AUC:  {metrics['pr_auc']:.4f}  "
          f"(no-skill baseline {metrics['pr_auc_baseline']:.4f})")
    print(f"Brier:   {metrics['brier_score']:.4f}   "
          f"ECE: {metrics['expected_calibration_error']:.4f}")
    print(f"calibration in the large: mean predicted "
          f"{metrics['mean_predicted_probability']:.4f} vs actual "
          f"{metrics['actual_prevalence']:.4f}")
    print()
    print(f"operating point @ threshold {operating['threshold']:.6f}")
    print(f"  precision {operating['precision']:.4f}")
    print(f"  recall    {operating['recall']:.4f}")
    print(f"  f1        {operating['f1']:.4f}")
    print(f"  tp {counts['true_positive']}  fp {counts['false_positive']}  "
          f"fn {counts['false_negative']}  tn {counts['true_negative']}")
    print()
    print(f"artifacts written to {args.out_dir}/ "
          f"(including {ARTIFACT_METADATA})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
