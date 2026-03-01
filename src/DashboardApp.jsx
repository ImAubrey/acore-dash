import React, { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createNodeGroupHelpers } from './features/nodes/groupHelpers';
import { HeroHeader } from './features/layout/HeroHeader';
import { MainPanels } from './features/layout/MainPanels';
import { useBalancerOverrides } from './features/nodes/useBalancerOverrides';
import { useSubscriptionConfig } from './features/subscriptions/useSubscriptionConfig';
import { useMainConfigEditor } from './features/settings/useMainConfigEditor';
import { useDnsConfigEditor } from './features/inbounds/useDnsConfigEditor';
import { useConfigDataLoaders } from './features/settings/useConfigDataLoaders';
import { useUiStatePersistence } from './features/settings/useUiStatePersistence';
import { useControlActions } from './features/settings/useControlActions';
import { useDnsQueryTool } from './features/dashboard/useDnsQueryTool';
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
  getMetricsPanelId,
  getInitialRefreshInterval,
  getInitialMetricsPanelHistory,
  saveMetricsPanelHistory,
  addMetricsPanelHistoryEntry,
  removeMetricsPanelHistoryEntry,
  getStoredAccessKey,
  withAccessKey,
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
  clamp,
  CONNECTION_ACTIVITY_SCALE,
  DETAIL_ACTIVITY_SCALE,
  getRateActivity,
  buildPoints,
  buildLinePath,
  buildAreaPath,
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
  hasOwn,
  toMainEditorSections,
  applyMainEditorSectionsToRoot,
  toDnsEditorSection,
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

const MAX_CLOSED_CONNECTIONS = 500;

const buildDetailSnapshotMap = (payload) => {
  const snapshots = new Map();
  const groups = Array.isArray(payload?.connections) ? payload.connections : [];
  groups.forEach((conn) => {
    if (!conn || typeof conn !== 'object') return;
    const details = Array.isArray(conn.details) ? conn.details : [];
    details.forEach((detail, index) => {
      if (!detail || typeof detail !== 'object') return;
      const detailId = detail.id
        ? String(detail.id)
        : `${String(conn.id || 'group')}-${index}`;
      snapshots.set(detailId, { conn, detail });
    });
  });
  return snapshots;
};

const toClosedConnectionRecord = (snapshot, closedAt) => {
  const conn = snapshot?.conn && typeof snapshot.conn === 'object' ? snapshot.conn : {};
  const detail = snapshot?.detail && typeof snapshot.detail === 'object' ? snapshot.detail : {};
  const detailWithClosedAt = {
    ...detail,
    lastSeen: closedAt,
    closedAt
  };
  const metadata = {
    ...(conn.metadata && typeof conn.metadata === 'object' ? conn.metadata : {}),
    ...(detail.metadata && typeof detail.metadata === 'object' ? detail.metadata : {})
  };
  return {
    id: detail.id ? `${String(detail.id)}@${closedAt}` : `${String(conn.id || 'closed')}@${closedAt}`,
    closedAt,
    metadata,
    upload: detail.upload || 0,
    download: detail.download || 0,
    start: detail.start || conn.start || '',
    lastSeen: closedAt,
    connectionCount: 1,
    rule: detail.rule || conn.rule || '',
    rulePayload: detail.rulePayload || conn.rulePayload || '',
    chains: Array.isArray(detail.chains) && detail.chains.length > 0
      ? detail.chains
      : Array.isArray(conn.chains)
        ? conn.chains
        : [],
    details: [detailWithClosedAt],
    detail: detailWithClosedAt
  };
};

