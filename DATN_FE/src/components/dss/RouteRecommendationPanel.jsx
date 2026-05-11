function getLevelPill(level) {
  const normalized = String(level || '').toUpperCase();

  if (normalized === 'LOW') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (normalized === 'MEDIUM') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-rose-100 text-rose-700';
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return '--';
  }

  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

function RouteItem({ route, isBest }) {
  const sourceLabel = route.source === 'dss'
    ? 'DSS matched'
    : route.source === 'default'
      ? 'Default smooth'
      : route.source === 'google'
        ? 'Google Maps'
        : route.source === 'osrm'
          ? 'OSRM fallback'
          : null;

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-slate-900">{route.name || route.id || 'Unnamed route'}</h4>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLevelPill(route.congestion_level)}`}>
          {(route.congestion_level || 'UNKNOWN').toUpperCase()}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        ETA: <strong>{formatDuration(route.eta)}</strong> | Distance: <strong>{route.distance_km ?? '--'} km</strong>
      </p>
      {sourceLabel ? <p className="mt-1 text-xs font-medium text-slate-500">Source: {sourceLabel}</p> : null}
      {route.note ? <p className="mt-1 text-xs font-medium text-slate-500">{route.note}</p> : null}
      {isBest ? <p className="mt-2 text-xs font-semibold text-sky-700">Best route selected by DSS</p> : null}
    </article>
  );
}

function RouteRecommendationPanel({ routeData, loading }) {
  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Calculating route recommendations...</div>;
  }

  const bestRoute = routeData?.best_route;
  const alternatives = routeData?.alternatives || [];

  if (!bestRoute && !alternatives.length) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No route recommendation yet.</div>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Best Route Recommendation</h3>
      <p className="mt-1 text-sm text-slate-500">Tuyến tối ưu cho cặp điểm đi và điểm đến đã chọn.</p>

      <div className="mt-4 space-y-3">
        {bestRoute ? <RouteItem route={bestRoute} isBest /> : null}
        {alternatives.map((route) => (
          <RouteItem key={route.id || route.name} route={route} isBest={false} />
        ))}
        {!alternatives.length ? <p className="text-sm text-slate-500">Không có tuyến thay thế trong phiên này.</p> : null}
      </div>
    </section>
  );
}

export default RouteRecommendationPanel;
