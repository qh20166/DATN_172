from __future__ import annotations

import math
from pathlib import Path
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering, DBSCAN, KMeans, MiniBatchKMeans
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
from sklearn.preprocessing import StandardScaler

from config import (
    CLUSTERING_OUTPUT_DIRNAME,
    DEFAULT_FIGURE_DPI,
    DEFAULT_KMEANS_N_INIT,
    DEFAULT_K_RANGE,
    DEFAULT_RANDOM_STATE,
    DEFAULT_SILHOUETTE_SAMPLE_SIZE,
)
from io_utils import save_json


def compute_sampled_silhouette_score(
    scaled_array: np.ndarray,
    labels: np.ndarray,
    sample_size: int = DEFAULT_SILHOUETTE_SAMPLE_SIZE,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> float:
    """Tính silhouette trên mẫu con để tránh quá chậm với dữ liệu lớn."""
    unique_labels = np.unique(labels)
    if len(unique_labels) <= 1:
        return float("nan")

    n_samples = scaled_array.shape[0]
    if n_samples <= sample_size:
        return float(silhouette_score(scaled_array, labels))

    rng = np.random.RandomState(random_state)
    sample_indices = rng.choice(n_samples, size=sample_size, replace=False)
    sampled_X = scaled_array[sample_indices]
    sampled_labels = labels[sample_indices]

    if len(np.unique(sampled_labels)) <= 1:
        return float("nan")

    return float(silhouette_score(sampled_X, sampled_labels))
def compute_cluster_entropy(y_true: pd.Series, y_pred: pd.Series) -> float:
    """Entropy có trọng số theo từng cluster dự đoán."""
    temp = pd.DataFrame({
        "true": y_true.astype(str),
        "pred": y_pred.astype(str),
    })

    total = len(temp)
    if total == 0:
        return float("nan")

    weighted_entropy = 0.0

    for _, group in temp.groupby("pred"):
        probs = group["true"].value_counts(normalize=True)
        ent = float(-(probs * np.log2(probs + 1e-12)).sum())
        weighted_entropy += (len(group) / total) * ent

    return weighted_entropy

def map_clusters_to_majority_labels(y_true: pd.Series, y_pred: pd.Series) -> pd.Series:
    """Ánh xạ mỗi cluster dự đoán sang nhãn thật xuất hiện nhiều nhất trong cluster đó."""
    temp = pd.DataFrame({
        "true": y_true.astype(str),
        "pred": y_pred.astype(str),
    })

    mapping: Dict[str, str] = {}
    for cluster_label, group in temp.groupby("pred"):
        majority_label = group["true"].value_counts().idxmax()
        mapping[str(cluster_label)] = str(majority_label)

    return y_pred.astype(str).map(mapping)


def compute_external_metrics(df: pd.DataFrame, predicted_labels: np.ndarray) -> Dict[str, object]:
    """Nếu có nhãn tham chiếu thì tính các độ đo external."""
    candidate_columns = ["speed_cluster_rule", "cluster_true", "true_label", "label"]
    target_col = next((col for col in candidate_columns if col in df.columns), None)

    if target_col is None:
        return {}

    valid_mask = df[target_col].notna()
    if int(valid_mask.sum()) == 0:
        return {}

    y_true = df.loc[valid_mask, target_col].astype(str)
    y_pred = pd.Series(predicted_labels, index=df.index).loc[valid_mask].astype(str)

    y_pred_mapped = map_clusters_to_majority_labels(y_true, y_pred)

    per_class_f1_scores: List[float] = []
    unique_labels = sorted(set(y_true.unique()) | set(y_pred_mapped.dropna().unique()))

    for label in unique_labels:
        tp = int(((y_true == label) & (y_pred_mapped == label)).sum())
        fp = int(((y_true != label) & (y_pred_mapped == label)).sum())
        fn = int(((y_true == label) & (y_pred_mapped != label)).sum())

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        per_class_f1_scores.append(float(f1))

    macro_f_measure = float(np.mean(per_class_f1_scores)) if per_class_f1_scores else float("nan")

    return {
        "reference_label_column": target_col,
        "ari": float(adjusted_rand_score(y_true, y_pred)),
        "nmi": float(normalized_mutual_info_score(y_true, y_pred)),
        "fmi": float(fowlkes_mallows_score(y_true, y_pred)),
        "f_measure": macro_f_measure,
        "entropy": float(compute_cluster_entropy(y_true, y_pred)),
    }

def save_cluster_visualizations(
    df: pd.DataFrame,
    labels: np.ndarray,
    output_dir: Path,
) -> List[str]:
    """Lưu các ảnh minh hoạ cụm và phân bố số lượng cụm."""
    figure_paths: List[str] = []
    plot_df = df.copy()
    plot_df["cluster_kmeans"] = labels

    cluster_counts = plot_df["cluster_kmeans"].value_counts().sort_index()
    plt.figure(figsize=(8, 5))
    cluster_counts.plot(kind="bar")
    plt.title("Phan bo so luong tung cum")
    plt.xlabel("Cluster")
    plt.ylabel("So luong")
    plt.tight_layout()
    distribution_path = output_dir / "figure_cluster_distribution.png"
    plt.savefig(distribution_path, dpi=DEFAULT_FIGURE_DPI)
    plt.close()
    figure_paths.append(str(distribution_path))

    scatter_columns = [
        col for col in ["currentSpeed", "congestionIndex", "trafficVolume"]
        if col in plot_df.columns and pd.api.types.is_numeric_dtype(plot_df[col])
    ]
    if len(scatter_columns) >= 2:
        x_col, y_col = scatter_columns[0], scatter_columns[1]
        sample_df = plot_df.sample(min(5000, len(plot_df)), random_state=DEFAULT_RANDOM_STATE)

        plt.figure(figsize=(8, 6))
        for cluster_id in sorted(sample_df["cluster_kmeans"].unique()):
            cluster_subset = sample_df[sample_df["cluster_kmeans"] == cluster_id]
            plt.scatter(
                cluster_subset[x_col],
                cluster_subset[y_col],
                s=8,
                alpha=0.6,
                label=f"Cluster {cluster_id}",
            )
        plt.title("Minh hoa cum bang scatter 2D")
        plt.xlabel(x_col)
        plt.ylabel(y_col)
        plt.legend(markerscale=2)
        plt.tight_layout()
        scatter_path = output_dir / "figure_cluster_scatter.png"
        plt.savefig(scatter_path, dpi=DEFAULT_FIGURE_DPI)
        plt.close()
        figure_paths.append(str(scatter_path))

    return figure_paths


def prepare_features_for_kmeans(
    df: pd.DataFrame,
    feature_columns: List[str],
) -> Tuple[pd.DataFrame, np.ndarray, List[str]]:
    """Chuẩn bị ma trận đặc trưng số cho K-Means."""
    usable_features = [
        col for col in feature_columns
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col])
    ]

    if not usable_features:
        return pd.DataFrame(index=df.index), np.empty((len(df), 0)), []

    feature_df = df[usable_features].copy()
    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()

    imputed_array = imputer.fit_transform(feature_df)
    scaled_array = scaler.fit_transform(imputed_array)

    prepared_df = pd.DataFrame(
        scaled_array,
        columns=usable_features,
        index=df.index,
    )
    return prepared_df, scaled_array, usable_features


