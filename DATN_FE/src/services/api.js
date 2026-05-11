import axios from 'axios';
import { fetchGoogleRoute, fetchRoadRoute } from '../utils/routing';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const dssApi = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const SAMPLE_TRAFFIC_INPUT = {
  segment_name: 'Vo Van Kiet - Q1',
  current_speed: 14,
  free_flow_speed: 42,
  density: 78,
  weather: 'rain',
  incident_count: 2,
  timestamp: new Date().toISOString(),
};

export const SAMPLE_ROUTE_INPUT = {
  origin: {
    name: 'Bến Thành, Quận 1, TP.HCM',
    lat: 10.772546,
    lon: 106.698199,
  },
  destination: {
    name: 'Sân bay Tân Sơn Nhất, TP.HCM',
    lat: 10.818889,
    lon: 106.651944,
  },
};

export const SAMPLE_PREDICT_RESPONSE = {
  predicted_congestion: 'HIGH',
  predicted_speed: 18,
  risk_score: 84,
  eta: 1200,
  recommended_action: 'CHANGE_ROUTE',
  confidence: 0.9,
};

export const SAMPLE_RECOMMEND_ROUTE_RESPONSE = {
  best_route: {
    id: 'route-best-1',
    name: 'Tran Hung Dao -> Nguyen Van Cu',
    eta: 1080,
    distance_km: 6.8,
    coordinates: [
      [10.7638, 106.6818],
      [10.7655, 106.6865],
      [10.7692, 106.692],
      [10.772, 106.698],
    ],
    congestion_level: 'MEDIUM',
  },
  alternatives: [
    {
      id: 'route-alt-1',
      name: 'Vo Van Kiet -> Nguyen Thai Hoc',
      eta: 1320,
      distance_km: 7.4,
      coordinates: [
        [10.7638, 106.6818],
        [10.7612, 106.6884],
        [10.7667, 106.6959],
        [10.772, 106.698],
      ],
      congestion_level: 'HIGH',
    },
    {
      id: 'route-alt-2',
      name: 'Ham Nghi -> Ton Duc Thang',
      eta: 1260,
      distance_km: 7.1,
      coordinates: [
        [10.7638, 106.6818],
        [10.7671, 106.6832],
        [10.7709, 106.6928],
        [10.772, 106.698],
      ],
      congestion_level: 'MEDIUM',
    },
  ],
};

export const SAMPLE_TRAFFIC_STATUS_RESPONSE = {
  congestion_level: 'MEDIUM',
  alerts: [
    'Peak-hour pressure in District 1.',
    'Rain impact expected in central corridor.',
  ],
};

export const SAMPLE_DETECT_INCIDENT_RESPONSE = {
  incident_risk: true,
  anomaly_score: 0.85,
};

export const SAMPLE_ROUTE_RECOMMENDATION_RESPONSE = {
  best_route: {
    id: 'route-best-1',
    name: `${SAMPLE_ROUTE_INPUT.origin.name} → ${SAMPLE_ROUTE_INPUT.destination.name}`,
    eta: 1680,
    distance_km: 8.9,
    distance_text: '8.9 km',
    duration_text: '28 mins',
    source: 'google',
    coordinates: [
      [10.772546, 106.698199],
      [10.7792, 106.6895],
      [10.7876, 106.6764],
      [10.8015, 106.6633],
      [10.818889, 106.651944],
    ],
    congestion_level: 'LOW',
  },
  alternatives: [],
};

export function normalizeApiError(error) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || 'API request failed.';
  }

  return error?.message || 'Unexpected error.';
}

function isNotFoundError(error) {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRiskScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return NaN;
  }

  if (numeric <= 1) {
    return numeric * 100;
  }

  return numeric;
}

function mapDecisionLevelToCongestion(level) {
  const normalized = String(level || '').toLowerCase();

  if (normalized === 'critical' || normalized === 'high') {
    return 'HIGH';
  }

  if (normalized === 'medium') {
    return 'MEDIUM';
  }

  return 'LOW';
}

function pickDominantLevel(distribution = {}) {
  const entries = Object.entries(distribution || {});
  if (!entries.length) {
    return 'medium';
  }

  return entries.sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0][0];
}

