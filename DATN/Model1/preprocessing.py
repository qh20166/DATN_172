from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

from config import NON_CLUSTER_COLUMNS


def remove_exact_duplicates(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    """Loại bỏ các dòng trùng lặp hoàn toàn."""
    before = len(df)
    dedup_df = df.drop_duplicates().reset_index(drop=True)
    removed = before - len(dedup_df)
    return dedup_df, removed


def compute_missing_ratio(df: pd.DataFrame) -> pd.Series:
    """Tính tỉ lệ thiếu dữ liệu theo cột."""
    return df.isna().mean().sort_values(ascending=False)


def compute_zero_ratio(df: pd.DataFrame) -> pd.Series:
    """Tính tỉ lệ giá trị bằng 0 theo cột số."""
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        return pd.Series(dtype=float)
    return (numeric_df == 0).mean().sort_values(ascending=False)


def compute_single_value_ratio(df: pd.DataFrame) -> pd.Series:
    """Tính tỉ lệ lặp lại của giá trị phổ biến nhất trên mỗi cột."""
    ratios = {}
    for col in df.columns:
        non_null = df[col].dropna()
        if non_null.empty:
            ratios[col] = 1.0
            continue
        top_freq = non_null.value_counts(normalize=True, dropna=True).iloc[0]
        ratios[col] = float(top_freq)
    return pd.Series(ratios).sort_values(ascending=False)


def drop_sparse_columns(
    df: pd.DataFrame,
    missing_threshold: float = 0.9,
) -> Tuple[pd.DataFrame, List[str], pd.Series]:
    """
    Loại bỏ các thuộc tính gần như không có dữ liệu.
    Ví dụ threshold = 0.9 nghĩa là cột bị thiếu >= 90% sẽ bị loại.
    """
    missing_ratio = compute_missing_ratio(df)
    sparse_columns = missing_ratio[missing_ratio >= missing_threshold].index.tolist()
    reduced_df = df.drop(columns=sparse_columns, errors="ignore")
    return reduced_df, sparse_columns, missing_ratio


def identify_low_value_columns(
    df: pd.DataFrame,
    zero_ratio_threshold: float = 0.9,
    dominant_ratio_threshold: float = 0.9,
    min_unique_numeric: int = 1,
) -> Tuple[List[str], Dict[str, str], pd.Series, pd.Series]:
    """
    Xác định các cột ít giá trị ứng dụng cho bài toán phân cụm.
    """
    low_value_reasons: Dict[str, str] = {}
    zero_ratio = compute_zero_ratio(df)
    dominant_ratio = compute_single_value_ratio(df)

    for col in df.columns:
        non_null = df[col].dropna()
        unique_count = int(non_null.nunique())
        is_numeric = pd.api.types.is_numeric_dtype(df[col])

        if col in NON_CLUSTER_COLUMNS:
            low_value_reasons[col] = "non_cluster_metadata"
            continue

        if unique_count <= min_unique_numeric:
            low_value_reasons[col] = "constant_or_single_value"
            continue

        if is_numeric and col in zero_ratio.index and float(zero_ratio[col]) >= zero_ratio_threshold:
            low_value_reasons[col] = f"zero_ratio>={zero_ratio_threshold}"
            continue

        if col in dominant_ratio.index and float(dominant_ratio[col]) >= dominant_ratio_threshold:
            low_value_reasons[col] = f"dominant_ratio>={dominant_ratio_threshold}"
            continue

    low_value_columns = sorted(low_value_reasons.keys())
    return low_value_columns, low_value_reasons, zero_ratio, dominant_ratio


def drop_low_value_columns(
    df: pd.DataFrame,
    zero_ratio_threshold: float = 0.9,
    dominant_ratio_threshold: float = 0.9,
) -> Tuple[pd.DataFrame, List[str], Dict[str, str], pd.Series, pd.Series]:
    """Loại bỏ các cột ít giá trị ứng dụng cho phân cụm."""
    low_value_columns, low_value_reasons, zero_ratio, dominant_ratio = identify_low_value_columns(
        df,
        zero_ratio_threshold=zero_ratio_threshold,
        dominant_ratio_threshold=dominant_ratio_threshold,
    )
    filtered_df = df.drop(columns=low_value_columns, errors="ignore")
    return filtered_df, low_value_columns, low_value_reasons, zero_ratio, dominant_ratio


def impute_missing_values(
    df: pd.DataFrame,
    exclude_columns: set[str] | None = None,
) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """
    Điền khuyết dữ liệu:
    - Cột số: median
    - Cột phân loại: mode, nếu không có mode thì gán 'Unknown'
    - Bỏ qua các cột định danh / thời gian trong exclude_columns
    """
    if exclude_columns is None:
        exclude_columns = set()

    df = df.copy()
    imputation_report: Dict[str, str] = {}

    numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_columns = [
        col
        for col in df.columns
        if col not in numeric_columns
        and col not in exclude_columns
        and not pd.api.types.is_datetime64_any_dtype(df[col])
    ]

    for col in numeric_columns:
        if col in exclude_columns:
            continue
        if df[col].isna().any():
            median_value = df[col].median()
            if pd.isna(median_value):
                continue
            df[col] = df[col].fillna(median_value)
            imputation_report[col] = f"median={median_value}"

    for col in categorical_columns:
        if df[col].isna().any():
            mode_series = df[col].mode(dropna=True)
            fill_value = mode_series.iloc[0] if not mode_series.empty else "Unknown"
            df[col] = df[col].fillna(fill_value)
            imputation_report[col] = f"mode={fill_value}"

    return df, imputation_report