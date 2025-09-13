from ucimlrepo import fetch_ucirepo
import argparse
import pandas as pd
from pathlib import Path
from typing import Tuple, List
from sklearn.model_selection import train_test_split

DATASET_ID = 320
STUDYTIME_TO_HOURS = {1: 5.0, 2: 10.0, 3: 15.0, 4: 20.0}
YES_NO = ['schoolsup','famsup','paid','activities','nursery','higher','internet','romantic']
NUMERICAL = ['sex','age','studytime','failures','absences','G1','G2','G3']

def compute_difficulty(
    df: pd.DataFrame,
    group_col: str = 'school',
    dfw_threshold_percent: float = 50.0
) -> pd.DataFrame:
    """Compute course_difficulty per group using provided formula (0-1 output).

    difficulty = 0.5 * (1 - avg_grade/100) + 0.5 * dfw_rate

    Where:
      avg_grade uses final grade scaled to 0-100. Original G3 range is 0-20, so grade_100 = G3 * 5.
      dfw_rate = (# students with grade_100 < dfw_threshold_percent) / total students in group.
    Result already in [0,1] (components bounded) so no further normalization required.
    """
    if group_col not in df.columns:
        raise ValueError(f"Group column '{group_col}' not in dataframe")
    tmp = df.copy()
    tmp = tmp[tmp['G3'].notna()]
    if tmp.empty:
        raise ValueError("No G3 values available to compute difficulty.")
    tmp['grade_100'] = tmp['G3'].astype(float) * 5.0  # scale 0-20 -> 0-100
    grp = tmp.groupby(group_col).agg(
        avg_grade_100=('grade_100','mean'),
        cnt=('grade_100','count'),
        dfw=('grade_100', lambda s: (s < dfw_threshold_percent).sum())
    ).reset_index()
    grp['dfw_rate'] = grp['dfw'] / grp['cnt'].clip(lower=1)
    grp['course_difficulty'] = 0.5 * (1 - grp['avg_grade_100']/100.0) + 0.5 * grp['dfw_rate']
    grp = grp[[group_col,'course_difficulty']]
    return grp

def fetch_raw(limit: int = 0) -> pd.DataFrame:
    ds = fetch_ucirepo(id=DATASET_ID)
    df = ds.data.original.reset_index(drop=True)
    if limit:
        df = df.head(limit)
    return df

def build_features(
    df: pd.DataFrame,
    extended: bool = False,
    scale_grades: bool = False,
    super_minimal: bool = False,
    keep_g1_g2: bool = False,
    add_difficulty: bool = False,
    difficulty_group: str = 'school',
    dfw_threshold_percent: float = 50.0
) -> Tuple[pd.DataFrame, pd.Series]:
    """Build feature matrix X and target y.

    Modes:
      - super_minimal: only G1,G2,(failures) as features.
      - minimal (default): sex_M, age, study_hours, failures, attendance_rate, G1, G2
      - extended: adds YES/NO binaries.
    """
    if super_minimal:
        needed = ['G1','G2','G3','failures']
    else:
        needed = NUMERICAL + (YES_NO if extended else [])
    for c in needed:
        if c not in df.columns:
            df[c] = pd.NA

    work = df[needed].copy()
    work = work[work['G3'].notna()].reset_index(drop=True)

    # Merge difficulty if requested (works even if group col not in NUMERICAL list)
    if add_difficulty and not super_minimal:
        if difficulty_group not in df.columns:
            raise ValueError(f"difficulty group column '{difficulty_group}' not found")
        diff_df = compute_difficulty(df, group_col=difficulty_group, dfw_threshold_percent=dfw_threshold_percent)
        work = work.merge(diff_df, how='left', left_on=difficulty_group, right_on=difficulty_group)
    else:
        if add_difficulty and super_minimal:
            # In super minimal mode we skip adding it but warn via print later (handled in main)
            pass

    if not super_minimal:
        work['attendance_rate'] = 1 - work['absences'].clip(lower=0, upper=93) / 93
        work['study_hours'] = work['studytime'].map(STUDYTIME_TO_HOURS)
        work['sex_M'] = (work['sex'].astype(str).str.upper() == 'M').astype(int)
        if extended:
            for col in YES_NO:
                work[col + '_bin'] = (work[col].astype(str).str.lower() == 'yes').astype(int)
    else:
        # ensure failures numeric
        work['failures'] = work['failures'].fillna(0)

    if scale_grades:
        for g_col in ['G1','G2','G3']:
            if g_col in work:
                work[g_col] = work[g_col].astype(float) / 20.0

    y = work['G3'].astype(float)

    if super_minimal:
        feature_cols: List[str] = ['G1','G2','failures']
    else:
        feature_cols = ['sex_M','age','study_hours','failures','attendance_rate','G1','G2']
        if add_difficulty:
            feature_cols.append('course_difficulty')
        if extended:
            feature_cols.extend([c + '_bin' for c in YES_NO])

    X = work[feature_cols].astype(float)

    if not keep_g1_g2 and not super_minimal:
        # Optionally drop G1/G2 if user wants only non-grade predictors
        drop_cols = [c for c in ['G1','G2'] if c in X.columns]
        if drop_cols:
            X = X.drop(columns=drop_cols)

    return X, y

