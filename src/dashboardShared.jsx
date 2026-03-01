import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || '';
const API_BASE_STORAGE_KEY = 'xray_ui_api_base';
const ACCESS_KEY_STORAGE_KEY = 'xray_ui_access_key';
const CONNECTION_REFRESH_STORAGE_KEY = 'xray_ui_connection_refresh';
const METRICS_PANEL_HISTORY_COOKIE_KEY = 'xray_ui_metrics_panels';
const METRICS_PANEL_HISTORY_LIMIT = 12;
const ACCESS_KEY_HEADER = 'X-Access-Key';
const ACCESS_KEY_QUERY = 'access_key';
const ROUTING_DRAFT_STORAGE_KEY = 'xray_ui_routing_draft';
const ROUTING_DRAFT_NOTICE =
  'Unsaved rule edits are stored in your browser. Click Hot reload core to upload.';
const UI_STATE_SAVE_DELAY_MS = 600;
const MODAL_ANIMATION_MS = 200;
const CONNECTION_REFRESH_OPTIONS = [1, 2, 5, 10];
const DEFAULT_CONNECTION_REFRESH = 1;
const TRAFFIC_DIRECTION_HINTS = {
  upload: 'User -> Xray',
  download: 'Xray -> User'
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
      path: typeof parsed.path === 'string' ? parsed.path : ''
    };
  } catch (_err) {
    return null;
  }
};

const getRoutingDraft = () => {
  if (typeof window === 'undefined') return null;
  return parseRoutingDraft(window.localStorage.getItem(ROUTING_DRAFT_STORAGE_KEY));
};

const saveRoutingDraft = (draft) => {
  if (typeof window === 'undefined') return;
  if (!draft) {
    window.localStorage.removeItem(ROUTING_DRAFT_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ROUTING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
};

const normalizeApiBase = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return DEFAULT_API_BASE;
  const trimmed = value.replace(/\/+$/, '');
  if (trimmed === '/') return '';
  return trimmed;
};

const getInitialMetricsHttp = () => {
  if (typeof window === 'undefined') return DEFAULT_API_BASE;
  const stored = window.localStorage.getItem(API_BASE_STORAGE_KEY);
  if (stored !== null) return stored;
  return DEFAULT_API_BASE;
};

const normalizeAccessKey = (raw) => String(raw || '').trim();

const getInitialMetricsKey = () => {
  if (typeof window === 'undefined') return '';
  const stored = window.localStorage.getItem(ACCESS_KEY_STORAGE_KEY);
  if (stored !== null) return stored;
  return '';
};

const getInitialAccessKey = () => {
  if (typeof window === 'undefined') return '';
  const stored = window.localStorage.getItem(ACCESS_KEY_STORAGE_KEY);
  return normalizeAccessKey(stored);
};

const getInitialApiBase = () => {
  if (typeof window === 'undefined') return DEFAULT_API_BASE;
  const stored = window.localStorage.getItem(API_BASE_STORAGE_KEY);
  return normalizeApiBase(stored);
};

const normalizeRefreshInterval = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_CONNECTION_REFRESH;
  const rounded = Math.trunc(num);
  if (CONNECTION_REFRESH_OPTIONS.includes(rounded)) return rounded;
  return DEFAULT_CONNECTION_REFRESH;
};

const getMetricsPanelId = (base, key, connRefreshInterval) => {
  const normalizedBase = normalizeApiBase(base);
  if (!normalizedBase) return '';
  const normalizedKey = normalizeAccessKey(key);
  const normalizedRefresh = normalizeRefreshInterval(connRefreshInterval);
  return `${normalizedBase}||${normalizedKey}||${normalizedRefresh}`;
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
  if (typeof window === 'undefined') return DEFAULT_CONNECTION_REFRESH;
  const stored = window.localStorage.getItem(CONNECTION_REFRESH_STORAGE_KEY);
  if (stored !== null) return normalizeRefreshInterval(stored);
  return DEFAULT_CONNECTION_REFRESH;
};

const getStoredAccessKey = () => {
  if (typeof window === 'undefined') return '';
  return normalizeAccessKey(window.localStorage.getItem(ACCESS_KEY_STORAGE_KEY));
};

const withAccessKey = (options = {}) => {
  const key = getStoredAccessKey();
  if (!key) return options;
  const headers = { ...(options.headers || {}), [ACCESS_KEY_HEADER]: key };
  return { ...options, headers };
};

