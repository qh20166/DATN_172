const tf = require("@tensorflow/tfjs");
const NodeCache = require("node-cache");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const { getTrafficWeatherRows } = require("./csvDataService");
const {
  buildFeatureSample,
  buildFeatureSpec,
  buildRawFeatureVector,
  clamp,
  denormalizeTarget,
  deriveSegmentProfile,
  getTargetRange,
  normalizeTarget,
  round,
  toNumber,
} = require("../utils/trafficDssFeaturePipeline");

const predictionCache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });

const MODEL_CHECKPOINT_DIR = path.join(__dirname, "..", "..", ".models");
const MODEL_STATE_FILE = path.join(MODEL_CHECKPOINT_DIR, "traffic_dss_state.json");
const CONGESTION_MODEL_PATH = `file://${path.join(MODEL_CHECKPOINT_DIR, "congestion_model").replace(/\\/g, "/")}`;
const SPEED_MODEL_PATH = `file://${path.join(MODEL_CHECKPOINT_DIR, "speed_model").replace(/\\/g, "/")}`;

let initializationPromise = null;
let modelState = null;

function createAppError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function ensureCheckpointDirectory() {
  if (!fs.existsSync(MODEL_CHECKPOINT_DIR)) {
    await fsp.mkdir(MODEL_CHECKPOINT_DIR, { recursive: true });
  }
}

async function saveModelCheckpoint(state) {
  try {
    await ensureCheckpointDirectory();
    await state.congestionModel.save(CONGESTION_MODEL_PATH);
    await state.speedModel.save(SPEED_MODEL_PATH);

    const stateMetadata = {
      sampleCount: state.sampleCount,
      featureSpec: {
        numericStats: state.featureSpec.numericStats,
        categoricalMaps: Object.fromEntries(
          Object.entries(state.featureSpec.categoricalMaps).map(([key, map]) => [key, Object.fromEntries(map)])
        ),
        featureNames: state.featureSpec.featureNames,
        inputSize: state.featureSpec.inputSize,
      },
      congestionRanges: state.congestionRanges,
      speedRanges: state.speedRanges,
      savedAt: new Date().toISOString(),
    };

    await fsp.writeFile(MODEL_STATE_FILE, JSON.stringify(stateMetadata, null, 2));
    console.log("[TrafficDSS] Model checkpoint saved successfully.");
  } catch (error) {
    console.error("[TrafficDSS] Failed to save model checkpoint:", error.message);
  }
}

async function loadModelCheckpoint() {
  try {
    if (!fs.existsSync(MODEL_STATE_FILE)) {
      console.log("[TrafficDSS] No checkpoint found. Will train from scratch.");
      return null;
    }

    const stateMetadata = JSON.parse(await fsp.readFile(MODEL_STATE_FILE, "utf8"));
    const congestionModel = await tf.loadLayersModel(CONGESTION_MODEL_PATH + "/model.json");
    const speedModel = await tf.loadLayersModel(SPEED_MODEL_PATH + "/model.json");

    const categoricalMaps = Object.fromEntries(
      Object.entries(stateMetadata.featureSpec.categoricalMaps).map(([key, mapObj]) => [
        key,
        new Map(Object.entries(mapObj)),
      ])
    );

    const rows = await getTrafficWeatherRows();
    const profiles = buildRepresentativeProfiles(rows);

    const restoredState = {
      congestionModel,
      speedModel,
      featureSpec: {
        numericStats: stateMetadata.featureSpec.numericStats,
        categoricalMaps,
        featureNames: stateMetadata.featureSpec.featureNames,
        inputSize: stateMetadata.featureSpec.inputSize,
      },
      congestionRanges: stateMetadata.congestionRanges,
      speedRanges: stateMetadata.speedRanges,
      sampleCount: stateMetadata.sampleCount,
      profiles,
      fallbackProfile: profiles.length > 0 ? profiles[0] : {},
    };

    console.log(
      `[TrafficDSS] Model checkpoint loaded from ${stateMetadata.savedAt} (${stateMetadata.sampleCount} samples, ${profiles.length} profiles).`
    );

    return restoredState;
  } catch (error) {
    console.error("[TrafficDSS] Failed to load checkpoint:", error.message);
    return null;
  }
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizePredictionRequest(input = {}) {
  if (!input || typeof input !== "object") {
    throw createAppError("Prediction input must be an object.", 400);
  }

  const lat = toNumber(input.lat, Number.NaN);
  const lon = toNumber(input.lon, Number.NaN);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw createAppError("lat and lon are required numeric fields.", 400);
  }

  if (!input.time) {
    throw createAppError("time is required.", 400);
  }

  if (!input.weather || typeof input.weather !== "object") {
    throw createAppError("weather is required and must be an object.", 400);
  }

  return {
    lat,
    lon,
    time: input.time,
    weather: input.weather,
  };
}

