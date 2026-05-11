import { useMemo } from 'react';
import TrafficInputForm from '../components/dss/TrafficInputForm';
import { useTrafficDss } from '../hooks/useTrafficDss';

function formatRiskScore(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return `${Math.round(value)}%`;
}

function congestionClass(level) {
  const value = String(level || '').toUpperCase();

  if (value === 'LOW') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (value === 'MEDIUM') {
    return 'bg-amber-100 text-amber-700';
  }

  if (value === 'HIGH' || value === 'CRITICAL') {
    return 'bg-rose-100 text-rose-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function PredictionCard({ title, data, loading }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
        {loading ? (
          <span className="flex items-center gap-2 text-sm text-sky-700">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
            Đang dự báo
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Congestion</p>
          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${congestionClass(data?.predicted_congestion)}`}>
            {String(data?.predicted_congestion || 'UNKNOWN').toUpperCase()}
          </span>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Predicted speed</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {Number.isFinite(data?.predicted_speed) ? `${Math.round(data.predicted_speed)} km/h` : '--'}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Risk score</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{formatRiskScore(data?.risk_score)}</p>
        </div>
      </div>

      {data?.nearest_segment_id ? (
        <p className="mt-4 text-xs font-medium text-slate-500">Nearest segment: {data.nearest_segment_id}</p>
      ) : null}
    </article>
  );
}

function BatchCard({ batchData }) {
  const predictions = Array.isArray(batchData?.predictions) ? batchData.predictions : [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Batch prediction</h3>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {predictions.length ? predictions.map((item, index) => (
          <div key={`${item.nearest_segment_id || index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-900">#{index + 1}</h4>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${congestionClass(item.congestion_level || item.predicted_congestion)}`}>
                {String(item.congestion_level || item.predicted_congestion || 'UNKNOWN').toUpperCase()}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <p className="text-sm text-slate-600">Speed: <strong>{Number.isFinite(item.predicted_speed) ? `${Math.round(item.predicted_speed)} km/h` : '--'}</strong></p>
              <p className="text-sm text-slate-600">Risk: <strong>{formatRiskScore(item.risk_score)}</strong></p>
              <p className="text-sm text-slate-600">Segment: <strong>{item.nearest_segment_id || '--'}</strong></p>
            </div>
          </div>
        )) : <p className="text-sm text-slate-500">Chưa có batch prediction.</p>}
      </div>
    </section>
  );
}

function AnalysisPage() {
  const {
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
  } = useTrafficDss();

  const summaryText = useMemo(() => {
    if (!summary.place) {
      return 'Chưa có điểm nào được dự báo.';
    }

    return `${summary.place}: ${String(summary.congestion || 'UNKNOWN').toUpperCase()} | ${Number.isFinite(summary.predictedSpeed) ? `${Math.round(summary.predictedSpeed)} km/h` : '--'} | ${formatRiskScore(summary.riskScore)}`;
  }, [summary]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-100 via-white to-sky-100 px-4 py-6 md:px-6">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Traffic ML Support</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">Dự báo giao thông</h2>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runBatchPrediction}
              disabled={loading.batch}
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading.batch ? 'Đang dự báo...' : 'Dự báo cả 2 điểm'}
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          ) : null}

          {predictionError ? (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{predictionError}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-700">{summaryText}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <PredictionCard title="Điểm đi" data={predictionData.origin} loading={loading.origin} />
          <PredictionCard title="Điểm đến" data={predictionData.destination} loading={loading.destination} />
        </div>

        <BatchCard batchData={predictionData.batch} />

        {weatherError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Weather snapshot fallback: {weatherError}
          </p>
        ) : null}

        <TrafficInputForm
          value={trafficInput}
          onChange={updateInputField}
          onSubmit={runBatchPrediction}
          loading={loading.batch}
        />
      </section>
    </div>
  );
}

export default AnalysisPage;