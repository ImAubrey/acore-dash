import React from 'react';
import {
  EmptyState,
  HotReloadButton,
  PanelHeader
} from '../common/panelPrimitives';
import {
  ConnectionsIcon,
  DownloadIcon,
  EditIcon,
  InfoIcon,
  TrashIcon,
  UploadIcon
} from '../connections/actionIcons';
import { DnsEditorCard } from './DnsEditorCard';
import { CONNECTION_ACTIVITY_SCALE, getRateActivity } from '../../dashboardShared';

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
    inboundStatsByTag,
    formatRate,
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
        actions={(
          <>
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
      <div className="inbounds-page-body">
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
              {configInbounds.map((inbound, index) => {
                const tag = String(inbound?.tag || '').trim();
                const protocol = String(inbound?.protocol || '').trim() || 'unknown';
                const listen = String(inbound?.listen || '').trim();
                const portRaw = inbound?.port;
                const port = (portRaw === 0 || portRaw) ? String(portRaw).trim() : '';
                const endpoint = listen || port ? `${listen || '0.0.0.0'}${port ? `:${port}` : ''}` : '';
                const sniffingEnabled = inbound?.sniffing?.enabled === true;
                const clients = Array.isArray(inbound?.settings?.clients) ? inbound.settings.clients.length : 0;
                const key = `${tag || protocol || 'inbound'}-${index}`;
                const trafficStats = tag && inboundStatsByTag ? inboundStatsByTag.get(tag) : null;
                const connectionCount = trafficStats?.connections || 0;
                const uploadRate = trafficStats?.uploadRate || 0;
                const downloadRate = trafficStats?.downloadRate || 0;
                const formatInboundRate = typeof formatRate === 'function'
                  ? formatRate
                  : (value) => `${Math.max(0, Number(value) || 0)} B/s`;
                const uploadLabel = formatInboundRate(uploadRate);
                const downloadLabel = formatInboundRate(downloadRate);
                const trafficActivity = getRateActivity(
                  { upload: uploadRate, download: downloadRate },
                  CONNECTION_ACTIVITY_SCALE,
                  connectionCount
                );
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
                        <span
                          className="meta-pill outbound-traffic-bundle"
                          style={{ '--activity': String(trafficActivity) }}
                          title={`${connectionCount} connections | Upload ${uploadLabel} | Download ${downloadLabel}`}
                        >
                          <span className="outbound-traffic-item outbound-traffic-count">
                            <ConnectionsIcon />
                            <span className="outbound-traffic-value">{connectionCount}</span>
                          </span>
                          <span className="outbound-traffic-separator" aria-hidden="true" />
                          <span className="outbound-traffic-item outbound-traffic-upload">
                            <UploadIcon />
                            <span className="outbound-traffic-value">{uploadLabel}</span>
                          </span>
                          <span className="outbound-traffic-separator" aria-hidden="true" />
                          <span className="outbound-traffic-item outbound-traffic-download">
                            <DownloadIcon />
                            <span className="outbound-traffic-value">{downloadLabel}</span>
                          </span>
                        </span>
                        <button
                          className="action-icon-button action-icon-info"
                          onClick={() => openInfoModal(`Inbound: ${tag || '(no tag)'}`, inbound || null)}
                          title="Info"
                          aria-label={`Info for inbound ${tag || index + 1}`}
                        >
                          <InfoIcon />
                        </button>
                        <button
                          className="action-icon-button action-icon-danger"
                          onClick={() => openDeleteConfirm('inbound', index)}
                          title="Delete"
                          aria-label={`Delete inbound ${tag || index + 1}`}
                        >
                          <TrashIcon />
                        </button>
                        <button
                          className="action-icon-button action-icon-edit"
                          onClick={() => openRulesModal('inbound', 'edit', index, index, inbound)}
                          title="Edit"
                          aria-label={`Edit inbound ${tag || index + 1}`}
                        >
                          <EditIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DnsEditorCard
          apiBase={apiBase}
          loadDnsConfig={loadDnsConfig}
          resetDnsEditor={resetDnsEditor}
          configDnsDirty={configDnsDirty}
          formatDnsEditor={formatDnsEditor}
          configDnsSaving={configDnsSaving}
          saveDnsConfig={saveDnsConfig}
          configDnsStatus={configDnsStatus}
          configDnsPath={configDnsPath}
          configDnsText={configDnsText}
          setConfigDnsText={setConfigDnsText}
          setConfigDnsDirty={setConfigDnsDirty}
          setConfigDnsStatus={setConfigDnsStatus}
          isFailedStatusText={isFailedStatusText}
        />
      </div>
    </section>
  );
}
