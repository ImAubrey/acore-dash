export function ProtocolSplitCard({ protocolTotal, protocolMix, clamp, CHART_COLORS }) {
  return (
    <section className="panel span-12 chart-panel chart-panel" style={{ '--delay': '0.16s' }}>
      <div className="panel-header">
        <div>
          <h2>Protocol split</h2>
          <p>Connections by network or transport type.</p>
        </div>
        <div className="chart-meta">
          <span className="meta-pill">Total {protocolTotal}</span>
        </div>
      </div>
      {protocolMix.length === 0 ? (
        <div className="chart-empty">No protocol detail yet.</div>
      ) : (
        <div className="split-list">
          {protocolMix.map((item, index) => (
            <div className="split-row" key={`${item.label}-${index}`}>
              <span className="split-label">{item.label}</span>
              <div className="split-track">
                <span
                  className="split-fill"
                  style={{
                    transform: `scaleX(${clamp(item.percent / 100, 0, 1)})`,
                    background: CHART_COLORS[index % CHART_COLORS.length]
                  }}
                />
              </div>
              <span className="split-value">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

