from __future__ import annotations

import argparse
import time
from pathlib import Path
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_samples, silhouette_score
from sklearn.preprocessing import StandardScaler

from clustering import run_kmeans_clustering_pipeline
from config import (
    DEFAULT_EXCLUDE_FROM_IMPUTE,
    DEFAULT_K_RANGE,
    DEFAULT_RANDOM_STATE,
    SUGGESTED_CLUSTER_COLUMNS,
)
from io_utils import load_raw_data, save_dataframe, save_json, standardize_types
from preprocessing import (
    drop_low_value_columns,
    drop_sparse_columns,
    impute_missing_values,
    remove_exact_duplicates,
)
from reporting import build_summary
from rule_based import assign_rule_based_speed_cluster
from feature_selection import run_feature_selection_pipeline


def _safe_numeric_columns(df: pd.DataFrame, columns: List[str] | None = None) -> List[str]:
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    return [col for col in columns if col in df.columns and pd.api.types.is_numeric_dtype(df[col])]


def _save_current_figure(output_path: Path) -> str:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(output_path, dpi=200, bbox_inches="tight")
    plt.close()
    return str(output_path)
def _clear_old_research_figures(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for old_figure in output_dir.glob("*.png"):
        old_figure.unlink()

def _attach_cluster_labels_if_needed(
    processed_df: pd.DataFrame,
    clustering_results: Dict[str, object],
) -> pd.DataFrame:
    if "cluster" in processed_df.columns:
        return processed_df

    processed_df = processed_df.copy()

    if "cluster_kmeans" in processed_df.columns:
        processed_df["cluster"] = processed_df["cluster_kmeans"]
        return processed_df

    clustered_csv_path = clustering_results.get("clustered_csv_path")
    if not clustered_csv_path:
        return processed_df

    clustered_path = Path(str(clustered_csv_path))
    if not clustered_path.exists():
        return processed_df

    clustered_df = pd.read_csv(clustered_path)

    if "cluster" in clustered_df.columns:
        source_cluster_col = "cluster"
    elif "cluster_kmeans" in clustered_df.columns:
        source_cluster_col = "cluster_kmeans"
    else:
        return processed_df

    if len(clustered_df) == len(processed_df):
        processed_df["cluster"] = clustered_df[source_cluster_col].to_numpy()
        return processed_df

    return processed_df

def _plot_missing_ratio(df_before: pd.DataFrame, df_after: pd.DataFrame, output_dir: Path) -> List[str]:
    figure_paths: List[str] = []

    before = df_before.isna().mean().sort_values(ascending=False).head(20)
    if not before.empty:
        plt.figure(figsize=(12, 6))
        before.sort_values().plot(kind="barh")
        plt.title("Top 20 missing value ratio before preprocessing")
        plt.xlabel("Missing ratio")
        plt.ylabel("Feature")
        figure_paths.append(_save_current_figure(output_dir / "01_missing_ratio_before.png"))

    common_cols = [col for col in df_before.columns if col in df_after.columns]
    if common_cols:
        comparison = pd.DataFrame({
            "before": df_before[common_cols].isna().mean(),
            "after": df_after[common_cols].isna().mean(),
        })
    comparison = comparison.sort_values("before", ascending=False).head(20)

    if not comparison.empty:
        comparison["before"].sort_values().plot(kind="barh", figsize=(12, 7))
        plt.title("Missing value ratio after preprocessing")
        plt.xlabel("Missing ratio")
        plt.ylabel("Feature")
        figure_paths.append(
            _save_current_figure(
                output_dir / "02_missing_ratio_after.png"
            )
        )
    return figure_paths


def _plot_numeric_distributions(df: pd.DataFrame, output_dir: Path) -> List[str]:
    figure_paths: List[str] = []
    preferred_cols = [
        "currentSpeed",
        "freeFlowSpeed",
        "congestionIndex",
        "trafficVolume",
        "occupancy",
        "crossTime",
        "speedLimitRatio",
        "relativeCongestionIndex",
    ]
    numeric_cols = _safe_numeric_columns(df, preferred_cols)

    for col in numeric_cols:
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if series.empty:
            continue
        plt.figure(figsize=(9, 5))
        plt.hist(series, bins=40)
        plt.title(f"Distribution of {col}")
        plt.xlabel(col)
        plt.ylabel("Frequency")
        figure_paths.append(_save_current_figure(output_dir / f"03a_distribution_{col}.png"))

    return figure_paths


def _plot_correlation_heatmap(df: pd.DataFrame, output_dir: Path, feature_columns: List[str] | None = None) -> List[str]:
    figure_paths: List[str] = []
    numeric_cols = _safe_numeric_columns(df, feature_columns)
    if len(numeric_cols) < 2:
        return figure_paths

    corr = df[numeric_cols].corr(numeric_only=True)
    plt.figure(figsize=(12, 10))
    im = plt.imshow(corr, aspect="auto")
    plt.colorbar(im, fraction=0.046, pad=0.04)
    plt.xticks(range(len(corr.columns)), corr.columns, rotation=90)
    plt.yticks(range(len(corr.index)), corr.index)
    plt.title("Feature correlation heatmap")
    figure_paths.append(_save_current_figure(output_dir / "04_correlation_heatmap.png"))
    return figure_paths


def _plot_before_after_boxplots(raw_df: pd.DataFrame, processed_df: pd.DataFrame, output_dir: Path) -> List[str]:
    figure_paths: List[str] = []
    preferred_cols = [
        "currentSpeed",
        "freeFlowSpeed",
        "congestionIndex",
        "trafficVolume",
        "occupancy",
        "crossTime",
    ]
    numeric_cols = [col for col in preferred_cols if col in raw_df.columns and col in processed_df.columns]

    for col in numeric_cols:
        before = pd.to_numeric(raw_df[col], errors="coerce").dropna()
        after = pd.to_numeric(processed_df[col], errors="coerce").dropna()
        if before.empty or after.empty:
            continue
        plt.figure(figsize=(8, 5))
        plt.boxplot([before, after], tick_labels=["Before", "After"], showfliers=True)
        plt.title(f"Before vs after preprocessing boxplot: {col}")
        plt.ylabel(col)
        figure_paths.append(_save_current_figure(output_dir / f"05a_boxplot_before_after_{col}.png"))

    return figure_paths


def _plot_feature_selection_figures(feature_selection_results: Dict[str, object], output_dir: Path) -> List[str]:
    figure_paths: List[str] = []

    for key, filename, title in [
        ("mi_scores", "06_feature_importance_mutual_information.png", "Mutual Information feature importance"),
        ("rf_scores", "07_feature_importance_random_forest.png", "Random Forest feature importance"),
        ("feature_scores", "08_feature_importance_selected.png", "Selected feature importance"),
    ]:
        raw_scores = feature_selection_results.get(key)
        if not raw_scores:
            continue
        scores = pd.Series(raw_scores, dtype="float64").sort_values(ascending=False).head(20)
        if scores.empty:
            continue
        plt.figure(figsize=(10, 6))
        scores.sort_values().plot(kind="barh")
        plt.title(title)
        plt.xlabel("Score")
        plt.ylabel("Feature")
        figure_paths.append(_save_current_figure(output_dir / filename))

    selected_features = feature_selection_results.get("selected_features", [])
    if selected_features:
        selected_series = pd.Series(1, index=list(selected_features))
        plt.figure(figsize=(10, max(4, len(selected_series) * 0.35)))
        selected_series.sort_values().plot(kind="barh")
        plt.title("Final selected features")
        plt.xlabel("Selected")
        plt.ylabel("Feature")
        figure_paths.append(_save_current_figure(output_dir / "08_final_selected_features.png"))

    return figure_paths


def _plot_cluster_size(processed_df: pd.DataFrame, output_dir: Path) -> List[str]:
    figure_paths: List[str] = []
    if "cluster" not in processed_df.columns:
        return figure_paths

    counts = processed_df["cluster"].value_counts().sort_index()
    if counts.empty:
        return figure_paths

    plt.figure(figsize=(9, 5))
    counts.plot(kind="bar")
    plt.title("Cluster size distribution")
    plt.xlabel("Cluster")
    plt.ylabel("Number of samples")
    figure_paths.append(_save_current_figure(output_dir / "09_cluster_size_distribution.png"))
    return figure_paths


def _plot_cluster_scatter(processed_df: pd.DataFrame, output_dir: Path) -> List[str]:
    figure_paths: List[str] = []
    required_cols = {"currentSpeed", "congestionIndex", "cluster"}
    if not required_cols.issubset(processed_df.columns):
        return figure_paths

    plot_df = processed_df[["currentSpeed", "congestionIndex", "cluster"]].dropna()
    if plot_df.empty:
        return figure_paths

    plt.figure(figsize=(11, 7))
    for cluster_id, group in plot_df.groupby("cluster"):
        plt.scatter(group["currentSpeed"], group["congestionIndex"], s=12, alpha=0.6, label=f"Cluster {cluster_id}")
    plt.title("2D cluster visualization: currentSpeed vs congestionIndex")
    plt.xlabel("currentSpeed")
    plt.ylabel("congestionIndex")
    plt.legend()
    figure_paths.append(_save_current_figure(output_dir / "10_cluster_scatter_speed_congestion.png"))
    return figure_paths


def _plot_cluster_pair_relationships(processed_df: pd.DataFrame, output_dir: Path) -> List[str]:
    figure_paths: List[str] = []

    required_cols = {
        "currentSpeed",
        "trafficVolume",
        "occupancy",
        "congestionIndex",
        "cluster",
    }

    if not required_cols.issubset(processed_df.columns):
        return figure_paths

    plot_pairs = [
        ("currentSpeed", "trafficVolume"),
        ("currentSpeed", "occupancy"),
        ("trafficVolume", "congestionIndex"),
        ("occupancy", "congestionIndex"),
    ]

    sample_df = processed_df[
        ["currentSpeed", "trafficVolume", "occupancy", "congestionIndex", "cluster"]
    ].dropna()

    if sample_df.empty:
        return figure_paths

    sample_size = min(len(sample_df), 12000)
    sample_df = (
        sample_df.sample(n=sample_size, random_state=42)
        if len(sample_df) > sample_size
        else sample_df
    )

    for x_col, y_col in plot_pairs:
        plt.figure(figsize=(9, 7))

        for cluster_id, group in sample_df.groupby("cluster"):
            plt.scatter(
                group[x_col],
                group[y_col],
                s=10,
                alpha=0.55,
                label=f"Cluster {cluster_id}",
            )

        plt.title(f"Cluster relationship: {x_col} vs {y_col}")
        plt.xlabel(x_col)
        plt.ylabel(y_col)
        plt.legend()

        filename = f"16a_cluster_relationship_{x_col}_{y_col}.png"
        figure_paths.append(_save_current_figure(output_dir / filename))

    return figure_paths


def _plot_pca_cluster_visualization(processed_df: pd.DataFrame, feature_columns: List[str], output_dir: Path) -> List[str]:
    figure_paths: List[str] = []
    if "cluster" not in processed_df.columns:
        return figure_paths

    numeric_cols = _safe_numeric_columns(processed_df, feature_columns)
    if len(numeric_cols) < 2:
        return figure_paths

    data = processed_df[numeric_cols + ["cluster"]].dropna()
    if len(data) < 3:
        return figure_paths

    sample_size = min(len(data), 15000)
    data = data.sample(n=sample_size, random_state=42) if len(data) > sample_size else data
    x_scaled = StandardScaler().fit_transform(data[numeric_cols])
    pca = PCA(n_components=2, random_state=42)
    components = pca.fit_transform(x_scaled)

    plt.figure(figsize=(10, 7))
    for cluster_id in sorted(data["cluster"].unique()):
        mask = data["cluster"].to_numpy() == cluster_id
        plt.scatter(components[mask, 0], components[mask, 1], s=12, alpha=0.6, label=f"Cluster {cluster_id}")
    explained = pca.explained_variance_ratio_ * 100
    plt.title(f"PCA 2D cluster visualization (PC1={explained[0]:.2f}%, PC2={explained[1]:.2f}%)")
    plt.xlabel("Principal Component 1")
    plt.ylabel("Principal Component 2")
    plt.legend()
    figure_paths.append(_save_current_figure(output_dir / "11_pca_2d_cluster_visualization.png"))

    plt.figure(figsize=(7, 5))
    plt.bar(["PC1", "PC2"], explained)
    plt.title("PCA explained variance ratio")
    plt.ylabel("Explained variance (%)")
    figure_paths.append(_save_current_figure(output_dir / "12_pca_explained_variance.png"))

    return figure_paths


def _plot_centroid_heatmap(processed_df: pd.DataFrame, feature_columns: List[str], output_dir: Path) -> List[str]:
    figure_paths: List[str] = []
    if "cluster" not in processed_df.columns:
        return figure_paths

    numeric_cols = _safe_numeric_columns(processed_df, feature_columns)
    if not numeric_cols:
        return figure_paths

    profile = processed_df.groupby("cluster")[numeric_cols].mean(numeric_only=True)
    if profile.empty:
        return figure_paths

    scaled_profile = pd.DataFrame(
        StandardScaler().fit_transform(profile),
        index=profile.index,
        columns=profile.columns,
    )

    plt.figure(figsize=(max(10, len(numeric_cols) * 0.6), 6))
    im = plt.imshow(scaled_profile, aspect="auto")
    plt.colorbar(im, fraction=0.046, pad=0.04)
    plt.xticks(range(len(scaled_profile.columns)), scaled_profile.columns, rotation=90)
    plt.yticks(range(len(scaled_profile.index)), [f"Cluster {idx}" for idx in scaled_profile.index])
    plt.title("Cluster centroid profile heatmap (standardized mean values)")
    figure_paths.append(_save_current_figure(output_dir / "13_cluster_centroid_profile_heatmap.png"))

    return figure_paths


def _plot_cluster_radar_profiles(
    processed_df: pd.DataFrame,
    feature_columns: List[str],
    output_dir: Path,
) -> List[str]:
    figure_paths: List[str] = []

    if "cluster" not in processed_df.columns:
        return figure_paths

    numeric_cols = _safe_numeric_columns(processed_df, feature_columns)
    if len(numeric_cols) < 3:
        return figure_paths

    selected_cols = numeric_cols[:8]

    profile = processed_df.groupby("cluster")[selected_cols].mean(numeric_only=True)
    if profile.empty:
        return figure_paths

    normalized_profile = pd.DataFrame(
        StandardScaler().fit_transform(profile),
        index=profile.index,
        columns=profile.columns,
    )

    categories = list(normalized_profile.columns)
    num_vars = len(categories)

    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    angles += angles[:1]

    plt.figure(figsize=(9, 9))
    ax = plt.subplot(111, polar=True)

    for cluster_id in normalized_profile.index:
        values = normalized_profile.loc[cluster_id].tolist()
        values += values[:1]

        ax.plot(angles, values, linewidth=2, label=f"Cluster {cluster_id}")
        ax.fill(angles, values, alpha=0.15)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories)
    plt.title("Radar profile of cluster centroids")
    plt.legend(loc="upper right", bbox_to_anchor=(1.25, 1.05))

    figure_paths.append(
        _save_current_figure(output_dir / "17_cluster_radar_profiles.png")
    )

    return figure_paths


