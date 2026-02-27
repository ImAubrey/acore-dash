import React from 'react';

export function LogsPanel(props) {
  const {
    page,
    logsDisabled,
    logStreamStatus,
    setLogsDisabled,
    logsPaused,
    setLogsPaused,
    logLevel,
    applyLogLevel,
    LOG_LEVEL_OPTIONS,
    logSearchQuery,
    setLogSearchQuery,
    autoScroll,
    setAutoScroll,
    logsRef,
    logLines,
    filteredLogLines,
    getLogLineLevelClass,
    renderLogLine
  } = props;

  if (page !== 'logs') return null;

  return (
    <section className="panel logs" style={{ '--delay': '0.2s' }}>
      <div className="panel-header">
        <div>
          <h2>Logs</h2>
          <p>Streaming live logs from the remote core.</p>
        </div>
        <div className="log-controls">
          <button type="button" className={`pill ${logsDisabled ? 'paused' : logStreamStatus}`} onClick={() => setLogsDisabled((prev) => !prev)} title={logsDisabled ? 'Enable log streaming' : 'Disable log streaming'}>{logsDisabled ? 'disabled' : logStreamStatus}</button>
          <button type="button" className={`pill ${logsPaused ? 'paused' : 'live'}`} onClick={() => setLogsPaused((prev) => !prev)} title={logsPaused ? 'Resume log updates' : 'Pause log updates'}>{logsPaused ? 'resume' : 'pause'}</button>
          <select className={`pill log-level-select ${logLevel === 'default' ? 'paused' : 'live'}`} value={logLevel} onChange={(event) => applyLogLevel(event.target.value)} title="Set log level" aria-label="Log level">
            {LOG_LEVEL_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
          </select>
          <div className="log-search-controls">
            <div className="connections-search">
              <input type="text" value={logSearchQuery} onChange={(event) => setLogSearchQuery(event.target.value)} placeholder="Search log lines..." aria-label="Search log lines" />
            </div>
            <button type="button" className={`pill ${autoScroll ? 'live' : 'paused'}`} onClick={() => setAutoScroll((prev) => !prev)} title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}>{autoScroll ? 'auto-scroll' : 'manual'}</button>
          </div>
        </div>
      </div>
      <div className="log-view" ref={logsRef}>
        {logLines.length === 0 ? (
          <div className="log-empty">{logsDisabled ? 'Logs are disabled. Toggle to start.' : 'No logs yet.'}</div>
        ) : filteredLogLines.length === 0 ? (
          <div className="log-empty">No matching logs.</div>
        ) : (
          filteredLogLines.map((line, idx) => (<div className={`log-line ${getLogLineLevelClass(line)}`} key={`${idx}-${line.slice(0, 16)}`}>{renderLogLine(line)}</div>))
        )}
      </div>
    </section>
  );
}
