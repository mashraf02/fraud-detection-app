# Fraud Radar

Credit-card fraud scoring with a stored audit trail.

Fraud Radar takes a 30-feature transaction vector, scores it with a calibrated
model, records the decision together with the model version and threshold that
produced it, and routes anything over the cut-off to a human reviewer.

It is built as **decision support for a review team**: it does not auto-decline
card payments, and every number it shows a user is read from the running system
rather than written into the interface.

---

## The problem, and what this does about it

Fraud is rare. In the benchmark dataset used here **492 of 284,807 transactions
(0.172%)** are fraudulent, so a model that answers "legitimate" every time is
99.8% accurate and completely useless. Accuracy is therefore not a metric this
project reports.

What matters is the operating point: at a given cut-off, how much fraud is
caught (recall) and how much of what gets flagged is real fraud (precision).
Both are reported below, measured on data the model never saw.

---

## Measured performance

Held-out test split, 20% of the dataset, never seen by the scaler or the
classifier. Produced by `python model/train.py` and served at runtime by
`GET /model`.

| Metric | Value |
| --- | --- |
| ROC-AUC | **0.9698** |
| PR-AUC | **0.7467** (no-skill baseline 0.0017) |
| Brier score | 0.000694 |
| Expected calibration error | 0.000635 |
| Operating cut-off | **0.06** (model recommendation) |
| Recall at cut-off | **81.6%** (80 of 98 frauds caught) |
| Precision at cut-off | **82.5%** (17 false positives in 56,962 rows) |
| F1 at cut-off | 0.821 |

Confusion matrix at the operating point: 56,847 true negatives, 17 false
positives, 18 false negatives, 80 true positives.

### Why the cut-off is 0.06 and not 0.50

The threshold is chosen from the held-out precision/recall curve rather than
left at an inherited default. At 0.50 the same model reaches 83.8% precision but
only 63.3% recall — it misses 36 frauds instead of 18. Missing fraud is the
expensive error here, so the operating point is pushed toward recall, and every
prediction stores the threshold that was in force so a decision can be explained
later. Override it without retraining:

```bash
FRAUD_RADAR_DECISION_THRESHOLD=0.5 uvicorn backend.main:app
```

`GET /model` reports the effective threshold and whether it came from
configuration or the model's own recommendation.

### Two honesty fixes worth calling out

**The scaler used to leak.** An earlier version fitted `StandardScaler` on the
entire dataset *before* the train/test split, so test-set statistics influenced
training and inflated every reported metric. The scaler is now fitted on the
training split only, and `tests/test_training.py` asserts it — the test fails if
anyone reintroduces the leak.

**Probabilities are calibrated.** The base classifier is fitted with balanced
class weights, which distorts raw probabilities. A sigmoid (Platt) calibration
sits on top: prediction mean 0.001848 against an actual prevalence of 0.001720,
with an expected calibration error of 0.000635. Uncalibrated, the same model had
a Brier score 34x worse and 30 points less precision at the operating point.

---

## Architecture

```
                     ┌──────────────────────────────────────────┐
  browser  ────────► │  React console (Vite / nginx)            │
                     │  • landing page reads GET /model         │
                     │  • inspector posts POST /predict         │
                     └────────────────┬─────────────────────────┘
                                      │ /api (proxied, same origin)
                     ┌────────────────▼─────────────────────────┐
                     │  FastAPI                                 │
                     │  validate → score → threshold → persist  │
                     │           → audit                        │
                     └───────┬───────────────────┬──────────────┘
                             │                   │
                  ┌──────────▼────────┐  ┌───────▼───────────────┐
                  │ Postgres / SQLite │  │ model artifacts       │
                  │ transactions      │  │ fraud_model.pkl       │
                  │ predictions       │  │ scaler.pkl            │
                  │ model_versions    │  │ feature_order.pkl     │
                  │ decisions         │  │ metadata.json         │
                  │ audit_events      │  └───────────────────────┘
                  └───────────────────┘
```

### Layout

```
backend/
  config.py          env-driven settings (pydantic-settings), no literals
  db.py              engine + session factory
  models.py          SQLAlchemy tables
  schemas.py         request/response contracts
  model_registry.py  artifact loading, integrity checks, threshold resolution
  scoring.py         vectorised scoring + measured latency
  repository.py      persistence
  audit.py           append-only audit trail
  security.py        API-key auth, production guardrails
  observability.py   request ids, structured JSON logs
  errors.py          one error envelope for every failure
  routers/           health, model_info, predictions, review
  main.py            app factory

model/train.py       leakage-free training, calibration, metrics, metadata
migrations/          Alembic
frontend/src/        React console + landing page (EN/BN)
tests/               pytest suite
```

---

## Running it

### Local, two processes

```bash
python -m venv venv
source venv/Scripts/activate          # Windows Git Bash; venv/bin/activate elsewhere
pip install -r requirements-dev.txt

python model/train.py                 # needs data/creditcard.csv, writes model/
uvicorn backend.main:app --port 8000  # defaults to SQLite at data/fraud_radar.db

cd frontend && npm install && npm run dev
```

