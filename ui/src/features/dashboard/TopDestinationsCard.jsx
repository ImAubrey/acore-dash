export function TopDestinationsCard({ topDestinations, truncateLabel }) {
  return (
    <section className="panel span-7 chart-panel chart-panel" style={{ '--delay': '0.12s' }}>
      <div className="panel-header">
        <div>
          <h2>Top destinations</h2>
          <p>Most active destinations by connection count.</p>
        </div>
      </div>
      {topDestinations.length === 0 ? (
        <div className="chart-empty">No destination traffic yet.</div>
      ) : (
        <div className="bar-chart horizontal">
          {topDestinations.map((item, index) => (
            <div className="bar-item horizontal" key={`${item.label}-${index}`}>
              <div className="bar-header">
                <span className="bar-label" title={item.label}>
                  {truncateLabel(item.label, 22)}
                </span>
                <span className="bar-value">
                  {Math.round(item.percent)}% ({item.count})
                </span>
              </div>
              <div className="bar-rod horizontal">
                <span
                  className="bar-fill horizontal"
                  style={{ width: `${item.percent}%`, '--fill': item.ratio }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


