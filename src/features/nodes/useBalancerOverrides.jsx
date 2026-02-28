import { useEffect } from 'react';
import { fetchJson } from '../../dashboardShared';

export function useBalancerOverrides({
  apiBase,
  uiStateLoaded,
  groups,
  isManualGroup,
  getGroupCandidates,
  lockedSelectionsRef,
  setGroupSelections,
  setStatus,
  fetchNodes
}) {
  const applyOverride = async (balancer, target, options = {}) => {
    const { allowEmpty = false } = options;
    const balancerTag = String(balancer || '').trim();
    const targetTag = String(target || '').trim();
    if (!balancerTag || (!allowEmpty && !targetTag)) {
      setStatus('Balancer tag and target are required.');
      return;
    }
    const targetLabel = targetTag ? targetTag : 'auto';
    setStatus(`Applying override ${balancerTag} -> ${targetLabel}...`);
    try {
      await fetchJson(`${apiBase}/balancer/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balancerTag, target: targetTag })
      });
      setStatus(targetTag ? 'Override applied' : 'Override cleared');
      fetchNodes(apiBase).catch(() => {});
    } catch (err) {
      setStatus(`Override failed: ${err.message}`);
    }
  };

  const clearGroupOverride = (group) => {
    if (!group || !group.tag) return;
    setGroupSelections((prev) => {
      const next = { ...prev };
      delete next[group.tag];
      return next;
    });
    applyOverride(group.tag, '', { allowEmpty: true });
  };

  const selectGroupTarget = (group, target) => {
    if (!group || group.error) return;
    const groupTag = String(group.tag || '').trim();
    const targetTag = String(target || '').trim();
    if (!groupTag || !targetTag) return;
    setGroupSelections((prev) => ({ ...prev, [groupTag]: targetTag }));
    if (group.overrideTarget === targetTag) return;
    applyOverride(groupTag, targetTag);
  };

  useEffect(() => {
    if (!uiStateLoaded) return;
    const locked = lockedSelectionsRef.current;
    if (!locked || !groups || groups.length === 0) return;
    const pending = [];
    groups.forEach((group) => {
      const groupTag = String(group?.tag || '').trim();
      if (!groupTag) return;
      const lockedTarget = String(locked[groupTag] || '').trim();
      if (!lockedTarget) return;
      if (!isManualGroup(group)) return;
      const candidates = getGroupCandidates(group);
      if (candidates.length > 0 && !candidates.includes(lockedTarget)) return;
      if (group.overrideTarget === lockedTarget) return;
      pending.push({ tag: groupTag, target: lockedTarget });
    });
    lockedSelectionsRef.current = null;
    if (pending.length === 0) return;
    pending.forEach((item) => {
      applyOverride(item.tag, item.target);
    });
  }, [groups, uiStateLoaded]);

  return {
    clearGroupOverride,
    selectGroupTarget
  };
}
