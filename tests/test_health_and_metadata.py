"""Probes, model metadata and request correlation."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import create_app
from tests.factories import fraud_payload


def test_liveness_reports_ok(client: TestClient):
    body = client.get("/health").json()

    assert body["status"] == "ok"
    assert body["environment"] == "test"


def test_readiness_checks_database_and_model(client: TestClient):
    response = client.get("/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["checks"] == {"database": True, "model": True}
    assert body["model_version"]


def test_model_endpoint_reports_real_trained_metrics(client: TestClient):
    body = client.get("/model").json()

    metrics = body["metrics"]
    assert metrics["probabilities_calibrated"] is True
    assert metrics["pr_auc"] > metrics["pr_auc_baseline"]
    assert 0.0 <= metrics["expected_calibration_error"] <= 1.0
    assert body["threshold_source"] == "model_recommendation"
    assert body["effective_threshold"] == body["recommended_threshold"]
    assert len(body["features"]) == 30
    assert body["artifact_sha256"].get("fraud_model.pkl")

    # Provenance the UI renders as fact must come from the artifact, never from
    # a literal in the frontend.
    assert body["dataset"]["rows"] > 0
    assert body["dataset"]["fraud_rows"] > 0
    assert body["runtime"]["scikit_learn"]


def test_threshold_can_be_overridden_without_retraining(make_settings):
    app = create_app(make_settings(decision_threshold=0.42))
    with TestClient(app) as test_client:
        model = test_client.get("/model").json()
        prediction = test_client.post("/predict", json=fraud_payload()).json()

    assert model["threshold_source"] == "config"
    assert model["effective_threshold"] == 0.42
    assert prediction["threshold"] == 0.42


def test_request_id_is_generated_and_returned(client: TestClient):
    response = client.get("/health")

    assert response.headers.get("X-Request-ID")


def test_supplied_request_id_is_propagated(client: TestClient):
    response = client.get("/health", headers={"X-Request-ID": "trace-abc-123"})

    assert response.headers["X-Request-ID"] == "trace-abc-123"


def test_cors_allows_the_configured_frontend_origin(client: TestClient):
    response = client.options(
        "/predict",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
