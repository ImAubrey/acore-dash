import React, { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createNodeGroupHelpers } from './features/nodes/groupHelpers';
import { HeroHeader } from './features/layout/HeroHeader';
import { MainPanels } from './features/layout/MainPanels';
import { useBalancerOverrides } from './features/nodes/useBalancerOverrides';
import { useSubscriptionConfig } from './features/subscriptions/useSubscriptionConfig';
import { useConfigDataLoaders } from './features/settings/useConfigDataLoaders';
import { useUiStatePersistence } from './features/settings/useUiStatePersistence';
import { useControlActions } from './features/settings/useControlActions';
import { useConnectionsViewModel } from './features/connections/useConnectionsViewModel';
import { useConnectionTelemetry } from './features/connections/useConnectionTelemetry';
import { useRulesModalCrud } from './features/rules/useRulesModalCrud';
import { useLogsStream } from './features/logs/useLogsStream';
import { createDetailCellRenderer } from './features/connections/detailCellRenderer';
import {
  DEFAULT_API_BASE,
  API_BASE_STORAGE_KEY,
  ACCESS_KEY_STORAGE_KEY,
  CONNECTION_REFRESH_STORAGE_KEY,
  ACCESS_KEY_HEADER,
  ACCESS_KEY_QUERY,
  ROUTING_DRAFT_STORAGE_KEY,
  ROUTING_DRAFT_NOTICE,
  MODAL_ANIMATION_MS,
  CONNECTION_REFRESH_OPTIONS,
  DEFAULT_CONNECTION_REFRESH,
  TRAFFIC_DIRECTION_HINTS,
  ZEBRA_ROW_BACKGROUNDS,
  ZEBRA_DETAIL_BACKGROUNDS,
  parseRoutingDraft,
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
  TRAFFIC_WINDOW,
  TRAFFIC_ANIMATION_MS,
  TRAFFIC_GRID_LINES,
  TRAFFIC_CLIP_ID,
  parseTimestamp,
  getConnectionStats,
  normalizeConnectionsPayload,
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
  buildUiStatePayload,
  isLikelyIPv6,
  isLogIpToken,
  getLogLineLevelClass,
  renderLogLine
} from './dashboardShared';

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
  const [connSearchQuery, setConnSearchQuery] = useState('');
  const [ruleSearchQuery, setRuleSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
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
  const [configSubscriptionInbound, setConfigSubscriptionInbound] = useState('');
  const [configSubscriptionOutbounds, setConfigSubscriptionOutbounds] = useState([]);
  const [configSubscriptionDatabases, setConfigSubscriptionDatabases] = useState([]);
  const [configSubscriptionFull, setConfigSubscriptionFull] = useState([]);
  const [configSubscriptionStatus, setConfigSubscriptionStatus] = useState('');
  const [configSubscriptionPath, setConfigSubscriptionPath] = useState('');
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
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalClosing, setInfoModalClosing] = useState(false);
  const [infoModalTitle, setInfoModalTitle] = useState('');
  const [infoModalText, setInfoModalText] = useState('');
  const [infoModalStatus, setInfoModalStatus] = useState('');
  const [expandedConnections, setExpandedConnections] = useState(() => new Set());
  const [detailColumnsVisible, setDetailColumnsVisible] = useState(
    () => new Set(DETAIL_COLUMNS.map((column) => column.key))
  );
  const [settingsPath, setSettingsPath] = useState('');
  const [startupInfo, setStartupInfo] = useState({ available: false, detail: '' });
  const [restartInfo, setRestartInfo] = useState(null);
  const [hotReloadBusy, setHotReloadBusy] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState('');
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
  const rulesModalCloseTimerRef = useRef(null);
  const restartCooldownRef = useRef(null);
  const restartReloadRef = useRef(null);
  const delayTestCooldownRef = useRef(null);
  const delayTestTriggerRef = useRef(null);
  const restartConfirmCloseTimerRef = useRef(null);
  const deleteConfirmCloseTimerRef = useRef(null);
  const infoModalCloseTimerRef = useRef(null);

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

  const connectionStats = useMemo(() => getConnectionStats(connections), [connections]);
  const activeConnections = connectionStats.connections;
  const totalSessions = connectionStats.totalSessions;
  const totalConnections = connectionStats.totalConnections;

  const uniqueDestinations = useMemo(() => {
    const set = new Set();
    activeConnections.forEach((conn) => {
      const label = getConnectionDestination(conn);
      set.add(label);
    });
    return set.size;
  }, [activeConnections]);

  const topDestinations = useMemo(() => {
    const map = new Map();
    activeConnections.forEach((conn) => {
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
  }, [activeConnections]);

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

  const normalizeTag = (value) => String(value || '').trim();

  const runtimeOutboundsByTag = useMemo(() => {
    const map = new Map();
    (outbounds || []).forEach((ob) => {
      if (ob && ob.tag) {
        map.set(ob.tag, ob);
      }
    });
    return map;
  }, [outbounds]);

  const runtimeOutboundTags = useMemo(() => {
    const seen = new Set();
    const list = [];
    (outbounds || []).forEach((ob) => {
      const tag = normalizeTag(ob?.tag);
      if (!tag || seen.has(tag)) return;
      seen.add(tag);
      list.push(tag);
    });
    return list;
  }, [outbounds]);

  const configOutboundTags = useMemo(() => {
    const seen = new Set();
    const list = [];
    (configOutbounds || []).forEach((ob) => {
      const tag = normalizeTag(ob?.tag);
      if (!tag || seen.has(tag)) return;
      seen.add(tag);
      list.push(tag);
    });
    return list;
  }, [configOutbounds]);

  const displayOutbounds = useMemo(() => {
    const seenConfigTags = new Set();
    const list = [];
    (configOutbounds || []).forEach((ob, index) => {
      const tag = normalizeTag(ob?.tag);
      if (tag) {
        seenConfigTags.add(tag);
      }
      list.push({
        key: tag ? `config:${tag}:${index}` : `config-index:${index}`,
        tag,
        configIndex: index,
        configOutbound: ob
      });
    });

    const runtimeOnly = [];
    (runtimeOutboundTags || []).forEach((tag) => {
      if (!tag || seenConfigTags.has(tag)) return;
      runtimeOnly.push({
        key: `runtime:${tag}`,
        tag,
        configIndex: -1,
        configOutbound: null
      });
    });

    return [...list, ...runtimeOnly];
  }, [configOutbounds, runtimeOutboundTags]);

  const allOutboundTags = useMemo(() => {
    const seen = new Set();
    const list = [];
    [...(configOutboundTags || []), ...(runtimeOutboundTags || [])].forEach((rawTag) => {
      const tag = normalizeTag(rawTag);
      if (!tag || seen.has(tag)) return;
      seen.add(tag);
      list.push(tag);
    });
    return list;
  }, [configOutboundTags, runtimeOutboundTags]);

  const allBalancerTags = useMemo(() => {
    const seen = new Set();
    const list = [];
    (configBalancers || []).forEach((balancer) => {
      const tag = normalizeTag(balancer?.tag);
      if (!tag || seen.has(tag)) return;
      seen.add(tag);
      list.push(tag);
    });
    list.sort();
    return list;
  }, [configBalancers]);

  const resolveOutboundSelectors = (selectors, tags = allOutboundTags, balancerTags = allBalancerTags) => {
    if (!Array.isArray(selectors) || selectors.length === 0) return [];

    const normalizedTags = Array.isArray(tags) ? tags : [];
    const normalizedSelectors = [];
    const balancerSet = new Set(
      Array.isArray(balancerTags)
        ? balancerTags.map((tag) => normalizeTag(tag)).filter((tag) => !!tag)
        : []
    );
    const seen = new Set();
    const out = [];
    selectors.forEach((raw) => {
      const value = normalizeTag(raw);
      if (!value) return;
      if (balancerSet.has(value)) {
        if (!seen.has(value)) {
          seen.add(value);
          out.push(value);
        }
        return;
      }
      normalizedSelectors.push(value);
    });
    if (normalizedSelectors.length === 0) {
      return out;
    }

    normalizedTags.forEach((rawTag) => {
      const tag = normalizeTag(rawTag);
      if (!tag || seen.has(tag)) return;
      for (const selector of normalizedSelectors) {
        if (tag.startsWith(selector)) {
          seen.add(tag);
          out.push(tag);
          break;
        }
      }
    });
    return out;
  };

  const protocolMix = useMemo(() => {
    const map = new Map();
    activeConnections.forEach((conn) => {
      (conn.details || []).forEach((detail) => {
        const network = String(detail.metadata?.network || '').trim();
        const type = String(detail.metadata?.type || '').trim();
        const rawAlpn = String(detail.metadata?.alpn || '').trim();
        const networkLower = network.toLowerCase();
        const typeRawParts = type.split('+').map((part) => part.trim()).filter(Boolean);
        const typeParts = typeRawParts.map((part) => part.toLowerCase());
        const hasTLS = typeParts.includes('tls');
        const hasQUIC = typeParts.includes('quic');
        const hasHTTP = typeParts.includes('http');
        const networkDisplay = networkLower === 'tcp'
          ? 'TCP'
          : networkLower === 'udp'
            ? 'UDP'
            : (network || 'unknown');
        const tokens = [networkDisplay];
        if (hasTLS) {
          tokens.push('TLS');
        }
        if (hasQUIC) {
          tokens.push('QUIC');
        }
        const alpnLower = rawAlpn.toLowerCase();
        const alpnDisplay = rawAlpn
          ? (alpnLower === 'http/1.1' || alpnLower === 'http/1.0'
            ? 'H1'
            : (alpnLower === 'h2' || alpnLower.startsWith('h2-'))
              ? 'H2'
              : (alpnLower === 'h3' || alpnLower.startsWith('h3-'))
                ? 'H3'
                : rawAlpn)
          : (hasHTTP
            ? 'H1'
            : '');
        if (alpnDisplay) {
          tokens.push(alpnDisplay);
        }
        const extraTypeParts = typeRawParts.filter((part, index) => {
          const lower = typeParts[index];
          if (!lower) return false;
          if (lower === 'tls' || lower === 'quic' || lower === 'http' || lower === 'http1' || lower === 'http2') return false;
          if ((lower === 'tcp' || lower === 'udp') && lower === networkLower) return false;
          return true;
        });
        extraTypeParts.forEach((part) => tokens.push(part));
        const label = tokens.join(' · ') || 'unknown';
        map.set(label, (map.get(label) || 0) + 1);
      });
    });
    const list = Array.from(map.entries()).map(([label, value]) => ({ label, value }));
    list.sort((a, b) => b.value - a.value);
    const total = list.reduce((sum, item) => sum + item.value, 0);
    return list.map((item) => ({ ...item, percent: total ? (item.value / total) * 100 : 0 }));
  }, [activeConnections]);

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
      startTransition(() => setConnections(normalizeConnectionsPayload(latest)));
    } catch (err) {
      console.warn('Failed to close connections:', err);
    }
  };

  const openInfoModal = (title, payload) => {
    clearTimeoutRef(infoModalCloseTimerRef);
    setInfoModalTitle(String(title || 'Info'));
    setInfoModalText(formatJson(payload));
    setInfoModalStatus('');
    setInfoModalVisible(true);
    setInfoModalClosing(false);
    setInfoModalOpen(true);
  };

  const closeInfoModal = () => {
    if (infoModalClosing) return false;
    scheduleModalClose(
      infoModalCloseTimerRef,
      setInfoModalOpen,
      setInfoModalVisible,
      setInfoModalClosing
    );
    return true;
  };

  const copyInfoModal = async () => {
    const value = String(infoModalText || '');
    if (!value) return;
    setInfoModalStatus('Copying...');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        setInfoModalStatus('Copied.');
        return;
      }
      if (typeof document === 'undefined') {
        setInfoModalStatus('Copy failed: no document.');
        return;
      }
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      setInfoModalStatus(ok ? 'Copied.' : 'Copy failed.');
    } catch (err) {
      setInfoModalStatus(`Copy failed: ${err.message}`);
    }
  };

  const handleCloseGroup = (event, closeIds) => {
    event.preventDefault();
    event.stopPropagation();
    closeConnections(closeIds);
  };

  const handleInfoGroup = (event, conn) => {
    event.preventDefault();
    event.stopPropagation();
    openInfoModal(`Connection group: ${conn?.id || ''}`.trim(), {
      connection: conn,
      rate: connRates.get(conn.id) || null
    });
  };

  const handleCloseDetail = (event, detail) => {
    event.preventDefault();
    event.stopPropagation();
    closeConnections([detail.id]);
  };

  const handleInfoDetail = (event, conn, detail, detailRate, detailKey) => {
    event.preventDefault();
    event.stopPropagation();
    openInfoModal(`Connection: ${conn?.id || ''} · Detail: ${detailKey || ''}`.trim(), {
      connId: conn?.id || null,
      detailKey: detailKey || null,
      detail,
      rate: detailRate || null
    });
  };

  const normalizedConnSearchQuery = connSearchQuery.trim().toLowerCase();
  const normalizedRuleSearchQuery = ruleSearchQuery.trim().toLowerCase();
  const normalizedLogSearchQuery = logSearchQuery.trim().toLowerCase();
  const highlightConnCell = (value) => highlightSearchText(value, normalizedConnSearchQuery);
  const highlightRuleCell = (value) => highlightSearchText(value, normalizedRuleSearchQuery);
  const filteredLogLines = useMemo(() => {
    if (page !== 'logs') return [];
    if (!normalizedLogSearchQuery) return logLines;
    return logLines.filter((line) => String(line || '').toLowerCase().includes(normalizedLogSearchQuery));
  }, [page, logLines, normalizedLogSearchQuery]);
  const renderDetailCell = useMemo(
    () => createDetailCellRenderer({
      highlightConnCell,
      handleInfoDetail,
      handleCloseDetail
    }),
    [highlightConnCell, handleInfoDetail, handleCloseDetail]
  );

  const {
    isConnectionsPage,
    renderSortHeader,
    filteredConnections,
    filteredRuleEntries,
    filteredBalancerEntries,
    toggleDetailColumn,
    detailVisibleColumns,
    detailGridStyle
  } = useConnectionsViewModel({
    page,
    connections,
    connViewMode,
    connRates,
    connSortKey,
    connSortDir,
    setConnSortKey,
    setConnSortDir,
    normalizedConnSearchQuery,
    configRules,
    configBalancers,
    normalizedRuleSearchQuery,
    detailColumnsVisible,
    setDetailColumnsVisible,
    setExpandedConnections
  });

  const isDashboardPage = page === 'dashboard';
  const shouldStreamConnections = isDashboardPage || isConnectionsPage;
  const connStreamLabel = connStreamPaused
    ? 'paused'
    : connStreamStatus;
  const pageMeta = PAGES[page] || PAGES.connections;

  const {
    fetchNodes,
    fetchRules,
    stageRoutingDraft,
    loadRulesConfig,
    loadOutboundsConfig,
    refresh,
    loadSettings,
    loadRestartInfo,
    uploadRoutingDraft
  } = useConfigDataLoaders({
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
    setSettingsPath,
    setStartupInfo,
    setSettingsStatus,
    setRestartInfo
  });

  const {
    buildSubscriptionPatch,
    writeSubscriptionConfig,
    loadSubscriptionConfig,
    saveSubscriptionBlock,
    clearSubscriptionBlock,
    toggleSubscriptionOutboundEnabled,
    toggleSubscriptionDatabaseEnabled
  } = useSubscriptionConfig({
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
  });


  const {
    loadUiState,
    scheduleUiStateSave
  } = useUiStatePersistence({
    apiBase,
    uiStateSaveRef,
    uiStateHydratingRef,
    lockedSelectionsRef,
    setUiStateLoaded,
    setUiStatePath,
    setGroupSelections,
    setLogsDisabled,
    setLogsPaused,
    setAutoScroll,
    setLogLevel,
    setConnViewMode,
    setConnStreamPaused,
    setConnSortKey,
    setConnSortDir,
    setDetailColumnsVisible
  });

  const { applyLogLevel } = useLogsStream({
    page,
    apiBase,
    accessKey,
    logsDisabled,
    logLevel,
    logsPaused,
    logLines,
    autoScroll,
    logsRef,
    logsPausedRef,
    logPendingRef,
    setLogStreamStatus,
    setLogsPaused,
    setLogLines,
    setLogLevel
  });

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
      clearTimeoutRef(uiStateSaveRef);
    };
  }, []);

  useEffect(() => {
    refresh();
    loadSettings();
    loadRestartInfo();
    loadUiState();
  }, [apiBase]);

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

  const {
    getGroupStrategy,
    getFallbackTag,
    pickSelectorStrategyTarget,
    isManualGroup,
    getGroupModeLabel,
    getGroupSelectedTags,
    getGroupCandidates
  } = useMemo(
    () => createNodeGroupHelpers({ statusByTag, groupSelections, outbounds }),
    [statusByTag, groupSelections, outbounds]
  );

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

  useConnectionTelemetry({
    apiBase,
    accessKey,
    connRefreshIntervalMs,
    shouldStreamConnections,
    connStreamPaused,
    isDashboardPage,
    isConnectionsPage,
    connections,
    totalSessions,
    displayConnections: filteredConnections,
    connStreamRef,
    connStreamFrameRef,
    pendingConnRef,
    connTotalsRef,
    detailTotalsRef,
    connViewMode,
    setConnections,
    setConnStreamStatus,
    setTrafficSeries,
    setConnRates,
    setDetailRates
  });

  useEffect(() => {
    setExpandedConnections(new Set());
  }, [connViewMode]);

  // Intentionally no "FLIP" / reorder animations for connection rows. Changes apply instantly.

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
    loadSubscriptionConfig(apiBase).catch(() => {});
  }, [page, apiBase]);

  useEffect(() => {
    if (page !== 'subscriptions') return;
    loadSubscriptionConfig(apiBase).catch(() => {});
  }, [page, apiBase]);

  const {
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
  } = useRulesModalCrud({
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
  });

  const { clearGroupOverride, selectGroupTarget } = useBalancerOverrides({
    apiBase,
    uiStateLoaded,
    groups,
    isManualGroup,
    getGroupCandidates,
    lockedSelectionsRef,
    setGroupSelections,
    setStatus,
    fetchNodes
  });

  const {
    triggerHotReload,
    triggerHotReloadFromNodes,
    triggerHotReloadFromRules,
    triggerHotReloadFromSubscriptions,
    triggerDelayTest,
    closeRestartConfirm,
    confirmRestart,
    triggerRestart
  } = useControlActions({
    apiBase,
    includeInboundsTarget: false,
    hotReloadBusy,
    setHotReloadBusy,
    setSettingsStatus,
    setConfigOutboundsStatus,
    setRulesStatus,
    setConfigSubscriptionStatus,
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
  });

  const stageClassName = [
    'stage',
    page === 'settings' ? 'stage-settings' : '',
    page === 'connections' ? 'stage-connections' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const heroHeaderProps = {
    page,
    pageMeta,
    PAGES,
    formatBytes,
    connections,
    totalSessions
  };

  const dashboardPanelProps = {
    page,
    connStreamLabel,
    toggleConnStream,
    connStreamPaused,
    formatRate,
    formatBytes,
    latestSpeed,
    averageSpeed,
    peakSpeed,
    totalTraffic,
    utilization,
    throughputSpark,
    totalSessions,
    totalConnections,
    sessionRatio,
    sessionsSpark,
    uniqueDestinations,
    outbounds,
    destinationRatio,
    trafficSeries,
    trafficChart,
    TRAFFIC_CLIP_ID,
    trafficShiftActive,
    trafficShift,
    TRAFFIC_ANIMATION_MS,
    latestSample,
    visibleSamples,
    gaugeDegrees,
    topDestinations,
    truncateLabel,
    outboundMix,
    buildConicGradient,
    CHART_COLORS,
    outboundTotal,
    protocolTotal,
    protocolMix,
    clamp
  };

  const connectionsPanelProps = {
    page,
    connSearchQuery,
    setConnSearchQuery,
    connViewMode,
    setConnViewMode,
    connStreamLabel,
    toggleConnStream,
    connStreamPaused,
    renderSortHeader,
    TRAFFIC_DIRECTION_HINTS,
    filteredConnections,
    getGroupCloseIds,
    expandedConnections,
    normalizedConnSearchQuery,
    toSearchText,
    isSpliceType,
    connRates,
    getRateActivity,
    CONNECTION_ACTIVITY_SCALE,
    getConnectionDestination,
    getConnectionSource,
    getConnectionDomainSourceBadge,
    formatHostDisplay,
    ZEBRA_ROW_BACKGROUNDS,
    toggleExpanded,
    normalizeDomainSource,
    AutoFoldText,
    highlightConnCell,
    formatRateOrSplice,
    handleInfoGroup,
    handleCloseGroup,
    detailGridStyle,
    DETAIL_COLUMNS,
    detailColumnsVisible,
    toggleDetailColumn,
    detailVisibleColumns,
    getDetailKey,
    detailRates,
    DETAIL_ACTIVITY_SCALE,
    ZEBRA_DETAIL_BACKGROUNDS,
    renderDetailCell
  };

  const nodesPanelProps = {
    page,
    groups,
    status,
    refresh,
    getGroupCandidates,
    getGroupStrategy,
    isManualGroup,
    getFallbackTag,
    groupSelections,
    getGroupSelectedTags,
    statusByTag,
    formatDelay,
    clearGroupOverride,
    selectGroupTarget,
    configOutboundsPath,
    configOutboundsStatus,
    isFailedStatusText,
    triggerDelayTest,
    delayTestCooldown,
    delayTestBusy,
    getDelayTestLabel,
    triggerHotReloadFromNodes,
    hotReloadBusy,
    openRulesModal,
    displayOutbounds,
    runtimeOutboundsByTag,
    openInfoModal,
    openDeleteConfirm,
    pickSelectorStrategyTarget,
    getGroupModeLabel
  };

  const subscriptionsPanelProps = {
    page,
    configSubscriptionStatus,
    isFailedStatusText,
    saveSubscriptionBlock,
    clearSubscriptionBlock,
    triggerHotReloadFromSubscriptions,
    hotReloadBusy,
    configSubscriptionInbound,
    setConfigSubscriptionInbound,
    configSubscriptionPath,
    configSubscriptionOutbounds,
    openRulesModal,
    getSubscriptionUrlDisplay,
    AutoFoldText,
    toggleSubscriptionOutboundEnabled,
    openDeleteConfirm,
    configSubscriptionDatabases,
    toggleSubscriptionDatabaseEnabled
  };

  const rulesPanelProps = {
    page,
    rulesStatus,
    isFailedStatusText,
    configRulesStatus,
    isRoutingDraftNotice,
    ruleSearchQuery,
    setRuleSearchQuery,
    triggerHotReloadFromRules,
    hotReloadBusy,
    openRulesModal,
    configRules,
    normalizedRuleSearchQuery,
    filteredRuleEntries,
    configRulesPath,
    loadRulesConfig,
    apiBase,
    hasRuleReLookup,
    highlightRuleCell,
    openDeleteConfirm,
    configBalancers,
    filteredBalancerEntries,
    getBalancerStrategyTone,
    resolveOutboundSelectors,
    rulesData
  };

  const logsPanelProps = {
    page,
    logsDisabled,
    logStreamStatus,
    setLogsDisabled,
    logsPaused,
    setLogsPaused,
    logLevel,
    applyLogLevel,
    LOG_LEVEL_OPTIONS,
    logSearchQuery,
    setLogSearchQuery,
    autoScroll,
    setAutoScroll,
    logsRef,
    logLines,
    filteredLogLines,
    getLogLineLevelClass,
    renderLogLine
  };

  const settingsPanelProps = {
    page,
    metricsHttp,
    setMetricsHttp,
    metricsKeyVisible,
    setMetricsKeyVisible,
    metricsAccessKey,
    setMetricsAccessKey,
    connRefreshInterval,
    applyConnRefreshInterval,
    CONNECTION_REFRESH_OPTIONS,
    applyApiBase,
    applyAccessKey,
    setSettingsStatus,
    triggerHotReload,
    hotReloadBusy,
    triggerRestart,
    restartCooldown,
    getRestartLabel,
    isFailedStatusText,
    settingsStatus,
    restartInfo,
    settingsPath,
    uiStatePath,
    startupInfo
  };

  const appModalsProps = {
    rulesModalVisible,
    rulesModalClosing,
    rulesModalTarget,
    rulesModalMode,
    rulesModalIndex,
    rulesModalInsertAfter,
    setRulesModalInsertAfter,
    rulesModalText,
    setRulesModalText,
    rulesModalStatus,
    setRulesModalStatus,
    rulesModalSaving,
    closeRulesModal,
    saveRulesModal,
    configRules,
    configBalancers,
    configSubscriptionOutbounds,
    configSubscriptionDatabases,
    configOutbounds,
    getRuleLabel,
    getBalancerLabel,
    getSubscriptionLabel,
    getSubscriptionDatabaseLabel,
    getOutboundLabel,
    restartConfirmVisible,
    restartConfirmClosing,
    closeRestartConfirm,
    confirmRestart,
    restartConfirmBusy,
    deleteConfirmVisible,
    deleteConfirmClosing,
    deleteConfirmTarget,
    deleteConfirmLabel,
    closeDeleteConfirm,
    confirmDelete,
    deleteConfirmBusy,
    infoModalVisible,
    infoModalClosing,
    infoModalTitle,
    infoModalText,
    infoModalStatus,
    copyInfoModal,
    closeInfoModal
  };

  return (
    <div className={stageClassName}>
      <HeroHeader {...heroHeaderProps} />
      <MainPanels
        dashboardPanelProps={dashboardPanelProps}
        connectionsPanelProps={connectionsPanelProps}
        nodesPanelProps={nodesPanelProps}
        subscriptionsPanelProps={subscriptionsPanelProps}
        rulesPanelProps={rulesPanelProps}
        logsPanelProps={logsPanelProps}
        settingsPanelProps={settingsPanelProps}
        appModalsProps={appModalsProps}
      />
    </div>
  );
}































