from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from config import MISSING_TOKENS, NUMERIC_HINT_COLUMNS


def load_raw_data(csv_path: Path) -> pd.DataFrame:
    """Đọc dữ liệu gốc và chuẩn hóa các token khuyết phổ biến."""
    df = pd.read_csv(csv_path, low_memory=False)
    df.columns = [col.strip() for col in df.columns]

    object_cols = df.select_dtypes(include=["object"]).columns
    for col in object_cols:
        normalized_series = df[col].astype("string").str.strip()
        normalized_series = normalized_series.replace(list(MISSING_TOKENS), np.nan)
        df[col] = normalized_series

    return df


def standardize_types(df: pd.DataFrame) -> pd.DataFrame:
    """Ép kiểu cột số và thời gian khi phù hợp."""
    df = df.copy()

    for col in df.columns:
        if col in NUMERIC_HINT_COLUMNS:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    datetime_formats = {
        "weather_date": "%Y-%m-%d-%H-%M",
        "time": "%Y-%m-%d",
        "sunrise": "%Y-%m-%dT%H:%M",
        "sunset": "%Y-%m-%dT%H:%M",
    }
    for col, fmt in datetime_formats.items():
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], format=fmt, errors="coerce")

    return df


def save_dataframe(df: pd.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)


def save_json(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)