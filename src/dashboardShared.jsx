import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || '';
const API_BASE_STORAGE_KEY = 'acore_ui_api_base';
const ACCESS_KEY_STORAGE_KEY = 'acore_ui_access_key';
const CONNECTION_REFRESH_STORAGE_KEY = 'acore_ui_connection_refresh';
const SERVER_STATES_STORAGE_KEY = 'acore_ui_server_states';
const METRICS_PANEL_HISTORY_COOKIE_KEY = 'acore_ui_metrics_panels';
const METRICS_PANEL_HISTORY_LIMIT = 12;
const ACCESS_KEY_HEADER = 'X-Access-Key';
const ACCESS_KEY_QUERY = 'access_key';
const ROUTING_DRAFT_STORAGE_KEY = 'acore_ui_routing_draft';
const FIREWALL_DRAFT_STORAGE_KEY = 'acore_ui_firewall_draft';
const ROUTING_DRAFT_NOTICE =
  'Unsaved rule edits are stored in your browser. Click Hot reload core to upload.';
const FIREWALL_DRAFT_NOTICE =
  'Unsaved firewall edits are stored in your browser. Click Hot reload core to upload.';
const UI_STATE_SAVE_DELAY_MS = 600;
const MODAL_ANIMATION_MS = 200;
const CONNECTION_REFRESH_OPTIONS = [1, 2, 5, 10];
const DEFAULT_CONNECTION_REFRESH = 1;
const TRAFFIC_DIRECTION_HINTS = {
  upload: 'User -> Acore',
  download: 'Acore -> User'
};
const ZEBRA_ROW_BACKGROUNDS = [
  'rgba(255, 255, 255, 0.78)',
  'rgba(28, 43, 42, 0.05)'
];
const ZEBRA_DETAIL_BACKGROUNDS = [
  'rgba(255, 255, 255, 0.48)',
  'rgba(28, 43, 42, 0.04)'
];

const parseRoutingDraft = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const rules = Array.isArray(parsed.rules) ? parsed.rules : null;
    const balancers = Array.isArray(parsed.balancers) ? parsed.balancers : null;
    if (!rules && !balancers) return null;
    return {
      rules: rules || [],
      balancers: balancers || [],
      baseRules: Array.isArray(parsed.baseRules) ? parsed.baseRules : [],
      path: typeof parsed.path === 'string' ? parsed.path : ''
    };
  } catch (_err) {
    return null;
  }
};

const ABSOLUTE_URL_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;
const RELATIVE_PATH_PREFIX_REGEX = /^(?:[./\\]|[a-zA-Z]:[\\/])/;

const normalizeApiBase = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return DEFAULT_API_BASE;
  if (value === '/') return '';
  const trimmed = value.replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '';
  if (ABSOLUTE_URL_SCHEME_REGEX.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `http:${trimmed}`;
  if (!RELATIVE_PATH_PREFIX_REGEX.test(trimmed)) {
    try {
      return new URL(`http://${trimmed}`).href.replace(/\/+$/, '');
    } catch (_err) {
      // fall through
    }
  }
  return trimmed;
};

const parseFirewallDraft = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const firewall = parsed.firewall && typeof parsed.firewall === 'object' && !Array.isArray(parsed.firewall)
      ? parsed.firewall
      : Array.isArray(parsed.rules)
        ? { rules: parsed.rules }
        : null;
    if (!firewall) return null;
    const baseFirewall = parsed.baseFirewall && typeof parsed.baseFirewall === 'object' && !Array.isArray(parsed.baseFirewall)
      ? parsed.baseFirewall
      : {};
    return {
      firewall,
      baseFirewall,
      path: typeof parsed.path === 'string' ? parsed.path : ''
    };
  } catch (_err) {
    return null;
  }
};

const getStoredApiBaseRaw = () => {
  if (typeof window === 'undefined') return DEFAULT_API_BASE;
  const stored = window.localStorage.getItem(API_BASE_STORAGE_KEY);
  return stored !== null ? stored : DEFAULT_API_BASE;
};

const normalizeStorageUrl = (value) => {
  const raw = String(value || '').trim();
  const fallbackOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'same-origin';
  if (!raw) return fallbackOrigin;
  try {
    return new URL(raw, fallbackOrigin).href.replace(/\/+$/, '');
  } catch (_err) {
    return raw.replace(/\/+$/, '') || fallbackOrigin;
  }
};

const getServerStorageId = (base) => {
  const source = base === undefined ? getStoredApiBaseRaw() : base;
  return normalizeStorageUrl(normalizeApiBase(source));
};

const getServerScopedStorageKey = (key, base) => {
  const prefix = String(key || '').trim();
  if (!prefix) return '';
  return `${prefix}::${encodeURIComponent(getServerStorageId(base))}`;
};

const parseServerStateMap = (raw) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_err) {
    return {};
  }
};

const readServerStateMap = () => {
  if (typeof window === 'undefined') return {};
  return parseServerStateMap(window.localStorage.getItem(SERVER_STATES_STORAGE_KEY));
};

const writeServerStateMap = (map) => {
  if (typeof window === 'undefined') return;
  const entries = Object.entries(map || {}).filter(([, value]) => {
    return value && typeof value === 'object' && Object.keys(value).length > 0;
  });
  if (entries.length === 0) {
    window.localStorage.removeItem(SERVER_STATES_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SERVER_STATES_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
};

const getServerState = (base) => {
  const map = readServerStateMap();
  const id = getServerStorageId(base);
  const state = map[id];
  return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
};

const targetMatchesLegacyServer = (target) => {
  if (target === undefined) return true;
  const targetId = getRequestStorageId(target);
  const legacyId = getServerStorageId(getStoredApiBaseRaw());
  return targetId === legacyId || targetId.startsWith(`${legacyId}/`) || targetId.startsWith(`${legacyId}?`);
};

const getLegacyAccessKey = (target) => {
  if (typeof window === 'undefined' || !targetMatchesLegacyServer(target)) return '';
  return normalizeAccessKey(window.localStorage.getItem(ACCESS_KEY_STORAGE_KEY));
};

const getLegacyRefreshInterval = (target) => {
  if (typeof window === 'undefined' || !targetMatchesLegacyServer(target)) return DEFAULT_CONNECTION_REFRESH;
  const stored = window.localStorage.getItem(CONNECTION_REFRESH_STORAGE_KEY);
  if (stored !== null) return normalizeRefreshInterval(stored);
  return DEFAULT_CONNECTION_REFRESH;
};

const updateServerState = (base, patch) => {
  if (typeof window === 'undefined') return {};
  const map = readServerStateMap();
  const id = getServerStorageId(base);
  const current = map[id] && typeof map[id] === 'object' && !Array.isArray(map[id]) ? map[id] : {};
  const next = { ...current, ...(patch || {}) };
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined || next[key] === null || next[key] === '') {
      delete next[key];
    }
  });
  if (Object.keys(next).length > 0) {
    map[id] = next;
  } else {
    delete map[id];
  }
  writeServerStateMap(map);
  return next;
};

const getStoredServerAccessKey = (base) => {
  const state = getServerState(base);
  if (typeof state.accessKey === 'string') return normalizeAccessKey(state.accessKey);
  return getLegacyAccessKey(base);
};

const setStoredServerAccessKey = (base, value) => {
  const key = normalizeAccessKey(value);
  updateServerState(base, { accessKey: key || undefined });
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ACCESS_KEY_STORAGE_KEY);
  }
  return key;
};

const getStoredServerRefreshInterval = (base) => {
  const state = getServerState(base);
  if (state.connRefreshInterval !== undefined) {
    return normalizeRefreshInterval(state.connRefreshInterval);
  }
  return getLegacyRefreshInterval(base);
};

const setStoredServerRefreshInterval = (base, value) => {
  const normalized = normalizeRefreshInterval(value);
  updateServerState(base, { connRefreshInterval: normalized });
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(CONNECTION_REFRESH_STORAGE_KEY);
  }
  return normalized;
};

const getRoutingDraft = (base) => {
  if (typeof window === 'undefined') return null;
  const scopedKey = getServerScopedStorageKey(ROUTING_DRAFT_STORAGE_KEY, base);
  const scoped = scopedKey ? window.localStorage.getItem(scopedKey) : null;
  if (scoped !== null) return parseRoutingDraft(scoped);
  if (base !== undefined) return null;
  return parseRoutingDraft(window.localStorage.getItem(ROUTING_DRAFT_STORAGE_KEY));
};

