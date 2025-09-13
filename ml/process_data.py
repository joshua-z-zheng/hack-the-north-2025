"""Minimal / extended data processing script for Student Performance dataset (UCI id=360).

Two modes:
    1. Minimal (default): core predictive features only.
    2. Extended (pass --extended): adds cheap binary (yes/no) and ordinal lifestyle/support features.

Run (PowerShell examples):
    # Minimal feature set
    python ml/process_data.py --limit 400 --test-size 0.2 --out-dir data

    # Extended feature set + grade scaling 0-1
    python ml/process_data.py --extended --scale-grades --out-dir data_ext
"""
from __future__ import annotations
import argparse
from ucimlrepo import fetch_ucirepo
import pandas as pd
from pathlib import Path
from typing import Tuple, List
from sklearn.model_selection import train_test_split

DATASET_ID = 360
STUDYTIME_TO_HOURS = {1: 5.0, 2: 10.0, 3: 15.0, 4: 20.0}
MAX_ABS = 93

# Yes/No binary fields we may include in extended mode
YES_NO_FIELDS: List[str] = [
    'schoolsup','famsup','paid','activities','nursery','higher','internet','romantic'
]

# Additional ordinal features (1-5 scale mostly) to optionally include
ORDINAL_FIELDS: List[str] = [
    'famrel','freetime','goout','health'  # optionally add 'Dalc','Walc'
]


def build_features(df: pd.DataFrame, extended: bool = False, scale_grades: bool = False, super_minimal: bool = False) -> Tuple[pd.DataFrame, pd.Series]:
    """Produce feature matrix X and target y.

    Parameters
    ----------
    df : DataFrame
        Raw UCI dataset.
    extended : bool
        If True, include YES_NO_FIELDS and ORDINAL_FIELDS.
    scale_grades : bool
        If True, scale G1,G2,G3 by dividing by 20 (0-1 range).
    """
    if super_minimal:
        core_needed = ['G1', 'G2', 'G3', 'failures']  # failures optional but cheap
    else:
        core_needed = ['sex', 'age', 'studytime', 'failures', 'absences', 'G1', 'G2', 'G3']
    needed = core_needed + (YES_NO_FIELDS + ORDINAL_FIELDS if extended else [])
    for c in needed:
        if c not in df.columns:
            df[c] = pd.NA

    work = df[needed].copy()
    work = work[work['G3'].notna()].reset_index(drop=True)

    # Derived continuous features
    if not super_minimal:
        work['attendance_rate'] = 1 - work['absences'].clip(lower=0, upper=MAX_ABS) / MAX_ABS
        work['study_hours'] = work['studytime'].map(STUDYTIME_TO_HOURS)
        work['sex_M'] = (work['sex'].astype(str).str.upper() == 'M').astype(int)

    # Binary yes/no mapping
    if extended and not super_minimal:
        for col in YES_NO_FIELDS:
            work[col + '_bin'] = (work[col].astype(str).str.lower() == 'yes').astype(int)

    # Grade scaling if requested
    if scale_grades:
        for g_col in ['G1', 'G2', 'G3']:
            if g_col in work:
                work[g_col] = work[g_col].astype(float) / 20.0

    # Assemble feature columns
    if super_minimal:
        feature_cols = ['G1', 'G2', 'failures']
    else:
        feature_cols = ['sex_M', 'age', 'study_hours', 'failures', 'attendance_rate', 'G1', 'G2']
        if extended:
            feature_cols.extend([c + '_bin' for c in YES_NO_FIELDS])
            feature_cols.extend(ORDINAL_FIELDS)

    X = work[feature_cols].astype(float)
    y = work['G3'].astype(float)
    return X, y


def main(limit: int, test_size: float, out_dir: str, extended: bool, scale_grades: bool, super_minimal: bool):
    ds = fetch_ucirepo(id=DATASET_ID)
    df = ds.data.original.reset_index(drop=True)
    if limit:
        df = df.head(limit)

    X, y = build_features(df, extended=extended, scale_grades=scale_grades, super_minimal=super_minimal)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42
    )

    mode = 'super-minimal' if super_minimal else ('extended' if extended else 'minimal')
    print(f"Mode: {mode} | grade scale: {'0-1' if scale_grades else '0-20'}")
    print(f"X shape: {X.shape}; train: {X_train.shape}, test: {X_test.shape}")
    print("Feature columns (order):", list(X.columns))
    print("Sample features head:\n", X.head())

    if out_dir:
        out_path = Path(out_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        X_train.reset_index(drop=True).to_parquet(out_path / 'X_train.parquet')
        X_test.reset_index(drop=True).to_parquet(out_path / 'X_test.parquet')
        y_train.reset_index(drop=True).to_frame('final_grade').to_parquet(out_path / 'y_train.parquet')
        y_test.reset_index(drop=True).to_frame('final_grade').to_parquet(out_path / 'y_test.parquet')
        print(f"Saved splits to {out_path}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=0, help='Limit rows (0 means all)')
    parser.add_argument('--test-size', type=float, default=0.2)
    parser.add_argument('--out-dir', type=str, default='')
    args = parser.parse_args()
    parser.add_argument('--extended', action='store_true', help='Include extra binary + ordinal features')
    parser.add_argument('--scale-grades', action='store_true', help='Scale grades to 0-1 range')
    parser.add_argument('--super-minimal', action='store_true', help='Use only G1,G2(+failures) as features')
    args = parser.parse_args()
    main(args.limit, args.test_size, args.out_dir, args.extended, args.scale_grades, args.super_minimal)
