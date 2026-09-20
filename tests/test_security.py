"""Authentication and configuration-safety tests."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.main import bootstrap
from backend.security import validate_settings_or_raise


def test_requests_are_allowed_when_no_keys_are_configured(client: TestClient):
    assert client.get("/predictions").status_code == 200


def test_missing_key_is_rejected(auth_client: TestClient):
    response = auth_client.get("/predictions")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "missing_api_key"


def test_invalid_key_is_rejected(auth_client: TestClient):
    response = auth_client.get(
        "/predictions", headers={"X-API-Key": "not-a-real-key"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_api_key"


def test_valid_key_is_accepted(auth_client: TestClient, auth_headers: dict[str, str]):
    assert auth_client.get("/predictions", headers=auth_headers).status_code == 200


def test_every_configured_key_is_accepted(auth_client: TestClient):
    response = auth_client.get(
        "/predictions", headers={"X-API-Key": "secret-key-two"}
    )

    assert response.status_code == 200


def test_probes_stay_open_even_when_auth_is_enabled(auth_client: TestClient):
    """Orchestrator probes must not require credentials."""
    assert auth_client.get("/health").status_code == 200
    assert auth_client.get("/ready").status_code == 200


def test_scoring_requires_a_key_when_configured(auth_client: TestClient):
    from tests.factories import legit_payload

    response = auth_client.post("/predict", json=legit_payload())

    assert response.status_code == 401


def test_production_without_api_keys_is_a_fatal_misconfiguration(make_settings):
    problems = validate_settings_or_raise(
        make_settings(environment="production", api_keys="")
    )

    assert any("API_KEYS" in problem for problem in problems)


def test_production_with_wildcard_cors_is_rejected(make_settings):
    problems = validate_settings_or_raise(
        make_settings(
            environment="production",
            api_keys="key",
            cors_origins="https://app.example.com,*",
            auto_create_tables=False,
        )
    )

    assert any("Wildcard CORS" in problem for problem in problems)


def test_production_with_auto_create_tables_is_rejected(make_settings):
    problems = validate_settings_or_raise(
        make_settings(
            environment="production",
            api_keys="key",
            cors_origins="https://app.example.com",
            auto_create_tables=True,
        )
    )

    assert any("AUTO_CREATE_TABLES" in problem for problem in problems)


def test_production_with_correct_configuration_passes(make_settings):
    problems = validate_settings_or_raise(
        make_settings(
            environment="production",
            api_keys="key",
            cors_origins="https://app.example.com",
            auto_create_tables=False,
        )
    )

    assert problems == []


def test_startup_refuses_insecure_production_configuration(make_settings):
    with pytest.raises(RuntimeError, match="Refusing to start"):
        bootstrap(make_settings(environment="production", api_keys=""), FastAPI())
