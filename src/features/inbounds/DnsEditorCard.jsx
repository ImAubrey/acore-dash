import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { githubLight } from '@uiw/codemirror-theme-github';
import { EmptyState, StatusText } from '../common/panelPrimitives';
import { ScrollArea } from '../common/ScrollArea';
import { useSortableRuleList } from '../common/useSortableRuleList';
import { EditIcon, TrashIcon } from '../connections/actionIcons';
import {
  dnsListToText,
  dnsServerSummary,
  dnsTextToList,
  formatDnsEditorConfig,
  normalizeDnsHostTargets,
  normalizeDnsServer,
  parseDnsEditorText,
  reorderDnsServers,
  removeDnsHost,
  removeDnsServer,
  setDnsObjectField,
  upsertDnsHost,
  upsertDnsServer,
  validateDnsEditorConfig
} from './dnsEditor';

const QUERY_STRATEGIES = [
  ['', 'Default (UseIP)'],
  ['UseIP', 'Use IP'],
  ['UseIPv4', 'IPv4 only'],
  ['UseIPv6', 'IPv6 only'],
  ['UseSystem', 'System resolver']
];

const OPTIONAL_BOOLEAN_OPTIONS = [
  ['', 'Inherit'],
  ['true', 'Enabled'],
  ['false', 'Disabled']
];

