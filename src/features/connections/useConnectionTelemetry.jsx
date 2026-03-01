import { useEffect } from 'react';
import {
  appendAccessKeyParam,
  getDetailKey,
  DASHBOARD_CACHE_WINDOW_MS,
  TRAFFIC_WINDOW
} from '../../dashboardShared';

export function useConnectionTelemetry({
  apiBase,
  accessKey,
  connRefreshIntervalMs,
  shouldStreamConnections,
  connStreamPaused,
  isDashboardPage,
  isConnectionsPage,
  connections,
  totalSessions,
  displayConnections,
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
}) {
  useEffect(() => {
    const cancelScheduledConnFlush = () => {
      if (connStreamFrameRef.current === null || typeof window === 'undefined') return;
      window.cancelAnimationFrame(connStreamFrameRef.current);
      window.clearTimeout(connStreamFrameRef.current);
      connStreamFrameRef.current = null;
    };

    const flushPendingConnections = () => {
      connStreamFrameRef.current = null;
      const latest = pendingConnRef.current;
      pendingConnRef.current = null;
      if (!latest) return;
      setConnections(latest);
    };

    if (connStreamRef.current) {
      connStreamRef.current.close();
      connStreamRef.current = null;
    }
    if (!shouldStreamConnections || connStreamPaused) {
      cancelScheduledConnFlush();
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
        pendingConnRef.current = data;
        if (connStreamFrameRef.current !== null || typeof window === 'undefined') return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          connStreamFrameRef.current = window.setTimeout(flushPendingConnections, 16);
          return;
        }
        connStreamFrameRef.current = window.requestAnimationFrame(flushPendingConnections);
      } catch (err) {
        // ignore malformed payloads
      }
    };
    es.onerror = () => {
      setConnStreamStatus('reconnecting');
    };

    return () => {
      es.close();
      cancelScheduledConnFlush();
      pendingConnRef.current = null;
      if (connStreamRef.current === es) {
        connStreamRef.current = null;
      }
    };
  }, [apiBase, connStreamPaused, shouldStreamConnections, accessKey, connRefreshIntervalMs]);

  useEffect(() => {
    if (!isDashboardPage) return;
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
  }, [connections, totalSessions, isDashboardPage]);

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

      if (!expandedConnections?.has(conn.id)) return;
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
  }, [displayConnections, isConnectionsPage, expandedConnections]);

  useEffect(() => {
    connTotalsRef.current = new Map();
    detailTotalsRef.current = new Map();
    setConnRates(new Map());
    setDetailRates(new Map());
  }, [isConnectionsPage, connViewMode]);
}