function toDecisionSummaryParams(trafficData = {}) {
  const timestamp = trafficData.timestamp ? new Date(trafficData.timestamp) : new Date();
  const hourOfDay = Number.isFinite(timestamp.getHours()) ? timestamp.getHours() : new Date().getHours();
  const day = timestamp.getDay();
  const dayType = day === 0 || day === 6 ? 'Weekend' : 'Weekday';

  return {
    dayType,
    hourOfDay,
  };
}

function toDecisionRecommendationsParams(trafficData = {}) {
  const timestamp = trafficData.timestamp ? new Date(trafficData.timestamp) : new Date();
  const hourOfDay = Number.isFinite(timestamp.getHours()) ? timestamp.getHours() : new Date().getHours();
  const day = timestamp.getDay();
  const dayType = day === 0 || day === 6 ? 'Weekend' : 'Weekday';

  let minLevel = 'medium';
  if (Number(trafficData.density || 0) >= 80 || Number(trafficData.incident_count || 0) > 0) {
    minLevel = 'high';
  }

  return {
    dayType,
    hourOfDay,
    minLevel,
    limit: 10,
  };
}

async function fetchDecisionSummary(trafficData = {}) {
  const params = toDecisionSummaryParams(trafficData);
  const response = await dssApi.get('/api/decision/traffic/summary', { params });
  return response.data;
}

async function fetchDecisionRecommendations(trafficData = {}) {
  const params = toDecisionRecommendationsParams(trafficData);
  const response = await dssApi.get('/api/decision/traffic/recommendations', { params });
  return response.data;
}

function mapSummaryToPredict(summaryPayload) {
  const metrics = summaryPayload?.metrics || {};
  const dominantLevel = pickDominantLevel(summaryPayload?.decisionLevelDistribution);
  const congestion = mapDecisionLevelToCongestion(dominantLevel);
  const avgSpeed = Number(metrics.avgCurrentSpeed || 25);
  const predictedSpeed = Math.max(5, Math.round(Number.isFinite(avgSpeed) ? avgSpeed : 25));
  const eta = Math.round((5 / Math.max(predictedSpeed, 5)) * 3600);
  const decisionScore = Number(metrics.avgDecisionScore || 60);
  const riskScore = Math.round(clamp(100 - decisionScore, 5, 95));

  let recommendedAction = 'MONITOR';
  if (congestion === 'HIGH') {
    recommendedAction = 'CHANGE_ROUTE';
  } else if (congestion === 'MEDIUM') {
    recommendedAction = 'SLOW_DOWN';
  }

  return {
    predicted_congestion: congestion,
    predicted_speed: predictedSpeed,
    risk_score: riskScore,
    eta,
    recommended_action: recommendedAction,
    confidence: Number((clamp(decisionScore / 100, 0.45, 0.98)).toFixed(2)),
  };
}

function fallbackSpeedByCongestion(congestion) {
  if (congestion === 'HIGH') {
    return 18;
  }

  if (congestion === 'MEDIUM') {
    return 28;
  }

  return 42;
}

function fallbackRiskByCongestion(congestion) {
  if (congestion === 'HIGH') {
    return 84;
  }

  if (congestion === 'MEDIUM') {
    return 56;
  }

  return 24;
}

function normalizePredictResponse(payload = {}) {
  const congestion = mapDecisionLevelToCongestion(
    payload.predicted_congestion || payload.congestion_level || payload.level || payload.prediction_level,
  );
  const predictedSpeedValue = Number(
    payload.predicted_speed ?? payload.speed ?? payload.current_speed ?? payload.avg_speed ?? payload.average_speed,
  );
  const riskScoreValue = normalizeRiskScore(
    payload.risk_score ?? payload.risk ?? payload.anomaly_score ?? payload.incident_risk ?? payload.score,
  );

  return {
    ...payload,
    predicted_congestion: congestion,
    predicted_speed: Number.isFinite(predictedSpeedValue) ? predictedSpeedValue : fallbackSpeedByCongestion(congestion),
    risk_score: Number.isFinite(riskScoreValue)
      ? Math.round(clamp(riskScoreValue, 0, 100))
      : fallbackRiskByCongestion(congestion),
  };
}

