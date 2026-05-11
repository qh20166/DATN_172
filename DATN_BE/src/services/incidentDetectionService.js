/**
 * Incident Detection Service
 * Detects anomalies and potential incidents in traffic data
 */

const { detectAnomaly } = require("../config/mlModels");

function validateIncidentDetectionInput(trafficData) {
  if (!trafficData || typeof trafficData !== "object") {
    const error = new Error("trafficData is required and must be an object.");
    error.statusCode = 400;
    throw error;
  }

  if (!trafficData.segmentId) {
    const error = new Error("segmentId is required in trafficData.");
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Detect incident for a single segment
 */
async function detectIncident(trafficData, historicalAvg = null) {
  validateIncidentDetectionInput(trafficData);

  const anomaly = detectAnomaly(trafficData, historicalAvg);

  return {
    segmentId: trafficData.segmentId,
    segmentName: trafficData.name_vn || "Unknown",
    anomaly_score: anomaly.anomalyScore,
    is_anomaly: anomaly.isAnomaly,
    incident_risk: anomaly.riskLevel,
    explicit_incident_flag: Number.parseInt(String(trafficData.incidentFlag || 0), 10) === 1,
    detected_at: new Date().toISOString(),
  };
}

/**
 * Batch detect incidents across multiple segments
 */
async function detectIncidentsBatch(dataArray, historicalAvgMap = {}) {
  if (!Array.isArray(dataArray)) {
    const error = new Error("Input must be an array of traffic data objects.");
    error.statusCode = 400;
    throw error;
  }

  const incidents = dataArray
    .map((data) => {
      try {
        const historicalAvg = historicalAvgMap[data?.segmentId];
        return detectIncident(data, historicalAvg);
      } catch (err) {
        return null;
      }
    })
    .filter((x) => x !== null);

  // Filter only anomalies
  const anomalies = incidents.filter((x) => x.is_anomaly);

  return {
    total_scanned: dataArray.length,
    anomalies_detected: anomalies.length,
    critical_incidents: anomalies.filter((x) => x.incident_risk === "CRITICAL").length,
    high_incidents: anomalies.filter((x) => x.incident_risk === "HIGH").length,
    incidents: anomalies,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  detectIncident,
  detectIncidentsBatch,
};