def _plot_silhouette_analysis(processed_df: pd.DataFrame, feature_columns: List[str], output_dir: Path) -> List[str]:
    figure_paths: List[str] = []
    if "cluster" not in processed_df.columns:
        return figure_paths

    numeric_cols = _safe_numeric_columns(processed_df, feature_columns)
    if len(numeric_cols) < 2:
        return figure_paths

    data = processed_df[numeric_cols + ["cluster"]].dropna()
    if data["cluster"].nunique() < 2 or len(data) < 10:
        return figure_paths

    sample_size = min(len(data), 5000)
    data = data.sample(n=sample_size, random_state=42) if len(data) > sample_size else data
    x_scaled = StandardScaler().fit_transform(data[numeric_cols])
    labels = data["cluster"].to_numpy()
    sample_values = silhouette_samples(x_scaled, labels)

    plt.figure(figsize=(10, 7))
    y_lower = 10
    for cluster_id in sorted(np.unique(labels)):
        values = sample_values[labels == cluster_id]
        values.sort()
        size = len(values)
        y_upper = y_lower + size
        plt.fill_betweenx(np.arange(y_lower, y_upper), 0, values, alpha=0.7)
        plt.text(-0.05, y_lower + 0.5 * size, str(cluster_id))
        y_lower = y_upper + 10
    plt.axvline(sample_values.mean(), linestyle="--")
    plt.title("Silhouette analysis by cluster")
    plt.xlabel("Silhouette coefficient")
    plt.ylabel("Cluster")
    figure_paths.append(_save_current_figure(output_dir / "14_silhouette_analysis.png"))

    return figure_paths


