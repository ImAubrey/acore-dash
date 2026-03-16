import React from 'react';
import {
  EmptyState,
  HotReloadButton,
  PanelHeader,
  StatusText
} from '../common/panelPrimitives';

export function NodesPanel(props) {
  const {
    page,
    groups,
    status,
    refresh,
    getGroupCandidates,
    getGroupStrategy,
    isManualGroup,
    getFallbackTag,
    groupSelections,
    getGroupSelectedTags,
    doesCandidateResolveToTarget,
    statusByTag,
    formatDelay,
    clearGroupOverride,
    selectGroupTarget,
    configOutboundsPath,
    configOutboundsStatus,
    isFailedStatusText,
    triggerDelayTest,
    delayTestCooldown,
    delayTestBusy,
    getDelayTestLabel,
    triggerHotReloadFromNodes,
    hotReloadBusy,
    openRulesModal,
    displayOutbounds,
    runtimeOutboundsByTag,
    openInfoModal,
    openDeleteConfirm,
    pickSelectorStrategyTarget,
    getGroupModeLabel
  } = props;
  const [expandedOutboundGroups, setExpandedOutboundGroups] = React.useState({});

  if (page !== 'nodes') return null;

  const toggleOutboundGroup = (tag) => {
    if (!tag) return;
    setExpandedOutboundGroups((current) => ({
      ...current,
      [tag]: !current[tag]
    }));
  };

  const renderOutboundCard = (item, nested = false) => {
    const ob = item.configOutbound || item.derivedOutbound;
    const tag = String(ob?.tag || item.tag || '').trim();
    const runtime = tag ? runtimeOutboundsByTag.get(tag) : null;
    const protocol = ob?.protocol || runtime?.type || 'unknown';
    const nodeStatus = tag ? statusByTag[tag] : null;
    const alive = nodeStatus ? nodeStatus.alive : null;
    const delay = nodeStatus ? formatDelay(nodeStatus.delay) : '';
    const managed = String(ob?.managed || '').trim();
    const isRuntimeOnly = item.configIndex < 0 && !item.configOutbound;
    const isGroupChild = !!item.groupChild;
    const children = Array.isArray(item.children) ? item.children : [];
    const hasChildren = children.length > 0;
    const isExpanded = hasChildren && !!expandedOutboundGroups[tag];
    const canEdit = item.configIndex >= 0 && !isGroupChild;
    const cardClassName = [
      'outbound-card',
      nested ? 'outbound-card-child' : '',
      hasChildren ? 'outbound-card-parent' : ''
    ].filter(Boolean).join(' ');
    const indexLabel = isGroupChild ? '>' : (isRuntimeOnly ? 'R' : item.configIndex + 1);

    return (
      <div className={cardClassName} key={item.key}>
        <div className="outbound-info">
          <div className="outbound-title">
            <span className="rule-index">{indexLabel}</span>
            <h3>{tag || '(no tag)'}</h3>
          </div>
          <p>{protocol}</p>
          {hasChildren ? (
            <p className="group-meta">
              {children.length} expanded outbounds hidden under this parent.
            </p>
          ) : null}
        </div>
        <div className="outbound-side">
          <div className="outbound-meta">
            {isGroupChild ? <span className="meta-pill">child</span> : null}
            {isRuntimeOnly ? <span className="meta-pill">runtime</span> : null}
            {hasChildren ? <span className="meta-pill">{children.length} children</span> : null}
            {managed ? <span className="meta-pill managed-pill" title={`managed: ${managed}`}>managed</span> : null}
            {nodeStatus ? (
              <span className={`status-pill ${alive ? 'up' : 'down'}`}>
                {alive ? delay : 'down'}
              </span>
            ) : (
              <span className="meta-pill">no status</span>
            )}
          </div>
          <div className="outbound-actions">
            {hasChildren ? (
              <button
                className="ghost small"
                onClick={() => toggleOutboundGroup(tag)}
              >
                {isExpanded ? 'Hide children' : `Show ${children.length} children`}
              </button>
            ) : null}
            <button
              className="ghost small"
              onClick={() => openInfoModal(`Outbound: ${tag || '(no tag)'}`, { tag, runtime, status: nodeStatus, config: ob || null })}
            >
              Info
            </button>
            {canEdit ? (
              <>
                <button
                  className="ghost small danger-text"
                  onClick={() => openDeleteConfirm('outbound', item.configIndex)}
                >
                  Delete
                </button>
                <button
                  className="ghost small"
                  onClick={() => openRulesModal('outbound', 'edit', item.configIndex, item.configIndex, ob)}
                >
                  Edit
                </button>
              </>
            ) : null}
          </div>
        </div>
        {hasChildren && isExpanded ? (
          <div className="outbound-children">
            {children.map((child) => renderOutboundCard(child, true))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="panel" style={{ '--delay': '0.12s' }}>
      <PanelHeader
        title="Nodes & Policies"
        description="Clash-style policy groups with live outbound health."
        actions={(
          <>
          <button className="ghost" onClick={() => refresh()}>Refresh</button>
          <StatusText text={status} />
          </>
        )}
      />

      {groups.length === 0 ? (
        <EmptyState
          title="No policy groups configured"
          message="Set BALANCER_TAGS in Settings to render Clash-style strategies."
        />
      ) : (
        <div className="nodes-grid">
          {groups.map((group) => {
            const candidates = getGroupCandidates(group);
            const groupStrategy = getGroupStrategy(group);
            const isFallbackStrategy = groupStrategy === 'fallback';
            const manualGroup = isManualGroup(group);
            const fallbackTag = getFallbackTag(group);
            const rawSelected = manualGroup
              ? (groupSelections[group.tag]
                || group.overrideTarget
                || (candidates.length > 0 ? candidates[0] : ''))
              : '';
            const selected = manualGroup
              ? (candidates.includes(rawSelected)
                ? rawSelected
                : (candidates.length > 0 ? candidates[0] : ''))
              : '';
            const selectedTags = getGroupSelectedTags(group, selected);
            const selectedSet = new Set(selectedTags);
            const pendingSelection = groupSelections[group.tag];
            const currentTarget = String(group?.currentTarget || '').trim();
            const current = group.overrideTarget
              || pendingSelection
              || currentTarget
              || (isFallbackStrategy
                ? pickSelectorStrategyTarget(Array.isArray(group?.principleTargets) ? group.principleTargets : [])
                : (group.principleTargets && group.principleTargets[0]))
              || 'auto';
            const modeLabel = group.overrideTarget ? 'override' : getGroupModeLabel(group);
            const canManualSelect = !group.error;
            const canClearOverride = !!group.overrideTarget && !group.error;
            return (
              <div className="group-card" key={group.tag}>
                <div className="group-header">
                  <div>
                    <h3>{group.tag}</h3>
                    <p className="group-meta">Mode: {modeLabel} | Current: {current}</p>
                    {group.error ? (
                      <p className="group-error">{group.error}</p>
                    ) : null}
                  </div>
                  {group.overrideTarget ? (
                    <button
                      className="ghost small"
                      onClick={() => clearGroupOverride(group)}
                      disabled={!canClearOverride}
                      title="Clear manual override"
                    >
                      Auto
                    </button>
                  ) : null}
                </div>
                {candidates.length === 0 ? (
                  <EmptyState small message="No candidates detected for this balancer." />
                ) : (
                  <div className="chip-grid">
                    {candidates.map((tag) => {
                      const nodeStatus = statusByTag[tag];
                      const alive = nodeStatus ? nodeStatus.alive : null;
                      const delay = nodeStatus ? formatDelay(nodeStatus.delay) : '';
                      const isFallbackTag = fallbackTag && tag === fallbackTag;
                      const isCurrentTarget = currentTarget && tag === currentTarget;
                      const matchesSelectedTarget = selectedSet.has(tag)
                        || selectedTags.some((selectedTag) => doesCandidateResolveToTarget(tag, selectedTag));
                      const representsCurrentTarget = currentTarget
                        && doesCandidateResolveToTarget(tag, currentTarget);
                      const isActive = matchesSelectedTarget
                        && (!isFallbackTag
                          || isFallbackStrategy
                          || isCurrentTarget
                          || representsCurrentTarget
                          || group.overrideTarget === tag
                          || pendingSelection === tag);
                      return (
                        <button
                          type="button"
                          key={`${group.tag}-${tag}`}
                          className={`chip ${isActive ? 'active' : ''}`}
                          onClick={() => selectGroupTarget(group, tag)}
                          disabled={!canManualSelect}
                        >
                          <span className="chip-label">{tag}</span>
                          {nodeStatus ? (
                            <span className={`status-pill ${alive ? 'up' : 'down'}`}>
                              {alive ? delay : 'down'}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="nodes-subheader">
        <div>
          <h3>All outbounds</h3>
          {configOutboundsPath ? (
            <p className="group-meta mono">Config: {configOutboundsPath}</p>
          ) : null}
        </div>
        <div className="header-actions">
          {configOutboundsStatus ? (
            <div className="header-status">
              <StatusText
                text={configOutboundsStatus}
                danger={isFailedStatusText(configOutboundsStatus)}
              />
            </div>
          ) : null}
          <button
            className="primary small"
            onClick={triggerDelayTest}
            disabled={delayTestCooldown > 0 || delayTestBusy}
          >
            {getDelayTestLabel('Latency test')}
          </button>
          <HotReloadButton
            busy={hotReloadBusy}
            onClick={triggerHotReloadFromNodes}
          />
          <button className="primary small" onClick={() => openRulesModal('outbound', 'insert')}>
            Add outbound
          </button>
        </div>
      </div>
      {displayOutbounds.length === 0 ? (
        <EmptyState small message="No outbounds configured." />
      ) : (
        <div className="outbound-grid">
          {displayOutbounds.map((item) => renderOutboundCard(item))}
        </div>
      )}
    </div>
  );
}
