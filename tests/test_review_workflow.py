"""Human review workflow tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.factories import fraud_payload


def _flagged_transaction(client: TestClient) -> str:
    scored = client.post("/predict", json=fraud_payload()).json()
    assert scored["is_fraud"], "the synthetic fraud sample must be flagged"
    return scored["transaction_id"]


def test_flagged_transaction_enters_the_queue_and_can_be_decided(client: TestClient):
    transaction_id = _flagged_transaction(client)

    queue = client.get("/review-queue").json()
    assert transaction_id in [item["transaction_id"] for item in queue["items"]]
    assert all(item["status"] == "pending" for item in queue["items"])

    response = client.post(
        f"/transactions/{transaction_id}/decision",
        json={
            "decision": "blocked",
            "decided_by": "analyst@example.com",
            "note": "Confirmed card testing pattern",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "blocked"
    assert body["decided_by"] == "analyst@example.com"
    assert body["decided_at"]

    # Once decided it leaves the pending queue but remains queryable.
    pending = client.get("/review-queue").json()
    assert transaction_id not in [
        item["transaction_id"] for item in pending["items"]
    ]
    blocked = client.get("/review-queue", params={"status": "blocked"}).json()
    assert transaction_id in [item["transaction_id"] for item in blocked["items"]]


def test_a_transaction_cannot_be_reviewed_twice(client: TestClient):
    transaction_id = _flagged_transaction(client)
    decision = {"decision": "approved", "decided_by": "analyst@example.com"}

    assert (
        client.post(f"/transactions/{transaction_id}/decision", json=decision).status_code
        == 200
    )

    duplicate = client.post(f"/transactions/{transaction_id}/decision", json=decision)
    assert duplicate.status_code == 409
    error = duplicate.json()["error"]
    assert error["code"] == "already_reviewed"
    assert error["details"]["decided_by"] == "analyst@example.com"


def test_deciding_an_unknown_transaction_returns_404(client: TestClient):
    response = client.post(
        "/transactions/does-not-exist/decision",
        json={"decision": "approved", "decided_by": "analyst@example.com"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "transaction_not_found"


def test_unknown_decision_value_is_rejected(client: TestClient):
    transaction_id = _flagged_transaction(client)

    response = client.post(
        f"/transactions/{transaction_id}/decision",
        json={"decision": "maybe", "decided_by": "analyst@example.com"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_detail_exposes_predictions_and_the_full_audit_trail(client: TestClient):
    transaction_id = _flagged_transaction(client)
    client.post(
        f"/transactions/{transaction_id}/decision",
        json={"decision": "escalated", "decided_by": "analyst@example.com"},
    )

    body = client.get(f"/transactions/{transaction_id}").json()

    assert body["transaction_id"] == transaction_id
    assert len(body["predictions"]) == 1
    assert body["predictions"][0]["is_flagged"] is True
    assert body["predictions"][0]["model_version"]
    assert body["decision"]["decision"] == "escalated"

    event_types = [event["event_type"] for event in body["audit_trail"]]
    assert event_types == ["prediction.created", "review.decision_recorded"]
    # The actor that authenticated is recorded, not just the analyst's claim.
    assert body["audit_trail"][1]["payload"]["decided_by"] == "analyst@example.com"


def test_detail_for_unknown_transaction_returns_404(client: TestClient):
    response = client.get("/transactions/nope")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "transaction_not_found"
