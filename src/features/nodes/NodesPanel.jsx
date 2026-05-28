import React from 'react';
import { createPortal } from 'react-dom';
import {
  EmptyState,
  HotReloadButton,
  PanelHeader,
  StatusText
} from '../common/panelPrimitives';
import {
  ChildrenIcon,
  ConnectionsIcon,
  DownloadIcon,
  EditIcon,
  InfoIcon,
  TrashIcon,
  UploadIcon
} from '../connections/actionIcons';
import { CONNECTION_ACTIVITY_SCALE, getRateActivity } from '../../dashboardShared';

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
    outboundStatsByTag,
    formatRate,
    openInfoModal,
    openDeleteConfirm,
    pickSelectorStrategyTarget,
    getGroupModeLabel,
    configBalancers = []
  } = props;
  const [outboundGroupModalItem, setOutboundGroupModalItem] = React.useState(null);
  const mergedPolicyGroups = React.useMemo(() => {
    const runtimeGroups = Array.isArray(groups) ? groups : [];
    const balancerEntries = Array.isArray(configBalancers)
      ? configBalancers
        .map((balancer, index) => {
          const tag = String(balancer?.tag || '').trim();
          return tag ? { tag, balancer, index } : null;
        })
        .filter(Boolean)
      : [];
    const balancerByTag = new Map(balancerEntries.map((entry) => [entry.tag, entry]));
    const seenTags = new Set();
    const mergedGroups = runtimeGroups.map((group) => {
      const tag = String(group?.tag || '').trim();
      const configEntry = tag ? balancerByTag.get(tag) : null;
      if (tag) seenTags.add(tag);
      return {
        ...group,
        configBalancer: configEntry?.balancer || null,
        configIndex: Number.isInteger(configEntry?.index) ? configEntry.index : -1,
        configOnly: false
      };
    });
    const configOnlyGroups = balancerEntries
      .filter((entry) => !seenTags.has(entry.tag))
      .map(({ tag, balancer, index }) => {
        const selectors = Array.isArray(balancer.selector)
          ? balancer.selector
          : Array.isArray(balancer.selectors)
            ? balancer.selectors
            : [];
        return {
          tag,
          strategy: balancer.strategy || '',
          fallbackTag: balancer.fallbackTag || '',
          principleTargets: selectors,
          currentTarget: '',
          overrideTarget: '',
          configBalancer: balancer,
          configIndex: index,
          configOnly: true
        };
      });
    return [...mergedGroups, ...configOnlyGroups];
  }, [groups, configBalancers]);

  if (page !== 'nodes') return null;

  const openOutboundGroupModal = (item) => {
    if (!item || !Array.isArray(item.children) || item.children.length === 0) return;
    setOutboundGroupModalItem(item);
  };

  const closeOutboundGroupModal = () => setOutboundGroupModalItem(null);

  const renderOutboundCard = (item, nested = false, nestedIndex = 0) => {
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
    const canEdit = item.configIndex >= 0 && !isGroupChild;
    const cardClassName = [
      'outbound-card',
      nested ? 'outbound-card-child' : '',
      hasChildren ? 'outbound-card-parent' : ''
    ].filter(Boolean).join(' ');
    const indexLabel = isGroupChild && nested ? nestedIndex + 1 : (isGroupChild ? '>' : (isRuntimeOnly ? 'R' : item.configIndex + 1));
    const trafficStats = tag && outboundStatsByTag ? outboundStatsByTag.get(tag) : null;
    const connectionCount = trafficStats?.connections || 0;
    const uploadRate = trafficStats?.uploadRate || 0;
    const downloadRate = trafficStats?.downloadRate || 0;
    const formatOutboundRate = typeof formatRate === 'function'
      ? formatRate
      : (value) => `${Math.max(0, Number(value) || 0)} B/s`;
    const uploadLabel = formatOutboundRate(uploadRate);
    const downloadLabel = formatOutboundRate(downloadRate);
    const trafficActivity = getRateActivity(
      { upload: uploadRate, download: downloadRate },
      CONNECTION_ACTIVITY_SCALE,
      connectionCount
    );
    const showChildMeta = isGroupChild && !nested;
    const hasSideMeta = showChildMeta || isRuntimeOnly || managed;

    return (
      <div className={cardClassName} key={item.key}>
        <div className="outbound-info">
          <div className="outbound-title">
            <span className="rule-index">{indexLabel}</span>
            {nodeStatus ? (
              <span className={`status-pill outbound-delay-pill ${alive ? 'up' : 'down'}`}>
                {alive ? delay : 'down'}
              </span>
            ) : (
              <span className="status-pill outbound-delay-pill idle">
                no status
              </span>
            )}
            <h3>{tag || '(no tag)'}</h3>
            {hasChildren ? (
              <button
                type="button"
                className="action-icon-button action-icon-info outbound-children-button"
                onClick={() => openOutboundGroupModal(item)}
                title={`Show ${children.length} children`}
                aria-label={`Show ${children.length} children for outbound ${tag || indexLabel}`}
              >
                <ChildrenIcon />
              </button>
            ) : null}
          </div>
          <p>{protocol}</p>
        </div>
        <div className="outbound-side">
          {hasSideMeta ? (
            <div className="outbound-meta">
              {showChildMeta ? <span className="meta-pill">child</span> : null}
              {isRuntimeOnly ? <span className="meta-pill">runtime</span> : null}
              {managed ? <span className="meta-pill managed-pill" title={`managed: ${managed}`}>managed</span> : null}
            </div>
          ) : null}
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
              onClick={() => openInfoModal(`Outbound: ${tag || '(no tag)'}`, { tag, runtime, status: nodeStatus, config: ob || null })}
              title="Info"
              aria-label={`Info for outbound ${tag || indexLabel}`}
            >
              <InfoIcon />
            </button>
            {canEdit ? (
              <>
                <button
                  className="action-icon-button action-icon-danger"
                  onClick={() => openDeleteConfirm('outbound', item.configIndex)}
                  title="Delete"
                  aria-label={`Delete outbound ${tag || indexLabel}`}
                >
                  <TrashIcon />
                </button>
                <button
                  className="action-icon-button action-icon-edit"
                  onClick={() => openRulesModal('outbound', 'edit', item.configIndex, item.configIndex, ob)}
                  title="Edit"
                  aria-label={`Edit outbound ${tag || indexLabel}`}
                >
                  <EditIcon />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderPolicyGroup = (group) => {
    const tag = String(group?.tag || '').trim();
    const candidates = getGroupCandidates(group);
    const groupStrategy = getGroupStrategy(group);
    const isFallbackStrategy = groupStrategy === 'fallback';
    const manualGroup = isManualGroup(group);
    const fallbackTag = getFallbackTag(group);
    const configBalancer = group.configBalancer;
    const configIndex = Number.isInteger(group.configIndex) ? group.configIndex : -1;
    const canEditBalancer = !!configBalancer && configIndex >= 0;
    const rawSelected = manualGroup
      ? (groupSelections[tag]
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
    const pendingSelection = groupSelections[tag];
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
      <div className="rule-item nodes-policy-item" key={tag || configIndex}>
        <div className="group-header">
          <div>
            <h3>{tag || '(no tag)'}</h3>
            <p className="group-meta">Mode: {modeLabel} | Current: {current}</p>
            {group.configOnly ? (
              <p className="group-meta">Configured balancer, not reported by runtime.</p>
            ) : null}
            {group.error ? (
              <p className="group-error">{group.error}</p>
            ) : null}
          </div>
          <div className="nodes-policy-actions">
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
            {canEditBalancer ? (
              <>
                <button
                  className="action-icon-button action-icon-danger"
                  onClick={() => openDeleteConfirm('balancer', configIndex)}
                  title="Delete"
                  aria-label={`Delete policy group ${tag || configIndex + 1}`}
                >
                  <TrashIcon />
                </button>
                <button
                  className="action-icon-button action-icon-edit"
                  onClick={() => openRulesModal('balancer', 'edit', configIndex, configIndex, configBalancer)}
                  title="Edit"
                  aria-label={`Edit policy group ${tag || configIndex + 1}`}
                >
                  <EditIcon />
                </button>
              </>
            ) : null}
          </div>
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
  };

  const renderOutboundGroupModal = () => {
    if (!outboundGroupModalItem || typeof document === 'undefined') return null;
    const parentTag = String(
      outboundGroupModalItem?.configOutbound?.tag
      || outboundGroupModalItem?.derivedOutbound?.tag
      || outboundGroupModalItem?.tag
      || ''
    ).trim();
    const children = Array.isArray(outboundGroupModalItem?.children)
      ? outboundGroupModalItem.children
      : [];
    return createPortal(
      <div className="modal-backdrop rules-modal-backdrop" role="dialog" aria-modal="true" data-state="open">
        <div className="modal rules-modal outbound-group-modal" data-state="open">
          <div className="modal-header">
            <div>
              <h3>{`${parentTag || 'Outbound'} children`}</h3>
              <p className="group-meta">{`${children.length} expanded outbounds`}</p>
            </div>
            <button className="ghost small" onClick={closeOutboundGroupModal}>Close</button>
          </div>
          <div className="outbound-group-list">
            {children.map((child, childIndex) => renderOutboundCard(child, true, childIndex))}
          </div>
        </div>
      </div>,
      document.body
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

      <div className="nodes-layout-grid">
        <div className="group-card nodes-policy-card">
          <div className="group-header">
            <div>
              <h3>Policy groups</h3>
              <p className="group-meta">Total {mergedPolicyGroups.length}</p>
            </div>
            <div className="rules-editor-actions">
              <button className="primary small" onClick={() => openRulesModal('balancer', 'insert')}>
                Add policy group
              </button>
            </div>
          </div>
          {mergedPolicyGroups.length === 0 ? (
            <EmptyState
              small
              message="Set BALANCER_TAGS in Settings to render Clash-style strategies."
            />
          ) : (
            <div className="nodes-grid">
              {mergedPolicyGroups.map((group) => renderPolicyGroup(group))}
            </div>
          )}
        </div>

        <div className="group-card nodes-outbounds-card">
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
      </div>
      {renderOutboundGroupModal()}
    </div>
  );
}
