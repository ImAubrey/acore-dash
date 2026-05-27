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
  configBalancers,
  filteredBalancerEntries,
  getBalancerStrategyTone,
  resolveOutboundSelectors,
  rulesData,
  reorderRoutingRules
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

  if (page !== 'rules') {
    return null;
  }

  return (
    <section className="panel rules" style={{ '--delay': '0.18s' }}>
      <PanelHeader
        title="Rule Browser"
        description="Edit routing rules and inspect balancers reported by the router module."
        actions={(
          <>
          <div className="header-status">
            <StatusText
              text={rulesStatus}
              danger={isFailedStatusText(rulesStatus)}
            />
            <StatusText
              text={configRulesStatus}
              danger={isRoutingDraftNotice || isFailedStatusText(configRulesStatus)}
            />
          </div>
          <HeaderSearchInput
            value={ruleSearchQuery}
            setValue={setRuleSearchQuery}
            placeholder="Search rules and balancers..."
            ariaLabel="Search rules and balancers"
          />
          <HotReloadButton
            busy={hotReloadBusy}
            onClick={triggerHotReloadFromRules}
          />
          <button className="ghost small" onClick={() => openRulesModal('rule', 'insert')}>
            Add rule
          </button>
          <button className="ghost small" onClick={() => openRulesModal('balancer', 'insert')}>
            Add balancer
          </button>
          </>
        )}
      />

      <div className="rules-grid">
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
                          className="ghost small danger-text"
                          onClick={() => openDeleteConfirm('rule', index)}
                        >
                          Delete
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => openRulesModal('rule', 'edit', index, index, rule)}
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

        <div className="group-card">
          <div className="group-header">
            <div>
              <h3>Balancers</h3>
              <p className="group-meta">
                Total {configBalancers.length}
                {normalizedRuleSearchQuery ? ` · Match ${filteredBalancerEntries.length}` : ''}
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
          {configBalancers.length === 0 ? (
            <EmptyState small message="No balancers configured." />
          ) : filteredBalancerEntries.length === 0 ? (
            <EmptyState small message="No matching balancers." />
          ) : (
            <div className="rules-list">
              {filteredBalancerEntries.map(({ balancer, index }) => {
                const tag = String(balancer.tag || '').trim();
                const key = `balancer:${tag || index}`;
                const selectors = Array.isArray(balancer.selector)
                  ? balancer.selector
                  : Array.isArray(balancer.selectors)
                    ? balancer.selectors
                    : [];
                const strategyTone = getBalancerStrategyTone(balancer, selectors);
                const resolved = resolveOutboundSelectors(selectors);
                const strategyText = balancer.strategy ? `Strategy: ${balancer.strategy}` : 'Strategy: -';
                const fallbackText = balancer.fallbackTag ? ` · Fallback: ${balancer.fallbackTag}` : '';
                return (
                  <div className={`rule-item balancer-item balancer-${strategyTone}`} key={key}>
                    <div className="rule-summary">
                      <div>
                        <div className="rule-title">
                          <span className="rule-index">{index + 1}</span>
                          <h4 className="mono">{highlightRuleCell(tag || '(no tag)')}</h4>
                        </div>
                        <p className="rule-meta">{highlightRuleCell(`${strategyText}${fallbackText}`)}</p>
                        {selectors.length > 0 ? (
                          <>
                            <p className="rule-meta">
                              {highlightRuleCell(`Selector prefixes: ${selectors.join(', ')}`)}
                            </p>
                            <p className="rule-meta">
                              {resolved.length > 0 ? (
                                <>
                                  {highlightRuleCell(`Candidates (${resolved.length}):`)}
                                  <span className="candidate-tags">
                                    {resolved.map((candidate) => (
                                      <span className="candidate-tag" key={`${key}-${candidate}`}>
                                        {highlightRuleCell(candidate)}
                                      </span>
                                    ))}
                                  </span>
                                </>
                              ) : (
                                highlightRuleCell('Candidates: (none)')
                              )}
                            </p>
                          </>
                        ) : null}
                      </div>
                      <div className="rule-actions">
                        <button
                          className="ghost small danger-text"
                          onClick={() => openDeleteConfirm('balancer', index)}
                        >
                          Delete
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => openRulesModal('balancer', 'edit', index, index, balancer)}
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
      </div>
      {rulesData.updatedAt ? (
        <div className="rules-footer">Updated {rulesData.updatedAt}</div>
      ) : null}
    </section>
  );
}