const saveRoutingDraft = (draft, base) => {
  if (typeof window === 'undefined') return;
  const scopedKey = getServerScopedStorageKey(ROUTING_DRAFT_STORAGE_KEY, base);
  if (!scopedKey) return;
  if (!draft) {
    window.localStorage.removeItem(scopedKey);
    window.localStorage.removeItem(ROUTING_DRAFT_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(scopedKey, JSON.stringify(draft));
  window.localStorage.removeItem(ROUTING_DRAFT_STORAGE_KEY);
};

const getFirewallDraft = (base) => {
  if (typeof window === 'undefined') return null;
  const scopedKey = getServerScopedStorageKey(FIREWALL_DRAFT_STORAGE_KEY, base);
  const scoped = scopedKey ? window.localStorage.getItem(scopedKey) : null;
  if (scoped !== null) return parseFirewallDraft(scoped);
  if (base !== undefined) return null;
  return parseFirewallDraft(window.localStorage.getItem(FIREWALL_DRAFT_STORAGE_KEY));
};

const saveFirewallDraft = (draft, base) => {
  if (typeof window === 'undefined') return;
  const scopedKey = getServerScopedStorageKey(FIREWALL_DRAFT_STORAGE_KEY, base);
  if (!scopedKey) return;
  if (!draft) {
    window.localStorage.removeItem(scopedKey);
    window.localStorage.removeItem(FIREWALL_DRAFT_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(scopedKey, JSON.stringify(draft));
  window.localStorage.removeItem(FIREWALL_DRAFT_STORAGE_KEY);
};

const getInitialMetricsHttp = () => {
  return normalizeApiBase(getStoredApiBaseRaw());
};

const normalizeAccessKey = (raw) => String(raw || '').trim();

const getInitialMetricsKey = () => {
  return getStoredServerAccessKey();
};

const getInitialAccessKey = () => {
  return getStoredServerAccessKey();
};

const getInitialApiBase = () => {
  return normalizeApiBase(getStoredApiBaseRaw());
};

const normalizeRefreshInterval = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_CONNECTION_REFRESH;
  const rounded = Math.trunc(num);
  if (CONNECTION_REFRESH_OPTIONS.includes(rounded)) return rounded;
  return DEFAULT_CONNECTION_REFRESH;
};

const getMetricsPanelId = (base) => {
  const normalizedBase = normalizeApiBase(base);
  if (!normalizedBase) return '';
  return normalizedBase;
};

const formatMetricsPanelOptionLabel = (entry) => {
  const base = normalizeApiBase(entry?.base || entry?.apiBase || '');
  const key = normalizeAccessKey(entry?.key || entry?.accessKey || '');
  const refresh = normalizeRefreshInterval(
    entry?.connRefreshInterval
    ?? entry?.connRefresh
    ?? entry?.refreshInterval
    ?? entry?.refresh
  );
  if (!base) return '';
  return `${base} | ${refresh}s | ${key ? 'key:on' : 'key:empty'}`;
};

const getInitialRefreshInterval = () => {
  return getStoredServerRefreshInterval();
};

const getRequestStorageId = (url) => {
  const requestUrl = String(url || '').trim();
  if (!requestUrl) return '';
  return normalizeStorageUrl(requestUrl);
};

const findServerStateForRequest = (url) => {
  const requestId = getRequestStorageId(url);
  if (!requestId) return {};
  const entries = Object.entries(readServerStateMap())
    .filter(([, state]) => state && typeof state === 'object' && !Array.isArray(state))
    .sort(([a], [b]) => b.length - a.length);
  const match = entries.find(([id]) => {
    return requestId === id || requestId.startsWith(`${id}/`) || requestId.startsWith(`${id}?`);
  });
  return match ? match[1] : {};
};

const getStoredAccessKey = (baseOrUrl) => {
  if (baseOrUrl !== undefined) {
    const state = findServerStateForRequest(baseOrUrl);
    if (typeof state.accessKey === 'string') {
      return normalizeAccessKey(state.accessKey);
    }
    return getStoredServerAccessKey(baseOrUrl);
  }
  return getStoredServerAccessKey();
};

const withAccessKey = (options = {}, url = '') => {
  const { accessKey: explicitAccessKey, ...fetchOptions } = options || {};
  const key = explicitAccessKey !== undefined
    ? normalizeAccessKey(explicitAccessKey)
    : getStoredAccessKey(url);
  if (!key) return fetchOptions;
  const headers = { ...(fetchOptions.headers || {}), [ACCESS_KEY_HEADER]: key };
  return { ...fetchOptions, headers };
};

const appendAccessKeyParam = (url, key) => {
  if (!key) return url;
  if (/(?:^|[?&])access_key=/.test(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${ACCESS_KEY_QUERY}=${encodeURIComponent(key)}`;
};

const getSubscriptionUrlDisplay = (rawUrl) => {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  const readHostname = (candidate) => {
    try {
      const parsed = new URL(candidate);
      return String(parsed.hostname || '').trim();
    } catch (_err) {
      return '';
    }
  };

  const directHost = readHostname(value);
  if (directHost) return directHost;

  if (value.startsWith('//')) {
    const protocolRelativeHost = readHostname(`http:${value}`);
    if (protocolRelativeHost) return protocolRelativeHost;
  }

  if (!ABSOLUTE_URL_SCHEME_REGEX.test(value) && !RELATIVE_PATH_PREFIX_REGEX.test(value)) {
    const guessedHost = readHostname(`http://${value}`);
    if (guessedHost && guessedHost !== '.' && guessedHost !== '..') {
      return guessedHost;
    }
  }

  return value;
};

const normalizeUiLanguage = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  return raw.startsWith('zh') ? 'zh' : 'en';
};

const getInitialUiLanguage = () => {
  if (typeof window === 'undefined') return 'zh';
  const nav = window.navigator || {};
  if (Array.isArray(nav.languages) && nav.languages.length > 0) {
    return normalizeUiLanguage(nav.languages[0]);
  }
  return normalizeUiLanguage(nav.language || nav.userLanguage || '');
};

const I18N_MESSAGES = {
  zh: {
    subscriptionOneClick: '一键订阅',
    subscriptionUpdating: '更新中...',
    subscriptionUpdatingOutbounds: '正在更新出站订阅...',
    subscriptionUpdatingDatabases: '正在更新数据库订阅...'
  },
  en: {
    subscriptionOneClick: 'One-click subscribe',
    subscriptionUpdating: 'Updating...',
    subscriptionUpdatingOutbounds: 'Updating outbound subscriptions...',
    subscriptionUpdatingDatabases: 'Updating database subscriptions...'
  }
};

const getI18nText = (lang, key) => {
  const group = I18N_MESSAGES[normalizeUiLanguage(lang)] || I18N_MESSAGES.en;
  return group[key] || I18N_MESSAGES.en[key] || key;
};

const PAGES = {
  dashboard: {
    label: 'Dashboard',
    title: 'Operational heartbeat',
    description: 'Throughput, destinations, and outbound mix at a glance.'
  },
  connections: {
    label: 'Connections',
    title: 'Live connection intelligence',
    description: 'Grouped by source IP and destination host/IP with real-time traffic totals.'
  },
  nodes: {
    label: 'Nodes',
    title: 'Outbound steering',
    description: 'Clash-style policy groups with live outbound health.'
  },
  rules: {
    label: 'Rules',
    title: 'Routing rule browser',
    description: 'Inspect router rules and load balancer policies over HTTP.'
  },
  firewall: {
    label: 'Firewall',
    title: 'Firewall rule browser',
    description: 'Inspect and edit top-level firewall rules with routing-style match fields.'
  },
  subscriptions: {
    label: 'Subscriptions',
    title: 'Subscription updates',
    description: 'Edit the subscription block and schedule outbound/database refresh.'
  },
  inbounds: {
    label: 'Inbounds',
    title: 'Inbound configuration',
    description: 'Edit the top-level inbounds list and persist it to config.'
  },
  logs: {
    label: 'Logs',
    title: 'Streaming logs',
    description: 'Tail Acore logs from the configured log file.'
  },
  settings: {
    label: 'Settings',
    title: 'Acore control plane',
    description: 'Configure metrics entry point and control actions.'
  }
};

const getPageFromHash = () => {
  if (typeof window === 'undefined') return 'connections';
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (
    raw === 'dashboard'
    || raw === 'nodes'
    || raw === 'subscriptions'
    || raw === 'inbounds'
    || raw === 'rules'
    || raw === 'firewall'
    || raw === 'logs'
    || raw === 'connections'
    || raw === 'settings'
  ) {
    return raw;
  }
  return 'connections';
};

const formatBytes = (num) => {
  if (!num || num <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = num;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)} ${units[i]}`;
};

const formatRate = (num) => `${formatBytes(num)}/s`;
const SPLICE_LABEL = 'splice';
const SPLICE_DISPLAY_LABEL = 'SPLICE';
const isSpliceType = (value) => typeof value === 'string' && value.toLowerCase().includes('splice');
const formatRateOrSplice = (value, isSplice, hasRateSample = false) => {
  const rate = Number(value || 0);
  if (isSplice && !hasRateSample && (!rate || rate <= 0)) return SPLICE_DISPLAY_LABEL;
  return formatRate(rate);
};
const getRuntimeRate = (value, fallback = 0) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? rate : fallback;
};
const getOptionalRuntimeRate = (value) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
};
const getInlineRatePair = (value) => {
  if (!value || typeof value !== 'object') return null;
  const upload = getOptionalRuntimeRate(value.uploadRate);
  const download = getOptionalRuntimeRate(value.downloadRate);
  if (upload === null && download === null) return null;
  return {
    upload: upload || 0,
    download: download || 0
  };
};
const getResolvedRatePair = (...candidates) => {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const upload = getOptionalRuntimeRate(candidate.upload);
    const download = getOptionalRuntimeRate(candidate.download);
    if (upload === null && download === null) continue;
    return {
      upload: upload || 0,
      download: download || 0,
      resolved: true
    };
  }
  return { upload: 0, download: 0, resolved: false };
};

const formatDelay = (value) => {
  const num = Number(value || 0);
  if (!num || Number.isNaN(num)) return '-';
  return `${Math.round(num)} ms`;
};

const formatTime = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
};

const formatJson = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch (_err) {
    return String(value || '');
  }
};

const formatJsonText = (text) => {
  const parsed = JSON.parse(String(text ?? ''));
  return formatJson(parsed);
};

const FAILED_STATUS_TEXT_REGEX = /\b(failed|error)\b/i;
const isFailedStatusText = (value) => FAILED_STATUS_TEXT_REGEX.test(String(value || ''));
const normalizeBalancerStrategy = (value) => String(value || '').trim().toLowerCase();
const getBalancerStrategyTone = (balancer, selectors = []) => {
  const strategy = normalizeBalancerStrategy(balancer?.strategy);
  if (strategy.includes('fallback')) return 'fallback';
  if (strategy.includes('selector')) return 'selector';
  if (strategy.includes('least')) return 'least';
  if (strategy.includes('random')) return 'random';
  if (strategy.includes('round')) return 'round';
  if (strategy) return 'custom';
  if (String(balancer?.fallbackTag || '').trim()) return 'fallback';
  if (Array.isArray(selectors) && selectors.length > 0) return 'selector';
  return 'default';
};

const clearTimeoutRef = (ref) => {
  if (!ref.current) return;
  window.clearTimeout(ref.current);
  ref.current = null;
};

const clearIntervalRef = (ref) => {
  if (!ref.current) return;
  window.clearInterval(ref.current);
  ref.current = null;
};

const scheduleModalClose = (timerRef, setOpen, setVisible, setClosing) => {
  setClosing(true);
  clearTimeoutRef(timerRef);
  timerRef.current = window.setTimeout(() => {
    setOpen(false);
    setVisible(false);
    setClosing(false);
    timerRef.current = null;
  }, MODAL_ANIMATION_MS);
};

const startCooldown = (seconds, setCooldown, intervalRef) => {
  setCooldown(seconds);
  clearIntervalRef(intervalRef);
  intervalRef.current = window.setInterval(() => {
    setCooldown((prev) => {
      if (prev <= 1) {
        clearIntervalRef(intervalRef);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
};

const RULE_TEMPLATE = {
  domain: ['baidu.com', 'qq.com', 'geosite:cn'],
  ip: ['0.0.0.0/8', '10.0.0.0/8', 'fc00::/7', 'fe80::/10', 'geoip:cn'],
  port: '53,443,1000-2000',
  sourcePort: '53,443,1000-2000',
  localPort: '53,443,1000-2000',
  network: 'tcp',
  sourceIP: ['10.0.0.1'],
  localIP: ['192.168.0.25'],
  user: ['love@acore.com'],
  vlessRoute: '53,443,1000-2000',
  inboundTag: ['tag-vmess'],
  protocol: ['http', 'tls', 'quic', 'bittorrent'],
  attrs: { ':method': 'GET' },
  process: ['curl'],
  destination: 'direct',
  ruleTag: 'rule name'
};

const BALANCER_TEMPLATE = {
  tag: 'balancer',
  selector: ['outbound-a', 'outbound-b'],
  fallbackTag: ''
};

const OUTBOUND_TEMPLATE = {
  tag: 'outbound',
  protocol: 'freedom',
  settings: {}
};

const INBOUND_TEMPLATE = {
  tag: 'inbound',
  protocol: 'socks',
  listen: '127.0.0.1',
  port: 1080,
  settings: {}
};

const FIREWALL_RULE_TEMPLATE = {
  domain: ['example.com'],
  inboundTag: ['socks-in'],
  protocol: ['http'],
  ruleTag: 'fw-rule',
  action: 'block'
};

const MAIN_EDITOR_ALLOWED_KEYS = ['Observatory', 'log', 'metrics', 'stats'];

const SUBSCRIPTION_OUTBOUND_TEMPLATE = {
  name: '',
  url: '',
  format: 'auto',
  tagPrefix: '',
  insert: 'tail',
  interval: '',
  cron: '',
  enabled: true
};

const SUBSCRIPTION_DATABASE_TEMPLATE = {
  type: 'geoip',
  url: '',
  interval: '',
  cron: '',
  enabled: true
};

const EMPTY_DNS_CACHE_STATS = Object.freeze({
  available: false,
  error: '',
  usageBytes: 0,
  limitBytes: 0,
  entryCount: 0,
  validCount: 0,
  expiredCount: 0,
  usageRatio: 0,
  validRatio: 0,
  expiredRatio: 0,
  updatedAt: '',
  stores: []
});

const normalizeRatioValue = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(Math.max(num, 0), 1);
};

const normalizeCountValue = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.trunc(num);
};

const normalizeDnsCacheStats = (payload) => {
  const source = isPlainObject(payload) ? payload : {};
  const stores = Array.isArray(source.stores)
    ? source.stores
      .filter((item) => isPlainObject(item))
      .map((item) => ({
        name: String(item.name || '').trim(),
        type: String(item.type || '').trim(),
        usageBytes: normalizeCountValue(item.usageBytes),
        limitBytes: normalizeCountValue(item.limitBytes),
        entryCount: normalizeCountValue(item.entryCount),
        validCount: normalizeCountValue(item.validCount),
        expiredCount: normalizeCountValue(item.expiredCount),
        usageRatio: normalizeRatioValue(item.usageRatio),
        validRatio: normalizeRatioValue(item.validRatio),
        expiredRatio: normalizeRatioValue(item.expiredRatio)
      }))
    : [];
  return {
    available: !!source.available,
    error: String(source.error || '').trim(),
    usageBytes: normalizeCountValue(source.usageBytes),
    limitBytes: normalizeCountValue(source.limitBytes),
    entryCount: normalizeCountValue(source.entryCount),
    validCount: normalizeCountValue(source.validCount),
    expiredCount: normalizeCountValue(source.expiredCount),
    usageRatio: normalizeRatioValue(source.usageRatio),
    validRatio: normalizeRatioValue(source.validRatio),
    expiredRatio: normalizeRatioValue(source.expiredRatio),
    updatedAt: String(source.updatedAt || '').trim(),
    stores
  };
};

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const CONNECTION_ACTIVITY_SCALE = 256 * 1024;
const DETAIL_ACTIVITY_SCALE = 64 * 1024;
const CONNECTION_COUNT_ACTIVITY_SCALE = 24;

const getRateActivity = (rate, scale, connectionCount = 0, countScale = CONNECTION_COUNT_ACTIVITY_SCALE) => {
  const upload = Number(rate?.upload || 0);
  const download = Number(rate?.download || 0);
  const total = Math.max(0, upload) + Math.max(0, download);
  const trafficActivity = total > 0 && scale > 0
    ? clamp(Math.sqrt(total / scale), 0, 1)
    : 0;
  const count = Number(connectionCount || 0);
  const countActivity = count > 1 && countScale > 0
    ? clamp(Math.sqrt((count - 1) / countScale), 0, 1)
    : 0;
  return Math.max(trafficActivity, countActivity);
};

const buildPoints = (values, width, height, padding = 12) => {
  if (!values || values.length === 0) return [];
  const maxValue = Math.max(...values, 1);
  const span = width - padding * 2;
  const step = values.length > 1 ? span / (values.length - 1) : 0;
  return values.map((value, index) => {
    const ratio = maxValue ? value / maxValue : 0;
    const x = padding + step * index;
    const y = height - padding - ratio * (height - padding * 2);
    return { x, y };
  });
};

const buildLinePath = (points) => {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

const buildAreaPath = (points, height, padding = 12) => {
  if (!points.length) return '';
  const baseY = height - padding;
  const first = points[0];
  const last = points[points.length - 1];
  return `${buildLinePath(points)} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
};

const truncateLabel = (value, max = 16) => {
  const text = String(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
};

const buildConicGradient = (items, colors, options = {}) => {
  const {
    startDeg = -90,
    sweepDeg = 360,
    emptyColor = 'rgba(28, 43, 42, 0.12)'
  } = options || {};

  const total = items.reduce((sum, item) => sum + item.value, 0);
  const limitedSweep = Math.min(360, Math.max(0, sweepDeg));

  if (!total) {
    if (limitedSweep >= 360) {
      return `conic-gradient(from ${startDeg}deg, ${emptyColor} 0deg 360deg)`;
    }
    return `conic-gradient(from ${startDeg}deg, ${emptyColor} 0deg ${limitedSweep}deg, transparent ${limitedSweep}deg 360deg)`;
  }

  let current = 0;
  const segments = items.map((item, index) => {
    const span = (item.value / total) * limitedSweep;
    const start = current;
    const end = current + span;
    current = end;
    return `${colors[index % colors.length]} ${start}deg ${end}deg`;
  });

  if (current < limitedSweep) {
    segments.push(`${emptyColor} ${current}deg ${limitedSweep}deg`);
  }
  if (limitedSweep < 360) {
    segments.push(`transparent ${limitedSweep}deg 360deg`);
  }

  return `conic-gradient(from ${startDeg}deg, ${segments.join(', ')})`;
};

const readCookie = (name) => {
  if (typeof document === 'undefined') return '';
  const cookieName = `${String(name || '').trim()}=`;
  if (!cookieName) return '';
  const parts = String(document.cookie || '').split(';');
  for (const part of parts) {
    const text = String(part || '').trim();
    if (!text.startsWith(cookieName)) continue;
    return text.slice(cookieName.length);
  }
  return '';
};

const writeCookie = (name, value, days = 365) => {
  if (typeof document === 'undefined') return;
  const key = String(name || '').trim();
  if (!key) return;
  const expires = new Date(Date.now() + Math.max(1, Number(days) || 1) * 86400000).toUTCString();
  document.cookie = `${key}=${value}; expires=${expires}; path=/; SameSite=Lax`;
};

const deleteCookie = (name) => {
  if (typeof document === 'undefined') return;
  const key = String(name || '').trim();
  if (!key) return;
  document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
};

const normalizeMetricsPanelEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const rawBase = String(entry.base || entry.apiBase || '').trim();
  const rawKey = normalizeAccessKey(entry.key || entry.accessKey || '');
  const connRefreshInterval = normalizeRefreshInterval(
    entry.connRefreshInterval
    ?? entry.connRefresh
    ?? entry.refreshInterval
    ?? entry.refresh
  );
  const base = normalizeApiBase(rawBase);
  if (!base) return null;
  const id = getMetricsPanelId(base);
  return { id, base, key: rawKey, connRefreshInterval };
};

const parseMetricsPanelHistory = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return [];
  try {
    const decoded = decodeURIComponent(text);
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const out = [];
    parsed.forEach((item) => {
      const normalized = normalizeMetricsPanelEntry(item);
      if (!normalized || seen.has(normalized.id)) return;
      seen.add(normalized.id);
      out.push(normalized);
    });
    return out;
  } catch (_err) {
    return [];
  }
};

const getInitialMetricsPanelHistory = () => {
  const raw = readCookie(METRICS_PANEL_HISTORY_COOKIE_KEY);
  return parseMetricsPanelHistory(raw);
};

const saveMetricsPanelHistory = (items) => {
  const list = Array.isArray(items) ? items : [];
  const normalized = [];
  const seen = new Set();
  list.forEach((item) => {
    const entry = normalizeMetricsPanelEntry(item);
    if (!entry || seen.has(entry.id)) return;
    seen.add(entry.id);
    normalized.push(entry);
  });
  if (normalized.length === 0) {
    deleteCookie(METRICS_PANEL_HISTORY_COOKIE_KEY);
    return [];
  }
  const payload = encodeURIComponent(JSON.stringify(normalized));
  writeCookie(METRICS_PANEL_HISTORY_COOKIE_KEY, payload);
  return normalized;
};

const addMetricsPanelHistoryEntry = (
  items,
  base,
  key,
  connRefreshInterval,
  limit = METRICS_PANEL_HISTORY_LIMIT
) => {
  const entry = normalizeMetricsPanelEntry({ base, key, connRefreshInterval });
  if (!entry) return Array.isArray(items) ? items : [];
  const list = Array.isArray(items) ? items : [];
  const next = [];
  const seen = new Set();
  let replaced = false;
  list.forEach((item) => {
    const normalized = normalizeMetricsPanelEntry(item);
    if (!normalized) return;
    if (normalized.id === entry.id) {
      if (!replaced) {
        next.push(entry);
        seen.add(entry.id);
        replaced = true;
      }
      return;
    }
    if (seen.has(normalized.id)) return;
    seen.add(normalized.id);
    next.push(normalized);
  });
  if (!replaced) {
    next.unshift(entry);
  }
  const max = Math.max(1, Math.trunc(Number(limit) || METRICS_PANEL_HISTORY_LIMIT));
  return next.slice(0, max);
};

const removeMetricsPanelHistoryEntry = (items, id) => {
  const target = String(id || '').trim();
  if (!target) return Array.isArray(items) ? items : [];
  return (Array.isArray(items) ? items : []).filter((item) => String(item?.id || '').trim() !== target);
};

const CHART_COLORS = ['#ff6b4a', '#2f9aa0', '#f2b354', '#3b73d4', '#7cc57a', '#cf8450'];
const DASHBOARD_CACHE_WINDOW_MS = 30 * 1000;
const TRAFFIC_MIN_SAMPLE_INTERVAL_MS = 200;
const TRAFFIC_MAX_SAMPLES = Math.ceil(DASHBOARD_CACHE_WINDOW_MS / TRAFFIC_MIN_SAMPLE_INTERVAL_MS) + 2;
const TRAFFIC_ANIMATION_MS = 1000;
const TRAFFIC_GRID_LINES = [40, 100, 160];
const TRAFFIC_CLIP_ID = 'traffic-clip';
const DNS_CACHE_NETWORK_ERROR_REGEX = /\b(failed to fetch|network ?error|network request failed|load failed)\b/i;

const parseTimestamp = (value) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getConnectionStats = (payload) => {
  const list = Array.isArray(payload?.connections) ? payload.connections : [];
  const totalSessions = list.reduce((sum, conn) => {
    const raw = Number(conn?.connectionCount);
    const count = Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1;
    return sum + count;
  }, 0);
  return {
    connections: list,
    totalSessions,
    totalConnections: list.length
  };
};

const normalizeConnectionsPayload = (payload) => {
  const source = payload && typeof payload === 'object' ? payload : {};
  const uploadRaw = Number(source.uploadTotal);
  const downloadRaw = Number(source.downloadTotal);
  const uploadRate = getOptionalRuntimeRate(source.uploadRate);
  const downloadRate = getOptionalRuntimeRate(source.downloadRate);
  return {
    uploadTotal: Number.isFinite(uploadRaw) ? uploadRaw : 0,
    downloadTotal: Number.isFinite(downloadRaw) ? downloadRaw : 0,
    uploadRate: uploadRate === null ? 0 : uploadRate,
    downloadRate: downloadRate === null ? 0 : downloadRate,
    rateSampledAt: source.rateSampledAt || '',
    hasRuntimeRates: Boolean(source.rateSampledAt || uploadRate !== null || downloadRate !== null || source.hasRuntimeRates),
    connections: Array.isArray(source.connections) ? source.connections : []
  };
};

const CONNECTION_PAYLOAD_CANDIDATE_KEYS = ['data', 'payload', 'result', 'snapshot', 'body'];
const extractConnectionsPayload = (value, depth = 0) => {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value.connections)) {
    return normalizeConnectionsPayload(value);
  }
  if (depth >= 2) return null;
  for (const key of CONNECTION_PAYLOAD_CANDIDATE_KEYS) {
    const nested = extractConnectionsPayload(value[key], depth + 1);
    if (nested) return nested;
  }
  return null;
};

