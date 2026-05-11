function getSeverityClass(score = 0) {
  if (score >= 0.8) {
    return 'border-rose-300 bg-rose-50 text-rose-700';
  }

  if (score >= 0.5) {
    return 'border-amber-300 bg-amber-50 text-amber-700';
  }

  return 'border-emerald-300 bg-emerald-50 text-emerald-700';
}

function IncidentAlertPanel({ incidentData, loading }) {
  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Detecting incidents...</div>;
  }

  if (!incidentData) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No incident analysis yet.</div>;
  }

  const score = Number(incidentData.anomaly_score || 0);
  const isRisk = Boolean(incidentData.incident_risk);

  return (
    <section className={`rounded-2xl border p-5 ${getSeverityClass(score)}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">Incident Alert</p>
      <h3 className="mt-2 text-lg font-semibold">
        {isRisk ? 'Potential incident detected' : 'No critical incident detected'}
      </h3>
      <p className="mt-2 text-sm">Anomaly score: {(score * 100).toFixed(1)}%</p>
      {isRisk ? (
        <p className="mt-2 text-sm font-medium">Recommendation: deploy monitoring team and validate nearby CCTV feeds.</p>
      ) : (
        <p className="mt-2 text-sm font-medium">Recommendation: continue passive monitoring.</p>
      )}
    </section>
  );
}

export default IncidentAlertPanel;
