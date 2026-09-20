"""Synthetic data factories.

The suite deliberately does not depend on `data/creditcard.csv` (150 MB and not
committed) or on whatever artifacts happen to be sitting in `model/`. Building a
small, clearly separable dataset keeps the tests hermetic and fast while still
exercising the real training and scoring code paths.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

FEATURE_NAMES = [f"V{i}" for i in range(1, 29)]
# How far the fraud class is shifted on its four informative features.
FRAUD_SHIFT = 6.0

FEATURE_COUNT = 30  # 28 V-features + Time + Amount


def synthetic_frame(rows: int = 800, fraud_rate: float = 0.1, seed: int = 7) -> pd.DataFrame:
    """Return a shuffled frame with `Time`, `Amount`, `V1..V28` and `Class`."""
    rng = np.random.default_rng(seed)
    fraud_rows = max(6, int(rows * fraud_rate))
    legit_rows = rows - fraud_rows

    legit = {name: rng.normal(0.0, 1.0, legit_rows) for name in FEATURE_NAMES}
    legit_frame = pd.DataFrame(legit)
    legit_frame["Time"] = rng.uniform(0.0, 172_000.0, legit_rows)
    legit_frame["Amount"] = rng.lognormal(3.0, 1.0, legit_rows)
    legit_frame["Class"] = 0

    fraud = {
        name: rng.normal(FRAUD_SHIFT if index < 4 else 0.0, 1.0, fraud_rows)
        for index, name in enumerate(FEATURE_NAMES)
    }
    fraud_frame = pd.DataFrame(fraud)
    fraud_frame["Time"] = rng.uniform(0.0, 172_000.0, fraud_rows)
    fraud_frame["Amount"] = rng.lognormal(6.0, 1.0, fraud_rows)
    fraud_frame["Class"] = 1

    combined = pd.concat([legit_frame, fraud_frame], ignore_index=True)
    return combined.sample(frac=1.0, random_state=seed).reset_index(drop=True)


def feature_payload(**overrides: float) -> dict[str, float]:
    """A neutral (all-zero) feature vector."""
    payload: dict[str, float] = {"Time": 1000.0, "Amount": 25.0}
    payload.update(dict.fromkeys(FEATURE_NAMES, 0.0))
    payload.update(overrides)
    return payload


def fraud_payload() -> dict[str, float]:
    """A vector sitting where the synthetic fraud class lives."""
    shifted = {f"V{i}": FRAUD_SHIFT for i in range(1, 5)}
    return feature_payload(Amount=400.0, **shifted)


def legit_payload(**overrides: float) -> dict[str, float]:
    return feature_payload(**overrides)