- API: http://localhost:8000 (interactive docs at `/docs`)
- Console: http://localhost:5173

The frontend calls relative `/api` paths; the Vite dev server proxies them to
`http://127.0.0.1:8000`, so the browser only ever talks to one origin. Point it
elsewhere with `VITE_API_PROXY_TARGET`.

### Docker Compose

```bash
cp .env.example .env        # set FRAUD_RADAR_API_KEYS
docker compose up --build
```

- API: http://localhost:8000
- Console: http://localhost:8080

The stack brings up Postgres, runs `alembic upgrade head` before the API accepts
traffic, and serves the built frontend through nginx, which also reverse-proxies
`/api`. Model artifacts are mounted from `./model` rather than baked into the
image, because retraining should not require an image rebuild.

### Tests and lint

```bash
pytest                      # 39 tests
ruff check backend model tests
cd frontend && npm run lint && npm run build
```

The suite covers the training pipeline, the scoring API, batch handling, the
review workflow, API-key auth and metadata reporting. `tests/test_training.py`
includes a deliberate regression test for the scaler-leak bug.

---

## API

Every failure — validation, HTTP, unhandled exception — returns the same shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request payload was rejected.",
    "details": { "problems": [ { "field": "V14", "problem": "Field required" } ] },
    "request_id": "0f1f4d0c8d3a4c1e9b0c1d2e3f4a5b6c"
  }
}
```

`X-Request-ID` is honoured if supplied and generated otherwise, and is echoed on
the response so a log line can be tied to a user report.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness. Deliberately does not touch the DB or model. |
| `GET` | `/ready` | Readiness: database and model, 503 when degraded. |
| `GET` | `/model` | Version, thresholds, metrics, dataset and runtime provenance. |
| `POST` | `/predict` | Score one transaction. |
| `POST` | `/predict/batch` | Score a batch, size-capped. |
| `GET` | `/predictions` | Scoring history, optionally flagged-only. |
| `GET` | `/review-queue` | Flagged transactions awaiting a decision. |
| `POST` | `/transactions/{id}/decision` | Record an analyst decision. |
| `GET` | `/transactions/{id}` | One transaction with predictions and audit trail. |

### `POST /predict`

```bash
curl -s localhost:8000/predict -H 'Content-Type: application/json' -d '{
  "Time": 93824, "Amount": 8.54,
  "V1": -3.632809, "V2": 5.437263, "V3": -9.136521, "V4": 10.307226,
  "V5": -5.42183, "V6": -2.864815, "V7": -10.634088, "V8": 3.018127,
  "V9": -4.89164, "V10": -11.235048, "V11": 8.788784, "V12": -18.553697,
  "V13": -0.339533, "V14": -15.623187, "V15": -0.188979, "V16": -12.427961,
  "V17": -20.159047, "V18": -6.888891, "V19": 2.586093, "V20": 1.354065,
  "V21": 2.30988, "V22": 0.97866, "V23": -0.09613, "V24": 0.432377,
  "V25": -0.435628, "V26": 0.650893, "V27": 1.693608, "V28": 0.857685
}'
```

```json
{
  "transaction_id": "648143f9-de07-4c8a-9f31-0b7a5c2e1d44",
  "fraud_probability": 1.0,
  "is_fraud": true,
  "threshold": 0.06,
  "model_version": "logreg-20260920T065606Z",
  "latency_ms": 13.5,
  "review_required": true
}
```

`fraud_probability` and `is_fraud` keep their original names so existing clients
still work; everything else is additive.

### Batch

Row-per-result, scored in one vectorised pass. Requests above
`FRAUD_RADAR_MAX_BATCH_SIZE` (default 5000) are rejected with `413` and an
explicit message rather than attempted — an unbounded batch is a memory
exhaustion vector.

### Review workflow

```bash
curl -s 'localhost:8000/review-queue?status=pending'
curl -s localhost:8000/transactions/<id>/decision \
  -H 'Content-Type: application/json' \
  -d '{"decision": "blocked", "decided_by": "analyst@example.com", "note": "confirmed with cardholder"}'
```

Decisions are `approved`, `blocked` or `escalated`, and each one appends to the
audit trail next to the score that triggered it.

---

## Configuration

All settings are environment variables with the `FRAUD_RADAR_` prefix; see
`.env.example`. Nothing in the codebase reads a path, threshold or origin from a
hardcoded literal.

| Variable | Default | Notes |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `production` turns on the startup guardrails. |
| `DATABASE_URL` | SQLite file | `postgresql+psycopg://...` in production. |
| `AUTO_CREATE_TABLES` | `true` | Set `false` and run migrations instead. |
| `MODEL_DIR` | `model` | Resolved relative to the project root. |
| `API_KEYS` | empty | Comma-separated. **Required in production.** |
| `CORS_ORIGINS` | localhost | Comma-separated exact origins. |
| `DECISION_THRESHOLD` | model's | Pin the cut-off without retraining. |
| `MAX_BATCH_SIZE` | `5000` | Server-side batch cap. |

