/**
 * ML Models Service
 * Implements pre-trained traffic prediction logic
 * Combines: congestion, weather, time factors for decision support
 */

function normalizeValue(value, min, max) {
  const parsed = Number.parseFloat(String(value || 0));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Predict congestion level based on traffic data
 * Uses weighted combination of congestion index, speed limit ratio, and incident flag
 */
function predictCongestionLevel(trafficData) {
  const congestionIndex = normalizeValue(trafficData.congestionIndex, 0, 1);
  const speedLimitRatio = normalizeValue(trafficData.speedLimitRatio, 0, 2);
  const incidentFlag = Number.parseInt(String(trafficData.incidentFlag || 0), 10) === 1 ? 1 : 0;
  const jamFactor = normalizeValue(trafficData.jamFactor, 0, 1);

  // Weighted score: 0-100
  const score =
    congestionIndex * 40 +
    (1 - speedLimitRatio) * 30 +
    incidentFlag * 20 +
    jamFactor * 10;

  if (score > 80) return { level: "CRITICAL", score: Math.round(score), color: "red" };
  if (score > 60) return { level: "HIGH", score: Math.round(score), color: "orange" };
  if (score > 40) return { level: "MEDIUM", score: Math.round(score), color: "yellow" };
  return { level: "LOW", score: Math.round(score), color: "green" };
}

/**
 * Estimate ETA in minutes based on speed, distance, and congestion
 */
function estimateETA(trafficData) {
  const routeDistance = normalizeValue(trafficData.route_distance_m, 0, 100000) || 1000;
  const currentSpeed = normalizeValue(trafficData.currentSpeed, 1, 200) || 30;
  const congestionIndex = normalizeValue(trafficData.congestionIndex, 0, 1);

  // Apply congestion penalty
  const adjustedSpeed = currentSpeed * (1 - congestionIndex * 0.5);
  const distanceKm = routeDistance / 1000;
  const etaMinutes = Math.round((distanceKm / adjustedSpeed) * 60);

  return Math.max(1, etaMinutes);
}

/**
 * Recommend action based on traffic + weather conditions
 */
function recommendAction(trafficData, weatherData) {
  const congestionLevel = predictCongestionLevel(trafficData).level;
  const weatherCode = Number.parseInt(String(weatherData?.weathercode || 0), 10);
  const precipitationProb = normalizeValue(weatherData?.precipitation_probability_max, 0, 100);
  const windSpeed = normalizeValue(weatherData?.windspeed_10m_max, 0, 150);

  const isSevereWeather = weatherCode >= 51 || precipitationProb > 70 || windSpeed > 40;

  if (congestionLevel === "CRITICAL") {
    return isSevereWeather ? "AVOID_ROUTE_URGENT" : "CHANGE_ROUTE";
  }
  if (congestionLevel === "HIGH") {
    return isSevereWeather ? "CHANGE_ROUTE" : "MONITOR_TRAFFIC";
  }
  if (congestionLevel === "MEDIUM") {
    return isSevereWeather ? "STAY_ALERT" : "PROCEED_NORMAL";
  }
  return "PROCEED_NORMAL";
}

/**
 * Calculate confidence score (0-100) based on data quality
 */
function calculateConfidence(trafficData) {
  let confidence = 100;

  // Reduce confidence if key data is missing
  if (!trafficData.congestionIndex) confidence -= 15;
  if (!trafficData.currentSpeed) confidence -= 15;
  if (!trafficData.route_distance_m) confidence -= 10;
  if (!trafficData.speedLimitRatio) confidence -= 10;

  return Math.max(40, confidence);
}

/**
 * Detect anomalies (incidents, unusual patterns)
 */
function detectAnomaly(trafficData, historicalAvg) {
  const currentCongestion = normalizeValue(trafficData.congestionIndex, 0, 1);
  const currentSpeed = normalizeValue(trafficData.currentSpeed, 0, 200);
  const incidentFlag = Number.parseInt(String(trafficData.incidentFlag || 0), 10);

  let anomalyScore = 0;

  // Explicit incident flag
  if (incidentFlag === 1) {
    anomalyScore += 40;
  }

  // Unusual congestion vs historical average
  if (historicalAvg && historicalAvg.avgCongestion) {
    const deviation = Math.abs(currentCongestion - historicalAvg.avgCongestion);
    if (deviation > 0.3) anomalyScore += 30;
  }

  // Unusual speed drop
  if (historicalAvg && historicalAvg.avgSpeed) {
    const speedRatio = currentSpeed / (historicalAvg.avgSpeed || 1);
    if (speedRatio < 0.5) anomalyScore += 20;
  }

  // High jam factor
  if (normalizeValue(trafficData.jamFactor, 0, 1) > 0.7) {
    anomalyScore += 15;
  }

  return {
    anomalyScore: Math.round(anomalyScore),
    isAnomaly: anomalyScore > 50,
    riskLevel: anomalyScore > 70 ? "CRITICAL" : anomalyScore > 50 ? "HIGH" : "NORMAL",
  };
}

/**
 * Route recommendation engine
 * Compare multiple routes and rank by safety, speed, congestion
 */
function recommendBestRoute(routes, trafficDataMap, weatherData) {
  if (!Array.isArray(routes) || routes.length === 0) {
    return { best_route: null, alternatives: [], error: "No routes provided" };
  }

  const scoredRoutes = routes.map((route) => {
    const trafficData = trafficDataMap[route.segmentId] || {};
    const congestion = predictCongestionLevel(trafficData);
    const eta = estimateETA(trafficData);
    const action = recommendAction(trafficData, weatherData);

    const score =
      (100 - congestion.score) * 0.5 +
      (100 - Math.min(eta, 100)) * 0.3 +
      (action === "PROCEED_NORMAL" ? 100 : action === "MONITOR_TRAFFIC" ? 70 : 20) * 0.2;

    return {
      ...route,
      score: Math.round(score),
      congestionLevel: congestion.level,
      eta,
      recommendedAction: action,
      confidence: calculateConfidence(trafficData),
    };
  });

  // Sort by score descending
  scoredRoutes.sort((a, b) => b.score - a.score);

  return {
    best_route: scoredRoutes[0] || null,
    alternatives: scoredRoutes.slice(1, 3) || [],
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  predictCongestionLevel,
  estimateETA,
  recommendAction,
  calculateConfidence,
  detectAnomaly,
  recommendBestRoute,
};
