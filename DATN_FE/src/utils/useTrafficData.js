import { useEffect, useMemo, useState } from 'react';
import { normalizeTrafficLevel } from './traffic';

function normalizeSegment(segment = {}) {
  const latStart = Number(segment.latStart ?? segment.lat_start);
  const lonStart = Number(segment.lonStart ?? segment.lon_start ?? segment.lngStart ?? segment.lng_start);
  const latEnd = Number(segment.latEnd ?? segment.lat_end);
  const lonEnd = Number(segment.lonEnd ?? segment.lon_end ?? segment.lngEnd ?? segment.lng_end);
  const geometry = Array.isArray(segment.geometry)
    ? segment.geometry
    : [
      [latStart, lonStart],
      [latEnd, lonEnd],
    ].filter((point) => point.every(Number.isFinite));

  return {
    ...segment,
    latStart: Number.isFinite(latStart) ? latStart : segment.latStart,
    lonStart: Number.isFinite(lonStart) ? lonStart : segment.lonStart,
    latEnd: Number.isFinite(latEnd) ? latEnd : segment.latEnd,
    lonEnd: Number.isFinite(lonEnd) ? lonEnd : segment.lonEnd,
    level: normalizeTrafficLevel(segment.level ?? segment.congestion_level),
    geometry,
  };
}

export function useTrafficData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch('/traffic_summary.json');
        if (!response.ok) {
          throw new Error('Không tải được dữ liệu.');
        }

        const json = await response.json();
        if (active) {
          setData({
            ...json,
            segments: Array.isArray(json?.segments) ? json.segments.map(normalizeSegment) : [],
          });
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Lỗi không xác định');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const hasData = useMemo(() => Boolean(data?.segments?.length), [data]);

  return {
    data,
    loading,
    error,
    hasData,
  };
}
