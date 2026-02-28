import { useMemo, useState } from 'react';

const TOP_SOURCES_VISIBLE_ROWS = 8;

export function TopDestinationsCard({
  topSources,
  CHART_COLORS,
  onSourceClick,
  connStreamLabel,
  toggleConnStream,
  connStreamPaused
}) {
  const [sourceSortOrder, setSourceSortOrder] = useState('desc');
  const isDescOrder = sourceSortOrder === 'desc';
  const nextSortOrderLabel = isDescOrder ? 'ascending' : 'descending';

  const sortedSources = useMemo(() => {
    const list = [...(topSources || [])];
    list.sort((a, b) => {
      const valueDiff = Number(a?.count || 0) - Number(b?.count || 0);
      if (valueDiff !== 0) return valueDiff;
      return String(a?.label || '').localeCompare(String(b?.label || ''));
    });
    if (sourceSortOrder === 'desc') {
      list.reverse();
    }
    return list;
  }, [topSources, sourceSortOrder]);

  const placeholderCount = Math.max(0, TOP_SOURCES_VISIBLE_ROWS - sortedSources.length);
  const totalCount = useMemo(
    () => sortedSources.reduce((sum, item) => sum + Number(item?.count || 0), 0),
    [sortedSources]
  );

  return (
    <section className="panel span-7 chart-panel top-destinations-panel" style={{ '--delay': '0.14s' }}>
      <div className="panel-header">
        <div>
          <h2>Top sources</h2>
          <p>Most active client sources by connection count.</p>
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
            className={`pill protocol-sort-toggle ${sourceSortOrder}`}
            onClick={() => setSourceSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            title={`Switch to ${nextSortOrderLabel} order`}
          >
            {isDescOrder ? 'DESC' : 'ASC'}
          </button>
          <span className="meta-pill">Total {totalCount}</span>
        </div>
      </div>
      {topSources.length === 0 ? (
        <div className="chart-empty">No source traffic yet.</div>
      ) : (
        <div className="split-list-frame top-sources-frame">
          <div className="split-list-scroll">
            <div className="top-sources-list">
              {sortedSources.map((item, index) => {
                const color = CHART_COLORS[index % CHART_COLORS.length];
                const queryValue = String(item.query || '').trim();
                const canFilter = queryValue.length > 0;
                const fillRatio = Math.max(0, Math.min(1, item.percent / 100));
                return (
                  <div className="top-source-row" key={`${item.label}-${index}`}>
                    <div className="split-track top-source-track">
                      <span
                        className="split-fill top-source-fill"
                        style={{
                          transform: `scaleX(${fillRatio})`,
                          background: color
                        }}
                      />
                      <div className="top-source-track-content">
                        <button
                          type="button"
                          className="bar-label bar-label-source bar-source-link top-source-inline-label"
                          title={canFilter ? `Filter connections by source: ${queryValue}` : 'No user available for filtering'}
                          onClick={() => {
                            if (!canFilter) return;
                            onSourceClick?.(queryValue);
                          }}
                          disabled={!canFilter}
                        >
                          <span className="source-dot" style={{ background: color }} />
                          <span className="top-source-label-text">{item.label}</span>
                        </button>
                        <span className="bar-value top-source-inline-value">
                          {Math.round(item.percent)}% ({item.count})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {Array.from({ length: placeholderCount }).map((_, index) => (
                <div
                  className="top-source-row top-source-row-placeholder"
                  key={`top-source-placeholder-${index}`}
                  aria-hidden="true"
                >
                  <div className="split-track top-source-track">
                    <div className="top-source-track-content">
                      <span className="bar-label bar-label-source top-source-inline-label">
                        <span className="source-dot" />
                        &nbsp;
                      </span>
                      <span className="bar-value top-source-inline-value">&nbsp;</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
