# Fraud Radar — Credit Card Fraud Detection App

An end-to-end credit card fraud detection system featuring a trained machine learning model served through a **FastAPI backend** and a **React frontend** with two parts:

* A marketing/overview landing page
* A working dashboard for real-time single and batch transaction checking

---

## Overview

Credit card fraud is extremely rare compared with legitimate transactions — only **0.17%** of transactions in this dataset are fraudulent.

This creates a highly imbalanced classification problem. A model that predicts every transaction as legitimate could achieve around **99.8% accuracy while detecting zero fraud cases**.

Fraud Radar addresses this imbalance explicitly and focuses on **fraud recall** — catching fraudulent transactions — rather than optimizing for raw accuracy.

The application also makes the precision/recall trade-off visible so users can understand the practical limitations of the model.

---

## Dataset

**Credit Card Fraud Detection** dataset from the ULB Machine Learning Group, available through Kaggle:

https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud

The dataset contains:

* **284,807** European credit card transactions
* **492** fraudulent transactions
* **0.172%** fraud rate
* **30 features**
* `V1`–`V28`: PCA-transformed and anonymized features
* `Time`: elapsed time between transactions
* `Amount`: transaction amount

The original features were anonymized for confidentiality.

---

## Architecture

```text
Fraud Radar
│
├── data/
│   └── Raw dataset
│
├── model/
│   ├── Training script
│   └── Saved model artifacts
│
├── backend/
│   └── FastAPI application
│       ├── Single transaction scoring
│       ├── Batch transaction scoring
│       └── Health check
│
└── frontend/
    └── React + Vite application
        ├── Landing page
        └── Fraud detection dashboard
```

### Project Structure

```text
data/                    # Raw dataset (not committed)
model/                   # Training script + model artifacts
backend/                 # FastAPI backend
frontend/                # React/Vite frontend

frontend/src/
├── Landing.jsx          # Marketing/overview page
├── Landing.css
├── App.jsx              # Fraud detection dashboard
└── App.css
```

---

## Machine Learning Model

Fraud Radar currently uses **Logistic Regression** with:

```python
class_weight="balanced"
```

This helps the model handle the extreme class imbalance between legitimate and fraudulent transactions.

### Results

| Metric            |    Score |
| ----------------- | -------: |
| Recall (Fraud)    | **0.92** |
| Precision (Fraud) | **0.06** |
| ROC-AUC           | **0.97** |

### Understanding the Results

The model achieves a high **fraud recall of 0.92**, meaning it identifies a large proportion of the fraudulent transactions in the test data.

However, fraud precision is relatively low at **0.06**. This means many transactions flagged as potentially fraudulent are actually legitimate.

This is a deliberate consequence of using balanced class weighting and prioritizing fraud detection over minimizing false positives.

In a real-world fraud detection system, flagged transactions could instead be sent to a **manual review queue** rather than automatically blocking every transaction.

Potential improvements include:

* Adjusting the classification threshold
* Cost-sensitive learning
* XGBoost or other tree-based models
* Better feature engineering
* Model calibration
* Production-specific precision/recall tuning

---

## Frontend

### Landing Page

The landing page provides an overview of the project before users enter the working application.

Features include:

* Sticky navigation
* Anchor links for:

  * How It Works
  * Results
  * Limitations
* **Open Dashboard** CTA
* Animated statistics:

  * 284,807 transactions
  * 492 fraud cases
  * 0.17% fraud rate
  * 30 features
* Four-step detection pipeline
* Single-check vs. batch-check comparison
* Model architecture diagram
* Model performance results
* Explicit limitations section
* Scroll-based fade-in animations
* Hover interactions
* Responsive design

### Dashboard

The dashboard is the main working fraud detection application.

#### Single Check

Users can submit an individual transaction using:

* `Time`
* `Amount`
* `V1`–`V28`

The interface separates the main transaction information from the technical PCA features.

The dashboard provides:

* Fraud probability
* Fraud/legitimate prediction
* Session history
* Empty state before the first prediction
* Loading indicators

#### Batch Upload

Users can upload multiple transactions through a CSV file.

Features include:

* Drag-and-drop upload
* File browser upload
* Dedicated batch prediction endpoint
* Total transaction count
* Flagged transaction count
* Complete prediction results table

#### Live Statistics

The dashboard maintains three live statistics:

* **Checked**
* **Flagged**
* **Legitimate**

These statistics update from both single transaction checks and batch uploads.

The interface is also responsive, with:

* Scrollable tables on smaller screens
* Stacked form fields
* Mobile-friendly navigation
* Loading states
* Empty states

