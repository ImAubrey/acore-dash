import React from 'react';
import { CloseIcon, InfoIcon } from './actionIcons';

export function ConnectionsPanel({
  page,
  connSearchQuery,
  setConnSearchQuery,
  connViewMode,
  setConnViewMode,
  connExpandDefaultOpen,
  toggleConnExpandDefault,
  connStreamLabel,
  toggleConnStream,
  connStreamPaused,
  renderSortHeader,
  TRAFFIC_DIRECTION_HINTS,
  filteredConnections,
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
  ZEBRA_ROW_BACKGROUNDS,
  toggleExpanded,
  preventManualExpandToggle,
  normalizeDomainSource,
  AutoFoldText,
  highlightConnCell,
  formatRateOrSplice,
  handleInfoGroup,
  handleCloseGroup,
  detailGridStyle,
  DETAIL_COLUMNS,
  detailColumnsVisible,
  toggleDetailColumn,
  detailVisibleColumns,
  getDetailKey,
  detailRates,
  DETAIL_ACTIVITY_SCALE,
  ZEBRA_DETAIL_BACKGROUNDS,
  renderDetailCell
}) {
  if (page !== 'connections') return null;

  const handleToggleExpandedRow = (id) => {
    if (preventManualExpandToggle) return;
    toggleExpanded(id);
  };

  return (
    <div className="panel connections-panel" style={{ '--delay': '0.05s' }}>
      <div className="panel-header">
        <div>
          <h2>Live Connections</h2>
        </div>
        <div className="header-actions">
          <span className="header-note">
            Grouped by source IP and destination host/IP. Upload: User -&gt; Xray. Download: Xray -&gt; User.
          </span>
          <div className="connections-search">
            <input
              type="text"
              value={connSearchQuery}
              onChange={(event) => setConnSearchQuery(event.target.value)}
              placeholder="Search all fields, including folded details..."
              aria-label="Search all connection fields"
            />
          </div>
          <div className="view-toggle">
            <button
              type="button"
              className={`view-pill expand-default-toggle ${connExpandDefaultOpen ? 'active' : ''}`}
              onClick={toggleConnExpandDefault}
              title={connExpandDefaultOpen
                ? 'Default expanded. Click to switch to default collapsed.'
                : 'Default collapsed. Click to switch to default expanded.'}
              aria-pressed={connExpandDefaultOpen}
            >
              {connExpandDefaultOpen ? 'Collapse' : 'Expand'}
            </button>
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
          <button
            type="button"
            className={`pill ${connStreamLabel}`}
            onClick={toggleConnStream}
            title={connStreamPaused ? 'Resume live updates' : 'Pause live updates'}
          >
            {connStreamLabel}
          </button>
        </div>
      </div>
      <div className="connections-table-wrap">
        <div className="table connections-table">
          <div className="row header">
            {renderSortHeader('Destination', 'destination')}
            {renderSortHeader('Source', 'source')}
            {renderSortHeader('Sessions', 'sessions')}
            {renderSortHeader('Upload', 'upload', TRAFFIC_DIRECTION_HINTS.upload)}
            {renderSortHeader('Download', 'download', TRAFFIC_DIRECTION_HINTS.download)}
            <span></span>
          </div>
          {filteredConnections.map((conn, connIndex) => {
            const groupCloseIds = getGroupCloseIds(conn);
            const canClose = groupCloseIds.length > 0;
            const connId = conn?.id === undefined || conn?.id === null ? '' : String(conn.id);
            const isExpanded = connId ? expandedConnections.has(connId) : false;
            const visibleDetails = normalizedConnSearchQuery
              ? (conn.details || []).filter((detail) => toSearchText(detail).toLowerCase().includes(normalizedConnSearchQuery))
              : (conn.details || []);
            const details = conn.details || [];
            const connIsSplice = isSpliceType(conn?.metadata?.type)
              || (details.length > 0 && details.every((detail) => isSpliceType(detail?.metadata?.type)));
            const connActivity = getRateActivity(connRates.get(conn.id), CONNECTION_ACTIVITY_SCALE);
            const destinationRaw = getConnectionDestination(conn);
            const sourceRaw = getConnectionSource(conn);
            const destinationSourceBadge = getConnectionDomainSourceBadge(conn);
            const destinationFolded = formatHostDisplay(destinationRaw);
            const sourceFolded = formatHostDisplay(sourceRaw);
            const rowBg = ZEBRA_ROW_BACKGROUNDS[connIndex % ZEBRA_ROW_BACKGROUNDS.length];
            const connStyle = { '--activity': String(connActivity), '--row-bg': rowBg };
            return (
              <React.Fragment key={conn.id}>
                <div
                  className={`row ${preventManualExpandToggle ? '' : 'clickable'} ${isExpanded ? 'expanded' : ''}`}
                  style={connStyle}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleExpandedRow(connId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggleExpandedRow(connId);
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
                  <span className="mono session-cell">
                    <span>{highlightConnCell(conn.connectionCount || 1)}</span>
                    {connIsSplice ? <span className="splice-badge" title="splice mode active">SPLICE</span> : null}
                  </span>
                  <span className="mono">
                    {highlightConnCell(formatRateOrSplice(connRates.get(conn.id)?.upload || 0, connIsSplice))}
                  </span>
                  <span className="mono">
                    {highlightConnCell(formatRateOrSplice(connRates.get(conn.id)?.download || 0, connIsSplice))}
                  </span>
                  <span className="row-actions">
                    <button
                      type="button"
                      className="conn-info"
                      onClick={(event) => handleInfoGroup(event, conn)}
                      title="Info"
                      aria-label="Info"
                    >
                      <InfoIcon />
                    </button>
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
                    <span className="chevron">{isExpanded ? '▾' : '▸'}</span>
                  </span>
                </div>
                {isExpanded && (
                  <div className="detail-wrap" style={detailGridStyle}>
                    <div className="detail-categories">
                      <span className="detail-categories-label">Columns</span>
                      <div className="detail-categories-list">
                        {DETAIL_COLUMNS.map((column) => {
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
                    <div className="detail-row header">
                      {detailVisibleColumns.map((column) => (
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
                      const detailRate = detailRates.get(detailKey);
                      const detailActivity = getRateActivity(detailRate, DETAIL_ACTIVITY_SCALE);
                      const detailBg = ZEBRA_DETAIL_BACKGROUNDS[idx % ZEBRA_DETAIL_BACKGROUNDS.length];
                      const detailStyle = { '--activity': String(detailActivity), '--row-bg': detailBg };
                      return (
                        <div className="detail-row" key={detailKey} style={detailStyle}>
                          {detailVisibleColumns.map((column) => (
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
        </div>
      </div>
    </div>
  );
}
