from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Tuple

import argparse
import json
import math
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.metrics import davies_bouldin_score, silhouette_score
from sklearn.preprocessing import StandardScaler


# Các giá trị thường được xem là khuyết trong file CSV giao thông
MISSING_TOKENS = {
    "",
    " ",
    "na",
    "n/a",
    "nan",
    "null",
    "none",
    "unknown",
    "[]",
    "{}",
    "-",
}


# Các cột thời gian / định danh thường không nên nội suy như feature phân cụm
DEFAULT_EXCLUDE_FROM_IMPUTE = {
    "segmentId",
    "name_vn",
    "ref",
    "timeStamp",
    "weather_date",
    "time",
    "sunrise",
    "sunset",
    "weathercode_unit",
    "temperature_2m_max_unit",
    "temperature_2m_min_unit",
    "apparent_temperature_max_unit",
    "apparent_temperature_min_unit",
    "sunrise_unit",
    "sunset_unit",
    "precipitation_sum_unit",
    "precipitation_probability_max_unit",
    "windspeed_10m_max_unit",
    "windgusts_10m_max_unit",
    "winddirection_10m_dominant_unit",
    "time_unit",
}


# Các cột không phù hợp để đưa trực tiếp vào phân cụm
# vì chỉ mang tính định danh, mô tả, đơn vị đo hoặc thời gian gốc
NON_CLUSTER_COLUMNS = {
    "segmentId",
    "name_vn",
    "surface",
    "oneway",
    "dayType",
    "LOS",
    "weather_date",
    "weather_description",
    "sunrise",
    "sunset",
    "time",
    "weathercode_unit",
    "temperature_2m_max_unit",
    "temperature_2m_min_unit",
    "apparent_temperature_max_unit",
    "apparent_temperature_min_unit",
    "sunrise_unit",
    "sunset_unit",
    "precipitation_sum_unit",
    "precipitation_probability_max_unit",
    "windspeed_10m_max_unit",
    "windgusts_10m_max_unit",
    "winddirection_10m_dominant_unit",
    "time_unit",
}


# Các cột mong muốn chuyển sang số nếu có thể
NUMERIC_HINT_COLUMNS = {
    "lat_start",
    "lon_start",
    "lat_end",
    "lon_end",
    "laneCount_aggregated",
    "speedLimit",
    "curvatureIndex",
    "bearing",
    "lengthKm",
    "intersectionCount",
    "routeSlopePercent",
    "startElevation",
    "endElevation",
    "timeStamp",
    "dayOfWeek",
    "hourOfDay",
    "currentSpeed",
    "freeFlowSpeed",
    "jamFactor",
    "incidentFlag",
    "congestionIndex",
    "trafficVolume",
    "occupancy",
    "crossTime",
    "speedLimitRatio",
    "relativeCongestionIndex",
    "route_distance_m",
    "route_duration_sec",
    "route_weight",
    "map_match_confidence",
    "latitude_lookup",
    "longitude_lookup",
    "weathercode",
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "uv_index_max",
    "precipitation_sum",
    "precipitation_probability_max",
    "windspeed_10m_max",
    "windgusts_10m_max",
    "winddirection_10m_dominant",
}


# Các cột hữu ích cho phân cụm giao thông nếu tồn tại sau bước tiền xử lí
SUGGESTED_CLUSTER_COLUMNS = [
    "laneCount_aggregated",
    "speedLimit",
    "curvatureIndex",
    "lengthKm",
    "intersectionCount",
    "routeSlopePercent",
    "currentSpeed",
    "freeFlowSpeed",
    "congestionIndex",
    "trafficVolume",
    "occupancy",
    "crossTime",
    "speedLimitRatio",
    "relativeCongestionIndex",
    "route_distance_m",
    "route_duration_sec",
    "route_weight",
    "map_match_confidence",
    "weathercode",
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "uv_index_max",
    "precipitation_sum",
    "precipitation_probability_max",
    "windspeed_10m_max",
    "windgusts_10m_max",
    "winddirection_10m_dominant",
]

# Giả định cụm theo ngưỡng vận tốc trung bình (km/h)
# A: rất chậm / ùn tắc nặng
# F: rất nhanh / lưu thông tốt
SPEED_CLUSTER_LABELS = ["A", "B", "C", "D", "E", "F"]
SPEED_CLUSTER_BINS = [-np.inf, 10.0, 25.0, 30.0, 40.0, 60.0, np.inf]


