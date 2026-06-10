from __future__ import annotations

import pandas as pd

from config import SPEED_CLUSTER_BINS, SPEED_CLUSTER_LABELS


def assign_rule_based_speed_cluster(
    df: pd.DataFrame,
    speed_column: str = "currentSpeed",
    output_column: str = "speed_cluster_rule",
) -> pd.DataFrame:

    df = df.copy()

    if speed_column not in df.columns:
        df[output_column] = pd.Series([pd.NA] * len(df), dtype="object")
        return df

    speed_series = pd.to_numeric(df[speed_column], errors="coerce")
    df[output_column] = pd.cut(
        speed_series,
        bins=SPEED_CLUSTER_BINS,
        labels=SPEED_CLUSTER_LABELS,
        include_lowest=True,
        right=True,
    ).astype("object")

    return df