const parseConnectionsPayload = (raw) => {
  let value = raw;
  for (let i = 0; i < 2; i += 1) {
    if (typeof value !== 'string') break;
    const text = value.trim();
    if (!text) return null;
    try {
      value = JSON.parse(text);
    } catch (_err) {
      return null;
    }
  }
  return extractConnectionsPayload(value, 0);
};

const collectSearchTokens = (value, out, seen) => {
  if (value === null || value === undefined) return;
  const valueType = typeof value;
  if (
    valueType === 'string'
    || valueType === 'number'
    || valueType === 'boolean'
    || valueType === 'bigint'
  ) {
    out.push(String(value));
    return;
  }
  if (valueType !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchTokens(item, out, seen));
    return;
  }
  Object.values(value).forEach((item) => collectSearchTokens(item, out, seen));
};

const SEARCH_TEXT_CACHE = new WeakMap();
const toSearchText = (value) => {
  if (value && typeof value === 'object') {
    const cached = SEARCH_TEXT_CACHE.get(value);
    if (typeof cached === 'string') {
      return cached;
    }
    const tokens = [];
    collectSearchTokens(value, tokens, new WeakSet());
    const joined = tokens.join(' ');
    SEARCH_TEXT_CACHE.set(value, joined);
    return joined;
  }
  const tokens = [];
  collectSearchTokens(value, tokens, new WeakSet());
  return tokens.join(' ');
};

