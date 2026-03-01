import { useEffect } from 'react';
import {
  appendAccessKeyParam,
  getDetailKey,
  DASHBOARD_CACHE_WINDOW_MS,
  TRAFFIC_WINDOW,
  normalizeConnectionsPayload,
  parseConnectionsPayload
} from '../../dashboardShared';

const HIDDEN_CONN_FLUSH_DELAY_MS = 250;
const FRAME_FLUSH_DELAY_MS = 16;
const STREAM_STALE_MULTIPLIER = 4;
const STREAM_STALE_MIN_MS = 4000;

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
  connViewMode,
  setConnections,
  setConnStreamStatus,
  setTrafficSeries,
  setConnRates,
  setDetailRates
}) {
  useEffect(() => {
    let disposed = false;
    let lastSnapshotAt = 0;
    const staleThresholdMs = Math.max(
      connRefreshIntervalMs * STREAM_STALE_MULTIPLIER,
      STREAM_STALE_MIN_MS
    );

    const cancelScheduledConnFlush = () => {
      if (connStreamFrameRef.current === null || typeof window === 'undefined') return;
      window.cancelAnimationFrame(connStreamFrameRef.current);
      window.clearTimeout(connStreamFrameRef.current);
      connStreamFrameRef.current = null;
    };

    const flushPendingConnections = () => {
      connStreamFrameRef.current = null;
      const latestPayload = pendingConnRef.current;
      pendingConnRef.current = null;
      if (!latestPayload || disposed) return;
      setConnections(normalizeConnectionsPayload(latestPayload));
    };

    const scheduleConnFlush = () => {
      if (connStreamFrameRef.current !== null || typeof window === 'undefined') return;
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      if (hidden || typeof window.requestAnimationFrame !== 'function') {
        const delay = hidden ? HIDDEN_CONN_FLUSH_DELAY_MS : FRAME_FLUSH_DELAY_MS;
        connStreamFrameRef.current = window.setTimeout(flushPendingConnections, delay);
        return;
      }
      connStreamFrameRef.current = window.requestAnimationFrame(flushPendingConnections);
    };

    const applySnapshot = (snapshot) => {
      if (!snapshot || disposed) return false;
      pendingConnRef.current = snapshot;
      lastSnapshotAt = Date.now();
      scheduleConnFlush();
      return true;
    };

    const fetchSnapshot = async () => {
      try {
        const snapshotUrl = appendAccessKeyParam(`${apiBase}/connections`, accessKey);
        const response = await fetch(snapshotUrl);
        if (!response.ok || disposed) return false;
        const payload = parseConnectionsPayload(await response.text());
        if (!payload) return false;
        return applySnapshot(payload);
      } catch (_err) {
        return false;
      }
    };

    const onVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible' || disposed) return;
      cancelScheduledConnFlush();
      if (pendingConnRef.current) {
        scheduleConnFlush();
        return;
      }
      fetchSnapshot().catch(() => {});
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
    fetchSnapshot().catch(() => {});
    const es = new EventSource(url);
    connStreamRef.current = es;
    setConnStreamStatus('connecting');
    const staleWatchdog = typeof window !== 'undefined'
      ? window.setInterval(() => {
        if (disposed) return;
        const stale = !lastSnapshotAt || Date.now() - lastSnapshotAt >= staleThresholdMs;
        if (!stale) return;
        fetchSnapshot().catch(() => {});
      }, staleThresholdMs)
      : null;

    es.onopen = () => {
      setConnStreamStatus('live');
    };
    es.onmessage = (event) => {
      const nextPayload = parseConnectionsPayload(event?.data);
      if (!nextPayload) return;
      if (applySnapshot(nextPayload)) {
        setConnStreamStatus('live');
      }
    };
    es.onerror = () => {
      if (!disposed) {
        setConnStreamStatus('reconnecting');
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      disposed = true;
      es.close();
      cancelScheduledConnFlush();
      pendingConnRef.current = null;
      if (staleWatchdog !== null && typeof window !== 'undefined') {
        window.clearInterval(staleWatchdog);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
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
}
