

from __future__ import annotations

import argparse
import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
PARENT_DIR = CURRENT_DIR.parent
CANDIDATE_IMPORT_DIRS = [
    CURRENT_DIR,
]

for import_dir in CANDIDATE_IMPORT_DIRS:
    if import_dir.exists() and str(import_dir) not in sys.path:
        sys.path.append(str(import_dir))
import json
import math
import time
from datetime import datetime
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering, DBSCAN, KMeans, MiniBatchKMeans
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    adjusted_rand_score,
    calinski_harabasz_score,
    davies_bouldin_score,
    fowlkes_mallows_score,
    normalized_mutual_info_score,
    silhouette_score,
)
from sklearn.mixture import GaussianMixture
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

DEFAULT_RANDOM_STATE = 42
MISSING_TOKENS = ["", " ", "NA", "N/A", "na", "n/a", "null", "None", "none", "-", "--"]
DEFAULT_EXCLUDE_FROM_IMPUTE = ["id", "ID"]
NON_CLUSTER_COLUMNS = [
    "id",
    "ID",
    "timestamp",
    "time",
    "date",
    "datetime",
    "speed_cluster_rule",
    "cluster_true",
    "true_label",
    "label",
]
NUMERIC_HINT_COLUMNS = []
SPEED_CLUSTER_BINS = [-np.inf, 10, 20, 30, 45, 60, np.inf]
SPEED_CLUSTER_LABELS = ["A", "B", "C", "D", "E", "F"]
SUGGESTED_CLUSTER_COLUMNS = [
    "speedLimitRatio",
    "crossTime",
    "trafficVolume",
    "congestionIndex",
    "occupancy",
    "relativeCongestionIndex",
    "freeFlowSpeed",
    "lengthKm",
    "route_distance_m",
    "curvatureIndex",
    "speed",
    "currentSpeed",
    "averageSpeed",
]


def load_raw_data(input_path: Path) -> pd.DataFrame:
    return pd.read_csv(input_path, na_values=MISSING_TOKENS, low_memory=False)