const hasRuleReLookup = (rule) => {
  if (!rule || typeof rule !== 'object') return false;
  return rule.reLookup === true;
};

const toRuleSearchText = (rule) => {
  const base = toSearchText(rule);
  return hasRuleReLookup(rule) ? `${base} reLookup` : base;
};

const normalizeFirewallRule = (rule) => {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return {};
  }
  const match = rule.match && typeof rule.match === 'object' && !Array.isArray(rule.match)
    ? rule.match
    : null;
  const normalized = match ? { ...match, ...rule } : { ...rule };
  delete normalized.match;
  return normalized;
};

const getFirewallRuleList = (firewall) => {
  const source = firewall && typeof firewall === 'object' && !Array.isArray(firewall)
    ? firewall
    : {};
  const rules = Array.isArray(source.rules)
    ? source.rules
    : Array.isArray(source.rule)
      ? source.rule
      : [];
  return rules.map((rule) => normalizeFirewallRule(rule));
};

const normalizeFirewallConfig = (firewall) => {
  const normalized = firewall && typeof firewall === 'object' && !Array.isArray(firewall)
    ? { ...firewall }
    : {};
  normalized.rules = getFirewallRuleList(normalized);
  delete normalized.rule;
  delete normalized.domain_strategy;
  delete normalized.domainStrategy;
  return normalized;
};

const FIREWALL_ACTION_LABELS = {
  0: 'mark',
  1: 'allow',
  2: 'block',
  3: 'limit',
  4: 'speed',
  mark: 'mark',
  allow: 'allow',
  block: 'block',
  limit: 'limit',
  speed: 'speed'
};
const FIREWALL_ACTION_TONES = new Set(['mark', 'allow', 'block', 'limit', 'speed']);
const FIREWALL_LIMIT_KEY_LABELS = {
  0: 'srcIp',
  1: 'dstIp',
  2: 'srcDstIp',
  3: 'srcPrefix',
  4: 'dstPrefix',
  srcip: 'srcIp',
  sourceip: 'srcIp',
  source_ip: 'srcIp',
  dstip: 'dstIp',
  destinationip: 'dstIp',
  destination_ip: 'dstIp',
  srcdstip: 'srcDstIp',
  sourcedestinationip: 'srcDstIp',
  source_destination_ip: 'srcDstIp',
  'src-dst-ip': 'srcDstIp',
  srcprefix: 'srcPrefix',
  sourceprefix: 'srcPrefix',
  source_prefix: 'srcPrefix',
  'src-prefix': 'srcPrefix',
  dstprefix: 'dstPrefix',
  destinationprefix: 'dstPrefix',
  destination_prefix: 'dstPrefix',
  'dst-prefix': 'dstPrefix'
};
const FIREWALL_LIMIT_MODE_LABELS = {
  0: 'activeConnections',
  1: 'newConnections',
  active: 'activeConnections',
  activeconnections: 'activeConnections',
  active_connections: 'activeConnections',
  new: 'newConnections',
  newconnections: 'newConnections',
  new_connections: 'newConnections'
};

const resolveFirewallAction = (value) => {
  const raw = typeof value === 'string' ? value.trim() : value;
  const key = typeof raw === 'string' ? raw.toLowerCase() : raw;
  const label = FIREWALL_ACTION_LABELS[key] || String(raw || 'allow').trim().toLowerCase() || 'allow';
  const tone = FIREWALL_ACTION_TONES.has(label) ? label : 'allow';
  return { label, tone };
};

const getFirewallRuleAction = (rule) => {
  const current = normalizeFirewallRule(rule);
  const rawAction = current.action;
  const hasExplicitAction = rawAction !== undefined
    && rawAction !== null
    && String(rawAction).trim() !== '';
  return resolveFirewallAction(
    hasExplicitAction
      ? rawAction
      : String(current.ruleTag || '').trim()
        ? 'mark'
        : 'allow'
  );
};

const getFirewallLimitDetail = (rule) => {
  const current = normalizeFirewallRule(rule);
  const limit = current.limit && typeof current.limit === 'object' && !Array.isArray(current.limit)
    ? current.limit
    : null;
  if (!limit) return '';

  const rawKey = limit.key ?? limit.countBy;
  const keyToken = typeof rawKey === 'string' ? rawKey.trim().toLowerCase() : rawKey;
  const key = FIREWALL_LIMIT_KEY_LABELS[keyToken] || String(rawKey ?? '').trim() || 'key?';

  const rawMax = limit.maxConnections ?? limit.max_connections ?? limit.max;
  const max = rawMax === null || rawMax === undefined || rawMax === ''
    ? 'max?'
    : String(rawMax).trim();

  const rawMode = limit.mode;
  const modeToken = typeof rawMode === 'string' ? rawMode.trim().toLowerCase() : rawMode;
  const mode = FIREWALL_LIMIT_MODE_LABELS[modeToken] || String(rawMode ?? '').trim() || 'activeConnections';

  return `${key}:${max}:${mode}`;
};

const getFirewallRuleTitle = (rule, index, options = {}) => {
  const current = normalizeFirewallRule(rule);
  const ruleTag = String(current.ruleTag || '').trim();
  if (ruleTag) return ruleTag;

  const domain = Array.isArray(current.domain) ? String(current.domain[0] || '').trim() : '';
  if (domain) return domain;

  const inboundTag = Array.isArray(current.inboundTag) ? String(current.inboundTag[0] || '').trim() : '';
  if (inboundTag) return inboundTag;

  const numericIndex = Number(index);
  const fallback = options.numberedFallback === false || !Number.isFinite(numericIndex)
    ? 'firewall rule'
    : `firewall rule ${numericIndex + 1}`;
  return fallback;
};

const highlightSearchText = (value, queryLower) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (!text || !queryLower) return text;
  const haystack = text.toLowerCase();
  let matchIndex = haystack.indexOf(queryLower);
  if (matchIndex < 0) return text;
  const parts = [];
  let cursor = 0;
  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      parts.push(text.slice(cursor, matchIndex));
    }
    const end = matchIndex + queryLower.length;
    parts.push(
      <mark className="search-hit" key={`${matchIndex}-${end}-${parts.length}`}>
        {text.slice(matchIndex, end)}
      </mark>
    );
    cursor = end;
    matchIndex = haystack.indexOf(queryLower, cursor);
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return <>{parts}</>;
};

