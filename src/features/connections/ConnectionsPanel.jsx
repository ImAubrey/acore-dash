import React from 'react';
import { HeaderSearchInput, PanelHeader, joinClassNames } from '../common/panelPrimitives';
import { CloseIcon, InfoIcon } from './actionIcons';
import { DetailActionButtons } from './detailCellRenderer';

const CONNECTIONS_PERF_MODE_THRESHOLD = 40;
const MAX_RENDER_CONNECTION_ROWS = 400;
const MAX_RENDER_DETAILS_PER_GROUP = 200;
const COMMON_CC_SECOND_LEVEL_LABELS = new Set(['ac', 'co', 'com', 'edu', 'gov', 'net', 'org']);

const getClosedTimestamp = (conn) => conn?.closedAt || conn?.lastSeen || conn?.start || '';
const getHostFromConnectionDetail = (detail) => (
  detail?.metadata?.host
  || detail?.metadata?.destinationHost
  || detail?.metadata?.destinationIP
  || ''
);
const normalizeHostText = (value) => {
  let host = String(value || '').trim().toLowerCase();
  if (!host) return '';
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  const slashIndex = host.indexOf('/');
  if (slashIndex >= 0) {
    host = host.slice(0, slashIndex);
  }
  const portMatch = host.match(/^(.*):(\d+)$/);
  if (portMatch && !portMatch[1].includes(':')) {
    host = portMatch[1];
  }
  return host;
};
const IPV4_HOST_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const toRootDomain = (value) => {
  const host = normalizeHostText(value);
  if (!host) return '';
  if (host === 'mixed' || host === 'unknown') return '';
  if (IPV4_HOST_REGEX.test(host) || host.includes(':')) return host;
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 2) return host;
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  if (tld.length === 2 && COMMON_CC_SECOND_LEVEL_LABELS.has(sld) && labels.length >= 3) {
    return labels.slice(-3).join('.');
  }
  return labels.slice(-2).join('.');
};
const extractSearchHostCandidate = (query) => {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return '';
  const tokens = normalized.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const cleaned = token.replace(/^[`"'(\[]+|[`"')\]]+$/g, '');
    if (!cleaned) continue;
    let host = '';
    if (cleaned.includes('://')) {
      try {
        host = normalizeHostText(new URL(cleaned).hostname);
      } catch (_err) {
        host = '';
      }
    }
    if (!host) {
      host = normalizeHostText(cleaned);
    }
    if (!host) continue;
    if (host.includes('.') || IPV4_HOST_REGEX.test(host) || host.includes(':')) {
      return host;
    }
  }
  return '';
};
const resolveMixedDestinationRoot = (conn, visibleDetails, destinationRaw, normalizedConnSearchQuery) => {
  const base = String(destinationRaw || '').trim();
  if (base.toLowerCase() !== 'mixed') return base;
  const details = visibleDetails.length
    ? visibleDetails
    : (Array.isArray(conn?.details) ? conn.details : []);
  const rootCounts = new Map();
  details.forEach((detail) => {
    const rootDomain = toRootDomain(getHostFromConnectionDetail(detail));
    if (!rootDomain) return;
    rootCounts.set(rootDomain, (rootCounts.get(rootDomain) || 0) + 1);
  });
  if (rootCounts.size === 0) {
    return base;
  }
  const queryHost = extractSearchHostCandidate(normalizedConnSearchQuery);
  const queryRoot = toRootDomain(queryHost);
  if (queryRoot) {
    if (rootCounts.has(queryRoot)) {
      return queryRoot;
    }
    for (const candidate of rootCounts.keys()) {
      if (candidate.includes(queryRoot) || queryRoot.includes(candidate)) {
        return candidate;
      }
    }
  }
  let selected = '';
  let maxCount = -1;
  rootCounts.forEach((count, root) => {
    if (count > maxCount) {
      maxCount = count;
      selected = root;
      return;
    }
    if (count === maxCount && selected && root < selected) {
      selected = root;
    }
  });
  return selected || base;
};
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
  const overflowConnectionsCount = Math.max(visibleConnections.length - MAX_RENDER_CONNECTION_ROWS, 0);
  const renderedConnections = overflowConnectionsCount > 0
    ? visibleConnections.slice(0, MAX_RENDER_CONNECTION_ROWS)
    : visibleConnections;
  const connectionsPerfMode = visibleConnections.length >= CONNECTIONS_PERF_MODE_THRESHOLD;
  const forceCompactText = connectionsPerfMode || overflowConnectionsCount > 0;
  const activeDetailColumns = DETAIL_COLUMNS;
  const visibleDetailColumnsForMode = activeDetailColumns.filter((column) => detailColumnsVisible.has(column.key));
  const renderedDetailColumns = visibleDetailColumnsForMode.length
    ? visibleDetailColumnsForMode
    : activeDetailColumns;
  const detailGridStyleForMode = detailGridStyle;
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
          {renderedConnections.map((conn, connIndex) => {
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
            const destinationRawBase = getConnectionDestination(conn);
            const destinationRaw = connViewMode === 'current'
              ? resolveMixedDestinationRoot(conn, visibleDetails, destinationRawBase, normalizedConnSearchQuery)
              : destinationRawBase;
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
            const connKey = conn.id ? String(conn.id) : `conn-${connIndex}`;
            return (
              <React.Fragment key={connKey}>
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
                      disableAdaptive={forceCompactText}
                      forceFold={forceCompactText}
                    />
                  </span>
                  <AutoFoldText
                    className="mono"
                    fullText={sourceRaw}
                    foldedText={sourceFolded}
                    renderText={highlightConnCell}
                    disableAdaptive={forceCompactText}
                    forceFold={forceCompactText}
                  />
                  <span className="mono rule-cell" title={ruleLabel}>
                    {highlightConnCell(ruleLabel)}
                  </span>
                  {isClosedMode ? (
                    <AutoFoldText
                      className="mono"
                      fullText={formatTime(closedTimestamp)}
                      foldedText={formatTime(closedTimestamp)}
                      renderText={highlightConnCell}
                      disableAdaptive={forceCompactText}
                      forceFold={forceCompactText}
                    />
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
                      aria-label="Info"
                    >
                      <InfoIcon />
                    </button>
                    {!isClosedMode ? (
                      <button
                        type="button"
                        className="conn-close"
                        onClick={(event) => handleCloseGroup(event, groupCloseIds)}
                        disabled={!canClose}
                        title={canClose ? 'Close all connections in this group' : 'No connections to close'}
                        aria-label="Close"
                      >
                        <CloseIcon />
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
                    {(visibleDetails.length > MAX_RENDER_DETAILS_PER_GROUP
                      ? visibleDetails.slice(0, MAX_RENDER_DETAILS_PER_GROUP)
                      : visibleDetails).map((detail, idx) => {
                      const detailKey = getDetailKey(conn.id, detail, idx);
                      const detailRate = isClosedMode ? null : detailRates.get(detailKey);
                      const detailActivity = isClosedMode ? 0 : getRateActivity(detailRate, DETAIL_ACTIVITY_SCALE);
                      const detailBg = ZEBRA_DETAIL_BACKGROUNDS[idx % ZEBRA_DETAIL_BACKGROUNDS.length];
                      const detailStyle = { '--activity': String(detailActivity), '--row-bg': detailBg };
                      return (
                        <div className="detail-row" key={detailKey} style={detailStyle}>
                          {renderedDetailColumns.map((column) => {
                            let cell = renderDetailCell(column.key, conn, detail, detailRate, detailKey);
                            if (isClosedMode && column.key === 'upload') {
                              cell = highlightConnCell(formatBytes(detail.upload || 0));
                            } else if (isClosedMode && column.key === 'download') {
                              cell = highlightConnCell(formatBytes(detail.download || 0));
                            } else if (isClosedMode && column.key === 'close') {
                              cell = (
                                <DetailActionButtons
                                  onInfo={(event) => handleInfoClosed(event, conn)}
                                  onClose={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                  }}
                                  closeDisabled
                                  closeTitle="Closed connection"
                                  closeAriaLabel="Closed connection"
                                />
                              );
                            }
                            return (
                              <span key={`${detailKey}-${column.key}`} className={column.cellClassName || ''}>
                                {cell}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                    {visibleDetails.length > MAX_RENDER_DETAILS_PER_GROUP ? (
                      <div className="detail-overflow-note">
                        Showing first {MAX_RENDER_DETAILS_PER_GROUP} details in this group.
                      </div>
                    ) : null}
                  </div>
                )}
              </React.Fragment>
            );
          })}
          {overflowConnectionsCount > 0 ? (
            <div className="connections-overflow-note">
              Showing first {MAX_RENDER_CONNECTION_ROWS} of {visibleConnections.length} connections. Refine search to narrow results.
            </div>
          ) : null}
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