def _plot_cluster_distance_density(
    processed_df: pd.DataFrame,
    feature_columns: List[str],
    output_dir: Path,
) -> List[str]:
    figure_paths: List[str] = []

    if "cluster" not in processed_df.columns:
        return figure_paths

    numeric_cols = _safe_numeric_columns(processed_df, feature_columns)
    if len(numeric_cols) < 2:
        return figure_paths

    data = processed_df[numeric_cols + ["cluster"]].dropna()
    if data.empty:
        return figure_paths

    sample_size = min(len(data), 10000)
    data = data.sample(n=sample_size, random_state=42) if len(data) > sample_size else data

    x_scaled = StandardScaler().fit_transform(data[numeric_cols])
    labels = data["cluster"].to_numpy()

    unique_clusters = np.unique(labels)
    distances = []

    for cluster_id in unique_clusters:
        cluster_points = x_scaled[labels == cluster_id]

        if len(cluster_points) == 0:
            continue

        centroid = cluster_points.mean(axis=0)
        dist = np.linalg.norm(cluster_points - centroid, axis=1)

        distances.extend([
            {"cluster": cluster_id, "distance": d}
            for d in dist
        ])

    distance_df = pd.DataFrame(distances)

    if distance_df.empty:
        return figure_paths

    plt.figure(figsize=(10, 6))

    for cluster_id, group in distance_df.groupby("cluster"):
        plt.hist(
            group["distance"],
            bins=30,
            alpha=0.45,
            label=f"Cluster {cluster_id}",
        )

    plt.title("Distance-to-centroid distribution by cluster")
    plt.xlabel("Distance to centroid")
    plt.ylabel("Frequency")
    plt.legend()

    figure_paths.append(
        _save_current_figure(output_dir / "18_cluster_distance_distribution.png")
    )

    return figure_paths


