import React from 'react';
import { HeaderSearchInput, PanelHeader, joinClassNames } from '../common/panelPrimitives';

const CONNECTIONS_PERF_MODE_THRESHOLD = 40;

const getClosedTimestamp = (conn) => conn?.closedAt || conn?.lastSeen || conn?.start || '';
const getConnectionRuleLabel = (conn) => {
  const direct = String(conn?.rulePayload || conn?.rule || '').trim();
  if (direct) return direct;
  const details = Array.isArray(conn?.details) ? conn.details : [];
  let merged = '';
  for (const detail of details) {
    const value = String(detail?.rulePayload || detail?.rule || '').trim();
    if (!value) continue;
    if (!merged) {
      merged = value;
      continue;
    }
    if (merged !== value) {
      return 'mixed';
    }
  }
  return merged || '-';
};

export function ConnectionsPanel({
  page,
  connListMode,
  setConnListMode,
  connSearchQuery,
  setConnSearchQuery,
  connViewMode,
  setConnViewMode,
  connStreamLabel,
  toggleConnStream,
  connStreamPaused,
  canCloseAllConnections,
  closingAllConnections,
  handleCloseAllConnections,
  renderSortHeader,
  TRAFFIC_DIRECTION_HINTS,
  filteredConnections,
  filteredClosedConnections,
  getGroupCloseIds,
  expandedConnections,
  normalizedConnSearchQuery,
  toSearchText,
  isSpliceType,
  connRates,
  getRateActivity,
  CONNECTION_ACTIVITY_SCALE,
  getConnectionDestination,
  getConnectionSource,
  getConnectionDomainSourceBadge,
  formatHostDisplay,
  getDomainSourceBadgeLabel,
  formatBytes,
  formatTime,
  ZEBRA_ROW_BACKGROUNDS,
  toggleExpanded,
  normalizeDomainSource,
  AutoFoldText,
  highlightConnCell,
  formatRateOrSplice,
  handleInfoGroup,
  handleInfoClosed,
  handleCloseGroup,
  detailGridStyle,
  DETAIL_COLUMNS,
  detailColumnsVisible,
  toggleDetailColumn,
  getDetailKey,
  detailRates,
  DETAIL_ACTIVITY_SCALE,
  ZEBRA_DETAIL_BACKGROUNDS,
  renderDetailCell
}) {
  if (page !== 'connections') return null;

  const isClosedMode = connListMode === 'closed';
  const visibleConnections = isClosedMode ? filteredClosedConnections : filteredConnections;
  const connectionsPerfMode = visibleConnections.length >= CONNECTIONS_PERF_MODE_THRESHOLD;
  const activeDetailColumns = DETAIL_COLUMNS.filter((column) => {
    if (!isClosedMode) return true;
    return column.key !== 'close' && column.key !== 'upload' && column.key !== 'download';
  });
  const visibleDetailColumnsForMode = activeDetailColumns.filter((column) => detailColumnsVisible.has(column.key));
  const renderedDetailColumns = visibleDetailColumnsForMode.length
    ? visibleDetailColumnsForMode
    : activeDetailColumns;
  const detailGridStyleForMode = isClosedMode
    ? { '--detail-columns': renderedDetailColumns.map((column) => column.width).join(' ') }
    : detailGridStyle;
  const renderDetailColumnControls = (extraClassName = '') => (
    <div className={joinClassNames('detail-categories', extraClassName)}>
      <span className="detail-categories-label">Columns</span>
      <div className="detail-categories-list">
        {activeDetailColumns.map((column) => {
          const isVisible = detailColumnsVisible.has(column.key);
          const columnHint = column.hint ? ` (${column.hint})` : '';
          return (
            <button
              key={column.key}
              type="button"
              className={`detail-category ${isVisible ? 'active' : 'inactive'}`}
              onClick={() => toggleDetailColumn(column.key)}
              title={`${isVisible ? 'Hide' : 'Show'} ${column.label}${columnHint}`}
              aria-pressed={isVisible}
            >
              {column.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className={joinClassNames(
        'panel',
        'connections-panel',
        connectionsPerfMode ? 'connections-panel-perf' : ''
      )}
      style={{ '--delay': '0.05s' }}
    >
      <PanelHeader
        title={(
          <span className="connections-title">
            <span>Live Connections</span>
            <span className="connections-title-switch" role="tablist" aria-label="Connection list mode">
              <button
                type="button"
                className={`view-pill ${!isClosedMode ? 'active' : ''}`}
                onClick={() => setConnListMode('live')}
                aria-pressed={!isClosedMode}
              >
                Live
              </button>
              <button
                type="button"
                className={`view-pill ${isClosedMode ? 'active' : ''}`}
                onClick={() => setConnListMode('closed')}
                aria-pressed={isClosedMode}
              >
                Closed
              </button>
            </span>
          </span>
        )}
        actions={(
          <>
            <span className="header-note">
              {isClosedMode
                ? 'Recently closed connections. Keeps the latest 500 entries.'
                : 'Grouped by source IP and destination host/IP. Upload: User -&gt; Xray. Download: Xray -&gt; User.'}
            </span>
            <HeaderSearchInput
              value={connSearchQuery}
              onChange={(event) => setConnSearchQuery(event.target.value)}
              placeholder={isClosedMode
                ? 'Search closed connections...'
                : 'Search all fields, including folded details...'}
              ariaLabel={isClosedMode ? 'Search closed connections' : 'Search all connection fields'}
            />
            <div className="view-toggle">
              <button
                type="button"
                className={`view-pill ${connViewMode === 'current' ? 'active' : ''}`}
                onClick={() => setConnViewMode('current')}
              >
                Current
              </button>
              <button
                type="button"
                className={`view-pill ${connViewMode === 'source' ? 'active' : ''}`}
                onClick={() => setConnViewMode('source')}
              >
                Source
              </button>
              <button
                type="button"
                className={`view-pill ${connViewMode === 'destination' ? 'active' : ''}`}
                onClick={() => setConnViewMode('destination')}
              >
                Destination
              </button>
            </div>
            {!isClosedMode ? (
              <button
                type="button"
                className="pill conn-close-all"
                onClick={handleCloseAllConnections}
                disabled={closingAllConnections || !canCloseAllConnections}
                title="Close all visible connections"
              >
                {closingAllConnections ? 'Closing...' : 'Close all'}
              </button>
            ) : null}
            <button
              type="button"
              className={`pill ${connStreamLabel}`}
              onClick={toggleConnStream}
              title={connStreamPaused ? 'Resume live updates' : 'Pause live updates'}
            >
              {connStreamLabel}
            </button>
          </>
        )}
      />
      {renderDetailColumnControls('connections-columns-toolbar')}
      <div className={`connections-table-wrap${connectionsPerfMode ? ' connections-table-wrap-perf' : ''}`}>
        <div className="table connections-table">
          <div className="row header">
            {renderSortHeader('Destination', 'destination')}
            {renderSortHeader('Source', 'source')}
            {renderSortHeader('Rule', 'rule')}
            {isClosedMode
              ? <span>Closed</span>
              : renderSortHeader('Sessions', 'sessions')}
            {renderSortHeader('Upload', 'upload', TRAFFIC_DIRECTION_HINTS.upload)}
            {renderSortHeader('Download', 'download', TRAFFIC_DIRECTION_HINTS.download)}
            <span></span>
          </div>
          {visibleConnections.map((conn, connIndex) => {
            const groupCloseIds = isClosedMode ? [] : getGroupCloseIds(conn);
            const canClose = groupCloseIds.length > 0;
            const isExpanded = expandedConnections.has(conn.id);
            const visibleDetails = normalizedConnSearchQuery
              ? (conn.details || []).filter((detail) => toSearchText(detail).toLowerCase().includes(normalizedConnSearchQuery))
              : (conn.details || []);
            const details = conn.details || [];
            const connIsSplice = isSpliceType(conn?.metadata?.type)
              || (details.length > 0 && details.every((detail) => isSpliceType(detail?.metadata?.type)));
            const connActivity = isClosedMode
              ? 0
              : getRateActivity(connRates.get(conn.id), CONNECTION_ACTIVITY_SCALE);
            const destinationRaw = getConnectionDestination(conn);
            const sourceRaw = getConnectionSource(conn);
            const destinationSourceBadge = isClosedMode
              ? getDomainSourceBadgeLabel(conn?.metadata?.domainSource)
              : getConnectionDomainSourceBadge(conn);
            const destinationFolded = formatHostDisplay(destinationRaw);
            const sourceFolded = formatHostDisplay(sourceRaw);
            const ruleLabel = getConnectionRuleLabel(conn);
            const rowBg = ZEBRA_ROW_BACKGROUNDS[connIndex % ZEBRA_ROW_BACKGROUNDS.length];
            const connStyle = { '--activity': String(connActivity), '--row-bg': rowBg };
            const closedTimestamp = getClosedTimestamp(conn);
            return (
              <React.Fragment key={`${conn.id || 'conn'}-${connIndex}`}>
                <div
                  className={joinClassNames('row', 'clickable', isExpanded ? 'expanded' : '')}
                  style={connStyle}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpanded(conn.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpanded(conn.id);
                    }
                  }}
                >
                  <span className="destination-cell">
                    {destinationSourceBadge ? (
                      <span
                        className={`domain-source-pill ${normalizeDomainSource(destinationSourceBadge)}`}
                        title={`Domain source: ${destinationSourceBadge}`}
                      >
                        {destinationSourceBadge}
                      </span>
                    ) : null}
                    <AutoFoldText
                      className="mono destination-cell-text"
                      fullText={destinationRaw}
                      foldedText={destinationFolded}
                      renderText={highlightConnCell}
                    />
                  </span>
                  <AutoFoldText
                    className="mono"
                    fullText={sourceRaw}
                    foldedText={sourceFolded}
                    renderText={highlightConnCell}
                  />
                  <span className="mono rule-cell" title={ruleLabel}>
                    {highlightConnCell(ruleLabel)}
                  </span>
                  {isClosedMode ? (
                    <span className="mono">{highlightConnCell(formatTime(closedTimestamp))}</span>
                  ) : (
                    <span className="mono session-cell">
                      <span>{highlightConnCell(conn.connectionCount || 1)}</span>
                      {connIsSplice ? <span className="splice-badge" title="splice mode active">SPLICE</span> : null}
                    </span>
                  )}
                  <span className="mono">
                    {isClosedMode
                      ? highlightConnCell(formatBytes(conn.upload || 0))
                      : highlightConnCell(formatRateOrSplice(connRates.get(conn.id)?.upload || 0, connIsSplice))}
                  </span>
                  <span className="mono">
                    {isClosedMode
                      ? highlightConnCell(formatBytes(conn.download || 0))
                      : highlightConnCell(formatRateOrSplice(connRates.get(conn.id)?.download || 0, connIsSplice))}
                  </span>
                  <span className="row-actions">
                    <button
                      type="button"
                      className="conn-info"
                      onClick={(event) => (isClosedMode ? handleInfoClosed(event, conn) : handleInfoGroup(event, conn))}
                      title="Info"
                    >
                      Info
                    </button>
                    {!isClosedMode ? (
                      <button
                        type="button"
                        className="conn-close"
                        onClick={(event) => handleCloseGroup(event, groupCloseIds)}
                        disabled={!canClose}
                        title={canClose ? 'Close all connections in this group' : 'No connections to close'}
                      >
                        Close
                      </button>
                    ) : null}
                    <span className="chevron">{isExpanded ? '▾' : '▸'}</span>
                  </span>
                </div>
                {isExpanded && (
                  <div className="detail-wrap" style={detailGridStyleForMode}>
                    {renderDetailColumnControls()}
                    <div className="detail-row header">
                      {renderedDetailColumns.map((column) => (
                        <button
                          key={column.key}
                          type="button"
                          className={`detail-header-toggle ${column.headerClassName || ''}`}
                          onClick={() => toggleDetailColumn(column.key)}
                          title={`Hide ${column.label}${column.hint ? ` (${column.hint})` : ''}`}
                          aria-label={`Hide ${column.label}${column.hint ? ` (${column.hint})` : ''}`}
                        >
                          {column.label}
                        </button>
                      ))}
                    </div>
                    {visibleDetails.map((detail, idx) => {
                      const detailKey = getDetailKey(conn.id, detail, idx);
                      const detailRate = isClosedMode ? null : detailRates.get(detailKey);
                      const detailActivity = isClosedMode ? 0 : getRateActivity(detailRate, DETAIL_ACTIVITY_SCALE);
                      const detailBg = ZEBRA_DETAIL_BACKGROUNDS[idx % ZEBRA_DETAIL_BACKGROUNDS.length];
                      const detailStyle = { '--activity': String(detailActivity), '--row-bg': detailBg };
                      return (
                        <div className="detail-row" key={detailKey} style={detailStyle}>
                          {renderedDetailColumns.map((column) => (
                            <span key={`${detailKey}-${column.key}`} className={column.cellClassName || ''}>
                              {renderDetailCell(column.key, conn, detail, detailRate, detailKey)}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}
          {visibleConnections.length === 0 ? (
            <div className="connections-closed-empty">
              {connSearchQuery.trim()
                ? 'No connections match the current search.'
                : isClosedMode
                  ? 'No closed connections yet.'
                  : 'No live connections.'}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
