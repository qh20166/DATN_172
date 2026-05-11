import { useEffect, useMemo, useState } from 'react';
import { decisionRecommendationsRequest, decisionSummaryRequest } from './api';

function getDefaultParams() {
  const now = new Date();
  const day = now.getDay();
  const dayType = day === 0 || day === 6 ? 'Weekend' : 'Weekday';

  return {
    dayType,
    hourOfDay: now.getHours(),
    minLevel: 'high',
    limit: 10,
  };
}

export function useDecisionData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const params = getDefaultParams();
        const [summary, recommendations] = await Promise.all([
          decisionSummaryRequest(params),
          decisionRecommendationsRequest(params),
        ]);

        if (active) {
          setData({
            summary,
            recommendations,
            filters: params,
          });
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Khong the tai du lieu ho tro quyet dinh.');
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

  const hasData = useMemo(() => Boolean(data?.recommendations?.data?.length), [data]);

  return {
    data,
    loading,
    error,
    hasData,
  };
}