def compute_reconstruction_metrics(
    original_scaled: np.ndarray,
    reconstructed_scaled: np.ndarray,
) -> Dict[str, float]:
    """Tính các chỉ số sai số tái tạo để tham khảo chất lượng gom cụm."""
    absolute_error = np.abs(original_scaled - reconstructed_scaled)
    squared_error = np.square(original_scaled - reconstructed_scaled)

    mae = float(np.mean(absolute_error))
    mse = float(np.mean(squared_error))
    rmse = float(math.sqrt(mse))

    denom_abs = float(np.sum(np.abs(original_scaled)))
    denom_sq = float(np.sum(np.square(original_scaled)))

    rae = float(np.sum(absolute_error) / denom_abs) if denom_abs > 0 else 0.0
    rrse = float(math.sqrt(np.sum(squared_error) / denom_sq)) if denom_sq > 0 else 0.0

    return {
        "mae": mae,
        "mse": mse,
        "rmse": rmse,
        "rae": rae,
        "rrse": rrse,
    }


def build_method_payload(
    method_name: str,
    df: pd.DataFrame,
    used_features: List[str],
    labels: np.ndarray,
    metrics: Dict[str, float],
) -> Dict[str, object]:
    """Chuẩn hoá payload kết quả cho từng phương pháp gom cụm."""
    cluster_sizes = pd.Series(labels).value_counts().sort_index()
    return {
        "method": method_name,
        "used_features": used_features,
        "cluster_sizes": {
            str(key): int(value)
            for key, value in cluster_sizes.to_dict().items()
        },
        "final_metrics": metrics,
        "internal_evaluation": {
            "silhouette": metrics.get("silhouette"),
            "davies_bouldin": metrics.get("davies_bouldin"),
            "calinski_harabasz": metrics.get("calinski_harabasz"),
        },
        "external_evaluation": compute_external_metrics(df, labels),
        "overall_evaluation": {
            "n_rows": int(len(df)),
            "n_features": int(len(used_features)),
            "cluster_size_min": int(cluster_sizes.min()),
            "cluster_size_max": int(cluster_sizes.max()),
            "mae": metrics.get("mae"),
            "rmse": metrics.get("rmse"),
        },
    }

