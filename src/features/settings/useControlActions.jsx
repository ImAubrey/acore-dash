import {
  clearTimeoutRef,
  fetchJson,
  getRoutingDraft,
  scheduleModalClose,
  startCooldown
} from '../../dashboardShared';

export function useControlActions({
  apiBase,
  includeInboundsTarget = false,
  hotReloadBusy,
  setHotReloadBusy,
  setSettingsStatus,
  setConfigOutboundsStatus,
  setRulesStatus,
  setConfigSubscriptionStatus,
  setConfigInboundsStatus,
  uploadRoutingDraft,
  refresh,
  loadRestartInfo,
  fetchNodes,
  delayTestCooldown,
  delayTestBusy,
  setDelayTestCooldown,
  delayTestCooldownRef,
  delayTestTriggerRef,
  setDelayTestBusy,
  setStatus,
  restartCooldown,
  setRestartCooldown,
  restartCooldownRef,
  restartReloadRef,
  restartConfirmClosing,
  restartConfirmBusy,
  setRestartConfirmBusy,
  setRestartConfirmOpen,
  setRestartConfirmVisible,
  setRestartConfirmClosing,
  restartConfirmCloseTimerRef,
  startupInfo
}) {
  const announceHotReloadStatus = (message, announceFn) => {
    if (typeof announceFn === 'function') {
      announceFn(message);
    }
    if (announceFn !== setSettingsStatus) {
      setSettingsStatus(message);
    }
  };

  const HOT_RELOAD_TARGETS = includeInboundsTarget
    ? {
      all: ['outbounds', 'inbounds', 'routing', 'subscription'],
      routing: ['routing'],
      outbounds: ['outbounds'],
      inbounds: ['inbounds'],
      subscription: ['subscription']
    }
    : {
      all: ['outbounds', 'routing', 'subscription'],
      routing: ['routing'],
      outbounds: ['outbounds'],
      subscription: ['subscription']
    };
  const HOT_RELOAD_POLL_INTERVAL_MS = 1000;
  const HOT_RELOAD_POLL_TIMEOUT_MS = 120000;

  const schedulePostRestartRefresh = (base = apiBase) => {
    const delays = [1500, 4000, 8000];
    delays.forEach((delay) => {
      window.setTimeout(() => {
        refresh(base);
        loadRestartInfo(base);
      }, delay);
    });
  };

  const schedulePostDelayTestRefresh = (base = apiBase) => {
    const delays = [1500, 4000, 8000];
    delays.forEach((delay) => {
      window.setTimeout(() => {
        fetchNodes(base).catch(() => {});
      }, delay);
    });
  };

  const sleep = (ms) => new Promise((resolve) => {
    if (typeof window !== 'undefined') {
      window.setTimeout(resolve, ms);
      return;
    }
    setTimeout(resolve, ms);
  });

  const formatHotReloadTaskStatus = (task) => {
    if (!task || typeof task !== 'object') return '';
    const mode = String(task.mode || '').trim().toLowerCase();
    const modeLabel = mode === 'restart' ? 'Restart' : 'Hot reload';
    const idText = task.id ? ` (id ${task.id})` : '';
    if (task.inProgress) {
      return `${modeLabel} in progress${idText}: compiling and applying...`;
    }
    if (task.ok) {
      return `${modeLabel} completed${idText}.`;
    }
    const reason = String(task.error || task.rollbackError || '').trim() || 'unknown error';
    if (task.rolledBack && task.rollbackOk) {
      return `${modeLabel} failed${idText}, rolled back: ${reason}`;
    }
    if (task.rolledBack) {
      return `${modeLabel} failed${idText}, rollback failed: ${reason}`;
    }
    return `${modeLabel} failed${idText}: ${reason}`;
  };

  const pollHotReloadStatus = async (announceFn, taskId) => {
    const id = String(taskId || '').trim();
    if (!id || typeof loadRestartInfo !== 'function') return null;
    const startedAt = Date.now();
    let emptyCount = 0;
    let lastMessage = '';
    while (Date.now() - startedAt < HOT_RELOAD_POLL_TIMEOUT_MS) {
      const task = await loadRestartInfo(apiBase, id);
      if (!task) {
        emptyCount += 1;
        if (emptyCount >= 3) return null;
        await sleep(HOT_RELOAD_POLL_INTERVAL_MS);
        continue;
      }
      emptyCount = 0;
      const message = formatHotReloadTaskStatus(task);
      if (message && message !== lastMessage) {
        announceHotReloadStatus(message, announceFn);
        lastMessage = message;
      }
      if (!task.inProgress) {
        return task;
      }
      await sleep(HOT_RELOAD_POLL_INTERVAL_MS);
    }
    return null;
  };

  const performHotReload = async (announceFn, targets = HOT_RELOAD_TARGETS.all) => {
    if (hotReloadBusy) return;
    setHotReloadBusy(true);
    announceHotReloadStatus('Triggering hot reload...', announceFn);
    try {
      const hasDraft = !!getRoutingDraft();
      if (hasDraft) {
        announceHotReloadStatus('Uploading pending routing edits...', announceFn);
        await uploadRoutingDraft(apiBase);
      }
      const resp = await fetchJson(`${apiBase}/core/hotreload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets })
      });
      const taskId = String(resp?.id || '').trim();
      const needsRestart = Boolean(resp?.needsRestart || resp?.hotReload?.needsRestart);
      const warnings = Array.isArray(resp?.hotReload?.warnings) ? resp.hotReload.warnings : [];
      if (taskId) {
        announceHotReloadStatus(`Hot reload scheduled (id ${taskId}).`, announceFn);
      }
      const finalTask = await pollHotReloadStatus(announceFn, taskId);
      if (!finalTask) {
        const baseMsg = taskId ? `Hot reload applied (id ${taskId}).` : 'Hot reload applied.';
        const message = needsRestart
          ? warnings.length > 0
            ? `${baseMsg} Restart required: ${warnings[0]}`
            : `${baseMsg} Restart required for some changes.`
          : warnings.length > 0
            ? `${baseMsg} ${warnings[0]}`
            : baseMsg;
        announceHotReloadStatus(message, announceFn);
      } else if (warnings.length > 0) {
        const finalMessage = formatHotReloadTaskStatus(finalTask) || `Hot reload completed (id ${taskId}).`;
        announceHotReloadStatus(`${finalMessage} ${warnings[0]}`, announceFn);
      }
      schedulePostRestartRefresh(apiBase);
    } catch (err) {
      announceHotReloadStatus(`Hot reload failed: ${err.message}`, announceFn);
    } finally {
      setHotReloadBusy(false);
    }
  };

  const triggerHotReload = () => performHotReload(setSettingsStatus, HOT_RELOAD_TARGETS.all);
  const triggerHotReloadFromNodes = () => performHotReload(setConfigOutboundsStatus, HOT_RELOAD_TARGETS.outbounds);
  const triggerHotReloadFromRules = () => performHotReload(setRulesStatus, HOT_RELOAD_TARGETS.routing);
  const triggerHotReloadFromSubscriptions = () => performHotReload(setConfigSubscriptionStatus, HOT_RELOAD_TARGETS.subscription);
  const triggerHotReloadFromInbounds = () => {
    if (!includeInboundsTarget || typeof setConfigInboundsStatus !== 'function') return;
    performHotReload(setConfigInboundsStatus, HOT_RELOAD_TARGETS.inbounds);
  };

  const triggerDelayTest = () => {
    if (delayTestCooldown > 0 || delayTestBusy) return;
    setStatus('Latency test starting in 5s...');
    startCooldown(5, setDelayTestCooldown, delayTestCooldownRef);
    clearTimeoutRef(delayTestTriggerRef);
    const targetBase = apiBase;
    delayTestTriggerRef.current = window.setTimeout(async () => {
      setDelayTestBusy(true);
      try {
        await fetchJson(`${targetBase}/observatory/probe/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        setStatus('Latency test triggered.');
        schedulePostDelayTestRefresh(targetBase);
      } catch (err) {
        setStatus(`Latency test failed: ${err.message}`);
      } finally {
        setDelayTestBusy(false);
        clearTimeoutRef(delayTestTriggerRef);
      }
    }, 5000);
  };

  const startRestartCooldown = (seconds = 3) => {
    startCooldown(seconds, setRestartCooldown, restartCooldownRef);
    clearTimeoutRef(restartReloadRef);
    restartReloadRef.current = window.setTimeout(() => {
      window.location.reload();
    }, seconds * 1000);
  };

  const closeRestartConfirm = () => {
    if (restartConfirmClosing) return false;
    scheduleModalClose(
      restartConfirmCloseTimerRef,
      setRestartConfirmOpen,
      setRestartConfirmVisible,
      setRestartConfirmClosing
    );
    return true;
  };

  const confirmRestart = async () => {
    if (restartConfirmBusy) return;
    setRestartConfirmBusy(true);
    if (!closeRestartConfirm()) {
      setRestartConfirmBusy(false);
      return;
    }
    startRestartCooldown(3);
    const hasDraft = !!getRoutingDraft();
    if (hasDraft) {
      setSettingsStatus('Uploading pending routing edits...');
      try {
        await uploadRoutingDraft(apiBase);
      } catch (err) {
        setSettingsStatus(`Upload failed: ${err.message}`);
        setRestartConfirmBusy(false);
        return;
      }
    }
    setSettingsStatus('Restarting core...');
    try {
      await fetchJson(`${apiBase}/core/restart`, { method: 'POST' });
      setSettingsStatus('Restart scheduled.');
      schedulePostRestartRefresh(apiBase);
    } catch (err) {
      setSettingsStatus(`Restart failed: ${err.message}`);
    } finally {
      setRestartConfirmBusy(false);
    }
  };

  const triggerRestart = () => {
    if (restartCooldown > 0 || restartConfirmBusy) return;
    if (!startupInfo.available) {
      setSettingsStatus('Startup info is required for in-process restart.');
      return;
    }
    clearTimeoutRef(restartConfirmCloseTimerRef);
    setRestartConfirmVisible(true);
    setRestartConfirmClosing(false);
    setRestartConfirmOpen(true);
  };

  return {
    triggerHotReload,
    triggerHotReloadFromNodes,
    triggerHotReloadFromRules,
    triggerHotReloadFromSubscriptions,
    triggerHotReloadFromInbounds,
    triggerDelayTest,
    closeRestartConfirm,
    confirmRestart,
    triggerRestart
  };
}
