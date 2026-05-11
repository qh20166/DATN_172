const CATEGORY_FEATURES = ["roadType", "surface", "weather_description", "dayType"];

const NUMERIC_FEATURES = [
  "lat",
  "lon",
  "laneCount_aggregated",
  "speedLimit",
  "frc",
  "oneway",
  "curvatureIndex",
  "bearing",
  "lengthKm",
  "intersectionCount",
  "routeSlopePercent",
  "startElevation",
  "endElevation",
  "dayOfWeek",
  "hourOfDay",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "windspeed_10m_max",
  "map_match_confidence",
];

const RESERVED_CATEGORIES = ["__missing__", "__other__"];

function toNumber(value, fallback = Number.NaN) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function normalizeCategory(value) {
  const text = String(value ?? "").trim().toLowerCase();

  if (!text) {
    return "__missing__";
  }

  return text;
}

function deriveDayType(timeValue, fallback = "__missing__") {
  if (timeValue instanceof Date && !Number.isNaN(timeValue.getTime())) {
    return timeValue.getDay() === 0 || timeValue.getDay() === 6 ? "weekend" : "weekday";
  }

  const parsedDate = new Date(timeValue);

  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.getDay() === 0 || parsedDate.getDay() === 6 ? "weekend" : "weekday";
  }

  const normalizedFallback = normalizeCategory(fallback);
  return normalizedFallback === "__missing__" ? "weekday" : normalizedFallback;
}

function deriveTimeFeatures(source = {}) {
  const timeValue = source.timeStamp || source.time || source.timestamp || source.date || source.datetime;
  const parsedDate = new Date(timeValue);

  const dayOfWeek = Number.isFinite(toNumber(source.dayOfWeek))
    ? toNumber(source.dayOfWeek)
    : !Number.isNaN(parsedDate.getTime())
      ? parsedDate.getDay()
      : Number.NaN;

  const hourOfDay = Number.isFinite(toNumber(source.hourOfDay))
    ? toNumber(source.hourOfDay)
    : !Number.isNaN(parsedDate.getTime())
      ? parsedDate.getHours()
      : Number.NaN;

  const dayType = normalizeCategory(
    source.dayType || deriveDayType(timeValue, source.dayType || "weekday")
  );

  return {
    dayOfWeek,
    hourOfDay,
    dayType,
  };
}

function deriveWeatherFeatures(source = {}) {
  return {
    weather_description: normalizeCategory(
      source.weather_description || source.description || source.weather || source.condition
    ),
    temperature_2m_max: toNumber(source.temperature_2m_max),
    temperature_2m_min: toNumber(source.temperature_2m_min),
    apparent_temperature_max: toNumber(source.apparent_temperature_max),
    apparent_temperature_min: toNumber(source.apparent_temperature_min),
    precipitation_sum: toNumber(source.precipitation_sum),
    precipitation_probability_max: toNumber(source.precipitation_probability_max),
    windspeed_10m_max: toNumber(source.windspeed_10m_max),
  };
}

function deriveSegmentProfile(row = {}) {
  const latStart = toNumber(row.lat_start, Number.NaN);
  const lonStart = toNumber(row.lon_start, Number.NaN);
  const latEnd = toNumber(row.lat_end, Number.NaN);
  const lonEnd = toNumber(row.lon_end, Number.NaN);

  const midpointLat = Number.isFinite(latStart) && Number.isFinite(latEnd) ? (latStart + latEnd) / 2 : toNumber(row.lat, 0);
  const midpointLon = Number.isFinite(lonStart) && Number.isFinite(lonEnd) ? (lonStart + lonEnd) / 2 : toNumber(row.lon, 0);

  return {
    lat: Number.isFinite(midpointLat) ? midpointLat : 0,
    lon: Number.isFinite(midpointLon) ? midpointLon : 0,
    laneCount_aggregated: toNumber(row.laneCount_aggregated),
    speedLimit: toNumber(row.speedLimit),
    frc: toNumber(row.frc),
    roadType: normalizeCategory(row.roadType),
    surface: normalizeCategory(row.surface),
    oneway: toNumber(row.oneway),
    curvatureIndex: toNumber(row.curvatureIndex),
    bearing: toNumber(row.bearing),
    lengthKm: toNumber(row.lengthKm),
    intersectionCount: toNumber(row.intersectionCount),
    routeSlopePercent: toNumber(row.routeSlopePercent),
    startElevation: toNumber(row.startElevation),
    endElevation: toNumber(row.endElevation),
    map_match_confidence: toNumber(row.map_match_confidence),
  };
}