function toMlWeatherInput(weatherRow = {}) {
  const temperatureMax = Number(weatherRow.temperature_2m_max ?? weatherRow.temperatureMax ?? 33);
  const temperatureMin = Number(weatherRow.temperature_2m_min ?? weatherRow.temperatureMin ?? 26);
  const apparentTemperatureMax = Number(weatherRow.apparent_temperature_max ?? weatherRow.apparentTemperatureMax ?? temperatureMax + 2);
  const apparentTemperatureMin = Number(weatherRow.apparent_temperature_min ?? weatherRow.apparentTemperatureMin ?? temperatureMin + 1);

  return {
    weather_description: weatherRow.weather_description || weatherRow.weatherDescription || 'clear sky',
    temperature_2m_max: Number.isFinite(temperatureMax) ? temperatureMax : 33,
    temperature_2m_min: Number.isFinite(temperatureMin) ? temperatureMin : 26,
    apparent_temperature_max: Number.isFinite(apparentTemperatureMax) ? apparentTemperatureMax : 35,
    apparent_temperature_min: Number.isFinite(apparentTemperatureMin) ? apparentTemperatureMin : 27,
    precipitation_sum: Number(weatherRow.precipitation_sum ?? weatherRow.precipitation ?? 0) || 0,
    precipitation_probability_max: Number(weatherRow.precipitation_probability_max ?? weatherRow.precipitationProbabilityMax ?? 5) || 5,
    windspeed_10m_max: Number(weatherRow.windspeed_10m_max ?? weatherRow.windSpeedMax ?? 12) || 12,
  };
}

function toMlPredictPayload(place, weatherRow = {}, time = new Date()) {
  return {
    lat: Number(place?.lat),
    lon: Number(place?.lon ?? place?.lng),
    time: time instanceof Date ? time.toISOString() : new Date(time).toISOString(),
    weather: toMlWeatherInput(weatherRow),
  };
}

function normalizeMlBatchPrediction(payload = {}) {
  const predictions = Array.isArray(payload.predictions) ? payload.predictions : [];

  return {
    ...payload,
    predictions: predictions.map((item, index) => normalizePredictResponse({
      ...item,
      index: Number.isFinite(Number(item.index)) ? Number(item.index) : index,
      risk_score: normalizeRiskScore(item.risk_score),
    })),
  };
}

export async function getTrafficWeatherLatest(limit = 1) {
  const response = await dssApi.get('/api/traffic/weather/latest', {
    params: { page: 1, limit },
  });

  return response.data;
}

function mapSummaryToStatus(summaryPayload) {
  const metrics = summaryPayload?.metrics || {};
  const dominantLevel = pickDominantLevel(summaryPayload?.decisionLevelDistribution);
  const congestion = mapDecisionLevelToCongestion(dominantLevel);
  const alerts = [];

  if (Number(metrics.incidentRatePercent || 0) >= 5) {
    alerts.push(`Incident risk elevated: ${Number(metrics.incidentRatePercent).toFixed(1)}%`);
  }

  if (Number(metrics.avgCurrentSpeed || 0) <= 20) {
    alerts.push(`Average speed dropped to ${Number(metrics.avgCurrentSpeed).toFixed(1)} km/h`);
  }

  if (!alerts.length) {
    alerts.push('Traffic conditions are currently stable.');
  }

  return {
    congestion_level: congestion,
    alerts,
  };
}

function makeSyntheticCoordinates(seedIndex = 0) {
  const baseLat = 10.772 + seedIndex * 0.003;
  const baseLon = 106.686 + seedIndex * 0.0025;

  return [
    [baseLat - 0.015, baseLon - 0.012],
    [baseLat - 0.007, baseLon - 0.005],
    [baseLat + 0.001, baseLon + 0.003],
    [baseLat + 0.01, baseLon + 0.012],
  ];
}

function mapRecommendationsToRoutes(payload) {
  const rows = [...(payload?.data || [])];
  if (!rows.length) {
    return {
      best_route: null,
      alternatives: [],
    };
  }

  const mapped = rows
    .sort((a, b) => Number(b.decisionScore || 0) - Number(a.decisionScore || 0))
    .map((item, index) => {
      const avgSpeed = Number(item.avgCurrentSpeed || 20);
      const eta = Math.round((5 / Math.max(avgSpeed, 5)) * 3600 + index * 90);

      return {
        id: item.segmentId || `route-${index + 1}`,
        name: item.segmentName || item.segmentId || `Route ${index + 1}`,
        eta,
        distance_km: Number((5 + index * 0.6).toFixed(1)),
        coordinates: makeSyntheticCoordinates(index),
        congestion_level: mapDecisionLevelToCongestion(item.decisionLevel),
      };
    });

  return {
    best_route: mapped[0],
    alternatives: mapped.slice(1),
  };
}

