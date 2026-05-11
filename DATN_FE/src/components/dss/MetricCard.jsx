function getBadgeClass(level) {
  const normalized = String(level || '').toUpperCase();

  if (normalized === 'LOW') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (normalized === 'MEDIUM') {
    return 'bg-amber-100 text-amber-700';
  }

  if (normalized === 'HIGH' || normalized === 'CRITICAL') {
    return 'bg-rose-100 text-rose-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function MetricCard({ title, value, subtitle, level }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-3 flex items-center gap-2">
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {level ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getBadgeClass(level)}`}>
            {String(level).toUpperCase()}
          </span>
        ) : null}
      </div>
      {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
    </article>
  );
}

export default MetricCard;