const getDestinationLabel = (meta, fallback = 'unknown') => meta?.host || meta?.destinationIP || fallback;
const getSourceLabel = (meta, fallback = '0.0.0.0') => meta?.sourceIP || fallback;
const getDetailDestinationLabel = (detail) => getDestinationLabel(detail?.metadata, 'unknown');
const getDetailSourceLabel = (detail) => getSourceLabel(detail?.metadata, '0.0.0.0');
const getDetailAcoreSrcLabel = (detail) => detail?.metadata?.acoreSrcIP || '-';
const JA4_DB_REF_PREFIX = 'acore.internal.ja4db:';
const normalizeJa4Text = (value) => {
  const text = String(value || '').trim();
  if (!text || text === '-') return '';
  return text;
};
const normalizeUniqueJa4Label = (value) => {
  const text = normalizeJa4Text(value);
  if (!text) return '';
  return text.toLowerCase();
};
const pickJa4Text = (obj, keys) => {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    const text = normalizeJa4Text(obj?.[key]);
    if (text) return text;
  }
  return '';
};
const parseJa4DbRef = (value) => {
  const text = normalizeJa4Text(value);
  if (!text) return null;
  const prefix = JA4_DB_REF_PREFIX;
  if (!text.toLowerCase().startsWith(prefix)) return null;
  const body = text.slice(prefix.length).trim();
  if (!body) return { dbRef: text };
  const sep = body.indexOf(':');
  if (sep <= 0 || sep >= body.length - 1) {
    return { dbRef: text };
  }
  const dbFile = normalizeJa4Text(body.slice(0, sep));
  const dbTag = normalizeJa4Text(body.slice(sep + 1));
  const out = { dbRef: text };
  if (dbFile) out.dbFile = dbFile;
  if (dbTag) {
    out.dbTag = dbTag;
    out.dbLabel = dbTag;
  }
  return out;
};
const getDetailJa4Info = (detail) => {
  const root = detail && typeof detail === 'object' ? detail : {};
  const metadata = root?.metadata && typeof root.metadata === 'object' ? root.metadata : {};
  const objectCandidates = [
    metadata?.ja4,
    metadata?.ja4Info,
    metadata?.ja4info,
    root?.ja4,
    root?.ja4Info,
    root?.ja4info
  ].filter((item) => item && typeof item === 'object');
  const pickFromObjects = (keys) => {
    for (const candidate of objectCandidates) {
      const value = pickJa4Text(candidate, keys);
      if (value) return value;
    }
    return '';
  };

  const fingerprint = pickJa4Text(metadata, [
    'ja4',
    'ja4Fingerprint',
    'ja4_fingerprint',
    'ja4Fp',
    'ja4_fp'
  ]) || pickJa4Text(root, [
    'ja4',
    'ja4Fingerprint',
    'ja4_fingerprint',
    'ja4Fp',
    'ja4_fp'
  ]) || pickFromObjects([
    'fingerprint',
    'ja4',
    'value',
    'raw'
  ]);

  const dbLabel = pickJa4Text(metadata, [
    'ja4DbLabel',
    'ja4DBLabel',
    'ja4DatabaseLabel',
    'ja4_database_label',
    'ja4_db_label',
    'ja4Label',
    'ja4DbTag',
    'ja4DBTag',
    'ja4DatabaseTag',
    'ja4_database_tag',
    'ja4_db_tag',
    'ja4Tag',
    'ja4dbLabel',
    'ja4dbTag'
  ]) || pickJa4Text(root, [
    'ja4DbLabel',
    'ja4DBLabel',
    'ja4DatabaseLabel',
    'ja4_database_label',
    'ja4_db_label',
    'ja4Label',
    'ja4DbTag',
    'ja4DBTag',
    'ja4DatabaseTag',
    'ja4_database_tag',
    'ja4_db_tag',
    'ja4Tag',
    'ja4dbLabel',
    'ja4dbTag'
  ]) || pickFromObjects([
    'dbLabel',
    'databaseLabel',
    'label',
    'dbTag',
    'databaseTag',
    'tag'
  ]);

  const dbTag = pickJa4Text(metadata, [
    'ja4DbTag',
    'ja4DBTag',
    'ja4DatabaseTag',
    'ja4_database_tag',
    'ja4_db_tag',
    'ja4Tag',
    'ja4dbTag'
  ]) || pickJa4Text(root, [
    'ja4DbTag',
    'ja4DBTag',
    'ja4DatabaseTag',
    'ja4_database_tag',
    'ja4_db_tag',
    'ja4Tag',
    'ja4dbTag'
  ]) || pickFromObjects([
    'dbTag',
    'databaseTag',
    'tag'
  ]);

  const dbFile = pickJa4Text(metadata, [
    'ja4DbFile',
    'ja4DBFile',
    'ja4DatabaseFile',
    'ja4_database_file',
    'ja4_db_file',
    'ja4dbFile'
  ]) || pickJa4Text(root, [
    'ja4DbFile',
    'ja4DBFile',
    'ja4DatabaseFile',
    'ja4_database_file',
    'ja4_db_file',
    'ja4dbFile'
  ]) || pickFromObjects([
    'dbFile',
    'databaseFile',
    'file'
  ]);

  const refCandidates = [
    pickJa4Text(metadata, ['ja4DbRef', 'ja4DBRef', 'ja4DatabaseRef', 'ja4_db_ref', 'ja4Ref']),
    pickJa4Text(root, ['ja4DbRef', 'ja4DBRef', 'ja4DatabaseRef', 'ja4_db_ref', 'ja4Ref']),
    pickFromObjects(['dbRef', 'databaseRef', 'ref']),
    normalizeJa4Text(root?.rulePayload),
    normalizeJa4Text(root?.rule)
  ].filter(Boolean);

  let parsedRef = null;
  for (const candidate of refCandidates) {
    parsedRef = parseJa4DbRef(candidate);
    if (parsedRef) break;
  }

  const finalDbTag = normalizeUniqueJa4Label(dbTag || parsedRef?.dbTag || '');
  const finalDbLabel = normalizeUniqueJa4Label(dbLabel || finalDbTag || parsedRef?.dbLabel || '');
  const finalDbFile = dbFile || parsedRef?.dbFile || '';
  const out = {};
  if (fingerprint) out.fingerprint = fingerprint;
  if (finalDbLabel) out.dbLabel = finalDbLabel;
  if (finalDbTag) out.dbTag = finalDbTag;
  if (finalDbFile) out.dbFile = finalDbFile;
  if (parsedRef?.dbRef) out.dbRef = parsedRef.dbRef;
  return Object.keys(out).length > 0 ? out : null;
};
const getDetailJa4DbLabel = (detail, fallback = '-') => {
  const label = getDetailJa4Info(detail)?.dbLabel || '';
  return label || fallback;
};
const normalizeDomainSource = (value) => {
  const source = String(value || '').trim().toLowerCase();
  if (!source) return '';
  if (source === 'dns') return 'dns';
  if (source === 'sni') return 'sni';
  if (source === 'sniff' || source === 'sniffer') return 'sniff';
  if (source === 'mixed') return 'mixed';
  return '';
};
const getDomainSourceBadgeLabel = (value) => {
  const source = normalizeDomainSource(value);
  switch (source) {
    case 'dns':
      return 'DNS';
    case 'sni':
      return 'SNI';
    case 'sniff':
      return 'SNIFF';
    case 'mixed':
      return 'MIXED';
    default:
      return '';
  }
};
const getConnectionDomainSourceBadge = (conn) => {
  let merged = normalizeDomainSource(conn?.metadata?.domainSource);
  const details = Array.isArray(conn?.details) ? conn.details : [];
  details.forEach((detail) => {
    merged = mergeDomainSource(merged, detail?.metadata?.domainSource);
  });
  return getDomainSourceBadgeLabel(merged);
};
const getDetailDomainSourceBadge = (detail) => getDomainSourceBadgeLabel(detail?.metadata?.domainSource);
const getDetailLastSeen = (detail) => detail?.lastSeen || detail?.last_seen || detail?.LastSeen || '';
const IPV6_FOLD_TAIL_GROUPS = 4;
const splitZoneIndex = (value) => {
  const text = String(value || '');
  const idx = text.indexOf('%');
  if (idx < 0) return { ip: text, zone: '' };
  return { ip: text.slice(0, idx), zone: text.slice(idx) };
};
const foldIpv6Front = (value) => {
  const raw = String(value || '').trim();
  if (!raw || !isLikelyIPv6(raw)) return raw;
  const parts = raw.split(':').filter(Boolean);
  if (parts.length <= IPV6_FOLD_TAIL_GROUPS) return raw;
  return `…:${parts.slice(-IPV6_FOLD_TAIL_GROUPS).join(':')}`;
};
const formatHostDisplay = (host) => {
  const hostValue = String(host || '').trim();
  if (!hostValue) return hostValue;
  const bracketed = hostValue.startsWith('[') && hostValue.endsWith(']');
  const inner = bracketed ? hostValue.slice(1, -1) : hostValue;
  const { ip, zone } = splitZoneIndex(inner);
  if (!isLikelyIPv6(ip)) return hostValue;
  return `${foldIpv6Front(ip)}${zone}`;
};
const formatHostPort = (host, port) => {
  const hostValue = String(host || '').trim();
  const portValue = port === undefined || port === null ? '' : String(port).trim();
  if (!portValue) return hostValue;
  const bracketed = hostValue.startsWith('[') && hostValue.endsWith(']');
  const inner = bracketed ? hostValue.slice(1, -1) : hostValue;
  const { ip } = splitZoneIndex(inner);
  if (isLikelyIPv6(ip) && !hostValue.startsWith('[')) {
    return `[${hostValue}]:${portValue}`;
  }
  return `${hostValue}:${portValue}`;
};
const formatHostPortDisplay = (host, port) => {
  const hostValue = String(host || '').trim();
  const portValue = port === undefined || port === null ? '' : String(port).trim();
  if (!portValue) return formatHostDisplay(hostValue);
  const bracketed = hostValue.startsWith('[') && hostValue.endsWith(']');
  const inner = bracketed ? hostValue.slice(1, -1) : hostValue;
  const { ip, zone } = splitZoneIndex(inner);
  if (!isLikelyIPv6(ip)) return `${hostValue}:${portValue}`;
  return `[${foldIpv6Front(ip)}${zone}]:${portValue}`;
};