def main():
    parser = argparse.ArgumentParser(description='Build features for student performance dataset.')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--extended', action='store_true')
    parser.add_argument('--scale-grades', action='store_true')
    parser.add_argument('--super-minimal', action='store_true')
    parser.add_argument('--keep-g1-g2', action='store_true', help='Keep G1 and G2 in feature set when not super-minimal.')
    parser.add_argument('--test-size', type=float, default=0.0, help='If >0, perform train/test split with this fraction as test.')
    parser.add_argument('--out-dir', type=str, default='', help='Directory to save parquet outputs.')
    parser.add_argument('--add-difficulty', action='store_true', help='Add computed course difficulty feature.')
    parser.add_argument('--difficulty-group', type=str, default='school', help='Grouping column for difficulty (default school).')
    parser.add_argument('--dfw-threshold-percent', type=float, default=50.0, help='Threshold (0-100) for DFW rate component (default 50).')
    args = parser.parse_args()

    df = fetch_raw(args.limit)
    X, y = build_features(
        df,
        extended=args.extended,
        scale_grades=args.scale_grades,
        super_minimal=args.super_minimal,
        keep_g1_g2=args.keep_g1_g2,
        add_difficulty=args.add_difficulty,
        difficulty_group=args.difficulty_group,
        dfw_threshold_percent=args.dfw_threshold_percent
    )

    mode = 'super-minimal' if args.super_minimal else ('extended' if args.extended else 'minimal')
    print(f"Mode: {mode} | scale: {'0-1' if args.scale_grades else '0-20'} | difficulty: {args.add_difficulty}")
    if args.add_difficulty and args.super_minimal:
        print("Note: difficulty requested but super-minimal mode skips it.")
    print(f"Features shape: {X.shape}; Target shape: {y.shape}")
    print('Columns:', list(X.columns))
    print(X.head())

    if args.test_size and 0 < args.test_size < 1:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=args.test_size, random_state=42
        )
        print(f"Train shape: {X_train.shape}, Test shape: {X_test.shape}")
    else:
        X_train = X_test = y_train = y_test = None

    if args.out_dir:
        out = Path(args.out_dir)
        out.mkdir(parents=True, exist_ok=True)
        if X_train is not None:
            X_train.to_parquet(out / 'X_train.parquet')
            X_test.to_parquet(out / 'X_test.parquet')
            y_train.to_frame('final_grade').to_parquet(out / 'y_train.parquet')
            y_test.to_frame('final_grade').to_parquet(out / 'y_test.parquet')
        else:
            X.to_parquet(out / 'X.parquet')
            y.to_frame('final_grade').to_parquet(out / 'y.parquet')
        print(f"Saved data to {out}")

if __name__ == '__main__':
    main()

# Convenience loader for previously saved parquet outputs
def load_processed(out_dir: str):
    """Load processed feature/target parquet files from directory.

    Returns
    -------
    If train/test split exists: (X_train, X_test, y_train, y_test)
    Else: (X, y, None, None)
    """
    p = Path(out_dir)
    x_train = p / 'X_train.parquet'
    x_file = p / 'X.parquet'
    if x_train.exists():
        import pandas as _pd
        X_train = _pd.read_parquet(x_train)
        X_test = _pd.read_parquet(p / 'X_test.parquet')
        y_train = _pd.read_parquet(p / 'y_train.parquet')['final_grade']
        y_test = _pd.read_parquet(p / 'y_test.parquet')['final_grade']
        return X_train, X_test, y_train, y_test
    elif x_file.exists():
        import pandas as _pd
        X = _pd.read_parquet(x_file)
        y = _pd.read_parquet(p / 'y.parquet')['final_grade']
        return X, y, None, None
    else:
        raise FileNotFoundError(f"No processed parquet files in {out_dir}")
