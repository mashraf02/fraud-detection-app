from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np

app = FastAPI(title="Fraud Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = joblib.load("model/fraud_model.pkl")
scaler = joblib.load("model/scaler.pkl")
feature_order = joblib.load("model/feature_order.pkl")

class Transaction(BaseModel):
    Time: float
    Amount: float
    V1: float; V2: float; V3: float; V4: float; V5: float
    V6: float; V7: float; V8: float; V9: float; V10: float
    V11: float; V12: float; V13: float; V14: float; V15: float
    V16: float; V17: float; V18: float; V19: float; V20: float
    V21: float; V22: float; V23: float; V24: float; V25: float
    V26: float; V27: float; V28: float

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict")
def predict(tx: Transaction):
    row = tx.dict()
    row["Time"], row["Amount"] = scaler.transform([[row["Time"], row["Amount"]]])[0]
    features = np.array([[row[col] for col in feature_order]])

    proba = model.predict_proba(features)[0][1]
    return {
        "fraud_probability": round(float(proba), 4),
        "is_fraud": bool(proba > 0.5),
    }
