import os
import sys
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import torch
import uvicorn

try:
    from . import data as data_mod  # type: ignore
    from .model import load_model, ConvClassifier, MLPClassifier  # type: ignore
except ImportError:  # pragma: no cover
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.append(parent_dir)
    import ml.data as data_mod  # type: ignore
    from ml.model import load_model, ConvClassifier, MLPClassifier  # type: ignore


class PredictRequest(BaseModel):
    past_grades: List[float] = Field(..., description="List of past grades (length must match model seq_len, default 10)")
    difficulty: Optional[float] = Field(None, description="Difficulty level 1-10 (optional if model not trained with difficulty)")

class PredictResponse(BaseModel):
    bucket_index: int
    bucket_label: str
    probabilities: List[float]

class HealthResponse(BaseModel):
    status: str
    model_type: str
    num_classes: int
    seq_len: int

app = FastAPI(title="Grade Bucket Prediction API", version="1.0.0")

_MODEL = None
_META = None
_DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'


def _load_on_start():
    global _MODEL, _META
    ckpt_path = os.environ.get('MODEL_CKPT', '').strip()
    if not ckpt_path:
        raise RuntimeError("Environment variable MODEL_CKPT not set. Provide path to saved .pt checkpoint.")
    if not os.path.isfile(ckpt_path):
        raise RuntimeError(f"Checkpoint file not found: {ckpt_path}")
    model, meta = load_model(ckpt_path)
    _MODEL = model.to(_DEVICE)
    _META = meta

@app.on_event("startup")
async def startup_event():
    _load_on_start()

@app.get('/health', response_model=HealthResponse)
async def health():
    if _MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return HealthResponse(status="ok", model_type=_META.get('model_type','unknown'), num_classes=_META.get('num_classes',0), seq_len=_META.get('seq_len',10) or 10)

# Helper to form feature vector consistent with training

def _build_feature_vector(past: List[float], difficulty: Optional[float]):
    seq_len = _META.get('seq_len', 10) or 10
    if len(past) != seq_len:
        raise HTTPException(status_code=400, detail=f"past_grades length {len(past)} does not match expected seq_len {seq_len}")
    grades = torch.tensor(past, dtype=torch.float32)
    # Infer scaling: if first feature column looks <=1 then training likely scaled
    scaled = False
    feat_cols = _META.get('feature_columns', [])
    if feat_cols:
        # crude heuristic: if median of stored min grade in training would be <=1 we scaled
        if all('g' in c for c in feat_cols if c.startswith('g')):
            # can't compute stats; rely on metadata args
            scaled = _META.get('args', {}).get('scale_grades', False)
    if scaled:
        grades = grades / 100.0 if grades.max() > 1.0 else grades
    features = [grades]
    # difficulty handling
    if _META.get('args', {}).get('add_difficulty', False):
        if difficulty is None:
            raise HTTPException(status_code=400, detail="difficulty is required by this model")
        # model trained with scaling (difficulty-1)/9
        diff_scaled = (float(difficulty) - 1.0) / 9.0
        features.append(torch.tensor([diff_scaled], dtype=torch.float32))
    elif difficulty is not None:
        # Provided but not used
        pass
    x = torch.cat(features)
    return x.unsqueeze(0)  # (1, F)

# Bucket label helper

def _bucket_label(idx: int, num_classes: int):
    if num_classes == 5:
        mapping = ["<60", "60-69", "70-79", "80-89", "90-100"]
        return mapping[idx] if 0 <= idx < 5 else str(idx)
    # 10-class buckets 0-9 -> 0-9,10-19,...,90-100
    if idx == 9:
        return "90-100"
    low = idx * 10
    high = low + 9
    return f"{low}-{high}"

@app.post('/predict', response_model=PredictResponse)
async def predict(req: PredictRequest):
    if _MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    _MODEL.eval()
    with torch.no_grad():
        x = _build_feature_vector(req.past_grades, req.difficulty).to(_DEVICE)
        logits = _MODEL(x)
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
        idx = int(probs.argmax())
        label = _bucket_label(idx, _META.get('num_classes', len(probs)))
        return PredictResponse(bucket_index=idx, bucket_label=label, probabilities=[float(p) for p in probs])

if __name__ == '__main__':
    # Example: uvicorn ml.serve:app --host 0.0.0.0 --port 8000
    ckpt = os.environ.get('MODEL_CKPT')
    if not ckpt:
        print('Set MODEL_CKPT=/path/to/model.pt before running.')
    uvicorn.run('ml.serve:app', host='0.0.0.0', port=int(os.environ.get('PORT', '8000')), reload=False)
