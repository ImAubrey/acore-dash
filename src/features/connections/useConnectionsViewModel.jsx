import React, { useEffect, useMemo } from 'react';
import {
  CONNECTION_SORT_FIELDS,
  DETAIL_COLUMNS,
  buildConnectionsView,
  toSearchText,
  toRuleSearchText
} from '../../dashboardShared';

export function useConnectionsViewModel({
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
}) {
  const isConnectionsPage = page === 'connections';

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

  const displayConnections = useMemo(
    () => buildConnectionsView(connections.connections || [], connViewMode),
    [connections, connViewMode]
  );

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

  const filteredConnections = useMemo(() => {
    if (!isConnectionsPage) return [];
    if (!normalizedConnSearchQuery) return sortedConnections;
    return sortedConnections.filter((conn) => toSearchText(conn).toLowerCase().includes(normalizedConnSearchQuery));
  }, [isConnectionsPage, normalizedConnSearchQuery, sortedConnections]);

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
    setExpandedConnections((prev) => {
      const next = new Set(prev);
      if (next.size === 0) return prev;
      const visibleIds = new Set(filteredConnections.map((conn) => conn.id));
      let changed = false;
      next.forEach((id) => {
        if (!visibleIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [isConnectionsPage, normalizedConnSearchQuery, filteredConnections, setExpandedConnections]);

  return {
    isConnectionsPage,
    renderSortHeader,
    filteredConnections,
    filteredRuleEntries,
    filteredBalancerEntries,
    toggleDetailColumn,
    detailVisibleColumns,
    detailGridStyle
  };
}
