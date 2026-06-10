from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_selection import mutual_info_regression
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

from config import DEFAULT_RANDOM_STATE
from io_utils import save_json


FEATURE_SELECTION_OUTPUT_DIRNAME = "feature_selection_outputs"
DEFAULT_TARGET_COLUMN = "currentSpeed"
DEFAULT_TOP_K = 10
DEFAULT_REDUNDANCY_THRESHOLD = 0.85
DEFAULT_STABILITY_RUNS = 5


HIGHER_IS_BETTER_METRICS = {
    "mean_relevance_score",
    "median_relevance_score",
    "target_abs_corr_mean",
    "target_abs_corr_median",
    "completeness_ratio",
    "stability_jaccard_mean",
    "dimension_reduction_ratio",
}

LOWER_IS_BETTER_METRICS = {
    "mean_abs_feature_correlation",
    "max_abs_feature_correlation",
    "redundant_pair_ratio",
    "missing_ratio_mean",
    "zero_ratio_mean",
    "dominant_ratio_mean",
}


def get_numeric_candidate_features(
    df: pd.DataFrame,
    target_column: str = DEFAULT_TARGET_COLUMN,
    candidate_columns: List[str] | None = None,
) -> List[str]:
    if candidate_columns is None:
        candidate_columns = df.columns.tolist()

    return [
        col for col in candidate_columns
        if col in df.columns
        and col != target_column
        and pd.api.types.is_numeric_dtype(df[col])
    ]