def evaluate_kmeans_candidates(
    scaled_array: np.ndarray,
    k_min: int = DEFAULT_K_RANGE[0],
    k_max: int = DEFAULT_K_RANGE[1],
    random_state: int = DEFAULT_RANDOM_STATE,
) -> Tuple[List[Dict[str, float]], int]:
    """
    Đánh giá KMeans với số cụm cố định k = 6.
    Không tìm k tối ưu.
    """
    fixed_k = 6

    if scaled_array.shape[0] < fixed_k:
        raise ValueError(f"Số dòng dữ liệu phải >= {fixed_k} để gom {fixed_k} cụm.")

    model = KMeans(
        n_clusters=fixed_k,
        random_state=random_state,
        n_init=DEFAULT_KMEANS_N_INIT,
    )

    labels = model.fit_predict(scaled_array)
    centroids = model.cluster_centers_
    reconstructed = centroids[labels]

    row = {
        "k": fixed_k,
        "inertia": float(model.inertia_),
        "cluster_size_min": int(pd.Series(labels).value_counts().min()),
        "cluster_size_max": int(pd.Series(labels).value_counts().max()),
    }

    row.update(compute_reconstruction_metrics(scaled_array, reconstructed))

    return [row], fixed_k

def fit_final_kmeans(
    scaled_array: np.ndarray,
    n_clusters: int,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> Tuple[KMeans, np.ndarray, Dict[str, float]]:
    """Huấn luyện K-Means cuối cùng và trả về các chỉ số đánh giá."""
    if scaled_array.shape[0] == 0:
        raise ValueError("Không có dữ liệu để gom cụm.")

    if scaled_array.shape[0] == 1:
        labels = np.zeros(1, dtype=int)
        dummy_model = KMeans(n_clusters=1, random_state=random_state, n_init=1)
        metrics = {
            "n_clusters": 1,
            "inertia": 0.0,
            "silhouette": float("nan"),
            "davies_bouldin": float("nan"),
            "calinski_harabasz": float("nan"),
            "mae": 0.0,
            "mse": 0.0,
            "rmse": 0.0,
            "rae": 0.0,
            "rrse": 0.0,
        }
        return dummy_model, labels, metrics

    model = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=DEFAULT_KMEANS_N_INIT)
    labels = model.fit_predict(scaled_array)
    reconstructed = model.cluster_centers_[labels]

    metrics = {
        "n_clusters": int(n_clusters),
        "inertia": float(model.inertia_),
        "silhouette": compute_sampled_silhouette_score(
            scaled_array,
            labels,
            sample_size=DEFAULT_SILHOUETTE_SAMPLE_SIZE,
            random_state=random_state,
        ) if len(np.unique(labels)) > 1 else float("nan"),
        "davies_bouldin": float(davies_bouldin_score(scaled_array, labels)) if len(np.unique(labels)) > 1 else float("nan"),
        "calinski_harabasz": float(calinski_harabasz_score(scaled_array, labels)) if len(np.unique(labels)) > 1 else float("nan"),
    }
    metrics.update(compute_reconstruction_metrics(scaled_array, reconstructed))
    return model, labels, metrics