const AutoFoldText = ({
  fullText,
  foldedText,
  renderText,
  className,
  disableAdaptive = false,
  forceFold = false
}) => {
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [shouldFold, setShouldFold] = useState(false);

  const full = fullText === null || fullText === undefined ? '' : String(fullText);
  const folded = foldedText === null || foldedText === undefined ? '' : String(foldedText);
  const canFold = folded && folded !== full;

  const staticFold = disableAdaptive && canFold;
  const effectiveFold = canFold && (staticFold || forceFold || shouldFold);
  const display = effectiveFold ? folded : full;
  const title = effectiveFold ? full : undefined;

  useLayoutEffect(() => {
    if (!canFold) {
      setShouldFold(false);
      return;
    }
    if (disableAdaptive) {
      if (shouldFold) setShouldFold(false);
      return;
    }
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const available = container.clientWidth;
    const fullWidth = measure.getBoundingClientRect().width;
    setShouldFold(fullWidth > available + 0.5);
  }, [canFold, disableAdaptive, full, folded, shouldFold]);

  useEffect(() => {
    if (!canFold) return undefined;
    if (disableAdaptive) return undefined;
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return undefined;

    const check = () => {
      const available = container.clientWidth;
      const fullWidth = measure.getBoundingClientRect().width;
      setShouldFold(fullWidth > available + 0.5);
    };

    check();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => check());
      ro.observe(container);
      return () => ro.disconnect();
    }

    const onResize = () => check();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [canFold, disableAdaptive, full, folded]);

  return (
    <span ref={containerRef} className={`auto-fold ${className || ''}`.trim()} title={title}>
      {canFold ? (
        <span ref={measureRef} className="auto-fold-measure" aria-hidden="true">
          {renderText ? renderText(full) : full}
        </span>
      ) : null}
      <span className="auto-fold-content">
        {renderText ? renderText(display) : display}
      </span>
    </span>
  );
};

const mergeLabel = (current, incoming) => {
  if (!current || current === 'unknown') return incoming || 'unknown';
  if (!incoming || incoming === 'unknown') return current;
  if (current === incoming) return current;
  return 'mixed';
};

const mergeDomainSource = (current, incoming) => {
  const currentSource = normalizeDomainSource(current);
  const incomingSource = normalizeDomainSource(incoming);
  if (!currentSource) return incomingSource;
  if (!incomingSource || currentSource === incomingSource) return currentSource;
  return 'mixed';
};

const buildConnectionsView = (list, mode) => {
  if (!Array.isArray(list) || mode === 'current') return list || [];
  const groups = new Map();

  list.forEach((conn) => {
    const details = Array.isArray(conn.details) ? conn.details : [];
    details.forEach((detail) => {
      const source = getDetailSourceLabel(detail);
      const dest = getDetailDestinationLabel(detail);
      const key = mode === 'source' ? source : dest;
      const id = `${mode}:${key}`;
      let group = groups.get(id);
      if (!group) {
        group = {
          id,
          metadata: {},
          upload: 0,
          download: 0,
          uploadRate: 0,
          downloadRate: 0,
          connectionCount: 0,
          details: [],
          start: detail.start || conn.start || '',
          lastSeen: detail.lastSeen || detail.last_seen || ''
        };
        if (mode === 'source') {
          group.metadata.sourceIP = source;
          group.metadata.host = dest;
        } else {
          group.metadata.host = dest;
          group.metadata.sourceIP = source;
        }
        group.sourceLabel = source;
        group.destLabel = dest;
        groups.set(id, group);
      }

      group.metadata.domainSource = mergeDomainSource(
        group.metadata.domainSource,
        detail?.metadata?.domainSource
      );

      group.upload += detail.upload || 0;
      group.download += detail.download || 0;
      group.uploadRate += getRuntimeRate(detail.uploadRate, 0);
      group.downloadRate += getRuntimeRate(detail.downloadRate, 0);
      group.connectionCount += 1;
      group.details.push(detail);

      const detailStart = detail.start || conn.start || '';
      if (detailStart && (!group.start || detailStart < group.start)) {
        group.start = detailStart;
      }
      const detailLast = getDetailLastSeen(detail);
      if (detailLast && (!group.lastSeen || detailLast > group.lastSeen)) {
        group.lastSeen = detailLast;
      }

      group.sourceLabel = mergeLabel(group.sourceLabel, source);
      group.destLabel = mergeLabel(group.destLabel, dest);
    });
  });

  const result = Array.from(groups.values()).map((group) => {
    if (mode === 'source') {
      group.metadata.sourceIP = group.sourceLabel || group.metadata.sourceIP;
      group.metadata.host = group.destLabel || group.metadata.host;
    } else {
      group.metadata.host = group.destLabel || group.metadata.host;
      group.metadata.sourceIP = group.sourceLabel || group.metadata.sourceIP;
    }
    group.details.sort((a, b) => parseTimestamp(getDetailLastSeen(b)) - parseTimestamp(getDetailLastSeen(a)));
    return group;
  });

  result.sort((a, b) => parseTimestamp(b.lastSeen) - parseTimestamp(a.lastSeen));
  return result;
};

const pruneConnectionsPayload = (payload, now, windowMs = DASHBOARD_CACHE_WINDOW_MS) => {
  if (!payload || !Array.isArray(payload.connections)) return payload;
  const cutoff = now - windowMs;
  const nextConnections = [];
  let uploadTotal = 0;
  let downloadTotal = 0;
  let uploadRate = 0;
  let downloadRate = 0;
  let hasConnectionRates = false;
  const payloadUploadRate = getOptionalRuntimeRate(payload.uploadRate);
  const payloadDownloadRate = getOptionalRuntimeRate(payload.downloadRate);

  payload.connections.forEach((conn) => {
    if (!conn || typeof conn !== 'object') return;
    const details = Array.isArray(conn.details) ? conn.details : [];
    if (details.length === 0) {
      const upload = conn.upload || 0;
      const download = conn.download || 0;
      const connUploadRate = getOptionalRuntimeRate(conn.uploadRate);
      const connDownloadRate = getOptionalRuntimeRate(conn.downloadRate);
      nextConnections.push({ ...conn, details });
      uploadTotal += upload;
      downloadTotal += download;
      if (connUploadRate !== null || connDownloadRate !== null) {
        hasConnectionRates = true;
        uploadRate += connUploadRate || 0;
        downloadRate += connDownloadRate || 0;
      }
      return;
    }
    const prunedDetails = details.filter((detail) => {
      const ts = parseTimestamp(getDetailLastSeen(detail));
      return !ts || ts >= cutoff;
    });
    if (prunedDetails.length === 0) return;
    const nextConn = { ...conn, details: prunedDetails };
    const recalculatedUpload = prunedDetails.reduce((sum, detail) => sum + (detail.upload || 0), 0);
    const recalculatedDownload = prunedDetails.reduce((sum, detail) => sum + (detail.download || 0), 0);
    let recalculatedUploadRate = 0;
    let recalculatedDownloadRate = 0;
    let hasDetailRates = false;
    prunedDetails.forEach((detail) => {
      const detailUploadRate = getOptionalRuntimeRate(detail.uploadRate);
      const detailDownloadRate = getOptionalRuntimeRate(detail.downloadRate);
      if (detailUploadRate === null && detailDownloadRate === null) return;
      hasDetailRates = true;
      recalculatedUploadRate += detailUploadRate || 0;
      recalculatedDownloadRate += detailDownloadRate || 0;
    });
    nextConn.upload = recalculatedUpload;
    nextConn.download = recalculatedDownload;
    if (hasDetailRates) {
      nextConn.uploadRate = recalculatedUploadRate;
      nextConn.downloadRate = recalculatedDownloadRate;
      hasConnectionRates = true;
      uploadRate += recalculatedUploadRate;
      downloadRate += recalculatedDownloadRate;
    }
    nextConn.connectionCount = prunedDetails.length;
    uploadTotal += recalculatedUpload;
    downloadTotal += recalculatedDownload;
    nextConnections.push(nextConn);
  });

  return {
    ...payload,
    connections: nextConnections,
    uploadTotal,
    downloadTotal,
    uploadRate: payloadUploadRate !== null ? payloadUploadRate : uploadRate,
    downloadRate: payloadDownloadRate !== null ? payloadDownloadRate : downloadRate,
    rateSampledAt: payload.rateSampledAt,
    hasRuntimeRates: Boolean(payload.rateSampledAt || payloadUploadRate !== null || payloadDownloadRate !== null || hasConnectionRates)
  };
};

