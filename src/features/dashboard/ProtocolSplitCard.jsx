import { useMemo, useState } from 'react';

const PROTOCOL_SPLIT_VISIBLE_ROWS = 10;

export function ProtocolSplitCard({
  protocolTotal,
  protocolMix,
  clamp,
  CHART_COLORS,
  connStreamLabel,
  toggleConnStream,
  connStreamPaused
}) {
  const [protocolSortOrder, setProtocolSortOrder] = useState('desc');
  const sortedProtocolMix = useMemo(() => {
    const list = [...protocolMix];
    list.sort((a, b) => {
      const valueDiff = Number(a?.value || 0) - Number(b?.value || 0);
      if (valueDiff !== 0) return valueDiff;
      return String(a?.label || '').localeCompare(String(b?.label || ''));
    });
    if (protocolSortOrder === 'desc') {
      list.reverse();
    }
    return list;
  }, [protocolMix, protocolSortOrder]);
  const placeholderCount = Math.max(0, PROTOCOL_SPLIT_VISIBLE_ROWS - sortedProtocolMix.length);

  return (
    <section className="panel span-12 chart-panel protocol-split-panel" style={{ '--delay': '0.18s' }}>
      <div className="panel-header">
        <div>
          <h2>Protocol split</h2>
          <p>Connections by network or transport type.</p>
        </div>
        <div className="chart-meta">
          <button
            type="button"
            className={`pill live-pill-fixed ${connStreamLabel}`}
            onClick={toggleConnStream}
            title={connStreamPaused ? 'Resume live updates' : 'Pause live updates'}
          >
            {connStreamLabel}
          </button>
          <button
            type="button"
            className={`pill protocol-sort-toggle ${protocolSortOrder}`}
            onClick={() => setProtocolSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            title={`Switch to ${protocolSortOrder === 'desc' ? 'ascending' : 'descending'} order`}
          >
            {protocolSortOrder === 'desc' ? 'DESC' : 'ASC'}
          </button>
          <span className="meta-pill">Total {protocolTotal}</span>
        </div>
      </div>
      <div className="split-list-frame">
        {protocolMix.length === 0 && (
          <div className="split-empty-inline">No protocol detail yet.</div>
        )}
        <div className="split-list-scroll">
          <div className="split-list">
            {sortedProtocolMix.map((item, index) => (
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
            {Array.from({ length: placeholderCount }).map((_, index) => (
              <div
                className="split-row split-row-placeholder"
                key={`protocol-split-placeholder-${index}`}
                aria-hidden="true"
              >
                <span className="split-label">&nbsp;</span>
                <div className="split-track" />
                <span className="split-value">&nbsp;</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