def _plot_model_comparison(clustering_results: Dict[str, object], output_dir: Path) -> List[str]:
    figure_paths: List[str] = []
    raw_comparison = clustering_results.get("methods_comparison") or clustering_results.get("comparison")
    if not raw_comparison:
        return figure_paths

    comparison_df = pd.DataFrame(raw_comparison)
    if comparison_df.empty or "method" not in comparison_df.columns:
        return figure_paths

    metrics = [
        col for col in [
            "silhouette",
            "davies_bouldin",
            "calinski_harabasz",
            "ari",
            "nmi",
            "f_measure",
            "entropy",
            "mae",
            "rmse",
        ]
        if col in comparison_df.columns
    ]
    if not metrics:
        return figure_paths

    normalized = comparison_df[["method"] + metrics].copy()
    for col in metrics:
        values = pd.to_numeric(normalized[col], errors="coerce")
        if values.max() == values.min():
            normalized[col] = 0.0
        elif col in {"davies_bouldin", "entropy", "mae", "rmse"}:
            normalized[col] = 1 - ((values - values.min()) / (values.max() - values.min()))
        else:
            normalized[col] = (values - values.min()) / (values.max() - values.min())

    normalized = normalized.set_index("method")
    normalized.plot(kind="bar", figsize=(12, 6))
    plt.title("Normalized clustering model comparison (higher is better)")
    plt.xlabel("Method")
    plt.ylabel("Normalized score")
    plt.legend(loc="best")
    figure_paths.append(_save_current_figure(output_dir / "15_model_comparison_normalized_metrics.png"))

    return figure_paths


