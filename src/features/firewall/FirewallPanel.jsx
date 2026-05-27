import { useMemo } from 'react';
import {
  EmptyState,
  HeaderSearchInput,
  HotReloadButton,
  PanelHeader,
  StatusText
} from '../common/panelPrimitives';
import { getRuleOrderChanges, useSortableRuleList } from '../common/useSortableRuleList';
import { getFirewallRuleList, normalizeFirewallRule } from '../../dashboardShared';

const FIREWALL_ACTION_LABELS = {
  0: 'mark',
  1: 'allow',
  2: 'block',
  3: 'limit',
  mark: 'mark',
  allow: 'allow',
  block: 'block',
  limit: 'limit'
};

const FIREWALL_LIMIT_KEY_LABELS = {
  0: 'srcIp',
  1: 'dstIp',
  2: 'srcDstIp',
  3: 'srcPrefix',
  4: 'dstPrefix',
  srcip: 'srcIp',
  dstip: 'dstIp',
  srcdstip: 'srcDstIp',
  srcprefix: 'srcPrefix',
  dstprefix: 'dstPrefix'
};

const resolveFirewallAction = (value) => {
  const raw = typeof value === 'string' ? value.trim() : value;
  const key = typeof raw === 'string' ? raw.toLowerCase() : raw;
  const label = FIREWALL_ACTION_LABELS[key] || String(raw || 'allow');
  const tone = label === 'block'
    ? 'block'
    : label === 'limit'
      ? 'limit'
      : label === 'mark'
        ? 'mark'
        : 'allow';
  return { label, tone };
};

const resolveFirewallLimitKey = (value) => {
  const raw = typeof value === 'string' ? value.trim() : value;
  const key = typeof raw === 'string' ? raw.toLowerCase() : raw;
  return FIREWALL_LIMIT_KEY_LABELS[key] || String(raw || 'srcIp');
};

const buildFirewallTitle = (rule, index) => {
  const current = normalizeFirewallRule(rule);
  const ruleTag = String(current.ruleTag || '').trim();
  if (ruleTag) return ruleTag;

  const domain = Array.isArray(current.domain) ? String(current.domain[0] || '').trim() : '';
  if (domain) return domain;

  const inboundTag = Array.isArray(current.inboundTag) ? String(current.inboundTag[0] || '').trim() : '';
  if (inboundTag) return inboundTag;

  return `firewall rule ${index + 1}`;
};

const buildFirewallSummary = (rule) => {
  const current = normalizeFirewallRule(rule);
  const summary = [];
  const domains = Array.isArray(current.domain) ? current.domain.filter(Boolean) : [];
  const ips = Array.isArray(current.ip) ? current.ip.filter(Boolean) : [];
  const sourceIPs = Array.isArray(current.sourceIP)
    ? current.sourceIP.filter(Boolean)
    : Array.isArray(current.source)
      ? current.source.filter(Boolean)
      : [];
  const protocols = Array.isArray(current.protocol) ? current.protocol.filter(Boolean) : [];
  const inboundTags = Array.isArray(current.inboundTag) ? current.inboundTag.filter(Boolean) : [];
  const processNames = Array.isArray(current.process) ? current.process.filter(Boolean) : [];
  const requireRuleTags = Array.isArray(current.requireRuleTag) ? current.requireRuleTag.filter(Boolean) : [];

  if (domains.length > 0) summary.push(`Domain: ${domains.join(', ')}`);
  if (ips.length > 0) summary.push(`IP: ${ips.join(', ')}`);
  if (sourceIPs.length > 0) summary.push(`Source: ${sourceIPs.join(', ')}`);
  if (protocols.length > 0) summary.push(`Protocol: ${protocols.join(', ')}`);
  if (inboundTags.length > 0) summary.push(`Inbound: ${inboundTags.join(', ')}`);
  if (processNames.length > 0) summary.push(`Process: ${processNames.join(', ')}`);
  if (requireRuleTags.length > 0) summary.push(`Require: ${requireRuleTags.join(', ')}`);

  const port = String(current.port || '').trim();
  if (port) summary.push(`Port: ${port}`);

  const network = String(current.network || '').trim();
  if (network) summary.push(`Network: ${network}`);

  const destination = String(current.destination || current.targetTag || current.outboundTag || current.balancerTag || '').trim();
  if (destination) summary.push(`Target: ${destination}`);

  return summary;
};

