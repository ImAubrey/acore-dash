import React from 'react';

export function SettingsPanel(props) {
  const {
    page,
    metricsHttp,
    setMetricsHttp,
    metricsKeyVisible,
    setMetricsKeyVisible,
    metricsAccessKey,
    setMetricsAccessKey,
    connRefreshInterval,
    applyConnRefreshInterval,
    CONNECTION_REFRESH_OPTIONS,
    applyApiBase,
    applyAccessKey,
    setSettingsStatus,
    triggerHotReload,
    hotReloadBusy,
    triggerRestart,
    restartCooldown,
    getRestartLabel,
    isFailedStatusText,
    settingsStatus,
    restartInfo,
    settingsPath,
    uiStatePath,
    startupInfo
  } = props;

  if (page !== 'settings') return null;

  return (
    <section className="panel settings" style={{ '--delay': '0.18s' }}>
      <div className="panel-header"><div><h2>Settings</h2><p>Control actions and runtime status.</p></div></div>
      <div className="settings-inline">
        <div className="control-block"><label>Metrics HTTP</label><input value={metricsHttp} onChange={(e) => setMetricsHttp(e.target.value)} placeholder="http://127.0.0.1:8080" /><span className="hint">Leave empty to use the default base.</span></div>
        <div className="control-block"><label>Metrics Access Key</label><div className="input-with-action"><input type={metricsKeyVisible ? 'text' : 'password'} value={metricsAccessKey} onChange={(e) => setMetricsAccessKey(e.target.value)} placeholder="optional" autoComplete="off" /><button type="button" className="ghost small icon-button" onClick={() => setMetricsKeyVisible((prev) => !prev)} title={metricsKeyVisible ? 'Hide key' : 'Show key'} aria-label={metricsKeyVisible ? 'Hide key' : 'Show key'}>{metricsKeyVisible ? '🙈' : '👁️'}</button></div><span className="hint">Optional. Sent as X-Access-Key header (streams use access_key).</span></div>
        <div className="control-block"><label>Connections auto refresh</label><select value={connRefreshInterval} onChange={(e) => applyConnRefreshInterval(e.target.value)} aria-label="Connections auto refresh">{CONNECTION_REFRESH_OPTIONS.map((seconds) => (<option key={seconds} value={seconds}>{seconds}s</option>))}</select><span className="hint">Applies immediately to the live connections stream.</span></div>
      </div>
      <div className="settings-actions">
        <div className="settings-buttons">
          <button className="ghost" type="button" onClick={() => { applyApiBase(metricsHttp); applyAccessKey(metricsAccessKey); setSettingsStatus('Metrics settings updated.'); }}>Apply</button>
          <button className="ghost" type="button" onClick={triggerHotReload} disabled={hotReloadBusy}>{hotReloadBusy ? 'Hot reloading...' : 'Hot reload'}</button>
          <button className="danger" onClick={triggerRestart} disabled={restartCooldown > 0}>{getRestartLabel('Restart core')}</button>
        </div>
        <div className="settings-meta">
          <span className={`status${isFailedStatusText(settingsStatus) ? ' status-danger' : ''}`}>{settingsStatus}</span>
          {restartInfo ? (<span className={`status${restartInfo.ok ? '' : ' status-danger'}`} title={restartInfo.error || restartInfo.rollbackError || ''}>{restartInfo.inProgress ? `${restartInfo.mode === 'hotReload' ? 'Hot reload' : 'Restart'}: in progress (id ${restartInfo.id})` : restartInfo.ok ? `${restartInfo.mode === 'hotReload' ? 'Hot reload' : 'Restart'}: ok (id ${restartInfo.id})` : restartInfo.rolledBack && restartInfo.rollbackOk ? `${restartInfo.mode === 'hotReload' ? 'Hot reload' : 'Restart'}: failed, rolled back (id ${restartInfo.id})` : restartInfo.rolledBack ? `${restartInfo.mode === 'hotReload' ? 'Hot reload' : 'Restart'}: failed, rollback failed (id ${restartInfo.id})` : `${restartInfo.mode === 'hotReload' ? 'Hot reload' : 'Restart'}: failed (id ${restartInfo.id})`}</span>) : null}
          {settingsPath ? <span className="status">Config: {settingsPath}</span> : null}
          {uiStatePath ? <span className="status">UI state: {uiStatePath}</span> : null}
          {startupInfo.available ? <span className="status">Startup info: ready</span> : startupInfo.detail ? <span className="status">Startup info: {startupInfo.detail}</span> : null}
        </div>
      </div>
    </section>
  );
}