function getFeatureCacheKey(input) {
  return stableSerialize({
    lat: round(input.lat, 5),
    lon: round(input.lon, 5),
    time: String(input.time),
    weather: input.weather,
  });
}

function buildRepresentativeProfiles(rows) {
  const groupedRows = new Map();

  for (const row of rows) {
    const segmentId = String(row.segmentId || "").trim() || `${row.lat_start}:${row.lon_start}:${row.lat_end}:${row.lon_end}`;

    if (!groupedRows.has(segmentId)) {
      groupedRows.set(segmentId, []);
    }

    groupedRows.get(segmentId).push(row);
  }

  const profiles = [];

  for (const [segmentId, segmentRows] of groupedRows.entries()) {
    const baseRow = segmentRows[0] || {};
    const profile = deriveSegmentProfile(baseRow);

    const mergedProfile = {
      ...profile,
      segmentId,
      rowCount: segmentRows.length,
    };

    profiles.push(mergedProfile);
  }

  return profiles;
}

function findNearestProfile(lat, lon, profiles) {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return null;
  }

  let bestProfile = profiles[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const profile of profiles) {
    const distance = (profile.lat - lat) ** 2 + (profile.lon - lon) ** 2;

    if (distance < bestDistance) {
      bestProfile = profile;
      bestDistance = distance;
    }
  }

  return bestProfile;
}

function buildTrainingSamples(rows) {
  const samples = [];

  for (const row of rows) {
    const currentSpeed = toNumber(row.currentSpeed, Number.NaN);
    const congestionIndex = toNumber(row.congestionIndex, Number.NaN);

    if (!Number.isFinite(currentSpeed) || !Number.isFinite(congestionIndex)) {
      continue;
    }

    const sample = buildFeatureSample(row, {
      lat: toNumber(row.lat_start, toNumber(row.lat, 0)),
      lon: toNumber(row.lon_start, toNumber(row.lon, 0)),
      time: row.timeStamp || row.time || row.timestamp,
      weather: {
        weather_description: row.weather_description,
        temperature_2m_max: row.temperature_2m_max,
        temperature_2m_min: row.temperature_2m_min,
        apparent_temperature_max: row.apparent_temperature_max,
        apparent_temperature_min: row.apparent_temperature_min,
        precipitation_sum: row.precipitation_sum,
        precipitation_probability_max: row.precipitation_probability_max,
        windspeed_10m_max: row.windspeed_10m_max,
      },
    });

    samples.push({
      features: sample,
      targets: {
        currentSpeed,
        congestionIndex,
      },
    });
  }

  return samples;
}

function createRegressionModel(inputSize) {
  const model = tf.sequential();

  model.add(
    tf.layers.dense({
      inputShape: [inputSize],
      units: 64,
      activation: "relu",
    })
  );
  model.add(tf.layers.dropout({ rate: 0.15 }));
  model.add(
    tf.layers.dense({
      units: 32,
      activation: "relu",
    })
  );
  model.add(
    tf.layers.dense({
      units: 1,
      activation: "sigmoid",
    })
  );

  model.compile({
    optimizer: tf.train.adam(Number(process.env.TRAFFIC_DSS_LEARNING_RATE || 0.001)),
    loss: "meanSquaredError",
    metrics: ["mae"],
  });

  return model;
}

async function trainModel(model, featureMatrix, targetVector, modelName) {
  const sampleCount = featureMatrix.length;
  const tensorX = tf.tensor2d(featureMatrix, [sampleCount, featureMatrix[0].length]);
  const tensorY = tf.tensor2d(targetVector, [sampleCount, 1]);
  const epochs = Number(process.env.TRAFFIC_DSS_EPOCHS || 12);
  const batchSize = Math.max(16, Math.min(128, Number(process.env.TRAFFIC_DSS_BATCH_SIZE || 64)));
  const useValidation = sampleCount > 32;

  console.log(`[TrafficDSS] Training ${modelName} with ${sampleCount} samples and ${featureMatrix[0].length} features.`);

  await model.fit(tensorX, tensorY, {
    epochs,
    batchSize,
    validationSplit: useValidation ? 0.15 : 0,
    shuffle: true,
    callbacks: useValidation
      ? [
          tf.callbacks.earlyStopping({
            monitor: "val_loss",
            patience: 2,
          }),
        ]
      : [],
  });

  tensorX.dispose();
  tensorY.dispose();
}

