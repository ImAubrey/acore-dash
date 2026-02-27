export function TrafficTempoCard({
  formatRate,
  latestSpeed,
  peakSpeed,
  trafficSeries,
  trafficChart,
  TRAFFIC_CLIP_ID,
  trafficShiftActive,
  trafficShift,
  TRAFFIC_ANIMATION_MS,
  latestSample,
  visibleSamples
}) {
  return (
    <section className="panel span-7 chart-panel chart-panel" style={{ '--delay': '0.08s' }}>
      <div className="panel-header">
        <div>
          <h2>Traffic tempo</h2>
          <p>Live throughput per second, upload vs download.</p>
        </div>
        <div className="chart-meta">
          <span className="meta-pill">Now {formatRate(latestSpeed)}</span>
          <span className="meta-pill">Peak {formatRate(peakSpeed)}</span>
        </div>
      </div>
      <div className="chart-wrap">
        {trafficSeries.length < 2 ? (
          <div className="chart-empty">Waiting for live samples...</div>
        ) : (
          <svg
            className="traffic-chart"
            viewBox={`0 0 ${trafficChart.width} ${trafficChart.height}`}
            role="img"
            aria-label="Throughput chart"
          >
            <defs>
              <linearGradient id="uploadGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff6b4a" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ff6b4a" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="downloadGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2f9aa0" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#2f9aa0" stopOpacity="0.02" />
              </linearGradient>
              <clipPath id={TRAFFIC_CLIP_ID} clipPathUnits="userSpaceOnUse">
                <rect
                  x={trafficChart.padding}
                  y={trafficChart.padding}
                  width={trafficChart.width - trafficChart.padding * 2}
                  height={trafficChart.height - trafficChart.padding * 2}
                />
              </clipPath>
            </defs>
            <g className="chart-grid">
              {trafficChart.ticks.map((tick) => (
                <line
                  key={`grid-${tick.y}`}
                  x1={trafficChart.padding}
                  y1={tick.y}
                  x2={trafficChart.width - trafficChart.padding}
                  y2={tick.y}
                />
              ))}
            </g>
            <g className="chart-axis">
              {trafficChart.ticks.map((tick) => (
                <text key={`tick-${tick.y}`} x={trafficChart.padding - 6} y={tick.y}>
                  {formatRate(tick.value)}
                </text>
              ))}
            </g>
            <g
              className={`chart-motion${trafficShiftActive ? '' : ' snap'}`}
              style={{
                '--shift': `${trafficShift}px`,
                '--duration': `${TRAFFIC_ANIMATION_MS}ms`
              }}
              clipPath={`url(#${TRAFFIC_CLIP_ID})`}
            >
              {trafficChart.downloadArea && (
                <path d={trafficChart.downloadArea} fill="url(#downloadGradient)" />
              )}
              {trafficChart.uploadArea && (
                <path d={trafficChart.uploadArea} fill="url(#uploadGradient)" />
              )}
              {trafficChart.downloadLine && (
                <path d={trafficChart.downloadLine} className="line download" />
              )}
              {trafficChart.uploadLine && (
                <path d={trafficChart.uploadLine} className="line upload" />
              )}
            </g>
          </svg>
        )}
      </div>
      <div className="chart-legend">
        <div className="legend-item">
          <span className="swatch upload" />
          Upload {formatRate(latestSample ? latestSample.up : 0)}
        </div>
        <div className="legend-item">
          <span className="swatch download" />
          Download {formatRate(latestSample ? latestSample.down : 0)}
        </div>
        <div className="legend-item">
          <span className="swatch neutral" />
          Samples {visibleSamples}
        </div>
      </div>
    </section>
  );
}

