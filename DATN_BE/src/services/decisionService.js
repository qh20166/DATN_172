const { getTrafficWeatherRows } = require("./csvDataService");
const { recommendBestRoute } = require("../config/mlModels");

const DEFAULT_RECOMMENDATION_LIMIT = 10;
const MAX_RECOMMENDATION_LIMIT = 50;

const DECISION_LEVEL_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const SEVERE_WEATHER_CODES = new Set([
  45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 80, 81, 82, 95,
  96, 99,
]);

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getDecisionLevel(score) {
  if (score <= 30) return "low";
  if (score <= 60) return "medium";
  if (score <= 80) return "high";
  return "critical";
}

function weatherRiskFromRow(row) {
  const weatherCode = Math.round(toNumber(row.weathercode, -1));
  const precipitationProb = clamp(
    toNumber(row.precipitation_probability_max, 0),
    0,
    100
  );
  const windSpeed = clamp(toNumber(row.windspeed_10m_max, 0), 0, 120);

  const codeRisk = SEVERE_WEATHER_CODES.has(weatherCode) ? 70 : 20;
  const precipitationRisk = precipitationProb * 0.25;
  const windRisk = windSpeed * 0.4;

  return clamp(codeRisk + precipitationRisk + windRisk, 0, 100);
}

function computeDecisionSignal(row) {
  const congestionIndex = clamp(toNumber(row.congestionIndex, 0), 0, 1);
  const speedLimitRatio = clamp(toNumber(row.speedLimitRatio, 0), 0, 2);
  const incidentFlag = Math.round(toNumber(row.incidentFlag, 0)) === 1;
  const trafficVolume = toNumber(row.trafficVolume, 0);

  const congestionScore = congestionIndex * 100;
  const speedPenalty = clamp((1 - speedLimitRatio) * 100, 0, 100);
  const weatherRisk = weatherRiskFromRow(row);
  const incidentRisk = incidentFlag ? 100 : 0;
  const volumeRisk = clamp(trafficVolume / 20, 0, 100);

  const score = clamp(
    0.4 * congestionScore +
      0.25 * speedPenalty +
      0.2 * weatherRisk +
      0.1 * incidentRisk +
      0.05 * volumeRisk,
    0,
    100
  );

  const decisionLevel = getDecisionLevel(score);

  return {
    score: round(score),
    decisionLevel,
    components: {
      congestionScore: round(congestionScore),
      speedPenalty: round(speedPenalty),
      weatherRisk: round(weatherRisk),
      incidentRisk,
      volumeRisk: round(volumeRisk),
    },
  };
}

function getActionByLevel(level) {
  if (level === "critical") {
    return {
      priority: "urgent",
      recommendation:
        "Reroute immediately and push congestion warning to users in this segment.",
    };
  }

  if (level === "high") {
    return {
      priority: "high",
      recommendation:
        "Suggest alternative roads and display expected delay before route confirmation.",
    };
  }

  if (level === "medium") {
    return {
      priority: "normal",
      recommendation:
        "Keep current route but monitor in real-time for speed drops or weather changes.",
    };
  }

  return {
    priority: "low",
    recommendation: "Current condition is stable; no route intervention is required.",
  };
}

function passesFilters(row, filters) {
  if (filters.dayType && normalizeText(row.dayType) !== normalizeText(filters.dayType)) {
    return false;
  }

  if (filters.hourOfDay !== null && Number.parseInt(row.hourOfDay, 10) !== filters.hourOfDay) {
    return false;
  }

  return true;
}

function normalizeFilters(input = {}) {
  const normalizedLimit = clamp(
    Number.parseInt(String(input.limit || DEFAULT_RECOMMENDATION_LIMIT), 10) ||
      DEFAULT_RECOMMENDATION_LIMIT,
    1,
    MAX_RECOMMENDATION_LIMIT
  );

  const hourRaw = Number.parseInt(String(input.hourOfDay || ""), 10);
  const hourOfDay = Number.isInteger(hourRaw) && hourRaw >= 0 && hourRaw <= 23 ? hourRaw : null;

  const minLevel = normalizeText(input.minLevel);
  const minLevelValidated = DECISION_LEVEL_ORDER[minLevel] ? minLevel : "medium";

  return {
    dayType: input.dayType || "",
    hourOfDay,
    minLevel: minLevelValidated,
    limit: normalizedLimit,
  };
}

