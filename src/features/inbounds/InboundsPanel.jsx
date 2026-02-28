import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { githubLight } from '@uiw/codemirror-theme-github';
import {
  EmptyState,
  HotReloadButton,
  PanelHeader,
  StatusText
} from '../common/panelPrimitives';

export function InboundsPanel(props) {
  const {
    page,
    configInboundsStatus,
    isFailedStatusText,
    loadInboundsConfig,
    apiBase,
    triggerHotReloadFromInbounds,
    hotReloadBusy,
    openRulesModal,
    configInboundsPath,
    configInbounds,
    openInfoModal,
    openDeleteConfirm,
    loadDnsConfig,
    resetDnsEditor,
    configDnsDirty,
    formatDnsEditor,
    configDnsSaving,
    saveDnsConfig,
    configDnsStatus,
    configDnsPath,
    configDnsText,
    setConfigDnsText,
    setConfigDnsDirty,
    setConfigDnsStatus
  } = props;

  if (page !== 'inbounds') return null;

  return (
    <section className="panel inbounds" style={{ '--delay': '0.16s' }}>
      <PanelHeader
        title="Inbounds"
        description="Edit top-level inbound definitions (`inbounds`) and persist changes to config."
        actions={(
          <>
          {configInboundsStatus ? (
            <div className="header-status">
              <StatusText
                text={configInboundsStatus}
                danger={isFailedStatusText(configInboundsStatus)}
              />
            </div>
          ) : null}
          <button
            className="ghost small"
            onClick={() => {
              loadInboundsConfig(apiBase).catch(() => {});
            }}
          >
            Reload config
          </button>
          <HotReloadButton
            busy={hotReloadBusy}
            onClick={triggerHotReloadFromInbounds}
          />
          <button
            className="primary small"
            onClick={() => openRulesModal('inbound', 'insert')}
          >
            Add inbound
          </button>
          </>
        )}
      />
      <div className="config-editor-meta">
        {configInboundsPath ? <span className="status">Config: {configInboundsPath}</span> : null}
        <span className="status">Total: {configInbounds.length}</span>
      </div>
      <div className="rules-grid inbounds-grid">
        <div className="group-card">
          <div className="group-header">
            <div>
              <h3>Inbound list</h3>
              <p className="group-meta">Total {configInbounds.length}</p>
            </div>
          </div>
          {configInbounds.length === 0 ? (
            <EmptyState small message="No inbounds configured." />
          ) : (
            <div className="outbound-grid inbound-list-grid">
              {(configInbounds || []).map((inbound, index) => {
                const tag = String(inbound?.tag || '').trim();
                const protocol = String(inbound?.protocol || '').trim() || 'unknown';
                const listen = String(inbound?.listen || '').trim();
                const portRaw = inbound?.port;
                const port = (portRaw === 0 || portRaw) ? String(portRaw).trim() : '';
                const endpoint = listen || port ? `${listen || '0.0.0.0'}${port ? `:${port}` : ''}` : '';
                const sniffingEnabled = inbound?.sniffing?.enabled === true;
                const clients = Array.isArray(inbound?.settings?.clients) ? inbound.settings.clients.length : 0;
                const key = `${tag || protocol || 'inbound'}-${index}`;
                return (
                  <div className="outbound-card" key={key}>
                    <div className="outbound-info">
                      <div className="outbound-title">
                        <span className="rule-index">{index + 1}</span>
                        <h3>{tag || '(no tag)'}</h3>
                      </div>
                      <p>{protocol}</p>
                      {endpoint ? <p className="group-meta mono">{endpoint}</p> : null}
                    </div>
                    <div className="outbound-side">
                      <div className="outbound-meta">
                        {endpoint ? (
                          <span className="meta-pill" title={endpoint}>{endpoint}</span>
                        ) : (
                          <span className="meta-pill">no listen/port</span>
                        )}
                        <span className="meta-pill">{sniffingEnabled ? 'sniffing on' : 'sniffing off'}</span>
                        {clients > 0 ? <span className="meta-pill">{`${clients} clients`}</span> : null}
                      </div>
                      <div className="outbound-actions">
                        <button
                          className="ghost small"
                          onClick={() => openInfoModal(`Inbound: ${tag || '(no tag)'}`, inbound || null)}
                        >
                          Info
                        </button>
                        <button
                          className="ghost small danger-text"
                          onClick={() => openDeleteConfirm('inbound', index)}
                        >
                          Delete
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => openRulesModal('inbound', 'edit', index, index, inbound)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="group-card inbounds-dns-editor">
          <div className="group-header">
            <div>
              <h3>DNS editor</h3>
              <p className="group-meta">Edit top-level DNS section (`dns`).</p>
            </div>
            <div className="rules-editor-actions">
              <button
                className="ghost small"
                onClick={() => {
                  loadDnsConfig(apiBase).catch(() => {});
                }}
              >
                Reload config
              </button>
              <button
                className="ghost small"
                onClick={resetDnsEditor}
                disabled={!configDnsDirty}
              >
                Reset
              </button>
              <button
                className="ghost small"
                onClick={formatDnsEditor}
                disabled={configDnsSaving}
              >
                Format
              </button>
              <button
                className="primary small"
                onClick={saveDnsConfig}
                disabled={configDnsSaving}
              >
                {configDnsSaving ? 'Saving...' : 'Save DNS'}
              </button>
            </div>
          </div>
          <div className="config-editor-meta">
            <StatusText
              text={configDnsStatus}
              danger={isFailedStatusText(configDnsStatus)}
            />
            {configDnsPath ? <span className="status">Config: {configDnsPath}</span> : null}
            {configDnsDirty ? <span className="status">Unsaved changes</span> : null}
          </div>
          <div className="rules-modal-editor config-json-editor">
            <CodeMirror
              value={configDnsText}
              height="320px"
              theme={githubLight}
              extensions={[
                json(),
                lintGutter(),
                linter(jsonParseLinter()),
                EditorView.lineWrapping
              ]}
              onChange={(value) => {
                setConfigDnsText(value);
                setConfigDnsDirty(true);
                if (configDnsStatus && !isFailedStatusText(configDnsStatus)) {
                  setConfigDnsStatus('');
                }
              }}
              aria-label="Edit DNS config JSON"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
