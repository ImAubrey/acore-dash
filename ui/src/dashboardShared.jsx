import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || '';
const API_BASE_STORAGE_KEY = 'xray_ui_api_base';
const ACCESS_KEY_STORAGE_KEY = 'xray_ui_access_key';
const CONNECTION_REFRESH_STORAGE_KEY = 'xray_ui_connection_refresh';
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
  subscriptions: {
    label: 'Subscriptions',
    title: 'Subscription updates',
    description: 'Edit the subscription block and schedule outbound/database refresh.'
  },
  rules: {
    label: 'Rules',
    title: 'Routing rule browser',
    description: 'Inspect router rules and load balancer policies over HTTP.'
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

const buildConicGradient = (items, colors) => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) return 'conic-gradient(rgba(28, 43, 42, 0.12) 0% 100%)';
  let current = 0;
  const segments = items.map((item, index) => {
    const percent = (item.value / total) * 100;
    const start = current;
    const end = current + percent;
    current = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  return `conic-gradient(${segments.join(', ')})`;
};

const CHART_COLORS = ['#ff6b4a', '#2f9aa0', '#f2b354', '#3b73d4', '#7cc57a', '#cf8450'];
const DASHBOARD_CACHE_WINDOW_MS = 30 * 1000;
const TRAFFIC_WINDOW = Math.max(2, Math.round(DASHBOARD_CACHE_WINDOW_MS / 1000));
const TRAFFIC_ANIMATION_MS = 1000;
const TRAFFIC_GRID_LINES = [40, 100, 160];
const TRAFFIC_CLIP_ID = 'traffic-clip';

const parseTimestamp = (value) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
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
  { key: 'protocol', label: 'Protocol', width: 'minmax(0, 1.2fr)', cellClassName: 'mono' },
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
  getInitialRefreshInterval,
  getStoredAccessKey,
  withAccessKey,
  appendAccessKeyParam,
  ABSOLUTE_URL_SCHEME_REGEX,
  RELATIVE_PATH_PREFIX_REGEX,
  getSubscriptionUrlDisplay,
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
  SUBSCRIPTION_OUTBOUND_TEMPLATE,
  SUBSCRIPTION_DATABASE_TEMPLATE,
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
  parseTimestamp,
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