def fit_final_minibatch_kmeans(
    scaled_array: np.ndarray,
    n_clusters: int,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> Tuple[MiniBatchKMeans, np.ndarray, Dict[str, float]]:
    """Huấn luyện MiniBatchKMeans và trả về các chỉ số đánh giá."""
    if scaled_array.shape[0] == 0:
        raise ValueError("Không có dữ liệu để gom cụm.")

    if scaled_array.shape[0] == 1:
        labels = np.zeros(1, dtype=int)
        dummy_model = MiniBatchKMeans(n_clusters=1, random_state=random_state)
        metrics = {
            "n_clusters": 1,
            "inertia": 0.0,
            "silhouette": float("nan"),
            "davies_bouldin": float("nan"),
            "calinski_harabasz": float("nan"),
            "mae": 0.0,
            "mse": 0.0,
            "rmse": 0.0,
            "rae": 0.0,
            "rrse": 0.0,
        }
        return dummy_model, labels, metrics

    model = MiniBatchKMeans(
        n_clusters=n_clusters,
        random_state=random_state,
        n_init=DEFAULT_KMEANS_N_INIT,
        batch_size=1024,
    )
    labels = model.fit_predict(scaled_array)
    reconstructed = model.cluster_centers_[labels]

    metrics = {
        "n_clusters": int(n_clusters),
        "inertia": float(model.inertia_),
        "silhouette": compute_sampled_silhouette_score(
            scaled_array,
            labels,
            sample_size=DEFAULT_SILHOUETTE_SAMPLE_SIZE,
            random_state=random_state,
        ) if len(np.unique(labels)) > 1 else float("nan"),
        "davies_bouldin": float(davies_bouldin_score(scaled_array, labels)) if len(np.unique(labels)) > 1 else float("nan"),
        "calinski_harabasz": float(calinski_harabasz_score(scaled_array, labels)) if len(np.unique(labels)) > 1 else float("nan"),
    }
    metrics.update(compute_reconstruction_metrics(scaled_array, reconstructed))
    return model, labels, metrics

def fit_final_gaussian_mixture(
    scaled_array: np.ndarray,
    n_clusters: int,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> Tuple[GaussianMixture, np.ndarray, Dict[str, float]]:
    """Huấn luyện Gaussian Mixture và trả về các chỉ số đánh giá."""
    if scaled_array.shape[0] == 0:
        raise ValueError("Không có dữ liệu để gom cụm.")

    if scaled_array.shape[0] == 1:
        labels = np.zeros(1, dtype=int)
        dummy_model = GaussianMixture(n_components=1, random_state=random_state)
        metrics = {
            "n_clusters": 1,
            "inertia": 0.0,
            "silhouette": float("nan"),
            "davies_bouldin": float("nan"),
            "calinski_harabasz": float("nan"),
            "mae": 0.0,
            "mse": 0.0,
            "rmse": 0.0,
            "rae": 0.0,
            "rrse": 0.0,
            "bic": float("nan"),
            "aic": float("nan"),
        }
        return dummy_model, labels, metrics

    model = GaussianMixture(
        n_components=n_clusters,
        covariance_type="full",
        random_state=random_state,
    )
    model.fit(scaled_array)
    labels = model.predict(scaled_array)

    means = model.means_
    reconstructed = means[labels]

    metrics = {
        "n_clusters": int(n_clusters),
        "inertia": float(np.sum(np.square(scaled_array - reconstructed))),
        "silhouette": compute_sampled_silhouette_score(
            scaled_array,
            labels,
            sample_size=DEFAULT_SILHOUETTE_SAMPLE_SIZE,
            random_state=random_state,
        ) if len(np.unique(labels)) > 1 else float("nan"),
        "davies_bouldin": float(davies_bouldin_score(scaled_array, labels)) if len(np.unique(labels)) > 1 else float("nan"),
        "calinski_harabasz": float(calinski_harabasz_score(scaled_array, labels)) if len(np.unique(labels)) > 1 else float("nan"),
        "bic": float(model.bic(scaled_array)),
        "aic": float(model.aic(scaled_array)),
    }
    metrics.update(compute_reconstruction_metrics(scaled_array, reconstructed))
    return model, labels, metrics
def fit_final_dbscan(
    scaled_array: np.ndarray,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> Tuple[DBSCAN, np.ndarray, Dict[str, float]]:
    """Huấn luyện DBSCAN và trả về các chỉ số đánh giá."""
    if scaled_array.shape[0] == 0:
        raise ValueError("Không có dữ liệu để gom cụm.")

    if scaled_array.shape[0] == 1:
        labels = np.zeros(1, dtype=int)
        dummy_model = DBSCAN(eps=0.5, min_samples=6)
        metrics = {
            "n_clusters": 1,
            "n_noise": 0,
            "inertia": 0.0,
            "silhouette": float("nan"),
            "davies_bouldin": float("nan"),
            "calinski_harabasz": float("nan"),
            "mae": 0.0,
            "mse": 0.0,
            "rmse": 0.0,
            "rae": 0.0,
            "rrse": 0.0,
            "eps": 0.5,
            "min_samples": 6,
        }
        return dummy_model, labels, metrics

    model = DBSCAN(eps=0.5, min_samples=6)
    labels = model.fit_predict(scaled_array)

    non_noise_mask = labels != -1
    unique_non_noise = np.unique(labels[non_noise_mask]) if np.any(non_noise_mask) else np.array([])
    n_clusters = int(len(unique_non_noise))
    n_noise = int((labels == -1).sum())

    if n_clusters == 0:
        reconstructed = np.zeros_like(scaled_array)
        metrics = {
            "n_clusters": 0,
            "n_noise": n_noise,
            "inertia": float(np.sum(np.square(scaled_array - reconstructed))),
            "silhouette": float("nan"),
            "davies_bouldin": float("nan"),
            "calinski_harabasz": float("nan"),
            "mae": float(np.mean(np.abs(scaled_array - reconstructed))),
            "mse": float(np.mean(np.square(scaled_array - reconstructed))),
            "rmse": float(math.sqrt(np.mean(np.square(scaled_array - reconstructed)))),
            "rae": 0.0,
            "rrse": 0.0,
            "eps": 0.5,
            "min_samples": 6,
        }
        return model, labels, metrics

    reconstructed = np.zeros_like(scaled_array)
    for cluster_id in unique_non_noise:
        cluster_mask = labels == cluster_id
        cluster_center = scaled_array[cluster_mask].mean(axis=0)
        reconstructed[cluster_mask] = cluster_center

    if n_noise > 0:
        reconstructed[labels == -1] = scaled_array[labels == -1]

    metrics = {
        "n_clusters": n_clusters,
        "n_noise": n_noise,
        "inertia": float(np.sum(np.square(scaled_array - reconstructed))),
        "silhouette": float("nan"),
        "davies_bouldin": float("nan"),
        "calinski_harabasz": float("nan"),
        "eps": 0.5,
        "min_samples": 6,
    }

    valid_metric_mask = labels != -1
    valid_metric_labels = labels[valid_metric_mask]
    valid_metric_array = scaled_array[valid_metric_mask]

    if valid_metric_array.shape[0] >= 2 and len(np.unique(valid_metric_labels)) > 1:
        metrics["silhouette"] = compute_sampled_silhouette_score(
            valid_metric_array,
            valid_metric_labels,
            sample_size=min(DEFAULT_SILHOUETTE_SAMPLE_SIZE, valid_metric_array.shape[0]),
            random_state=random_state,
        )
        metrics["davies_bouldin"] = float(davies_bouldin_score(valid_metric_array, valid_metric_labels))
        metrics["calinski_harabasz"] = float(calinski_harabasz_score(valid_metric_array, valid_metric_labels))

    metrics.update(compute_reconstruction_metrics(scaled_array, reconstructed))
    return model, labels, metrics
def fit_final_agglomerative(
    scaled_array: np.ndarray,
    n_clusters: int,
    random_state: int = DEFAULT_RANDOM_STATE,
    max_fit_samples: int = 20000,
) -> Tuple[AgglomerativeClustering, np.ndarray, Dict[str, float]]:
    """Huấn luyện Agglomerative Clustering an toàn RAM.

    Fit trên tập mẫu, sau đó gán toàn bộ dữ liệu về tâm cụm gần nhất.
    """
    if scaled_array.shape[0] == 0:
        raise ValueError("Không có dữ liệu để gom cụm.")

    if scaled_array.shape[0] == 1:
        labels = np.zeros(1, dtype=int)
        dummy_model = AgglomerativeClustering(n_clusters=1)
        metrics = {
            "n_clusters": 1,
            "fit_samples": 1,
            "inertia": 0.0,
            "silhouette": float("nan"),
            "davies_bouldin": float("nan"),
            "calinski_harabasz": float("nan"),
            "mae": 0.0,
            "mse": 0.0,
            "rmse": 0.0,
            "rae": 0.0,
            "rrse": 0.0,
        }
        return dummy_model, labels, metrics

    rng = np.random.default_rng(random_state)

    if scaled_array.shape[0] > max_fit_samples:
        sample_indices = rng.choice(
            scaled_array.shape[0],
            size=max_fit_samples,
            replace=False,
        )
        fit_array = scaled_array[sample_indices]
    else:
        fit_array = scaled_array

    n_clusters = min(n_clusters, fit_array.shape[0])

    model = AgglomerativeClustering(
        n_clusters=n_clusters,
        linkage="ward",
    )

    sample_labels = model.fit_predict(fit_array)

    unique_labels = sorted(np.unique(sample_labels))
    cluster_centers = np.array([
        fit_array[sample_labels == cluster_id].mean(axis=0)
        for cluster_id in unique_labels
    ])

    distances = np.linalg.norm(
        scaled_array[:, np.newaxis, :] - cluster_centers[np.newaxis, :, :],
        axis=2,
    )

    labels = np.argmin(distances, axis=1)
    reconstructed = cluster_centers[labels]

    metrics = {
        "n_clusters": int(len(unique_labels)),
        "fit_samples": int(fit_array.shape[0]),
        "inertia": float(np.sum(np.square(scaled_array - reconstructed))),
        "silhouette": compute_sampled_silhouette_score(
            scaled_array,
            labels,
            sample_size=DEFAULT_SILHOUETTE_SAMPLE_SIZE,
            random_state=random_state,
        ) if len(np.unique(labels)) > 1 else float("nan"),
        "davies_bouldin": float(davies_bouldin_score(scaled_array, labels)) if len(np.unique(labels)) > 1 else float("nan"),
        "calinski_harabasz": float(calinski_harabasz_score(scaled_array, labels)) if len(np.unique(labels)) > 1 else float("nan"),
    }

    metrics.update(compute_reconstruction_metrics(scaled_array, reconstructed))

    return model, labels, metrics
def save_kmeans_evaluation_figures(
    evaluation_df: pd.DataFrame,
    output_dir: Path,
) -> List[str]:
    """Lưu các figure đánh giá K-Means."""
    return []
def run_kmeans_clustering_pipeline(
    df: pd.DataFrame,
    base_output_dir: Path,
    feature_columns: List[str],
    k_min: int = DEFAULT_K_RANGE[0],
    k_max: int = DEFAULT_K_RANGE[1],
    random_state: int = DEFAULT_RANDOM_STATE,
) -> Dict[str, object]:
    """Thực hiện KMeans, MiniBatchKMeans, Gaussian Mixture và DBSCAN, lưu dữ liệu đầu ra, figure và metrics."""
    output_dir = base_output_dir / CLUSTERING_OUTPUT_DIRNAME
    output_dir.mkdir(parents=True, exist_ok=True)

    _, scaled_array, used_features = prepare_features_for_kmeans(df, feature_columns)

    if not used_features:
        clustered_df = df.copy()
        clustered_df["cluster_kmeans"] = pd.NA
        clustered_df["cluster_minibatch_kmeans"] = pd.NA
        clustered_df["cluster_gaussian_mixture"] = pd.NA
        clustered_df["cluster_dbscan"] = pd.NA
        clustered_csv_path = output_dir / "traffic_clustered_kmeans.csv"
        clustered_df.to_csv(clustered_csv_path, index=False)

        empty_metrics = {
            "selected_k": None,
            "used_features": [],
            "final_metrics": {},
            "candidate_metrics": [],
            "figure_paths": [],
            "clustered_csv_path": str(clustered_csv_path),
            "evaluation_csv_path": str(output_dir / "clustering_metrics.csv"),
            "comparison_csv_path": str(output_dir / "clustering_methods_comparison.csv"),
            "internal_evaluation": {},
            "external_evaluation": {},
            "overall_evaluation": {},
            "methods_comparison": {},
        }

        save_json(empty_metrics, output_dir / "clustering_metrics.json")
        pd.DataFrame().to_csv(output_dir / "clustering_metrics.csv", index=False)
        pd.DataFrame().to_csv(output_dir / "clustering_methods_comparison.csv", index=False)
        return empty_metrics

    evaluation_rows, best_k = evaluate_kmeans_candidates(
        scaled_array,
        k_min=k_min,
        k_max=k_max,
        random_state=random_state,
    )
    evaluation_df = pd.DataFrame(evaluation_rows)

    figure_paths = save_kmeans_evaluation_figures(evaluation_df, output_dir)

    print(f"[CLUSTERING] Dang fit KMeans voi k co dinh = {best_k}")
    _, kmeans_labels, kmeans_metrics = fit_final_kmeans(
        scaled_array,
        n_clusters=best_k,
        random_state=random_state,
    )

    print(f"[CLUSTERING] Dang fit MiniBatchKMeans voi k co dinh = {best_k}")
    _, minibatch_labels, minibatch_metrics = fit_final_minibatch_kmeans(
        scaled_array,
        n_clusters=best_k,
        random_state=random_state,
    )

    print(f"[CLUSTERING] Dang fit GaussianMixture voi k co dinh = {best_k}")
    _, gaussian_labels, gaussian_metrics = fit_final_gaussian_mixture(
        scaled_array,
        n_clusters=best_k,
        random_state=random_state,
    )

    print("[CLUSTERING] Dang fit DBSCAN voi eps = 0.5, min_samples = 6")
    _, dbscan_labels, dbscan_metrics = fit_final_dbscan(
        scaled_array,
        random_state=random_state,
    )
    print(f"[CLUSTERING] Dang fit AgglomerativeClustering voi k co dinh = {best_k}")
    _, agglomerative_labels, agglomerative_metrics = fit_final_agglomerative(
        scaled_array,
        n_clusters=best_k,
        random_state=random_state,
    )
    clustered_df = df.copy()
    clustered_df["cluster_kmeans"] = kmeans_labels
    clustered_df["cluster_label"] = clustered_df["cluster_kmeans"].apply(lambda x: f"Cluster_{int(x)}")

    clustered_df["cluster_minibatch_kmeans"] = minibatch_labels
    clustered_df["cluster_label_minibatch"] = clustered_df["cluster_minibatch_kmeans"].apply(
        lambda x: f"MiniBatchCluster_{int(x)}"
    )

    clustered_df["cluster_gaussian_mixture"] = gaussian_labels
    clustered_df["cluster_label_gaussian"] = clustered_df["cluster_gaussian_mixture"].apply(
        lambda x: f"GaussianCluster_{int(x)}"
    )

    clustered_df["cluster_dbscan"] = dbscan_labels
    clustered_df["cluster_label_dbscan"] = clustered_df["cluster_dbscan"].apply(
        lambda x: "DBSCAN_Noise" if int(x) == -1 else f"DBSCANCluster_{int(x)}"
    )
    clustered_df["cluster_agglomerative"] = agglomerative_labels
    clustered_df["cluster_label_agglomerative"] = clustered_df["cluster_agglomerative"].apply(
        lambda x: f"AgglomerativeCluster_{int(x)}"
    )

    visualization_paths = save_cluster_visualizations(df, kmeans_labels, output_dir)
    clustered_csv_path = output_dir / "traffic_clustered_kmeans.csv"
    clustered_df.to_csv(clustered_csv_path, index=False)

    evaluation_csv_path = output_dir / "clustering_metrics.csv"
    evaluation_df.to_csv(evaluation_csv_path, index=False)

    kmeans_summary = build_method_payload("KMeans", df, used_features, kmeans_labels, kmeans_metrics)
    minibatch_summary = build_method_payload("MiniBatchKMeans", df, used_features, minibatch_labels, minibatch_metrics)
    gaussian_summary = build_method_payload("GaussianMixture", df, used_features, gaussian_labels, gaussian_metrics)
    dbscan_summary = build_method_payload("DBSCAN", df, used_features, dbscan_labels, dbscan_metrics)
    agglomerative_summary = build_method_payload(
        "AgglomerativeClustering",
        df,
        used_features,
        agglomerative_labels,
        agglomerative_metrics,
    )
    
    methods_summary = {
        "kmeans": kmeans_summary,
        "minibatch_kmeans": minibatch_summary,
        "gaussian_mixture": gaussian_summary,
        "dbscan": dbscan_summary,
        "agglomerative": agglomerative_summary,
    }

    metrics_payload = {
        "selected_k": int(best_k),
        "used_features": used_features,
        "cluster_sizes": kmeans_summary["cluster_sizes"],
        "final_metrics": kmeans_summary["final_metrics"],
        "internal_evaluation": kmeans_summary["internal_evaluation"],
        "external_evaluation": kmeans_summary["external_evaluation"],
        "overall_evaluation": kmeans_summary["overall_evaluation"],
        "candidate_metrics": evaluation_rows,
        "figure_paths": figure_paths + visualization_paths,
        "clustered_csv_path": str(clustered_csv_path),
        "evaluation_csv_path": str(evaluation_csv_path),
        "methods_comparison": methods_summary,
    }

    comparison_rows = [
        {
            "method": kmeans_summary["method"],
            "silhouette": kmeans_summary["internal_evaluation"].get("silhouette"),
            "davies_bouldin": kmeans_summary["internal_evaluation"].get("davies_bouldin"),
            "calinski_harabasz": kmeans_summary["internal_evaluation"].get("calinski_harabasz"),
            "ari": kmeans_summary["external_evaluation"].get("ari") if kmeans_summary["external_evaluation"] else None,
            "nmi": kmeans_summary["external_evaluation"].get("nmi") if kmeans_summary["external_evaluation"] else None,
            "f_measure": kmeans_summary["external_evaluation"].get("f_measure") if kmeans_summary["external_evaluation"] else None,
            "entropy": kmeans_summary["external_evaluation"].get("entropy") if kmeans_summary["external_evaluation"] else None,
            "mae": kmeans_summary["overall_evaluation"].get("mae"),
            "rmse": kmeans_summary["overall_evaluation"].get("rmse"),
            "cluster_size_min": kmeans_summary["overall_evaluation"].get("cluster_size_min"),
            "cluster_size_max": kmeans_summary["overall_evaluation"].get("cluster_size_max"),
        },
        {
            "method": minibatch_summary["method"],
            "silhouette": minibatch_summary["internal_evaluation"].get("silhouette"),
            "davies_bouldin": minibatch_summary["internal_evaluation"].get("davies_bouldin"),
            "calinski_harabasz": minibatch_summary["internal_evaluation"].get("calinski_harabasz"),
            "ari": minibatch_summary["external_evaluation"].get("ari") if minibatch_summary["external_evaluation"] else None,
            "nmi": minibatch_summary["external_evaluation"].get("nmi") if minibatch_summary["external_evaluation"] else None,
            "f_measure": minibatch_summary["external_evaluation"].get("f_measure") if minibatch_summary["external_evaluation"] else None,
            "entropy": minibatch_summary["external_evaluation"].get("entropy") if minibatch_summary["external_evaluation"] else None,
            "mae": minibatch_summary["overall_evaluation"].get("mae"),
            "rmse": minibatch_summary["overall_evaluation"].get("rmse"),
            "cluster_size_min": minibatch_summary["overall_evaluation"].get("cluster_size_min"),
            "cluster_size_max": minibatch_summary["overall_evaluation"].get("cluster_size_max"),
        },
        {
            "method": gaussian_summary["method"],
            "silhouette": gaussian_summary["internal_evaluation"].get("silhouette"),
            "davies_bouldin": gaussian_summary["internal_evaluation"].get("davies_bouldin"),
            "calinski_harabasz": gaussian_summary["internal_evaluation"].get("calinski_harabasz"),
            "ari": gaussian_summary["external_evaluation"].get("ari") if gaussian_summary["external_evaluation"] else None,
            "nmi": gaussian_summary["external_evaluation"].get("nmi") if gaussian_summary["external_evaluation"] else None,
            "f_measure": gaussian_summary["external_evaluation"].get("f_measure") if gaussian_summary["external_evaluation"] else None,
            "entropy": gaussian_summary["external_evaluation"].get("entropy") if gaussian_summary["external_evaluation"] else None,
            "mae": gaussian_summary["overall_evaluation"].get("mae"),
            "rmse": gaussian_summary["overall_evaluation"].get("rmse"),
            "cluster_size_min": gaussian_summary["overall_evaluation"].get("cluster_size_min"),
            "cluster_size_max": gaussian_summary["overall_evaluation"].get("cluster_size_max"),
        },
        {
            "method": dbscan_summary["method"],
            "silhouette": dbscan_summary["internal_evaluation"].get("silhouette"),
            "davies_bouldin": dbscan_summary["internal_evaluation"].get("davies_bouldin"),
            "calinski_harabasz": dbscan_summary["internal_evaluation"].get("calinski_harabasz"),
            "ari": dbscan_summary["external_evaluation"].get("ari") if dbscan_summary["external_evaluation"] else None,
            "nmi": dbscan_summary["external_evaluation"].get("nmi") if dbscan_summary["external_evaluation"] else None,
            "f_measure": dbscan_summary["external_evaluation"].get("f_measure") if dbscan_summary["external_evaluation"] else None,
            "entropy": dbscan_summary["external_evaluation"].get("entropy") if dbscan_summary["external_evaluation"] else None,
            "mae": dbscan_summary["overall_evaluation"].get("mae"),
            "rmse": dbscan_summary["overall_evaluation"].get("rmse"),
            "cluster_size_min": dbscan_summary["overall_evaluation"].get("cluster_size_min"),
            "cluster_size_max": dbscan_summary["overall_evaluation"].get("cluster_size_max"),
        },
        {
            "method": agglomerative_summary["method"],
            "silhouette": agglomerative_summary["internal_evaluation"].get("silhouette"),
            "davies_bouldin": agglomerative_summary["internal_evaluation"].get("davies_bouldin"),
            "calinski_harabasz": agglomerative_summary["internal_evaluation"].get("calinski_harabasz"),
            "ari": agglomerative_summary["external_evaluation"].get("ari") if agglomerative_summary["external_evaluation"] else None,
            "nmi": agglomerative_summary["external_evaluation"].get("nmi") if agglomerative_summary["external_evaluation"] else None,
            "f_measure": agglomerative_summary["external_evaluation"].get("f_measure") if agglomerative_summary["external_evaluation"] else None,
            "entropy": agglomerative_summary["external_evaluation"].get("entropy") if agglomerative_summary["external_evaluation"] else None,
            "mae": agglomerative_summary["overall_evaluation"].get("mae"),
            "rmse": agglomerative_summary["overall_evaluation"].get("rmse"),
            "cluster_size_min": agglomerative_summary["overall_evaluation"].get("cluster_size_min"),
            "cluster_size_max": agglomerative_summary["overall_evaluation"].get("cluster_size_max"),
        },
    ]

    comparison_df = pd.DataFrame(comparison_rows)
    comparison_csv_path = output_dir / "clustering_methods_comparison.csv"
    comparison_df.to_csv(comparison_csv_path, index=False)
    metrics_payload["comparison_csv_path"] = str(comparison_csv_path)

    save_json(metrics_payload, output_dir / "clustering_metrics.json")
    print("[CLUSTERING] Hoan tat KMeans, MiniBatchKMeans, GaussianMixture va DBSCAN")
    return metrics_payload