CLUSTERING_OUTPUT_DIRNAME = "clustering_outputs"
DEFAULT_K_RANGE = (2, 6)


def load_raw_data(csv_path: Path) -> pd.DataFrame:
    """Đọc dữ liệu gốc và chuẩn hóa các token khuyết phổ biến."""
    df = pd.read_csv(csv_path, low_memory=False)
    df.columns = [col.strip() for col in df.columns]

    object_cols = df.select_dtypes(include=["object"]).columns
    for col in object_cols:
        df[col] = df[col].astype(str).str.strip()
        df[col] = df[col].replace(list(MISSING_TOKENS), np.nan)

    return df


def standardize_types(df: pd.DataFrame) -> pd.DataFrame:
    """Ép kiểu cột số và thời gian khi phù hợp."""
    df = df.copy()

    for col in df.columns:
        if col in NUMERIC_HINT_COLUMNS:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    datetime_candidates = ["weather_date", "time", "sunrise", "sunset"]
    for col in datetime_candidates:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    return df


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


def identify_low_value_columns(
    df: pd.DataFrame,
    zero_ratio_threshold: float = 0.9,
    dominant_ratio_threshold: float = 0.9,
    min_unique_numeric: int = 1,
) -> Tuple[List[str], Dict[str, str], pd.Series, pd.Series]:
    """
    Xác định các cột ít giá trị ứng dụng cho bài toán phân cụm.

    Nhóm cột bị xem là low-value:
    - Cột thuộc danh sách NON_CLUSTER_COLUMNS
    - Cột chỉ có 1 giá trị duy nhất (constant)
    - Cột số có tỉ lệ 0 quá cao
    - Cột có một giá trị chiếm ưu thế gần như toàn bộ
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


def assign_rule_based_speed_cluster(
    df: pd.DataFrame,
    speed_column: str = "currentSpeed",
    output_column: str = "speed_cluster_rule",
) -> pd.DataFrame:
    """
    Gán cụm giả định theo bảng phân loại vận tốc:
    A: <= 10
    B: > 10 và <= 25
    C: > 25 và <= 30
    D: > 30 và <= 40
    E: > 40 và <= 60
    F: > 60
    """
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



def evaluate_kmeans_candidates(
    scaled_array: np.ndarray,
    k_min: int = 2,
    k_max: int = 6,
    random_state: int = 42,
) -> Tuple[List[Dict[str, float]], int]:
    """Đánh giá nhiều giá trị k để chọn số cụm phù hợp."""
    if scaled_array.shape[0] < 2:
        return [], 1

    max_valid_k = min(k_max, scaled_array.shape[0] - 1)
    if max_valid_k < k_min:
        max_valid_k = k_min

    evaluation_rows: List[Dict[str, float]] = []

    for k in range(k_min, max_valid_k + 1):
        model = KMeans(n_clusters=k, random_state=random_state, n_init=20)
        labels = model.fit_predict(scaled_array)
        centroids = model.cluster_centers_
        reconstructed = centroids[labels]

        row: Dict[str, float] = {
            "k": int(k),
            "inertia": float(model.inertia_),
            "cluster_size_min": int(pd.Series(labels).value_counts().min()),
            "cluster_size_max": int(pd.Series(labels).value_counts().max()),
        }

        if len(np.unique(labels)) > 1:
            row["silhouette"] = float(silhouette_score(scaled_array, labels))
            row["davies_bouldin"] = float(davies_bouldin_score(scaled_array, labels))
        else:
            row["silhouette"] = float("nan")
            row["davies_bouldin"] = float("nan")

        row.update(compute_reconstruction_metrics(scaled_array, reconstructed))
        evaluation_rows.append(row)

    if not evaluation_rows:
        return [], 1

    best_row = max(
        evaluation_rows,
        key=lambda item: (
            -float("inf") if math.isnan(float(item.get("silhouette", float("nan")))) else float(item["silhouette"]),
            -float(item["davies_bouldin"]),
        ),
    )
    return evaluation_rows, int(best_row["k"])



def fit_final_kmeans(
    scaled_array: np.ndarray,
    n_clusters: int,
    random_state: int = 42,
) -> Tuple[KMeans, np.ndarray, Dict[str, float]]:
    """Huấn luyện K-Means cuối cùng và trả về các chỉ số đánh giá."""
    if scaled_array.shape[0] == 0:
        raise ValueError("Không có dữ liệu để gom cụm.")

    if scaled_array.shape[0] == 1:
        labels = np.zeros(1, dtype=int)
        metrics = {
            "n_clusters": 1,
            "inertia": 0.0,
            "silhouette": float("nan"),
            "davies_bouldin": float("nan"),
            "mae": 0.0,
            "mse": 0.0,
            "rmse": 0.0,
            "rae": 0.0,
            "rrse": 0.0,
        }
        dummy_model = KMeans(n_clusters=1, random_state=random_state, n_init=1)
        return dummy_model, labels, metrics

    model = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=20)
    labels = model.fit_predict(scaled_array)
    reconstructed = model.cluster_centers_[labels]

    metrics = {
        "n_clusters": int(n_clusters),
        "inertia": float(model.inertia_),
        "silhouette": float(silhouette_score(scaled_array, labels)) if len(np.unique(labels)) > 1 else float("nan"),
        "davies_bouldin": float(davies_bouldin_score(scaled_array, labels)) if len(np.unique(labels)) > 1 else float("nan"),
    }
    metrics.update(compute_reconstruction_metrics(scaled_array, reconstructed))
    return model, labels, metrics



def save_kmeans_evaluation_figures(
    evaluation_df: pd.DataFrame,
    output_dir: Path,
) -> List[str]:
    """Lưu các figure đánh giá K-Means."""
    figure_paths: List[str] = []

    if evaluation_df.empty:
        return figure_paths

    x_values = evaluation_df["k"]

    # Elbow / inertia
    plt.figure(figsize=(8, 5))
    plt.plot(x_values, evaluation_df["inertia"], marker="o")
    plt.title("Elbow Method - Inertia theo so cum")
    plt.xlabel("So cum k")
    plt.ylabel("Inertia")
    plt.grid(True, alpha=0.3)
    elbow_path = output_dir / "figure_elbow_inertia.png"
    plt.tight_layout()
    plt.savefig(elbow_path, dpi=200)
    plt.close()
    figure_paths.append(str(elbow_path))

    # Silhouette
    if "silhouette" in evaluation_df.columns:
        plt.figure(figsize=(8, 5))
        plt.plot(x_values, evaluation_df["silhouette"], marker="o")
        plt.title("Silhouette Score theo so cum")
        plt.xlabel("So cum k")
        plt.ylabel("Silhouette")
        plt.grid(True, alpha=0.3)
        silhouette_path = output_dir / "figure_silhouette.png"
        plt.tight_layout()
        plt.savefig(silhouette_path, dpi=200)
        plt.close()
        figure_paths.append(str(silhouette_path))

    # Davies-Bouldin
    if "davies_bouldin" in evaluation_df.columns:
        plt.figure(figsize=(8, 5))
        plt.plot(x_values, evaluation_df["davies_bouldin"], marker="o")
        plt.title("Davies-Bouldin Score theo so cum")
        plt.xlabel("So cum k")
        plt.ylabel("Davies-Bouldin")
        plt.grid(True, alpha=0.3)
        dbi_path = output_dir / "figure_davies_bouldin.png"
        plt.tight_layout()
        plt.savefig(dbi_path, dpi=200)
        plt.close()
        figure_paths.append(str(dbi_path))

    # RAE/RMSE
    plt.figure(figsize=(8, 5))
    plt.plot(x_values, evaluation_df["rae"], marker="o", label="RAE")
    plt.plot(x_values, evaluation_df["rmse"], marker="o", label="RMSE")
    plt.title("RAE va RMSE theo so cum")
    plt.xlabel("So cum k")
    plt.ylabel("Gia tri")
    plt.legend()
    plt.grid(True, alpha=0.3)
    error_path = output_dir / "figure_error_metrics.png"
    plt.tight_layout()
    plt.savefig(error_path, dpi=200)
    plt.close()
    figure_paths.append(str(error_path))

    return figure_paths



def run_kmeans_clustering_pipeline(
    df: pd.DataFrame,
    base_output_dir: Path,
    feature_columns: List[str],
    k_min: int = DEFAULT_K_RANGE[0],
    k_max: int = DEFAULT_K_RANGE[1],
    random_state: int = 42,
) -> Dict[str, object]:
    """Thực hiện K-Means, lưu dữ liệu đầu ra, figure và metrics."""
    output_dir = base_output_dir / CLUSTERING_OUTPUT_DIRNAME
    output_dir.mkdir(parents=True, exist_ok=True)

    prepared_df, scaled_array, used_features = prepare_features_for_kmeans(df, feature_columns)

    if not used_features:
        clustered_df = df.copy()
        clustered_df["cluster_kmeans"] = pd.NA
        clustered_csv_path = output_dir / "traffic_clustered_kmeans.csv"
        clustered_df.to_csv(clustered_csv_path, index=False)

        empty_metrics = {
            "selected_k": None,
            "used_features": [],
            "final_metrics": {},
            "candidate_metrics": [],
            "figure_paths": [],
            "clustered_csv_path": str(clustered_csv_path),
        }

        with open(output_dir / "clustering_metrics.json", "w", encoding="utf-8") as f:
            json.dump(empty_metrics, f, ensure_ascii=False, indent=2)

        pd.DataFrame().to_csv(output_dir / "clustering_metrics.csv", index=False)
        return empty_metrics

    evaluation_rows, best_k = evaluate_kmeans_candidates(
        scaled_array,
        k_min=k_min,
        k_max=k_max,
        random_state=random_state,
    )
    evaluation_df = pd.DataFrame(evaluation_rows)

    figure_paths = save_kmeans_evaluation_figures(evaluation_df, output_dir)

    final_model, labels, final_metrics = fit_final_kmeans(
        scaled_array,
        n_clusters=best_k,
        random_state=random_state,
    )

    clustered_df = df.copy()
    clustered_df["cluster_kmeans"] = labels
    clustered_df["cluster_label"] = clustered_df["cluster_kmeans"].apply(lambda x: f"Cluster_{int(x)}")

    clustered_csv_path = output_dir / "traffic_clustered_kmeans.csv"
    clustered_df.to_csv(clustered_csv_path, index=False)

    evaluation_csv_path = output_dir / "clustering_metrics.csv"
    evaluation_df.to_csv(evaluation_csv_path, index=False)

    metrics_payload = {
        "selected_k": int(best_k),
        "used_features": used_features,
        "cluster_sizes": {
            str(key): int(value)
            for key, value in clustered_df["cluster_kmeans"].value_counts().sort_index().to_dict().items()
        },
        "final_metrics": final_metrics,
        "candidate_metrics": evaluation_rows,
        "figure_paths": figure_paths,
        "clustered_csv_path": str(clustered_csv_path),
        "evaluation_csv_path": str(evaluation_csv_path),
    }

    with open(output_dir / "clustering_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, ensure_ascii=False, indent=2)

    return metrics_payload


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

    summary = {
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
        "speed_cluster_rule_distribution": speed_cluster_distribution,
        "speed_cluster_rule_definition": {
            "A": "<= 10 km/h",
            "B": "> 10 và <= 25 km/h",
            "C": "> 25 và <= 30 km/h",
            "D": "> 30 và <= 40 km/h",
            "E": "> 40 và <= 60 km/h",
            "F": "> 60 km/h",
        },
        "kmeans_clustering": clustering_results,
    }
    return summary


def preprocess_traffic_data(
    input_csv: Path,
    output_csv: Path,
    summary_json: Path,
    missing_threshold: float = 0.9,
    zero_ratio_threshold: float = 0.9,
    dominant_ratio_threshold: float = 0.9,
) -> Tuple[pd.DataFrame, Dict[str, object]]:
    """Pipeline tiền xử lí chính cho bài toán phân cụm giao thông."""
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

    filtered_df, dropped_low_value_columns, low_value_reasons, zero_ratio_after_impute, dominant_ratio_after_impute = drop_low_value_columns(
        imputed_df,
        zero_ratio_threshold=zero_ratio_threshold,
        dominant_ratio_threshold=dominant_ratio_threshold,
    )

    processed_df = assign_rule_based_speed_cluster(
        filtered_df,
        speed_column="currentSpeed",
        output_column="speed_cluster_rule",
    )

    clustering_results = run_kmeans_clustering_pipeline(
        processed_df,
        base_output_dir=output_csv.parent,
        feature_columns=[
            col for col in SUGGESTED_CLUSTER_COLUMNS
            if col in processed_df.columns
        ],
        k_min=DEFAULT_K_RANGE[0],
        k_max=DEFAULT_K_RANGE[1],
        random_state=42,
    )

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
    )

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    summary_json.parent.mkdir(parents=True, exist_ok=True)

    processed_df.to_csv(output_csv, index=False)
    with open(summary_json, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2, default=str)

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