def save_dataframe(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def save_json(data: Dict[str, object], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# Helper to append stage runtime info to time.csv
def append_stage_runtime(output_dir: Path, stage_name: str, runtime_sec: float) -> None:
    """Append stage runtime information into time.csv."""
    output_dir.mkdir(parents=True, exist_ok=True)
    time_csv_path = output_dir / "time.csv"

    row = pd.DataFrame([
        {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "stage": stage_name,
            "runtime_sec": float(runtime_sec),
            "runtime_min": float(runtime_sec / 60.0),
        }
    ])

    if time_csv_path.exists():
        row.to_csv(time_csv_path, mode="a", header=False, index=False)
    else:
        row.to_csv(time_csv_path, index=False)


def standardize_types(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    for col in result.columns:
        if result[col].dtype == "object":

            try:

                result[col] = pd.to_numeric(result[col])

            except Exception:

                pass
    return result


def remove_exact_duplicates(df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
    before = len(df)
    result = df.drop_duplicates().reset_index(drop=True)
    return result, int(before - len(result))


def drop_sparse_columns(df: pd.DataFrame, max_missing_ratio: float = 0.60) -> Tuple[pd.DataFrame, List[str], pd.Series]:
    missing_ratio = df.isna().mean().sort_values(ascending=False)
    dropped_columns = missing_ratio[missing_ratio > max_missing_ratio].index.tolist()
    return df.drop(columns=dropped_columns, errors="ignore"), dropped_columns, missing_ratio


def impute_missing_values(df: pd.DataFrame, exclude_columns: set | None = None) -> Tuple[pd.DataFrame, Dict[str, object]]:
    exclude_columns = exclude_columns or set()
    result = df.copy()
    report: Dict[str, object] = {}
    for col in result.columns:
        if col in exclude_columns:
            continue
        missing_count = int(result[col].isna().sum())
        if missing_count == 0:
            continue
        if pd.api.types.is_numeric_dtype(result[col]):
            value = float(result[col].median())
            result[col] = result[col].fillna(value)
            report[col] = {"method": "median", "value": value, "missing_count": missing_count}
        else:
            mode_series = result[col].mode(dropna=True)
            value = mode_series.iloc[0] if not mode_series.empty else "unknown"
            result[col] = result[col].fillna(value)
            report[col] = {"method": "mode", "value": str(value), "missing_count": missing_count}
    return result, report


def drop_low_value_columns(
    df: pd.DataFrame,
    zero_ratio_threshold: float = 0.98,
    dominant_ratio_threshold: float = 0.98,
    min_unique_values: int = 2,
) -> Tuple[pd.DataFrame, List[str], Dict[str, str], pd.Series, pd.Series]:
    zero_ratio = pd.Series(index=df.columns, dtype=float)
    dominant_ratio = pd.Series(index=df.columns, dtype=float)
    dropped_columns: List[str] = []
    reasons: Dict[str, str] = {}

    for col in df.columns:
        series = df[col]
        nunique = int(series.nunique(dropna=True))
        dominant = float(series.value_counts(normalize=True, dropna=False).iloc[0]) if len(series) else 0.0
        dominant_ratio[col] = dominant
        zero_ratio[col] = float((series == 0).mean()) if pd.api.types.is_numeric_dtype(series) else 0.0

        if nunique < min_unique_values:
            dropped_columns.append(col)
            reasons[col] = "near_constant"
        elif pd.api.types.is_numeric_dtype(series) and zero_ratio[col] > zero_ratio_threshold:
            dropped_columns.append(col)
            reasons[col] = "too_many_zero_values"
        elif dominant > dominant_ratio_threshold:
            dropped_columns.append(col)
            reasons[col] = "dominant_value_ratio_too_high"

    return (
        df.drop(columns=dropped_columns, errors="ignore"),
        dropped_columns,
        reasons,
        zero_ratio.sort_values(ascending=False),
        dominant_ratio.sort_values(ascending=False),
    )


def assign_rule_based_speed_cluster(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    speed_candidates = ["speed", "currentSpeed", "averageSpeed", "freeFlowSpeed"]
    speed_col = next((col for col in speed_candidates if col in result.columns and pd.api.types.is_numeric_dtype(result[col])), None)
    if speed_col is not None:
        result["speed_cluster_rule"] = pd.cut(
            result[speed_col],
            bins=SPEED_CLUSTER_BINS,
            labels=SPEED_CLUSTER_LABELS,
            include_lowest=True,
        ).astype(str)
    return result


OUTPUT_DIRNAME = "main2_figure"
DEFAULT_K_MIN = 2
DEFAULT_K_MAX = 12
DEFAULT_DBSCAN_MIN_SAMPLES = 6
DEFAULT_PARAM_SAMPLE_SIZE = 20000
DEFAULT_DBSCAN_PARAM_SAMPLE_SIZE = None
DEFAULT_SILHOUETTE_SAMPLE_SIZE = 5000
DEFAULT_FIGURE_DPI = 200
DEFAULT_PROCESSED_FILENAME = "data_processed.csv"
DEFAULT_PARAM_SUMMARY_FILENAME = "selected_parameters.json"
DEFAULT_CLUSTERED_FILENAME = "model_results.csv"


def _safe_silhouette_score(
    X: np.ndarray,
    labels: np.ndarray,
    sample_size: int = DEFAULT_SILHOUETTE_SAMPLE_SIZE,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> float:
    unique_labels = np.unique(labels)
    if len(unique_labels) < 2:
        return float("nan")

    # silhouette_score cannot be computed when every sample is its own cluster.
    if len(unique_labels) >= len(labels):
        return float("nan")

    if len(labels) <= sample_size:
        return float(silhouette_score(X, labels))

    rng = np.random.RandomState(random_state)
    sample_indices = rng.choice(len(labels), size=sample_size, replace=False)
    sampled_X = X[sample_indices]
    sampled_labels = labels[sample_indices]

    if len(np.unique(sampled_labels)) < 2 or len(np.unique(sampled_labels)) >= len(sampled_labels):
        return float("nan")

    return float(silhouette_score(sampled_X, sampled_labels))


def _safe_internal_metrics(X: np.ndarray, labels: np.ndarray) -> Dict[str, float]:
    unique_labels = np.unique(labels)
    if len(unique_labels) < 2 or len(unique_labels) >= len(labels):
        return {
            "silhouette": float("nan"),
            "davies_bouldin": float("nan"),
            "calinski_harabasz": float("nan"),
        }

    return {
        "silhouette": _safe_silhouette_score(X, labels),
        "davies_bouldin": float(davies_bouldin_score(X, labels)),
        "calinski_harabasz": float(calinski_harabasz_score(X, labels)),
    }


# Compute DBSCAN internal metrics on non-noise points only.
def _safe_dbscan_internal_metrics(X: np.ndarray, labels: np.ndarray) -> Dict[str, float]:
    """Compute DBSCAN internal metrics on non-noise points only.

    DBSCAN label -1 is noise, not a real cluster. If we include -1 as a cluster,
    cases like 1 real cluster + a few noise points can produce misleadingly good
    silhouette/DB/CH values. Therefore DBSCAN is only valid for internal metrics
    when it has at least 2 non-noise clusters.
    """
    non_noise_mask = labels != -1
    if int(non_noise_mask.sum()) == 0:
        return {
            "silhouette": float("nan"),
            "davies_bouldin": float("nan"),
            "calinski_harabasz": float("nan"),
        }

    X_non_noise = X[non_noise_mask]
    labels_non_noise = labels[non_noise_mask]
    unique_clusters = np.unique(labels_non_noise)

    if len(unique_clusters) < 2 or len(unique_clusters) >= len(labels_non_noise):
        return {
            "silhouette": float("nan"),
            "davies_bouldin": float("nan"),
            "calinski_harabasz": float("nan"),
        }

    return {
        "silhouette": _safe_silhouette_score(X_non_noise, labels_non_noise),
        "davies_bouldin": float(davies_bouldin_score(X_non_noise, labels_non_noise)),
        "calinski_harabasz": float(calinski_harabasz_score(X_non_noise, labels_non_noise)),
    }


def _cluster_entropy(y_true: pd.Series, y_pred: pd.Series) -> float:
    temp = pd.DataFrame({"true": y_true.astype(str), "pred": y_pred.astype(str)})
    total = len(temp)
    if total == 0:
        return float("nan")

    weighted_entropy = 0.0
    for _, group in temp.groupby("pred"):
        probs = group["true"].value_counts(normalize=True)
        entropy = float(-(probs * np.log2(probs + 1e-12)).sum())
        weighted_entropy += (len(group) / total) * entropy
    return weighted_entropy


def _map_clusters_to_majority_labels(y_true: pd.Series, y_pred: pd.Series) -> pd.Series:
    temp = pd.DataFrame({"true": y_true.astype(str), "pred": y_pred.astype(str)})
    mapping: Dict[str, str] = {}
    for cluster_label, group in temp.groupby("pred"):
        mapping[str(cluster_label)] = str(group["true"].value_counts().idxmax())
    return y_pred.astype(str).map(mapping)


def _external_metrics(df: pd.DataFrame, labels: np.ndarray) -> Dict[str, float | str]:
    candidate_columns = ["speed_cluster_rule", "cluster_true", "true_label", "label"]
    target_col = next((col for col in candidate_columns if col in df.columns), None)
    if target_col is None:
        return {}

    valid_mask = df[target_col].notna()
    if int(valid_mask.sum()) == 0:
        return {}

    y_true = df.loc[valid_mask, target_col].astype(str)
    y_pred = pd.Series(labels, index=df.index).loc[valid_mask].astype(str)
    y_pred_mapped = _map_clusters_to_majority_labels(y_true, y_pred)

    unique_labels = sorted(set(y_true.unique()) | set(y_pred_mapped.dropna().unique()))
    per_class_f1 = []
    for label in unique_labels:
        tp = int(((y_true == label) & (y_pred_mapped == label)).sum())
        fp = int(((y_true != label) & (y_pred_mapped == label)).sum())
        fn = int(((y_true == label) & (y_pred_mapped != label)).sum())
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        per_class_f1.append(float(f1))

    return {
        "reference_label_column": target_col,
        "ari": float(adjusted_rand_score(y_true, y_pred)),
        "nmi": float(normalized_mutual_info_score(y_true, y_pred)),
        "fmi": float(fowlkes_mallows_score(y_true, y_pred)),
        "f_measure": float(np.mean(per_class_f1)) if per_class_f1 else float("nan"),
        "entropy": float(_cluster_entropy(y_true, y_pred)),
    }


def _cluster_structure_metrics(labels: np.ndarray) -> Dict[str, float | int]:
    labels_series = pd.Series(labels)
    cluster_sizes = labels_series[labels_series != -1].value_counts()
    noise_count = int((labels_series == -1).sum())
    n_samples = int(len(labels_series))

    if cluster_sizes.empty:
        return {
            "n_clusters": 0,
            "cluster_size_min": 0,
            "cluster_size_max": 0,
            "cluster_size_mean": 0.0,
            "cluster_size_std": 0.0,
            "cluster_balance_ratio": float("nan"),
            "noise_count": noise_count,
            "noise_ratio": noise_count / n_samples if n_samples else 0.0,
        }

    cluster_size_min = int(cluster_sizes.min())
    cluster_size_max = int(cluster_sizes.max())
    cluster_balance_ratio = float(cluster_size_max / cluster_size_min) if cluster_size_min > 0 else float("nan")

    return {
        "n_clusters": int(len(cluster_sizes)),
        "cluster_size_min": cluster_size_min,
        "cluster_size_max": cluster_size_max,
        "cluster_size_mean": float(cluster_sizes.mean()),
        "cluster_size_std": float(cluster_sizes.std(ddof=0)) if len(cluster_sizes) > 1 else 0.0,
        "cluster_balance_ratio": cluster_balance_ratio,
        "noise_count": noise_count,
        "noise_ratio": noise_count / n_samples if n_samples else 0.0,
    }


def _reconstruction_metrics(X: np.ndarray, reconstructed: np.ndarray) -> Dict[str, float]:
    abs_err = np.abs(X - reconstructed)
    sq_err = np.square(X - reconstructed)
    mae = float(np.mean(abs_err))
    mse = float(np.mean(sq_err))
    return {
        "mae": mae,
        "mse": mse,
        "rmse": float(math.sqrt(mse)),
    }


def _save_current_figure(path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(path, dpi=DEFAULT_FIGURE_DPI, bbox_inches="tight")
    plt.close()
    return str(path)

# Helper: sample matrix for parameter/model selection.
def _sample_matrix(X: np.ndarray, max_samples: int | None, random_state: int = DEFAULT_RANDOM_STATE) -> np.ndarray:
    if max_samples is None:
        return X
    if len(X) <= max_samples:
        return X
    rng = np.random.RandomState(random_state)
    sample_indices = rng.choice(len(X), size=max_samples, replace=False)
    return X[sample_indices]


def _knee_locator(x_values: List[int] | np.ndarray, y_values: List[float] | np.ndarray, curve: str, direction: str) -> int | None:
    """
    Uses kneed.KneeLocator when installed. Falls back to max-distance-to-line knee detection.
    """
    x = np.asarray(x_values, dtype=float)
    y = np.asarray(y_values, dtype=float)
    valid_mask = np.isfinite(x) & np.isfinite(y)
    x = x[valid_mask]
    y = y[valid_mask]

    if len(x) < 3:
        return int(x[0]) if len(x) else None

    try:
        from kneed import KneeLocator

        locator = KneeLocator(x, y, curve=curve, direction=direction)
        knee = locator.knee
        if knee is not None:
            return int(round(float(knee)))
    except Exception:
        pass

    # Fallback: normalize and choose point with maximum distance from the first-last line.
    x_norm = (x - x.min()) / (x.max() - x.min() + 1e-12)
    y_norm = (y - y.min()) / (y.max() - y.min() + 1e-12)
    points = np.column_stack([x_norm, y_norm])
    start = points[0]
    end = points[-1]
    line = end - start
    line_norm = np.linalg.norm(line)
    if line_norm == 0:
        return int(round(float(x[0])))

    distances = np.abs(np.cross(line, start - points)) / line_norm
    return int(round(float(x[int(np.argmax(distances))])))


def _prepare_preprocessed_data(input_path: Path, output_dir: Path) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, object]]:
    raw_df = load_raw_data(input_path)
    typed_df = standardize_types(raw_df)
    dedup_df, removed_duplicates = remove_exact_duplicates(typed_df)
    sparse_df, dropped_sparse_columns, missing_ratio_before = drop_sparse_columns(dedup_df)
    imputed_df, imputation_report = impute_missing_values(
        sparse_df,
        exclude_columns=set(DEFAULT_EXCLUDE_FROM_IMPUTE),
    )
    processed_df, dropped_low_value_columns, low_value_reasons, zero_ratio, dominant_ratio = drop_low_value_columns(imputed_df)
    processed_df = assign_rule_based_speed_cluster(processed_df)


    preprocessing_summary = {
        "raw_shape": {"rows": int(raw_df.shape[0]), "cols": int(raw_df.shape[1])},
        "processed_shape": {"rows": int(processed_df.shape[0]), "cols": int(processed_df.shape[1])},
        "removed_exact_duplicates": int(removed_duplicates),
        "dropped_sparse_columns": dropped_sparse_columns,
        "num_dropped_sparse_columns": int(len(dropped_sparse_columns)),
        "dropped_low_value_columns": dropped_low_value_columns,
        "num_dropped_low_value_columns": int(len(dropped_low_value_columns)),
        "low_value_reasons": low_value_reasons,
        "imputed_columns": imputation_report,
        "top_20_missing_ratio_before": {
            str(k): float(v) for k, v in missing_ratio_before.head(20).to_dict().items()
        },
        "top_20_zero_ratio_after_impute": {
            str(k): float(v) for k, v in zero_ratio.head(20).to_dict().items()
        },
        "top_20_dominant_ratio_after_impute": {
            str(k): float(v) for k, v in dominant_ratio.head(20).to_dict().items()
        },
    }

    # save_json(preprocessing_summary, output_dir / "main2_preprocessing_summary.json")
    return raw_df, processed_df, preprocessing_summary


def _prepare_clustering_matrix(df: pd.DataFrame, feature_columns: List[str] | None = None) -> Tuple[pd.DataFrame, np.ndarray, List[str]]:
    if feature_columns is None:
        usable_features = [
            col for col in df.select_dtypes(include=[np.number]).columns
            if col not in NON_CLUSTER_COLUMNS
        ]
    else:
        usable_features = [
            col for col in feature_columns
            if col in df.columns
            and col not in NON_CLUSTER_COLUMNS
            and pd.api.types.is_numeric_dtype(df[col])
        ]

    if not usable_features:
        raise ValueError("Không có thuộc tính số hợp lệ để chạy clustering.")

    feature_df = df[usable_features].copy()
    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()
    X_imputed = imputer.fit_transform(feature_df)
    X_scaled = scaler.fit_transform(X_imputed)

    prepared_df = pd.DataFrame(X_scaled, columns=usable_features, index=df.index)
    return prepared_df, X_scaled, usable_features

def _select_kmeans_k(X: np.ndarray, output_dir: Path, method_name: str, k_min: int, k_max: int) -> Tuple[int, pd.DataFrame, List[str]]:
    rows: List[Dict[str, float]] = []
    figure_paths: List[str] = []
    max_k = min(k_max, X.shape[0] - 1)

    for k in range(k_min, max_k + 1):
        model_cls = MiniBatchKMeans if method_name == "MiniBatchKMeans" else KMeans
        if method_name == "MiniBatchKMeans":
            model = model_cls(n_clusters=k, random_state=DEFAULT_RANDOM_STATE, n_init=20, batch_size=2048)
        else:
            model = model_cls(n_clusters=k, random_state=DEFAULT_RANDOM_STATE, n_init=20)
        model.fit(X)
        rows.append({
            "k": int(k),
            "inertia": float(model.inertia_),
        })

    selection_df = pd.DataFrame(rows)
    elbow_k = _knee_locator(selection_df["k"].tolist(), selection_df["inertia"].tolist(), curve="convex", direction="decreasing")
    if elbow_k is None:
        inertia_diff = selection_df["inertia"].diff().abs()
        selected_k = int(selection_df.loc[inertia_diff.idxmin(), "k"])
    else:
        selected_k = int(elbow_k)

    selection_df["selected_by_elbow"] = selection_df["k"] == selected_k
    selection_df.to_csv(output_dir / f"{method_name.lower()}_parameter_selection.csv", index=False)

    plt.figure(figsize=(8, 5))
    plt.plot(selection_df["k"], selection_df["inertia"], marker="o")
    plt.axvline(selected_k, linestyle="--", label=f"selected k={selected_k}")
    plt.title(f"{method_name}: Elbow Method")
    plt.xlabel("Number of clusters k")
    plt.ylabel("Inertia / WCSS")
    plt.legend()
    plt.grid(True, alpha=0.3)
    figure_paths.append(_save_current_figure(output_dir / f"{method_name.lower()}_elbow.png"))

    return selected_k, selection_df, figure_paths




def _select_gmmaic_components(X: np.ndarray, output_dir: Path, k_min: int, k_max: int) -> Tuple[int, pd.DataFrame, List[str]]:
    rows: List[Dict[str, float]] = []
    figure_paths: List[str] = []
    max_k = min(k_max, X.shape[0] - 1)

    for k in range(k_min, max_k + 1):
        model = GaussianMixture(n_components=k, covariance_type="full", random_state=DEFAULT_RANDOM_STATE)
        model.fit(X)
        rows.append({
            "k": int(k),
            "aic": float(model.aic(X)),
        })

    selection_df = pd.DataFrame(rows)
    selected_k = int(selection_df.loc[selection_df["aic"].idxmin(), "k"])
    selection_df["selected_by_aic"] = selection_df["k"] == selected_k
    selection_df.to_csv(output_dir / "gmmaic_parameter_selection.csv", index=False)

    plt.figure(figsize=(8, 5))
    plt.plot(selection_df["k"], selection_df["aic"], marker="o", label="AIC")
    plt.axvline(selected_k, linestyle="--", label=f"selected k={selected_k}")
    plt.title("GMMAIC: AIC by number of components")
    plt.xlabel("Number of Gaussian components")
    plt.ylabel("AIC")
    plt.legend()
    plt.grid(True, alpha=0.3)
    figure_paths.append(_save_current_figure(output_dir / "gmmaic_aic.png"))

    return selected_k, selection_df, figure_paths

# Add GMMAIC2 parameter selection (fixed k range 12..22)
def _select_gmmaic2_components(X: np.ndarray, output_dir: Path, k_min: int = 12, k_max: int = 22) -> Tuple[int, pd.DataFrame, List[str]]:
    rows: List[Dict[str, float]] = []
    figure_paths: List[str] = []
    max_k = min(k_max, X.shape[0] - 1)

    for k in range(k_min, max_k + 1):
        model = GaussianMixture(n_components=k, covariance_type="full", random_state=DEFAULT_RANDOM_STATE)
        model.fit(X)
        rows.append({
            "k": int(k),
            "aic": float(model.aic(X)),
        })

    selection_df = pd.DataFrame(rows)
    selected_k = int(selection_df.loc[selection_df["aic"].idxmin(), "k"])
    selection_df["selected_by_aic"] = selection_df["k"] == selected_k
    selection_df.to_csv(output_dir / "gmmaic2_parameter_selection.csv", index=False)

    plt.figure(figsize=(8, 5))
    plt.plot(selection_df["k"], selection_df["aic"], marker="o", label="AIC")
    plt.axvline(selected_k, linestyle="--", label=f"selected k={selected_k}")
    plt.title("GMMAIC2: AIC by number of components")
    plt.xlabel("Number of Gaussian components")
    plt.ylabel("AIC")
    plt.legend()
    plt.grid(True, alpha=0.3)
    figure_paths.append(_save_current_figure(output_dir / "gmmaic2_aic.png"))

    return selected_k, selection_df, figure_paths

# GMM2 parameter selection (fixed k range 12..22)

# GMM2 parameter selection (fixed k range 12..22)
def _select_gmm2_components(X: np.ndarray, output_dir: Path, k_min: int = 12, k_max: int = 22) -> Tuple[int, pd.DataFrame, List[str]]:
    rows: List[Dict[str, float]] = []
    figure_paths: List[str] = []
    max_k = min(k_max, X.shape[0] - 1)

    for k in range(k_min, max_k + 1):
        model = GaussianMixture(n_components=k, covariance_type="full", random_state=DEFAULT_RANDOM_STATE)
        model.fit(X)
        rows.append({
            "k": int(k),
            "bic": float(model.bic(X)),
        })

    selection_df = pd.DataFrame(rows)
    selected_k = int(selection_df.loc[selection_df["bic"].idxmin(), "k"])
    selection_df["selected_by_bic"] = selection_df["k"] == selected_k
    selection_df.to_csv(output_dir / "gmm2_parameter_selection.csv", index=False)

    plt.figure(figsize=(8, 5))
    plt.plot(selection_df["k"], selection_df["bic"], marker="o", label="BIC")
    plt.axvline(selected_k, linestyle="--", label=f"selected k={selected_k}")
    plt.title("GMM2: BIC by number of components")
    plt.xlabel("Number of Gaussian components")
    plt.ylabel("BIC")
    plt.legend()
    plt.grid(True, alpha=0.3)
    figure_paths.append(_save_current_figure(output_dir / "gmm2_bic.png"))

    return selected_k, selection_df, figure_paths
# GMMAIC3 parameter selection (fixed k range 22..32)
def _select_gmmaic3_components(X: np.ndarray, output_dir: Path, k_min: int = 22, k_max: int = 32) -> Tuple[int, pd.DataFrame, List[str]]:
    rows: List[Dict[str, float]] = []
    figure_paths: List[str] = []
    max_k = min(k_max, X.shape[0] - 1)

    for k in range(k_min, max_k + 1):
        model = GaussianMixture(n_components=k, covariance_type="full", random_state=DEFAULT_RANDOM_STATE)
        model.fit(X)
        rows.append({
            "k": int(k),
            "aic": float(model.aic(X)),
        })

    selection_df = pd.DataFrame(rows)
    selected_k = int(selection_df.loc[selection_df["aic"].idxmin(), "k"])
    selection_df["selected_by_aic"] = selection_df["k"] == selected_k
    selection_df.to_csv(output_dir / "gmmaic3_parameter_selection.csv", index=False)

    plt.figure(figsize=(8, 5))
    plt.plot(selection_df["k"], selection_df["aic"], marker="o", label="AIC")
    plt.axvline(selected_k, linestyle="--", label=f"selected k={selected_k}")
    plt.title("GMMAIC3: AIC by number of components")
    plt.xlabel("Number of Gaussian components")
    plt.ylabel("AIC")
    plt.legend()
    plt.grid(True, alpha=0.3)
    figure_paths.append(_save_current_figure(output_dir / "gmmaic3_aic.png"))

    return selected_k, selection_df, figure_paths
# GMM3 parameter selection (fixed k range 22..32)
def _select_gmm3_components(X: np.ndarray, output_dir: Path, k_min: int = 22, k_max: int = 32) -> Tuple[int, pd.DataFrame, List[str]]:
    rows: List[Dict[str, float]] = []
    figure_paths: List[str] = []
    max_k = min(k_max, X.shape[0] - 1)

    for k in range(k_min, max_k + 1):
        model = GaussianMixture(n_components=k, covariance_type="full", random_state=DEFAULT_RANDOM_STATE)
        model.fit(X)
        rows.append({
            "k": int(k),
            "bic": float(model.bic(X)),
        })

    selection_df = pd.DataFrame(rows)
    selected_k = int(selection_df.loc[selection_df["bic"].idxmin(), "k"])
    selection_df["selected_by_bic"] = selection_df["k"] == selected_k
    selection_df.to_csv(output_dir / "gmm3_parameter_selection.csv", index=False)

    plt.figure(figsize=(8, 5))
    plt.plot(selection_df["k"], selection_df["bic"], marker="o", label="BIC")
    plt.axvline(selected_k, linestyle="--", label=f"selected k={selected_k}")
    plt.title("GMM3: BIC by number of components")
    plt.xlabel("Number of Gaussian components")
    plt.ylabel("BIC")
    plt.legend()
    plt.grid(True, alpha=0.3)
    figure_paths.append(_save_current_figure(output_dir / "gmm3_bic.png"))

    return selected_k, selection_df, figure_paths



# Agglomerative parameter selection using silhouette score.
# Ward linkage is used because it minimizes within-cluster variance
# and is suitable for standardized numeric traffic features.
def _select_agglomerative_k(
    X: np.ndarray,
    output_dir: Path,
    k_min: int,
    k_max: int,
) -> Tuple[int, pd.DataFrame, List[str]]:
    rows: List[Dict[str, float]] = []
    figure_paths: List[str] = []

    max_k = min(k_max, X.shape[0] - 1)

    for k in range(k_min, max_k + 1):
        model = AgglomerativeClustering(
            n_clusters=k,
            linkage="ward",
        )

        labels = model.fit_predict(X)
        metrics = _safe_internal_metrics(X, labels)

        rows.append({
            "k": int(k),
            "n_param_samples": int(len(X)),
            "linkage": "ward",
            "metric": "euclidean",
            "silhouette": float(metrics["silhouette"]),
            "davies_bouldin": float(metrics["davies_bouldin"]),
            "calinski_harabasz": float(metrics["calinski_harabasz"]),
        })

    selection_df = pd.DataFrame(rows)

    selected_k = int(
        selection_df.loc[
            selection_df["silhouette"].idxmax(),
            "k",
        ]
    )

    selection_df["selected_by_silhouette"] = (
        selection_df["k"] == selected_k
    )

    selection_df.to_csv(
        output_dir / "agglomerative_parameter_selection.csv",
        index=False,
    )

    plt.figure(figsize=(8, 5))
    plt.plot(
        selection_df["k"],
        selection_df["silhouette"],
        marker="o",
        label="Silhouette",
    )

    plt.axvline(
        selected_k,
        linestyle="--",
        label=f"selected k={selected_k}",
    )

    plt.title("AgglomerativeClustering: Silhouette by number of clusters")
    plt.xlabel("Number of clusters")
    plt.ylabel("Silhouette Score")
    plt.legend()
    plt.grid(True, alpha=0.3)

    figure_paths.append(
        _save_current_figure(
            output_dir / "agglomerative_silhouette.png"
        )
    )

    return selected_k, selection_df, figure_paths

def run_agglomerative_stage(processed_path: Path, output_dir: Path, k_min: int, k_max: int) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)

    parameter_summary = _load_existing_parameter_summary(output_dir)

    selected_k, _, figure_paths = _select_agglomerative_k(
        X,
        output_dir,
        k_min,
        k_max,
    )

    parameter_summary["AgglomerativeClustering"] = {
        "selected_k": int(selected_k),
        "criterion": "Maximum silhouette score on full dataset using Ward linkage",
        "linkage": "ward",
        "metric": "euclidean",
        "n_param_samples": int(len(X)),
    }

    return _save_parameter_summary(
        output_dir,
        processed_path,
        used_features,
        parameter_summary,
        figure_paths,
        "agglomerative",
    )


def _select_dbscan_params(
    X: np.ndarray,
    output_dir: Path,
    min_samples: int = DEFAULT_DBSCAN_MIN_SAMPLES,
) -> Tuple[float, int, pd.DataFrame, List[str]]:
    """Select DBSCAN parameters using one literature-based setting.

    MinPts/min_samples is not grid-searched. It is set by the common DBSCAN
    heuristic: MinPts = number_of_features + 1. Then eps is selected from the
    knee of the k-distance graph where k = MinPts.
    """
    figure_paths: List[str] = []

    # Use the full dataset for DBSCAN parameter estimation.
    # _sample_matrix will simply return X unchanged because the max sample size
    # is intentionally set much larger than the dataset size.
    X_sample = _sample_matrix(X, DEFAULT_DBSCAN_PARAM_SAMPLE_SIZE)

    n_features = int(X_sample.shape[1])
    selected_min_samples = int(max(2, n_features + 1))

    neighbors = NearestNeighbors(n_neighbors=selected_min_samples, n_jobs=-1)
    neighbors.fit(X_sample)
    distances, _ = neighbors.kneighbors(X_sample)
    k_distances = np.sort(distances[:, -1])
    x_axis = np.arange(1, len(k_distances) + 1)

    knee_index = _knee_locator(
        x_axis.tolist(),
        k_distances.tolist(),
        curve="convex",
        direction="increasing",
    )

    if knee_index is None:
        eps = float(np.percentile(k_distances, 90))
        eps_selection_method = "90th percentile fallback because knee was not detected"
    else:
        eps_index = max(0, min(len(k_distances) - 1, knee_index - 1))
        eps = float(k_distances[eps_index])
        eps_selection_method = "k-distance knee"

    labels = DBSCAN(
        eps=eps,
        min_samples=selected_min_samples,
        n_jobs=-1,
    ).fit_predict(X_sample)

    structure = _cluster_structure_metrics(labels)
    metrics = _safe_dbscan_internal_metrics(X_sample, labels)

    selection_df = pd.DataFrame([
        {
            "eps": float(eps),
            "min_samples": int(selected_min_samples),
            "n_features": int(n_features),
            "n_param_samples": int(len(X_sample)),
            "eps_selection_method": eps_selection_method,
            **structure,
            **metrics,
            "selected_by_dbscan_param_search": True,
        }
    ])

    selection_df.to_csv(output_dir / "dbscan_parameter_selection.csv", index=False)

    plt.figure(figsize=(9, 5))
    plt.plot(x_axis, k_distances)
    plt.axhline(eps, linestyle="--", label=f"selected eps={eps:.4f}")
    plt.title(f"DBSCAN: k-distance graph (min_samples={selected_min_samples})")
    plt.xlabel("Sorted sample index")
    plt.ylabel(f"Distance to {selected_min_samples}-nearest neighbor")
    plt.legend()
    plt.grid(True, alpha=0.3)
    figure_paths.append(_save_current_figure(output_dir / "dbscan_selected_k_distance.png"))

    return eps, selected_min_samples, selection_df, figure_paths


def _fit_and_evaluate_models(
    df: pd.DataFrame,
    X: np.ndarray,
    feature_columns: List[str],
    parameter_summary: Dict[str, Dict[str, object]],
    output_dir: Path,
) -> Tuple[pd.DataFrame, Dict[str, object]]:
    rows: List[Dict[str, object]] = []
    model_payload: Dict[str, object] = {}
    labels_output = pd.DataFrame(index=df.index)

    # Only run the two centroid-based models during the final evaluation stage.
    # GMM and DBSCAN are excluded because they are significantly more memory-intensive
    # on the large high-dimensional traffic dataset.
    model_specs = [
        (
            "KMeans",
            KMeans(
                n_clusters=int(parameter_summary["KMeans"]["selected_k"]),
                random_state=DEFAULT_RANDOM_STATE,
                n_init=20,
            ),
        ),
        (
            "MiniBatchKMeans",
            MiniBatchKMeans(
                n_clusters=int(parameter_summary["MiniBatchKMeans"]["selected_k"]),
                random_state=DEFAULT_RANDOM_STATE,
                n_init=20,
                batch_size=1024,
            ),
        ),
    ]

    for method_name, model in model_specs:
        start = time.time()
        labels = model.fit_predict(X)
        runtime = time.time() - start

        labels_output[f"cluster_{method_name}"] = labels
        internal = _safe_internal_metrics(X, labels)
        external = _external_metrics(df, labels)
        structure = _cluster_structure_metrics(labels)

        centroid_metrics = {}
        reconstruction = {}
        if hasattr(model, "inertia_"):
            centroid_metrics["inertia"] = float(getattr(model, "inertia_"))
        if hasattr(model, "cluster_centers_"):
            centers = getattr(model, "cluster_centers_")
            reconstruction = _reconstruction_metrics(X, centers[labels])

        row = {
            "method": method_name,
            "runtime_sec": float(runtime),
            "n_features": int(len(feature_columns)),
            **structure,
            **centroid_metrics,
            **internal,
            **external,
            **reconstruction,
        }
        rows.append(row)

        model_payload[method_name] = {
            "parameters": parameter_summary.get(method_name, {}),
            "runtime_sec": float(runtime),
            "used_features": feature_columns,
            "cluster_sizes": {
                str(k): int(v) for k, v in pd.Series(labels).value_counts().sort_index().to_dict().items()
            },
            "centroid_evaluation": centroid_metrics,
            "internal_evaluation": internal,
            "external_evaluation": external,
            "structure_evaluation": structure,
            "reconstruction_evaluation": reconstruction,
        }

    comparison_df = pd.DataFrame(rows)
    comparison_df = _select_best_model_by_metric_wins(comparison_df)
    comparison_df.to_csv(output_dir / DEFAULT_CLUSTERED_FILENAME, index=False)
    comparison_df.to_csv(output_dir / "main2_model_comparison.csv", index=False)

    labels_df = pd.concat([df.reset_index(drop=True), labels_output.reset_index(drop=True)], axis=1)
    labels_df.to_csv(output_dir / "main2_clustered_results.csv", index=False)

    return comparison_df, model_payload


def _select_best_model_by_metric_wins(comparison_df: pd.DataFrame) -> pd.DataFrame:
    """Choose the final model by counting how many evaluation criteria each method wins."""
    if comparison_df.empty or "method" not in comparison_df.columns:
        return comparison_df

    higher_is_better = [
        "silhouette",
        "calinski_harabasz",
        "ari",
        "nmi",
        "fmi",
        "f_measure",
    ]
    lower_is_better = [
        "davies_bouldin",
        "entropy",
        "inertia",
        "mae",
        "mse",
        "rmse",
        "cluster_size_std",
        "cluster_balance_ratio",
        "noise_ratio",
        "runtime_sec",
    ]

    wins = {str(method): 0 for method in comparison_df["method"].astype(str)}

    for metric in higher_is_better:
        if metric in comparison_df.columns and comparison_df[metric].notna().any():
            best_value = comparison_df[metric].max(skipna=True)
            for method in comparison_df.loc[comparison_df[metric] == best_value, "method"].astype(str):
                wins[method] += 1

    for metric in lower_is_better:
        if metric in comparison_df.columns and comparison_df[metric].notna().any():
            best_value = comparison_df[metric].min(skipna=True)
            for method in comparison_df.loc[comparison_df[metric] == best_value, "method"].astype(str):
                wins[method] += 1

    comparison_df = comparison_df.copy()
    comparison_df["metric_wins"] = comparison_df["method"].astype(str).map(wins).fillna(0).astype(int)
    max_wins = comparison_df["metric_wins"].max()
    comparison_df["is_selected_model"] = comparison_df["metric_wins"] == max_wins
    return comparison_df.sort_values(["metric_wins", "silhouette"], ascending=[False, False], na_position="last")


def _plot_model_comparison(comparison_df: pd.DataFrame, output_dir: Path) -> List[str]:
    figure_paths: List[str] = []
    if comparison_df.empty:
        return figure_paths

    metric_specs = [
        ("silhouette", "Silhouette Score"),
        ("davies_bouldin", "Davies-Bouldin Index"),
        ("calinski_harabasz", "Calinski-Harabasz Index"),
        ("ari", "Adjusted Rand Index"),
        ("nmi", "Normalized Mutual Information"),
        ("fmi", "Fowlkes-Mallows Index"),
        ("f_measure", "F-measure"),
        ("entropy", "Cluster Entropy"),
        ("inertia", "Inertia / WCSS"),
        ("mae", "Mean Absolute Error"),
        ("rmse", "Root Mean Squared Error"),
        ("cluster_size_std", "Cluster Size Standard Deviation"),
        ("cluster_balance_ratio", "Cluster Balance Ratio"),
        ("runtime_sec", "Runtime (seconds)"),
        ("noise_ratio", "Noise Ratio"),
    ]

    for metric, title in metric_specs:
        if metric not in comparison_df.columns:
            continue
        plot_df = comparison_df[["method", metric]].dropna()
        if plot_df.empty:
            continue
        plt.figure(figsize=(9, 5))
        plt.bar(plot_df["method"], plot_df[metric])
        plt.title(f"Main2 comparison: {title}")
        plt.xlabel("Method")
        plt.ylabel(metric)
        plt.xticks(rotation=20)
        figure_paths.append(_save_current_figure(output_dir / f"comparison_{metric}.png"))

    return figure_paths


def _plot_selected_model_figures(
    df: pd.DataFrame,
    X: np.ndarray,
    feature_columns: List[str],
    comparison_df: pd.DataFrame,
    output_dir: Path,
) -> List[str]:
    figure_paths: List[str] = []
    labels_path = output_dir / "main2_clustered_results.csv"
    if comparison_df.empty or not labels_path.exists():
        return figure_paths

    selected_rows = comparison_df[comparison_df.get("is_selected_model", False) == True]
    best_method = str(selected_rows.iloc[0]["method"] if not selected_rows.empty else comparison_df.iloc[0]["method"])
    cluster_col = f"cluster_{best_method}"

    labels_df = pd.read_csv(labels_path)
    if cluster_col not in labels_df.columns:
        return figure_paths

    labels = labels_df[cluster_col].to_numpy()
    non_noise_mask = labels != -1

    cluster_counts_series = pd.Series(labels).value_counts().sort_index()
    plt.figure(figsize=(9, 5))
    plt.bar(cluster_counts_series.index.astype(str), cluster_counts_series.values)
    plt.title(f"{best_method}: Cluster size distribution")
    plt.xlabel("Cluster")
    plt.ylabel("Number of samples")
    figure_paths.append(_save_current_figure(output_dir / f"selected_{best_method.lower()}_cluster_counts.png"))

    if X.shape[1] >= 2:
        sample_size = min(len(X), 15000)
        sample_indices = np.random.RandomState(DEFAULT_RANDOM_STATE).choice(len(X), size=sample_size, replace=False) if len(X) > sample_size else np.arange(len(X))
        pca = PCA(n_components=2, random_state=DEFAULT_RANDOM_STATE)
        components = pca.fit_transform(X[sample_indices])
        explained = pca.explained_variance_ratio_ * 100
        sampled_labels = labels[sample_indices]

        plt.figure(figsize=(10, 7))
        for cluster_id in sorted(pd.Series(sampled_labels).dropna().unique()):
            mask = sampled_labels == cluster_id
            plt.scatter(components[mask, 0], components[mask, 1], s=10, alpha=0.6, label=f"Cluster {cluster_id}")
        plt.title(f"{best_method}: PCA cluster visualization (PC1={explained[0]:.2f}%, PC2={explained[1]:.2f}%)")
        plt.xlabel("Principal Component 1")
        plt.ylabel("Principal Component 2")
        plt.legend(markerscale=2, fontsize=8)
        figure_paths.append(_save_current_figure(output_dir / f"selected_{best_method.lower()}_pca_clusters.png"))

    feature_df = df[feature_columns].copy()
    feature_df["cluster"] = labels

    valid_cluster_df = feature_df[feature_df["cluster"] != -1].copy()

    profile_df = (
        valid_cluster_df.groupby("cluster")[feature_columns]
        .mean()
        .reset_index()
    )

    cluster_counts_df = (
        valid_cluster_df.groupby("cluster")
        .size()
        .reset_index(name="sample_count")
    )

    profile_df = profile_df.merge(
        cluster_counts_df,
        on="cluster",
        how="left",
    )

    ordered_columns = ["cluster", "sample_count"] + [
        col for col in profile_df.columns
        if col not in ["cluster", "sample_count"]
    ]
    profile_df = profile_df[ordered_columns]

    profile_df.to_csv(output_dir / f"selected_{best_method.lower()}_cluster_profile.csv", index=False)

    top_features = feature_columns[: min(8, len(feature_columns))]
    if len(top_features) >= 3 and not profile_df.empty:
        radar_df = profile_df.set_index("cluster")[top_features].copy()
        scaled_radar = (radar_df - radar_df.min()) / (radar_df.max() - radar_df.min() + 1e-12)
        angles = np.linspace(0, 2 * np.pi, len(top_features), endpoint=False).tolist()
        angles += angles[:1]

        plt.figure(figsize=(8, 8))
        ax = plt.subplot(111, polar=True)
        for cluster_id, row in scaled_radar.iterrows():
            values = row.tolist()
            values += values[:1]
            ax.plot(angles, values, label=f"Cluster {cluster_id}")
            ax.fill(angles, values, alpha=0.08)
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(top_features, fontsize=8)
        ax.set_title(f"{best_method}: Cluster attribute radar")
        ax.legend(loc="upper right", bbox_to_anchor=(1.25, 1.1), fontsize=8)
        figure_paths.append(_save_current_figure(output_dir / f"selected_{best_method.lower()}_radar.png"))

    if top_features:
        melt_df = feature_df[feature_df["cluster"] != -1][["cluster", *top_features]].melt(id_vars="cluster", var_name="feature", value_name="value")
        plt.figure(figsize=(12, 6))
        positions = []
        labels_text = []
        data = []
        pos = 1
        for feature in top_features:
            for cluster_id in sorted(melt_df["cluster"].unique()):
                values = melt_df[(melt_df["feature"] == feature) & (melt_df["cluster"] == cluster_id)]["value"].dropna().sample(
                    n=min(1000, len(melt_df[(melt_df["feature"] == feature) & (melt_df["cluster"] == cluster_id)])),
                    random_state=DEFAULT_RANDOM_STATE,
                )
                data.append(values)
                positions.append(pos)
                labels_text.append(f"{feature}\nC{cluster_id}")
                pos += 1
            pos += 1
        if data:
            plt.boxplot(data, positions=positions, showfliers=False)
            plt.xticks(positions, labels_text, rotation=75, fontsize=7)
            plt.title(f"{best_method}: Feature distribution by cluster")
            plt.ylabel("Original feature value")
            figure_paths.append(_save_current_figure(output_dir / f"selected_{best_method.lower()}_feature_distribution.png"))

    selected_summary = {
        "selected_model": best_method,
        "cluster_column": cluster_col,
        "cluster_counts": {str(k): int(v) for k, v in cluster_counts_series.to_dict().items()},
        "profile_csv_path": str(output_dir / f"selected_{best_method.lower()}_cluster_profile.csv"),
        "figure_paths": figure_paths,
    }
    save_json(selected_summary, output_dir / "selected_model_figure_summary.json")
    return figure_paths


def run_preprocess_stage(input_path: Path, output_dir: Path) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    _, processed_df, preprocessing_summary = _prepare_preprocessed_data(input_path, output_dir)
    processed_path = output_dir / DEFAULT_PROCESSED_FILENAME
    save_dataframe(processed_df, processed_path)
    summary = {
        "stage": "preprocess",
        "input_path": str(input_path),
        "processed_csv_path": str(processed_path),
        "preprocessing_summary": preprocessing_summary,
    }
    save_json(summary, output_dir / "stage1_preprocess_summary.json")
    return summary



def _load_existing_parameter_summary(output_dir: Path) -> Dict[str, Dict[str, object]]:
    parameter_path = output_dir / DEFAULT_PARAM_SUMMARY_FILENAME
    if not parameter_path.exists():
        return {}
    with open(parameter_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("parameter_selection", {})


def _save_parameter_summary(
    output_dir: Path,
    processed_path: Path,
    used_features: List[str],
    parameter_summary: Dict[str, Dict[str, object]],
    figure_paths: List[str],
    stage_name: str,
) -> Dict[str, object]:
    summary = {
        "stage": stage_name,
        "processed_csv_path": str(processed_path),
        "used_features": used_features,
        "n_used_features": int(len(used_features)),
        "parameter_selection": parameter_summary,
        "figure_paths": figure_paths,
    }
    save_json(summary, output_dir / DEFAULT_PARAM_SUMMARY_FILENAME)
    save_json(summary, output_dir / f"stage2_{stage_name}_summary.json")
    return summary


def run_kmeans_stage(processed_path: Path, output_dir: Path, k_min: int, k_max: int) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)
    parameter_summary = _load_existing_parameter_summary(output_dir)
    selected_k, _, figure_paths = _select_kmeans_k(X, output_dir, "KMeans", k_min, k_max)
    parameter_summary["KMeans"] = {"selected_k": int(selected_k), "criterion": "Elbow Method using inertia on full dataset"}
    return _save_parameter_summary(output_dir, processed_path, used_features, parameter_summary, figure_paths, "kmeans")


def run_minibatch_stage(processed_path: Path, output_dir: Path, k_min: int, k_max: int) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)
    parameter_summary = _load_existing_parameter_summary(output_dir)
    selected_k, _, figure_paths = _select_kmeans_k(X, output_dir, "MiniBatchKMeans", k_min, k_max)
    parameter_summary["MiniBatchKMeans"] = {"selected_k": int(selected_k), "criterion": "Elbow Method using inertia on full dataset"}
    return _save_parameter_summary(output_dir, processed_path, used_features, parameter_summary, figure_paths, "minibatch")




# GMM stage function (BIC-based, variable k range)
def run_gmm_stage(processed_path: Path, output_dir: Path, k_min: int, k_max: int) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)
    parameter_summary = _load_existing_parameter_summary(output_dir)

    rows: List[Dict[str, float]] = []
    figure_paths: List[str] = []
    max_k = min(k_max, X.shape[0] - 1)

    for k in range(k_min, max_k + 1):
        model = GaussianMixture(
            n_components=k,
            covariance_type="full",
            random_state=DEFAULT_RANDOM_STATE,
        )
        model.fit(X)

        rows.append({
            "k": int(k),
            "bic": float(model.bic(X)),
        })

    selection_df = pd.DataFrame(rows)

    selected_k = int(
        selection_df.loc[
            selection_df["bic"].idxmin(),
            "k",
        ]
    )

    selection_df["selected_by_bic"] = (
        selection_df["k"] == selected_k
    )

    selection_df.to_csv(
        output_dir / "gmm_parameter_selection.csv",
        index=False,
    )

    plt.figure(figsize=(8, 5))
    plt.plot(
        selection_df["k"],
        selection_df["bic"],
        marker="o",
        label="BIC",
    )

    plt.axvline(
        selected_k,
        linestyle="--",
        label=f"selected k={selected_k}",
    )

    plt.title("GMM: BIC by number of components")
    plt.xlabel("Number of Gaussian components")
    plt.ylabel("BIC")
    plt.legend()
    plt.grid(True, alpha=0.3)

    figure_paths.append(
        _save_current_figure(
            output_dir / "gmm_bic.png"
        )
    )

    parameter_summary["GMM"] = {
        "selected_k": int(selected_k),
        "criterion": "Minimum BIC on full dataset",
    }

    return _save_parameter_summary(
        output_dir,
        processed_path,
        used_features,
        parameter_summary,
        figure_paths,
        "gmm",
    )


def run_gmmaic_stage(processed_path: Path, output_dir: Path, k_min: int, k_max: int) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)
    parameter_summary = _load_existing_parameter_summary(output_dir)
    selected_k, _, figure_paths = _select_gmmaic_components(X, output_dir, k_min, k_max)
    parameter_summary["GMMAIC"] = {"selected_k": int(selected_k), "criterion": "Minimum AIC on full dataset"}
    return _save_parameter_summary(output_dir, processed_path, used_features, parameter_summary, figure_paths, "gmmaic")

# GMMAIC2 stage function
def run_gmmaic2_stage(processed_path: Path, output_dir: Path) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)
    parameter_summary = _load_existing_parameter_summary(output_dir)
    selected_k, _, figure_paths = _select_gmmaic2_components(X, output_dir, 12, 22)
    parameter_summary["GMMAIC2"] = {"selected_k": int(selected_k), "criterion": "Minimum AIC on full dataset, search range k=12..22"}
    return _save_parameter_summary(output_dir, processed_path, used_features, parameter_summary, figure_paths, "gmmaic2")