function BufferedField({ value, onCommit, multiline = false, className = '', ...props }) {
  const normalized = value === undefined || value === null ? '' : String(value);
  const [draft, setDraft] = useState(normalized);

  useEffect(() => {
    setDraft(normalized);
  }, [normalized]);

  const commit = () => {
    if (draft !== normalized) onCommit(draft);
  };

  if (multiline) {
    return (
      <textarea
        {...props}
        className={`dns-editor-textarea ${className}`.trim()}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
      />
    );
  }

  return (
    <input
      {...props}
      className={className}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function DnsHostTargetsEditor({ value, disabled = false, onChange }) {
  const targets = normalizeDnsHostTargets(value);
  const [draft, setDraft] = useState('');

  const updateTarget = (index, nextValue) => {
    const nextTargets = [...targets];
    nextTargets[index] = String(nextValue ?? '').trim();
    onChange(nextTargets);
  };

  const removeTarget = (index) => {
    if (targets.length <= 1) return;
    onChange(targets.filter((_, targetIndex) => targetIndex !== index));
  };

  const addTarget = () => {
    const target = draft.trim();
    if (!target) return;
    onChange([...targets, target]);
    setDraft('');
  };

  return (
    <div className="dns-host-targets-editor">
      <span className="dns-host-targets-label">Target IP/domain blocks</span>
      <div className="dns-host-target-blocks">
        {targets.map((target, index) => (
          <div className="dns-host-target-block" key={`${index}:${target}`}>
            <span className="dns-host-target-index">{`Target ${index + 1}`}</span>
            <BufferedField
              value={target}
              disabled={disabled}
              aria-label={`DNS host target ${index + 1}`}
              placeholder="127.0.0.1 or target.example"
              onCommit={(nextValue) => updateTarget(index, nextValue)}
            />
            <button
              className="action-icon-button action-icon-danger"
              type="button"
              title="Delete target block"
              aria-label={`Delete DNS host target ${index + 1}`}
              disabled={disabled || targets.length <= 1}
              onClick={() => removeTarget(index)}
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>
      <div className="dns-host-target-add">
        <input
          value={draft}
          disabled={disabled}
          aria-label="New DNS host target"
          placeholder="Add another IP or domain"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addTarget();
            }
          }}
        />
        <button className="ghost small" type="button" disabled={disabled || !draft.trim()} onClick={addTarget}>
          Add target
        </button>
      </div>
    </div>
  );
}

function ToggleField({ label, checked, onChange, hint = '' }) {
  return (
    <label className="dns-toggle-field">
      <input type="checkbox" checked={checked === true} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

function OptionalBooleanField({ label, value, onChange }) {
  const selected = value === true ? 'true' : value === false ? 'false' : '';
  return (
    <label className="dns-field">
      <span>{label}</span>
      <select
        value={selected}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === '' ? undefined : next === 'true');
        }}
      >
        {OPTIONAL_BOOLEAN_OPTIONS.map(([option, title]) => (
          <option value={option} key={option || 'inherit'}>{title}</option>
        ))}
      </select>
    </label>
  );
}

function QueryStrategyField({ value, onChange }) {
  const normalized = String(value || '');
  const matched = QUERY_STRATEGIES.find(([option]) => option.toLowerCase() === normalized.toLowerCase());
  return (
    <label className="dns-field">
      <span>Query strategy</span>
      <select value={matched?.[0] || ''} onChange={(event) => onChange(event.target.value)}>
        {QUERY_STRATEGIES.map(([option, title]) => (
          <option value={option} key={option || 'default'}>{title}</option>
        ))}
      </select>
      {!matched && normalized ? <small>Current custom value: {normalized}</small> : null}
    </label>
  );
}

export function DnsEditorCard({
  apiBase,
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
  setConfigDnsStatus,
  isFailedStatusText
}) {
  const [section, setSection] = useState('servers');
  const [modal, setModal] = useState(null);
  const [modalStatus, setModalStatus] = useState('');
  const parsed = useMemo(() => parseDnsEditorText(configDnsText), [configDnsText]);
  const config = parsed.config;
  const validationError = parsed.error || validateDnsEditorConfig(config);
  const servers = Array.isArray(config?.servers) ? config.servers : [];
  const hosts = config?.hosts && typeof config.hosts === 'object' && !Array.isArray(config.hosts)
    ? config.hosts
    : {};

  const commitConfig = (nextConfig, message = '') => {
    setConfigDnsText(formatDnsEditorConfig(nextConfig));
    setConfigDnsDirty(true);
    setConfigDnsStatus(message);
  };

  const mutateConfig = (updater, message = '') => {
    if (!config) {
      setConfigDnsStatus(parsed.error || 'Fix the advanced JSON before using visual controls.');
      return;
    }
    const next = updater(config);
    if (next !== config) commitConfig(next, message);
  };

  const reorderServerRules = (fromIndex, targetIndex, position) => {
    mutateConfig((current) => reorderDnsServers(current, fromIndex, targetIndex, position));
  };

  const {
    draggedIndex: draggedServerIndex,
    clearDragState: clearServerDragState,
    handleDragStart: handleServerDragStart,
    handleDragOver: handleServerDragOver,
    handleDragLeave: handleServerDragLeave,
    handleDrop: handleServerDrop,
    getDropPositionForIndex: getServerDropPosition
  } = useSortableRuleList({ onReorder: reorderServerRules });

  const setRootField = (key, value, options) => {
    mutateConfig((current) => setDnsObjectField(current, key, value, options));
  };

  const setRootNumber = (key, raw) => {
    const value = String(raw || '').trim();
    if (!value) {
      setRootField(key, undefined);
      return;
    }
    if (!/^\d+$/.test(value)) {
      setConfigDnsStatus(`${key} must be a non-negative integer.`);
      return;
    }
    setRootField(key, Number(value));
  };

  const closeModal = () => {
    setModal(null);
    setModalStatus('');
  };

  useEffect(() => {
    if (!modal) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || configDnsSaving) return;
      setModal(null);
      setModalStatus('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [configDnsSaving, modal]);

  const openServerModal = (index = null) => {
    if (!config) {
      setConfigDnsStatus(parsed.error || 'Fix the advanced JSON before opening the visual editor.');
      return;
    }
    const isNew = index === null;
    setModal({
      type: 'server',
      index,
      draft: isNew ? { address: '1.1.1.1' } : normalizeDnsServer(servers[index])
    });
    setModalStatus('');
  };

  const openHostModal = (name = null) => {
    if (!config) {
      setConfigDnsStatus(parsed.error || 'Fix the advanced JSON before opening the visual editor.');
      return;
    }
    const isNew = name === null;
    const configWithDefault = isNew ? addDnsHost(config) : config;
    const defaultName = isNew
      ? Object.keys(configWithDefault.hosts || {}).find((candidate) => !Object.prototype.hasOwnProperty.call(hosts, candidate)) || 'example.local'
      : name;
    setModal({
      type: 'host',
      previousName: name,
      name: defaultName,
      targets: isNew ? ['127.0.0.1'] : normalizeDnsHostTargets(hosts[name])
    });
    setModalStatus('');
  };

  const updateModalServer = (key, value, options) => {
    setModal((current) => current?.type === 'server'
      ? { ...current, draft: setDnsObjectField(current.draft, key, value, options) }
      : current);
  };

  const updateModalServerNumber = (key, raw) => {
    const value = String(raw || '').trim();
    if (!value) {
      updateModalServer(key, undefined);
      return;
    }
    if (!/^\d+$/.test(value)) {
      setModalStatus(`${key} must be a non-negative integer.`);
      return;
    }
    updateModalServer(key, Number(value));
  };

  const saveServerModal = () => {
    if (!modal || modal.type !== 'server') return;
    if (!config) {
      setModalStatus(parsed.error || 'Fix the advanced JSON before saving.');
      return;
    }
    const result = upsertDnsServer(config, modal.index, modal.draft);
    if (result.error) {
      setModalStatus(result.error);
      return;
    }
    commitConfig(result.config);
    closeModal();
  };

  const saveHostModal = () => {
    if (!modal || modal.type !== 'host') return;
    if (!config) {
      setModalStatus(parsed.error || 'Fix the advanced JSON before saving.');
      return;
    }
    const result = upsertDnsHost(config, modal.previousName, modal.name, modal.targets);
    if (result.error) {
      setModalStatus(result.error);
      return;
    }
    commitConfig(result.config);
    closeModal();
  };

  const renderGlobalSettings = () => (
    <div className="dns-editor-section-body">
      <div className="dns-editor-section-title">
        <div>
          <h4>Global resolver settings</h4>
          <p>Defaults inherited by every DNS server unless overridden by a server rule.</p>
        </div>
      </div>
      <div className="dns-editor-form-grid">
        <label className="dns-field">
          <span>DNS tag</span>
          <BufferedField
            value={config?.tag}
            placeholder="dns"
            onCommit={(value) => setRootField('tag', value, { deleteEmpty: true })}
          />
        </label>
        <label className="dns-field">
          <span>Client IP / ECS</span>
          <BufferedField
            value={config?.clientIp}
            placeholder="10.0.0.1"
            onCommit={(value) => setRootField('clientIp', value, { deleteEmpty: true })}
          />
        </label>
        <QueryStrategyField
          value={config?.queryStrategy}
          onChange={(value) => setRootField('queryStrategy', value, { deleteEmpty: true })}
        />
        <label className="dns-field">
          <span>Cache size</span>
          <BufferedField
            type="number"
            min="0"
            value={config?.cacheSize}
            placeholder="0"
            onCommit={(value) => setRootNumber('cacheSize', value)}
          />
        </label>
        <label className="dns-field">
          <span>Serve expired TTL (seconds)</span>
          <BufferedField
            type="number"
            min="0"
            value={config?.serveExpiredTTL}
            placeholder="86400"
            onCommit={(value) => setRootNumber('serveExpiredTTL', value)}
          />
        </label>
        <OptionalBooleanField
          label="Serve stale"
          value={config?.serveStale}
          onChange={(value) => setRootField('serveStale', value)}
        />
        <OptionalBooleanField
          label="Optimistic cache (legacy override)"
          value={config?.optimisticCache}
          onChange={(value) => setRootField('optimisticCache', value)}
        />
      </div>
      <div className="dns-toggle-grid">
        <ToggleField label="Disable cache" checked={config?.disableCache} onChange={(value) => setRootField('disableCache', value)} />
        <ToggleField label="Disable fallback" checked={config?.disableFallback} onChange={(value) => setRootField('disableFallback', value)} />
        <ToggleField label="Disable fallback if matched" checked={config?.disableFallbackIfMatch} onChange={(value) => setRootField('disableFallbackIfMatch', value)} />
        <ToggleField label="Parallel query" checked={config?.enableParallelQuery} onChange={(value) => setRootField('enableParallelQuery', value)} />
        <ToggleField label="Use system hosts" checked={config?.useSystemHosts} onChange={(value) => setRootField('useSystemHosts', value)} />
      </div>
    </div>
  );

  const renderServers = () => (
    <div className="dns-editor-section-body">
      <div className="dns-editor-section-title">
        <div>
          <h4>DNS server rules</h4>
          <p>Order matters. Domain and expected-IP rules decide which resolver is preferred.</p>
        </div>
        <button className="primary small" type="button" onClick={() => openServerModal()} disabled={configDnsSaving || !config}>
          Add server
        </button>
      </div>
      {servers.length === 0 ? (
        <EmptyState small message="No DNS servers configured." />
      ) : (
        <div className="dns-server-list">
          {servers.map((rawServer, index) => {
            const server = normalizeDnsServer(rawServer);
            const summary = dnsServerSummary(rawServer, index);
            const dropPosition = getServerDropPosition(index);
            const cardClassName = [
              'dns-server-card',
              'rule-item-sortable',
              draggedServerIndex === index ? 'rule-item-dragging' : '',
              dropPosition === 'before' ? 'rule-item-drop-before' : '',
              dropPosition === 'after' ? 'rule-item-drop-after' : ''
            ].filter(Boolean).join(' ');
            return (
              <div
                className={cardClassName}
                key={`dns-server-${index}`}
                onDragOver={(event) => handleServerDragOver(event, index)}
                onDragLeave={() => handleServerDragLeave(index)}
                onDrop={(event) => handleServerDrop(event, index)}
              >
                <div className="dns-server-summary">
                  <span
                    className="rule-index rule-drag-handle"
                    draggable={!configDnsSaving}
                    title="Drag to reorder"
                    aria-label={`Drag DNS server rule ${index + 1}`}
                    onDragStart={(event) => handleServerDragStart(event, index)}
                    onDragEnd={clearServerDragState}
                  >
                    {index + 1}
                  </span>
                  <span className="dns-server-summary-main">
                    <strong>{summary.title}</strong>
                    <small className="mono">{summary.endpoint}</small>
                  </span>
                  <span className="dns-server-summary-pills">
                    {summary.domains > 0 ? <span className="meta-pill">{summary.domains} domain rules</span> : null}
                    {server.skipFallback === true ? <span className="meta-pill">skip fallback</span> : null}
                    {server.finalQuery === true ? <span className="meta-pill">final</span> : null}
                  </span>
                  <div className="dns-server-actions">
                    <button
                      className="action-icon-button action-icon-edit"
                      type="button"
                      title="Edit"
                      aria-label={`Edit DNS server rule ${index + 1}`}
                      onClick={() => openServerModal(index)}
                      disabled={configDnsSaving}
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="action-icon-button action-icon-danger"
                      type="button"
                      title="Delete"
                      aria-label={`Delete DNS server rule ${index + 1}`}
                      disabled={configDnsSaving}
                      onClick={() => mutateConfig((current) => removeDnsServer(current, index))}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderHosts = () => {
    const entries = Object.entries(hosts);
    return (
      <div className="dns-editor-section-body">
        <div className="dns-editor-section-title">
          <div>
            <h4>Static host rules</h4>
            <p>Map exact, domain, full, regexp, keyword, geosite or ext patterns to IPs or another domain.</p>
          </div>
          <button className="primary small" type="button" onClick={() => openHostModal()} disabled={configDnsSaving || !config}>Add host</button>
        </div>
        {entries.length === 0 ? (
          <EmptyState small message="No DNS host mappings configured." />
        ) : (
          <div className="dns-host-list">
            {entries.map(([name, value], index) => {
              return (
                <div className="dns-host-row dns-host-summary" key={name}>
                  <span className="rule-index">{index + 1}</span>
                  <span className="dns-host-summary-main"><strong>{name}</strong><small className="mono">{normalizeDnsHostTargets(value).join(', ')}</small></span>
                  <div className="dns-server-actions">
                    <button
                      className="action-icon-button action-icon-edit"
                      type="button"
                      title="Edit"
                      aria-label={`Edit DNS host rule ${name}`}
                      onClick={() => openHostModal(name)}
                      disabled={configDnsSaving}
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="action-icon-button action-icon-danger"
                      type="button"
                      title="Delete"
                      aria-label={`Delete DNS host rule ${name}`}
                      disabled={configDnsSaving}
                      onClick={() => mutateConfig((current) => removeDnsHost(current, name))}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderEditorModal = () => {
    if (!modal || typeof document === 'undefined') return null;
    const isServer = modal.type === 'server';
    const draft = isServer ? modal.draft : null;
    const setServerList = (key, legacyKey, rawValue) => {
      const values = dnsTextToList(rawValue);
      setModal((current) => {
        if (current?.type !== 'server') return current;
        const next = setDnsObjectField(current.draft, key, values.length ? values : undefined);
        if (legacyKey) delete next[legacyKey];
        return { ...current, draft: next };
      });
    };
    const modalTitle = isServer
      ? (modal.index === null ? 'Add DNS server' : `Edit DNS server #${modal.index + 1}`)
      : (modal.previousName === null ? 'Add host mapping' : `Edit host mapping: ${modal.previousName}`);
    return createPortal(
      <div
        className="modal-backdrop dns-editor-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dns-editor-modal-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !configDnsSaving) closeModal();
        }}
      >
        <div className="modal dns-editor-modal">
          <div className="modal-header modal-fixed-header">
            <div>
              <h3 id="dns-editor-modal-title">{modalTitle}</h3>
              <p className="group-meta">Changes stay in this draft until you save.</p>
            </div>
            <button className="ghost small" type="button" onClick={closeModal} disabled={configDnsSaving}>Close</button>
          </div>
          <ScrollArea className="modal-body-scroll dns-editor-modal-scroll" contentClassName="modal-body-content dns-editor-modal-content" ariaLabel={modalTitle}>
            {isServer ? (
              <div className="dns-editor-form-grid">
                <label className="dns-field dns-field-wide">
                  <span>Address</span>
                  <input autoFocus value={draft.address ?? ''} placeholder="1.1.1.1 or https://dns.example/dns-query" onChange={(event) => updateModalServer('address', event.target.value, { deleteEmpty: true })} />
                </label>
                <label className="dns-field"><span>Port</span><input type="number" min="0" max="65535" value={draft.port ?? ''} placeholder="53" onChange={(event) => updateModalServerNumber('port', event.target.value)} /></label>
                <label className="dns-field"><span>Rule tag</span><input value={draft.tag ?? ''} placeholder="cloudflare" onChange={(event) => updateModalServer('tag', event.target.value, { deleteEmpty: true })} /></label>
                <label className="dns-field"><span>Client IP / ECS</span><input value={draft.clientIp ?? ''} placeholder="10.0.0.1" onChange={(event) => updateModalServer('clientIp', event.target.value, { deleteEmpty: true })} /></label>
                <QueryStrategyField value={draft.queryStrategy} onChange={(value) => updateModalServer('queryStrategy', value, { deleteEmpty: true })} />
                <label className="dns-field"><span>Timeout (ms)</span><input type="number" min="0" value={draft.timeoutMs ?? ''} placeholder="2000" onChange={(event) => updateModalServerNumber('timeoutMs', event.target.value)} /></label>
                <label className="dns-field"><span>Serve expired TTL</span><input type="number" min="0" value={draft.serveExpiredTTL ?? ''} placeholder="86400" onChange={(event) => updateModalServerNumber('serveExpiredTTL', event.target.value)} /></label>
                <OptionalBooleanField label="Disable cache" value={draft.disableCache} onChange={(value) => updateModalServer('disableCache', value)} />
                <OptionalBooleanField label="Serve stale" value={draft.serveStale} onChange={(value) => updateModalServer('serveStale', value)} />
                <OptionalBooleanField label="Optimistic cache" value={draft.optimisticCache} onChange={(value) => updateModalServer('optimisticCache', value)} />
                <label className="dns-field dns-field-list"><span>Domain rules</span><textarea className="dns-editor-textarea" rows="4" value={dnsListToText(draft.domains ?? draft.domain)} placeholder={'domain:example.com\nfull:www.example.com\ngeosite:cn'} onChange={(event) => setServerList('domains', 'domain', event.target.value)} /></label>
                <label className="dns-field dns-field-list"><span>Expected IP rules</span><textarea className="dns-editor-textarea" rows="4" value={dnsListToText(draft.expectedIPs ?? draft.expectIPs)} placeholder={'geoip:cn\n10.0.0.0/8\n*'} onChange={(event) => setServerList('expectedIPs', 'expectIPs', event.target.value)} /></label>
                <label className="dns-field dns-field-list"><span>Unexpected IP rules</span><textarea className="dns-editor-textarea" rows="4" value={dnsListToText(draft.unexpectedIPs)} placeholder={'geoip:private\n*'} onChange={(event) => setServerList('unexpectedIPs', null, event.target.value)} /></label>
                <label className="dns-field dns-field-list"><span>Outbound tags</span><textarea className="dns-editor-textarea" rows="4" value={dnsListToText(draft.outboundTags ?? draft.outboundTag)} placeholder={'direct\nproxy'} onChange={(event) => setServerList('outboundTags', 'outboundTag', event.target.value)} /></label>
                <div className="dns-toggle-grid compact dns-modal-toggle-grid">
                  <ToggleField label="Skip fallback" checked={draft.skipFallback} onChange={(value) => updateModalServer('skipFallback', value)} />
                  <ToggleField label="Final query" checked={draft.finalQuery} onChange={(value) => updateModalServer('finalQuery', value)} />
                </div>
              </div>
            ) : (
              <div className="dns-host-modal-form">
                <label className="dns-field">
                  <span>Domain rule</span>
                  <input autoFocus value={modal.name} placeholder="domain:example.com" onChange={(event) => setModal((current) => current?.type === 'host' ? { ...current, name: event.target.value } : current)} />
                </label>
                <DnsHostTargetsEditor value={modal.targets} disabled={configDnsSaving} onChange={(targets) => setModal((current) => current?.type === 'host' ? { ...current, targets } : current)} />
              </div>
            )}
          </ScrollArea>
          <div className="modal-fixed-footer dns-editor-modal-footer">
            <span className="status" role="status">{modalStatus}</span>
            <div className="confirm-actions">
              <button className="ghost small" type="button" onClick={closeModal} disabled={configDnsSaving}>Cancel</button>
              <button className="primary small" type="button" onClick={isServer ? saveServerModal : saveHostModal} disabled={configDnsSaving}>Save</button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderAdvanced = () => (
    <div className="dns-editor-section-body">
      <div className="dns-editor-section-title">
        <div>
          <h4>Advanced JSON</h4>
          <p>Unknown and newly introduced DNS fields remain available here.</p>
        </div>
        <button className="ghost small" type="button" onClick={formatDnsEditor} disabled={configDnsSaving}>Format JSON</button>
      </div>
      <div className="rules-modal-editor config-json-editor dns-advanced-editor">
        <CodeMirror
          value={configDnsText}
          minHeight="320px"
          theme={githubLight}
          extensions={[json(), lintGutter(), linter(jsonParseLinter()), EditorView.lineWrapping]}
          onChange={(value) => {
            setConfigDnsText(value);
            setConfigDnsDirty(true);
            if (configDnsStatus && !isFailedStatusText(configDnsStatus)) setConfigDnsStatus('');
          }}
          aria-label="Edit DNS config JSON"
        />
      </div>
    </div>
  );

  const sections = [
    ['servers', 'Server rules', servers.length],
    ['hosts', 'Hosts', Object.keys(hosts).length],
    ['global', 'Global settings', null],
    ['advanced', 'Advanced JSON', null]
  ];

  return (
    <>
    <div className="group-card inbounds-dns-editor dns-visual-editor">
      <div className="group-header">
        <div>
          <h3>DNS editor</h3>
        </div>
        <div className="rules-editor-actions">
          <button className="ghost small" type="button" onClick={() => loadDnsConfig(apiBase).catch(() => {})}>Reload config</button>
          <button className="ghost small" type="button" onClick={resetDnsEditor} disabled={!configDnsDirty}>Reset</button>
          <button className="primary small" type="button" onClick={saveDnsConfig} disabled={configDnsSaving || Boolean(validationError)}>
            {configDnsSaving ? 'Saving...' : 'Save DNS'}
          </button>
        </div>
      </div>
      <div className="config-editor-meta">
        <StatusText text={configDnsStatus} danger={isFailedStatusText(configDnsStatus)} />
        {configDnsPath ? <span className="status">Config: {configDnsPath}</span> : null}
        {configDnsDirty ? <span className="status dns-unsaved-pill">Unsaved changes</span> : null}
      </div>
      <div className="dns-editor-overview">
        <span><strong>{servers.length}</strong> servers</span>
        <span><strong>{Object.keys(hosts).length}</strong> hosts</span>
        <span><strong>{String(config?.queryStrategy || 'UseIP')}</strong> strategy</span>
      </div>
      <div className="dns-editor-tabs" role="tablist" aria-label="DNS editor sections">
        {sections.map(([key, label, count]) => (
          <button
            className={`dns-editor-tab${section === key ? ' active' : ''}`}
            type="button"
            role="tab"
            aria-selected={section === key}
            onClick={() => setSection(key)}
            key={key}
          >
            {label}{count === null ? '' : ` (${count})`}
          </button>
        ))}
      </div>
      {!parsed.error && validationError ? (
        <div className="dns-editor-error">
          <strong>DNS configuration needs attention</strong>
          <span>{validationError}</span>
          <button className="ghost small" type="button" onClick={() => setSection('servers')}>Review rules</button>
        </div>
      ) : null}
      {parsed.error && section !== 'advanced' ? (
        <div className="dns-editor-error">
          <strong>Visual editor paused</strong>
          <span>{parsed.error}</span>
          <button className="ghost small" type="button" onClick={() => setSection('advanced')}>Open Advanced JSON</button>
        </div>
      ) : section === 'global' ? renderGlobalSettings()
        : section === 'hosts' ? renderHosts()
          : section === 'advanced' ? renderAdvanced()
            : renderServers()}
    </div>
    {renderEditorModal()}
    </>
  );
}
