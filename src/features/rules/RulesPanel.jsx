import { useMemo } from 'react';
import {
  EmptyState,
  HeaderSearchInput,
  HotReloadButton,
  PanelHeader,
  StatusText
} from '../common/panelPrimitives';
import { getRuleOrderChanges, useSortableRuleList } from '../common/useSortableRuleList';
import { normalizeRuleDestination } from '../../dashboardShared';
import { EditIcon, TrashIcon } from '../connections/actionIcons';
import { FirewallRulesCard } from '../firewall/FirewallPanel';

export function RulesPanel({
  page,
  rulesStatus,
  isFailedStatusText,
  configRulesStatus,
  isRoutingDraftNotice,
  ruleSearchQuery,
  setRuleSearchQuery,
  triggerHotReloadFromRules,
  hotReloadBusy,
  openRulesModal,
  configRules,
  configRulesBaseline,
  normalizedRuleSearchQuery,
  filteredRuleEntries,
  configRulesPath,
  loadRulesConfig,
  apiBase,
  hasRuleReLookup,
  highlightRuleCell,
  openDeleteConfirm,
  rulesData,
  reorderRoutingRules,
  combinedFirewall = false,
  firewallProps: incomingFirewallProps
}) {
  const {
    draggedIndex: draggedRuleIndex,
    clearDragState: clearRuleDragState,
    handleDragStart: handleRuleDragStart,
    handleDragOver: handleRuleDragOver,
    handleDragLeave: handleRuleDragLeave,
    handleDrop: handleRuleDrop,
    getDropPositionForIndex
  } = useSortableRuleList({ onReorder: reorderRoutingRules });
  const ruleOrderChanges = useMemo(
    () => getRuleOrderChanges(configRules, configRulesBaseline, isRoutingDraftNotice),
    [configRules, configRulesBaseline, isRoutingDraftNotice]
  );
  const showRules = page === 'rules';
  const showFirewall = page === 'firewall' || (page === 'rules' && combinedFirewall);
  const sharedPage = showRules && showFirewall;
  const firewallProps = incomingFirewallProps || {};
  const panelClassName = [
    'panel',
    'rules',
    showFirewall && !showRules ? 'firewall' : '',
    sharedPage ? 'rules-firewall-shared' : ''
  ].filter(Boolean).join(' ');
  const panelTitle = sharedPage
    ? 'Rules & Firewall'
    : showFirewall
      ? 'Firewall'
      : 'Rule Browser';
  const panelDescription = sharedPage
    ? 'Edit routing rules and firewall rules side by side.'
    : showFirewall
      ? 'Edit top-level firewall rules with flat routing-style match fields.'
      : 'Edit routing rules reported by the router module.';
  const rulesStatusItems = [
    { text: rulesStatus, danger: typeof isFailedStatusText === 'function' && isFailedStatusText(rulesStatus) },
    {
      text: configRulesStatus,
      danger: isRoutingDraftNotice || (typeof isFailedStatusText === 'function' && isFailedStatusText(configRulesStatus))
    }
  ].filter((item) => item.text);
  const firewallStatusItems = [
    {
      text: firewallProps.configFirewallStatus,
      danger: typeof isFailedStatusText === 'function' && isFailedStatusText(firewallProps.configFirewallStatus)
    }
  ].filter((item) => item.text);
  const headerStatusItems = showFirewall && !showRules ? firewallStatusItems : rulesStatusItems;
  const headerActions = showFirewall && !showRules
    ? (
      <>
      <HeaderSearchInput
        value={firewallProps.firewallSearchQuery}
        setValue={firewallProps.setFirewallSearchQuery}
        placeholder="Search firewall rules..."
        ariaLabel="Search firewall rules"
      />
      <HotReloadButton
        busy={firewallProps.hotReloadBusy}
        onClick={firewallProps.triggerHotReloadFromFirewall}
        draftVisible={firewallProps.hasFirewallDraft}
        draftBusy={firewallProps.discardFirewallDraftBusy}
        onUndoDraft={firewallProps.discardFirewallDraft}
        undoDraftTitle="Discard unsaved firewall draft edits"
      />
      <button className="primary small" onClick={() => openRulesModal('firewallRule', 'insert')}>
        Add firewall rule
      </button>
      </>
    )
    : (
      <>
      <HeaderSearchInput
        value={ruleSearchQuery}
        setValue={setRuleSearchQuery}
        placeholder="Search routing rules..."
        ariaLabel="Search routing rules"
      />
      <HotReloadButton
        busy={hotReloadBusy}
        onClick={triggerHotReloadFromRules}
      />
      <button className="primary small" onClick={() => openRulesModal('rule', 'insert')}>
        Add rule
      </button>
      </>
    );

  if (!showRules && !showFirewall) {
    return null;
  }

  return (
    <section className={panelClassName} style={{ '--delay': '0.18s' }}>
      <div className="rules-sticky-head">
        <PanelHeader
          title={panelTitle}
          actions={headerActions}
        />
        <div className={`connections-header-note rules-header-note${headerStatusItems.length ? ' rules-status-note' : ''}`}>
          {headerStatusItems.length ? (
            headerStatusItems.map((item, index) => (
              <StatusText
                key={`${item.text}-${index}`}
                text={item.text}
                danger={item.danger}
                className="rules-status-note-item"
              />
            ))
          ) : panelDescription}
        </div>
      </div>

      <div className={`rules-grid${sharedPage ? ' rules-firewall-grid' : ''}`}>
        {showRules ? (
        <div className="group-card">
          <div className="group-header">
            <div>
              <h3>Routing rules</h3>
              <p className="group-meta">
                Total {configRules.length}
                {normalizedRuleSearchQuery ? ` · Match ${filteredRuleEntries.length}` : ''}
              </p>
              {configRulesPath ? (
                <p className="group-meta mono">Config: {configRulesPath}</p>
              ) : null}
            </div>
            <div className="rules-editor-actions">
              <button className="ghost small" onClick={() => loadRulesConfig(apiBase)}>
                Reload config
              </button>
            </div>
          </div>
          {configRules.length === 0 ? (
            <EmptyState small message="No routing rules configured." />
          ) : filteredRuleEntries.length === 0 ? (
            <EmptyState small message="No matching routing rules." />
          ) : (
            <div className="rules-list rules-list-sortable">
              {filteredRuleEntries.map(({ rule, index }) => {
                const ruleTag = String(rule.ruleTag || '').trim();
                const key = `rule:${index}:${ruleTag}`;
                const destination = normalizeRuleDestination(rule.destination);
                const outboundTag = String(rule.outboundTag || '').trim();
                const balancerTag = String(rule.balancerTag || '').trim();
                const targetTag = String(rule.targetTag || '').trim();
                const hasReLookup = hasRuleReLookup(rule);

                let effectiveDestination = '';
                let effectiveField = '';
                const ignoredFields = [];
                if (destination.label) {
                  effectiveDestination = destination.label;
                  effectiveField = 'destination';
                  if (outboundTag) ignoredFields.push('outboundTag');
                  if (balancerTag) ignoredFields.push('balancerTag');
                } else if (outboundTag) {
                  effectiveDestination = outboundTag;
                  effectiveField = 'outboundTag';
                  if (balancerTag) ignoredFields.push('balancerTag');
                } else if (balancerTag) {
                  effectiveDestination = balancerTag;
                  effectiveField = 'balancerTag';
                } else if (targetTag) {
                  effectiveDestination = targetTag;
                  effectiveField = 'targetTag';
                }
                const effectiveNote =
                  ignoredFields.length > 0 && effectiveField
                    ? `${effectiveField} wins; ignored: ${ignoredFields.join(', ')}`
                    : '';
                const destinationLabel = effectiveDestination
                  ? `Destination: ${effectiveDestination}`
                  : 'Destination: -';
                const dropPosition = getDropPositionForIndex(index);
                const orderChange = ruleOrderChanges.get(index);
                const dragClassName = [
                  'rule-item',
                  'rule-item-sortable',
                  draggedRuleIndex === index ? 'rule-item-dragging' : '',
                  dropPosition === 'before' ? 'rule-item-drop-before' : '',
                  dropPosition === 'after' ? 'rule-item-drop-after' : ''
                ].filter(Boolean).join(' ');
                return (
                  <div
                    className={dragClassName}
                    key={key}
                    onDragOver={(event) => handleRuleDragOver(event, index)}
                    onDragLeave={() => handleRuleDragLeave(index)}
                    onDrop={(event) => handleRuleDrop(event, index)}
                  >
                    <div className="rule-summary">
                      <div className="rule-main">
                        <div className="rule-title rule-title-routing">
                          <span
                            className={`rule-index rule-drag-handle${orderChange ? ' rule-index-warning' : ''}`}
                            draggable
                            title="Drag to reorder"
                            aria-label={`Drag routing rule ${index + 1}`}
                            onDragStart={(event) => handleRuleDragStart(event, index)}
                            onDragEnd={clearRuleDragState}
                          >
                            {index + 1}
                          </span>
                          {orderChange ? (
                            <span className="rule-index-change" title="Unsaved order change">
                              {orderChange}
                            </span>
                          ) : null}
                          <h4 className="mono">{highlightRuleCell(ruleTag || '(no ruleTag)')}</h4>
                          <span className="rule-destination-inline mono" title={destinationLabel}>
                            {highlightRuleCell(destinationLabel)}
                          </span>
                        </div>
                        {effectiveNote ? (
                          <p className="rule-meta">{highlightRuleCell(`Note: ${effectiveNote}`)}</p>
                        ) : null}
                        {hasReLookup ? (
                          <p className="rule-meta">
                            {highlightRuleCell('Flags:')}
                            <span className="candidate-tags">
                              <span className="candidate-tag">{highlightRuleCell('reLookup=true')}</span>
                            </span>
                          </p>
                        ) : null}
                      </div>
                      <div className="rule-actions">
                        <button
                          className="action-icon-button action-icon-danger"
                          onClick={() => openDeleteConfirm('rule', index)}
                          title="Delete"
                          aria-label={`Delete routing rule ${index + 1}`}
                        >
                          <TrashIcon />
                        </button>
                        <button
                          className="action-icon-button action-icon-edit"
                          onClick={() => openRulesModal('rule', 'edit', index, index, rule)}
                          title="Edit"
                          aria-label={`Edit routing rule ${index + 1}`}
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
        ) : null}

        {showFirewall ? (
          <FirewallRulesCard {...firewallProps} embedded={sharedPage} />
        ) : null}
      </div>
      {showRules && rulesData.updatedAt ? (
        <div className="rules-footer">Updated {rulesData.updatedAt}</div>
      ) : null}
    </section>
  );
}
