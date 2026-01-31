import React, { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { githubLight } from '@uiw/codemirror-theme-github';

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || '';
const API_BASE_STORAGE_KEY = 'xray_ui_api_base';
const ACCESS_KEY_STORAGE_KEY = 'xray_ui_access_key';
const CONNECTION_REFRESH_STORAGE_KEY = 'xray_ui_connection_refresh';
const ACCESS_KEY_HEADER = 'X-Access-Key';
const ACCESS_KEY_QUERY = 'access_key';
const ROUTING_DRAFT_STORAGE_KEY = 'xray_ui_routing_draft';
const ROUTING_DRAFT_NOTICE =
  'Unsaved rule edits are stored in your browser. Click Restart core to upload.';
const UI_STATE_SAVE_DELAY_MS = 600;
const MODAL_ANIMATION_MS = 200;
const CONNECTION_REFRESH_OPTIONS = [1, 2, 5, 10];
const DEFAULT_CONNECTION_REFRESH = 1;
const CONNECTION_SORT_ANIMATION_MS = 420;
const TRAFFIC_DIRECTION_HINTS = {
  upload: 'User -> Xray',
  download: 'Xray -> User'
};

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
  outboundTag: 'direct',
  balancerTag: 'balancer',
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

const getDestinationLabel = (meta, fallback = 'unknown') => meta?.host || meta?.destinationIP || fallback;
const getSourceLabel = (meta, fallback = '0.0.0.0') => meta?.sourceIP || fallback;
const getDetailDestinationLabel = (detail) => getDestinationLabel(detail?.metadata, 'unknown');
const getDetailSourceLabel = (detail) => getSourceLabel(detail?.metadata, '0.0.0.0');
const getDetailXraySrcLabel = (detail) => detail?.metadata?.xraySrcIP || '-';
const getDetailLastSeen = (detail) => detail?.lastSeen || detail?.last_seen || detail?.LastSeen || '';
const formatHostPort = (host, port) => {
  const hostValue = String(host || '').trim();
  const portValue = port === undefined || port === null ? '' : String(port).trim();
  if (!portValue) return hostValue;
  if (isLikelyIPv6(hostValue) && !hostValue.startsWith('[')) {
    return `[${hostValue}]:${portValue}`;
  }
  return `${hostValue}:${portValue}`;
};

const mergeLabel = (current, incoming) => {
  if (!current || current === 'unknown') return incoming || 'unknown';
  if (!incoming || incoming === 'unknown') return current;
  if (current === incoming) return current;
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
  { key: 'destination', label: 'Destination', width: '1.4fr', cellClassName: 'mono' },
  { key: 'source', label: 'Source', width: '1.1fr', cellClassName: 'mono' },
  { key: 'xraySrc', label: 'Xray Src', width: '1.1fr', cellClassName: 'mono' },
  { key: 'user', label: 'User', width: '0.8fr' },
  { key: 'inbound', label: 'Inbound', width: '0.8fr' },
  { key: 'outbound', label: 'Outbound', width: '0.8fr' },
  { key: 'protocol', label: 'Protocol', width: '0.9fr', cellClassName: 'mono' },
  {
    key: 'upload',
    label: 'Up',
    width: '0.6fr',
    cellClassName: 'mono',
    hint: TRAFFIC_DIRECTION_HINTS.upload
  },
  {
    key: 'download',
    label: 'Down',
    width: '0.6fr',
    cellClassName: 'mono',
    hint: TRAFFIC_DIRECTION_HINTS.download
  },
  { key: 'lastSeen', label: 'Last Seen', width: '1.1fr', cellClassName: 'mono' },
  { key: 'close', label: 'Close', width: '0.5fr', cellClassName: 'row-actions', headerClassName: 'detail-header-actions' }
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

const normalizeSettingsForm = (incoming) => {
  const next = {
    xrayGrpc: '',
    xrayMetrics: '',
    logFile: '',
    hotReloadFile: '',
    restartCommand: '',
    balancerTags: '',
    ...(incoming || {})
  };
  if (Array.isArray(next.balancerTags)) {
    next.balancerTags = next.balancerTags.join(', ');
  }
  if (!next.balancerTags) {
    next.balancerTags = '';
  }
  return next;
};

export default function App() {
  const [page, setPage] = useState(getPageFromHash());
  const [apiBase, setApiBase] = useState(getInitialApiBase());
  const [metricsHttp, setMetricsHttp] = useState(getInitialMetricsHttp());
  const [metricsAccessKey, setMetricsAccessKey] = useState(getInitialMetricsKey());
  const [accessKey, setAccessKey] = useState(getInitialAccessKey());
  const [connRefreshInterval, setConnRefreshInterval] = useState(getInitialRefreshInterval());
  const [connections, setConnections] = useState({ uploadTotal: 0, downloadTotal: 0, connections: [] });
  const [trafficSeries, setTrafficSeries] = useState([]);
  const [outbounds, setOutbounds] = useState([]);
  const [groups, setGroups] = useState([]);
  const [statusByTag, setStatusByTag] = useState({});
  const [groupSelections, setGroupSelections] = useState({});
  const [uiStateLoaded, setUiStateLoaded] = useState(false);
  const [uiStatePath, setUiStatePath] = useState('');
  const [status, setStatus] = useState('');
  const [connStreamStatus, setConnStreamStatus] = useState('connecting');
  const [connStreamPaused, setConnStreamPaused] = useState(false);
  const [connViewMode, setConnViewMode] = useState('current');
  const [connSortKey, setConnSortKey] = useState('default');
  const [connSortDir, setConnSortDir] = useState('desc');
  const [connRates, setConnRates] = useState(new Map());
  const [detailRates, setDetailRates] = useState(new Map());
  const [trafficShift, setTrafficShift] = useState(0);
  const [trafficShiftActive, setTrafficShiftActive] = useState(false);
  const [logStreamStatus, setLogStreamStatus] = useState('idle');
  const [logsDisabled, setLogsDisabled] = useState(true);
  const [logLines, setLogLines] = useState([]);
  const [rulesData, setRulesData] = useState({ rules: [], balancers: [], updatedAt: '' });
  const [rulesStatus, setRulesStatus] = useState('');
  const [configRules, setConfigRules] = useState([]);
  const [configBalancers, setConfigBalancers] = useState([]);
  const [configRulesStatus, setConfigRulesStatus] = useState('');
  const [configRulesPath, setConfigRulesPath] = useState('');
  const [configOutbounds, setConfigOutbounds] = useState([]);
  const [configOutboundsStatus, setConfigOutboundsStatus] = useState('');
  const [configOutboundsPath, setConfigOutboundsPath] = useState('');
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesModalVisible, setRulesModalVisible] = useState(false);
  const [rulesModalClosing, setRulesModalClosing] = useState(false);
  const [rulesModalMode, setRulesModalMode] = useState('edit');
  const [rulesModalTarget, setRulesModalTarget] = useState('rule');
  const [rulesModalIndex, setRulesModalIndex] = useState(-1);
  const [rulesModalText, setRulesModalText] = useState('');
  const [rulesModalStatus, setRulesModalStatus] = useState('');
  const [rulesModalInsertAfter, setRulesModalInsertAfter] = useState(-1);
  const [rulesModalSaving, setRulesModalSaving] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logLevel, setLogLevel] = useState('default');
  const [logsPaused, setLogsPaused] = useState(false);
  const [metricsKeyVisible, setMetricsKeyVisible] = useState(false);
  const [restartCooldown, setRestartCooldown] = useState(0);
  const [delayTestCooldown, setDelayTestCooldown] = useState(0);
  const [delayTestBusy, setDelayTestBusy] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [restartConfirmVisible, setRestartConfirmVisible] = useState(false);
  const [restartConfirmClosing, setRestartConfirmClosing] = useState(false);
  const [restartConfirmBusy, setRestartConfirmBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteConfirmClosing, setDeleteConfirmClosing] = useState(false);
  const [deleteConfirmBusy, setDeleteConfirmBusy] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState('');
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(-1);
  const [deleteConfirmLabel, setDeleteConfirmLabel] = useState('');
  const [expandedConnections, setExpandedConnections] = useState(() => new Set());
  const [detailColumnsVisible, setDetailColumnsVisible] = useState(
    () => new Set(DETAIL_COLUMNS.map((column) => column.key))
  );
  const [settingsPath, setSettingsPath] = useState('');
  const [startupInfo, setStartupInfo] = useState({ available: false, detail: '' });
  const [settingsStatus, setSettingsStatus] = useState('');
  const [settingsData, setSettingsData] = useState({
    xrayGrpc: '',
    xrayMetrics: '',
    logFile: '',
    hotReloadFile: '',
    restartCommand: '',
    balancerTags: ''
  });
  const logsRef = useRef(null);
  const logsPausedRef = useRef(false);
  const logPendingRef = useRef([]);
  const connStreamRef = useRef(null);
  const uiStateSaveRef = useRef(null);
  const lockedSelectionsRef = useRef(null);
  const uiStateHydratingRef = useRef(false);
  const connStreamFrameRef = useRef(null);
  const pendingConnRef = useRef(null);
  const trafficShiftRafRef = useRef(null);
  const connTotalsRef = useRef(new Map());
  const detailTotalsRef = useRef(new Map());
  const connRowRefs = useRef(new Map());
  const connRowRectsRef = useRef(new Map());
  const connRowFlipFrameRef = useRef(null);
  const rulesModalCloseTimerRef = useRef(null);
  const restartCooldownRef = useRef(null);
  const restartReloadRef = useRef(null);
  const delayTestCooldownRef = useRef(null);
  const delayTestTriggerRef = useRef(null);
  const restartConfirmCloseTimerRef = useRef(null);
  const deleteConfirmCloseTimerRef = useRef(null);

  const isRoutingDraftNotice = configRulesStatus
    ? configRulesStatus.includes(ROUTING_DRAFT_NOTICE)
    : false;

  const getRestartLabel = (label) => (
    restartCooldown > 0 ? `${label} (${restartCooldown}s)` : label
  );
  const getDelayTestLabel = (label) => {
    if (delayTestCooldown > 0) return `${label} (${delayTestCooldown}s)`;
    return label;
  };

  const applyApiBase = (value) => {
    const raw = String(value || '').trim();
    if (typeof window !== 'undefined') {
      if (raw) {
        window.localStorage.setItem(API_BASE_STORAGE_KEY, raw);
      } else {
        window.localStorage.removeItem(API_BASE_STORAGE_KEY);
      }
    }
    const nextBase = normalizeApiBase(raw);
    setApiBase(nextBase);
    return nextBase;
  };

  const applyAccessKey = (value) => {
    const raw = normalizeAccessKey(value);
    if (typeof window !== 'undefined') {
      if (raw) {
        window.localStorage.setItem(ACCESS_KEY_STORAGE_KEY, raw);
      } else {
        window.localStorage.removeItem(ACCESS_KEY_STORAGE_KEY);
      }
    }
    setAccessKey(raw);
    return raw;
  };

  const applyConnRefreshInterval = (value) => {
    const normalized = normalizeRefreshInterval(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CONNECTION_REFRESH_STORAGE_KEY, String(normalized));
    }
    setConnRefreshInterval(normalized);
    return normalized;
  };

  const connRefreshIntervalMs = connRefreshInterval * 1000;

  const totalSessions = useMemo(() => {
    return (connections.connections || []).reduce((sum, c) => sum + (c.connectionCount || 1), 0);
  }, [connections]);

  const totalConnections = connections.connections ? connections.connections.length : 0;

  const uniqueDestinations = useMemo(() => {
    const set = new Set();
    (connections.connections || []).forEach((conn) => {
      const label = getConnectionDestination(conn);
      set.add(label);
    });
    return set.size;
  }, [connections]);

  const topDestinations = useMemo(() => {
    const map = new Map();
    (connections.connections || []).forEach((conn) => {
      const label = getConnectionDestination(conn);
      const count = conn.connectionCount || 1;
      map.set(label, (map.get(label) || 0) + count);
    });
    const list = Array.from(map.entries()).map(([label, count]) => ({ label, count }));
    list.sort((a, b) => b.count - a.count);
    const trimmed = list.slice(0, 6);
    const maxCount = Math.max(...trimmed.map((item) => item.count), 1);
    return trimmed.map((item) => {
      const ratio = maxCount ? item.count / maxCount : 0;
      return {
        ...item,
        ratio,
        percent: ratio * 100
      };
    });
  }, [connections]);

  const outboundMix = useMemo(() => {
    const map = new Map();
    (outbounds || []).forEach((outbound) => {
      const label = outbound.type || outbound.tag || 'unknown';
      map.set(label, (map.get(label) || 0) + 1);
    });
    const list = Array.from(map.entries()).map(([label, value]) => ({ label, value }));
    list.sort((a, b) => b.value - a.value);
    return list;
  }, [outbounds]);

  const outboundTotal = useMemo(
    () => outboundMix.reduce((sum, item) => sum + item.value, 0),
    [outboundMix]
  );

  const runtimeOutboundsByTag = useMemo(() => {
    const map = new Map();
    (outbounds || []).forEach((ob) => {
      if (ob && ob.tag) {
        map.set(ob.tag, ob);
      }
    });
    return map;
  }, [outbounds]);

  const protocolMix = useMemo(() => {
    const map = new Map();
    (connections.connections || []).forEach((conn) => {
      (conn.details || []).forEach((detail) => {
        const label = detail.metadata?.network || detail.metadata?.type || 'unknown';
        map.set(label, (map.get(label) || 0) + 1);
      });
    });
    const list = Array.from(map.entries()).map(([label, value]) => ({ label, value }));
    list.sort((a, b) => b.value - a.value);
    const total = list.reduce((sum, item) => sum + item.value, 0);
    return list.map((item) => ({ ...item, percent: total ? (item.value / total) * 100 : 0 }));
  }, [connections]);

  const protocolTotal = useMemo(
    () => protocolMix.reduce((sum, item) => sum + item.value, 0),
    [protocolMix]
  );

  const throughputSeries = useMemo(
    () => trafficSeries.map((sample) => sample.up + sample.down),
    [trafficSeries]
  );

  const latestSample = trafficSeries.length ? trafficSeries[trafficSeries.length - 1] : null;
  const visibleSamples = Math.max(trafficSeries.length - 1, 0);
  const latestSpeed = latestSample ? latestSample.up + latestSample.down : 0;
  const peakSpeed = useMemo(
    () => Math.max(...throughputSeries, 0),
    [throughputSeries]
  );
  const averageSpeed = useMemo(() => {
    if (!throughputSeries.length) return 0;
    const total = throughputSeries.reduce((sum, value) => sum + value, 0);
    return total / throughputSeries.length;
  }, [throughputSeries]);
  const sessionPeak = useMemo(() => {
    const peaks = trafficSeries.map((sample) => sample.sessions || 0);
    return Math.max(...peaks, totalSessions || 0, 1);
  }, [trafficSeries, totalSessions]);

  const utilization = clamp(peakSpeed ? latestSpeed / peakSpeed : 0, 0, 1);
  const gaugeDegrees = utilization * 360;
  const totalTraffic = (connections.uploadTotal || 0) + (connections.downloadTotal || 0);
  const sessionRatio = clamp(sessionPeak ? totalSessions / sessionPeak : 0, 0, 1);
  const destinationRatio = clamp(totalConnections ? uniqueDestinations / totalConnections : 0, 0, 1);

  const trafficChart = useMemo(() => {
    const width = 520;
    const height = 200;
    const padding = 18;
    const step = TRAFFIC_WINDOW > 1 ? (width - padding * 2) / (TRAFFIC_WINDOW - 1) : 0;
    const maxValue = Math.max(
      ...trafficSeries.map((sample) => Math.max(sample.up, sample.down)),
      1
    );
    const buildFixedPoints = (values) => {
      if (!values || values.length === 0) return [];
      return values.map((value, index) => {
        const ratio = maxValue ? value / maxValue : 0;
        const x = padding + step * index;
        const y = height - padding - ratio * (height - padding * 2);
        return { x, y };
      });
    };
    const uploadPoints = buildFixedPoints(trafficSeries.map((sample) => sample.up));
    const downloadPoints = buildFixedPoints(trafficSeries.map((sample) => sample.down));
    const ticks = TRAFFIC_GRID_LINES.map((y) => {
      const ratio = clamp(1 - (y - padding) / (height - padding * 2), 0, 1);
      return { y, value: maxValue * ratio };
    });
    return {
      width,
      height,
      padding,
      step,
      maxValue,
      ticks,
      uploadLine: buildLinePath(uploadPoints),
      uploadArea: buildAreaPath(uploadPoints, height, padding),
      downloadLine: buildLinePath(downloadPoints),
      downloadArea: buildAreaPath(downloadPoints, height, padding)
    };
  }, [trafficSeries]);

  useEffect(() => {
    if (trafficShiftRafRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(trafficShiftRafRef.current);
      trafficShiftRafRef.current = null;
    }
    if (page !== 'dashboard') {
      setTrafficShiftActive(false);
      setTrafficShift(0);
      return undefined;
    }
    if (trafficSeries.length < TRAFFIC_WINDOW + 1 || !trafficChart.step) {
      setTrafficShiftActive(false);
      setTrafficShift(0);
      return undefined;
    }
    setTrafficShiftActive(false);
    setTrafficShift(0);
    if (typeof window === 'undefined') return undefined;
    trafficShiftRafRef.current = window.requestAnimationFrame(() => {
      trafficShiftRafRef.current = null;
      setTrafficShiftActive(true);
      setTrafficShift(-trafficChart.step);
    });
    return () => {
      if (trafficShiftRafRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(trafficShiftRafRef.current);
      }
      trafficShiftRafRef.current = null;
    };
  }, [page, trafficSeries, trafficChart.step]);

  const throughputSpark = useMemo(() => {
    const points = buildPoints(throughputSeries, 140, 40, 6);
    return buildLinePath(points);
  }, [throughputSeries]);

  const sessionsSpark = useMemo(() => {
    const points = buildPoints(
      trafficSeries.map((sample) => sample.sessions || 0),
      140,
      40,
      6
    );
    return buildLinePath(points);
  }, [trafficSeries]);

  const toggleExpanded = (id) => {
    setExpandedConnections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const registerConnRow = (id) => (node) => {
    if (id === null || id === undefined) return;
    if (!node) {
      connRowRefs.current.delete(id);
      return;
    }
    connRowRefs.current.set(id, node);
  };

  const toggleConnStream = () => {
    setConnStreamPaused((prev) => !prev);
  };

  const closeConnections = async (ids) => {
    const normalized = normalizeConnectionIds(ids);
    if (normalized.length === 0) return;
    try {
      await fetchJson(`${apiBase}/connections/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: normalized })
      });
      const latest = await fetchJson(`${apiBase}/connections`);
      startTransition(() => setConnections(latest));
    } catch (err) {
      console.warn('Failed to close connections:', err);
    }
  };

  const handleCloseGroup = (event, conn) => {
    event.preventDefault();
    event.stopPropagation();
    closeConnections((conn.details || []).map((detail) => detail.id));
  };

  const handleCloseDetail = (event, detail) => {
    event.preventDefault();
    event.stopPropagation();
    closeConnections([detail.id]);
  };

  const renderDetailCell = (columnKey, detail, detailRate) => {
    switch (columnKey) {
      case 'destination':
        return formatHostPort(
          getDetailDestinationLabel(detail),
          detail.metadata?.destinationPort
        );
      case 'source':
        return formatHostPort(
          getDetailSourceLabel(detail),
          detail.metadata?.sourcePort
        );
      case 'xraySrc':
        return formatHostPort(
          getDetailXraySrcLabel(detail),
          detail.metadata?.xraySrcPort
        );
      case 'user':
        return detail.metadata?.user || '-';
      case 'inbound':
        return detail.metadata?.inboundTag || '-';
      case 'outbound':
        return detail.metadata?.outboundTag || '-';
      case 'protocol':
        return (detail.metadata?.network || '-') + '/' + (detail.metadata?.type || '-')
          + ((detail.rule || detail.rulePayload)
            ? ` · ${detail.rule || detail.rulePayload}`
            : '');
      case 'upload':
        return formatRateOrSplice(detailRate?.upload || 0, isSpliceType(detail?.metadata?.type));
      case 'download':
        return formatRateOrSplice(detailRate?.download || 0, isSpliceType(detail?.metadata?.type));
      case 'lastSeen':
        return formatTime(getDetailLastSeen(detail));
      case 'close':
        return (
          <button
            type="button"
            className="conn-close"
            onClick={(event) => handleCloseDetail(event, detail)}
            title="Close this connection"
          >
            Close
          </button>
        );
      default:
        return '-';
    }
  };

  const toggleConnSort = (key) => {
    if (!key || key === 'default') return;
    if (connSortKey === key) {
      setConnSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    const field = CONNECTION_SORT_FIELDS[key];
    const nextDir = field?.type === 'string' ? 'asc' : 'desc';
    setConnSortKey(key);
    setConnSortDir(nextDir);
  };

  const renderSortHeader = (label, key, hint) => {
    const isActive = connSortKey === key;
    const indicator = isActive ? (connSortDir === 'asc' ? '▲' : '▼') : '↕';
    const sortLabel = hint ? `${label} (${hint})` : label;
    return (
      <button
        type="button"
        className={`sort-header ${isActive ? 'active' : ''}`}
        onClick={() => toggleConnSort(key)}
        title={`Sort by ${sortLabel}`}
        aria-label={`Sort by ${sortLabel}`}
      >
        <span>{label}</span>
        <span className="sort-indicator" aria-hidden="true">{indicator}</span>
      </button>
    );
  };

  const toggleDetailColumn = (key) => {
    if (!key) return;
    setDetailColumnsVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const detailVisibleColumns = useMemo(
    () => DETAIL_COLUMNS.filter((column) => detailColumnsVisible.has(column.key)),
    [detailColumnsVisible]
  );

  const detailGridTemplate = useMemo(() => {
    const columns = detailVisibleColumns.length ? detailVisibleColumns : DETAIL_COLUMNS;
    return columns.map((column) => column.width).join(' ');
  }, [detailVisibleColumns]);

  const detailGridStyle = useMemo(
    () => ({ '--detail-columns': detailGridTemplate }),
    [detailGridTemplate]
  );

  const isDashboardPage = page === 'dashboard';
  const isConnectionsPage = page === 'connections';
  const shouldStreamConnections = isDashboardPage || isConnectionsPage;
  const connStreamLabel = connStreamPaused
    ? 'paused'
    : connStreamStatus;
  const pageMeta = PAGES[page] || PAGES.connections;

  const displayConnections = useMemo(() => {
    return buildConnectionsView(connections.connections || [], connViewMode);
  }, [connections, connViewMode]);

  const sortedConnections = useMemo(() => {
    if (!isConnectionsPage) return [];
    const list = displayConnections || [];
    if (connSortKey === 'default' || !CONNECTION_SORT_FIELDS[connSortKey]) return list;
    const dir = connSortDir === 'asc' ? 1 : -1;
    const field = CONNECTION_SORT_FIELDS[connSortKey];
    const getValue = (conn) => {
      if (connSortKey === 'upload') {
        return connRates.get(conn.id)?.upload || 0;
      }
      if (connSortKey === 'download') {
        return connRates.get(conn.id)?.download || 0;
      }
      return field.getValue(conn);
    };
    return [...list].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      if (field.type !== 'number') {
        return (
          String(aValue).localeCompare(String(bValue), undefined, {
            numeric: true,
            sensitivity: 'base'
          }) * dir
        );
      }
      const diff = (aValue || 0) - (bValue || 0);
      if (Number.isNaN(diff)) return 0;
      return diff * dir;
    });
  }, [displayConnections, connRates, connSortKey, connSortDir, isConnectionsPage]);

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

  const setConfigStatus = (target, message) => {
    if (target === 'outbound') {
      setConfigOutboundsStatus(message);
    } else {
      setConfigRulesStatus(message);
    }
  };

  const refresh = async (base = apiBase) => {
    setStatus('Refreshing...');
    try {
      const [conn, out] = await Promise.all([
        fetchJson(`${base}/connections`),
        fetchNodes(base)
      ]);
      setConnections(conn);
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
      if (resp.settings) {
        const normalized = normalizeSettingsForm(resp.settings);
        setSettingsData(normalized);
      }
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
      setGroupSelections(
        normalized.nodesLocked && Object.keys(normalized.nodesLocked).length > 0
          ? normalized.nodesLocked
          : {}
      );
      lockedSelectionsRef.current = normalized.nodesLocked || null;
      if (typeof normalized.logsDisabled === 'boolean') {
        setLogsDisabled(normalized.logsDisabled);
      }
      if (typeof normalized.logsPaused === 'boolean') {
        setLogsPaused(normalized.logsPaused);
      }
      if (typeof normalized.autoScroll === 'boolean') {
        setAutoScroll(normalized.autoScroll);
      }
      if (normalized.logLevel) {
        setLogLevel(normalized.logLevel);
      }
      if (normalized.connViewMode) {
        setConnViewMode(normalized.connViewMode);
      }
      if (typeof normalized.connStreamPaused === 'boolean') {
        setConnStreamPaused(normalized.connStreamPaused);
      }
      if (normalized.connSortKey) {
        setConnSortKey(normalized.connSortKey);
      }
      if (normalized.connSortDir) {
        setConnSortDir(normalized.connSortDir);
      }
      if (normalized.detailColumns) {
        setDetailColumnsVisible(new Set(normalized.detailColumns));
      }
    } catch (_err) {
      // ignore ui state load failures
    } finally {
      uiStateHydratingRef.current = false;
      setUiStateLoaded(true);
    }
  };

  const loadLogConfig = async (base = apiBase) => {
    try {
      const resp = await fetchJson(`${base}/logs/config`);
      if (typeof resp.level === 'string' && resp.level) {
        setLogLevel(resp.level);
        return;
      }
      if (typeof resp.debug === 'boolean') {
        setLogLevel(resp.debug ? 'debug' : 'default');
      }
    } catch (_err) {
      // ignore log config failures
    }
  };

  const applyLogLevel = async (next) => {
    const prev = logLevel;
    setLogLevel(next);
    try {
      await fetchJson(`${apiBase}/logs/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: next })
      });
    } catch (_err) {
      setLogLevel(prev);
    }
  };

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '#/dashboard';
      setPage('dashboard');
    }
    const onHash = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeoutRef(rulesModalCloseTimerRef);
      clearIntervalRef(restartCooldownRef);
      clearTimeoutRef(restartReloadRef);
      clearIntervalRef(delayTestCooldownRef);
      clearTimeoutRef(delayTestTriggerRef);
      clearTimeoutRef(restartConfirmCloseTimerRef);
      clearTimeoutRef(deleteConfirmCloseTimerRef);
      if (connRowFlipFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(connRowFlipFrameRef.current);
        connRowFlipFrameRef.current = null;
      }
      clearTimeoutRef(uiStateSaveRef);
    };
  }, []);

  useEffect(() => {
    refresh();
    loadSettings();
    loadUiState();
  }, [apiBase]);

  useEffect(() => {
    if (page !== 'logs') return;
    loadLogConfig();
  }, [page, apiBase]);

  useEffect(() => {
    setTrafficSeries([]);
  }, [apiBase]);

  useEffect(() => {
    if (!uiStateLoaded || uiStateHydratingRef.current) return;
    const payload = buildUiStatePayload({
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
    });
    scheduleUiStateSave(payload, apiBase);
  }, [
    uiStateLoaded,
    groupSelections,
    logsDisabled,
    logsPaused,
    autoScroll,
    logLevel,
    connViewMode,
    connStreamPaused,
    connSortKey,
    connSortDir,
    detailColumnsVisible,
    apiBase
  ]);

  const normalizeGroupStrategy = (value) => String(value || '').trim().toLowerCase();
  const getGroupStrategy = (group) => normalizeGroupStrategy(group?.strategy);
  const getFallbackTag = (group) => String(group?.fallbackTag || '').trim();
  const isManualGroup = (group) => {
    if (typeof group?.manualSelectable === 'boolean') {
      return group.manualSelectable;
    }
    const strategy = getGroupStrategy(group);
    return strategy === 'selector' || strategy === 'leastping';
  };
  const getGroupModeLabel = (group) => {
    const strategy = getGroupStrategy(group);
    const hasFallback = !!getFallbackTag(group);
    if (!strategy || strategy === 'unknown') return hasFallback ? 'auto+fallback' : 'auto';
    if (strategy === 'selector') return hasFallback ? 'manual+fallback' : 'manual';
    if (strategy === 'leastping') return hasFallback ? 'auto+manual(leastping)+fallback' : 'auto+manual(leastping)';
    if (strategy === 'fallback') return 'auto(fallback)';
    const base = `auto(${strategy})`;
    return hasFallback ? `${base}+fallback` : base;
  };
  const getGroupSelectedTags = (group, selected) => {
    if (group?.overrideTarget) {
      const overrideTag = String(group.overrideTarget || '').trim();
      return overrideTag ? [overrideTag] : [];
    }
    const pendingTag = groupSelections[group?.tag];
    if (pendingTag) {
      return [pendingTag];
    }
    const fallbackTag = getFallbackTag(group);
    const excludeFallback = !isManualGroup(group) && !!fallbackTag;
    const raw = isManualGroup(group)
      ? (selected ? [selected] : [])
      : (Array.isArray(group?.principleTargets) ? group.principleTargets : []);
    const seen = new Set();
    return raw.filter((tag) => {
      const value = String(tag || '').trim();
      if (!value || seen.has(value)) return false;
      if (excludeFallback && value === fallbackTag) return false;
      seen.add(value);
      return true;
    });
  };

  useEffect(() => {
    if (!groups || groups.length === 0) {
      return;
    }
    setGroupSelections((prev) => {
      const next = { ...prev };
      groups.forEach((group) => {
        if (!group || !group.tag) return;
        if (!isManualGroup(group)) {
          if (next[group.tag]) {
            delete next[group.tag];
          }
          return;
        }
        const fallback =
          group.overrideTarget ||
          (group.principleTargets && group.principleTargets[0]) ||
          '';
        if (!next[group.tag]) {
          if (fallback) {
            next[group.tag] = fallback;
          }
          return;
        }
        if (group.overrideTarget && next[group.tag] !== group.overrideTarget) {
          next[group.tag] = group.overrideTarget;
        }
      });
      return next;
    });
  }, [groups]);

  const queueConnectionUpdate = (payload) => {
    const nextPayload = isDashboardPage
      ? pruneConnectionsPayload(payload, Date.now())
      : payload;
    if (typeof window === 'undefined' || !window.requestAnimationFrame) {
      startTransition(() => setConnections(nextPayload));
      return;
    }
    pendingConnRef.current = nextPayload;
    if (connStreamFrameRef.current !== null) return;
    connStreamFrameRef.current = window.requestAnimationFrame(() => {
      connStreamFrameRef.current = null;
      const next = pendingConnRef.current;
      pendingConnRef.current = null;
      if (next) {
        startTransition(() => setConnections(next));
      }
    });
  };

  useEffect(() => {
    if (connStreamRef.current) {
      connStreamRef.current.close();
      connStreamRef.current = null;
    }
    if (!shouldStreamConnections || connStreamPaused) {
      if (connStreamFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(connStreamFrameRef.current);
      }
      connStreamFrameRef.current = null;
      pendingConnRef.current = null;
      setConnStreamStatus(connStreamPaused ? 'paused' : 'idle');
      return undefined;
    }
    const url = appendAccessKeyParam(
      `${apiBase}/connections/stream?interval=${connRefreshIntervalMs}`,
      accessKey
    );
    const es = new EventSource(url);
    connStreamRef.current = es;
    setConnStreamStatus('connecting');

    es.onopen = () => {
      setConnStreamStatus('live');
    };
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setConnStreamStatus('live');
        queueConnectionUpdate(data);
      } catch (err) {
        // ignore malformed payloads
      }
    };
    es.onerror = () => {
      setConnStreamStatus('reconnecting');
    };

    return () => {
      es.close();
      if (connStreamFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(connStreamFrameRef.current);
      }
      connStreamFrameRef.current = null;
      pendingConnRef.current = null;
      if (connStreamRef.current === es) {
        connStreamRef.current = null;
      }
    };
  }, [apiBase, connStreamPaused, shouldStreamConnections, accessKey, connRefreshIntervalMs]);

  useEffect(() => {
    const now = Date.now();
    setTrafficSeries((prev) => {
      const uploadTotal = connections.uploadTotal || 0;
      const downloadTotal = connections.downloadTotal || 0;
      const last = prev[prev.length - 1];
      const prevUpload = last ? last.totalUp : uploadTotal;
      const prevDownload = last ? last.totalDown : downloadTotal;
      const up = Math.max(0, uploadTotal - prevUpload);
      const down = Math.max(0, downloadTotal - prevDownload);
      const next = [
        ...prev,
        {
          time: now,
          up,
          down,
          totalUp: uploadTotal,
          totalDown: downloadTotal,
          sessions: totalSessions
        }
      ];
      const cutoff = now - DASHBOARD_CACHE_WINDOW_MS;
      const pruned = next.filter((sample) => sample.time >= cutoff);
      if (pruned.length > TRAFFIC_WINDOW + 1) {
        return pruned.slice(-(TRAFFIC_WINDOW + 1));
      }
      return pruned;
    });
  }, [connections, totalSessions]);

  useEffect(() => {
    if (!isConnectionsPage) return;
    const now = Date.now();
    const nextConnRates = new Map();
    const nextConnTotals = new Map();
    const nextDetailRates = new Map();
    const nextDetailTotals = new Map();

    (displayConnections || []).forEach((conn) => {
      const currentUpload = conn.upload || 0;
      const currentDownload = conn.download || 0;
      const prev = connTotalsRef.current.get(conn.id);
      let uploadRate = 0;
      let downloadRate = 0;
      if (prev) {
        const elapsed = (now - prev.time) / 1000;
        if (elapsed > 0) {
          uploadRate = Math.max(0, currentUpload - prev.upload) / elapsed;
          downloadRate = Math.max(0, currentDownload - prev.download) / elapsed;
        }
      }
      nextConnRates.set(conn.id, { upload: uploadRate, download: downloadRate });
      nextConnTotals.set(conn.id, { upload: currentUpload, download: currentDownload, time: now });

      (conn.details || []).forEach((detail, idx) => {
        const detailKey = getDetailKey(conn.id, detail, idx);
        const detailUpload = detail.upload || 0;
        const detailDownload = detail.download || 0;
        const prevDetail = detailTotalsRef.current.get(detailKey);
        let detailUploadRate = 0;
        let detailDownloadRate = 0;
        if (prevDetail) {
          const elapsed = (now - prevDetail.time) / 1000;
          if (elapsed > 0) {
            detailUploadRate = Math.max(0, detailUpload - prevDetail.upload) / elapsed;
            detailDownloadRate = Math.max(0, detailDownload - prevDetail.download) / elapsed;
          }
        }
        nextDetailRates.set(detailKey, { upload: detailUploadRate, download: detailDownloadRate });
        nextDetailTotals.set(detailKey, { upload: detailUpload, download: detailDownload, time: now });
      });
    });

    connTotalsRef.current = nextConnTotals;
    detailTotalsRef.current = nextDetailTotals;
    setConnRates(nextConnRates);
    setDetailRates(nextDetailRates);
  }, [displayConnections, isConnectionsPage]);

  useEffect(() => {
    connTotalsRef.current = new Map();
    detailTotalsRef.current = new Map();
    setConnRates(new Map());
    setDetailRates(new Map());
  }, [isConnectionsPage, connViewMode]);

  useEffect(() => {
    if (page !== 'logs') {
      setLogStreamStatus('idle');
      logPendingRef.current = [];
      if (logsPaused) {
        setLogsPaused(false);
      }
      return undefined;
    }
    if (logsDisabled) {
      setLogStreamStatus('disabled');
      setLogLines([]);
      logPendingRef.current = [];
      if (logsPaused) {
        setLogsPaused(false);
      }
      return undefined;
    }
    const url = appendAccessKeyParam(
      `${apiBase}/logs/stream?tail=200&level=${encodeURIComponent(logLevel)}`,
      accessKey
    );
    const es = new EventSource(url);
    setLogStreamStatus('connecting');

    es.onopen = () => {
      setLogStreamStatus('live');
    };
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'init') {
          const incoming = toNewestFirst(payload.lines || []);
          if (logsPausedRef.current) {
            const next = [...incoming, ...logPendingRef.current].slice(0, LOG_MAX_LINES);
            logPendingRef.current = next;
            return;
          }
          setLogLines(incoming.slice(0, LOG_MAX_LINES));
        } else if (payload.type === 'append') {
          const incoming = toNewestFirst(payload.lines || []);
          if (incoming.length === 0) {
            return;
          }
          if (logsPausedRef.current) {
            const next = [...incoming, ...logPendingRef.current].slice(0, LOG_MAX_LINES);
            logPendingRef.current = next;
            return;
          }
          setLogLines((prev) => [...incoming, ...prev].slice(0, LOG_MAX_LINES));
        } else if (payload.type === 'error') {
          setLogStreamStatus('error');
        }
      } catch (err) {
        // ignore
      }
    };
    es.onerror = () => {
      setLogStreamStatus('reconnecting');
    };

    return () => {
      es.close();
    };
  }, [page, apiBase, logsDisabled, logLevel, accessKey]);

  useEffect(() => {
    logsPausedRef.current = logsPaused;
    if (logsPaused) {
      return;
    }
    const pending = logPendingRef.current;
    if (pending.length === 0) {
      return;
    }
    logPendingRef.current = [];
    setLogLines((prev) => [...pending, ...prev].slice(0, LOG_MAX_LINES));
  }, [logsPaused]);

  useEffect(() => {
    if (!autoScroll || !logsRef.current) return;
    logsRef.current.scrollTop = 0;
  }, [logLines, autoScroll]);

  useEffect(() => {
    setExpandedConnections(new Set());
  }, [connViewMode]);

  useEffect(() => {
    if (isConnectionsPage) return;
    connRowRectsRef.current = new Map();
    if (connRowFlipFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(connRowFlipFrameRef.current);
      connRowFlipFrameRef.current = null;
    }
  }, [isConnectionsPage]);

  useLayoutEffect(() => {
    if (!isConnectionsPage || typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const nextRects = new Map();
      connRowRefs.current.forEach((node, id) => {
        if (!node) return;
        nextRects.set(id, node.getBoundingClientRect());
      });
      connRowRectsRef.current = nextRects;
      return;
    }
    if (connRowFlipFrameRef.current !== null) {
      window.cancelAnimationFrame(connRowFlipFrameRef.current);
      connRowFlipFrameRef.current = null;
    }

    const prevRects = connRowRectsRef.current;
    const nextRects = new Map();
    connRowRefs.current.forEach((node, id) => {
      if (!node) return;
      nextRects.set(id, node.getBoundingClientRect());
    });

    nextRects.forEach((next, id) => {
      const prev = prevRects.get(id);
      const node = connRowRefs.current.get(id);
      if (!node || !prev) return;
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (!dx && !dy) return;
      node.style.setProperty('--row-offset-x', `${dx}px`);
      node.style.setProperty('--row-offset-y', `${dy}px`);
      node.style.transition = 'transform 0s';
      node.style.willChange = 'transform';
    });

    connRowFlipFrameRef.current = window.requestAnimationFrame(() => {
      connRowFlipFrameRef.current = null;
      nextRects.forEach((next, id) => {
        const prev = prevRects.get(id);
        const node = connRowRefs.current.get(id);
        if (!node || !prev) return;
        const dx = prev.left - next.left;
        const dy = prev.top - next.top;
        if (!dx && !dy) return;
        node.style.transition = `transform ${CONNECTION_SORT_ANIMATION_MS}ms var(--ease-smooth)`;
        node.style.setProperty('--row-offset-x', '0px');
        node.style.setProperty('--row-offset-y', '0px');
        node.addEventListener(
          'transitionend',
          () => {
            node.style.transition = '';
            node.style.willChange = '';
          },
          { once: true }
        );
      });
    });

    connRowRectsRef.current = nextRects;
  }, [sortedConnections, isConnectionsPage]);

  useEffect(() => {
    if (page !== 'rules') return;
    setRulesStatus('Loading...');
    fetchRules(apiBase)
      .then(() => setRulesStatus(''))
      .catch((err) => setRulesStatus(`Rules failed: ${err.message}`));
    loadRulesConfig(apiBase).catch(() => {});
  }, [page, apiBase]);

  useEffect(() => {
    if (page !== 'nodes') return;
    loadOutboundsConfig(apiBase).catch(() => {});
  }, [page, apiBase]);

  const loadRules = async (base = apiBase) => {
    setRulesStatus('Loading...');
    try {
      await fetchRules(base);
      setRulesStatus('Loaded');
    } catch (err) {
      setRulesStatus(`Rules failed: ${err.message}`);
    }
    loadRulesConfig(base).catch(() => {});
  };

  const getRuleLabel = (rule, index) => {
    const tag = rule?.ruleTag || rule?.outboundTag || rule?.balancerTag || '';
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

  const openRulesModal = (target, mode, index = -1, afterIndex = -1, item = null) => {
    const normalizedAfter = Number.isFinite(Number(afterIndex)) ? Number(afterIndex) : -1;
    const template = target === 'rule'
      ? RULE_TEMPLATE
      : target === 'balancer'
        ? BALANCER_TEMPLATE
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
        : (Array.isArray(configOutbounds) ? configOutbounds : []);
    if (index < 0 || index >= items.length) {
      setConfigStatus(target, `Delete failed: ${target} index out of range.`);
      return;
    }
    const label = target === 'rule'
      ? getRuleLabel(items[index], index)
      : target === 'balancer'
        ? getBalancerLabel(items[index], index)
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

  const deleteConfigItem = async (target, index) => {
    const nextItems = target === 'rule'
      ? (Array.isArray(configRules) ? [...configRules] : [])
      : target === 'balancer'
        ? (Array.isArray(configBalancers) ? [...configBalancers] : [])
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
      setConfigStatus(target, `${target} deleted. Restart core to apply.`);
      fetchRules(apiBase).catch(() => {});
    } catch (err) {
      setConfigStatus(target, `Delete failed: ${err.message}`);
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
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setRulesModalStatus('Rule must be a JSON object.');
      return;
    }

    const target = rulesModalTarget;
    const nextItems = target === 'rule'
      ? (Array.isArray(configRules) ? [...configRules] : [])
      : target === 'balancer'
        ? (Array.isArray(configBalancers) ? [...configBalancers] : [])
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
      setConfigStatus(target, 'Saved to config. Restart core to apply.');
      setRulesModalStatus('Saved');
      closeRulesModal({ force: true });
      fetchRules(apiBase).catch(() => {});
    } catch (err) {
      setRulesModalStatus(`Save failed: ${err.message}`);
    } finally {
      setRulesModalSaving(false);
    }
  };

  const applyOverride = async (balancer, target, options = {}) => {
    const { allowEmpty = false } = options;
    const balancerTag = String(balancer || '').trim();
    const targetTag = String(target || '').trim();
    if (!balancerTag || (!allowEmpty && !targetTag)) {
      setStatus('Balancer tag and target are required.');
      return;
    }
    const targetLabel = targetTag ? targetTag : 'auto';
    setStatus(`Applying override ${balancerTag} -> ${targetLabel}...`);
    try {
      await fetchJson(`${apiBase}/balancer/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balancerTag, target: targetTag })
      });
      setStatus(targetTag ? 'Override applied' : 'Override cleared');
      fetchNodes(apiBase).catch(() => {});
    } catch (err) {
      setStatus(`Override failed: ${err.message}`);
    }
  };

  const clearGroupOverride = (group) => {
    if (!group || !group.tag) return;
    setGroupSelections((prev) => {
      const next = { ...prev };
      delete next[group.tag];
      return next;
    });
    applyOverride(group.tag, '', { allowEmpty: true });
  };

  const selectGroupTarget = (group, target) => {
    if (!group || group.error) return;
    const groupTag = String(group.tag || '').trim();
    const targetTag = String(target || '').trim();
    if (!groupTag || !targetTag) return;
    setGroupSelections((prev) => ({ ...prev, [groupTag]: targetTag }));
    if (group.overrideTarget === targetTag) return;
    applyOverride(groupTag, targetTag);
  };

  const getGroupCandidates = (group) => {
    const strategy = getGroupStrategy(group);
    const preferOutbounds = strategy === 'leastping';
    let list = !preferOutbounds && group && group.principleTargets && group.principleTargets.length > 0
      ? group.principleTargets
      : (outbounds || []).map((ob) => ob.tag);
    const fallbackTag = getFallbackTag(group);
    if (fallbackTag && !list.includes(fallbackTag)) {
      list = [...list, fallbackTag];
    }
    const seen = new Set();
    return list.filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  };

  useEffect(() => {
    if (!uiStateLoaded) return;
    const locked = lockedSelectionsRef.current;
    if (!locked || !groups || groups.length === 0) return;
    const pending = [];
    groups.forEach((group) => {
      const groupTag = String(group?.tag || '').trim();
      if (!groupTag) return;
      const lockedTarget = String(locked[groupTag] || '').trim();
      if (!lockedTarget) return;
      if (!isManualGroup(group)) return;
      const candidates = getGroupCandidates(group);
      if (candidates.length > 0 && !candidates.includes(lockedTarget)) return;
      if (group.overrideTarget === lockedTarget) return;
      pending.push({ tag: groupTag, target: lockedTarget });
    });
    lockedSelectionsRef.current = null;
    if (pending.length === 0) return;
    pending.forEach((item) => {
      applyOverride(item.tag, item.target);
    });
  }, [groups, uiStateLoaded]);

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

  const schedulePostRestartRefresh = (base = apiBase) => {
    const delays = [1500, 4000, 8000];
    delays.forEach((delay) => {
      window.setTimeout(() => {
        refresh(base);
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

  const renderRulesModal = () => {
    if (!rulesModalVisible || typeof document === 'undefined') return null;
    const modalState = rulesModalClosing ? 'closing' : 'open';
    const modalTarget = rulesModalTarget;
    const modalItems = modalTarget === 'rule'
      ? configRules
      : modalTarget === 'balancer'
        ? configBalancers
        : configOutbounds;
    const modalLabel = modalTarget === 'rule'
      ? getRuleLabel
      : modalTarget === 'balancer'
        ? getBalancerLabel
        : getOutboundLabel;
    const modalTitle = modalTarget === 'rule'
      ? 'rule'
      : modalTarget === 'balancer'
        ? 'balancer'
        : 'outbound';
    return createPortal(
      <div
        className="modal-backdrop rules-modal-backdrop"
        role="dialog"
        aria-modal="true"
        data-state={modalState}
      >
        <div className="modal rules-modal" data-state={modalState}>
          <div className="modal-header">
            <div>
              <h3>
                {rulesModalMode === 'edit'
                  ? `Edit ${modalTitle} #${rulesModalIndex + 1}`
                  : `Insert new ${modalTitle}`}
              </h3>
              <p className="group-meta">
                {rulesModalMode === 'edit'
                  ? `Update JSON and choose where to place this ${modalTitle}.`
                  : 'Edit the template, then choose where to insert (numbers match the list).'}
              </p>
            </div>
            <button className="ghost small" onClick={closeRulesModal}>Close</button>
          </div>
          {rulesModalMode === 'insert' || rulesModalMode === 'edit' ? (
            <div className="rules-modal-row">
              <label className="rules-modal-label" htmlFor="rules-insert-position">
                Position
              </label>
              <select
                id="rules-insert-position"
                value={rulesModalInsertAfter}
                onChange={(event) => setRulesModalInsertAfter(Number(event.target.value))}
              >
                <option value={-1}>Top</option>
                {modalItems.map((item, index) => (
                  <option key={`after-${index}`} value={index}>
                    {`After ${modalLabel(item, index)}`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="rules-modal-editor">
            <CodeMirror
              value={rulesModalText}
              height="260px"
              theme={githubLight}
              extensions={[
                json(),
                lintGutter(),
                linter(jsonParseLinter()),
                EditorView.lineWrapping
              ]}
              onChange={(value) => {
                setRulesModalText(value);
                if (rulesModalStatus) {
                  setRulesModalStatus('');
                }
              }}
              aria-label="Edit JSON"
            />
          </div>
          <div className="rules-modal-footer">
            <span className="status">{rulesModalStatus}</span>
            <button
              className="primary small"
              onClick={saveRulesModal}
              disabled={rulesModalSaving}
            >
              {rulesModalSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderRestartConfirm = () => {
    if (!restartConfirmVisible || typeof document === 'undefined') return null;
    const modalState = restartConfirmClosing ? 'closing' : 'open';
    return createPortal(
      <div className="modal-backdrop" role="dialog" aria-modal="true" data-state={modalState}>
        <div className="modal confirm-modal" data-state={modalState}>
          <div className="modal-header">
            <div>
              <h3>Restart core?</h3>
              <p className="group-meta">
                This will restart the Xray core. Pending routing edits will be uploaded first.
              </p>
            </div>
            <button
              className="ghost small"
              onClick={closeRestartConfirm}
            >
              Close
            </button>
          </div>
          <div className="confirm-actions">
            <button
              className="ghost small"
              onClick={closeRestartConfirm}
            >
              Cancel
            </button>
            <button
              className="danger small"
              onClick={confirmRestart}
              disabled={restartConfirmBusy}
            >
              Restart core
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderDeleteConfirm = () => {
    if (!deleteConfirmVisible || typeof document === 'undefined') return null;
    const modalState = deleteConfirmClosing ? 'closing' : 'open';
    const targetLabel = deleteConfirmTarget === 'rule'
      ? 'routing rule'
      : deleteConfirmTarget === 'balancer'
        ? 'balancer'
        : 'outbound';
    const titleLabel = deleteConfirmLabel || targetLabel;
    return createPortal(
      <div className="modal-backdrop" role="dialog" aria-modal="true" data-state={modalState}>
        <div className="modal confirm-modal" data-state={modalState}>
          <div className="modal-header">
            <div>
              <h3>{`Delete ${titleLabel}?`}</h3>
              <p className="group-meta">
                {`This will remove the ${targetLabel} from the config. Restart core to apply.`}
              </p>
            </div>
            <button
              className="ghost small"
              onClick={closeDeleteConfirm}
            >
              Close
            </button>
          </div>
          <div className="confirm-actions">
            <button
              className="ghost small"
              onClick={closeDeleteConfirm}
            >
              Cancel
            </button>
            <button
              className="danger small"
              onClick={confirmDelete}
              disabled={deleteConfirmBusy}
            >
              Delete
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const stageClassName = [
    'stage',
    page === 'settings' ? 'stage-settings' : '',
    page === 'connections' ? 'stage-connections' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={stageClassName}>
      <header className="hero">
        <div className="hero-main">
          <p className="eyebrow">Xray Control</p>
          <h1 className={page === 'connections' ? 'nowrap' : ''}>{pageMeta.title}</h1>
          <p className={`subhead ${page === 'connections' ? 'nowrap' : ''}`}>{pageMeta.description}</p>
          <nav className="nav">
            {Object.entries(PAGES).map(([key, value]) => (
              <a
                key={key}
                href={`#/${key}`}
                className={page === key ? 'active' : ''}
              >
                {value.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="hero-stats">
          <div className="stat-card">
            <span>Upload</span>
            <strong>{formatBytes(connections.uploadTotal)}</strong>
          </div>
          <div className="stat-card">
            <span>Download</span>
            <strong>{formatBytes(connections.downloadTotal)}</strong>
          </div>
          <div className="stat-card">
            <span>Sessions</span>
            <strong>{totalSessions}</strong>
          </div>
        </div>
      </header>

      <section className="content">
        {page === 'dashboard' && (
          <div className="dashboard-grid">
            <section className="panel span-12" style={{ '--delay': '0.05s' }}>
              <div className="panel-header">
                <div>
                  <h2>Operations snapshot</h2>
                  <p>Instant readouts from live sessions and outbound topology.</p>
                </div>
                <div className="header-actions">
                  <button
                    className={`pill ${connStreamLabel}`}
                    onClick={toggleConnStream}
                    title={connStreamPaused ? 'Resume live updates' : 'Pause live updates'}
                  >
                    {connStreamLabel}
                  </button>
                </div>
              </div>
              <div className="metric-grid">
                <div className="metric-card">
                  <span className="metric-label">Current throughput</span>
                  <strong className="metric-value">{formatRate(latestSpeed)}</strong>
                  <span className="metric-meta">Avg {formatRate(averageSpeed)}</span>
                  <div className="meter">
                    <span style={{ transform: `scaleX(${utilization})` }} />
                  </div>
                  <svg className="sparkline accent" viewBox="0 0 140 40" aria-hidden="true">
                    <path d={throughputSpark} />
                  </svg>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Peak window</span>
                  <strong className="metric-value">{formatRate(peakSpeed)}</strong>
                  <span className="metric-meta">Total {formatBytes(totalTraffic)}</span>
                  <div className="meter">
                    <span style={{ transform: 'scaleX(1)' }} />
                  </div>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Active sessions</span>
                  <strong className="metric-value">{totalSessions}</strong>
                  <span className="metric-meta">{totalConnections} active connections</span>
                  <div className="meter">
                    <span style={{ transform: `scaleX(${sessionRatio})` }} />
                  </div>
                  <svg className="sparkline teal" viewBox="0 0 140 40" aria-hidden="true">
                    <path d={sessionsSpark} />
                  </svg>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Unique destinations</span>
                  <strong className="metric-value">{uniqueDestinations}</strong>
                  <span className="metric-meta">{outbounds.length} outbounds online</span>
                  <div className="meter">
                    <span style={{ transform: `scaleX(${destinationRatio})` }} />
                  </div>
                </div>
              </div>
            </section>

            <section className="panel span-7 chart-panel" style={{ '--delay': '0.08s' }}>
              <div className="panel-header">
                <div>
                  <h2>Traffic tempo</h2>
                  <p>Live throughput per second, upload vs download.</p>
                </div>
                <div className="chart-meta">
                  <span className="meta-pill">Now {formatRate(latestSpeed)}</span>
                  <span className="meta-pill">Peak {formatRate(peakSpeed)}</span>
                </div>
              </div>
              <div className="chart-wrap">
                {trafficSeries.length < 2 ? (
                  <div className="chart-empty">Waiting for live samples...</div>
                ) : (
                  <svg
                    className="traffic-chart"
                    viewBox={`0 0 ${trafficChart.width} ${trafficChart.height}`}
                    role="img"
                    aria-label="Throughput chart"
                  >
                    <defs>
                      <linearGradient id="uploadGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ff6b4a" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#ff6b4a" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="downloadGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#2f9aa0" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#2f9aa0" stopOpacity="0.02" />
                      </linearGradient>
                      <clipPath id={TRAFFIC_CLIP_ID} clipPathUnits="userSpaceOnUse">
                        <rect
                          x={trafficChart.padding}
                          y={trafficChart.padding}
                          width={trafficChart.width - trafficChart.padding * 2}
                          height={trafficChart.height - trafficChart.padding * 2}
                        />
                      </clipPath>
                    </defs>
                    <g className="chart-grid">
                      {trafficChart.ticks.map((tick) => (
                        <line
                          key={`grid-${tick.y}`}
                          x1={trafficChart.padding}
                          y1={tick.y}
                          x2={trafficChart.width - trafficChart.padding}
                          y2={tick.y}
                        />
                      ))}
                    </g>
                    <g className="chart-axis">
                      {trafficChart.ticks.map((tick) => (
                        <text key={`tick-${tick.y}`} x={trafficChart.padding - 6} y={tick.y}>
                          {formatRate(tick.value)}
                        </text>
                      ))}
                    </g>
                    <g
                      className={`chart-motion${trafficShiftActive ? '' : ' snap'}`}
                      style={{
                        '--shift': `${trafficShift}px`,
                        '--duration': `${TRAFFIC_ANIMATION_MS}ms`
                      }}
                      clipPath={`url(#${TRAFFIC_CLIP_ID})`}
                    >
                      {trafficChart.downloadArea && (
                        <path d={trafficChart.downloadArea} fill="url(#downloadGradient)" />
                      )}
                      {trafficChart.uploadArea && (
                        <path d={trafficChart.uploadArea} fill="url(#uploadGradient)" />
                      )}
                      {trafficChart.downloadLine && (
                        <path d={trafficChart.downloadLine} className="line download" />
                      )}
                      {trafficChart.uploadLine && (
                        <path d={trafficChart.uploadLine} className="line upload" />
                      )}
                    </g>
                  </svg>
                )}
              </div>
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="swatch upload" />
                  Upload {formatRate(latestSample ? latestSample.up : 0)}
                </div>
                <div className="legend-item">
                  <span className="swatch download" />
                  Download {formatRate(latestSample ? latestSample.down : 0)}
                </div>
                <div className="legend-item">
                  <span className="swatch neutral" />
                  Samples {visibleSamples}
                </div>
              </div>
            </section>

            <section className="panel span-5 chart-panel" style={{ '--delay': '0.1s' }}>
              <div className="panel-header">
                <div>
                  <h2>Session health</h2>
                  <p>Utilization ratio and live stability indicators.</p>
                </div>
              </div>
              <div className="gauge-wrap">
                <div
                  className="gauge-ring"
                  style={{ '--value': `${gaugeDegrees}deg` }}
                />
                <div className="gauge-center">
                  <span className="gauge-label">Utilization</span>
                  <strong>{Math.round(utilization * 100)}%</strong>
                  <span className="gauge-meta">{formatRate(latestSpeed)} live</span>
                </div>
              </div>
              <div className="gauge-stats">
                <div>
                  <span>Average</span>
                  <strong>{formatRate(averageSpeed)}</strong>
                </div>
                <div>
                  <span>Sessions</span>
                  <strong>{totalSessions}</strong>
                </div>
                <div>
                  <span>Stream</span>
                  <strong>{connStreamPaused ? 'Paused' : connStreamLabel}</strong>
                </div>
              </div>
            </section>

            <section className="panel span-7 chart-panel" style={{ '--delay': '0.12s' }}>
                <div className="panel-header">
                  <div>
                    <h2>Top destinations</h2>
                    <p>Most active destinations by connection count.</p>
                  </div>
                </div>
                {topDestinations.length === 0 ? (
                  <div className="chart-empty">No destination traffic yet.</div>
                ) : (
                <div className="bar-chart horizontal">
                  {topDestinations.map((item, index) => (
                    <div className="bar-item horizontal" key={`${item.label}-${index}`}>
                      <div className="bar-header">
                        <span className="bar-label" title={item.label}>
                          {truncateLabel(item.label, 22)}
                        </span>
                        <span className="bar-value">
                          {Math.round(item.percent)}% ({item.count})
                        </span>
                      </div>
                      <div className="bar-rod horizontal">
                        <span
                          className="bar-fill horizontal"
                          style={{ width: `${item.percent}%`, '--fill': item.ratio }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel span-5 chart-panel" style={{ '--delay': '0.14s' }}>
              <div className="panel-header">
                <div>
                  <h2>Outbound mix</h2>
                  <p>Distribution of available outbound types.</p>
                </div>
              </div>
              <div className="donut-wrap">
                <div
                  className="donut"
                  style={{ background: buildConicGradient(outboundMix, CHART_COLORS) }}
                >
                  <div className="donut-center">
                    <span>Total</span>
                    <strong>{outboundTotal}</strong>
                  </div>
                </div>
                <div className="legend">
                  {outboundMix.length === 0 ? (
                    <div className="legend-empty">No outbounds loaded.</div>
                  ) : (
                    outboundMix.map((item, index) => (
                      <div className="legend-row" key={`${item.label}-${index}`}>
                        <span
                          className="legend-dot"
                          style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span>{item.label}</span>
                        <span className="legend-value">
                          {Math.round(
                            (item.value / outboundTotal) * 100
                          )}
                          %
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="panel span-12 chart-panel" style={{ '--delay': '0.16s' }}>
              <div className="panel-header">
                <div>
                  <h2>Protocol split</h2>
                  <p>Connections by network or transport type.</p>
                </div>
                <div className="chart-meta">
                  <span className="meta-pill">Total {protocolTotal}</span>
                </div>
              </div>
              {protocolMix.length === 0 ? (
                <div className="chart-empty">No protocol detail yet.</div>
              ) : (
                <div className="split-list">
                  {protocolMix.map((item, index) => (
                    <div className="split-row" key={`${item.label}-${index}`}>
                      <span className="split-label">{item.label}</span>
                      <div className="split-track">
                        <span
                          className="split-fill"
                          style={{
                            transform: `scaleX(${clamp(item.percent / 100, 0, 1)})`,
                            background: CHART_COLORS[index % CHART_COLORS.length]
                          }}
                        />
                      </div>
                      <span className="split-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {page === 'connections' && (
          <div className="panel connections-panel" style={{ '--delay': '0.05s' }}>
            <div className="panel-header">
              <div>
                <h2>Live Connections</h2>
              </div>
              <div className="header-actions">
                <span className="header-note">
                  Grouped by source IP and destination host/IP. Upload: User -&gt; Xray. Download: Xray -&gt; User.
                </span>
                <div className="view-toggle">
                  <button
                    type="button"
                    className={`view-pill ${connViewMode === 'current' ? 'active' : ''}`}
                    onClick={() => setConnViewMode('current')}
                  >
                    Current
                  </button>
                  <button
                    type="button"
                    className={`view-pill ${connViewMode === 'source' ? 'active' : ''}`}
                    onClick={() => setConnViewMode('source')}
                  >
                    Source
                  </button>
                  <button
                    type="button"
                    className={`view-pill ${connViewMode === 'destination' ? 'active' : ''}`}
                    onClick={() => setConnViewMode('destination')}
                  >
                    Destination
                  </button>
                </div>
                <button
                  type="button"
                  className={`pill ${connStreamLabel}`}
                  onClick={toggleConnStream}
                  title={connStreamPaused ? 'Resume live updates' : 'Pause live updates'}
                >
                  {connStreamLabel}
                </button>
              </div>
            </div>
            <div className="connections-table-wrap">
              <div className="table connections-table">
              <div className="row header">
                {renderSortHeader('Destination', 'destination')}
                {renderSortHeader('Source', 'source')}
                {renderSortHeader('Sessions', 'sessions')}
                {renderSortHeader('Upload', 'upload', TRAFFIC_DIRECTION_HINTS.upload)}
                {renderSortHeader('Download', 'download', TRAFFIC_DIRECTION_HINTS.download)}
                <span></span>
              </div>
              {sortedConnections.map((conn) => {
                const detailIds = (conn.details || []).map((detail) => detail.id);
                const canClose = detailIds.length > 0;
                const isExpanded = expandedConnections.has(conn.id);
                const connActivity = getRateActivity(connRates.get(conn.id), CONNECTION_ACTIVITY_SCALE);
                const connIsSplice = isSpliceType(conn?.metadata?.type);
                const connStyle = { '--activity': String(connActivity) };
                return (
                <React.Fragment key={conn.id}>
                  <div
                    className={`row clickable ${isExpanded ? 'expanded' : ''}`}
                    style={connStyle}
                    ref={registerConnRow(conn.id)}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpanded(conn.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpanded(conn.id);
                      }
                    }}
                  >
                    <span className="mono">
                      {getConnectionDestination(conn)}
                    </span>
                    <span className="mono">{getConnectionSource(conn)}</span>
                    <span className="mono">{conn.connectionCount || 1}</span>
                    <span className="mono">
                      {formatRateOrSplice(connRates.get(conn.id)?.upload || 0, connIsSplice)}
                    </span>
                    <span className="mono">
                      {formatRateOrSplice(connRates.get(conn.id)?.download || 0, connIsSplice)}
                    </span>
                    <span className="row-actions">
                      <button
                        type="button"
                        className="conn-close"
                        onClick={(event) => handleCloseGroup(event, conn)}
                        disabled={!canClose}
                        title={canClose ? 'Close all connections in this group' : 'No connections to close'}
                      >
                        Close
                      </button>
                      <span className="chevron">{isExpanded ? '▾' : '▸'}</span>
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="detail-wrap" style={detailGridStyle}>
                      <div className="detail-categories">
                        <span className="detail-categories-label">Columns</span>
                      <div className="detail-categories-list">
                        {DETAIL_COLUMNS.map((column) => {
                          const isVisible = detailColumnsVisible.has(column.key);
                          const columnHint = column.hint ? ` (${column.hint})` : '';
                          return (
                              <button
                                key={column.key}
                                type="button"
                                className={`detail-category ${isVisible ? 'active' : 'inactive'}`}
                                onClick={() => toggleDetailColumn(column.key)}
                                title={`${isVisible ? 'Hide' : 'Show'} ${column.label}${columnHint}`}
                                aria-pressed={isVisible}
                              >
                                {column.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="detail-row header">
                        {detailVisibleColumns.map((column) => (
                          <button
                            key={column.key}
                            type="button"
                            className={`detail-header-toggle ${column.headerClassName || ''}`}
                            onClick={() => toggleDetailColumn(column.key)}
                            title={`Hide ${column.label}${column.hint ? ` (${column.hint})` : ''}`}
                            aria-label={`Hide ${column.label}${column.hint ? ` (${column.hint})` : ''}`}
                          >
                            {column.label}
                          </button>
                        ))}
                      </div>
                      {(conn.details || []).map((detail, idx) => {
                        const detailKey = getDetailKey(conn.id, detail, idx);
                        const detailRate = detailRates.get(detailKey);
                        const detailActivity = getRateActivity(detailRate, DETAIL_ACTIVITY_SCALE);
                        const detailStyle = { '--activity': String(detailActivity) };
                        return (
                        <div className="detail-row" key={detailKey} style={detailStyle}>
                          {detailVisibleColumns.map((column) => (
                            <span
                              key={`${detailKey}-${column.key}`}
                              className={column.cellClassName || ''}
                            >
                              {renderDetailCell(column.key, detail, detailRate)}
                            </span>
                          ))}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
                );
              })}
              </div>
            </div>
          </div>
        )}

        {page === 'nodes' && (
          <div className="panel" style={{ '--delay': '0.12s' }}>
            <div className="panel-header">
              <div>
                <h2>Nodes & Policies</h2>
                <p>Clash-style policy groups with live outbound health.</p>
              </div>
              <div className="header-actions">
                <button className="ghost" onClick={() => refresh()}>Refresh</button>
                {status ? <span className="status">{status}</span> : null}
              </div>
            </div>

            {groups.length === 0 ? (
              <div className="empty-state">
                <h3>No policy groups configured</h3>
                <p>Set BALANCER_TAGS in Settings to render Clash-style strategies.</p>
              </div>
            ) : (
              <div className="nodes-grid">
                {groups.map((group) => {
                  const candidates = getGroupCandidates(group);
                  const manualGroup = isManualGroup(group);
                  const fallbackTag = getFallbackTag(group);
                  const rawSelected = manualGroup
                    ? (groupSelections[group.tag]
                      || group.overrideTarget
                      || (candidates.length > 0 ? candidates[0] : ''))
                    : '';
                  const selected = manualGroup
                    ? (candidates.includes(rawSelected)
                      ? rawSelected
                      : (candidates.length > 0 ? candidates[0] : ''))
                    : '';
                  const selectedTags = getGroupSelectedTags(group, selected);
                  const selectedSet = new Set(selectedTags);
                  const current = group.overrideTarget
                    || (group.principleTargets && group.principleTargets[0])
                    || 'auto';
                  const modeLabel = group.overrideTarget ? 'override' : getGroupModeLabel(group);
                  const canManualSelect = !group.error;
                  const canClearOverride = !!group.overrideTarget && !group.error;
                  const pendingSelection = groupSelections[group.tag];
                  return (
                    <div className="group-card" key={group.tag}>
                      <div className="group-header">
                        <div>
                          <h3>{group.tag}</h3>
                          <p className="group-meta">Mode: {modeLabel} | Current: {current}</p>
                          {group.error ? (
                            <p className="group-error">{group.error}</p>
                          ) : null}
                        </div>
                        {group.overrideTarget ? (
                          <button
                            className="ghost small"
                            onClick={() => clearGroupOverride(group)}
                            disabled={!canClearOverride}
                            title="Clear manual override"
                          >
                            Auto
                          </button>
                        ) : null}
                      </div>
                      {candidates.length === 0 ? (
                        <div className="empty-state small">
                          <p>No candidates detected for this balancer.</p>
                        </div>
                      ) : (
                        <div className="chip-grid">
                          {candidates.map((tag) => {
                            const nodeStatus = statusByTag[tag];
                            const alive = nodeStatus ? nodeStatus.alive : null;
                            const delay = nodeStatus ? formatDelay(nodeStatus.delay) : '';
                            const isFallbackTag = fallbackTag && tag === fallbackTag;
                            const isActive = selectedSet.has(tag)
                              && (!isFallbackTag || group.overrideTarget === tag || pendingSelection === tag);
                            const canSelectTag = canManualSelect;
                            return (
                              <button
                                type="button"
                                key={`${group.tag}-${tag}`}
                                className={`chip ${isActive ? 'active' : ''}`}
                                onClick={() => selectGroupTarget(group, tag)}
                                disabled={!canSelectTag}
                              >
                                <span className="chip-label">{tag}</span>
                                {nodeStatus ? (
                                  <span className={`status-pill ${alive ? 'up' : 'down'}`}>
                                    {alive ? delay : 'down'}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="nodes-subheader">
              <div>
                <h3>All outbounds</h3>
                {configOutboundsPath ? (
                  <p className="group-meta mono">Config: {configOutboundsPath}</p>
                ) : null}
              </div>
              <div className="header-actions">
                <button
                  className="primary small"
                  onClick={triggerDelayTest}
                  disabled={delayTestCooldown > 0 || delayTestBusy}
                >
                  {getDelayTestLabel('Latency test')}
                </button>
                <button
                  className="primary small"
                  onClick={triggerRestart}
                  disabled={restartCooldown > 0}
                >
                  {getRestartLabel('Restart core')}
                </button>
                <button className="primary small" onClick={() => openRulesModal('outbound', 'insert')}>
                  Add outbound
                </button>
                {configOutboundsStatus ? <span className="status">{configOutboundsStatus}</span> : null}
              </div>
            </div>
            {configOutbounds.length === 0 ? (
              <div className="empty-state small">
                <p>No outbounds configured.</p>
              </div>
            ) : (
              <div className="outbound-grid">
                {(configOutbounds || []).map((ob, index) => {
                  const tag = ob?.tag || '';
                  const runtime = tag ? runtimeOutboundsByTag.get(tag) : null;
                  const protocol = ob?.protocol || runtime?.type || 'unknown';
                  const nodeStatus = tag ? statusByTag[tag] : null;
                  const alive = nodeStatus ? nodeStatus.alive : null;
                  const delay = nodeStatus ? formatDelay(nodeStatus.delay) : '';
                  return (
                    <div className="outbound-card" key={tag || `outbound-${index}`}>
                      <div className="outbound-info">
                        <div className="outbound-title">
                          <span className="rule-index">{index + 1}</span>
                          <h3>{tag || '(no tag)'}</h3>
                        </div>
                        <p>{protocol}</p>
                      </div>
                      <div className="outbound-side">
                        <div className="outbound-meta">
                          {nodeStatus ? (
                            <span className={`status-pill ${alive ? 'up' : 'down'}`}>
                              {alive ? delay : 'down'}
                            </span>
                          ) : (
                            <span className="meta-pill">no status</span>
                          )}
                        </div>
                        <div className="outbound-actions">
                          <button
                            className="ghost small danger-text"
                            onClick={() => openDeleteConfirm('outbound', index)}
                          >
                            Delete
                          </button>
                          <button
                            className="ghost small"
                            onClick={() => openRulesModal('outbound', 'edit', index, index, ob)}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {page === 'rules' && (
          <section className="panel rules" style={{ '--delay': '0.18s' }}>
            <div className="panel-header">
              <div>
                <h2>Rule Browser</h2>
                <p>Edit routing rules and inspect balancers reported by the router module.</p>
              </div>
              <div className="header-actions">
                <div className="header-status">
                  {rulesStatus ? <span className="status">{rulesStatus}</span> : null}
                  {configRulesStatus ? (
                    <span className={`status${isRoutingDraftNotice ? ' status-danger' : ''}`}>
                      {configRulesStatus}
                    </span>
                  ) : null}
                </div>
                <button
                  className="primary small"
                  onClick={triggerRestart}
                  disabled={restartCooldown > 0}
                >
                  {getRestartLabel('Restart core')}
                </button>
                <button className="primary small" onClick={() => openRulesModal('rule', 'insert')}>
                  Add rule
                </button>
                <button className="primary small" onClick={() => openRulesModal('balancer', 'insert')}>
                  Add balancer
                </button>
              </div>
            </div>

            <div className="rules-grid">
              <div className="group-card">
                <div className="group-header">
                  <div>
                    <h3>Routing rules</h3>
                    <p className="group-meta">Total {configRules.length}</p>
                    {configRulesPath ? (
                      <p className="group-meta mono">Config: {configRulesPath}</p>
                    ) : null}
                  </div>
                  <div className="rules-editor-actions">
                    <button className="ghost small" onClick={() => loadRulesConfig(apiBase)}>
                      Reload config
                    </button>
                  </div>
                </div>
                {configRules.length === 0 ? (
                  <div className="empty-state small">
                    <p>No routing rules configured.</p>
                  </div>
                ) : (
                  <div className="rules-list">
                    {configRules.map((rule, index) => {
                      const ruleTag = rule.ruleTag || '';
                      const key = `rule:${ruleTag || index}`;
                      const target = rule.outboundTag || rule.targetTag || '';
                      const balancer = rule.balancerTag || '';
                      return (
                        <div className="rule-item" key={key}>
                          <div className="rule-summary">
                            <div>
                              <div className="rule-title">
                                <span className="rule-index">{index + 1}</span>
                                <h4 className="mono">{ruleTag || '(no ruleTag)'}</h4>
                              </div>
                              <p className="rule-meta">
                                {target ? `Target: ${target}` : 'Target: -'}
                                {balancer ? ` · Balancer: ${balancer}` : ''}
                              </p>
                            </div>
                            <div className="rule-actions">
                              <button
                                className="ghost small danger-text"
                                onClick={() => openDeleteConfirm('rule', index)}
                              >
                                Delete
                              </button>
                              <button
                                className="ghost small"
                                onClick={() => openRulesModal('rule', 'edit', index, index, rule)}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="group-card">
                <div className="group-header">
                  <div>
                    <h3>Balancers</h3>
                    <p className="group-meta">Total {configBalancers.length}</p>
                    {configRulesPath ? (
                      <p className="group-meta mono">Config: {configRulesPath}</p>
                    ) : null}
                  </div>
                  <div className="rules-editor-actions">
                    <button className="ghost small" onClick={() => loadRulesConfig(apiBase)}>
                      Reload config
                    </button>
                  </div>
                </div>
                {configBalancers.length === 0 ? (
                  <div className="empty-state small">
                    <p>No balancers configured.</p>
                  </div>
                ) : (
                  <div className="rules-list">
                    {configBalancers.map((balancer, index) => {
                      const tag = balancer.tag || '';
                      const key = `balancer:${tag || index}`;
                      const selectors = Array.isArray(balancer.selector)
                        ? balancer.selector
                        : Array.isArray(balancer.selectors)
                          ? balancer.selectors
                          : [];
                      return (
                        <div className="rule-item" key={key}>
                          <div className="rule-summary">
                            <div>
                              <div className="rule-title">
                                <span className="rule-index">{index + 1}</span>
                                <h4 className="mono">{tag || '(no tag)'}</h4>
                              </div>
                              <p className="rule-meta">
                                {balancer.strategy ? `Strategy: ${balancer.strategy}` : 'Strategy: -'}
                                {balancer.fallbackTag ? ` · Fallback: ${balancer.fallbackTag}` : ''}
                              </p>
                              {selectors.length > 0 ? (
                                <p className="rule-meta">Selectors: {selectors.join(', ')}</p>
                              ) : null}
                            </div>
                            <div className="rule-actions">
                              <button
                                className="ghost small danger-text"
                                onClick={() => openDeleteConfirm('balancer', index)}
                              >
                                Delete
                              </button>
                              <button
                                className="ghost small"
                                onClick={() => openRulesModal('balancer', 'edit', index, index, balancer)}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {rulesData.updatedAt ? (
              <div className="rules-footer">Updated {rulesData.updatedAt}</div>
            ) : null}
          </section>
        )}

        {page === 'logs' && (
          <section className="panel logs" style={{ '--delay': '0.2s' }}>
            <div className="panel-header">
              <div>
                <h2>Logs</h2>
                <p>Streaming live logs from the remote core.</p>
              </div>
              <div className="log-controls">
                <button
                  type="button"
                  className={`pill ${logsDisabled ? 'paused' : logStreamStatus}`}
                  onClick={() => setLogsDisabled((prev) => !prev)}
                  title={logsDisabled ? 'Enable log streaming' : 'Disable log streaming'}
                >
                  {logsDisabled ? 'disabled' : logStreamStatus}
                </button>
                <button
                  type="button"
                  className={`pill ${logsPaused ? 'paused' : 'live'}`}
                  onClick={() => setLogsPaused((prev) => !prev)}
                  title={logsPaused ? 'Resume log updates' : 'Pause log updates'}
                >
                  {logsPaused ? 'resume' : 'pause'}
                </button>
                <select
                  className={`pill log-level-select ${logLevel === 'default' ? 'paused' : 'live'}`}
                  value={logLevel}
                  onChange={(event) => applyLogLevel(event.target.value)}
                  title="Set log level"
                  aria-label="Log level"
                >
                  {LOG_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`pill ${autoScroll ? 'live' : 'paused'}`}
                  onClick={() => setAutoScroll((prev) => !prev)}
                  title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
                >
                  {autoScroll ? 'auto-scroll' : 'manual'}
                </button>
              </div>
            </div>
            <div className="log-view" ref={logsRef}>
              {logLines.length === 0 ? (
                <div className="log-empty">
                  {logsDisabled
                    ? 'Logs are disabled. Toggle to start.'
                    : 'No logs yet.'}
                </div>
              ) : (
                logLines.map((line, idx) => (
                  <div
                    className={`log-line ${getLogLineLevelClass(line)}`}
                    key={`${idx}-${line.slice(0, 16)}`}
                  >
                    {renderLogLine(line)}
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {page === 'settings' && (
          <section className="panel settings" style={{ '--delay': '0.18s' }}>
            <div className="panel-header">
              <div>
                <h2>Settings</h2>
                <p>Control actions and runtime status.</p>
              </div>
              <button
                className="ghost"
                onClick={triggerRestart}
                disabled={restartCooldown > 0}
              >
                {getRestartLabel('Reload')}
              </button>
            </div>

            <div className="settings-inline">
              <div className="control-block">
                <label>Metrics HTTP</label>
                <input
                  value={metricsHttp}
                  onChange={(e) => setMetricsHttp(e.target.value)}
                  placeholder="http://127.0.0.1:8080"
                />
                <span className="hint">Leave empty to use the default base.</span>
              </div>

              <div className="control-block">
                <label>Metrics Access Key</label>
                <div className="input-with-action">
                  <input
                    type={metricsKeyVisible ? 'text' : 'password'}
                    value={metricsAccessKey}
                    onChange={(e) => setMetricsAccessKey(e.target.value)}
                    placeholder="optional"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="ghost small icon-button"
                    onClick={() => setMetricsKeyVisible((prev) => !prev)}
                    title={metricsKeyVisible ? 'Hide key' : 'Show key'}
                    aria-label={metricsKeyVisible ? 'Hide key' : 'Show key'}
                  >
                    {metricsKeyVisible ? '🙈' : '👁️'}
                  </button>
                </div>
                <span className="hint">Optional. Sent as X-Access-Key header (streams use access_key).</span>
              </div>

              <div className="control-block">
                <label>Connections auto refresh</label>
                <select
                  value={connRefreshInterval}
                  onChange={(e) => applyConnRefreshInterval(e.target.value)}
                  aria-label="Connections auto refresh"
                >
                  {CONNECTION_REFRESH_OPTIONS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds}s
                    </option>
                  ))}
                </select>
                <span className="hint">Applies immediately to the live connections stream.</span>
              </div>
            </div>

            <div className="settings-actions">
              <div className="settings-buttons">
                <button
                  className="ghost"
                  type="button"
                  onClick={() => {
                    applyApiBase(metricsHttp);
                    applyAccessKey(metricsAccessKey);
                    setSettingsStatus('Metrics settings updated.');
                  }}
                >
                  Apply
                </button>
                <button
                  className="danger"
                  onClick={triggerRestart}
                  disabled={restartCooldown > 0}
                >
                  {getRestartLabel('Restart core')}
                </button>
              </div>
              <div className="settings-meta">
                <span className="status">{settingsStatus}</span>
                {settingsPath ? <span className="status">Config: {settingsPath}</span> : null}
                {uiStatePath ? <span className="status">UI state: {uiStatePath}</span> : null}
                {startupInfo.available ? (
                  <span className="status">Startup info: ready</span>
                ) : startupInfo.detail ? (
                  <span className="status">Startup info: {startupInfo.detail}</span>
                ) : null}
              </div>
            </div>
          </section>
        )}
      </section>
      {renderRulesModal()}
      {renderDeleteConfirm()}
      {renderRestartConfirm()}
    </div>
  );
}