---

## API

The FastAPI backend exposes the following endpoints.

### `POST /predict`

Predicts whether a single transaction is potentially fraudulent.

**Request:**

```json
{
  "Time": 406.0,
  "Amount": 149.62,
  "V1": -1.35,
  "V2": -0.07,
  "V3": 2.54,
  "...": "...",
  "V28": 0.02
}
```

The request contains:

```text
Time
Amount
V1 - V28
```

**Response:**

```json
{
  "fraud_probability": 0.97,
  "is_fraud": true
}
```

---

### `POST /predict/batch`

Predicts multiple transactions in a single request.

**Response:**

```json
{
  "results": [],
  "total": 50,
  "fraud_count": 3
}
```

---

### `GET /health`

Basic API liveness check.

Example response:

```json
{
  "status": "ok"
}
```

---

## Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd fraud-radar
```

### 2. Create a Python Virtual Environment

```bash
python -m venv venv
```

#### Windows Git Bash

```bash
source venv/Scripts/activate
```

#### macOS/Linux

```bash
source venv/bin/activate
```

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 4. Download the Dataset

The dataset can be downloaded from Kaggle.

Using the Kaggle CLI:

```bash
kaggle datasets download -d mlg-ulb/creditcardfraud -p data --unzip
```

This requires a Kaggle account and API credentials.

### 5. Train the Model

```bash
python model/train.py
```

The trained model artifacts will be generated by the training script.

### 6. Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

## Running the Application

Run the backend and frontend in separate terminals.

### Terminal 1 — FastAPI Backend

From the project root:

```bash
uvicorn backend.main:app --reload --port 8000
```

The API will be available at:

```text
http://localhost:8000
```

FastAPI's interactive API documentation is available at:

```text
http://localhost:8000/docs
```

### Terminal 2 — React Frontend

```bash
cd frontend
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

Open the frontend in your browser. The landing page will appear first.

Click **Open Dashboard** to access the fraud detection application.

---

## Tech Stack

| Layer            | Technology                               |
| ---------------- | ---------------------------------------- |
| Frontend         | React                                    |
| Build Tool       | Vite                                     |
| Backend          | FastAPI                                  |
| API Server       | Uvicorn                                  |
| Machine Learning | Scikit-learn                             |
| Model            | Logistic Regression                      |
| Language         | Python                                   |
| Dataset          | Kaggle / ULB Credit Card Fraud Detection |
| Styling          | CSS                                      |

---

## Limitations

This project is intended as a **machine learning demonstration and portfolio project**, not as a production-ready financial fraud prevention system.

Important limitations include:

### 1. Anonymized Features

Most transaction features (`V1`–`V28`) are PCA-transformed and anonymized, so they do not directly represent interpretable business features such as merchant category, customer location, device information, or transaction history.

### 2. No Persistent Storage

Transaction predictions are currently maintained only during the application session.

There is no production database for storing:

* Transaction history
* Fraud alerts
* Review decisions
* User information
* Model predictions

### 3. Precision/Recall Trade-off

The current model prioritizes fraud recall, resulting in relatively low precision.

A production system would need to determine the appropriate trade-off based on the financial cost of:

* Missing fraudulent transactions
* Incorrectly flagging legitimate transactions

### 4. No Authentication

The current application does not include user authentication or authorization.

### 5. Not a Production Fraud System

Real-world financial fraud detection would require additional considerations such as:

* Real-time transaction streams
* Customer behavior history
* Feature stores
* Model monitoring
* Data drift detection
* Model retraining
* Security and privacy controls
* Audit logging
* Human review workflows
* Production infrastructure

---

## Future Improvements

Planned improvements include:

* Replace Logistic Regression with XGBoost or other tree-based models
* Make the classification threshold configurable
* Improve precision while maintaining strong fraud recall
* Add a PostgreSQL database for transaction and prediction history
* Add authentication and authorization
* Add a flagged-transaction review workflow
* Add model monitoring and performance tracking
* Add Docker containerization
* Deploy the frontend and backend
* Add automated testing
* Implement CI/CD
* Add explainable AI features such as SHAP
* Support real-time transaction processing

---

## Project Goal

The goal of **Fraud Radar** is to demonstrate an end-to-end machine learning application rather than simply training a classification model.

The project combines:

```text
Data
  ↓
Preprocessing
  ↓
Model Training
  ↓
Model Evaluation
  ↓
FastAPI
  ↓
React Frontend
  ↓
Real-time Prediction
```

This makes the project a practical example of taking a machine learning model from **training → API → user-facing application**.