def prepare_feature_selection_matrix(
    df: pd.DataFrame,
    target_column: str,
    candidate_features: List[str],
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    usable_features = get_numeric_candidate_features(
        df,
        target_column=target_column,
        candidate_columns=candidate_features,
    )

    if target_column not in df.columns:
        raise ValueError(f"Không tìm thấy target column: {target_column}")

    if not usable_features:
        raise ValueError("Không có feature số để chạy feature selection.")

    work_df = df[usable_features + [target_column]].copy()
    work_df[target_column] = pd.to_numeric(work_df[target_column], errors="coerce")
    work_df = work_df.dropna(subset=[target_column])

    X_df = work_df[usable_features]
    y = work_df[target_column].to_numpy(dtype=float)

    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()

    X_imputed = imputer.fit_transform(X_df)
    X_scaled = scaler.fit_transform(X_imputed)

    return X_scaled, y, usable_features

def select_features_by_cumulative_score(
    score_series: pd.Series,
    cumulative_threshold: float = 0.85,
):
    if score_series.empty:
        return [], 0.0

    total_score = float(score_series.sum())
    if total_score <= 0:
        return [], 0.0

    score_ratio = score_series / total_score
    cumulative_ratio = score_ratio.cumsum()

    selected_features = cumulative_ratio[
        cumulative_ratio <= cumulative_threshold
    ].index.tolist()

    # thêm feature đầu tiên vượt threshold
    remain = cumulative_ratio[cumulative_ratio > cumulative_threshold]
    if not remain.empty:
        selected_features.append(remain.index[0])

    return selected_features, cumulative_threshold

def select_features_by_mutual_information(
    df: pd.DataFrame,
    target_column: str = DEFAULT_TARGET_COLUMN,
    candidate_columns: List[str] | None = None,
    cumulative_threshold: float = 0.85,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> Tuple[List[str], pd.Series, float]:
    candidate_features = get_numeric_candidate_features(df, target_column, candidate_columns)

    X_scaled, y, usable_features = prepare_feature_selection_matrix(
        df,
        target_column,
        candidate_features,
    )

    scores = mutual_info_regression(
        X_scaled,
        y,
        random_state=random_state,
    )

    score_series = pd.Series(scores, index=usable_features).sort_values(ascending=False)

    selected_features, threshold = select_features_by_cumulative_score(
        score_series,
        cumulative_threshold=cumulative_threshold,
    )

    return selected_features, score_series, threshold
def select_features_by_random_forest(
    df: pd.DataFrame,
    target_column: str = DEFAULT_TARGET_COLUMN,
    candidate_columns: List[str] | None = None,
    cumulative_threshold: float = 0.85,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> Tuple[List[str], pd.Series, float]:
    candidate_features = get_numeric_candidate_features(df, target_column, candidate_columns)

    X_scaled, y, usable_features = prepare_feature_selection_matrix(
        df,
        target_column,
        candidate_features,
    )

    model = RandomForestRegressor(
        n_estimators=100,
        random_state=random_state,
        n_jobs=-1,
    )
    model.fit(X_scaled, y)

    score_series = pd.Series(
        model.feature_importances_,
        index=usable_features,
    ).sort_values(ascending=False)

    selected_features, threshold = select_features_by_cumulative_score(
        score_series,
        cumulative_threshold=cumulative_threshold,
    )
    return selected_features, score_series, threshold


def compute_feature_set_quality(
    df: pd.DataFrame,
    selected_features: List[str],
    score_series: pd.Series,
    target_column: str = DEFAULT_TARGET_COLUMN,
    redundancy_threshold: float = DEFAULT_REDUNDANCY_THRESHOLD,
) -> Dict[str, float]:
    valid_features = [col for col in selected_features if col in df.columns]

    if not valid_features:
        return {}

    feature_df = df[valid_features].apply(pd.to_numeric, errors="coerce")

    relevance_scores = score_series.reindex(valid_features).dropna()

    mean_relevance_score = float(relevance_scores.mean())
    median_relevance_score = float(relevance_scores.median())

    target_series = pd.to_numeric(df[target_column], errors="coerce")
    corr_df = feature_df.copy()
    corr_df[target_column] = target_series

    target_corr = corr_df.corr(numeric_only=True)[target_column].drop(
        target_column,
        errors="ignore",
    ).abs()

    target_abs_corr_mean = float(target_corr.mean())
    target_abs_corr_median = float(target_corr.median())

    feature_corr = feature_df.corr(numeric_only=True).abs()

    if feature_corr.shape[0] >= 2:
        upper_mask = np.triu(np.ones(feature_corr.shape), k=1).astype(bool)
        upper_values = feature_corr.where(upper_mask).stack()

        mean_abs_feature_correlation = float(upper_values.mean())
        max_abs_feature_correlation = float(upper_values.max())
        redundant_pair_ratio = float((upper_values >= redundancy_threshold).mean())
    else:
        mean_abs_feature_correlation = 0.0
        max_abs_feature_correlation = 0.0
        redundant_pair_ratio = 0.0

    missing_ratio_mean = float(feature_df.isna().mean().mean())
    completeness_ratio = float(1.0 - missing_ratio_mean)

    zero_ratio_mean = float((feature_df == 0).mean().mean())

    dominant_ratios = []
    for col in valid_features:
        non_null = feature_df[col].dropna()
        if non_null.empty:
            dominant_ratios.append(1.0)
        else:
            dominant_ratios.append(float(non_null.value_counts(normalize=True).iloc[0]))

    dominant_ratio_mean = float(np.mean(dominant_ratios))

    all_numeric_candidates = get_numeric_candidate_features(df, target_column)
    dimension_reduction_ratio = float(
        1.0 - len(valid_features) / len(all_numeric_candidates)
    ) if all_numeric_candidates else 0.0

    return {
        "n_selected_features": int(len(valid_features)),
        "mean_relevance_score": mean_relevance_score,
        "median_relevance_score": median_relevance_score,
        "target_abs_corr_mean": target_abs_corr_mean,
        "target_abs_corr_median": target_abs_corr_median,
        "mean_abs_feature_correlation": mean_abs_feature_correlation,
        "max_abs_feature_correlation": max_abs_feature_correlation,
        "redundant_pair_ratio": redundant_pair_ratio,
        "completeness_ratio": completeness_ratio,
        "missing_ratio_mean": missing_ratio_mean,
        "zero_ratio_mean": zero_ratio_mean,
        "dominant_ratio_mean": dominant_ratio_mean,
        "dimension_reduction_ratio": dimension_reduction_ratio,
    }


def compare_feature_selection_quality(
    mi_quality: Dict[str, float],
    rf_quality: Dict[str, float],
) -> Tuple[str, pd.DataFrame]:
    rows = []
    mi_wins = 0
    rf_wins = 0

    metrics = list(HIGHER_IS_BETTER_METRICS | LOWER_IS_BETTER_METRICS)

    for metric in metrics:
        mi_value = mi_quality.get(metric)
        rf_value = rf_quality.get(metric)

        winner = "tie"

        if mi_value is not None and rf_value is not None:
            if metric in HIGHER_IS_BETTER_METRICS:
                if mi_value > rf_value:
                    winner = "mutual_information"
                    mi_wins += 1
                elif rf_value > mi_value:
                    winner = "random_forest"
                    rf_wins += 1
            else:
                if mi_value < rf_value:
                    winner = "mutual_information"
                    mi_wins += 1
                elif rf_value < mi_value:
                    winner = "random_forest"
                    rf_wins += 1

        rows.append({
            "metric": metric,
            "direction": "higher_is_better" if metric in HIGHER_IS_BETTER_METRICS else "lower_is_better",
            "mutual_information": mi_value,
            "random_forest": rf_value,
            "winner": winner,
        })

    selected_method = "mutual_information" if mi_wins >= rf_wins else "random_forest"

    comparison_df = pd.DataFrame(rows)
    comparison_df["mi_win_count"] = mi_wins
    comparison_df["rf_win_count"] = rf_wins
    comparison_df["selected_method"] = selected_method

    return selected_method, comparison_df


def run_feature_selection_pipeline(
    df: pd.DataFrame,
    base_output_dir: Path,
    candidate_columns: List[str],
    target_column: str = DEFAULT_TARGET_COLUMN,
    cumulative_threshold: float = 0.85,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> Dict[str, object]:
    output_dir = base_output_dir / FEATURE_SELECTION_OUTPUT_DIRNAME
    output_dir.mkdir(parents=True, exist_ok=True)

    TOP_K_CANDIDATES = [10, 11, 12, 13, 14, 15]

    # Compute scores once
    _, mi_scores, _ = select_features_by_mutual_information(
        df,
        target_column=target_column,
        candidate_columns=candidate_columns,
        cumulative_threshold=cumulative_threshold,
        random_state=random_state,
    )

    _, rf_scores, _ = select_features_by_random_forest(
        df,
        target_column=target_column,
        candidate_columns=candidate_columns,
        cumulative_threshold=cumulative_threshold,
        random_state=random_state,
    )
    best_method = None
    best_features = None
    best_quality = None
    best_score = -1
    best_k = None

    best_mi_features = []
    best_rf_features = []
    best_mi_quality = {}
    best_rf_quality = {}
    best_comparison_df = pd.DataFrame()

    for k in TOP_K_CANDIDATES:
        mi_features = mi_scores.head(k).index.tolist()
        rf_features = rf_scores.head(k).index.tolist()

        mi_quality = compute_feature_set_quality(
            df,
            selected_features=mi_features,
            score_series=mi_scores,
            target_column=target_column,
        )

        rf_quality = compute_feature_set_quality(
            df,
            selected_features=rf_features,
            score_series=rf_scores,
            target_column=target_column,
        )

        selected_method_tmp, comparison_df = compare_feature_selection_quality(
            mi_quality,
            rf_quality,
        )

        selected_features_tmp = (
            mi_features if selected_method_tmp == "mutual_information" else rf_features
        )

        quality_score = (
            mi_quality.get("mean_relevance_score", 0.0)
            if selected_method_tmp == "mutual_information"
            else rf_quality.get("mean_relevance_score", 0.0)
        )

        if quality_score > best_score:
            best_score = quality_score
            best_k = k
            best_method = selected_method_tmp
            best_features = selected_features_tmp
            best_quality = (
                mi_quality if selected_method_tmp == "mutual_information" else rf_quality
            )
            best_mi_features = mi_features
            best_rf_features = rf_features
            best_mi_quality = mi_quality
            best_rf_quality = rf_quality
            best_comparison_df = comparison_df
        selected_method = best_method
        selected_features = best_features

        mi_features = best_mi_features
        rf_features = best_rf_features
        mi_quality = best_mi_quality
        rf_quality = best_rf_quality
        comparison_df = best_comparison_df

    mi_score_df = mi_scores.rename("score").reset_index().rename(columns={"index": "feature"})
    mi_score_df.insert(0, "method", "mutual_information")

    rf_score_df = rf_scores.rename("score").reset_index().rename(columns={"index": "feature"})
    rf_score_df.insert(0, "method", "random_forest")

    score_df = pd.concat([mi_score_df, rf_score_df], ignore_index=True)

    quality_rows = [
        {
            "method": "mutual_information",
            "is_selected": selected_method == "mutual_information",
            "selected_features": ", ".join(mi_features),
            **mi_quality,
        },
        {
            "method": "random_forest",
            "is_selected": selected_method == "random_forest",
            "selected_features": ", ".join(rf_features),
            **rf_quality,
        },
    ]

    quality_df = pd.DataFrame(quality_rows)

    score_csv_path = output_dir / "feature_selection_scores.csv"
    quality_csv_path = output_dir / "feature_selection_data_quality.csv"
    comparison_csv_path = output_dir / "feature_selection_quality_comparison.csv"
    selected_csv_path = output_dir / "selected_features.csv"

    score_df.to_csv(score_csv_path, index=False)
    quality_df.to_csv(quality_csv_path, index=False)
    comparison_df.to_csv(comparison_csv_path, index=False)
    pd.DataFrame({"feature": selected_features}).to_csv(selected_csv_path, index=False)

    payload = {
        "target_column": target_column,
        "selection_strategy": "cumulative_score",
        "cumulative_threshold": 0.85,
        "methods": {
        "mutual_information": {
            "selected_features": mi_features,
            "n_selected_features": len(mi_features),
            "threshold": None,
            "max_score": float(mi_scores.max()),
            "quality_metrics": mi_quality,
        },
        "random_forest": {
            "selected_features": rf_features,
            "n_selected_features": len(rf_features),
            "threshold": None,
            "max_score": float(rf_scores.max()),
            "quality_metrics": rf_quality,
        },
    },
        "selected_method": selected_method,
        "best_k": best_k,
        "top_k_candidates": TOP_K_CANDIDATES,
        "selected_features": selected_features,
        "selection_reason": "Chọn feature bằng cách thử nhiều top-k (10→15), đánh giá chất lượng dữ liệu và chọn k + phương pháp tốt nhất; không dùng clustering để chọn feature set.",
        "score_csv_path": str(score_csv_path),
        "quality_csv_path": str(quality_csv_path),
        "comparison_csv_path": str(comparison_csv_path),
        "selected_features_csv_path": str(selected_csv_path),
    }

    save_json(payload, output_dir / "feature_selection_summary.json")

    return payload