/**
 * Traffic Status Service
 * Aggregates and provides overall traffic status information
 */

function normalizeValue(value, min, max) {
  const parsed = Number.parseFloat(String(value || 0));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Aggregate traffic status from multiple data points
 */
async function getTrafficStatus(dataArray = []) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return {
      status: "NO_DATA",
      overall_congestion: "UNKNOWN",
      metrics: {
        avg_congestion: 0,
        avg_speed: 0,
        incident_count: 0,
        incident_rate: 0,
      },
      alerts: [],
      timestamp: new Date().toISOString(),
    };
  }

  let totalCongestion = 0;
  let totalSpeed = 0;
  let incidentCount = 0;
  const congestionLevels = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };

  dataArray.forEach((data) => {
    const congestion = normalizeValue(data.congestionIndex, 0, 1);
    const speed = normalizeValue(data.currentSpeed, 0, 200);
    const incident = Number.parseInt(String(data.incidentFlag || 0), 10);

    totalCongestion += congestion;
    totalSpeed += speed;
    incidentCount += incident;

    if (congestion > 0.8) congestionLevels.CRITICAL += 1;
    else if (congestion > 0.6) congestionLevels.HIGH += 1;
    else if (congestion > 0.4) congestionLevels.MEDIUM += 1;
    else congestionLevels.LOW += 1;
  });

  const avgCongestion = totalCongestion / dataArray.length;
  const avgSpeed = totalSpeed / dataArray.length;
  const incidentRate = (incidentCount / dataArray.length) * 100;

  // Determine overall congestion level
  let overallCongestion = "LOW";
  if (avgCongestion > 0.8) overallCongestion = "CRITICAL";
  else if (avgCongestion > 0.6) overallCongestion = "HIGH";
  else if (avgCongestion > 0.4) overallCongestion = "MEDIUM";

  // Generate alerts
  const alerts = [];
  if (avgCongestion > 0.7) {
    alerts.push({
      level: "HIGH",
      message: `Heavy traffic detected. Average congestion: ${(avgCongestion * 100).toFixed(1)}%`,
    });
  }
  if (incidentRate > 10) {
    alerts.push({
      level: "HIGH",
      message: `Multiple incidents detected (${incidentCount}). Exercise caution.`,
    });
  }
  if (avgSpeed < 20) {
    alerts.push({
      level: "CRITICAL",
      message: `Very low average speed: ${avgSpeed.toFixed(1)} km/h. Severe congestion.`,
    });
  }

  return {
    status: overallCongestion === "CRITICAL" ? "CRITICAL" : overallCongestion === "HIGH" ? "CONGESTED" : "NORMAL",
    overall_congestion: overallCongestion,
    metrics: {
      avg_congestion: Number(avgCongestion.toFixed(4)),
      avg_speed: Number(avgSpeed.toFixed(2)),
      incident_count: incidentCount,
      incident_rate: Number(incidentRate.toFixed(2)),
      segments_analyzed: dataArray.length,
    },
    congestion_distribution: {
      low: congestionLevels.LOW,
      medium: congestionLevels.MEDIUM,
      high: congestionLevels.HIGH,
      critical: congestionLevels.CRITICAL,
    },
    alerts,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get traffic status by time period filter
 */
async function getTrafficStatusByPeriod(dataArray = [], period = "hourly") {
  const statusByPeriod = {};

  dataArray.forEach((data) => {
    const key = period === "hourly" ? `hour_${data.hourOfDay}` : period === "daily" ? data.dayType : "overall";

    if (!statusByPeriod[key]) {
      statusByPeriod[key] = [];
    }
    statusByPeriod[key].push(data);
  });

  const results = {};
  for (const [key, data] of Object.entries(statusByPeriod)) {
    results[key] = await getTrafficStatus(data);
  }

  return {
    period,
    status_by_period: results,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getTrafficStatus,
  getTrafficStatusByPeriod,
};