def _plot_kmeans_quality_summary(
    processed_df: pd.DataFrame,
    feature_columns: List[str],
    output_dir: Path,
) -> List[str]:
    figure_paths: List[str] = []

    if "cluster" not in processed_df.columns:
        return figure_paths

    numeric_cols = _safe_numeric_columns(processed_df, feature_columns)
    if len(numeric_cols) < 2:
        return figure_paths

    data = processed_df[numeric_cols + ["cluster"]].dropna()
    if data.empty:
        return figure_paths

    sample_size = min(len(data), 8000)
    data = data.sample(n=sample_size, random_state=42) if len(data) > sample_size else data

    x_scaled = StandardScaler().fit_transform(data[numeric_cols])
    labels = data["cluster"].to_numpy()

    silhouette_avg = silhouette_score(x_scaled, labels)

    cluster_counts = pd.Series(labels).value_counts().sort_index()

    plt.figure(figsize=(9, 5))
    plt.bar(cluster_counts.index.astype(str), cluster_counts.values)
    plt.title(
        f"KMeans cluster balance (silhouette = {silhouette_avg:.4f})"
    )
    plt.xlabel("Cluster")
    plt.ylabel("Sample count")

    figure_paths.append(
        _save_current_figure(output_dir / "19_kmeans_cluster_balance_summary.png")
    )

    return figure_paths


