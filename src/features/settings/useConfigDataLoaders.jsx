import {
  ROUTING_DRAFT_NOTICE,
  getRoutingDraft,
  saveRoutingDraft,
  fetchJson,
  normalizeConnectionsPayload,
  normalizeDnsCacheStats,
  DNS_CACHE_NETWORK_ERROR_REGEX
} from '../../dashboardShared';

export function useConfigDataLoaders({
  apiBase,
  configRulesPath,
  setOutbounds,
  setGroups,
  setStatusByTag,
  setConnections,
  setStatus,
  setRulesData,
  setConfigRules,
  setConfigBalancers,
  setConfigRulesStatus,
  setConfigRulesPath,
  setConfigOutbounds,
  setConfigOutboundsStatus,
  setConfigOutboundsPath,
  setConfigInbounds,
  setConfigInboundsStatus,
  setConfigInboundsPath,
  setDnsCacheStats,
  setDnsCacheStatus,
  dnsCacheFlushBusy,
  setDnsCacheFlushBusy,
  setSettingsPath,
  setStartupInfo,
  setSettingsStatus,
  setRestartInfo
}) {
  const applyNodesPayload = (payload) => {
    const nextOutbounds = payload && payload.outbounds ? payload.outbounds : [];
    setOutbounds(nextOutbounds);
    setGroups(payload && payload.groups ? payload.groups : []);
    setStatusByTag(payload && payload.statuses ? payload.statuses : {});
  };

  const fetchNodes = async (base = apiBase) => {
    const data = await fetchJson(`${base}/nodes`);
    applyNodesPayload(data);
    return data;
  };

  const fetchDnsCacheStats = async (base = apiBase, options = {}) => {
    const { silent = false } = options;
    try {
      const data = await fetchJson(`${base}/dns/cache`);
      const normalized = normalizeDnsCacheStats(data);
      setDnsCacheStats(normalized);
      if (normalized.available) {
        setDnsCacheStatus('');
      } else if (!silent) {
        if (normalized.error) {
          setDnsCacheStatus(`DNS cache unavailable: ${normalized.error}`);
        } else {
          setDnsCacheStatus('DNS cache unavailable.');
        }
      } else {
        setDnsCacheStatus('');
      }
      return normalized;
    } catch (err) {
      const errMessage = String(err?.message || '').trim();
      const networkError = DNS_CACHE_NETWORK_ERROR_REGEX.test(errMessage);
      const message = `DNS cache load failed: ${errMessage || 'unknown error'}`;
      setDnsCacheStats((prev) => ({
        ...prev,
        available: false,
        error: networkError ? '' : errMessage,
        updatedAt: new Date().toISOString()
      }));
      if (networkError) {
        setDnsCacheStatus('');
      } else if (!silent) {
        setDnsCacheStatus(message);
      }
      throw err;
    }
  };

  const flushDnsCache = async (base = apiBase) => {
    await fetchJson(`${base}/dns/cache/flush`, { method: 'POST' });
    await fetchDnsCacheStats(base, { silent: true }).catch(() => {});
  };

  const triggerDnsCacheFlushFromDashboard = async () => {
    if (dnsCacheFlushBusy) return;
    setDnsCacheFlushBusy(true);
    setDnsCacheStatus('Flushing DNS cache...');
    try {
      await flushDnsCache(apiBase);
      setDnsCacheStatus('DNS cache flushed.');
    } catch (err) {
      setDnsCacheStatus(`DNS cache flush failed: ${err.message}`);
    } finally {
      setDnsCacheFlushBusy(false);
    }
  };

  const triggerDnsCacheFlushFromSettings = async () => {
    if (dnsCacheFlushBusy) return;
    setDnsCacheFlushBusy(true);
    setSettingsStatus('Flushing DNS cache...');
    try {
      await flushDnsCache(apiBase);
      setSettingsStatus('DNS cache flushed.');
    } catch (err) {
      setSettingsStatus(`DNS cache flush failed: ${err.message}`);
    } finally {
      setDnsCacheFlushBusy(false);
    }
  };

  const fetchRules = async (base = apiBase) => {
    const data = await fetchJson(`${base}/rules`);
    setRulesData({
      rules: Array.isArray(data?.rules) ? data.rules : [],
      balancers: Array.isArray(data?.balancers) ? data.balancers : [],
      updatedAt: data?.updatedAt || ''
    });
    return data;
  };

  const applyRoutingDraft = (draft, fallbackPath = '') => {
    const nextRules = Array.isArray(draft?.rules) ? draft.rules : [];
    const nextBalancers = Array.isArray(draft?.balancers) ? draft.balancers : [];
    const nextPath = draft?.path || fallbackPath || '';
    setConfigRules(nextRules);
    setConfigBalancers(nextBalancers);
    setConfigRulesPath(nextPath);
    setConfigRulesStatus(ROUTING_DRAFT_NOTICE);
  };

  const stageRoutingDraft = (nextRules, nextBalancers) => {
    saveRoutingDraft({
      rules: Array.isArray(nextRules) ? nextRules : [],
      balancers: Array.isArray(nextBalancers) ? nextBalancers : [],
      path: configRulesPath || ''
    });
    setConfigRulesStatus(ROUTING_DRAFT_NOTICE);
  };

  const loadRulesConfig = async (base = apiBase) => {
    setConfigRulesStatus('Loading config...');
    try {
      const resp = await fetchJson(`${base}/config/routing`);
      const routing = resp && typeof resp.routing === 'object' ? resp.routing : {};
      const rules = Array.isArray(routing.rules) ? routing.rules : [];
      const balancers = Array.isArray(routing.balancers) ? routing.balancers : [];
      const path = resp.path || '';
      const draft = getRoutingDraft();
      if (draft) {
        applyRoutingDraft(draft, path);
      } else {
        setConfigRules(rules);
        setConfigBalancers(balancers);
        setConfigRulesPath(path);
        if (resp.foundRouting === false) {
          setConfigRulesStatus('Routing section not found; saving will create it.');
        } else {
          setConfigRulesStatus('');
        }
      }
      return resp;
    } catch (err) {
      const draft = getRoutingDraft();
      if (draft) {
        applyRoutingDraft(draft, configRulesPath);
        setConfigRulesStatus(`${ROUTING_DRAFT_NOTICE} (Config load failed: ${err.message})`);
        return null;
      }
      setConfigRulesStatus(`Config load failed: ${err.message}`);
      throw err;
    }
  };

  const loadOutboundsConfig = async (base = apiBase) => {
    setConfigOutboundsStatus('Loading config...');
    try {
      const resp = await fetchJson(`${base}/config/outbounds`);
      const outbounds = Array.isArray(resp?.outbounds) ? resp.outbounds : [];
      setConfigOutbounds(outbounds);
      setConfigOutboundsPath(resp.path || '');
      if (resp.foundOutbounds === false) {
        setConfigOutboundsStatus('Outbounds section not found; saving will create it.');
      } else {
        setConfigOutboundsStatus('');
      }
      return resp;
    } catch (err) {
      setConfigOutboundsStatus(`Config load failed: ${err.message}`);
      throw err;
    }
  };

  const loadInboundsConfig = async (base = apiBase) => {
    setConfigInboundsStatus('Loading config...');
    try {
      const resp = await fetchJson(`${base}/config/inbounds`);
      const inbounds = Array.isArray(resp?.inbounds) ? resp.inbounds : [];
      setConfigInbounds(inbounds);
      setConfigInboundsPath(resp.path || '');
      if (resp.foundInbounds === false) {
        setConfigInboundsStatus('Inbounds section not found; saving will create it.');
      } else {
        setConfigInboundsStatus('');
      }
      return resp;
    } catch (err) {
      setConfigInboundsStatus(`Config load failed: ${err.message}`);
      throw err;
    }
  };

  const refresh = async (base = apiBase) => {
    setStatus('Refreshing...');
    try {
      const [conn, out] = await Promise.all([
        fetchJson(`${base}/connections`),
        fetchNodes(base),
        fetchDnsCacheStats(base, { silent: true }).catch(() => null)
      ]);
      setConnections(normalizeConnectionsPayload(conn));
      if (out && out.errors && Object.keys(out.errors).length > 0) {
        const message = Object.entries(out.errors)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | ');
        setStatus(`Nodes warning: ${message}`);
      } else {
        setStatus('Refreshed');
      }
    } catch (err) {
      setStatus(`Refresh failed: ${err.message}`);
    }
  };

  const loadSettings = async (base = apiBase) => {
    try {
      const resp = await fetchJson(`${base}/settings`);
      if (resp.path) {
        setSettingsPath(resp.path);
      }
      if (resp.startupInfo) {
        setStartupInfo(resp.startupInfo);
      } else {
        setStartupInfo({ available: false, detail: '' });
      }
      setSettingsStatus('');
    } catch (err) {
      setSettingsStatus(`Load failed: ${err.message}`);
    }
  };

  const loadRestartInfo = async (base = apiBase, taskId = '') => {
    try {
      const id = String(taskId || '').trim();
      const query = id ? `?id=${encodeURIComponent(id)}` : '';
      const resp = await fetchJson(`${base}/core/restart/status${query}`);
      const restart = resp?.restart || null;
      setRestartInfo(restart);
      return restart;
    } catch (_err) {
      // ignore restart status failures (e.g. older core without this endpoint)
      return null;
    }
  };

  const uploadRoutingDraft = async (base = apiBase) => {
    const draft = getRoutingDraft();
    if (!draft) return false;
    await fetchJson(`${base}/config/routing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing: {
          rules: Array.isArray(draft.rules) ? draft.rules : [],
          balancers: Array.isArray(draft.balancers) ? draft.balancers : []
        },
        path: draft.path || undefined
      })
    });
    saveRoutingDraft(null);
    setConfigRulesStatus('');
    return true;
  };

  return {
    fetchNodes,
    fetchDnsCacheStats,
    triggerDnsCacheFlushFromDashboard,
    triggerDnsCacheFlushFromSettings,
    fetchRules,
    stageRoutingDraft,
    loadRulesConfig,
    loadOutboundsConfig,
    loadInboundsConfig,
    refresh,
    loadSettings,
    loadRestartInfo,
    uploadRoutingDraft
  };
}