async function getDecisionSummary(queryFilters) {
  const filters = normalizeFilters(queryFilters);
  const rows = await getTrafficWeatherRows();
  const filteredRows = rows.filter((row) => passesFilters(row, filters));

  if (filteredRows.length === 0) {
    return {
      source: "data/traffic_weather_latest.csv",
      filters,
      totalRecords: 0,
      metrics: {
        avgCurrentSpeed: 0,
        avgCongestionIndex: 0,
        avgDecisionScore: 0,
        incidentRatePercent: 0,
      },
      losDistribution: {},
      decisionLevelDistribution: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  let totalSpeed = 0;
  let totalCongestion = 0;
  let totalScore = 0;
  let incidentCount = 0;
  const losDistribution = {};
  const decisionLevelDistribution = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const row of filteredRows) {
    totalSpeed += toNumber(row.currentSpeed, 0);
    totalCongestion += toNumber(row.congestionIndex, 0);

    const decisionSignal = computeDecisionSignal(row);
    totalScore += decisionSignal.score;
    decisionLevelDistribution[decisionSignal.decisionLevel] += 1;

    if (Math.round(toNumber(row.incidentFlag, 0)) === 1) {
      incidentCount += 1;
    }

    const los = String(row.LOS || "Unknown");
    losDistribution[los] = (losDistribution[los] || 0) + 1;
  }

  return {
    source: "data/traffic_weather_latest.csv",
    filters,
    totalRecords: filteredRows.length,
    metrics: {
      avgCurrentSpeed: round(totalSpeed / filteredRows.length),
      avgCongestionIndex: round(totalCongestion / filteredRows.length, 4),
      avgDecisionScore: round(totalScore / filteredRows.length),
      incidentRatePercent: round((incidentCount / filteredRows.length) * 100),
    },
    losDistribution,
    decisionLevelDistribution,
    generatedAt: new Date().toISOString(),
  };
}

async function getDecisionRecommendations(queryFilters) {
  const filters = normalizeFilters(queryFilters);
  const rows = await getTrafficWeatherRows();

  const segmentMap = new Map();

  for (const row of rows) {
    if (!passesFilters(row, filters)) {
      continue;
    }

    const segmentId = String(row.segmentId || "unknown");
    const segmentName = String(row.name_vn || "Unknown segment");
    const signal = computeDecisionSignal(row);

    if (DECISION_LEVEL_ORDER[signal.decisionLevel] < DECISION_LEVEL_ORDER[filters.minLevel]) {
      continue;
    }

    const existing = segmentMap.get(segmentId) || {
      segmentId,
      segmentName,
      observations: 0,
      scoreTotal: 0,
      maxScore: 0,
      maxLevel: "low",
      avgCurrentSpeed: 0,
      avgCongestionIndex: 0,
      incidentCount: 0,
      weatherDescriptions: new Set(),
    };

    existing.observations += 1;
    existing.scoreTotal += signal.score;
    existing.maxScore = Math.max(existing.maxScore, signal.score);
    if (DECISION_LEVEL_ORDER[signal.decisionLevel] > DECISION_LEVEL_ORDER[existing.maxLevel]) {
      existing.maxLevel = signal.decisionLevel;
    }

    existing.avgCurrentSpeed += toNumber(row.currentSpeed, 0);
    existing.avgCongestionIndex += toNumber(row.congestionIndex, 0);
    existing.incidentCount += Math.round(toNumber(row.incidentFlag, 0)) === 1 ? 1 : 0;
    existing.weatherDescriptions.add(String(row.weather_description || "Unknown"));

    segmentMap.set(segmentId, existing);
  }

  const items = [];

  for (const segment of segmentMap.values()) {
    const averageScore = segment.scoreTotal / segment.observations;
    const finalScore = round(Math.max(averageScore, segment.maxScore * 0.75));
    const finalLevel = getDecisionLevel(finalScore);
    const action = getActionByLevel(finalLevel);

    items.push({
      segmentId: segment.segmentId,
      segmentName: segment.segmentName,
      decisionScore: finalScore,
      decisionLevel: finalLevel,
      priority: action.priority,
      recommendation: action.recommendation,
      observations: segment.observations,
      avgCurrentSpeed: round(segment.avgCurrentSpeed / segment.observations),
      avgCongestionIndex: round(
        segment.avgCongestionIndex / segment.observations,
        4
      ),
      incidentRatePercent: round((segment.incidentCount / segment.observations) * 100),
      weatherSignals: Array.from(segment.weatherDescriptions).slice(0, 3),
    });
  }

  items.sort((a, b) => {
    if (b.decisionScore !== a.decisionScore) {
      return b.decisionScore - a.decisionScore;
    }

    return b.incidentRatePercent - a.incidentRatePercent;
  });

  return {
    source: "data/traffic_weather_latest.csv",
    filters,
    totalSegments: items.length,
    count: Math.min(filters.limit, items.length),
    generatedAt: new Date().toISOString(),
    data: items.slice(0, filters.limit),
  };
}

/**
 * DSS Route Recommendation - Find best route from origin to destination
 * Analyzes real-time traffic data to recommend optimal path
 */
async function getRouteDSSRecommendation(queryFilters) {
  const origin = String(queryFilters.origin || "").trim().toLowerCase();
  const destination = String(queryFilters.destination || "").trim().toLowerCase();

  if (!origin || !destination) {
    const error = new Error("Both origin and destination are required");
    error.statusCode = 400;
    throw error;
  }

  if (origin === destination) {
    const error = new Error("Origin and destination cannot be the same");
    error.statusCode = 400;
    throw error;
  }

  // target hour: use provided hourOfDay or current hour
  const targetHour = Number.isInteger(queryFilters.hourOfDay)
    ? queryFilters.hourOfDay
    : new Date().getHours();

  const rows = await getTrafficWeatherRows();

  // Prefer rows matching the same hour across previous days (assume daily patterns)
  const sameHourRows = rows.filter((r) => {
    const h = Number.parseInt(String(r.hourOfDay || ""), 10);
    return Number.isInteger(h) && h === targetHour;
  });

  const useRows = sameHourRows.length > 0 ? sameHourRows : rows;

  const agg = new Map();

  for (const row of useRows) {
    const segmentName = String(row.name_vn || "").toLowerCase();
    const segmentId = String(row.segmentId || "unknown");
    const containsOrigin = segmentName.includes(origin);
    const containsDestination = segmentName.includes(destination);

    if (!(containsOrigin || containsDestination)) continue;

    const entry =
      agg.get(segmentId) ||
      {
        segmentId,
        name_vn: String(row.name_vn || "Unknown"),
        count: 0,
        sumCongestionIndex: 0,
        sumCurrentSpeed: 0,
        sumSpeedLimitRatio: 0,
        sumJamFactor: 0,
        sumRouteDistance: 0,
        incidentCount: 0,
        weatherSum: { precipitation_probability_max: 0, windspeed_10m_max: 0, weathercode: 0 },
      };

    entry.count += 1;
    entry.sumCongestionIndex += toNumber(row.congestionIndex, 0);
    entry.sumCurrentSpeed += toNumber(row.currentSpeed, 0);
    entry.sumSpeedLimitRatio += toNumber(row.speedLimitRatio, 0);
    entry.sumJamFactor += toNumber(row.jamFactor, 0);
    entry.sumRouteDistance += toNumber(row.route_distance_m, 0) || 0;
    entry.incidentCount += Math.round(toNumber(row.incidentFlag, 0)) === 1 ? 1 : 0;
    entry.weatherSum.precipitation_probability_max += toNumber(row.precipitation_probability_max, 0);
    entry.weatherSum.windspeed_10m_max += toNumber(row.windspeed_10m_max, 0);
    entry.weatherSum.weathercode += Math.round(toNumber(row.weathercode, 0));

    agg.set(segmentId, entry);
  }

  if (agg.size === 0) {
    return {
      origin: queryFilters.origin,
      destination: queryFilters.destination,
      found: false,
      message: `Không tìm thấy dữ liệu lịch sử phù hợp cho: ${queryFilters.origin} -> ${queryFilters.destination}`,
      suggestions: "Thử mở rộng tên hoặc gửi segmentId",
      timestamp: new Date().toISOString(),
    };
  }

  const routes = [];
  const trafficDataMap = {};

  for (const [segmentId, s] of agg.entries()) {
    const avgCongestion = s.sumCongestionIndex / s.count;
    const avgSpeed = s.sumCurrentSpeed / s.count;
    const avgSpeedRatio = s.sumSpeedLimitRatio / s.count;
    const avgJam = s.sumJamFactor / s.count;
    const avgDist = s.sumRouteDistance / s.count || 1000;
    const incidentFlag = s.incidentCount / s.count >= 0.5 ? 1 : 0;
    const weatherAvg = {
      weathercode: Math.round(s.weatherSum.weathercode / s.count) || 0,
      precipitation_probability_max: round(s.weatherSum.precipitation_probability_max / s.count, 2) || 0,
      windspeed_10m_max: round(s.weatherSum.windspeed_10m_max / s.count, 2) || 0,
    };

    routes.push({ segmentId, name_vn: s.name_vn, distance_m: Math.round(avgDist) });

    trafficDataMap[segmentId] = {
      congestionIndex: avgCongestion,
      currentSpeed: avgSpeed,
      speedLimitRatio: avgSpeedRatio,
      jamFactor: avgJam,
      route_distance_m: avgDist,
      incidentFlag,
      weathercode: weatherAvg.weathercode,
      precipitation_probability_max: weatherAvg.precipitation_probability_max,
      windspeed_10m_max: weatherAvg.windspeed_10m_max,
    };
  }

  // Use ML recommendation engine to score routes
  const result = recommendBestRoute(routes, trafficDataMap, {});

  return {
    origin: queryFilters.origin,
    destination: queryFilters.destination,
    found: true,
    bestRoute: result.best_route,
    alternatives: result.alternatives,
    summary: {
      totalRoutesFound: routes.length,
      bestRouteScore: result.best_route?.score ?? null,
      timestamp: result.timestamp,
    },
    timestamp: result.timestamp || new Date().toISOString(),
  };
}

module.exports = {
  getDecisionSummary,
  getDecisionRecommendations,
  getRouteDSSRecommendation,
};