def generate_research_figures(
    raw_df: pd.DataFrame,
    processed_df: pd.DataFrame,
    feature_selection_results: Dict[str, object],
    clustering_results: Dict[str, object],
    selected_feature_columns: List[str],
    output_dir: Path,
) -> List[str]:
    _clear_old_research_figures(output_dir)

    figure_paths: List[str] = []

    figure_paths.extend(_plot_missing_ratio(raw_df, processed_df, output_dir))
    figure_paths.extend(_plot_numeric_distributions(raw_df, output_dir))
    figure_paths.extend(_plot_correlation_heatmap(processed_df, output_dir, selected_feature_columns))
    figure_paths.extend(_plot_before_after_boxplots(raw_df, processed_df, output_dir))
    figure_paths.extend(_plot_feature_selection_figures(feature_selection_results, output_dir))
    figure_paths.extend(_plot_cluster_size(processed_df, output_dir))
    figure_paths.extend(_plot_cluster_scatter(processed_df, output_dir))
    figure_paths.extend(_plot_cluster_pair_relationships(processed_df, output_dir))
    figure_paths.extend(_plot_pca_cluster_visualization(processed_df, selected_feature_columns, output_dir))
    figure_paths.extend(_plot_centroid_heatmap(processed_df, selected_feature_columns, output_dir))
    figure_paths.extend(_plot_cluster_radar_profiles(processed_df, selected_feature_columns, output_dir))
    figure_paths.extend(_plot_silhouette_analysis(processed_df, selected_feature_columns, output_dir))
    figure_paths.extend(_plot_cluster_distance_density(processed_df, selected_feature_columns, output_dir))
    figure_paths.extend(_plot_model_comparison(clustering_results, output_dir))
    figure_paths.extend(_plot_kmeans_quality_summary(processed_df, selected_feature_columns, output_dir))

    return figure_paths


