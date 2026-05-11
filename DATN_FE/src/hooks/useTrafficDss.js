import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getTrafficWeatherLatest,
  normalizeApiError,
  predictTraffic,
  predictTrafficBatch,
} from '../services/api';

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeWeatherRow(weatherRow = {}) {
  const source = weatherRow?.data?.[0] || weatherRow;

  const temperatureMax = Number(source.temperature_2m_max ?? source.temperatureMax ?? 33);
  const temperatureMin = Number(source.temperature_2m_min ?? source.temperatureMin ?? 26);

  return {
    weather_description: source.weather_description || source.weatherDescription || 'clear sky',
    temperature_2m_max: Number.isFinite(temperatureMax) ? temperatureMax : 33,
    temperature_2m_min: Number.isFinite(temperatureMin) ? temperatureMin : 26,
    apparent_temperature_max: Number(source.apparent_temperature_max ?? source.apparentTemperatureMax ?? (Number.isFinite(temperatureMax) ? temperatureMax + 2 : 35)),
    apparent_temperature_min: Number(source.apparent_temperature_min ?? source.apparentTemperatureMin ?? (Number.isFinite(temperatureMin) ? temperatureMin + 1 : 27)),
    precipitation_sum: Number(source.precipitation_sum ?? source.precipitation ?? 0) || 0,
    precipitation_probability_max: Number(source.precipitation_probability_max ?? source.precipitationProbabilityMax ?? 5) || 5,
    windspeed_10m_max: Number(source.windspeed_10m_max ?? source.windSpeedMax ?? 12) || 12,
  };
}

function buildPredictPayload(place, weatherSnapshot) {
  if (!place?.lat || !place?.lon) {
    return null;
  }

  return {
    lat: Number(place.lat),
    lon: Number(place.lon),
    time: new Date().toISOString(),
    weather: normalizeWeatherRow(weatherSnapshot),
  };
}

function createDummyPrediction(place, label) {
  const isOrigin = label === 'origin';

  return {
    place: place?.name || (isOrigin ? 'Điểm đi' : 'Điểm đến'),
    predicted_congestion: isOrigin ? 'MEDIUM' : 'HIGH',
    predicted_speed: isOrigin ? 28 : 18,
    risk_score: isOrigin ? 56 : 84,
    nearest_segment_id: `dummy-${label}`,
  };
}

function mapBatchPredictions(items, predictions) {
  const next = {};

  items.forEach((item, index) => {
    const prediction = predictions[index];
    if (!item.place || !prediction) {
      return;
    }

    next[item.key] = {
      place: item.place.name || (item.key === 'origin' ? 'Điểm đi' : 'Điểm đến'),
      ...prediction,
    };
  });

  return next;
}

