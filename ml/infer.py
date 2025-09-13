import argparse, json, sys
import torch
import pandas as pd
from typing import List, Dict, Any

from .model import load_model


def load_checkpoint(model_path: str):
    model, ckpt = load_model(model_path)
    feature_cols = ckpt.get('feature_columns')
    classification = ckpt.get('classification', False)
    return model, feature_cols, classification


def prepare_dataframe(payloads: List[Dict[str, Any]], feature_cols: List[str]):
    # Ensure all required columns present; missing -> 0.0
    rows = []
    for p in payloads:
        row = []
        for col in feature_cols:
            row.append(p.get(col, 0.0))
        rows.append(row)
    return pd.DataFrame(rows, columns=feature_cols)


def predict(model, df: pd.DataFrame, classification: bool):
    model.eval()
    with torch.no_grad():
        X = torch.tensor(df.values, dtype=torch.float32)
        logits = model(X)
        if classification:
            probs = torch.softmax(logits, dim=1)
            preds = probs.argmax(dim=1).cpu().numpy().tolist()
            return preds, probs.cpu().numpy().tolist()
        else:
            preds = logits.squeeze().cpu().numpy().tolist()
            return preds, None


def main():
    parser = argparse.ArgumentParser(description='Inference for saved grade model')
    parser.add_argument('--model', required=True, help='Path to .pt checkpoint saved by training script')
    parser.add_argument('--json', type=str, help='Single JSON string of features')
    parser.add_argument('--file', type=str, help='Path to JSONL file (one JSON per line)')
    parser.add_argument('--out', type=str, default='', help='If set, write predictions JSON to this file')
    args = parser.parse_args()

    if not args.json and not args.file:
        print('Provide either --json or --file')
        sys.exit(1)

    model, feature_cols, classification = load_checkpoint(args.model)
    if feature_cols is None:
        print('Checkpoint missing feature_columns metadata; cannot align inputs.')
        sys.exit(1)

    payloads: List[Dict[str, Any]] = []
    if args.json:
        payloads.append(json.loads(args.json))
    if args.file:
        with open(args.file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    payloads.append(json.loads(line))

    df = prepare_dataframe(payloads, feature_cols)
    preds, probs = predict(model, df, classification)

    results = []
    for i, p in enumerate(payloads):
        item = {'input_index': i, 'prediction': preds[i]}
        if classification and probs is not None:
            item['probabilities'] = probs[i]
        results.append(item)

    out_obj = {'classification': classification, 'feature_columns': feature_cols, 'results': results}
    text = json.dumps(out_obj, indent=2)
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f'Wrote predictions to {args.out}')
    else:
        print(text)

if __name__ == '__main__':
    main()