def run_gmmaic3_stage(processed_path: Path, output_dir: Path) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)
    parameter_summary = _load_existing_parameter_summary(output_dir)
    selected_k, _, figure_paths = _select_gmmaic3_components(X, output_dir, 22, 32)
    parameter_summary["GMMAIC3"] = {
        "selected_k": int(selected_k),
        "criterion": "Minimum AIC on full dataset, search range k=22..32",
    }
    return _save_parameter_summary(output_dir, processed_path, used_features, parameter_summary, figure_paths, "gmmaic3")
# GMM2 stage function
def run_gmm2_stage(processed_path: Path, output_dir: Path) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)
    parameter_summary = _load_existing_parameter_summary(output_dir)
    selected_k, _, figure_paths = _select_gmm2_components(X, output_dir, 12, 22)
    parameter_summary["GMM2"] = {"selected_k": int(selected_k), "criterion": "Minimum BIC on full dataset, search range k=12..22"}
    return _save_parameter_summary(output_dir, processed_path, used_features, parameter_summary, figure_paths, "gmm2")

# GMM3 stage function
def run_gmm3_stage(processed_path: Path, output_dir: Path) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)
    parameter_summary = _load_existing_parameter_summary(output_dir)
    selected_k, _, figure_paths = _select_gmm3_components(X, output_dir, 22, 32)
    parameter_summary["GMM3"] = {"selected_k": int(selected_k), "criterion": "Minimum BIC on full dataset, search range k=22..32"}
    return _save_parameter_summary(output_dir, processed_path, used_features, parameter_summary, figure_paths, "gmm3")


