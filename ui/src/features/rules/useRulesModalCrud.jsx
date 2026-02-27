import {
  RULE_TEMPLATE,
  BALANCER_TEMPLATE,
  OUTBOUND_TEMPLATE,
  SUBSCRIPTION_OUTBOUND_TEMPLATE,
  SUBSCRIPTION_DATABASE_TEMPLATE,
  formatJson,
  clearTimeoutRef,
  scheduleModalClose,
  getSubscriptionUrlDisplay,
  fetchJson
} from '../../dashboardShared';

export function useRulesModalCrud({
  apiBase,
  configRules,
  setConfigRules,
  configBalancers,
  setConfigBalancers,
  configOutbounds,
  setConfigOutbounds,
  configSubscriptionInbound,
  setConfigSubscriptionInbound,
  configSubscriptionOutbounds,
  setConfigSubscriptionOutbounds,
  configSubscriptionDatabases,
  setConfigSubscriptionDatabases,
  configSubscriptionFull,
  setConfigSubscriptionFull,
  configRulesPath,
  configOutboundsPath,
  setConfigRulesStatus,
  setConfigOutboundsStatus,
  setConfigSubscriptionStatus,
  buildSubscriptionPatch,
  writeSubscriptionConfig,
  stageRoutingDraft,
  fetchRules,
  setRulesModalOpen,
  setRulesModalVisible,
  rulesModalClosing,
  setRulesModalClosing,
  rulesModalMode,
  setRulesModalMode,
  rulesModalTarget,
  setRulesModalTarget,
  rulesModalIndex,
  setRulesModalIndex,
  rulesModalText,
  setRulesModalText,
  setRulesModalStatus,
  rulesModalInsertAfter,
  setRulesModalInsertAfter,
  rulesModalSaving,
  setRulesModalSaving,
  rulesModalCloseTimerRef,
  setDeleteConfirmOpen,
  setDeleteConfirmVisible,
  deleteConfirmClosing,
  setDeleteConfirmClosing,
  deleteConfirmBusy,
  setDeleteConfirmBusy,
  deleteConfirmTarget,
  setDeleteConfirmTarget,
  deleteConfirmIndex,
  setDeleteConfirmIndex,
  setDeleteConfirmLabel,
  deleteConfirmCloseTimerRef
}) {
  const setConfigStatus = (target, message) => {
    if (target === 'outbound') {
      setConfigOutboundsStatus(message);
    } else if (target === 'subscription' || target === 'subscriptionDatabase') {
      setConfigSubscriptionStatus(message);
    } else {
      setConfigRulesStatus(message);
    }
  };

  const getRuleLabel = (rule, index) => {
    const tag = rule?.ruleTag || rule?.destination || rule?.outboundTag || rule?.balancerTag || '';
    if (tag) {
      return `${index + 1}. ${tag}`;
    }
    return `${index + 1}. rule`;
  };

  const getBalancerLabel = (balancer, index) => {
    const tag = balancer?.tag || '';
    if (tag) {
      return `${index + 1}. ${tag}`;
    }
    return `${index + 1}. balancer`;
  };

  const getOutboundLabel = (outbound, index) => {
    const tag = outbound?.tag || '';
    if (tag) {
      return `${index + 1}. ${tag}`;
    }
    return `${index + 1}. outbound`;
  };

  const getSubscriptionLabel = (subscription, index) => {
    const name = String(subscription?.name || '').trim();
    const url = String(subscription?.url || '').trim();
    const displayUrl = getSubscriptionUrlDisplay(url);
    if (name) {
      return `${index + 1}. ${name}`;
    }
    if (displayUrl) {
      return `${index + 1}. ${displayUrl}`;
    }
    return `${index + 1}. subscription`;
  };

  const getSubscriptionDatabaseLabel = (database, index) => {
    const type = String(database?.type || '').trim();
    const url = String(database?.url || '').trim();
    const displayUrl = getSubscriptionUrlDisplay(url);
    if (type) {
      return `${index + 1}. ${type}`;
    }
    if (displayUrl) {
      return `${index + 1}. ${displayUrl}`;
    }
    return `${index + 1}. database`;
  };

  const openRulesModal = (target, mode, index = -1, afterIndex = -1, item = null) => {
    const normalizedAfter = Number.isFinite(Number(afterIndex)) ? Number(afterIndex) : -1;
    const template = target === 'rule'
      ? RULE_TEMPLATE
      : target === 'balancer'
        ? BALANCER_TEMPLATE
        : target === 'subscription'
          ? SUBSCRIPTION_OUTBOUND_TEMPLATE
          : target === 'subscriptionDatabase'
            ? SUBSCRIPTION_DATABASE_TEMPLATE
            : OUTBOUND_TEMPLATE;
    clearTimeoutRef(rulesModalCloseTimerRef);
    setRulesModalVisible(true);
    setRulesModalClosing(false);
    setRulesModalTarget(target);
    setRulesModalMode(mode);
    setRulesModalIndex(mode === 'edit' ? index : -1);
    setRulesModalInsertAfter(mode === 'edit' ? index : normalizedAfter);
    setRulesModalText(formatJson(mode === 'edit' ? (item || {}) : template));
    setRulesModalStatus('');
    setRulesModalOpen(true);
  };

  const openDeleteConfirm = (target, index) => {
    if (deleteConfirmBusy) return;
    const items = target === 'rule'
      ? (Array.isArray(configRules) ? configRules : [])
      : target === 'balancer'
        ? (Array.isArray(configBalancers) ? configBalancers : [])
        : target === 'subscription'
          ? (Array.isArray(configSubscriptionOutbounds) ? configSubscriptionOutbounds : [])
          : target === 'subscriptionDatabase'
            ? (Array.isArray(configSubscriptionDatabases) ? configSubscriptionDatabases : [])
            : (Array.isArray(configOutbounds) ? configOutbounds : []);
    if (index < 0 || index >= items.length) {
      setConfigStatus(target, `Delete failed: ${target} index out of range.`);
      return;
    }
    const label = target === 'rule'
      ? getRuleLabel(items[index], index)
      : target === 'balancer'
        ? getBalancerLabel(items[index], index)
        : target === 'subscription'
          ? getSubscriptionLabel(items[index], index)
          : target === 'subscriptionDatabase'
            ? getSubscriptionDatabaseLabel(items[index], index)
            : getOutboundLabel(items[index], index);
    clearTimeoutRef(deleteConfirmCloseTimerRef);
    setDeleteConfirmTarget(target);
    setDeleteConfirmIndex(index);
    setDeleteConfirmLabel(label);
    setDeleteConfirmVisible(true);
    setDeleteConfirmClosing(false);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    if (deleteConfirmClosing) return false;
    scheduleModalClose(
      deleteConfirmCloseTimerRef,
      setDeleteConfirmOpen,
      setDeleteConfirmVisible,
      setDeleteConfirmClosing
    );
    return true;
  };

  const deleteConfigItem = async (target, index) => {
    const nextItems = target === 'rule'
      ? (Array.isArray(configRules) ? [...configRules] : [])
      : target === 'balancer'
        ? (Array.isArray(configBalancers) ? [...configBalancers] : [])
        : target === 'subscription'
          ? (Array.isArray(configSubscriptionOutbounds) ? [...configSubscriptionOutbounds] : [])
          : target === 'subscriptionDatabase'
            ? (Array.isArray(configSubscriptionDatabases) ? [...configSubscriptionDatabases] : [])
            : (Array.isArray(configOutbounds) ? [...configOutbounds] : []);
    if (index < 0 || index >= nextItems.length) {
      setConfigStatus(target, `Delete failed: ${target} index out of range.`);
      return;
    }
    nextItems.splice(index, 1);
    if (target === 'rule' || target === 'balancer') {
      if (target === 'rule') {
        setConfigRules(nextItems);
        stageRoutingDraft(nextItems, configBalancers);
      } else {
        setConfigBalancers(nextItems);
        stageRoutingDraft(configRules, nextItems);
      }
      return;
    }
    setConfigStatus(target, 'Deleting...');
    try {
      if (target === 'subscription' || target === 'subscriptionDatabase') {
        const nextOutbounds = target === 'subscription'
          ? nextItems
          : (Array.isArray(configSubscriptionOutbounds) ? [...configSubscriptionOutbounds] : []);
        const nextDatabases = target === 'subscriptionDatabase'
          ? nextItems
          : (Array.isArray(configSubscriptionDatabases) ? [...configSubscriptionDatabases] : []);
        const subscription = buildSubscriptionPatch({
          inbound: configSubscriptionInbound,
          outbounds: nextOutbounds,
          databases: nextDatabases,
          full: configSubscriptionFull
        });
        await writeSubscriptionConfig(subscription);
        setConfigSubscriptionOutbounds(nextOutbounds);
        setConfigSubscriptionDatabases(nextDatabases);
        if (!subscription) {
          setConfigSubscriptionInbound('');
          setConfigSubscriptionFull([]);
        }
        const label = target === 'subscriptionDatabase' ? 'subscription database' : 'subscription outbound';
        setConfigSubscriptionStatus(`${label} deleted. Hot reload core to apply.`);
        return;
      }
      const endpoint = target === 'outbound' ? 'outbounds' : 'routing';
      const body =
        target === 'rule'
          ? { rules: nextItems }
          : target === 'balancer'
            ? { balancers: nextItems }
            : { outbounds: nextItems };
      const path = target === 'outbound' ? configOutboundsPath : configRulesPath;
      await fetchJson(`${apiBase}/config/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(target === 'outbound' ? body : { routing: body }),
          path: path || undefined
        })
      });
      if (target === 'rule') {
        setConfigRules(nextItems);
      } else if (target === 'balancer') {
        setConfigBalancers(nextItems);
      } else {
        setConfigOutbounds(nextItems);
      }
      setConfigStatus(target, `${target} deleted. Hot reload core to apply.`);
      fetchRules(apiBase).catch(() => {});
    } catch (err) {
      setConfigStatus(target, `Delete failed: ${err.message}`);
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirmBusy) return;
    const target = deleteConfirmTarget;
    const index = deleteConfirmIndex;
    if (!target || index < 0) return;
    setDeleteConfirmBusy(true);
    if (!closeDeleteConfirm()) {
      setDeleteConfirmBusy(false);
      return;
    }
    try {
      await deleteConfigItem(target, index);
    } finally {
      setDeleteConfirmBusy(false);
    }
  };

  const closeRulesModal = (options = {}) => {
    const { force = false } = options;
    if (rulesModalSaving && !force) return;
    if (rulesModalClosing) return;
    setRulesModalStatus('');
    scheduleModalClose(
      rulesModalCloseTimerRef,
      setRulesModalOpen,
      setRulesModalVisible,
      setRulesModalClosing
    );
  };

  const saveRulesModal = async () => {
    if (rulesModalSaving) return;
    let parsed;
    try {
      parsed = JSON.parse(rulesModalText);
    } catch (err) {
      setRulesModalStatus(`Invalid JSON: ${err.message}`);
      return;
    }

    const target = rulesModalTarget;
    const targetLabel = target === 'rule'
      ? 'Rule'
      : target === 'balancer'
        ? 'Balancer'
        : target === 'subscription'
          ? 'Subscription outbound'
          : target === 'subscriptionDatabase'
            ? 'Subscription database'
            : 'Outbound';
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setRulesModalStatus(`${targetLabel} must be a JSON object.`);
      return;
    }

    if (target === 'rule') {
      const targetTagRaw = parsed.targetTag;
      if (targetTagRaw !== undefined && targetTagRaw !== null) {
        if (typeof targetTagRaw !== 'string') {
          setRulesModalStatus('targetTag must be a string.');
          return;
        }
        const targetTag = targetTagRaw.trim();
        const destination = typeof parsed.destination === 'string' ? parsed.destination.trim() : '';
        const outboundTag = typeof parsed.outboundTag === 'string' ? parsed.outboundTag.trim() : '';
        const balancerTag = typeof parsed.balancerTag === 'string' ? parsed.balancerTag.trim() : '';
        if (!destination && !outboundTag && !balancerTag && targetTag) {
          parsed.destination = targetTag;
        }
        delete parsed.targetTag;
      }

      const ruleTagRaw = parsed.ruleTag;
      const destinationRaw = parsed.destination;
      const outboundTagRaw = parsed.outboundTag;
      const balancerTagRaw = parsed.balancerTag;

      if (ruleTagRaw !== undefined && ruleTagRaw !== null && typeof ruleTagRaw !== 'string') {
        setRulesModalStatus('ruleTag must be a string.');
        return;
      }
      if (destinationRaw !== undefined && destinationRaw !== null && typeof destinationRaw !== 'string') {
        setRulesModalStatus('destination must be a string.');
        return;
      }
      if (outboundTagRaw !== undefined && outboundTagRaw !== null && typeof outboundTagRaw !== 'string') {
        setRulesModalStatus('outboundTag must be a string.');
        return;
      }
      if (balancerTagRaw !== undefined && balancerTagRaw !== null && typeof balancerTagRaw !== 'string') {
        setRulesModalStatus('balancerTag must be a string.');
        return;
      }

      const ruleTag = String(ruleTagRaw || '').trim();
      const destination = String(destinationRaw || '').trim();
      const outboundTag = String(outboundTagRaw || '').trim();
      const balancerTag = String(balancerTagRaw || '').trim();

      if (ruleTag.startsWith('!')) {
        setRulesModalStatus("ruleTag must not start with '!'.");
        return;
      }

      const targetCount = (destination ? 1 : 0) + (outboundTag ? 1 : 0) + (balancerTag ? 1 : 0);
      if (targetCount > 1) {
        setRulesModalStatus('Use only one of destination/outboundTag/balancerTag (destination recommended).');
        return;
      }
      if (targetCount === 0 && !ruleTag) {
        setRulesModalStatus('Rule with no destination/outboundTag/balancerTag must set ruleTag.');
        return;
      }
    }

    if (target === 'subscription') {
      const urlRaw = parsed.url;
      if (urlRaw !== undefined && urlRaw !== null && typeof urlRaw !== 'string') {
        setRulesModalStatus('url must be a string.');
        return;
      }
      const url = String(urlRaw || '').trim();
      if (!url) {
        setRulesModalStatus('url is required.');
        return;
      }
      const enabledRaw = parsed.enabled;
      if (enabledRaw !== undefined && enabledRaw !== null && typeof enabledRaw !== 'boolean') {
        setRulesModalStatus('enabled must be a boolean.');
        return;
      }
      const nameRaw = parsed.name;
      if (nameRaw !== undefined && nameRaw !== null && typeof nameRaw !== 'string') {
        setRulesModalStatus('name must be a string.');
        return;
      }
      const formatRaw = parsed.format;
      if (formatRaw !== undefined && formatRaw !== null && typeof formatRaw !== 'string') {
        setRulesModalStatus('format must be a string.');
        return;
      }
      const tagPrefixRaw = parsed.tagPrefix;
      if (tagPrefixRaw !== undefined && tagPrefixRaw !== null && typeof tagPrefixRaw !== 'string') {
        setRulesModalStatus('tagPrefix must be a string.');
        return;
      }
      const insertRaw = parsed.insert;
      if (insertRaw !== undefined && insertRaw !== null && typeof insertRaw !== 'string') {
        setRulesModalStatus('insert must be a string.');
        return;
      }

      const intervalRaw = parsed.interval;
      if (intervalRaw !== undefined && intervalRaw !== null) {
        if (typeof intervalRaw !== 'string') {
          setRulesModalStatus('interval must be a string.');
          return;
        }
        const interval = intervalRaw.trim();
        if (!interval) {
          delete parsed.interval;
        } else {
          parsed.interval = interval;
        }
      }

      const cronRaw = parsed.cron;
      if (cronRaw !== undefined && cronRaw !== null) {
        if (typeof cronRaw !== 'string') {
          setRulesModalStatus('cron must be a string.');
          return;
        }
        const cron = cronRaw.trim();
        if (!cron) {
          delete parsed.cron;
        } else {
          parsed.cron = cron;
        }
      }

      const crontabRaw = parsed.crontab;
      if (crontabRaw !== undefined && crontabRaw !== null) {
        if (typeof crontabRaw !== 'string') {
          setRulesModalStatus('crontab must be a string.');
          return;
        }
        const crontab = crontabRaw.trim();
        if (!crontab) {
          delete parsed.crontab;
        } else {
          parsed.crontab = crontab;
        }
      }

      const interval = String(parsed.interval || '').trim();
      const cronExpr = String(parsed.cron || parsed.crontab || '').trim();
      if (interval && cronExpr) {
        setRulesModalStatus('interval and cron/crontab cannot both be set.');
        return;
      }
    }

    if (target === 'subscriptionDatabase') {
      const typeRaw = parsed.type;
      if (typeRaw !== undefined && typeRaw !== null && typeof typeRaw !== 'string') {
        setRulesModalStatus('type must be a string.');
        return;
      }
      const type = String(typeRaw || '').trim().toLowerCase();
      if (!type) {
        setRulesModalStatus('type is required.');
        return;
      }
      if (type !== 'geoip' && type !== 'geosite') {
        setRulesModalStatus('type must be geoip or geosite.');
        return;
      }
      parsed.type = type;

      const urlRaw = parsed.url;
      if (urlRaw !== undefined && urlRaw !== null && typeof urlRaw !== 'string') {
        setRulesModalStatus('url must be a string.');
        return;
      }
      const url = String(urlRaw || '').trim();
      if (!url) {
        setRulesModalStatus('url is required.');
        return;
      }
      parsed.url = url;

      const enabledRaw = parsed.enabled;
      if (enabledRaw !== undefined && enabledRaw !== null && typeof enabledRaw !== 'boolean') {
        setRulesModalStatus('enabled must be a boolean.');
        return;
      }

      const intervalRaw = parsed.interval;
      if (intervalRaw !== undefined && intervalRaw !== null) {
        if (typeof intervalRaw !== 'string') {
          setRulesModalStatus('interval must be a string.');
          return;
        }
        const interval = intervalRaw.trim();
        if (!interval) {
          delete parsed.interval;
        } else {
          parsed.interval = interval;
        }
      }

      const cronRaw = parsed.cron;
      if (cronRaw !== undefined && cronRaw !== null) {
        if (typeof cronRaw !== 'string') {
          setRulesModalStatus('cron must be a string.');
          return;
        }
        const cron = cronRaw.trim();
        if (!cron) {
          delete parsed.cron;
        } else {
          parsed.cron = cron;
        }
      }

      const crontabRaw = parsed.crontab;
      if (crontabRaw !== undefined && crontabRaw !== null) {
        if (typeof crontabRaw !== 'string') {
          setRulesModalStatus('crontab must be a string.');
          return;
        }
        const crontab = crontabRaw.trim();
        if (!crontab) {
          delete parsed.crontab;
        } else {
          parsed.crontab = crontab;
        }
      }

      const interval = String(parsed.interval || '').trim();
      const cronExpr = String(parsed.cron || parsed.crontab || '').trim();
      if (interval && cronExpr) {
        setRulesModalStatus('interval and cron/crontab cannot both be set.');
        return;
      }
    }

    const nextItems = target === 'rule'
      ? (Array.isArray(configRules) ? [...configRules] : [])
      : target === 'balancer'
        ? (Array.isArray(configBalancers) ? [...configBalancers] : [])
        : target === 'subscription'
          ? (Array.isArray(configSubscriptionOutbounds) ? [...configSubscriptionOutbounds] : [])
          : target === 'subscriptionDatabase'
            ? (Array.isArray(configSubscriptionDatabases) ? [...configSubscriptionDatabases] : [])
            : (Array.isArray(configOutbounds) ? [...configOutbounds] : []);
    if (rulesModalMode === 'edit') {
      if (rulesModalIndex < 0 || rulesModalIndex >= nextItems.length) {
        setRulesModalStatus(`${target} index out of range.`);
        return;
      }
      const sourceIndex = rulesModalIndex;
      const [currentItem] = nextItems.splice(sourceIndex, 1);
      const afterIndex = Number(rulesModalInsertAfter);
      let insertIndex = 0;
      if (Number.isFinite(afterIndex) && afterIndex >= 0) {
        const adjustedAfter = afterIndex < sourceIndex ? afterIndex + 1 : afterIndex;
        insertIndex = Math.min(Math.max(adjustedAfter, 0), nextItems.length);
      }
      nextItems.splice(insertIndex, 0, parsed ?? currentItem);
    } else {
      const afterIndex = Number(rulesModalInsertAfter);
      const insertIndex = Number.isFinite(afterIndex) && afterIndex >= 0
        ? Math.min(afterIndex + 1, nextItems.length)
        : 0;
      nextItems.splice(insertIndex, 0, parsed);
    }

    setRulesModalSaving(true);
    if (target === 'rule' || target === 'balancer') {
      if (target === 'rule') {
        setConfigRules(nextItems);
        stageRoutingDraft(nextItems, configBalancers);
      } else {
        setConfigBalancers(nextItems);
        stageRoutingDraft(configRules, nextItems);
      }
      setRulesModalStatus('Saved locally.');
      closeRulesModal({ force: true });
      setRulesModalSaving(false);
      return;
    }
    setRulesModalStatus('Saving...');
    try {
      if (target === 'subscription' || target === 'subscriptionDatabase') {
        const nextOutbounds = target === 'subscription'
          ? nextItems
          : (Array.isArray(configSubscriptionOutbounds) ? [...configSubscriptionOutbounds] : []);
        const nextDatabases = target === 'subscriptionDatabase'
          ? nextItems
          : (Array.isArray(configSubscriptionDatabases) ? [...configSubscriptionDatabases] : []);
        const subscription = buildSubscriptionPatch({
          inbound: configSubscriptionInbound,
          outbounds: nextOutbounds,
          databases: nextDatabases,
          full: configSubscriptionFull
        });
        await writeSubscriptionConfig(subscription);
        setConfigSubscriptionOutbounds(nextOutbounds);
        setConfigSubscriptionDatabases(nextDatabases);
        if (!subscription) {
          setConfigSubscriptionInbound('');
          setConfigSubscriptionFull([]);
        }
      } else {
        const endpoint = target === 'outbound' ? 'outbounds' : 'routing';
        const body =
          target === 'rule'
            ? { rules: nextItems }
            : target === 'balancer'
              ? { balancers: nextItems }
              : { outbounds: nextItems };
        const path = target === 'outbound' ? configOutboundsPath : configRulesPath;
        await fetchJson(`${apiBase}/config/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(target === 'outbound' ? body : { routing: body }),
            path: path || undefined
          })
        });
        if (target === 'rule') {
          setConfigRules(nextItems);
        } else if (target === 'balancer') {
          setConfigBalancers(nextItems);
        } else {
          setConfigOutbounds(nextItems);
        }
        fetchRules(apiBase).catch(() => {});
      }
      setConfigStatus(target, 'Saved to config. Hot reload core to apply.');
      setRulesModalStatus('Saved');
      closeRulesModal({ force: true });
    } catch (err) {
      setRulesModalStatus(`Save failed: ${err.message}`);
    } finally {
      setRulesModalSaving(false);
    }
  };

  return {
    getRuleLabel,
    getBalancerLabel,
    getOutboundLabel,
    getSubscriptionLabel,
    getSubscriptionDatabaseLabel,
    openRulesModal,
    openDeleteConfirm,
    closeDeleteConfirm,
    confirmDelete,
    closeRulesModal,
    saveRulesModal
  };
}
