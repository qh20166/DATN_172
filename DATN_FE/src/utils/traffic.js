const LEVEL_COLORS = {
  low: '#2d7a44',
  medium: '#f2a93b',
  high: '#de4b39',
  smooth: '#2d7a44',
  slow: '#f2a93b',
  heavy: '#de4b39',
  critical: '#b42318',
};

// Speed-based classification colors (A-F)
// Reversed: Slow/Congested = Red, Fast/Smooth = Green
const SPEED_LEVEL_COLORS = {
  A: '#b42318', // ≤10.0 - Dark red (Very slow/Heavy congestion)
  B: '#de4b39', // >10.0 to ≤25.0 - Red
  C: '#ff7043', // >25.0 to ≤30.0 - Orange
  D: '#f2a93b', // >30.0 to ≤40.0 - Yellow
  E: '#7cb342', // >40.0 to ≤60.0 - Light green
  F: '#2d7a44', // >60.0 - Green (Smooth/Fast flow)
};

const SPEED_LEVEL_LABELS = {
  A: '≤ 10 km/h',
  B: '10 - 25 km/h',
  C: '25 - 30 km/h',
  D: '30 - 40 km/h',
  E: '40 - 60 km/h',
  F: '> 60 km/h',
};

export function normalizeTrafficLevel(level) {
  const normalized = String(level || '').toLowerCase();

  if (normalized === 'low' || normalized === 'smooth' || normalized === 'good') {
    return 'low';
  }

  if (normalized === 'high' || normalized === 'heavy' || normalized === 'critical') {
    return 'high';
  }

  return 'medium';
}

export function classifyCongestion(score) {
  if (score < 0.45) {
    return 'smooth';
  }

  if (score < 0.7) {
    return 'slow';
  }

  return 'heavy';
}

export function computeCongestionScore({
  congestionIndex,
  jamFactor,
  speedLimitRatio,
  relativeCongestionIndex,
}) {
  const cIndex = Number(congestionIndex) || 0;
  const jam = Number(jamFactor) || 0;
  const speedRatio = Number(speedLimitRatio) || 0;
  const relative = Number(relativeCongestionIndex) || 0;

  const normalizedJam = Math.max(0, Math.min(jam / 10, 1));
  const normalizedSpeedPenalty = 1 - Math.max(0, Math.min(speedRatio, 1));

  const score = (cIndex * 0.45) + (normalizedJam * 0.2) + (normalizedSpeedPenalty * 0.2) + (relative * 0.15);
  return Math.max(0, Math.min(score, 1));
}

export function getLevelColor(level) {
  const normalized = String(level || '').toLowerCase();
  return LEVEL_COLORS[normalized] || LEVEL_COLORS[normalizeTrafficLevel(normalized)] || '#2d7a44';
}

export const levelLabels = {
  low: 'Thông thoáng',
  medium: 'Di chuyển chậm',
  high: 'Kẹt xe cao',
  smooth: 'Thông thoáng',
  slow: 'Di chuyển chậm',
  heavy: 'Kẹt xe cao',
  critical: 'Kẹt xe rất cao',
};

/**
 * Classify speed into categories A-F based on km/h
 * A: ≤10.0, B: >10.0 to ≤25.0, C: >25.0 to ≤30.0, D: >30.0 to ≤40.0, E: >40.0 to ≤60.0, F: >60.0
 */
export function classifySpeedLevel(speed) {
  const speedKmh = Number(speed) || 0;

  if (speedKmh <= 10) return 'A';
  if (speedKmh <= 25) return 'B';
  if (speedKmh <= 30) return 'C';
  if (speedKmh <= 40) return 'D';
  if (speedKmh <= 60) return 'E';
  return 'F';
}

export function getSpeedLevelColor(speedLevel) {
  return SPEED_LEVEL_COLORS[speedLevel] || '#2d7a44';
}

export function getSpeedLevelLabel(speedLevel) {
  return SPEED_LEVEL_LABELS[speedLevel] || 'Không xác định';
}

export const speedLevelData = Object.entries(SPEED_LEVEL_COLORS).map(([level, color]) => ({
  level,
  color,
  label: SPEED_LEVEL_LABELS[level],
}));
