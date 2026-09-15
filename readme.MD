# Credit Card Fraud Detection App

An end-to-end fraud detection system: a trained ML model served via a FastAPI backend, with a React frontend for testing transactions live.

## Overview

Credit card fraud is extremely rare relative to legitimate transactions (~0.17% in this dataset), which makes it a genuinely hard classification problem — a model that predicts "legit" every time scores 99.8% accuracy while catching zero fraud. This project handles that imbalance explicitly and optimizes for **recall** (catching fraud) over raw accuracy.

## Dataset

[Credit Card Fraud Detection](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud) (ULB / Machine Learning Group), via Kaggle: 284,807 European card transactions over two days, 492 fraudulent (0.172%). Features `V1`–`V28` are PCA-anonymized for confidentiality; `Time` and `Amount` are raw.

## Architecture

```
data/           raw dataset (not committed — see Setup)
model/          training script + saved model artifacts (not committed)
backend/        FastAPI app serving /predict
frontend/       React (Vite) app
```

## Model

Logistic Regression with `class_weight="balanced"` to counter the extreme class imbalance.

| Metric             | Score |
|--------------------|-------|
| Recall (fraud)     | 0.92  |
| Precision (fraud)  | 0.06  |
| ROC-AUC            | 0.97  |

**Why precision is low on purpose:** the balanced class weighting pushes the model to flag aggressively so fraud isn't missed, accepting more false positives in exchange. In production this trade-off is usually tuned deliberately — e.g. flagged transactions go to a human review queue rather than being auto-blocked. Adjusting the decision threshold in `backend/main.py`, or swapping in XGBoost, are natural next steps to improve precision without sacrificing much recall.

## Setup

```bash
# Backend
python -m venv venv
source venv/Scripts/activate      # Windows Git Bash
# source venv/bin/activate        # macOS/Linux
pip install -r requirements.txt

# Get the dataset (requires a Kaggle account + API token)
kaggle datasets download -d mlg-ulb/creditcardfraud -p data --unzip

# Train the model
python model/train.py

# Frontend
cd frontend
npm install
```

## Running

Two terminals:

```bash
# Terminal 1 — API
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open `http://localhost:5173`, paste a transaction as JSON, click "Check Transaction."

## API

`POST /predict`

Request body: `Time`, `Amount`, `V1`–`V28` (all floats).

Response:

```json
{ "fraud_probability": 0.97, "is_fraud": true }
```

`GET /health` — basic liveness check.

## Next steps

- Swap Logistic Regression for XGBoost to improve precision at similar recall
- Make the classification threshold configurable instead of hardcoded at 0.5
- Add a transaction history / flagged-review log (would justify adding a database + Django/FastAPI's ORM layer)
- Containerize with Docker for one-command setup