function mapSummaryToIncident(summaryPayload) {
  const metrics = summaryPayload?.metrics || {};
  const rate = Number(metrics.incidentRatePercent || 0);

  return {
    incident_risk: rate >= 5,
    anomaly_score: Number(clamp(rate / 10, 0.2, 0.99).toFixed(2)),
  };
}

function haversineDistanceMeters([lat1, lon1], [lat2, lon2]) {
  const earthRadius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function estimateRouteDistanceKm(positions = [], fallbackStart, fallbackEnd) {
  if (Array.isArray(positions) && positions.length > 1) {
    const totalMeters = positions.reduce((sum, point, index) => {
      if (index === 0) {
        return 0;
      }

      return sum + haversineDistanceMeters(positions[index - 1], point);
    }, 0);

    return Number((totalMeters / 1000).toFixed(1));
  }

  if (fallbackStart && fallbackEnd) {
    return Number((haversineDistanceMeters(fallbackStart, fallbackEnd) / 1000).toFixed(1));
  }

  return null;
}

function evaluateDssRecommendations(payload = {}) {
  const segments = Array.isArray(payload?.data) ? payload.data : [];
  if (!segments.length) {
    return {
      avgDecisionScore: 0,
      congestionLevel: 'LOW',
      segmentCount: 0,
      criticalCount: 0,
      highCount: 0,
    };
  }

  // Calculate statistics from DSS segments
  const avgScore = segments.reduce((sum, s) => sum + (Number(s.decisionScore) || 0), 0) / segments.length;
  const avgSpeed = segments.reduce((sum, s) => sum + (Number(s.avgCurrentSpeed) || 20), 0) / segments.length;
  const avgCongestionIndex = segments.reduce((sum, s) => sum + (Number(s.avgCongestionIndex) || 0), 0) / segments.length;

  const criticalCount = segments.filter(s => s.decisionLevel === 'critical').length;
  const highCount = segments.filter(s => s.decisionLevel === 'high').length;
  const mediumCount = segments.filter(s => s.decisionLevel === 'medium').length;

  // Determine congestion level based on DSS data distribution
  let congestionLevel = 'LOW';
  if (criticalCount > 0 || avgCongestionIndex > 0.7) {
    congestionLevel = 'HIGH';
  } else if (highCount > 0 || mediumCount > segments.length * 0.4) {
    congestionLevel = 'MEDIUM';
  }

  return {
    avgDecisionScore: Number(avgScore.toFixed(1)),
    avgSpeed: Number(avgSpeed.toFixed(1)),
    avgCongestionIndex: Number(avgCongestionIndex.toFixed(2)),
    congestionLevel,
    segmentCount: segments.length,
    criticalCount,
    highCount,
    mediumCount,
  };
}

function buildRouteRecommendation(routeResponse, originPlace, destinationPlace, source, dssEvaluation = null) {
  const positions = routeResponse?.positions || [];
  const distanceKm = Number.isFinite(routeResponse?.distanceMeters)
    ? Number((routeResponse.distanceMeters / 1000).toFixed(1))
    : estimateRouteDistanceKm(
      positions,
      originPlace ? [originPlace.lat, originPlace.lon] : null,
      destinationPlace ? [destinationPlace.lat, destinationPlace.lon] : null,
    );

  const etaSeconds = Number.isFinite(routeResponse?.durationSeconds)
    ? Math.round(routeResponse.durationSeconds)
    : Math.round(Math.max(distanceKm || 0, 1) / 25 * 3600);

  // Use DSS evaluation if available, otherwise default to LOW
  const congestionLevel = dssEvaluation?.congestionLevel || 'LOW';
  const decisionSource = dssEvaluation?.isDssEvaluated ? 'dss' : 'default';

  return {
    best_route: {
      id: `${decisionSource}-best-route`,
      name: `${originPlace.name} → ${destinationPlace.name}`,
      eta: etaSeconds,
      distance_km: distanceKm,
      distance_text: routeResponse?.distanceText || (distanceKm != null ? `${distanceKm} km` : ''),
      duration_text: routeResponse?.durationText || '',
      source: decisionSource,
      geometry_source: source,
      dss_stats: dssEvaluation?.isDssEvaluated
        ? {
          avg_decision_score: dssEvaluation.avgDecisionScore,
          avg_speed: dssEvaluation.avgSpeed,
          avg_congestion_index: dssEvaluation.avgCongestionIndex,
          segment_count: dssEvaluation.segmentCount,
          critical_count: dssEvaluation.criticalCount,
          high_count: dssEvaluation.highCount,
        }
        : null,
      coordinates: positions,
      congestion_level: congestionLevel,
      note: dssEvaluation?.isDssEvaluated ? 'Được đánh giá bởi DSS' : 'Mặc định thông thoáng',
    },
    alternatives: [],
  };
}

export async function predictTraffic(trafficData) {
  const payload = trafficData?.lat != null && trafficData?.lon != null
    ? trafficData
    : trafficData?.origin || trafficData?.destination || trafficData;

  try {
    const response = await dssApi.post('/api/ml/predict', payload);

    return normalizePredictResponse(response.data);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const summaryPayload = await fetchDecisionSummary(trafficData);
    return normalizePredictResponse(mapSummaryToPredict(summaryPayload));
  }
}

export async function predictTrafficBatch(items = []) {
  try {
    const response = await dssApi.post('/api/ml/predict/batch', {
      items,
    });

    return normalizeMlBatchPrediction(response.data);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const fallbackItems = items.map((item, index) => normalizePredictResponse({
      predicted_congestion: index === 0 ? 'HIGH' : 'MEDIUM',
      predicted_speed: index === 0 ? 18 : 28,
      risk_score: index === 0 ? 84 : 56,
      nearest_segment_id: item?.segmentId || item?.name || `item-${index + 1}`,
    }));

    return {
      count: fallbackItems.length,
      predictions: fallbackItems,
    };
  }
}

export async function recommendRoute(trafficData) {
  try {
    const response = await dssApi.post('/recommend-route', {
      traffic_data: trafficData,
    });

    return response.data;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const recommendationPayload = await fetchDecisionRecommendations(trafficData);
    return mapRecommendationsToRoutes(recommendationPayload);
  }
}

export async function getTrafficStatus() {
  try {
    const response = await dssApi.get('/traffic-status');
    return response.data;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const summaryPayload = await fetchDecisionSummary();
    return mapSummaryToStatus(summaryPayload);
  }
}

export async function detectIncident(trafficData) {
  try {
    const response = await dssApi.post('/detect-incident', {
      traffic_data: trafficData,
    });

    return response.data;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const summaryPayload = await fetchDecisionSummary(trafficData);
    return mapSummaryToIncident(summaryPayload);
  }
}

export async function recommendBestRoute(originPlace, destinationPlace) {
  if (!originPlace || !destinationPlace) {
    throw new Error('Vui lòng chọn điểm đi và điểm đến.');
  }

  // Step 1: Always get the route (don't wait for DSS to start routing)
  let routeData;
  let geometrySource = 'google';

  try {
    routeData = await fetchGoogleRoute(originPlace, destinationPlace);
  } catch (error) {
    console.warn('Google route failed, falling back to OSRM:', error);
    geometrySource = 'osrm';

    try {
      const positions = await fetchRoadRoute({
        latStart: originPlace.lat,
        lonStart: originPlace.lon,
        latEnd: destinationPlace.lat,
        lonEnd: destinationPlace.lon,
      });
      routeData = { positions };
    } catch (osrmError) {
      throw new Error('Không thể tìm đường đi: ' + (osrmError.message || 'Routing service unavailable'));
    }
  }

  // Step 2: Fetch DSS data to evaluate the route (independent of routing)
  let dssEvaluation = null;

  try {
    const dssPayload = await fetchDecisionRecommendations();
    dssEvaluation = evaluateDssRecommendations(dssPayload);
    dssEvaluation.isDssEvaluated = true;
  } catch (error) {
    console.warn('DSS evaluation failed, using default route assessment:', error);
    // If DSS fails, route is still valid - just without DSS evaluation
    dssEvaluation = {
      congestionLevel: 'LOW',
      isDssEvaluated: false,
    };
  }

  // Step 3: Build route recommendation with DSS evaluation
  return buildRouteRecommendation(routeData, originPlace, destinationPlace, geometrySource, dssEvaluation);
}