def run_dbscan_stage(processed_path: Path, output_dir: Path, dbscan_min_samples: int) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)
    parameter_summary = _load_existing_parameter_summary(output_dir)
    eps, min_samples, _, figure_paths = _select_dbscan_params(X, output_dir, min_samples=dbscan_min_samples)
    parameter_summary["DBSCAN"] = {
        "eps": float(eps),
        "min_samples": int(min_samples),
        "criterion": "MinPts = number_of_features + 1; eps selected from k-distance knee; internal metrics computed on non-noise clusters only",
        "n_param_samples": int(len(X)),
    }
    return _save_parameter_summary(output_dir, processed_path, used_features, parameter_summary, figure_paths, "dbscan")


def run_parameter_stage(processed_path: Path, output_dir: Path, k_min: int, k_max: int, dbscan_min_samples: int) -> Dict[str, object]:
    figure_paths: List[str] = []
    summary_kmeans = run_kmeans_stage(processed_path, output_dir, k_min, k_max)
    figure_paths.extend(summary_kmeans.get("figure_paths", []))
    summary_minibatch = run_minibatch_stage(processed_path, output_dir, k_min, k_max)
    figure_paths.extend(summary_minibatch.get("figure_paths", []))
    summary_gmm = run_gmm_stage(processed_path, output_dir, k_min, k_max)
    figure_paths.extend(summary_gmm.get("figure_paths", []))
    summary_agglomerative = run_agglomerative_stage(processed_path, output_dir, k_min, k_max)
    figure_paths.extend(summary_agglomerative.get("figure_paths", []))
    summary_dbscan = run_dbscan_stage(processed_path, output_dir, dbscan_min_samples)
    figure_paths.extend(summary_dbscan.get("figure_paths", []))

    parameter_summary = _load_existing_parameter_summary(output_dir)
    df = pd.read_csv(processed_path, nrows=1)
    used_features = [
        col for col in df.select_dtypes(include=[np.number]).columns
        if col not in NON_CLUSTER_COLUMNS
    ]
    summary = {
        "stage": "parameter_selection_all_models",
        "processed_csv_path": str(processed_path),
        "used_features": used_features,
        "n_used_features": int(len(used_features)),
        "parameter_selection": parameter_summary,
        "figure_paths": figure_paths,
    }
    save_json(summary, output_dir / DEFAULT_PARAM_SUMMARY_FILENAME)
    save_json(summary, output_dir / "stage2_parameter_summary.json")
    return summary


