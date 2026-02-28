export function SessionHealthCard({
  gaugeDegrees,
  utilization,
  latestSpeed,
  averageSpeed,
  totalSessions,
  connStreamPaused,
  connStreamLabel,
  formatRate
}) {
  return (
    <section className="panel span-5 chart-panel session-health-panel" style={{ '--delay': '0.1s' }}>
      <div className="panel-header">
        <div>
          <h2>Session health</h2>
          <p>Utilization ratio and live stability indicators.</p>
        </div>
      </div>
      <div className="gauge-wrap">
        <div className="gauge-ring" style={{ '--value': `${gaugeDegrees}deg` }} />
        <div className="gauge-center">
          <span className="gauge-label">Utilization</span>
          <strong>{Math.round(utilization * 100)}%</strong>
          <span className="gauge-meta">{formatRate(latestSpeed)} live</span>
        </div>
      </div>
      <div className="gauge-stats">
        <div>
          <span>Average</span>
          <strong>{formatRate(averageSpeed)}</strong>
        </div>
        <div>
          <span>Sessions</span>
          <strong>{totalSessions}</strong>
        </div>
        <div>
          <span>Stream</span>
          <strong>{connStreamPaused ? 'Paused' : connStreamLabel}</strong>
        </div>
      </div>
    </section>
  );
}
