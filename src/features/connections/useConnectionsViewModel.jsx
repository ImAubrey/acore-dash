import React, { useEffect, useMemo } from 'react';
import {
  CONNECTION_SORT_FIELDS,
  DETAIL_COLUMNS,
  buildConnectionsView,
  getConnectionRateKey,
  getInlineRatePair,
  getDetailDestinationLabel,
  getDetailKey,
  getDetailLastSeen,
  getDetailSourceLabel,
  getResolvedRatePair,
  normalizeDetailColumnsVisible,
  parseTimestamp,
  toSearchText,
  toRuleSearchText
} from '../../dashboardShared';

const CONNECTION_TEXT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

export function useConnectionsViewModel({
  page,
  connections,
  closedConnections,
  connListMode,
  connViewMode,
  connRates,
  detailRates,
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
}) {
  const isConnectionsPage = page === 'connections';
  const isClosedMode = connListMode === 'closed';

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
      if (key === 'upload' || key === 'download') {
        const hasTrafficColumn = next.has('upload') || next.has('download');
        if (hasTrafficColumn) {
          const trafficCount = (next.has('upload') ? 1 : 0) + (next.has('download') ? 1 : 0);
          if (next.size <= trafficCount) return prev;
          next.delete('upload');
          next.delete('download');
        } else {
          next.add('upload');
          next.add('download');
        }
        return next;
      }
      if (next.has(key)) {
        if (next.size <= 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const effectiveDetailColumnsVisible = useMemo(
    () => normalizeDetailColumnsVisible(detailColumnsVisible),
    [detailColumnsVisible]
  );

  const detailVisibleColumns = useMemo(
    () => DETAIL_COLUMNS.filter((column) => effectiveDetailColumnsVisible.has(column.key)),
    [effectiveDetailColumnsVisible]
  );

  const detailGridTemplate = useMemo(() => {
    const columns = detailVisibleColumns.length ? detailVisibleColumns : DETAIL_COLUMNS;
    return columns.map((column) => column.width).join(' ');
  }, [detailVisibleColumns]);

  const detailGridStyle = useMemo(
    () => ({ '--detail-columns': detailGridTemplate }),
    [detailGridTemplate]
  );

  const liveConnections = Array.isArray(connections?.connections) ? connections.connections : [];
  const closedList = Array.isArray(closedConnections) ? closedConnections : [];

  const getSortDirection = () => (connSortDir === 'asc' ? 1 : -1);

  const compareSortValues = (aValue, bValue, field, dir) => {
    if (field.type !== 'number') {
      return CONNECTION_TEXT_COLLATOR.compare(String(aValue), String(bValue)) * dir;
    }
    const diff = (aValue || 0) - (bValue || 0);
    if (Number.isNaN(diff)) return 0;
    return diff * dir;
  };

  const getConnectionSortValue = (conn, useRateForTraffic) => {
    const field = CONNECTION_SORT_FIELDS[connSortKey];
    if (!field) return '';
    const connRateKey = getConnectionRateKey(conn);
    if (useRateForTraffic && connSortKey === 'upload') {
      return getResolvedRatePair(connRates.get(connRateKey), getInlineRatePair(conn)).upload;
    }
    if (useRateForTraffic && connSortKey === 'download') {
      return getResolvedRatePair(connRates.get(connRateKey), getInlineRatePair(conn)).download;
    }
    return field.getValue(conn);
  };

  const getDetailTrafficSortValue = (conn, detail, index, key, useRateForTraffic) => {
    if (useRateForTraffic) {
      const detailKey = getDetailKey(getConnectionRateKey(conn), detail, index);
      const resolvedRate = getResolvedRatePair(detailRates?.get(detailKey), getInlineRatePair(detail));
      if (resolvedRate.resolved) return resolvedRate[key];
      const rawRate = Number(detail?.[`${key}Rate`]);
      if (Number.isFinite(rawRate) && rawRate >= 0) return rawRate;
      return 0;
    }
    const rawTotal = Number(detail?.[key]);
    return Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : 0;
  };

  const getDetailSortValue = (conn, detail, index, useRateForTraffic) => {
    switch (connSortKey) {
      case 'destination':
        return getDetailDestinationLabel(detail);
      case 'source':
        return getDetailSourceLabel(detail);
      case 'rule':
        return detail?.rulePayload || detail?.rule || conn?.rulePayload || conn?.rule || '-';
      case 'upload':
        return getDetailTrafficSortValue(conn, detail, index, 'upload', useRateForTraffic);
      case 'download':
        return getDetailTrafficSortValue(conn, detail, index, 'download', useRateForTraffic);
      case 'sessions':
        return parseTimestamp(getDetailLastSeen(detail));
      default:
        return '';
    }
  };

  const sortConnectionDetails = (conn, useRateForTraffic) => {
    const field = CONNECTION_SORT_FIELDS[connSortKey];
    const details = Array.isArray(conn?.details) ? conn.details : [];
    if (!field || connSortKey === 'default' || details.length < 2) return conn;

    const dir = getSortDirection();
    const sortedDetails = details
      .map((detail, index) => ({
        detail,
        index,
        value: getDetailSortValue(conn, detail, index, useRateForTraffic)
      }))
      .sort((a, b) => {
        const compared = compareSortValues(a.value, b.value, field, dir);
        return compared || a.index - b.index;
      });
    const changed = sortedDetails.some((entry, index) => entry.index !== index);
    if (!changed) return conn;
    return {
      ...conn,
      details: sortedDetails.map((entry) => entry.detail)
    };
  };

  const sortConnectionList = (list, useRateForTraffic = true) => {
    if (connSortKey === 'default' || !CONNECTION_SORT_FIELDS[connSortKey]) return list;
    const dir = getSortDirection();
    const field = CONNECTION_SORT_FIELDS[connSortKey];
    return [...list].sort((a, b) => {
      const aValue = getConnectionSortValue(a, useRateForTraffic);
      const bValue = getConnectionSortValue(b, useRateForTraffic);
      return compareSortValues(aValue, bValue, field, dir);
    }).map((conn) => sortConnectionDetails(conn, useRateForTraffic));
  };

  const displayConnections = useMemo(
    () => (isConnectionsPage ? buildConnectionsView(liveConnections, connViewMode) : []),
    [isConnectionsPage, liveConnections, connViewMode]
  );

  const displayClosedConnections = useMemo(
    () => (isConnectionsPage ? buildConnectionsView(closedList, connViewMode) : []),
    [isConnectionsPage, closedList, connViewMode]
  );

  const sortedConnections = useMemo(() => {
    if (!isConnectionsPage) return [];
    return sortConnectionList(displayConnections || [], true);
  }, [displayConnections, connRates, detailRates, connSortKey, connSortDir, isConnectionsPage]);

  const sortedClosedConnections = useMemo(() => {
    if (!isConnectionsPage) return [];
    return sortConnectionList(displayClosedConnections || [], false);
  }, [displayClosedConnections, detailRates, connSortKey, connSortDir, isConnectionsPage]);

  const filteredConnections = useMemo(() => {
    if (!isConnectionsPage) return [];
    if (!normalizedConnSearchQuery) return sortedConnections;
    return sortedConnections.filter((conn) => toSearchText(conn).toLowerCase().includes(normalizedConnSearchQuery));
  }, [isConnectionsPage, normalizedConnSearchQuery, sortedConnections]);

  const filteredClosedConnections = useMemo(() => {
    if (!isConnectionsPage) return [];
    if (!normalizedConnSearchQuery) return sortedClosedConnections;
    return sortedClosedConnections.filter((conn) => toSearchText(conn).toLowerCase().includes(normalizedConnSearchQuery));
  }, [isConnectionsPage, normalizedConnSearchQuery, sortedClosedConnections]);

  const filteredRuleEntries = useMemo(() => {
    if (page !== 'rules') return [];
    const entries = (configRules || []).map((rule, index) => ({ rule, index }));
    if (!normalizedRuleSearchQuery) return entries;
    return entries.filter(({ rule }) => toRuleSearchText(rule).toLowerCase().includes(normalizedRuleSearchQuery));
  }, [page, configRules, normalizedRuleSearchQuery]);

  const filteredBalancerEntries = useMemo(() => {
    if (page !== 'rules') return [];
    const entries = (configBalancers || []).map((balancer, index) => ({ balancer, index }));
    if (!normalizedRuleSearchQuery) return entries;
    return entries.filter(({ balancer }) => toSearchText(balancer).toLowerCase().includes(normalizedRuleSearchQuery));
  }, [page, configBalancers, normalizedRuleSearchQuery]);

  useEffect(() => {
    if (!isConnectionsPage || !normalizedConnSearchQuery) return;
    const visibleConnections = isClosedMode ? filteredClosedConnections : filteredConnections;
    setExpandedConnections((prev) => {
      const next = new Set(prev);
      if (next.size === 0) return prev;
      const visibleIds = new Set(visibleConnections.map((conn) => conn.id));
      let changed = false;
      next.forEach((id) => {
        if (!visibleIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [
    isConnectionsPage,
    isClosedMode,
    normalizedConnSearchQuery,
    filteredConnections,
    filteredClosedConnections,
    setExpandedConnections
  ]);

  return {
    isConnectionsPage,
    renderSortHeader,
    filteredConnections,
    filteredClosedConnections,
    filteredRuleEntries,
    filteredBalancerEntries,
    toggleDetailColumn,
    detailVisibleColumns,
    detailGridStyle
  };
}