const buildFirewallLimitSummary = (rule) => {
  const limit = rule && typeof rule.limit === 'object' ? rule.limit : null;
  if (!limit) return '';

  const key = resolveFirewallLimitKey(limit.key);
  const max = limit.max_connections ?? limit.maxConnections ?? '';
  if (max === '' || max === null || max === undefined) {
    return `Limit key: ${key}`;
  }
  return `Limit ${key}: ${max}`;
};

export function FirewallPanel({
  page,
  configFirewallStatus,
  isFailedStatusText,
  firewallSearchQuery,
  setFirewallSearchQuery,
  triggerHotReloadFromFirewall,
  hotReloadBusy,
  openRulesModal,
  configFirewall,
  configFirewallBaseline,
  hasFirewallDraft,
  filteredFirewallEntries,
  normalizedFirewallSearchQuery,
  configFirewallPath,
  loadFirewallConfig,
  apiBase,
  openDeleteConfirm,
  setConfigFirewall,
  saveFirewallConfig,
  firewallConfigSaving,
  discardFirewallDraftBusy,
  discardFirewallDraft,
  reorderFirewallRules,
  highlightFirewallCell
}) {
  const {
    draggedIndex: draggedFirewallRuleIndex,
    clearDragState: clearFirewallDragState,
    handleDragStart: handleFirewallDragStart,
    handleDragOver: handleFirewallDragOver,
    handleDragLeave: handleFirewallDragLeave,
    handleDrop: handleFirewallDrop,
    getDropPositionForIndex
  } = useSortableRuleList({ onReorder: reorderFirewallRules });

  const firewall = configFirewall && typeof configFirewall === 'object' ? configFirewall : {};
  const firewallRules = getFirewallRuleList(firewall);
  const baselineFirewallRules = getFirewallRuleList(configFirewallBaseline);
  const firewallOrderChanges = useMemo(
    () => getRuleOrderChanges(firewallRules, baselineFirewallRules, hasFirewallDraft),
    [firewallRules, baselineFirewallRules, hasFirewallDraft]
  );

  if (page !== 'firewall') {
    return null;
  }

  return (
    <section className="panel firewall" style={{ '--delay': '0.19s' }}>
      <PanelHeader
        title="Firewall"
        description="Edit top-level firewall rules with flat routing-style match fields."
        actions={(
          <>
          <div className="header-status">
            <StatusText
              text={configFirewallStatus}
              danger={isFailedStatusText(configFirewallStatus)}
            />
          </div>
          <HeaderSearchInput
            value={firewallSearchQuery}
            setValue={setFirewallSearchQuery}
            placeholder="Search firewall rules..."
            ariaLabel="Search firewall rules"
          />
          <HotReloadButton
            busy={hotReloadBusy}
            onClick={triggerHotReloadFromFirewall}
            draftVisible={hasFirewallDraft}
            draftBusy={discardFirewallDraftBusy}
            onUndoDraft={discardFirewallDraft}
            undoDraftTitle="Discard unsaved firewall draft edits"
          />
          <button className="primary small" onClick={() => openRulesModal('firewallRule', 'insert')}>
            Add firewall rule
          </button>
          </>
        )}
      />

      <div className="rules-grid firewall-grid">
        <div className="group-card firewall-rules-card">
          <div className="group-header">
            <div>
              <h3>Firewall rules</h3>
              <p className="group-meta">
                Total {firewallRules.length}
                {normalizedFirewallSearchQuery ? ` · Match ${filteredFirewallEntries.length}` : ''}
              </p>
              {configFirewallPath ? (
                <p className="group-meta mono">Config: {configFirewallPath}</p>
              ) : null}
            </div>
            <div className="rules-editor-actions">
              <button className="ghost small" onClick={() => loadFirewallConfig(apiBase)}>
                Reload config
              </button>
            </div>
          </div>

          {firewallRules.length === 0 ? (
            <EmptyState small message="No firewall rules configured." />
          ) : filteredFirewallEntries.length === 0 ? (
            <EmptyState small message="No matching firewall rules." />
          ) : (
            <div className="rules-list rules-list-sortable">
              {filteredFirewallEntries.map(({ rule, index }) => {
                const title = buildFirewallTitle(rule, index);
                const summary = buildFirewallSummary(rule);
                const action = resolveFirewallAction(rule?.action);
                const limitSummary = buildFirewallLimitSummary(rule);
                const dropPosition = getDropPositionForIndex(index);
                const orderChange = firewallOrderChanges.get(index);
                const dragClassName = [
                  'rule-item',
                  'rule-item-sortable',
                  'firewall-rule',
                  `firewall-rule-${action.tone}`,
                  draggedFirewallRuleIndex === index ? 'rule-item-dragging' : '',
                  dropPosition === 'before' ? 'rule-item-drop-before' : '',
                  dropPosition === 'after' ? 'rule-item-drop-after' : ''
                ].filter(Boolean).join(' ');

                return (
                  <div
                    className={dragClassName}
                    key={`firewall-rule:${index}:${title}`}
                    onDragOver={(event) => handleFirewallDragOver(event, index)}
                    onDragLeave={() => handleFirewallDragLeave(index)}
                    onDrop={(event) => handleFirewallDrop(event, index)}
                  >
                    <div className="rule-summary">
                      <div className="rule-main">
                        <div className="rule-title firewall-rule-title">
                          <span
                            className={`rule-index rule-drag-handle${orderChange ? ' rule-index-warning' : ''}`}
                            draggable
                            title="Drag to reorder"
                            aria-label={`Drag firewall rule ${index + 1}`}
                            onDragStart={(event) => handleFirewallDragStart(event, index)}
                            onDragEnd={clearFirewallDragState}
                          >
                            {index + 1}
                          </span>
                          {orderChange ? (
                            <span className="rule-index-change" title="Unsaved order change">
                              {orderChange}
                            </span>
                          ) : null}
                          <h4 className="mono">{highlightFirewallCell(title)}</h4>
                          <span className={`meta-pill firewall-action-pill ${action.tone}`}>
                            {highlightFirewallCell(action.label)}
                          </span>
                        </div>
                        {summary.map((line) => (
                          <p className="rule-meta" key={`${index}:${line}`}>
                            {highlightFirewallCell(line)}
                          </p>
                        ))}
                        {limitSummary ? (
                          <p className="rule-meta">{highlightFirewallCell(limitSummary)}</p>
                        ) : null}
                      </div>
                      <div className="rule-actions">
                        <button
                          className="ghost small danger-text"
                          onClick={() => openDeleteConfirm('firewallRule', index)}
                        >
                          Delete
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => openRulesModal('firewallRule', 'edit', index, index, rule)}
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

        <div className="group-card firewall-settings-card">
          <div className="group-header">
            <div>
              <h3>Firewall config</h3>
              <p className="group-meta">Top-level firewall section that follows routed connection facts.</p>
              {configFirewallPath ? (
                <p className="group-meta mono">Config: {configFirewallPath}</p>
              ) : null}
            </div>
            <div className="rules-editor-actions">
              <button className="ghost small" onClick={() => loadFirewallConfig(apiBase)}>
                Reload config
              </button>
              <button
                className="primary small"
                onClick={() => saveFirewallConfig()}
                disabled={firewallConfigSaving}
              >
                {firewallConfigSaving ? 'Saving...' : 'Save firewall'}
              </button>
            </div>
          </div>

          <div className="settings-inline">
            <div className="control-block">
              <label>rule count</label>
              <p className="group-meta mono">{firewallRules.length}</p>
              <span className="hint">Rules are evaluated in order and follow the routed result instead of a separate firewall DNS strategy.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
