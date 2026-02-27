import { fetchJson } from '../../dashboardShared';

export function useSubscriptionConfig({
  apiBase,
  configSubscriptionPath,
  setConfigSubscriptionPath,
  configSubscriptionInbound,
  setConfigSubscriptionInbound,
  configSubscriptionOutbounds,
  setConfigSubscriptionOutbounds,
  configSubscriptionDatabases,
  setConfigSubscriptionDatabases,
  configSubscriptionFull,
  setConfigSubscriptionFull,
  setConfigSubscriptionStatus
}) {
  const normalizeSubscriptionList = (value) => {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return [value];
    return [];
  };

  const buildSubscriptionPatch = ({ inbound, outbounds, databases, full }) => {
    const patch = {};
    const inboundTag = String(inbound || '').trim();
    if (inboundTag) {
      patch['subscription-inbound'] = inboundTag;
    }
    if (Array.isArray(outbounds) && outbounds.length > 0) {
      patch.outbound = outbounds;
    }
    if (Array.isArray(databases) && databases.length > 0) {
      patch.database = databases;
    }
    if (Array.isArray(full) && full.length > 0) {
      patch.full = full;
    }
    return Object.keys(patch).length > 0 ? patch : null;
  };

  const writeSubscriptionConfig = async (subscription, base = apiBase) => {
    const resp = await fetchJson(`${base}/config/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        path: configSubscriptionPath || undefined
      })
    });
    if (resp?.path) {
      setConfigSubscriptionPath(resp.path);
    }
    return resp;
  };

  const loadSubscriptionConfig = async (base = apiBase) => {
    setConfigSubscriptionStatus('Loading config...');
    try {
      const resp = await fetchJson(`${base}/config/subscription`);
      const subscription = resp && typeof resp.subscription === 'object' ? resp.subscription : {};
      const inbound = String(subscription?.['subscription-inbound'] || subscription?.subscriptionInbound || '').trim();
      const outbounds = normalizeSubscriptionList(subscription?.outbound);
      const databases = normalizeSubscriptionList(subscription?.database);
      const full = normalizeSubscriptionList(subscription?.full);
      setConfigSubscriptionInbound(inbound);
      setConfigSubscriptionOutbounds(outbounds);
      setConfigSubscriptionDatabases(databases);
      setConfigSubscriptionFull(full);
      setConfigSubscriptionPath(resp.path || '');
      if (resp.foundSubscription === false) {
        setConfigSubscriptionStatus('Subscription section not found; saving will create it.');
      } else {
        setConfigSubscriptionStatus('');
      }
      return resp;
    } catch (err) {
      setConfigSubscriptionStatus(`Config load failed: ${err.message}`);
      throw err;
    }
  };

  const saveSubscriptionBlock = async () => {
    setConfigSubscriptionStatus('Saving...');
    try {
      const subscription = buildSubscriptionPatch({
        inbound: configSubscriptionInbound,
        outbounds: configSubscriptionOutbounds,
        databases: configSubscriptionDatabases,
        full: configSubscriptionFull
      });
      if (!subscription) {
        setConfigSubscriptionStatus('Nothing to save (subscription block is empty).');
        return;
      }
      await writeSubscriptionConfig(subscription);
      setConfigSubscriptionStatus('Saved to config. Hot reload core to apply.');
    } catch (err) {
      setConfigSubscriptionStatus(`Save failed: ${err.message}`);
    }
  };

  const clearSubscriptionBlock = async () => {
    setConfigSubscriptionStatus('Clearing subscription...');
    try {
      await writeSubscriptionConfig(null);
      setConfigSubscriptionInbound('');
      setConfigSubscriptionOutbounds([]);
      setConfigSubscriptionDatabases([]);
      setConfigSubscriptionFull([]);
      setConfigSubscriptionStatus('Subscription cleared. Hot reload core to apply.');
    } catch (err) {
      setConfigSubscriptionStatus(`Clear failed: ${err.message}`);
    }
  };

  const toggleSubscriptionOutboundEnabled = async (index) => {
    if (index < 0 || index >= configSubscriptionOutbounds.length) return;
    const current = configSubscriptionOutbounds[index] || {};
    const wasDisabled = current?.enabled === false;
    const nextEntry = { ...current };
    if (wasDisabled) {
      delete nextEntry.enabled;
    } else {
      nextEntry.enabled = false;
    }
    const nextOutbounds = [...configSubscriptionOutbounds];
    nextOutbounds[index] = nextEntry;
    setConfigSubscriptionOutbounds(nextOutbounds);

    setConfigSubscriptionStatus('Saving...');
    try {
      const subscription = buildSubscriptionPatch({
        inbound: configSubscriptionInbound,
        outbounds: nextOutbounds,
        databases: configSubscriptionDatabases,
        full: configSubscriptionFull
      });
      if (!subscription) {
        setConfigSubscriptionStatus('Nothing to save (subscription block is empty).');
        return;
      }
      await writeSubscriptionConfig(subscription);
      setConfigSubscriptionStatus('Saved to config. Hot reload core to apply.');
    } catch (err) {
      setConfigSubscriptionStatus(`Save failed: ${err.message}`);
    }
  };

  const toggleSubscriptionDatabaseEnabled = async (index) => {
    if (index < 0 || index >= configSubscriptionDatabases.length) return;
    const current = configSubscriptionDatabases[index] || {};
    const wasDisabled = current?.enabled === false;
    const nextEntry = { ...current };
    if (wasDisabled) {
      delete nextEntry.enabled;
    } else {
      nextEntry.enabled = false;
    }
    const nextDatabases = [...configSubscriptionDatabases];
    nextDatabases[index] = nextEntry;
    setConfigSubscriptionDatabases(nextDatabases);

    setConfigSubscriptionStatus('Saving...');
    try {
      const subscription = buildSubscriptionPatch({
        inbound: configSubscriptionInbound,
        outbounds: configSubscriptionOutbounds,
        databases: nextDatabases,
        full: configSubscriptionFull
      });
      if (!subscription) {
        setConfigSubscriptionStatus('Nothing to save (subscription block is empty).');
        return;
      }
      await writeSubscriptionConfig(subscription);
      setConfigSubscriptionStatus('Saved to config. Hot reload core to apply.');
    } catch (err) {
      setConfigSubscriptionStatus(`Save failed: ${err.message}`);
    }
  };

  return {
    buildSubscriptionPatch,
    writeSubscriptionConfig,
    loadSubscriptionConfig,
    saveSubscriptionBlock,
    clearSubscriptionBlock,
    toggleSubscriptionOutboundEnabled,
    toggleSubscriptionDatabaseEnabled
  };
}
