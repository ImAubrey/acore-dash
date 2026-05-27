import {
  FIREWALL_DRAFT_NOTICE,
  ROUTING_DRAFT_NOTICE,
  getFirewallDraft,
  getRoutingDraft,
  saveFirewallDraft,
  saveRoutingDraft,
  fetchJson,
  normalizeFirewallConfig,
  normalizeConnectionsPayload,
  normalizeDnsCacheStats,
  DNS_CACHE_NETWORK_ERROR_REGEX
} from '../../dashboardShared';

export function useConfigDataLoaders({
  apiBase,
  configRulesPath,
  configFirewallPath,
  setOutbounds,
  setGroups,
  setStatusByTag,
  setConnections,
  setStatus,
  setRulesData,
  setConfigRules,
  configRulesBaseline,
  setConfigRulesBaseline,
  setHasRoutingDraft,
  setConfigBalancers,
  setConfigRulesStatus,
  setConfigRulesPath,
  setConfigFirewall,
  configFirewallBaseline,
  setConfigFirewallBaseline,
  setHasFirewallDraft,
  setConfigFirewallStatus,
  setConfigFirewallPath,
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

  const applyRoutingDraft = (draft, fallbackPath = '', fallbackRules = null) => {
    const nextRules = Array.isArray(draft?.rules) ? draft.rules : [];
    const nextBalancers = Array.isArray(draft?.balancers) ? draft.balancers : [];
    const nextBaseRules = Array.isArray(draft?.baseRules) && draft.baseRules.length > 0
      ? draft.baseRules
      : Array.isArray(fallbackRules)
        ? fallbackRules
        : configRulesBaseline;
    const nextPath = draft?.path || fallbackPath || '';
    setConfigRules(nextRules);
    setConfigRulesBaseline(Array.isArray(nextBaseRules) ? nextBaseRules : []);
    setConfigBalancers(nextBalancers);
    setConfigRulesPath(nextPath);
    setHasRoutingDraft(true);
    setConfigRulesStatus(ROUTING_DRAFT_NOTICE);
  };

  const stageRoutingDraft = (nextRules, nextBalancers) => {
    saveRoutingDraft({
      rules: Array.isArray(nextRules) ? nextRules : [],
      balancers: Array.isArray(nextBalancers) ? nextBalancers : [],
      baseRules: Array.isArray(configRulesBaseline) ? configRulesBaseline : [],
      path: configRulesPath || ''
    }, apiBase);
    setHasRoutingDraft(true);
    setConfigRulesStatus(ROUTING_DRAFT_NOTICE);
  };

  const applyFirewallDraft = (draft, fallbackPath = '', fallbackFirewall = null) => {
    const nextFirewall = normalizeFirewallConfig(draft?.firewall);
    const nextBaseFirewall = draft?.baseFirewall && Object.keys(draft.baseFirewall).length > 0
      ? normalizeFirewallConfig(draft.baseFirewall)
      : fallbackFirewall
        ? normalizeFirewallConfig(fallbackFirewall)
        : configFirewallBaseline;
    const nextPath = draft?.path || fallbackPath || '';
    setConfigFirewall(nextFirewall);
    setConfigFirewallBaseline(normalizeFirewallConfig(nextBaseFirewall));
    setConfigFirewallPath(nextPath);
    setHasFirewallDraft(true);
    setConfigFirewallStatus(FIREWALL_DRAFT_NOTICE);
  };

  const stageFirewallDraft = (nextFirewall) => {
    const normalized = normalizeFirewallConfig(nextFirewall);
    saveFirewallDraft({
      firewall: normalized,
      baseFirewall: normalizeFirewallConfig(configFirewallBaseline),
      path: configFirewallPath || ''
    }, apiBase);
    setHasFirewallDraft(true);
    setConfigFirewallStatus(FIREWALL_DRAFT_NOTICE);
  };

  const loadRulesConfig = async (base = apiBase) => {
    setConfigRulesStatus('Loading config...');
    try {
      const resp = await fetchJson(`${base}/config/routing`);
      const routing = resp && typeof resp.routing === 'object' ? resp.routing : {};
      const rules = Array.isArray(routing.rules) ? routing.rules : [];
      const balancers = Array.isArray(routing.balancers) ? routing.balancers : [];
      const path = resp.path || '';
      const draft = getRoutingDraft(base);
      if (draft) {
        applyRoutingDraft(draft, path, rules);
      } else {
        setConfigRules(rules);
        setConfigRulesBaseline(rules);
        setConfigBalancers(balancers);
        setConfigRulesPath(path);
        setHasRoutingDraft(false);
        if (resp.foundRouting === false) {
          setConfigRulesStatus('Routing section not found; saving will create it.');
        } else {
          setConfigRulesStatus('');
        }
      }
      return resp;
    } catch (err) {
      const draft = getRoutingDraft(base);
      if (draft) {
        applyRoutingDraft(draft, configRulesPath);
        setConfigRulesStatus(`${ROUTING_DRAFT_NOTICE} (Config load failed: ${err.message})`);
        return null;
      }
      setConfigRulesStatus(`Config load failed: ${err.message}`);
      throw err;
    }
  };

  const loadFirewallConfig = async (base = apiBase) => {
    setConfigFirewallStatus('Loading config...');
    try {
      const resp = await fetchJson(`${base}/config/firewall`);
      const firewall = normalizeFirewallConfig(resp?.firewall);
      const path = resp.path || '';
      const draft = getFirewallDraft(base);
      if (draft) {
        applyFirewallDraft(draft, path, firewall);
      } else {
        setConfigFirewall(firewall);
        setConfigFirewallBaseline(firewall);
        setConfigFirewallPath(path);
        setHasFirewallDraft(false);
        if (resp.foundFirewall === false) {
          setConfigFirewallStatus('Firewall section not found; saving will create it.');
        } else {
          setConfigFirewallStatus('');
        }
      }
      return resp;
    } catch (err) {
      const draft = getFirewallDraft(base);
      if (draft) {
        applyFirewallDraft(draft, configFirewallPath);
        setConfigFirewallStatus(`${FIREWALL_DRAFT_NOTICE} (Config load failed: ${err.message})`);
        return null;
      }
      setConfigFirewallStatus(`Config load failed: ${err.message}`);
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
    const draft = getRoutingDraft(base);
    if (!draft) return false;
    const nextRules = Array.isArray(draft.rules) ? draft.rules : [];
    const nextBalancers = Array.isArray(draft.balancers) ? draft.balancers : [];
    await fetchJson(`${base}/config/routing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing: {
          rules: nextRules,
          balancers: nextBalancers
        },
        path: draft.path || undefined
      })
    });
    saveRoutingDraft(null, base);
    setConfigRulesBaseline(nextRules);
    setHasRoutingDraft(false);
    setConfigRulesStatus('');
    return true;
  };

  const uploadFirewallDraft = async (base = apiBase) => {
    const draft = getFirewallDraft(base);
    if (!draft) return false;
    const firewall = normalizeFirewallConfig(draft.firewall);
    await fetchJson(`${base}/config/firewall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firewall,
        path: draft.path || undefined
      })
    });
    saveFirewallDraft(null, base);
    setConfigFirewall(firewall);
    setConfigFirewallBaseline(firewall);
    setHasFirewallDraft(false);
    setConfigFirewallStatus('');
    return true;
  };

  const discardRoutingDraft = async (base = apiBase) => {
    saveRoutingDraft(null, base);
    setHasRoutingDraft(false);
    try {
      await loadRulesConfig(base);
      setConfigRulesStatus('Discarded local routing edits.');
    } catch (err) {
      setConfigRulesStatus(`Discarded local edits. Config reload failed: ${err.message}`);
    }
  };

  const discardFirewallDraft = async (base = apiBase) => {
    saveFirewallDraft(null, base);
    setHasFirewallDraft(false);
    try {
      await loadFirewallConfig(base);
      setConfigFirewallStatus('Discarded local firewall edits.');
    } catch (err) {
      setConfigFirewallStatus(`Discarded local edits. Config reload failed: ${err.message}`);
    }
  };

  return {
    fetchNodes,
    fetchDnsCacheStats,
    triggerDnsCacheFlushFromDashboard,
    triggerDnsCacheFlushFromSettings,
    fetchRules,
    stageRoutingDraft,
    stageFirewallDraft,
    loadRulesConfig,
    loadFirewallConfig,
    loadOutboundsConfig,
    loadInboundsConfig,
    refresh,
    loadSettings,
    loadRestartInfo,
    uploadRoutingDraft,
    uploadFirewallDraft,
    discardRoutingDraft,
    discardFirewallDraft
  };
}