async function initializeTrafficDssModel() {
  if (modelState) {
    return modelState;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    await tf.ready();

    const loadedState = await loadModelCheckpoint();
    if (loadedState) {
      modelState = loadedState;
      return modelState;
    }

    const rows = await getTrafficWeatherRows();
    if (!rows.length) {
      throw createAppError("Traffic dataset is empty.", 500);
    }

    const samples = buildTrainingSamples(rows);
    if (!samples.length) {
      throw createAppError("No valid training rows were found in the traffic dataset.", 500);
    }

    const featureSpec = buildFeatureSpec(samples.map((sample) => sample.features));
    const congestionRanges = getTargetRange(samples.map((sample) => sample.targets.congestionIndex), 0, 1);
    const speedRanges = getTargetRange(samples.map((sample) => sample.targets.currentSpeed), 0, 1);

    const featureMatrix = samples.map((sample) => buildRawFeatureVector(sample.features, featureSpec.numericStats, featureSpec.categoricalMaps));
    const congestionTargets = samples.map((sample) => [normalizeTarget(sample.targets.congestionIndex, congestionRanges)]);
    const speedTargets = samples.map((sample) => [normalizeTarget(sample.targets.currentSpeed, speedRanges)]);

    const congestionModel = createRegressionModel(featureSpec.inputSize);
    const speedModel = createRegressionModel(featureSpec.inputSize);

    await trainModel(congestionModel, featureMatrix, congestionTargets, "congestionIndex model");
    await trainModel(speedModel, featureMatrix, speedTargets, "speed model");

    const profiles = buildRepresentativeProfiles(rows);
    const fallbackProfile = profiles.reduce(
      (accumulator, profile) => {
        accumulator.lat += Number.isFinite(profile.lat) ? profile.lat : 0;
        accumulator.lon += Number.isFinite(profile.lon) ? profile.lon : 0;
        accumulator.laneCount_aggregated += Number.isFinite(profile.laneCount_aggregated) ? profile.laneCount_aggregated : 0;
        accumulator.speedLimit += Number.isFinite(profile.speedLimit) ? profile.speedLimit : 0;
        accumulator.frc += Number.isFinite(profile.frc) ? profile.frc : 0;
        accumulator.oneway += Number.isFinite(profile.oneway) ? profile.oneway : 0;
        accumulator.curvatureIndex += Number.isFinite(profile.curvatureIndex) ? profile.curvatureIndex : 0;
        accumulator.bearing += Number.isFinite(profile.bearing) ? profile.bearing : 0;
        accumulator.lengthKm += Number.isFinite(profile.lengthKm) ? profile.lengthKm : 0;
        accumulator.intersectionCount += Number.isFinite(profile.intersectionCount) ? profile.intersectionCount : 0;
        accumulator.routeSlopePercent += Number.isFinite(profile.routeSlopePercent) ? profile.routeSlopePercent : 0;
        accumulator.startElevation += Number.isFinite(profile.startElevation) ? profile.startElevation : 0;
        accumulator.endElevation += Number.isFinite(profile.endElevation) ? profile.endElevation : 0;
        accumulator.map_match_confidence += Number.isFinite(profile.map_match_confidence) ? profile.map_match_confidence : 0;
        accumulator.count += 1;
        return accumulator;
      },
      {
        lat: 0,
        lon: 0,
        laneCount_aggregated: 0,
        speedLimit: 0,
        frc: 0,
        oneway: 0,
        curvatureIndex: 0,
        bearing: 0,
        lengthKm: 0,
        intersectionCount: 0,
        routeSlopePercent: 0,
        startElevation: 0,
        endElevation: 0,
        map_match_confidence: 0,
        count: 0,
      }
    );

    if (fallbackProfile.count > 0) {
      fallbackProfile.lat /= fallbackProfile.count;
      fallbackProfile.lon /= fallbackProfile.count;
      fallbackProfile.laneCount_aggregated /= fallbackProfile.count;
      fallbackProfile.speedLimit /= fallbackProfile.count;
      fallbackProfile.frc /= fallbackProfile.count;
      fallbackProfile.oneway /= fallbackProfile.count;
      fallbackProfile.curvatureIndex /= fallbackProfile.count;
      fallbackProfile.bearing /= fallbackProfile.count;
      fallbackProfile.lengthKm /= fallbackProfile.count;
      fallbackProfile.intersectionCount /= fallbackProfile.count;
      fallbackProfile.routeSlopePercent /= fallbackProfile.count;
      fallbackProfile.startElevation /= fallbackProfile.count;
      fallbackProfile.endElevation /= fallbackProfile.count;
      fallbackProfile.map_match_confidence /= fallbackProfile.count;
    }

    modelState = {
      congestionModel,
      speedModel,
      featureSpec,
      congestionRanges,
      speedRanges,
      profiles,
      fallbackProfile,
      sampleCount: samples.length,
    };

    console.log(
      `[TrafficDSS] Model initialized with ${samples.length} samples and ${profiles.length} segment profiles.`
    );

    await saveModelCheckpoint(modelState);

    return modelState;
  })();

  try {
    return await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

function buildPredictionFeatures(requestInput) {
  if (!modelState) {
    throw createAppError("Traffic DSS model is not initialized.", 503);
  }

  const nearestProfile = findNearestProfile(requestInput.lat, requestInput.lon, modelState.profiles) || modelState.fallbackProfile;
  const featureSample = buildFeatureSample(
    {
      ...nearestProfile,
      time: requestInput.time,
      weather_description: requestInput.weather?.weather_description,
      temperature_2m_max: requestInput.weather?.temperature_2m_max,
      temperature_2m_min: requestInput.weather?.temperature_2m_min,
      apparent_temperature_max: requestInput.weather?.apparent_temperature_max,
      apparent_temperature_min: requestInput.weather?.apparent_temperature_min,
      precipitation_sum: requestInput.weather?.precipitation_sum,
      precipitation_probability_max: requestInput.weather?.precipitation_probability_max,
      windspeed_10m_max: requestInput.weather?.windspeed_10m_max,
    },
    {
      lat: requestInput.lat,
      lon: requestInput.lon,
      time: requestInput.time,
      weather: requestInput.weather,
      profile: nearestProfile || modelState.fallbackProfile,
    }
  );

  const featureVector = buildRawFeatureVector(featureSample, modelState.featureSpec.numericStats, modelState.featureSpec.categoricalMaps);

  return {
    featureSample,
    featureVector,
    nearestProfile,
  };
}

function scoreToCongestionLevel(score) {
  if (score >= 0.75) {
    return "CRITICAL";
  }

  if (score >= 0.5) {
    return "HIGH";
  }

  if (score >= 0.25) {
    return "MEDIUM";
  }

  return "LOW";
}

async function predictTraffic(input) {
  const requestInput = normalizePredictionRequest(input);
  await initializeTrafficDssModel();

  const cacheKey = getFeatureCacheKey(requestInput);
  const cachedResult = predictionCache.get(cacheKey);

  if (cachedResult) {
    console.log("[TrafficDSS] Cache hit for prediction.");
    return cachedResult;
  }

  const { featureSample, featureVector, nearestProfile } = buildPredictionFeatures(requestInput);

  console.log("[TrafficDSS] Prediction input features:", {
    lat: featureSample.lat,
    lon: featureSample.lon,
    dayOfWeek: featureSample.dayOfWeek,
    hourOfDay: featureSample.hourOfDay,
    dayType: featureSample.dayType,
    weather_description: featureSample.weather_description,
    roadType: featureSample.roadType,
    surface: featureSample.surface,
  });

  const output = tf.tidy(() => {
    const tensor = tf.tensor2d([featureVector], [1, featureVector.length]);
    const congestionTensor = modelState.congestionModel.predict(tensor);
    const speedTensor = modelState.speedModel.predict(tensor);
    const congestionScore = Number(congestionTensor.dataSync()[0]);
    const speedScore = Number(speedTensor.dataSync()[0]);

    return {
      congestionScore: clamp(congestionScore, 0, 1),
      speedScore: clamp(speedScore, 0, 1),
    };
  });

  const congestionLevel = scoreToCongestionLevel(output.congestionScore);
  const predictedSpeed = denormalizeTarget(output.speedScore, modelState.speedRanges);
  const riskScore = clamp((output.congestionScore * 0.7) + ((1 - output.speedScore) * 0.3), 0, 1);

  const result = {
    congestion_level: congestionLevel,
    predicted_speed: round(predictedSpeed, 2),
    risk_score: round(riskScore, 3),
    nearest_segment_id: nearestProfile?.segmentId || null,
  };

  if (!Number.isFinite(result.predicted_speed)) {
    throw createAppError("Model produced an invalid predicted_speed value.", 500);
  }

  if (!Number.isFinite(result.risk_score)) {
    throw createAppError("Model produced an invalid risk_score value.", 500);
  }

  console.log("[TrafficDSS] Prediction output:", result);

  predictionCache.set(cacheKey, result);

  return result;
}

async function predictTrafficBatch(inputs) {
  if (!Array.isArray(inputs)) {
    throw createAppError("Batch prediction input must be an array.", 400);
  }

  const predictions = await Promise.all(
    inputs.map(async (item, index) => {
      try {
        return {
          index,
          ...(await predictTraffic(item)),
        };
      } catch (error) {
        return {
          index,
          error: error.message,
        };
      }
    })
  );

  return {
    count: predictions.length,
    predictions,
  };
}

module.exports = {
  initializeTrafficDssModel,
  predictTraffic,
  predictTrafficBatch,
};