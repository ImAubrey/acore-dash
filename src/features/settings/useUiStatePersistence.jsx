import {
  UI_STATE_SAVE_DELAY_MS,
  clearTimeoutRef,
  fetchJson,
  normalizeUiState
} from '../../dashboardShared';

export function useUiStatePersistence({
  apiBase,
  uiStateSaveRef,
  uiStateHydratingRef,
  lockedSelectionsRef,
  setUiStateLoaded,
  setUiStatePath,
  setGroupSelections,
  setLogsDisabled,
  setLogsPaused,
  setAutoScroll,
  setLogLevel,
  setConnViewMode,
  setConnStreamPaused,
  setConnSortKey,
  setConnSortDir,
  setDetailColumnsVisible
}) {
  const saveUiState = async (payload, base = apiBase) => {
    try {
      await fetchJson(`${base}/ui/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (_err) {
      // ignore ui state persistence failures
    }
  };

  const scheduleUiStateSave = (payload, base = apiBase) => {
    if (typeof window === 'undefined') return;
    clearTimeoutRef(uiStateSaveRef);
    uiStateSaveRef.current = window.setTimeout(() => {
      uiStateSaveRef.current = null;
      saveUiState(payload, base);
    }, UI_STATE_SAVE_DELAY_MS);
  };

  const loadUiState = async (base = apiBase) => {
    uiStateHydratingRef.current = true;
    setUiStateLoaded(false);
    setUiStatePath('');
    try {
      const resp = await fetchJson(`${base}/ui/state`);
      const normalized = normalizeUiState(resp);
      if (resp?.path) {
        setUiStatePath(resp.path);
      }
      setGroupSelections(
        normalized.nodesLocked && Object.keys(normalized.nodesLocked).length > 0
          ? normalized.nodesLocked
          : {}
      );
      lockedSelectionsRef.current = normalized.nodesLocked || null;
      if (typeof normalized.logsDisabled === 'boolean') {
        setLogsDisabled(normalized.logsDisabled);
      }
      if (typeof normalized.logsPaused === 'boolean') {
        setLogsPaused(normalized.logsPaused);
      }
      if (typeof normalized.autoScroll === 'boolean') {
        setAutoScroll(normalized.autoScroll);
      }
      if (normalized.logLevel) {
        setLogLevel(normalized.logLevel);
      }
      if (normalized.connViewMode) {
        setConnViewMode(normalized.connViewMode);
      }
      if (typeof normalized.connStreamPaused === 'boolean') {
        setConnStreamPaused(normalized.connStreamPaused);
      }
      if (normalized.connSortKey) {
        setConnSortKey(normalized.connSortKey);
      }
      if (normalized.connSortDir) {
        setConnSortDir(normalized.connSortDir);
      }
      if (normalized.detailColumns) {
        setDetailColumnsVisible(new Set(normalized.detailColumns));
      }
    } catch (_err) {
      // ignore ui state load failures
    } finally {
      uiStateHydratingRef.current = false;
      setUiStateLoaded(true);
    }
  };

  return {
    loadUiState,
    scheduleUiStateSave
  };
}
