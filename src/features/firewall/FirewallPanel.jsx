import { useMemo } from 'react';
import {
  EmptyState,
  HeaderSearchInput,
  HotReloadButton,
  StatusText
} from '../common/panelPrimitives';
import { getRuleOrderChanges, useSortableRuleList } from '../common/useSortableRuleList';
import {
  getFirewallLimitDetail,
  getFirewallRuleAction,
  getFirewallRuleList,
  getFirewallRuleTitle
} from '../../dashboardShared';
import { EditIcon, TrashIcon } from '../connections/actionIcons';

export function FirewallRulesCard({
  embedded = false,
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
  filteredFirewallEntries = [],
  normalizedFirewallSearchQuery,
  configFirewallPath,
  loadFirewallConfig,
  apiBase,
  openDeleteConfirm,
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
  const highlight = typeof highlightFirewallCell === 'function'
    ? highlightFirewallCell
    : (value) => value;

  return (
    <div className={`group-card firewall-rules-card${embedded ? ' firewall-rules-card-embedded' : ''}`}>
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
        <div className="rules-editor-actions firewall-card-actions">
          {embedded ? (
            <>
              <HeaderSearchInput
                value={firewallSearchQuery}
                setValue={setFirewallSearchQuery}
                placeholder="Search firewall..."
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
              <button className="ghost small" onClick={() => loadFirewallConfig(apiBase)}>
                Reload
              </button>
              <button className="primary small" onClick={() => openRulesModal('firewallRule', 'insert')}>
                Add firewall
              </button>
            </>
          ) : (
            <button className="ghost small" onClick={() => loadFirewallConfig(apiBase)}>
              Reload config
            </button>
          )}
        </div>
      </div>
      {embedded && configFirewallStatus ? (
        <div className="connections-header-note rules-status-note firewall-card-status-note">
          <StatusText
            text={configFirewallStatus}
            danger={typeof isFailedStatusText === 'function' && isFailedStatusText(configFirewallStatus)}
            className="rules-status-note-item"
          />
        </div>
      ) : null}

      {firewallRules.length === 0 ? (
        <EmptyState small message="No firewall rules configured." />
      ) : filteredFirewallEntries.length === 0 ? (
        <EmptyState small message="No matching firewall rules." />
      ) : (
        <div className="rules-list rules-list-sortable">
          {filteredFirewallEntries.map(({ rule, index }) => {
            const title = getFirewallRuleTitle(rule, index);
            const action = getFirewallRuleAction(rule);
            const limitDetail = action.tone === 'limit' ? getFirewallLimitDetail(rule) : '';
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
                    <div className="rule-title rule-title-routing firewall-rule-title">
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
                      <h4 className="mono" title={title}>{highlight(title)}</h4>
                      <span className={`meta-pill firewall-action-pill ${action.tone}`}>
                        {highlight(action.label)}
                      </span>
                      {limitDetail ? (
                        <span className="meta-pill firewall-limit-detail-pill" title={`limit ${limitDetail}`}>
                          {highlight(limitDetail)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="rule-actions">
                    <button
                      className="action-icon-button action-icon-danger"
                      onClick={() => openDeleteConfirm('firewallRule', index)}
                      title="Delete"
                      aria-label={`Delete firewall rule ${index + 1}`}
                    >
                      <TrashIcon />
                    </button>
                    <button
                      className="action-icon-button action-icon-edit"
                      onClick={() => openRulesModal('firewallRule', 'edit', index, index, rule)}
                      title="Edit"
                      aria-label={`Edit firewall rule ${index + 1}`}
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
  );
}
