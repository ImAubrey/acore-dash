import { PageNav } from './PageNav';
import { formatMetricsPanelOptionLabel } from '../../dashboardShared';

export function HeroHeader({
  page,
  pageMeta,
  PAGES,
  metricsPanelHistory,
  currentMetricsPanelId,
  applySavedMetricsPanel,
  formatBytes,
  connections,
  totalSessions
}) {
  const savedMetrics = Array.isArray(metricsPanelHistory) ? metricsPanelHistory : [];
  const hasSavedMetrics = savedMetrics.length > 0;
  const selectedMetricsId = hasSavedMetrics
    && savedMetrics.some((item) => item?.id === currentMetricsPanelId)
    ? currentMetricsPanelId
    : hasSavedMetrics
      ? String(savedMetrics[0]?.id || '')
      : '';

  const handleSavedMetricsChange = (event) => {
    const id = String(event.target.value || '').trim();
    if (!id) return;
    const entry = savedMetrics.find((item) => String(item?.id || '').trim() === id);
    if (!entry) return;
    applySavedMetricsPanel(entry);
  };

  return (
    <header className="hero">
      <div className={`hero-main${page === 'connections' ? ' hero-main-connections' : ''}`}>
        <p className="eyebrow">Xray Control</p>
        <div className={`hero-title-row${page === 'connections' ? ' is-connections' : ''}`}>
          <h1 className={`hero-page-title${page === 'connections' ? ' hero-page-title-nowrap' : ''}`}>
            {pageMeta.title}
          </h1>
        </div>
        <p className={`subhead ${page === 'connections' ? 'nowrap' : ''}`}>{pageMeta.description}</p>
        <PageNav page={page} pages={PAGES} />
      </div>
      <div className="hero-side">
        <div className="hero-stats">
          <div className="hero-metrics-switch">
            <select
              value={selectedMetricsId}
              onChange={handleSavedMetricsChange}
              disabled={!hasSavedMetrics}
              aria-label="Choose saved metrics panel"
              title={hasSavedMetrics ? 'Switch saved metrics panel' : 'No saved metrics panels'}
            >
              {!hasSavedMetrics ? <option value="">No saved metrics panels</option> : null}
              {savedMetrics.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatMetricsPanelOptionLabel(item)}
                </option>
              ))}
            </select>
          </div>
          <div className="stat-card">
            <span>Upload</span>
            <strong>{formatBytes(connections.uploadTotal)}</strong>
          </div>
          <div className="stat-card">
            <span>Download</span>
            <strong>{formatBytes(connections.downloadTotal)}</strong>
          </div>
          <div className="stat-card">
            <span>Sessions</span>
            <strong>{totalSessions}</strong>
          </div>
        </div>
      </div>
    </header>
  );
}