function buildFeatureSample(row = {}, overrides = {}) {
  const profile = overrides.profile || deriveSegmentProfile(row);
  const timeOverrides = overrides.time && typeof overrides.time === "object" && !Array.isArray(overrides.time)
    ? overrides.time
    : { time: overrides.time };
  const timeFeatures = deriveTimeFeatures({
    ...row,
    ...timeOverrides,
  });
  const weatherFeatures = deriveWeatherFeatures({
    ...row,
    ...overrides.weather,
  });
  const queryLat = toNumber(overrides.lat, profile.lat);
  const queryLon = toNumber(overrides.lon, profile.lon);

  return {
    lat: Number.isFinite(queryLat) ? queryLat : 0,
    lon: Number.isFinite(queryLon) ? queryLon : 0,
    ...profile,
    ...timeFeatures,
    ...weatherFeatures,
  };
}

function buildRawFeatureVector(sample, numericStats, categoricalMaps) {
  const numericVector = NUMERIC_FEATURES.map((featureName) => {
    const stats = numericStats[featureName] || { mean: 0, std: 1 };
    const rawValue = toNumber(sample[featureName], stats.mean);
    const std = stats.std && Number.isFinite(stats.std) && stats.std > 0 ? stats.std : 1;
    return (rawValue - stats.mean) / std;
  });

  const categoricalVector = CATEGORY_FEATURES.flatMap((featureName) => {
    const categoryValue = normalizeCategory(sample[featureName]);
    const categoryMap = categoricalMaps[featureName] || new Map();
    const vector = new Array(categoryMap.size).fill(0);
    const mappedIndex = categoryMap.get(categoryValue) ?? categoryMap.get("__other__");

    if (mappedIndex !== undefined) {
      vector[mappedIndex] = 1;
    }

    return vector;
  });

  return [...numericVector, ...categoricalVector];
}

function fitNumericStats(samples) {
  const stats = {};

  for (const featureName of NUMERIC_FEATURES) {
    const values = samples
      .map((sample) => toNumber(sample[featureName], Number.NaN))
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) {
      stats[featureName] = { mean: 0, std: 1 };
      continue;
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    let min = values[0];
    let max = values[0];

    for (const value of values) {
      if (value < min) {
        min = value;
      }

      if (value > max) {
        max = value;
      }
    }

    stats[featureName] = {
      mean,
      std: Math.sqrt(variance) || 1,
      min,
      max,
    };
  }

  return stats;
}

function fitCategoricalMaps(samples) {
  const maps = {};

  for (const featureName of CATEGORY_FEATURES) {
    const values = new Set(RESERVED_CATEGORIES);

    for (const sample of samples) {
      values.add(normalizeCategory(sample[featureName]));
    }

    const orderedValues = Array.from(values).sort((left, right) => {
      const reservedLeft = RESERVED_CATEGORIES.includes(left);
      const reservedRight = RESERVED_CATEGORIES.includes(right);

      if (reservedLeft && !reservedRight) {
        return -1;
      }

      if (!reservedLeft && reservedRight) {
        return 1;
      }

      return left.localeCompare(right);
    });

    maps[featureName] = new Map(orderedValues.map((value, index) => [value, index]));
  }

  return maps;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function getTargetRange(values, fallbackMin = 0, fallbackMax = 1) {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return { min: fallbackMin, max: fallbackMax };
  }

  let min = finiteValues[0];
  let max = finiteValues[0];

  for (const value of finiteValues) {
    if (value < min) {
      min = value;
    }

    if (value > max) {
      max = value;
    }
  }

  if (min === max) {
    return { min, max: min + 1 };
  }

  return { min, max };
}

function normalizeTarget(value, range) {
  const safeValue = clamp(toNumber(value, range.min), range.min, range.max);
  const denominator = range.max - range.min || 1;
  return clamp((safeValue - range.min) / denominator, 0, 1);
}

function denormalizeTarget(value, range) {
  const denominator = range.max - range.min || 1;
  return range.min + clamp(value, 0, 1) * denominator;
}

function buildFeatureSpec(samples) {
  const numericStats = fitNumericStats(samples);
  const categoricalMaps = fitCategoricalMaps(samples);
  const featureNames = [
    ...NUMERIC_FEATURES,
    ...CATEGORY_FEATURES.flatMap((featureName) =>
      Array.from(categoricalMaps[featureName].keys()).map((categoryValue) => `${featureName}__${categoryValue}`)
    ),
  ];

  return {
    numericStats,
    categoricalMaps,
    featureNames,
    inputSize: featureNames.length,
  };
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

module.exports = {
  CATEGORY_FEATURES,
  NUMERIC_FEATURES,
  buildFeatureSample,
  buildRawFeatureVector,
  buildFeatureSpec,
  clamp,
  denormalizeTarget,
  deriveSegmentProfile,
  deriveTimeFeatures,
  deriveWeatherFeatures,
  getTargetRange,
  normalizeTarget,
  normalizeCategory,
  round,
  toNumber,
};