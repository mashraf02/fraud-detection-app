"""Shared fixtures."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.config import Settings
from backend.main import create_app
from model.train import train as train_model
from tests.factories import synthetic_frame


@pytest.fixture(scope="session")
def trained_model_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Train a small model once per session into a temp directory."""
    directory = tmp_path_factory.mktemp("trained-model")
    dataset_path = directory / "synthetic.csv"
    synthetic_frame().to_csv(dataset_path, index=False)

    train_model(
        dataset_path=dataset_path,
        out_dir=directory,
        test_size=0.25,
        seed=7,
        calibration="sigmoid",
        model_name="testlogreg",
    )
    return directory


@pytest.fixture
def make_settings(
    tmp_path: Path, trained_model_dir: Path
) -> Callable[..., Settings]:
    """Build settings pointing at a throwaway database and the test model."""

    def _make(**overrides: object) -> Settings:
        values: dict[str, object] = {
            "environment": "test",
            "database_url": f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
            "model_dir": trained_model_dir,
            "cors_origins": "http://localhost:5173",
            "api_keys": "",
            "auto_create_tables": True,
            "log_level": "WARNING",
        }
        values.update(overrides)
        return Settings(**values)  # type: ignore[arg-type]

    return _make


@pytest.fixture
def client(make_settings: Callable[..., Settings]) -> Iterator[TestClient]:
    """An unauthenticated client (no API keys configured)."""
    app = create_app(make_settings())
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_client(make_settings: Callable[..., Settings]) -> Iterator[TestClient]:
    """A client whose API requires a key."""
    app = create_app(make_settings(api_keys="secret-key-one,secret-key-two"))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"X-API-Key": "secret-key-one"}
