from __future__ import annotations

from typing import Dict, List

import pandas as pd

from config import SUGGESTED_CLUSTER_COLUMNS, SPEED_CLUSTER_RULE_DEFINITION


def build_summary(
    raw_df: pd.DataFrame,
    processed_df: pd.DataFrame,
    removed_duplicates: int,
    dropped_sparse_columns: List[str],
    missing_ratio_before: pd.Series,
    imputation_report: Dict[str, str],
    dropped_low_value_columns: List[str],
    low_value_reasons: Dict[str, str],
    zero_ratio_after_impute: pd.Series,
    dominant_ratio_after_impute: pd.Series,
    clustering_results: Dict[str, object],
    feature_selection_results: Dict[str, object] | None = None,
) -> Dict[str, object]:
    """Tạo báo cáo tóm tắt phục vụ đồ án / notebook sau này."""
    suggested_cluster_features = [
        col for col in SUGGESTED_CLUSTER_COLUMNS if col in processed_df.columns
    ]

    if "speed_cluster_rule" in processed_df.columns:
        speed_cluster_distribution = {
            str(key): int(value)
            for key, value in processed_df["speed_cluster_rule"].value_counts(dropna=False).to_dict().items()
        }
    else:
        speed_cluster_distribution = {}

    return {
        "raw_shape": {"rows": int(raw_df.shape[0]), "cols": int(raw_df.shape[1])},
        "processed_shape": {
            "rows": int(processed_df.shape[0]),
            "cols": int(processed_df.shape[1]),
        },
        "removed_exact_duplicates": int(removed_duplicates),
        "dropped_sparse_columns": dropped_sparse_columns,
        "num_dropped_sparse_columns": int(len(dropped_sparse_columns)),
        "dropped_low_value_columns": dropped_low_value_columns,
        "num_dropped_low_value_columns": int(len(dropped_low_value_columns)),
        "low_value_reasons": low_value_reasons,
        "top_20_missing_ratio_before": {
            key: float(value)
            for key, value in missing_ratio_before.head(20).to_dict().items()
        },
        "top_20_zero_ratio_after_impute": {
            key: float(value)
            for key, value in zero_ratio_after_impute.head(20).to_dict().items()
        },
        "top_20_dominant_ratio_after_impute": {
            key: float(value)
            for key, value in dominant_ratio_after_impute.head(20).to_dict().items()
        },
        "imputed_columns": imputation_report,
        "suggested_cluster_features": suggested_cluster_features,
        "feature_selection": feature_selection_results or {},
        "speed_cluster_rule_distribution": speed_cluster_distribution,
        "speed_cluster_rule_definition": SPEED_CLUSTER_RULE_DEFINITION,
        "kmeans_clustering": clustering_results,
        "result_table": {
            "internal_evaluation": clustering_results.get("internal_evaluation", {}),
            "external_evaluation": clustering_results.get("external_evaluation", {}),
            "overall_evaluation": clustering_results.get("overall_evaluation", {}),
            "figure_paths": clustering_results.get("figure_paths", []),
            "research_figure_paths": clustering_results.get("research_figure_paths", []),
            "methods_comparison": clustering_results.get("methods_comparison", {}),
        },
    }