def preprocess_traffic_data(
    input_csv: Path,
    output_csv: Path,
    summary_json: Path,
    missing_threshold: float = 0.9,
    zero_ratio_threshold: float = 0.9,
    dominant_ratio_threshold: float = 0.9,
) -> Tuple[pd.DataFrame, Dict[str, object]]:
    """Pipeline tiền xử lí chính cho bài toán phân cụm giao thông."""
    start_time = time.perf_counter()

    raw_df = load_raw_data(input_csv)
    typed_df = standardize_types(raw_df)
    dedup_df, removed_duplicates = remove_exact_duplicates(typed_df)

    reduced_df, dropped_sparse_columns, missing_ratio_before = drop_sparse_columns(
        dedup_df,
        missing_threshold=missing_threshold,
    )

    imputed_df, imputation_report = impute_missing_values(
        reduced_df,
        exclude_columns=DEFAULT_EXCLUDE_FROM_IMPUTE,
    )

    (
        filtered_df,
        dropped_low_value_columns,
        low_value_reasons,
        zero_ratio_after_impute,
        dominant_ratio_after_impute,
    ) = drop_low_value_columns(
        imputed_df,
        zero_ratio_threshold=zero_ratio_threshold,
        dominant_ratio_threshold=dominant_ratio_threshold,
    )

    processed_df = assign_rule_based_speed_cluster(
        filtered_df,
        speed_column="currentSpeed",
        output_column="speed_cluster_rule",
    )

    candidate_feature_columns = [
        col for col in SUGGESTED_CLUSTER_COLUMNS
        if col in processed_df.columns and col != "currentSpeed"
    ]

    feature_selection_results = run_feature_selection_pipeline(
        processed_df,
        base_output_dir=output_csv.parent,
        candidate_columns=candidate_feature_columns,
        target_column="currentSpeed",
        random_state=DEFAULT_RANDOM_STATE,
    )

    selected_feature_columns = feature_selection_results.get("selected_features", [])

    clustering_results = run_kmeans_clustering_pipeline(
        processed_df,
        base_output_dir=output_csv.parent,
        feature_columns=selected_feature_columns,
        k_min=6,
        k_max=6,
        random_state=DEFAULT_RANDOM_STATE,
    )
    processed_df = _attach_cluster_labels_if_needed(processed_df, clustering_results)

    research_figure_paths = generate_research_figures(
        raw_df=typed_df,
        processed_df=processed_df,
        feature_selection_results=feature_selection_results,
        clustering_results=clustering_results,
        selected_feature_columns=selected_feature_columns,
        output_dir=output_csv.parent / "research_figures",
    )
    clustering_results["research_figure_paths"] = research_figure_paths

    summary = build_summary(
        raw_df=typed_df,
        processed_df=processed_df,
        removed_duplicates=removed_duplicates,
        dropped_sparse_columns=dropped_sparse_columns,
        missing_ratio_before=missing_ratio_before,
        imputation_report=imputation_report,
        dropped_low_value_columns=dropped_low_value_columns,
        low_value_reasons=low_value_reasons,
        zero_ratio_after_impute=zero_ratio_after_impute,
        dominant_ratio_after_impute=dominant_ratio_after_impute,
        clustering_results=clustering_results,
        feature_selection_results=feature_selection_results,
    )
    save_dataframe(processed_df, output_csv)
    save_json(summary, summary_json)

    selected_k = clustering_results.get("selected_k")
    elapsed_time = time.perf_counter() - start_time

    print(f"[DONE] Clustering completed")
    print(f"       k = {selected_k}")
    print(f"       research figures = {len(research_figure_paths)}")
    print(f"       research figures folder = {output_csv.parent / 'research_figures'}")
    print(f"       time = {elapsed_time:.2f}s")

    if research_figure_paths:
        print("[FIGURES] Generated research figures:")
        for figure_path in research_figure_paths:
            print(f"       - {figure_path}")
    else:
        print("[FIGURES] No research figures were generated. Please check selected features and cluster column.")

    return processed_df, summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Tiền xử lí dữ liệu giao thông: xử lí khuyết dữ liệu và loại cột quá thưa.",
    )
    parser.add_argument(
        "--input",
        type=str,
        default="data.csv",
        help="Đường dẫn file CSV đầu vào.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="processed/traffic_preprocessed.csv",
        help="Đường dẫn file CSV đầu ra sau tiền xử lí.",
    )
    parser.add_argument(
        "--summary",
        type=str,
        default="processed/preprocessing_summary.json",
        help="Đường dẫn file JSON báo cáo tiền xử lí.",
    )
    parser.add_argument(
        "--missing-threshold",
        type=float,
        default=0.9,
        help="Ngưỡng loại cột quá thưa. Ví dụ 0.9 nghĩa là thiếu >= 90%% sẽ bị loại.",
    )
    parser.add_argument(
        "--zero-ratio-threshold",
        type=float,
        default=0.9,
        help="Ngưỡng xem cột số là quá nhiều số 0. Ví dụ 0.9 nghĩa là >= 90%% giá trị bằng 0.",
    )
    parser.add_argument(
        "--dominant-ratio-threshold",
        type=float,
        default=0.9,
        help="Ngưỡng xem một cột bị thống trị bởi một giá trị duy nhất. Ví dụ 0.9 nghĩa là 1 giá trị chiếm >= 90%%.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_csv = Path(args.input)
    output_csv = Path(args.output)
    summary_json = Path(args.summary)

    preprocess_traffic_data(
        input_csv=input_csv,
        output_csv=output_csv,
        summary_json=summary_json,
        missing_threshold=args.missing_threshold,
        zero_ratio_threshold=args.zero_ratio_threshold,
        dominant_ratio_threshold=args.dominant_ratio_threshold,
    )


if __name__ == "__main__":
    main() 