"""Scoring endpoint tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from tests.factories import fraud_payload, legit_payload


def test_predict_returns_a_probability_and_persists_it(client: TestClient):
    response = client.post("/predict", json=legit_payload())

    assert response.status_code == 200
    body = response.json()
    assert 0.0 <= body["fraud_probability"] <= 1.0
    assert body["threshold"] > 0
    assert body["model_version"]
    assert body["latency_ms"] >= 0
    assert body["review_required"] == body["is_fraud"]

    history = client.get("/predictions").json()
    assert body["transaction_id"] in [
        item["transaction_id"] for item in history["items"]
    ]


def test_fraud_sample_is_flagged_and_routed_to_review(client: TestClient):
    body = client.post("/predict", json=fraud_payload()).json()

    assert body["is_fraud"] is True
    assert body["fraud_probability"] > body["threshold"]
    assert body["review_required"] is True

    queue = client.get("/review-queue").json()
    assert body["transaction_id"] in [
        item["transaction_id"] for item in queue["items"]
    ]


def test_batch_probabilities_match_scoring_rows_one_at_a_time(client: TestClient):
    """The vectorised batch path must agree with single-row scoring.

    Scoring in one `predict_proba` call per batch is a large speedup, and this
    pins the invariant that could most easily break while doing it.
    """
    payloads = [
        legit_payload(),
        fraud_payload(),
        legit_payload(Amount=999.0),
        fraud_payload(),
    ]

    singles = [
        client.post("/predict", json=payload).json()["fraud_probability"]
        for payload in payloads
    ]
    response = client.post("/predict/batch", json=payloads)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == len(payloads)
    assert [row["fraud_probability"] for row in body["results"]] == pytest.approx(
        singles, abs=1e-9
    )
    assert body["fraud_count"] == sum(row["is_fraud"] for row in body["results"])
    assert body["latency_ms"] >= 0


def test_batch_echoes_the_transaction_identifiers_and_amounts(client: TestClient):
    payloads = [legit_payload(), fraud_payload()]
    body = client.post("/predict/batch", json=payloads).json()

    assert [row["Amount"] for row in body["results"]] == [
        payload["Amount"] for payload in payloads
    ]
    assert len({row["transaction_id"] for row in body["results"]}) == 2


def test_batch_larger_than_the_configured_cap_is_rejected(make_settings):
    app = create_app(make_settings(max_batch_size=2))
    with TestClient(app) as test_client:
        response = test_client.post(
            "/predict/batch", json=[legit_payload() for _ in range(3)]
        )

    assert response.status_code == 413
    error = response.json()["error"]
    assert error["code"] == "batch_too_large"
    assert error["details"] == {"max_batch_size": 2, "received": 3}


def test_empty_batch_is_rejected(client: TestClient):
    response = client.post("/predict/batch", json=[])

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "empty_batch"


def test_missing_feature_returns_a_structured_validation_error(client: TestClient):
    payload = legit_payload()
    payload.pop("V14")

    response = client.post("/predict", json=payload)

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"]
    assert any("V14" in problem["field"] for problem in error["details"]["problems"])


def test_unexpected_feature_is_rejected(client: TestClient):
    payload = legit_payload()
    payload["MysteryColumn"] = 1.0

    assert client.post("/predict", json=payload).status_code == 422


def test_history_paginates_and_filters_flagged_rows(client: TestClient):
    for _ in range(3):
        client.post("/predict", json=legit_payload())
    fraud = client.post("/predict", json=fraud_payload()).json()

    page = client.get("/predictions", params={"limit": 2}).json()
    assert len(page["items"]) == 2
    assert page["total"] >= 4
    assert page["limit"] == 2

    flagged = client.get("/predictions", params={"flagged_only": True}).json()
    assert flagged["total"] >= 1
    assert all(item["is_flagged"] for item in flagged["items"])
    assert fraud["transaction_id"] in [
        item["transaction_id"] for item in flagged["items"]
    ]
