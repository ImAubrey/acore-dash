export const createNodeGroupHelpers = ({ statusByTag, groupSelections, outbounds }) => {
  const normalizeGroupStrategy = (value) => String(value || '').trim().toLowerCase();
  const getGroupStrategy = (group) => normalizeGroupStrategy(group?.strategy);
  const getFallbackTag = (group) => String(group?.fallbackTag || '').trim();

  const pickSelectorStrategyTarget = (tags) => {
    if (!Array.isArray(tags) || tags.length === 0) return '';
    const hasStatuses = statusByTag && Object.keys(statusByTag).length > 0;
    const normalized = tags
      .map((tag) => String(tag || '').trim())
      .filter((tag) => !!tag);
    if (normalized.length === 0) return '';

    if (!hasStatuses) {
      return normalized[0];
    }
    for (const tag of normalized) {
      const nodeStatus = statusByTag[tag];
      if (!nodeStatus) {
        return tag;
      }
      if (nodeStatus.alive) {
        return tag;
      }
    }
    return normalized[normalized.length - 1];
  };

  const isManualGroup = (group) => {
    if (typeof group?.manualSelectable === 'boolean') {
      return group.manualSelectable;
    }
    const strategy = getGroupStrategy(group);
    return strategy === 'selector' || strategy === 'leastping';
  };

  const getGroupModeLabel = (group) => {
    const strategy = getGroupStrategy(group);
    const hasFallback = !!getFallbackTag(group);
    if (!strategy || strategy === 'unknown') return hasFallback ? 'auto+fallback' : 'auto';
    if (strategy === 'selector') return hasFallback ? 'manual+fallback' : 'manual';
    if (strategy === 'leastping') return hasFallback ? 'auto+manual(leastping)+fallback' : 'auto+manual(leastping)';
    if (strategy === 'fallback') return 'auto(fallback)';
    const base = `auto(${strategy})`;
    return hasFallback ? `${base}+fallback` : base;
  };

  const getGroupSelectedTags = (group, selected) => {
    if (group?.overrideTarget) {
      const overrideTag = String(group.overrideTarget || '').trim();
      return overrideTag ? [overrideTag] : [];
    }
    const pendingTag = groupSelections[group?.tag];
    if (pendingTag) {
      return [pendingTag];
    }
    const strategy = getGroupStrategy(group);
    const currentTarget = String(group?.currentTarget || '').trim();
    if (currentTarget && (strategy === 'fallback' || !!getFallbackTag(group))) {
      return [currentTarget];
    }
    if (strategy === 'fallback') {
      const raw = Array.isArray(group?.principleTargets) ? group.principleTargets : [];
      const picked = pickSelectorStrategyTarget(raw);
      return picked ? [picked] : [];
    }
    const fallbackTag = getFallbackTag(group);
    const excludeFallback = !isManualGroup(group) && !!fallbackTag;
    const raw = isManualGroup(group)
      ? (selected ? [selected] : [])
      : (Array.isArray(group?.principleTargets) ? group.principleTargets : []);
    const seen = new Set();
    return raw.filter((tag) => {
      const value = String(tag || '').trim();
      if (!value || seen.has(value)) return false;
      if (excludeFallback && value === fallbackTag) return false;
      seen.add(value);
      return true;
    });
  };

  const getGroupCandidates = (group) => {
    const strategy = getGroupStrategy(group);
    const preferOutbounds = strategy === 'leastping';
    let list = !preferOutbounds && group && group.principleTargets && group.principleTargets.length > 0
      ? group.principleTargets
      : (outbounds || []).map((ob) => ob.tag);
    const fallbackTag = getFallbackTag(group);
    if (fallbackTag && !list.includes(fallbackTag)) {
      list = [...list, fallbackTag];
    }
    const seen = new Set();
    return list.filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  };

  return {
    getGroupStrategy,
    getFallbackTag,
    pickSelectorStrategyTarget,
    isManualGroup,
    getGroupModeLabel,
    getGroupSelectedTags,
    getGroupCandidates
  };
};
