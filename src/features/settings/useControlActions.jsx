import {
  clearTimeoutRef,
  fetchJson,
  getFirewallDraft,
  getRoutingDraft,
  scheduleModalClose,
  startCooldown
} from '../../dashboardShared';

export function useControlActions({
  apiBase,
  notify,
  hotReloadBusy,
  setHotReloadBusy,
  setSettingsStatus,
  setConfigOutboundsStatus,
  setRulesStatus,
  setConfigFirewallStatus,
  setConfigSubscriptionStatus,
  setConfigInboundsStatus,
  uploadRoutingDraft,
  uploadFirewallDraft,
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
  const announceHotReloadStatus = (message, tone = 'progress') => {
    notify?.({ channel: 'core-reload', message, tone });
  };

  const FULL_HOT_RELOAD_TARGETS = ['all'];
  const HOT_RELOAD_POLL_INTERVAL_MS = 1000;
  const HOT_RELOAD_POLL_TIMEOUT_MS = 120000;

  const schedulePostRestartRefresh = (base = apiBase) => {
    const delays = [1500, 4000, 8000];
    delays.forEach((delay) => {
      window.setTimeout(() => {
        refresh(base, { announce: false });
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

  const pollHotReloadStatus = async (taskId) => {
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
        announceHotReloadStatus(message, task.inProgress ? 'progress' : task.ok ? 'success' : 'error');
        lastMessage = message;
      }
      if (!task.inProgress) {
        return task;
      }
      await sleep(HOT_RELOAD_POLL_INTERVAL_MS);
    }
    return null;
  };

  const performHotReload = async () => {
    if (hotReloadBusy) return;
    setHotReloadBusy(true);
    announceHotReloadStatus('Triggering hot reload...');
    try {
      const hasDraft = !!getRoutingDraft(apiBase);
      if (hasDraft) {
        announceHotReloadStatus('Uploading pending routing edits...');
        await uploadRoutingDraft(apiBase);
      }
      const hasFirewallDraft = !!getFirewallDraft(apiBase);
      if (hasFirewallDraft) {
        announceHotReloadStatus('Uploading pending firewall edits...');
        await uploadFirewallDraft(apiBase);
      }
      const resp = await fetchJson(`${apiBase}/core/hotreload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: FULL_HOT_RELOAD_TARGETS })
      });
      const taskId = String(resp?.id || '').trim();
      const needsRestart = Boolean(resp?.needsRestart || resp?.hotReload?.needsRestart);
      const warnings = Array.isArray(resp?.hotReload?.warnings) ? resp.hotReload.warnings : [];
      if (taskId) {
        announceHotReloadStatus(`Hot reload scheduled (id ${taskId}).`);
      }
      const finalTask = await pollHotReloadStatus(taskId);
      if (!finalTask) {
        const baseMsg = taskId ? `Hot reload applied (id ${taskId}).` : 'Hot reload applied.';
        const message = needsRestart
          ? warnings.length > 0
            ? `${baseMsg} Restart required: ${warnings[0]}`
            : `${baseMsg} Restart required for some changes.`
          : warnings.length > 0
            ? `${baseMsg} ${warnings[0]}`
            : baseMsg;
        announceHotReloadStatus(message, 'success');
      } else if (warnings.length > 0) {
        const finalMessage = formatHotReloadTaskStatus(finalTask) || `Hot reload completed (id ${taskId}).`;
        announceHotReloadStatus(`${finalMessage} ${warnings[0]}`, finalTask.ok ? 'success' : 'error');
      }
      schedulePostRestartRefresh(apiBase);
    } catch (err) {
      announceHotReloadStatus(`Hot reload failed: ${err.message}`, 'error');
    } finally {
      setHotReloadBusy(false);
    }
  };

  const makeHotReloadTrigger = () => () => performHotReload();

  const triggerHotReload = makeHotReloadTrigger();
  const triggerHotReloadFromNodes = makeHotReloadTrigger();
  const triggerHotReloadFromRules = makeHotReloadTrigger();
  const triggerHotReloadFromFirewall = makeHotReloadTrigger();
  const triggerHotReloadFromSubscriptions = makeHotReloadTrigger();
  const triggerHotReloadFromInbounds = makeHotReloadTrigger();

  const triggerDelayTest = () => {
    if (delayTestCooldown > 0 || delayTestBusy) return;
    notify?.({ channel: 'latency-test', message: 'Latency test starts in 5 seconds...', tone: 'progress' });
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
        notify?.({ channel: 'latency-test', message: 'Latency test triggered.', tone: 'success' });
        schedulePostDelayTestRefresh(targetBase);
      } catch (err) {
        notify?.({ channel: 'latency-test', message: `Latency test failed: ${err.message}`, tone: 'error' });
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
    const hasDraft = !!getRoutingDraft(apiBase);
    if (hasDraft) {
      notify?.({ channel: 'core-restart', message: 'Uploading pending routing edits...', tone: 'progress' });
      try {
        await uploadRoutingDraft(apiBase);
      } catch (err) {
        notify?.({ channel: 'core-restart', message: `Upload failed: ${err.message}`, tone: 'error' });
        setRestartConfirmBusy(false);
        return;
      }
    }
    const hasFirewallDraft = !!getFirewallDraft(apiBase);
    if (hasFirewallDraft) {
      notify?.({ channel: 'core-restart', message: 'Uploading pending firewall edits...', tone: 'progress' });
      try {
        await uploadFirewallDraft(apiBase);
      } catch (err) {
        notify?.({ channel: 'core-restart', message: `Upload failed: ${err.message}`, tone: 'error' });
        setRestartConfirmBusy(false);
        return;
      }
    }
    notify?.({ channel: 'core-restart', message: 'Restarting core...', tone: 'progress' });
    try {
      await fetchJson(`${apiBase}/core/restart`, { method: 'POST' });
      notify?.({ channel: 'core-restart', message: 'Restart scheduled.', tone: 'success' });
      schedulePostRestartRefresh(apiBase);
    } catch (err) {
      notify?.({ channel: 'core-restart', message: `Restart failed: ${err.message}`, tone: 'error' });
    } finally {
      setRestartConfirmBusy(false);
    }
  };

  const triggerRestart = () => {
    if (restartCooldown > 0 || restartConfirmBusy) return;
    if (!startupInfo.available) {
      notify?.({ channel: 'core-restart', message: 'Startup info is required for in-process restart.', tone: 'error' });
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
    triggerHotReloadFromFirewall,
    triggerHotReloadFromSubscriptions,
    triggerHotReloadFromInbounds,
    triggerDelayTest,
    closeRestartConfirm,
    confirmRestart,
    triggerRestart
  };
}