const getConnectionDestination = (conn) => getDestinationLabel(conn?.metadata, 'unknown');
const getConnectionSource = (conn) => getSourceLabel(conn?.metadata, '0.0.0.0');
const getStableKeyPart = (value) => {
  const text = String(value ?? '').trim();
  return text ? text.replace(/[|\\]/g, '_') : '';
};
const getFirstStableKeyPart = (...values) => {
  for (const value of values) {
    const part = getStableKeyPart(value);
    if (part) return part;
  }
  return '';
};
const getConnectionRateKey = (conn) => getStableKeyPart(conn?.id);
const getConnectionRule = (conn) => {
  const direct = String(conn?.rulePayload || conn?.rule || '').trim();
  if (direct) return direct;
  const details = Array.isArray(conn?.details) ? conn.details : [];
  let merged = '';
  for (const detail of details) {
    const value = String(detail?.rulePayload || detail?.rule || '').trim();
    if (!value) continue;
    if (!merged) {
      merged = value;
      continue;
    }
    if (merged !== value) {
      return 'mixed';
    }
  }
  return merged || '-';
};
const getDetailKey = (connId, detail, index) => {
  const directId = getFirstStableKeyPart(
    detail?.id,
    detail?.ID,
    detail?.connectionId,
    detail?.connectionID,
    detail?.connId,
    detail?.ConnID
  );
  if (directId) return directId;

  const metadata = detail?.metadata && typeof detail.metadata === 'object' ? detail.metadata : {};
  const parts = [
    connId,
    metadata.sourceIP,
    metadata.sourcePort,
    metadata.acoreSrcIP,
    metadata.acoreSrcPort,
    metadata.host || metadata.destinationHost || metadata.destinationIP,
    metadata.destinationPort,
    metadata.inboundTag,
    metadata.outboundTag,
    metadata.network,
    metadata.type,
    detail?.rulePayload || detail?.rule,
    detail?.start
  ].map(getStableKeyPart).filter(Boolean);
  if (parts.length > 1) return parts.join('|');

  const fallbackConnId = getStableKeyPart(connId) || 'conn';
  const fallbackIndex = Number.isFinite(Number(index)) ? Math.trunc(Number(index)) : 0;
  return `${fallbackConnId}-${fallbackIndex}`;
};
const normalizeConnectionIds = (ids) => {
  const seen = new Set();
  const out = [];
  (ids || []).forEach((id) => {
    const num = Number(id);
    if (!Number.isFinite(num)) return;
    const normalized = Math.trunc(num);
    if (normalized <= 0 || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};
const collectCloseIdCandidates = (value, out) => {
  if (!value || typeof value !== 'object') return;
  out.push(
    value.id,
    value.ID,
    value.connectionId,
    value.connectionID,
    value.connId,
    value.ConnID
  );
};
const collectNestedCloseIds = (items, out) => {
  if (!Array.isArray(items)) return;
  items.forEach((item) => {
    collectCloseIdCandidates(item, out);
    if (!item || typeof item !== 'object') return;
    collectNestedCloseIds(item.details, out);
    collectNestedCloseIds(item.children, out);
    collectNestedCloseIds(item.items, out);
  });
};
const getGroupCloseIds = (conn) => {
  if (!conn || typeof conn !== 'object') return [];
  const ids = [];
  collectNestedCloseIds(conn.details, ids);
  collectNestedCloseIds(conn.children, ids);
  collectNestedCloseIds(conn.items, ids);
  if (ids.length === 0) {
    collectCloseIdCandidates(conn, ids);
  }
  return normalizeConnectionIds(ids);
};
const CONNECTION_SORT_FIELDS = {
  destination: {
    label: 'Destination',
    type: 'string',
    getValue: (conn) => getConnectionDestination(conn)
  },
  source: {
    label: 'Source',
    type: 'string',
    getValue: (conn) => getConnectionSource(conn)
  },
  rule: {
    label: 'Rule',
    type: 'string',
    getValue: (conn) => getConnectionRule(conn)
  },
  sessions: {
    label: 'Sessions',
    type: 'number',
    getValue: (conn) => conn.connectionCount || 1
  },
  upload: {
    label: 'Upload',
    type: 'number',
    getValue: (conn) => conn.upload || 0
  },
  download: {
    label: 'Download',
    type: 'number',
    getValue: (conn) => conn.download || 0
  }
};

const DETAIL_COLUMNS = [
  { key: 'destination', label: 'Destination', width: 'minmax(0, 2.2fr)', cellClassName: 'mono' },
  { key: 'source', label: 'Source', width: 'minmax(0, 1.8fr)', cellClassName: 'mono' },
  { key: 'acoreSrc', label: 'Acore Src', width: 'minmax(0, 1.8fr)', cellClassName: 'mono' },
  { key: 'user', label: 'User', width: 'minmax(0, 0.9fr)' },
  { key: 'inbound', label: 'Inbound', width: 'minmax(0, 0.9fr)' },
  { key: 'outbound', label: 'Outbound', width: 'minmax(0, 0.9fr)' },
  { key: 'rule', label: 'Rule', width: 'minmax(0, 1fr)', cellClassName: 'mono' },
  { key: 'protocol', label: 'Protocol', width: 'minmax(0, 1.2fr)', cellClassName: 'mono' },
  { key: 'firewallFlow', label: 'Firewall Flow', width: 'minmax(0, 1.2fr)', cellClassName: 'mono' },
  { key: 'ja4', label: 'JA4 DB', width: 'minmax(0, 1fr)', cellClassName: 'mono', hint: 'JA4 database label' },
  {
    key: 'upload',
    label: 'Up',
    width: 'minmax(0, 0.7fr)',
    cellClassName: 'mono',
    hint: TRAFFIC_DIRECTION_HINTS.upload
  },
  {
    key: 'download',
    label: 'Down',
    width: 'minmax(0, 0.7fr)',
    cellClassName: 'mono',
    hint: TRAFFIC_DIRECTION_HINTS.download
  },
  { key: 'lastSeen', label: 'Last Seen', width: 'minmax(0, 1.1fr)', cellClassName: 'mono' },
  { key: 'close', label: 'Close', width: 'minmax(0, 0.6fr)', cellClassName: 'row-actions', headerClassName: 'detail-header-actions' }
];
const DETAIL_COLUMN_KEYS = new Set(DETAIL_COLUMNS.map((column) => column.key));

const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, withAccessKey(options, url));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
};

const LOG_MAX_LINES = 500;

const toNewestFirst = (lines) => {
  if (!Array.isArray(lines)) return [];
  if (lines.length === 0) return [];
  return [...lines].reverse();
};

const LOG_LEVEL_PATTERNS = [
  { level: 'error', regex: /\b(error|fatal|panic)\b/i },
  { level: 'warn', regex: /\b(warn|warning)\b/i },
  { level: 'info', regex: /\binfo\b/i },
  { level: 'debug', regex: /\bdebug\b/i },
  { level: 'trace', regex: /\btrace\b/i }
];
const LOG_LEVEL_OPTIONS = [
  { value: 'default', label: 'default' },
  { value: 'error', label: 'error' },
  { value: 'warning', label: 'warn' },
  { value: 'info', label: 'info' },
  { value: 'debug', label: 'debug' }
];
const LOG_LEVEL_VALUES = new Set(LOG_LEVEL_OPTIONS.map((option) => option.value));
const LOG_IPV4_TOKEN_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const LOG_LEVEL_TOKEN_REGEX = /^(?:error|fatal|panic|warn|warning|info|debug|trace)$/i;
const LOG_TOKEN_REGEX = /(\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[a-fA-F0-9]{0,4}:){2,7}[a-fA-F0-9]{0,4}\b|\b(?:error|fatal|panic|warn|warning|info|debug|trace)\b)/gi;

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const normalizeRuleDestination = (value) => {
  if (value === null || value === undefined) {
    return {
      tag: '',
      vlessRoute: '',
      label: '',
      hasTarget: false,
      isObject: false,
      isValid: true,
      error: ''
    };
  }
  if (typeof value === 'string') {
    const tag = value.trim();
    return {
      tag,
      vlessRoute: '',
      label: tag,
      hasTarget: !!tag,
      isObject: false,
      isValid: true,
      error: ''
    };
  }
  if (!isPlainObject(value)) {
    return {
      tag: '',
      vlessRoute: '',
      label: '',
      hasTarget: false,
      isObject: false,
      isValid: false,
      error: 'destination must be a string or object.'
    };
  }

  const tagRaw = value.tag;
  const vlessRouteRaw = value.vlessRoute;
  if (tagRaw !== undefined && tagRaw !== null && typeof tagRaw !== 'string') {
    return {
      tag: '',
      vlessRoute: '',
      label: '',
      hasTarget: false,
      isObject: true,
      isValid: false,
      error: 'destination.tag must be a string.'
    };
  }
  if (
    vlessRouteRaw !== undefined
    && vlessRouteRaw !== null
    && typeof vlessRouteRaw !== 'string'
    && typeof vlessRouteRaw !== 'number'
  ) {
    return {
      tag: '',
      vlessRoute: '',
      label: '',
      hasTarget: false,
      isObject: true,
      isValid: false,
      error: 'destination.vlessRoute must be a string or number.'
    };
  }

  const tag = String(tagRaw || '').trim();
  const vlessRoute = vlessRouteRaw === undefined || vlessRouteRaw === null
    ? ''
    : String(vlessRouteRaw).trim();

  return {
    tag,
    vlessRoute,
    label: tag ? (vlessRoute ? `${tag} · vlessRoute=${vlessRoute}` : tag) : (vlessRoute ? `vlessRoute=${vlessRoute}` : ''),
    hasTarget: !!tag,
    isObject: true,
    isValid: true,
    error: ''
  };
};

const toMainEditorSections = (mainRoot) => {
  const root = isPlainObject(mainRoot) ? mainRoot : {};
  const observatoryLower = isPlainObject(root.observatory) ? root.observatory : {};
  const observatoryUpper = isPlainObject(root.Observatory) ? root.Observatory : {};
  const observatory = Object.keys(observatoryUpper).length > 0 ? observatoryUpper : observatoryLower;
  return {
    Observatory: isPlainObject(observatory) ? observatory : {},
    log: isPlainObject(root.log) ? root.log : {},
    metrics: isPlainObject(root.metrics) ? root.metrics : {},
    stats: isPlainObject(root.stats) ? root.stats : {}
  };
};

const applyMainEditorSectionsToRoot = (mainRoot, sections) => {
  const base = isPlainObject(mainRoot) ? { ...mainRoot } : {};
  const nextSections = isPlainObject(sections) ? sections : {};
  const observatory = isPlainObject(nextSections.Observatory) ? nextSections.Observatory : {};
  const log = isPlainObject(nextSections.log) ? nextSections.log : {};
  const metrics = isPlainObject(nextSections.metrics) ? nextSections.metrics : {};
  const stats = isPlainObject(nextSections.stats) ? nextSections.stats : {};

  base.observatory = observatory;
  if (hasOwn(base, 'Observatory')) {
    delete base.Observatory;
  }
  base.log = log;
  base.metrics = metrics;
  base.stats = stats;
  return base;
};

const toDnsEditorSection = (mainRoot) => {
  const root = isPlainObject(mainRoot) ? mainRoot : {};
  if (isPlainObject(root.dns)) return root.dns;
  if (isPlainObject(root.DNS)) return root.DNS;
  return {};
};

const normalizeSelectionMap = (value) => {
  if (!isPlainObject(value)) return {};
  const out = {};
  Object.entries(value).forEach(([key, item]) => {
    const normalizedKey = String(key || '').trim();
    const normalizedValue = String(item || '').trim();
    if (!normalizedKey || !normalizedValue) return;
    out[normalizedKey] = normalizedValue;
  });
  return out;
};

const normalizeViewMode = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'source' || raw === 'destination') return raw;
  return 'current';
};

const normalizeSortKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw === 'default') return 'default';
  return CONNECTION_SORT_FIELDS[raw] ? raw : 'default';
};

const normalizeSortDir = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'asc' ? 'asc' : 'desc';
};

