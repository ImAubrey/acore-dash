import {
  DETAIL_COLUMNS,
  UI_STATE_SAVE_DELAY_MS,
  clearTimeoutRef,
  fetchJson,
  normalizeUiState
} from '../../dashboardShared';

const DEFAULT_DETAIL_COLUMNS = DETAIL_COLUMNS.map((column) => column.key);

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
  const applyUiState = (normalized) => {
    const state = normalized || {};
    const nodesLocked = state.nodesLocked && Object.keys(state.nodesLocked).length > 0
      ? state.nodesLocked
      : {};
    setGroupSelections(nodesLocked);
    lockedSelectionsRef.current = Object.keys(nodesLocked).length > 0 ? nodesLocked : null;
    setLogsDisabled(typeof state.logsDisabled === 'boolean' ? state.logsDisabled : true);
    setLogsPaused(typeof state.logsPaused === 'boolean' ? state.logsPaused : false);
    setAutoScroll(typeof state.autoScroll === 'boolean' ? state.autoScroll : true);
    setLogLevel(state.logLevel || 'default');
    setConnViewMode(state.connViewMode || 'current');
    setConnStreamPaused(typeof state.connStreamPaused === 'boolean' ? state.connStreamPaused : false);
    setConnSortKey(state.connSortKey || 'default');
    setConnSortDir(state.connSortDir || 'desc');
    setDetailColumnsVisible(new Set(state.detailColumns || DEFAULT_DETAIL_COLUMNS));
  };

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
      applyUiState(normalized);
    } catch (_err) {
      applyUiState(null);
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
