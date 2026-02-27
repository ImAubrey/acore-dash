export function OutboundMixCard({ outboundMix, buildConicGradient, CHART_COLORS, outboundTotal }) {
  return (
    <section className="panel span-5 chart-panel chart-panel" style={{ '--delay': '0.14s' }}>
      <div className="panel-header">
        <div>
          <h2>Outbound mix</h2>
          <p>Distribution of available outbound types.</p>
        </div>
      </div>
      <div className="donut-wrap">
        <div className="donut" style={{ background: buildConicGradient(outboundMix, CHART_COLORS) }}>
          <div className="donut-center">
            <span>Total</span>
            <strong>{outboundTotal}</strong>
          </div>
        </div>
        <div className="legend">
          {outboundMix.length === 0 ? (
            <div className="legend-empty">No outbounds loaded.</div>
          ) : (
            outboundMix.map((item, index) => (
              <div className="legend-row" key={`${item.label}-${index}`}>
                <span
                  className="legend-dot"
                  style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                <span>{item.label}</span>
                <span className="legend-value">
                  {Math.round((item.value / outboundTotal) * 100)}
                  %
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}