const normalizeDetailColumns = (value) => {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  const out = [];
  value.forEach((item) => {
    const key = String(item || '').trim();
    if (!key || seen.has(key) || !DETAIL_COLUMN_KEYS.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out.length > 0 ? out : null;
};

const normalizeUiState = (raw) => {
  const source = isPlainObject(raw?.state) ? raw.state : raw;
  const nodes = isPlainObject(source?.nodes) ? source.nodes : {};
  const logs = isPlainObject(source?.logs) ? source.logs : {};
  const connections = isPlainObject(source?.connections) ? source.connections : {};
  return {
    nodesLocked: normalizeSelectionMap(nodes.locked || nodes.locks || nodes.selected),
    logsDisabled: typeof logs.disabled === 'boolean' ? logs.disabled : undefined,
    logsPaused: typeof logs.paused === 'boolean' ? logs.paused : undefined,
    autoScroll: typeof logs.autoScroll === 'boolean' ? logs.autoScroll : undefined,
    logLevel: typeof logs.level === 'string' && LOG_LEVEL_VALUES.has(logs.level) ? logs.level : undefined,
    connViewMode: typeof connections.viewMode === 'string' ? normalizeViewMode(connections.viewMode) : undefined,
    connStreamPaused: typeof connections.streamPaused === 'boolean' ? connections.streamPaused : undefined,
    connSortKey: typeof connections.sortKey === 'string' ? normalizeSortKey(connections.sortKey) : undefined,
    connSortDir: typeof connections.sortDir === 'string' ? normalizeSortDir(connections.sortDir) : undefined,
    detailColumns: normalizeDetailColumns(connections.detailColumns)
  };
};

const buildUiStatePayload = ({
  groupSelections,
  logsDisabled,
  logsPaused,
  autoScroll,
  logLevel,
  connViewMode,
  connStreamPaused,
  connSortKey,
  connSortDir,
  detailColumnsVisible
}) => ({
  nodes: {
    locked: normalizeSelectionMap(groupSelections)
  },
  logs: {
    disabled: !!logsDisabled,
    paused: !!logsPaused,
    autoScroll: !!autoScroll,
    level: logLevel
  },
  connections: {
    viewMode: connViewMode,
    streamPaused: !!connStreamPaused,
    sortKey: connSortKey,
    sortDir: connSortDir,
    detailColumns: Array.from(detailColumnsVisible || [])
  }
});

const isLikelyIPv6 = (value) => {
  if (!value || !value.includes(':')) return false;
  const colonCount = value.split(':').length - 1;
  if (colonCount < 2) return false;
  const hasHexLetter = /[a-f]/i.test(value);
  if (!hasHexLetter && !value.includes('::') && colonCount < 3) return false;
  return /^[0-9a-f:]+$/i.test(value);
};

const isLogIpToken = (value) => LOG_IPV4_TOKEN_REGEX.test(value) || isLikelyIPv6(value);

const getLogLineLevelClass = (line) => {
  const value = String(line || '');
  for (const entry of LOG_LEVEL_PATTERNS) {
    if (entry.regex.test(value)) {
      return `level-${entry.level}`;
    }
  }
  return '';
};

const renderLogLine = (line) => {
  const value = String(line || '');
  const parts = value.split(LOG_TOKEN_REGEX);
  if (parts.length === 1) return value;
  return parts.map((part, idx) => {
    if (!part) return part;
    if (isLogIpToken(part)) {
      return (
        <span className="log-token log-ip" key={`ip-${idx}`}>
          {part}
        </span>
      );
    }
    if (LOG_LEVEL_TOKEN_REGEX.test(part)) {
      const keyword = part.toLowerCase();
      const level = keyword === 'warning' ? 'warn' : keyword === 'fatal' || keyword === 'panic' ? 'error' : keyword;
      return (
        <span className={`log-token log-keyword ${level}`} key={`kw-${idx}`}>
          {part}
        </span>
      );
    }
    return part;
  });
};
export {
  DEFAULT_API_BASE,
  API_BASE_STORAGE_KEY,
  ACCESS_KEY_STORAGE_KEY,
  CONNECTION_REFRESH_STORAGE_KEY,
  SERVER_STATES_STORAGE_KEY,
  METRICS_PANEL_HISTORY_COOKIE_KEY,
  METRICS_PANEL_HISTORY_LIMIT,
  ACCESS_KEY_HEADER,
  ACCESS_KEY_QUERY,
  ROUTING_DRAFT_STORAGE_KEY,
  FIREWALL_DRAFT_STORAGE_KEY,
  ROUTING_DRAFT_NOTICE,
  FIREWALL_DRAFT_NOTICE,
  UI_STATE_SAVE_DELAY_MS,
  MODAL_ANIMATION_MS,
  CONNECTION_REFRESH_OPTIONS,
  DEFAULT_CONNECTION_REFRESH,
  TRAFFIC_DIRECTION_HINTS,
  ZEBRA_ROW_BACKGROUNDS,
  ZEBRA_DETAIL_BACKGROUNDS,
  parseRoutingDraft,
  getRoutingDraft,
  saveRoutingDraft,
  parseFirewallDraft,
  getFirewallDraft,
  saveFirewallDraft,
  normalizeApiBase,
  getServerStorageId,
  getStoredServerAccessKey,
  setStoredServerAccessKey,
  getStoredServerRefreshInterval,
  setStoredServerRefreshInterval,
  getInitialMetricsHttp,
  normalizeAccessKey,
  getInitialMetricsKey,
  getInitialAccessKey,
  getInitialApiBase,
  normalizeRefreshInterval,
  getMetricsPanelId,
  formatMetricsPanelOptionLabel,
  getInitialRefreshInterval,
  getInitialMetricsPanelHistory,
  saveMetricsPanelHistory,
  addMetricsPanelHistoryEntry,
  removeMetricsPanelHistoryEntry,
  getStoredAccessKey,
  withAccessKey,
  appendAccessKeyParam,
  ABSOLUTE_URL_SCHEME_REGEX,
  RELATIVE_PATH_PREFIX_REGEX,
  getSubscriptionUrlDisplay,
  normalizeUiLanguage,
  getInitialUiLanguage,
  I18N_MESSAGES,
  getI18nText,
  PAGES,
  getPageFromHash,
  formatBytes,
  formatRate,
  SPLICE_LABEL,
  isSpliceType,
  formatRateOrSplice,
  getInlineRatePair,
  getResolvedRatePair,
  formatDelay,
  formatTime,
  formatJson,
  formatJsonText,
  FAILED_STATUS_TEXT_REGEX,
  isFailedStatusText,
  normalizeBalancerStrategy,
  getBalancerStrategyTone,
  clearTimeoutRef,
  clearIntervalRef,
  scheduleModalClose,
  startCooldown,
  RULE_TEMPLATE,
  BALANCER_TEMPLATE,
  OUTBOUND_TEMPLATE,
  INBOUND_TEMPLATE,
  FIREWALL_RULE_TEMPLATE,
  MAIN_EDITOR_ALLOWED_KEYS,
  SUBSCRIPTION_OUTBOUND_TEMPLATE,
  SUBSCRIPTION_DATABASE_TEMPLATE,
  EMPTY_DNS_CACHE_STATS,
  normalizeRatioValue,
  normalizeCountValue,
  normalizeDnsCacheStats,
  clamp,
  CONNECTION_ACTIVITY_SCALE,
  DETAIL_ACTIVITY_SCALE,
  CONNECTION_COUNT_ACTIVITY_SCALE,
  getRateActivity,
  buildPoints,
  buildLinePath,
  buildAreaPath,
  truncateLabel,
  buildConicGradient,
  CHART_COLORS,
  DASHBOARD_CACHE_WINDOW_MS,
  TRAFFIC_MIN_SAMPLE_INTERVAL_MS,
  TRAFFIC_MAX_SAMPLES,
  TRAFFIC_ANIMATION_MS,
  TRAFFIC_GRID_LINES,
  TRAFFIC_CLIP_ID,
  DNS_CACHE_NETWORK_ERROR_REGEX,
  parseTimestamp,
  getConnectionStats,
  normalizeConnectionsPayload,
  parseConnectionsPayload,
  collectSearchTokens,
  toSearchText,
  normalizeRuleDestination,
  hasRuleReLookup,
  toRuleSearchText,
  normalizeFirewallRule,
  getFirewallRuleList,
  normalizeFirewallConfig,
  FIREWALL_ACTION_LABELS,
  resolveFirewallAction,
  getFirewallRuleAction,
  getFirewallLimitDetail,
  getFirewallRuleTitle,
  highlightSearchText,
  getDestinationLabel,
  getSourceLabel,
  getDetailDestinationLabel,
  getDetailSourceLabel,
  getDetailAcoreSrcLabel,
  getDetailJa4Info,
  getDetailJa4DbLabel,
  normalizeDomainSource,
  getDomainSourceBadgeLabel,
  getConnectionDomainSourceBadge,
  getDetailDomainSourceBadge,
  getDetailLastSeen,
  IPV6_FOLD_TAIL_GROUPS,
  splitZoneIndex,
  foldIpv6Front,
  formatHostDisplay,
  formatHostPort,
  formatHostPortDisplay,
  AutoFoldText,
  mergeLabel,
  mergeDomainSource,
  buildConnectionsView,
  pruneConnectionsPayload,
  getConnectionDestination,
  getConnectionSource,
  getConnectionRule,
  getConnectionRateKey,
  getDetailKey,
  normalizeConnectionIds,
  collectCloseIdCandidates,
  collectNestedCloseIds,
  getGroupCloseIds,
  CONNECTION_SORT_FIELDS,
  DETAIL_COLUMNS,
  DETAIL_COLUMN_KEYS,
  fetchJson,
  LOG_MAX_LINES,
  toNewestFirst,
  LOG_LEVEL_PATTERNS,
  LOG_LEVEL_OPTIONS,
  LOG_LEVEL_VALUES,
  LOG_IPV4_TOKEN_REGEX,
  LOG_LEVEL_TOKEN_REGEX,
  LOG_TOKEN_REGEX,
  isPlainObject,
  hasOwn,
  toMainEditorSections,
  applyMainEditorSectionsToRoot,
  toDnsEditorSection,
  normalizeSelectionMap,
  normalizeViewMode,
  normalizeSortKey,
  normalizeSortDir,
  normalizeDetailColumns,
  normalizeUiState,
  buildUiStatePayload,
  isLikelyIPv6,
  isLogIpToken,
  getLogLineLevelClass,
  renderLogLine
};