const appendAccessKeyParam = (url, key) => {
  if (!key) return url;
  if (/(?:^|[?&])access_key=/.test(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${ACCESS_KEY_QUERY}=${encodeURIComponent(key)}`;
};

const ABSOLUTE_URL_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;
const RELATIVE_PATH_PREFIX_REGEX = /^(?:[./\\]|[a-zA-Z]:[\\/])/;
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
    description: 'Tail Xray logs from the configured log file.'
  },
  settings: {
    label: 'Settings',
    title: 'Xray control plane',
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
const isSpliceType = (value) => typeof value === 'string' && value.toLowerCase().includes('splice');
const formatRateOrSplice = (value, isSplice) => {
  const rate = Number(value || 0);
  if (isSplice && (!rate || rate <= 0)) return SPLICE_LABEL;
  return formatRate(rate);
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
  user: ['love@xray.com'],
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

const getRateActivity = (rate, scale) => {
  if (!rate) return 0;
  const total = (rate.upload || 0) + (rate.download || 0);
  if (total <= 0) return 0;
  const normalized = total / scale;
  return clamp(Math.sqrt(normalized), 0, 1);
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
  const id = getMetricsPanelId(base, rawKey, connRefreshInterval);
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
  const next = [entry];
  list.forEach((item) => {
    const normalized = normalizeMetricsPanelEntry(item);
    if (!normalized || normalized.id === entry.id) return;
    next.push(normalized);
  });
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
const TRAFFIC_WINDOW = Math.max(2, Math.round(DASHBOARD_CACHE_WINDOW_MS / 1000));
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

const toSearchText = (value) => {
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
const getDetailXraySrcLabel = (detail) => detail?.metadata?.xraySrcIP || '-';
const JA4_DB_REF_PREFIX = 'xray.internal.ja4db:';
const JA4_FINGERPRINT_PATTERN = /^[tq]\d{2}[a-z]\d{4}[a-z0-9]{2}_[a-f0-9]{12}_[a-f0-9]{12}$/i;
const normalizeJa4Text = (value) => {
  const text = String(value || '').trim();
  if (!text || text === '-') return '';
  return text;
};
const normalizeUniqueJa4Label = (value) => {
  const text = normalizeJa4Text(value);
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower.startsWith('unique-label:')) return lower;
  if (lower.startsWith('label:')) return `unique-label:${lower.slice('label:'.length)}`;
  if (lower.startsWith('threat:')) return `unique-label:${lower.slice('threat:'.length)}`;
  if (!lower.includes(':') && !JA4_FINGERPRINT_PATTERN.test(lower)) return `unique-label:${lower}`;
  return lower;
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

const AutoFoldText = ({ fullText, foldedText, renderText, className }) => {
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [shouldFold, setShouldFold] = useState(false);

  const full = fullText === null || fullText === undefined ? '' : String(fullText);
  const folded = foldedText === null || foldedText === undefined ? '' : String(foldedText);
  const canFold = folded && folded !== full;

  const display = canFold && shouldFold ? folded : full;
  const title = canFold && shouldFold ? full : undefined;

  useLayoutEffect(() => {
    if (!canFold) {
      setShouldFold(false);
      return;
    }
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const available = container.clientWidth;
    const fullWidth = measure.getBoundingClientRect().width;
    setShouldFold(fullWidth > available + 0.5);
  }, [canFold, full, folded, renderText]);

  useEffect(() => {
    if (!canFold) return undefined;
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
  }, [canFold, full, folded]);

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

  payload.connections.forEach((conn) => {
    if (!conn || typeof conn !== 'object') return;
    const details = Array.isArray(conn.details) ? conn.details : [];
    if (details.length === 0) {
      const upload = conn.upload || 0;
      const download = conn.download || 0;
      nextConnections.push({ ...conn, details });
      uploadTotal += upload;
      downloadTotal += download;
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
    nextConn.upload = recalculatedUpload;
    nextConn.download = recalculatedDownload;
    nextConn.connectionCount = prunedDetails.length;
    uploadTotal += recalculatedUpload;
    downloadTotal += recalculatedDownload;
    nextConnections.push(nextConn);
  });

  return {
    ...payload,
    connections: nextConnections,
    uploadTotal,
    downloadTotal
  };
};

const getConnectionDestination = (conn) => getDestinationLabel(conn?.metadata, 'unknown');
const getConnectionSource = (conn) => getSourceLabel(conn?.metadata, '0.0.0.0');
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
const getDetailKey = (connId, detail, index) => (detail.id ? String(detail.id) : `${connId}-${index}`);
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
  { key: 'xraySrc', label: 'Xray Src', width: 'minmax(0, 1.8fr)', cellClassName: 'mono' },
  { key: 'user', label: 'User', width: 'minmax(0, 0.9fr)' },
  { key: 'inbound', label: 'Inbound', width: 'minmax(0, 0.9fr)' },
  { key: 'outbound', label: 'Outbound', width: 'minmax(0, 0.9fr)' },
  { key: 'rule', label: 'Rule', width: 'minmax(0, 1fr)', cellClassName: 'mono' },
  { key: 'protocol', label: 'Protocol', width: 'minmax(0, 1.2fr)', cellClassName: 'mono' },
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
  const res = await fetch(url, withAccessKey(options));
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
  METRICS_PANEL_HISTORY_COOKIE_KEY,
  METRICS_PANEL_HISTORY_LIMIT,
  ACCESS_KEY_HEADER,
  ACCESS_KEY_QUERY,
  ROUTING_DRAFT_STORAGE_KEY,
  ROUTING_DRAFT_NOTICE,
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
  normalizeApiBase,
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
  getRateActivity,
  buildPoints,
  buildLinePath,
  buildAreaPath,
  truncateLabel,
  buildConicGradient,
  CHART_COLORS,
  DASHBOARD_CACHE_WINDOW_MS,
  TRAFFIC_WINDOW,
  TRAFFIC_ANIMATION_MS,
  TRAFFIC_GRID_LINES,
  TRAFFIC_CLIP_ID,
  DNS_CACHE_NETWORK_ERROR_REGEX,
  parseTimestamp,
  getConnectionStats,
  collectSearchTokens,
  toSearchText,
  hasRuleReLookup,
  toRuleSearchText,
  highlightSearchText,
  getDestinationLabel,
  getSourceLabel,
  getDetailDestinationLabel,
  getDetailSourceLabel,
  getDetailXraySrcLabel,
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


