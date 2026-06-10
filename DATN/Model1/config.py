from __future__ import annotations

import numpy as np


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

SPEED_CLUSTER_LABELS = ["A", "B", "C", "D", "E", "F"]

SPEED_CLUSTER_BINS = [-np.inf, 10.0, 25.0, 30.0, 40.0, 60.0, np.inf]

SPEED_CLUSTER_RULE_DEFINITION = {
    "A": "<= 10 km/h",
    "B": "> 10 và <= 25 km/h",
    "C": "> 25 và <= 30 km/h",
    "D": "> 30 và <= 40 km/h",
    "E": "> 40 và <= 60 km/h",
    "F": "> 60 km/h",
}

DEFAULT_K_RANGE = (6, 6)
CLUSTERING_OUTPUT_DIRNAME = "clustering_outputs"
DEFAULT_RANDOM_STATE = 42
DEFAULT_KMEANS_N_INIT = 20
DEFAULT_FIGURE_DPI = 200
DEFAULT_SILHOUETTE_SAMPLE_SIZE = 5000