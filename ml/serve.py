import os
import json
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import torch
import pandas as pd

from .model import load_model

MODEL_PATH = os.environ.get('MODEL_PATH', 'model.pt')

app = FastAPI(title="Student Grade Prediction Service", version="0.1.0")

_model = None
_feature_cols: Optional[List[str]] = None
_is_classification: bool = False


class PredictRequest(BaseModel):
    instances: List[Dict[str, Any]] = Field(..., description="List of feature dictionaries")

class PredictResponse(BaseModel):
    classification: bool
    feature_columns: List[str]
    results: List[Dict[str, Any]]


def _ensure_model_loaded():
    global _model, _feature_cols, _is_classification
    if _model is None:
        try:
            model, ckpt = load_model(MODEL_PATH)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=str(e))
        _model = model
        _feature_cols = ckpt.get('feature_columns')
        if not _feature_cols:
            raise HTTPException(status_code=500, detail='Checkpoint missing feature_columns metadata')
        _is_classification = bool(ckpt.get('classification', False))


def _prepare_df(payloads: List[Dict[str, Any]]):
    rows = []
    for p in payloads:
        rows.append([p.get(c, 0.0) for c in _feature_cols])
    return pd.DataFrame(rows, columns=_feature_cols)


def _predict(df: pd.DataFrame):
    _model.eval()
    with torch.no_grad():
        X = torch.tensor(df.values, dtype=torch.float32)
        logits = _model(X)
        if _is_classification:
            probs = torch.softmax(logits, dim=1).cpu().numpy()
            preds = probs.argmax(axis=1)
            return preds, probs
        else:
            preds = logits.squeeze().cpu().numpy()
            return preds, None

@app.post('/predict', response_model=PredictResponse)
async def predict(req: PredictRequest):
    _ensure_model_loaded()
    df = _prepare_df(req.instances)
    preds, probs = _predict(df)
    results = []
    for i, _ in enumerate(req.instances):
        item = {"input_index": i, "prediction": float(preds[i]) if not _is_classification else int(preds[i])}
        if probs is not None:
            item['probabilities'] = probs[i].tolist()
        results.append(item)
    return PredictResponse(classification=_is_classification, feature_columns=_feature_cols, results=results)

@app.get('/healthz')
async def healthz():
    try:
        _ensure_model_loaded()
        return {"status": "ok", "classification": _is_classification, "features": len(_feature_cols or [])}
    except HTTPException as e:
        raise e
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

# Run: uvicorn ml.serve:app --reload --env-file .env --port 8000
