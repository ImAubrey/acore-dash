import { PageNav } from './PageNav';
import { getHeroTitleClassName, useHeroLayout } from './heroLayout';
import { formatMetricsPanelOptionLabel } from '../../dashboardShared';

function HeroTitleBlock({ pageMeta }) {
  return (
    <div className="hero-main">
      <p className="eyebrow">Acore Control</p>
      <div className="hero-title-row">
        <h1 className={getHeroTitleClassName(pageMeta.title)}>
          {pageMeta.title}
        </h1>
      </div>
      <p className="subhead">{pageMeta.description}</p>
    </div>
  );
}

export function HeroHeader({
  page,
  pageMeta,
  PAGES,
  metricsPanelHistory,
  currentMetricsPanelId,
  applySavedMetricsPanel,
  formatRate,
  totalSessions,
  liveUploadRate,
  liveDownloadRate
}) {
  const { heroRef, heroClassName } = useHeroLayout(pageMeta?.title);
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
    <header className={heroClassName} ref={heroRef}>
      <HeroTitleBlock pageMeta={pageMeta} />
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
          <div className="hero-traffic-tip" title="Live connection summary">
            <div className="hero-traffic-tip-item">
              <span>Upload</span>
              <strong>{formatRate(liveUploadRate || 0)}</strong>
            </div>
            <div className="hero-traffic-tip-item">
              <span>Download</span>
              <strong>{formatRate(liveDownloadRate || 0)}</strong>
            </div>
            <div className="hero-traffic-tip-item">
              <span>Sessions</span>
              <strong>{totalSessions}</strong>
            </div>
          </div>
        </div>
      </div>
      <PageNav page={page} pages={PAGES} />
    </header>
  );
}
