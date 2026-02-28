import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { githubLight } from '@uiw/codemirror-theme-github';
import {
  EyeIcon,
  HotReloadButton,
  PanelHeader,
  StatusText
} from '../common/panelPrimitives';
import { formatMetricsPanelOptionLabel } from '../../dashboardShared';

const getRestartModeLabel = (mode) => (mode === 'hotReload' ? 'Hot reload' : 'Restart');

const getRestartInfoMessage = (restartInfo) => {
  if (!restartInfo) return '';
  const modeLabel = getRestartModeLabel(restartInfo.mode);
  const id = restartInfo.id;
  if (restartInfo.inProgress) return `${modeLabel}: in progress (id ${id})`;
  if (restartInfo.ok) return `${modeLabel}: ok (id ${id})`;
  if (restartInfo.rolledBack && restartInfo.rollbackOk) {
    return `${modeLabel}: failed, rolled back (id ${id})`;
  }
  if (restartInfo.rolledBack) return `${modeLabel}: failed, rollback failed (id ${id})`;
  return `${modeLabel}: failed (id ${id})`;
};

function SavedMetricsPanels({
  metricsPanelHistory,
  metricsKeyVisible,
  applySavedMetricsPanel,
  removeSavedMetricsPanel
}) {
  const hasSavedPanels = Array.isArray(metricsPanelHistory) && metricsPanelHistory.length > 0;

  return (
    <div className="metrics-history">
      <div className="metrics-history-head">
        <span className="metrics-history-title">Saved metrics panels</span>
        <span className="hint">Click address to switch. Click X to remove.</span>
      </div>
      {hasSavedPanels ? (
        <div className="metrics-history-list">
          {metricsPanelHistory.map((item) => {
            const optionLabel = formatMetricsPanelOptionLabel(item);
            return (
              <div className="metrics-history-item" key={item.id}>
                <div className="metrics-history-top">
                  <button
                    type="button"
                    className="metrics-history-remove"
                    title="Remove saved panel"
                    aria-label="Remove saved panel"
                    onClick={() => removeSavedMetricsPanel(item.id)}
                  >
                    X
                  </button>
                  <button
                    type="button"
                    className="metrics-history-entry"
                    title={optionLabel ? `Switch to ${optionLabel}` : `Switch to ${item.base}`}
                    onClick={() => applySavedMetricsPanel(item)}
                  >
                    <span className="mono metrics-history-base">{item.base}</span>
                  </button>
                </div>
                <div className="metrics-history-keyline">
                  <span className="metrics-history-key-label">key</span>
                  <span className="mono metrics-history-key-value">
                    {item.key ? (metricsKeyVisible ? item.key : '••••••••') : '(empty)'}
                  </span>
                </div>
                <div className="metrics-history-refreshline">
                  <span className="metrics-history-key-label">refresh</span>
                  <span className="mono metrics-history-key-value">{item.connRefreshInterval || 1}s</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="metrics-history-empty hint">No saved metrics panels yet.</div>
      )}
    </div>
  );
}

export function SettingsPanel(props) {
  const {
    page,
    metricsHttp,
    setMetricsHttp,
    metricsKeyVisible,
    setMetricsKeyVisible,
    metricsAccessKey,
    setMetricsAccessKey,
    metricsPanelHistory,
    applyMetricsSettings,
    applySavedMetricsPanel,
    removeSavedMetricsPanel,
    connRefreshInterval,
    applyConnRefreshInterval,
    CONNECTION_REFRESH_OPTIONS,
    triggerHotReload,
    hotReloadBusy,
    triggerDnsCacheFlushFromSettings,
    dnsCacheFlushBusy,
    triggerRestart,
    restartCooldown,
    getRestartLabel,
    isFailedStatusText,
    settingsStatus,
    restartInfo,
    settingsPath,
    uiStatePath,
    startupInfo,
    loadMainConfig,
    apiBase,
    resetMainConfigEditor,
    configMainDirty,
    formatMainConfigEditor,
    configMainSaving,
    saveMainConfig,
    configMainStatus,
    configMainPath,
    configMainText,
    setConfigMainText,
    setConfigMainDirty,
    setConfigMainStatus
  } = props;
  if (page !== 'settings') return null;

  const restartInfoMessage = getRestartInfoMessage(restartInfo);
  const restartInfoTitle = restartInfo
    ? (restartInfo.error || restartInfo.rollbackError || '')
    : '';

  const handleMainConfigTextChange = (value) => {
    setConfigMainText(value);
    setConfigMainDirty(true);
    if (configMainStatus && !isFailedStatusText(configMainStatus)) {
      setConfigMainStatus('');
    }
  };

  return (
    <section className="panel settings" style={{ '--delay': '0.18s' }}>
      <PanelHeader
        title="Settings"
        description="Control actions and runtime status."
      />
      <SavedMetricsPanels
        metricsPanelHistory={metricsPanelHistory}
        metricsKeyVisible={metricsKeyVisible}
        applySavedMetricsPanel={applySavedMetricsPanel}
        removeSavedMetricsPanel={removeSavedMetricsPanel}
      />
      <div className="settings-inline">
        <div className="control-block settings-metrics-http">
          <label>Metrics HTTP</label>
          <input
            value={metricsHttp}
            onChange={(event) => setMetricsHttp(event.target.value)}
            placeholder="http://127.0.0.1:8080"
          />
          <span className="hint">Leave empty to use the default base.</span>
        </div>
        <div className="control-block settings-metrics-key">
          <label>Metrics Access Key</label>
          <div className="input-with-action">
            <input
              type={metricsKeyVisible ? 'text' : 'password'}
              value={metricsAccessKey}
              onChange={(event) => setMetricsAccessKey(event.target.value)}
              placeholder="optional"
              autoComplete="off"
            />
            <button
              type="button"
              className="ghost small icon-button"
              onClick={() => setMetricsKeyVisible((prev) => !prev)}
              title={metricsKeyVisible ? 'Hide key' : 'Show key'}
              aria-label={metricsKeyVisible ? 'Hide key' : 'Show key'}
            >
              <EyeIcon hidden={metricsKeyVisible} />
            </button>
          </div>
          <span className="hint">Optional. Sent as X-Access-Key header (streams use access_key).</span>
        </div>
        <div className="control-block settings-metrics-refresh">
          <label>Connections auto refresh</label>
          <select
            value={connRefreshInterval}
            onChange={(event) => applyConnRefreshInterval(event.target.value)}
            aria-label="Connections auto refresh"
          >
            {CONNECTION_REFRESH_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>{seconds}s</option>
            ))}
          </select>
          <span className="hint">Applies immediately to the live connections stream.</span>
        </div>
      </div>
      <div className="settings-actions">
        <div className="settings-buttons">
          <button className="ghost" type="button" onClick={applyMetricsSettings}>
            Apply
          </button>
          <HotReloadButton
            busy={hotReloadBusy}
            onClick={triggerHotReload}
            className="ghost"
            idleLabel="Hot reload"
          />
          <button
            className="ghost"
            type="button"
            onClick={triggerDnsCacheFlushFromSettings}
            disabled={dnsCacheFlushBusy}
          >
            {dnsCacheFlushBusy ? 'Flushing DNS...' : 'Flush DNS cache'}
          </button>
          <button className="danger" onClick={triggerRestart} disabled={restartCooldown > 0}>
            {getRestartLabel('Restart core')}
          </button>
        </div>
        <div className="settings-meta">
          <StatusText
            text={settingsStatus}
            danger={isFailedStatusText(settingsStatus)}
          />
          {restartInfoMessage ? (
            <span
              className={`status${restartInfo?.ok ? '' : ' status-danger'}`}
              title={restartInfoTitle}
            >
              {restartInfoMessage}
            </span>
          ) : null}
          {settingsPath ? <span className="status">Config: {settingsPath}</span> : null}
          {uiStatePath ? <span className="status">UI state: {uiStatePath}</span> : null}
          {startupInfo.available ? <span className="status">Startup info: ready</span> : null}
          {!startupInfo.available && startupInfo.detail ? (
            <span className="status">Startup info: {startupInfo.detail}</span>
          ) : null}
        </div>
      </div>
      <div className="group-card settings-main-editor">
        <div className="group-header">
          <div>
            <h3>Main config editor</h3>
            <p className="group-meta">Only edits `Observatory`, `log`, `metrics`, and `stats`.</p>
          </div>
          <div className="rules-editor-actions">
            <button
              className="ghost small"
              onClick={() => {
                loadMainConfig(apiBase).catch(() => {});
              }}
            >
              Reload config
            </button>
            <button className="ghost small" onClick={resetMainConfigEditor} disabled={!configMainDirty}>
              Reset
            </button>
            <button className="ghost small" onClick={formatMainConfigEditor} disabled={configMainSaving}>
              Format
            </button>
            <button className="primary small" onClick={saveMainConfig} disabled={configMainSaving}>
              {configMainSaving ? 'Saving...' : 'Save main'}
            </button>
          </div>
        </div>
        <div className="config-editor-meta">
          <StatusText
            text={configMainStatus}
            danger={isFailedStatusText(configMainStatus)}
          />
          {configMainPath ? <span className="status">Config: {configMainPath}</span> : null}
          {configMainDirty ? <span className="status">Unsaved changes</span> : null}
        </div>
        <div className="rules-modal-editor config-json-editor">
          <CodeMirror
            value={configMainText}
            height="420px"
            theme={githubLight}
            extensions={[json(), lintGutter(), linter(jsonParseLinter()), EditorView.lineWrapping]}
            onChange={handleMainConfigTextChange}
            aria-label="Edit main config JSON"
          />
        </div>
      </div>
    </section>
  );
}