export function useTrafficDss() {
  const [trafficInput, setTrafficInput] = useState({
    origin: null,
    destination: null,
    originText: '',
    destinationText: '',
  });
  const [predictionData, setPredictionData] = useState({
    origin: null,
    destination: null,
    batch: null,
  });
  const [weatherSnapshot, setWeatherSnapshot] = useState(null);
  const [loading, setLoading] = useState({
    origin: false,
    destination: false,
    batch: false,
  });
  const [error, setError] = useState('');
  const [predictionError, setPredictionError] = useState('');
  const [weatherError, setWeatherError] = useState('');
  const [useDummyData, setUseDummyData] = useState(false);

  const originTimeoutRef = useRef(null);
  const destinationTimeoutRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadWeatherSnapshot() {
      try {
        if (useDummyData) {
          if (active) {
            setWeatherError('');
            setWeatherSnapshot(normalizeWeatherRow());
          }
          return;
        }

        const payload = await getTrafficWeatherLatest(1);
        if (active) {
          setWeatherError('');
          setWeatherSnapshot(normalizeWeatherRow(payload));
        }
      } catch (err) {
        if (active) {
          setWeatherError(normalizeApiError(err));
          setWeatherSnapshot(normalizeWeatherRow());
        }
      }
    }

    loadWeatherSnapshot();

    return () => {
      active = false;
    };
  }, [useDummyData]);

  const updateInputField = useCallback((field, value) => {
    setTrafficInput((prev) => {
      if (field === 'originText') {
        return { ...prev, originText: value, origin: null };
      }

      if (field === 'destinationText') {
        return { ...prev, destinationText: value, destination: null };
      }

      if (field === 'origin') {
        return { ...prev, origin: value, ...(value?.name ? { originText: value.name } : {}) };
      }

      if (field === 'destination') {
        return { ...prev, destination: value, ...(value?.name ? { destinationText: value.name } : {}) };
      }

      return { ...prev, [field]: value };
    });
  }, []);

  const runOriginPrediction = useCallback(async (place) => {
    const payload = buildPredictPayload(place, weatherSnapshot);
    if (!payload) {
      return null;
    }

    if (useDummyData) {
      await wait(250);
      return createDummyPrediction(place, 'origin');
    }

    return predictTraffic(payload);
  }, [useDummyData, weatherSnapshot]);

  const runDestinationPrediction = useCallback(async (place) => {
    const payload = buildPredictPayload(place, weatherSnapshot);
    if (!payload) {
      return null;
    }

    if (useDummyData) {
      await wait(250);
      return createDummyPrediction(place, 'destination');
    }

    return predictTraffic(payload);
  }, [useDummyData, weatherSnapshot]);

  useEffect(() => {
    if (originTimeoutRef.current) {
      clearTimeout(originTimeoutRef.current);
    }

    const origin = trafficInput.origin;
    if (!origin || !origin.lat || !origin.lon || !weatherSnapshot) {
      setPredictionData((prev) => ({ ...prev, origin: null }));
      setLoading((prev) => ({ ...prev, origin: false }));
      return undefined;
    }

    setLoading((prev) => ({ ...prev, origin: true }));
    setPredictionError('');

    originTimeoutRef.current = window.setTimeout(async () => {
      try {
        const result = await runOriginPrediction(origin);
        if (result) {
          setPredictionData((prev) => ({
            ...prev,
            origin: {
              place: origin.name || 'Điểm đi',
              ...result,
            },
          }));
        }
      } catch (err) {
        setPredictionError(`Origin prediction failed: ${normalizeApiError(err)}`);
      } finally {
        setLoading((prev) => ({ ...prev, origin: false }));
      }
    }, 400);

    return () => {
      if (originTimeoutRef.current) {
        clearTimeout(originTimeoutRef.current);
      }
    };
  }, [runOriginPrediction, trafficInput.origin, weatherSnapshot]);

  useEffect(() => {
    if (destinationTimeoutRef.current) {
      clearTimeout(destinationTimeoutRef.current);
    }

    const destination = trafficInput.destination;
    if (!destination || !destination.lat || !destination.lon || !weatherSnapshot) {
      setPredictionData((prev) => ({ ...prev, destination: null }));
      setLoading((prev) => ({ ...prev, destination: false }));
      return undefined;
    }

    setLoading((prev) => ({ ...prev, destination: true }));
    setPredictionError('');

    destinationTimeoutRef.current = window.setTimeout(async () => {
      try {
        const result = await runDestinationPrediction(destination);
        if (result) {
          setPredictionData((prev) => ({
            ...prev,
            destination: {
              place: destination.name || 'Điểm đến',
              ...result,
            },
          }));
        }
      } catch (err) {
        setPredictionError(`Destination prediction failed: ${normalizeApiError(err)}`);
      } finally {
        setLoading((prev) => ({ ...prev, destination: false }));
      }
    }, 400);

    return () => {
      if (destinationTimeoutRef.current) {
        clearTimeout(destinationTimeoutRef.current);
      }
    };
  }, [runDestinationPrediction, trafficInput.destination, weatherSnapshot]);

  const runBatchPrediction = useCallback(async () => {
    setError('');
    setPredictionError('');

    const items = [
      trafficInput.origin ? { key: 'origin', place: trafficInput.origin } : null,
      trafficInput.destination ? { key: 'destination', place: trafficInput.destination } : null,
    ].filter(Boolean);

    if (!items.length) {
      setError('Vui lòng chọn điểm đi hoặc điểm đến trước khi dự báo.');
      return;
    }

    if (!weatherSnapshot) {
      setError('Chưa có dữ liệu thời tiết để dự báo.');
      return;
    }

    setLoading((prev) => ({ ...prev, batch: true }));

    try {
      const payloadItems = items.map((item) => buildPredictPayload(item.place, weatherSnapshot));

      const result = useDummyData
        ? await wait(300).then(() => ({
          count: payloadItems.length,
          predictions: payloadItems.map((payload, index) => ({
            index,
            congestion_level: index === 0 ? 'MEDIUM' : 'HIGH',
            predicted_speed: index === 0 ? 28 : 18,
            risk_score: index === 0 ? 56 : 84,
            nearest_segment_id: `dummy-batch-${index + 1}`,
            ...payload,
          })),
        }))
        : await predictTrafficBatch(payloadItems);

      const predictions = Array.isArray(result.predictions) ? result.predictions : [];

      setPredictionData((prev) => ({
        ...prev,
        ...mapBatchPredictions(items, predictions),
        batch: {
          count: result.count ?? predictions.length,
          predictions,
        },
      }));
    } catch (err) {
      setPredictionError(normalizeApiError(err));
    } finally {
      setLoading((prev) => ({ ...prev, batch: false }));
    }
  }, [trafficInput.destination, trafficInput.origin, useDummyData, weatherSnapshot]);

  const summary = useMemo(() => {
    const candidates = [predictionData.origin, predictionData.destination].filter(Boolean);

    if (!candidates.length) {
      return {
        label: 'Chưa có dự báo',
        congestion: 'UNKNOWN',
        predictedSpeed: null,
        riskScore: null,
        place: null,
      };
    }

    const riskiest = [...candidates].sort((left, right) => Number(right.risk_score || 0) - Number(left.risk_score || 0))[0];

    return {
      label: riskiest?.place || 'Điểm có rủi ro cao nhất',
      congestion: riskiest?.predicted_congestion || 'UNKNOWN',
      predictedSpeed: riskiest?.predicted_speed ?? null,
      riskScore: riskiest?.risk_score ?? null,
      place: riskiest?.place || null,
    };
  }, [predictionData.destination, predictionData.origin]);

  return {
    trafficInput,
    predictionData,
    loading,
    error,
    predictionError,
    weatherError,
    useDummyData,
    setUseDummyData,
    updateInputField,
    runBatchPrediction,
    summary,
  };
}