In `production` the service refuses to start without at least one API key, and
clients send it as `X-API-Key`. In development, an empty key list disables auth
so a fresh checkout runs immediately.

---

## Frontend

**The frontend is schema-driven.** Nothing about the model is hardcoded in it:
the console renders whatever feature list `GET /model` declares, in the order the
artifact declares it. Point the UI at a different model — different feature
count, different domain — and the inspector, the CSV validator and the landing
page all follow it. The integration contract is `GET /model` plus `POST /predict`.

**Landing page** — explains the system and *shows* it running. Version, threshold,
dataset size, held-out metrics and library versions come from `GET /model`, and on
load the page scores a zero vector across every declared feature (the dataset
mean, once inputs are standardised), so the card on screen is a real inference
rather than a screenshot. A "declared interface" panel lists the actual feature
names and the model's provenance. If the API is unreachable the page says so
instead of falling back to a plausible-looking number.

**Console** — a single-row inspector generated from the declared schema (with a
name filter once the list gets long, and no dataset-specific presets), plus a CSV
batch screener. Results show the API-assigned transaction id, the applied cut-off,
the model version and the measured scoring latency. CSV files are validated
against the declared schema in the browser before upload, so a missing column is
reported as `row 42: V14 is missing` rather than as an opaque `422`.

Both are bilingual (English / বাংলা) with a switcher in the navigation; the
choice persists in `localStorage` and a first visit follows the browser locale.
Technical identifiers (`V1`–`V28`, `ROC-AUC`, model versions) stay Latin by
design.

Run `node .freebuff/check-keys.mjs` to verify every translated key resolves in
every locale — a missing key would otherwise render as a raw dotted path, which
neither the build nor the linter catches.

---

## What this is not

Stated plainly, because the interesting part of a fraud system is where it stops:

- **The review workflow has an API but no screen.** `/review-queue` and the
  decision endpoint are implemented, tested and audited; the console does not yet
  render a queue for an analyst to work through. That is the next milestone, not
  a finished feature.
- **Generalisation stops at the API boundary.** The frontend is model-agnostic —
  it renders whatever schema `GET /model` declares — but the backend still speaks
  this domain: `transaction.amount`, the `Time`/`Amount` columns on batch results
  and the log messages all assume a card-transaction shape. Serving a genuinely
  different domain means making those generic, or putting them behind a
  per-model field mapping.
- **Single-tenant.** One deployment serves one model and one shared key list.
  There is no organisation concept, so a hosted many-customer version needs
  tenant scoping on every table, per-tenant model versions, and keys mapped to a
  tenant rather than to a global list.
- **Features are anonymous.** `V1`–`V28` are PCA components. They cannot be
  traced back to "merchant category" or "device", so explanations are
  coefficient-level, not business-level.
- **The data is an old, static European card sample.** No streaming, no
  behavioural history, no velocity features beyond what the dataset provides,
  and therefore no defence against concept drift beyond retraining.
- **No drift or performance monitoring.** Nothing compares live input
  distributions against training, and nothing tracks realised precision after
  deployment.
- **Authentication is coarse.** API keys identify a client, not a person. There
  are no roles, no per-analyst permissions and no tenant scoping.
- **One model, deliberately simple.** Logistic regression on scaled inputs is
  chosen because it is inspectable and cheap to serve. Gradient-boosted trees
  would likely raise PR-AUC; they were not used before there was a workflow to
  measure the change against.
- **Not tuned for throughput.** A single Uvicorn worker scores vectorised
  batches comfortably, but nothing here has been load-tested.

### Next

- Review queue UI: case list, decision form, audit history per case.
- Domain-agnostic backend: generic field mapping instead of `amount`/`Time`
  columns, so one deployment can serve any model.
- Tenant scoping: organisations, per-tenant model versions, keys bound to a
  tenant.
- Analyst decisions feeding back as labels for retraining.
- Drift monitoring on input features, with alerting.
- Threshold tuned against an explicit cost function rather than F1.
- Roles and per-analyst attribution; model promotion workflow.
- CI running lint, tests and migrations on every push.

---

## Stack

| Layer | Technology |
| --- | --- |
| Model | scikit-learn — logistic regression + Platt calibration |
| API | FastAPI, Uvicorn, Pydantic v2 |
| Persistence | SQLAlchemy 2, Alembic, Postgres (SQLite for local/tests) |
| Frontend | React 19, Vite, PapaParse, hand-written CSS |
| Packaging | Docker, Docker Compose, nginx |
| Quality | pytest (39 tests), ruff, ESLint |

## Dataset

[Credit Card Fraud Detection](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud),
ULB Machine Learning Group — 284,807 transactions, 492 frauds, 30 features.
`data/creditcard.csv` is gitignored; download it via the Kaggle CLI before
training.

## License

MIT.
