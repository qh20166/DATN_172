/**
 * Prediction Service
 * Orchestrates traffic prediction using ML models
 */

const {
  predictCongestionLevel,
  estimateETA,
  recommendAction,
  calculateConfidence,
} = require("../config/mlModels");

function validatePredictionInput(trafficData) {
  if (!trafficData || typeof trafficData !== "object") {
    const error = new Error("traffic_data is required and must be an object.");
    error.statusCode = 400;
    throw error;
  }

  if (!trafficData.segmentId) {
    const error = new Error("segmentId is required in traffic_data.");
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Generate prediction for a single traffic segment
 */
async function predictTraffic(trafficData, weatherData = {}) {
  validatePredictionInput(trafficData);

  const congestion = predictCongestionLevel(trafficData);
  const eta = estimateETA(trafficData);
  const action = recommendAction(trafficData, weatherData);
  const confidence = calculateConfidence(trafficData);

  return {
    segmentId: trafficData.segmentId,
    segmentName: trafficData.name_vn || "Unknown",
    predicted_congestion: congestion.level,
    congestion_score: congestion.score,
    eta_minutes: eta,
    recommended_action: action,
    confidence: confidence,
    predicted_at: new Date().toISOString(),
  };
}

/**
 * Batch predict for multiple segments
 */
async function predictTrafficBatch(dataArray, weatherData = {}) {
  if (!Array.isArray(dataArray)) {
    const error = new Error("Input must be an array of traffic data objects.");
    error.statusCode = 400;
    throw error;
  }

  const predictions = dataArray.map((data) => {
    try {
      return predictTraffic(data, weatherData);
    } catch (err) {
      return {
        segmentId: data?.segmentId || "unknown",
        error: err.message,
      };
    }
  });

  return {
    count: predictions.length,
    predictions,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  predictTraffic,
  predictTrafficBatch,
};