export default function App() {
  const [page, setPage] = useState(getPageFromHash());
  const [uiLanguage] = useState(getInitialUiLanguage);
  const [apiBase, setApiBase] = useState(getInitialApiBase());
  const [metricsHttp, setMetricsHttp] = useState(getInitialMetricsHttp());
  const [metricsAccessKey, setMetricsAccessKey] = useState(getInitialMetricsKey());
  const [metricsPanelHistory, setMetricsPanelHistory] = useState(getInitialMetricsPanelHistory());
  const [accessKey, setAccessKey] = useState(getInitialAccessKey());
  const [connRefreshInterval, setConnRefreshInterval] = useState(getInitialRefreshInterval());
  const [connections, setConnections] = useState({ uploadTotal: 0, downloadTotal: 0, connections: [] });
  const [dnsCacheStats, setDnsCacheStats] = useState(() => ({ ...EMPTY_DNS_CACHE_STATS }));
  const [dnsCacheStatus, setDnsCacheStatus] = useState('');
  const [dnsCacheFlushBusy, setDnsCacheFlushBusy] = useState(false);
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
  const [closingAllConnections, setClosingAllConnections] = useState(false);
  const [connListMode, setConnListMode] = useState('live');
  const [connViewMode, setConnViewMode] = useState('current');
  const [connSortKey, setConnSortKey] = useState('default');
  const [connSortDir, setConnSortDir] = useState('desc');
  const [connSearchQuery, setConnSearchQuery] = useState('');
  const [closedConnections, setClosedConnections] = useState([]);
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
  const [configInbounds, setConfigInbounds] = useState([]);
  const [configInboundsStatus, setConfigInboundsStatus] = useState('');
  const [configInboundsPath, setConfigInboundsPath] = useState('');
  const [configSubscriptionInbound, setConfigSubscriptionInbound] = useState('');
  const [configSubscriptionOutbounds, setConfigSubscriptionOutbounds] = useState([]);
  const [configSubscriptionDatabases, setConfigSubscriptionDatabases] = useState([]);
  const [configSubscriptionFull, setConfigSubscriptionFull] = useState([]);
  const [configSubscriptionStatus, setConfigSubscriptionStatus] = useState('');
  const [configSubscriptionPath, setConfigSubscriptionPath] = useState('');
  const [configMainText, setConfigMainText] = useState('{}');
  const [configMainLoaded, setConfigMainLoaded] = useState({});
  const [configMainPath, setConfigMainPath] = useState('');
  const [configMainStatus, setConfigMainStatus] = useState('');
  const [configMainDirty, setConfigMainDirty] = useState(false);
  const [configMainSaving, setConfigMainSaving] = useState(false);
  const [configDnsText, setConfigDnsText] = useState('{}');
  const [configDnsRootLoaded, setConfigDnsRootLoaded] = useState({});
  const [configDnsPath, setConfigDnsPath] = useState('');
  const [configDnsStatus, setConfigDnsStatus] = useState('');
  const [configDnsDirty, setConfigDnsDirty] = useState(false);
  const [configDnsSaving, setConfigDnsSaving] = useState(false);
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
  const t = useMemo(() => (key) => getI18nText(uiLanguage, key), [uiLanguage]);
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
  const connDetailSnapshotsRef = useRef(new Map());
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

  const persistMetricsPanelHistory = (items) => {
    const saved = saveMetricsPanelHistory(items);
    setMetricsPanelHistory(saved);
    return saved;
  };

  const applyMetricsSettings = () => {
    const nextBase = applyApiBase(metricsHttp);
    const nextKey = applyAccessKey(metricsAccessKey);
    const nextHistory = addMetricsPanelHistoryEntry(
      metricsPanelHistory,
      nextBase,
      nextKey,
      connRefreshInterval
    );
    persistMetricsPanelHistory(nextHistory);
    setSettingsStatus('Metrics settings updated.');
  };

  const applySavedMetricsPanel = (entry) => {
    const base = String(entry?.base || '').trim();
    const key = normalizeAccessKey(entry?.key || '');
    const refresh = normalizeRefreshInterval(entry?.connRefreshInterval);
    if (!base) return;
    setMetricsHttp(base);
    setMetricsAccessKey(key);
    const nextBase = applyApiBase(base);
    const nextKey = applyAccessKey(key);
    const nextRefresh = applyConnRefreshInterval(refresh);
    const nextHistory = addMetricsPanelHistoryEntry(
      metricsPanelHistory,
      nextBase,
      nextKey,
      nextRefresh
    );
    persistMetricsPanelHistory(nextHistory);
    setSettingsStatus(`Switched to: ${base} (refresh ${nextRefresh}s)`);
  };

  const removeSavedMetricsPanel = (id) => {
    const next = removeMetricsPanelHistoryEntry(metricsPanelHistory, id);
    persistMetricsPanelHistory(next);
    setSettingsStatus('Saved metrics panel removed.');
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
  const currentMetricsPanelId = getMetricsPanelId(apiBase, accessKey, connRefreshInterval);

  const connectionStats = useMemo(() => getConnectionStats(connections), [connections]);
  const activeConnections = connectionStats.connections;
  const totalSessions = connectionStats.totalSessions;
  const totalConnections = connectionStats.totalConnections;

  useEffect(() => {
    const nextSnapshots = buildDetailSnapshotMap(connections);
    const prevSnapshots = connDetailSnapshotsRef.current;
    if (prevSnapshots.size > 0) {
      const closedAt = new Date().toISOString();
      const closedBatch = [];
      prevSnapshots.forEach((snapshot, detailId) => {
        if (nextSnapshots.has(detailId)) return;
        closedBatch.push(toClosedConnectionRecord(snapshot, closedAt));
      });
      if (closedBatch.length > 0) {
        setClosedConnections((prev) => {
          const next = [...closedBatch, ...prev];
          if (next.length <= MAX_CLOSED_CONNECTIONS) return next;
          return next.slice(0, MAX_CLOSED_CONNECTIONS);
        });
      }
    }
    connDetailSnapshotsRef.current = nextSnapshots;
  }, [connections]);

  const uniqueDestinations = useMemo(() => {
    if (page !== 'dashboard') return 0;
    const set = new Set();
    activeConnections.forEach((conn) => {
      const label = getConnectionDestination(conn);
      set.add(label);
    });
    return set.size;
  }, [activeConnections, page]);

  const topSources = useMemo(() => {
    if (page !== 'dashboard') return [];
    const toMeta = (value) => (value && typeof value === 'object' ? value : {});
    const toText = (value) => String(value || '').trim();

    const resolveSourceBucket = (meta) => {
      const inboundTag = toText(meta?.inboundTag);
      const user = toText(meta?.user);
      const hasUser = Boolean(user) && user !== '-';
      if (!hasUser) {
        const ip = getSourceLabel(toMeta(meta), '0.0.0.0');
        return {
          label: ip,
          query: ip
        };
      }

      const inboundLabel = inboundTag || '-';
      return {
        label: `${user} + ${inboundLabel}`,
        query: inboundTag
      };
    };

    const map = new Map();
    const addBucket = (bucket, increment) => {
      const key = toText(bucket?.label);
      if (!key) return;
      const prev = map.get(key) || { count: 0, query: '' };
      map.set(key, {
        count: prev.count + increment,
        query: prev.query || toText(bucket?.query)
      });
    };

    activeConnections.forEach((conn) => {
      const connMeta = toMeta(conn?.metadata);
      const details = Array.isArray(conn?.details) ? conn.details : [];
      if (details.length === 0) {
        const bucket = resolveSourceBucket(connMeta);
        addBucket(bucket, conn.connectionCount || 1);
        return;
      }
      details.forEach((detail) => {
        const detailMeta = toMeta(detail?.metadata);
        const mergedMeta = { ...connMeta, ...detailMeta };
        const bucket = resolveSourceBucket(mergedMeta);
        addBucket(bucket, 1);
      });
    });
    const list = Array.from(map.entries()).map(([label, entry]) => ({
      label,
      count: entry.count,
      query: entry.query || ''
    }));
    list.sort((a, b) => b.count - a.count);
    const maxCount = Math.max(...list.map((item) => item.count), 1);
    return list.map((item) => {
      const ratio = maxCount ? item.count / maxCount : 0;
      return {
        ...item,
        ratio,
        percent: ratio * 100
      };
    });
  }, [activeConnections, page]);

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
    list.sort();
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
    list.sort();
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
    runtimeOnly.sort((a, b) => a.tag.localeCompare(b.tag));

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
    list.sort();
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
      out.sort();
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
    out.sort();
    return out;
  };

  const protocolMix = useMemo(() => {
    if (page !== 'dashboard') return [];
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
    const maxValue = Math.max(...list.map((item) => item.value), 0);
    return list.map((item) => ({ ...item, percent: maxValue ? (item.value / maxValue) * 100 : 0 }));
  }, [activeConnections, page]);

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
  const averageSpeed = useMemo(() => {
    if (!throughputSeries.length) return 0;
    const total = throughputSeries.reduce((sum, value) => sum + value, 0);
    return total / throughputSeries.length;
  }, [throughputSeries]);
  const sessionBaseline = useMemo(() => {
    const sessionSamples = trafficSeries.map((sample) => sample.sessions || 0);
    return Math.max(...sessionSamples, totalSessions || 0, 1);
  }, [trafficSeries, totalSessions]);

  const utilization = clamp(averageSpeed ? latestSpeed / averageSpeed : 0, 0, 1);
  const gaugeDegrees = utilization * 360;
  const sessionRatio = clamp(sessionBaseline ? totalSessions / sessionBaseline : 0, 0, 1);
  const destinationRatio = clamp(totalConnections ? uniqueDestinations / totalConnections : 0, 0, 1);
  const dnsUsageRatio = clamp(dnsCacheStats.usageRatio || 0, 0, 1);
  const dnsValidRatio = clamp(dnsCacheStats.validRatio || 0, 0, 1);
  const dnsExpiredRatio = clamp(dnsCacheStats.expiredRatio || 0, 0, 1);
  const dnsUsagePercent = Math.round(dnsUsageRatio * 100);
  const dnsValidPercent = Math.round(dnsValidRatio * 100);
  const dnsExpiredPercent = Math.round(dnsExpiredRatio * 100);
  const dnsUpdatedLabel = dnsCacheStats.updatedAt ? formatTime(dnsCacheStats.updatedAt) : '-';

  const trafficChart = useMemo(() => {
    const width = 520;
    const height = 200;
    const plotPaddingY = 18;
    const plotPaddingRight = 18;
    const axisGutter = 76;
    const plotLeft = axisGutter;
    const plotRight = width - plotPaddingRight;
    const step = TRAFFIC_WINDOW > 1 ? (plotRight - plotLeft) / (TRAFFIC_WINDOW - 1) : 0;
    const maxValue = Math.max(
      ...trafficSeries.map((sample) => Math.max(sample.up, sample.down)),
      1
    );
    const buildFixedPoints = (values) => {
      if (!values || values.length === 0) return [];
      return values.map((value, index) => {
        const ratio = maxValue ? value / maxValue : 0;
        const x = plotLeft + step * index;
        const y = height - plotPaddingY - ratio * (height - plotPaddingY * 2);
        return { x, y };
      });
    };
    const uploadPoints = buildFixedPoints(trafficSeries.map((sample) => sample.up));
    const downloadPoints = buildFixedPoints(trafficSeries.map((sample) => sample.down));
    const ticks = TRAFFIC_GRID_LINES.map((y) => {
      const ratio = clamp(1 - (y - plotPaddingY) / (height - plotPaddingY * 2), 0, 1);
      return { y, value: maxValue * ratio };
    });
    return {
      width,
      height,
      plotLeft,
      plotRight,
      plotPaddingY,
      axisLabelX: plotLeft - 8,
      step,
      maxValue,
      ticks,
      uploadLine: buildLinePath(uploadPoints),
      uploadArea: buildAreaPath(uploadPoints, height, plotPaddingY),
      downloadLine: buildLinePath(downloadPoints),
      downloadArea: buildAreaPath(downloadPoints, height, plotPaddingY)
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

  const handleInfoClosed = (event, closedConn) => {
    event.preventDefault();
    event.stopPropagation();
    openInfoModal(`Closed connection: ${closedConn?.id || ''}`.trim(), {
      closedConnection: closedConn
    });
  };

  const handleTopSourceClick = (sourceIp) => {
    const query = String(sourceIp || '').trim();
    if (!query) return;
    setConnSearchQuery(query);
    setConnViewMode('source');
    setPage('connections');
    if (typeof window !== 'undefined') {
      if (window.location.hash !== '#/connections') {
        window.location.hash = '#/connections';
      }
      window.requestAnimationFrame(() => {
        const input = document.querySelector('.connections-search input');
        if (input) {
          input.focus();
          input.select();
        }
      });
    }
  };

  const normalizedConnSearchQuery = connSearchQuery.trim().toLowerCase();
  const normalizedRuleSearchQuery = ruleSearchQuery.trim().toLowerCase();
  const normalizedLogSearchQuery = logSearchQuery.trim().toLowerCase();
  const highlightConnCell = useCallback(
    (value) => highlightSearchText(value, normalizedConnSearchQuery),
    [normalizedConnSearchQuery]
  );
  const highlightRuleCell = useCallback(
    (value) => highlightSearchText(value, normalizedRuleSearchQuery),
    [normalizedRuleSearchQuery]
  );
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
    filteredClosedConnections,
    filteredRuleEntries,
    filteredBalancerEntries,
    toggleDetailColumn,
    detailVisibleColumns,
    detailGridStyle
  } = useConnectionsViewModel({
    page,
    connections,
    closedConnections,
    connListMode,
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

  const closeAllConnectionIds = useMemo(() => {
    const ids = [];
    (filteredConnections || []).forEach((conn) => {
      ids.push(...getGroupCloseIds(conn));
    });
    return normalizeConnectionIds(ids);
  }, [filteredConnections]);

  const canCloseAllConnections = closeAllConnectionIds.length > 0;
  const handleCloseAllConnections = () => {
    if (closingAllConnections || !canCloseAllConnections) return;
    setClosingAllConnections(true);
    closeConnections(closeAllConnectionIds).finally(() => {
      setClosingAllConnections(false);
    });
  };

  const isDashboardPage = page === 'dashboard';
  const shouldStreamConnections = isDashboardPage || isConnectionsPage;
  const connStreamLabel = connStreamPaused
    ? 'paused'
    : connStreamStatus;
  const pageMeta = PAGES[page] || PAGES.connections;

  const {
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
  });

  const {
    dnsQueryTypes,
    dnsQueryType,
    setDnsQueryType,
    dnsQueryDomain,
    setDnsQueryDomain,
    dnsQueryBusy,
    dnsQueryStatus,
    dnsQueryResult,
    runDnsQuery
  } = useDnsQueryTool({ apiBase });

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
    loadMainConfig,
    saveMainConfig,
    resetMainConfigEditor,
    formatMainConfigEditor
  } = useMainConfigEditor({
    apiBase,
    configMainPath,
    setConfigMainPath,
    configMainText,
    setConfigMainText,
    configMainLoaded,
    setConfigMainLoaded,
    configMainStatus,
    setConfigMainStatus,
    configMainDirty,
    setConfigMainDirty,
    configMainSaving,
    setConfigMainSaving,
    isFailedStatusText
  });

  const {
    loadDnsConfig,
    saveDnsConfig,
    resetDnsEditor,
    formatDnsEditor
  } = useDnsConfigEditor({
    apiBase,
    configMainPath,
    configDnsPath,
    setConfigDnsPath,
    configDnsText,
    setConfigDnsText,
    configDnsRootLoaded,
    setConfigDnsRootLoaded,
    configDnsStatus,
    setConfigDnsStatus,
    configDnsDirty,
    setConfigDnsDirty,
    configDnsSaving,
    setConfigDnsSaving,
    isFailedStatusText
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
    if (!restartInfo?.inProgress) return undefined;
    if (typeof window === 'undefined') return undefined;
    const timer = window.setInterval(() => {
      loadRestartInfo(apiBase).catch(() => {});
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [restartInfo?.inProgress, apiBase]);

  useEffect(() => {
    if (page !== 'dashboard') return undefined;
    fetchDnsCacheStats(apiBase, { silent: true }).catch(() => {});
    if (typeof window === 'undefined') return undefined;
    const timer = window.setInterval(() => {
      fetchDnsCacheStats(apiBase, { silent: true }).catch(() => {});
    }, 5000);
    return () => {
      window.clearInterval(timer);
    };
  }, [page, apiBase]);

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
    expandedConnections,
    connViewMode,
    setConnections,
    setConnStreamStatus,
    setTrafficSeries,
    setConnRates,
    setDetailRates
  });

  useEffect(() => {
    setExpandedConnections(new Set());
  }, [connViewMode, connListMode]);

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

  useEffect(() => {
    if (page !== 'inbounds') return;
    loadInboundsConfig(apiBase).catch(() => {});
    loadDnsConfig(apiBase).catch(() => {});
  }, [page, apiBase]);

  useEffect(() => {
    if (page !== 'settings') return;
    loadMainConfig(apiBase).catch(() => {});
  }, [page, apiBase]);

  const {
    getRuleLabel,
    getBalancerLabel,
    getOutboundLabel,
    getInboundLabel,
    getSubscriptionLabel,
    getSubscriptionDatabaseLabel,
    openRulesModal,
    openDeleteConfirm,
    closeDeleteConfirm,
    confirmDelete,
    closeRulesModal,
    formatRulesModalJson,
    saveRulesModal
  } = useRulesModalCrud({
    apiBase,
    configRules,
    setConfigRules,
    configBalancers,
    setConfigBalancers,
    configInbounds,
    setConfigInbounds,
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
    configInboundsPath,
    setConfigRulesStatus,
    setConfigOutboundsStatus,
    setConfigInboundsStatus,
    setConfigSubscriptionStatus,
    buildSubscriptionPatch,
    writeSubscriptionConfig,
    stageRoutingDraft,
    fetchRules,
    rulesModalOpen,
    setRulesModalOpen,
    rulesModalVisible,
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
    rulesModalStatus,
    setRulesModalStatus,
    rulesModalInsertAfter,
    setRulesModalInsertAfter,
    rulesModalSaving,
    setRulesModalSaving,
    rulesModalCloseTimerRef,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    deleteConfirmVisible,
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
    triggerHotReloadFromInbounds,
    triggerDelayTest,
    closeRestartConfirm,
    confirmRestart,
    triggerRestart
  } = useControlActions({
    apiBase,
    includeInboundsTarget: true,
    hotReloadBusy,
    setHotReloadBusy,
    setSettingsStatus,
    setConfigOutboundsStatus,
    setRulesStatus,
    setConfigSubscriptionStatus,
    setConfigInboundsStatus,
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

  const triggerSubscribeOutbounds = () => {
    setConfigSubscriptionStatus(t('subscriptionUpdatingOutbounds'));
    triggerHotReloadFromSubscriptions();
  };
  const triggerSubscribeDatabases = () => {
    setConfigSubscriptionStatus(t('subscriptionUpdatingDatabases'));
    triggerHotReloadFromSubscriptions();
  };

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
    metricsPanelHistory,
    currentMetricsPanelId,
    applySavedMetricsPanel,
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
    dnsCacheStats,
    dnsUpdatedLabel,
    triggerDnsCacheFlushFromDashboard,
    dnsCacheFlushBusy,
    dnsCacheStatus,
    dnsUsageRatio,
    dnsUsagePercent,
    dnsValidPercent,
    dnsValidRatio,
    dnsExpiredPercent,
    dnsExpiredRatio,
    dnsQueryTypes,
    dnsQueryType,
    setDnsQueryType,
    dnsQueryDomain,
    setDnsQueryDomain,
    dnsQueryBusy,
    dnsQueryStatus,
    dnsQueryResult,
    runDnsQuery,
    topSources,
    onTopSourceClick: handleTopSourceClick,
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
    connListMode,
    setConnListMode,
    connSearchQuery,
    setConnSearchQuery,
    connViewMode,
    setConnViewMode,
    connStreamLabel,
    toggleConnStream,
    connStreamPaused,
    canCloseAllConnections,
    closingAllConnections,
    handleCloseAllConnections,
    renderSortHeader,
    TRAFFIC_DIRECTION_HINTS,
    filteredConnections,
    filteredClosedConnections,
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
    getDomainSourceBadgeLabel,
    formatBytes,
    formatTime,
    ZEBRA_ROW_BACKGROUNDS,
    toggleExpanded,
    normalizeDomainSource,
    AutoFoldText,
    highlightConnCell,
    formatRateOrSplice,
    handleInfoGroup,
    handleInfoClosed,
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
    triggerSubscribeOutbounds,
    t,
    openRulesModal,
    getSubscriptionUrlDisplay,
    AutoFoldText,
    toggleSubscriptionOutboundEnabled,
    openDeleteConfirm,
    configSubscriptionDatabases,
    triggerSubscribeDatabases,
    toggleSubscriptionDatabaseEnabled
  };

  const inboundsPanelProps = {
    page,
    configInboundsStatus,
    isFailedStatusText,
    loadInboundsConfig,
    apiBase,
    triggerHotReloadFromInbounds,
    hotReloadBusy,
    openRulesModal,
    configInboundsPath,
    configInbounds,
    openInfoModal,
    openDeleteConfirm,
    loadDnsConfig,
    resetDnsEditor,
    configDnsDirty,
    formatDnsEditor,
    configDnsSaving,
    saveDnsConfig,
    configDnsStatus,
    configDnsPath,
    configDnsText,
    setConfigDnsText,
    setConfigDnsDirty,
    setConfigDnsStatus
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
    metricsPanelHistory,
    applyMetricsSettings,
    applySavedMetricsPanel,
    removeSavedMetricsPanel,
    connRefreshInterval,
    applyConnRefreshInterval,
    CONNECTION_REFRESH_OPTIONS,
    applyApiBase,
    applyAccessKey,
    setSettingsStatus,
    triggerHotReload,
    hotReloadBusy,
    triggerDnsCacheFlushFromSettings,
    dnsCacheFlushBusy,
    triggerRestart,
    restartCooldown,
    getRestartLabel,
    isFailedStatusText,
    settingsStatus,
    restartInfo,
    settingsPath,
    uiStatePath,
    startupInfo,
    loadMainConfig,
    apiBase,
    resetMainConfigEditor,
    configMainDirty,
    formatMainConfigEditor,
    configMainSaving,
    saveMainConfig,
    configMainStatus,
    configMainPath,
    configMainText,
    setConfigMainText,
    setConfigMainDirty,
    setConfigMainStatus
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
    formatRulesModalJson,
    saveRulesModal,
    configRules,
    configBalancers,
    configInbounds,
    configSubscriptionOutbounds,
    configSubscriptionDatabases,
    configOutbounds,
    getRuleLabel,
    getBalancerLabel,
    getInboundLabel,
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
        inboundsPanelProps={inboundsPanelProps}
        rulesPanelProps={rulesPanelProps}
        logsPanelProps={logsPanelProps}
        settingsPanelProps={settingsPanelProps}
        appModalsProps={appModalsProps}
      />
    </div>
  );
}


