def run_model_stage(processed_path: Path, parameter_path: Path, output_dir: Path) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)

    with open(parameter_path, "r", encoding="utf-8") as f:
        parameter_summary = json.load(f)["parameter_selection"]

    comparison_df, model_payload = _fit_and_evaluate_models(df, X, used_features, parameter_summary, output_dir)
    selected_rows = comparison_df[comparison_df["is_selected_model"] == True]
    selected_model = str(selected_rows.iloc[0]["method"] if not selected_rows.empty else comparison_df.iloc[0]["method"])

    summary = {
        "stage": "model_training_and_evaluation_kmeans_only",
        "processed_csv_path": str(processed_path),
        "parameter_json_path": str(parameter_path),
        "used_features": used_features,
        "n_used_features": int(len(used_features)),
        "selected_model": selected_model,
        "comparison_csv_path": str(output_dir / DEFAULT_CLUSTERED_FILENAME),
        "clustered_results_csv_path": str(output_dir / "main2_clustered_results.csv"),
        "model_results": model_payload,
    }
    save_json(summary, output_dir / "stage3_model_summary.json")
    return summary


def run_figure_stage(processed_path: Path, output_dir: Path) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(processed_path)
    _, X, used_features = _prepare_clustering_matrix(df)
    comparison_path = output_dir / DEFAULT_CLUSTERED_FILENAME
    if not comparison_path.exists():
        comparison_path = output_dir / "main2_model_comparison.csv"
    comparison_df = pd.read_csv(comparison_path)

    figure_paths = _plot_selected_model_figures(df, X, used_features, comparison_df, output_dir)
    summary = {
        "stage": "selected_model_figures",
        "processed_csv_path": str(processed_path),
        "comparison_csv_path": str(comparison_path),
        "figure_paths": figure_paths,
    }
    save_json(summary, output_dir / "stage4_figure_summary.json")
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Main2 as independent stages to reduce memory pressure."
    )
    parser.add_argument(
        "--stage",
        required=True,
        choices=["preprocess", "kmeans", "minibatch", "gmm", "gmmaic", "gmmaic2", "gmmaic3", "gmm2", "gmm3", "agglomerative", "dbscan", "params", "models", "figures", "all"],
        help="Stage to run independently.",
    )
    parser.add_argument("--input", help="Path to raw input CSV file. Required for preprocess/all.")
    parser.add_argument("--processed", default=None, help="Path to data_processed.csv. Defaults to output-dir/data_processed.csv.")
    parser.add_argument("--parameters", default=None, help="Path to selected_parameters.json. Defaults to output-dir/selected_parameters.json.")
    parser.add_argument("--output-dir", default=OUTPUT_DIRNAME, help="Output folder for Main2 artifacts.")
    parser.add_argument("--k-min", type=int, default=DEFAULT_K_MIN, help="Minimum k/components for k-based models.")
    parser.add_argument("--k-max", type=int, default=DEFAULT_K_MAX, help="Maximum k/components for k-based models.")
    parser.add_argument("--dbscan-min-samples", type=int, default=DEFAULT_DBSCAN_MIN_SAMPLES, help="Kept for backward compatibility. DBSCAN now uses MinPts = number_of_features + 1 and only estimates eps from the k-distance knee.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    processed_path = Path(args.processed) if args.processed else output_dir / DEFAULT_PROCESSED_FILENAME
    parameter_path = Path(args.parameters) if args.parameters else output_dir / DEFAULT_PARAM_SUMMARY_FILENAME

    if args.stage in {"preprocess", "all"}:
        if not args.input:
            raise ValueError("Stage preprocess/all cần truyền --input data.csv")
        stage_start = time.time()
        summary = run_preprocess_stage(Path(args.input), output_dir)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "preprocess", runtime_sec)
        print(f"[STAGE 1] Hoan tat tien xu li: {summary['processed_csv_path']}")
        print(f"[STAGE 1] Runtime: {runtime_sec:.2f} sec")

    if args.stage == "kmeans":
        stage_start = time.time()
        summary = run_kmeans_stage(processed_path, output_dir, args.k_min, args.k_max)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "kmeans", runtime_sec)
        print(f"[KMEANS] Hoan tat tim k: {summary['parameter_selection']['KMeans']}")
        print(f"[KMEANS] Runtime: {runtime_sec:.2f} sec")

    if args.stage == "minibatch":
        stage_start = time.time()
        summary = run_minibatch_stage(processed_path, output_dir, args.k_min, args.k_max)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "minibatch", runtime_sec)
        print(f"[MINIBATCH] Hoan tat tim k: {summary['parameter_selection']['MiniBatchKMeans']}")
        print(f"[MINIBATCH] Runtime: {runtime_sec:.2f} sec")

    if args.stage == "gmm":
        stage_start = time.time()
        summary = run_gmm_stage(processed_path, output_dir, args.k_min, args.k_max)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "gmm", runtime_sec)
        print(f"[GMM] Hoan tat tim components: {summary['parameter_selection']['GMM']}")
        print(f"[GMM] Runtime: {runtime_sec:.2f} sec")

    if args.stage == "gmmaic":
        stage_start = time.time()
        summary = run_gmmaic_stage(processed_path, output_dir, args.k_min, args.k_max)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "gmmaic", runtime_sec)
        print(f"[GMMAIC] Hoan tat tim components bang AIC: {summary['parameter_selection']['GMMAIC']}")
        print(f"[GMMAIC] Runtime: {runtime_sec:.2f} sec")

    if args.stage == "gmmaic2":
        stage_start = time.time()
        summary = run_gmmaic2_stage(processed_path, output_dir)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "gmmaic2", runtime_sec)
        print(f"[GMMAIC2] Hoan tat tim components bang AIC 12..22: {summary['parameter_selection']['GMMAIC2']}")
        print(f"[GMMAIC2] Runtime: {runtime_sec:.2f} sec")
    if args.stage == "gmmaic3":
        stage_start = time.time()
        summary = run_gmmaic3_stage(processed_path, output_dir)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "gmmaic3", runtime_sec)
        print(f"[GMMAIC3] Hoan tat tim components bang AIC 22..32: {summary['parameter_selection']['GMMAIC3']}")
        print(f"[GMMAIC3] Runtime: {runtime_sec:.2f} sec")
    if args.stage == "gmm2":
        stage_start = time.time()
        summary = run_gmm2_stage(processed_path, output_dir)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "gmm2", runtime_sec)
        print(f"[GMM2] Hoan tat tim components 12..22: {summary['parameter_selection']['GMM2']}")
        print(f"[GMM2] Runtime: {runtime_sec:.2f} sec")

    if args.stage == "gmm3":
        stage_start = time.time()
        summary = run_gmm3_stage(processed_path, output_dir)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "gmm3", runtime_sec)
        print(f"[GMM3] Hoan tat tim components 22..32: {summary['parameter_selection']['GMM3']}")
        print(f"[GMM3] Runtime: {runtime_sec:.2f} sec")

    if args.stage == "agglomerative":
        stage_start = time.time()
        summary = run_agglomerative_stage(processed_path, output_dir, args.k_min, args.k_max)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "agglomerative", runtime_sec)
        print(f"[AGGLOMERATIVE] Hoan tat tim k: {summary['parameter_selection']['AgglomerativeClustering']}")
        print(f"[AGGLOMERATIVE] Runtime: {runtime_sec:.2f} sec")

    if args.stage == "dbscan":
        stage_start = time.time()
        summary = run_dbscan_stage(processed_path, output_dir, args.dbscan_min_samples)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "dbscan", runtime_sec)
        print(f"[DBSCAN] Hoan tat tim eps/min_samples: {summary['parameter_selection']['DBSCAN']}")
        print(f"[DBSCAN] Runtime: {runtime_sec:.2f} sec")

    if args.stage in {"params", "all"}:
        stage_start = time.time()
        summary = run_parameter_stage(processed_path, output_dir, args.k_min, args.k_max, args.dbscan_min_samples)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "params", runtime_sec)
        print(f"[STAGE 2] Hoan tat tim tham so: {output_dir / DEFAULT_PARAM_SUMMARY_FILENAME}")
        print(f"[STAGE 2] Selected parameters: {json.dumps(summary['parameter_selection'], ensure_ascii=False)}")
        print(f"[STAGE 2] Runtime: {runtime_sec:.2f} sec")

    if args.stage in {"models", "all"}:
        stage_start = time.time()
        summary = run_model_stage(processed_path, parameter_path, output_dir)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "models", runtime_sec)
        print(f"[STAGE 3] Hoan tat chay KMeans va MiniBatchKMeans: {summary['comparison_csv_path']}")
        print(f"[STAGE 3] Selected model: {summary['selected_model']}")
        print(f"[STAGE 3] Runtime: {runtime_sec:.2f} sec")

    if args.stage in {"figures", "all"}:
        stage_start = time.time()
        summary = run_figure_stage(processed_path, output_dir)
        runtime_sec = time.time() - stage_start
        append_stage_runtime(output_dir, "figures", runtime_sec)
        print(f"[STAGE 4] Hoan tat ve figure mo hinh tot nhat.")
        print(f"[STAGE 4] Figures: {json.dumps(summary['figure_paths'], ensure_ascii=False)}")
        print(f"[STAGE 4] Runtime: {runtime_sec:.2f} sec")


if __name__ == "__main__":
    main()