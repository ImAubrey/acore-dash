import { startTransition, useEffect, useRef } from 'react';
import {
  appendAccessKeyParam,
  getConnectionRateKey,
  getDetailKey,
  DASHBOARD_CACHE_WINDOW_MS,
  TRAFFIC_MAX_SAMPLES,
  normalizeConnectionsPayload,
  parseConnectionsPayload
} from '../../dashboardShared';

const HIDDEN_CONN_FLUSH_DELAY_MS = 250;
const FRAME_FLUSH_DELAY_MS = 16;
const STREAM_STALE_MULTIPLIER = 4;
const STREAM_STALE_MIN_MS = 4000;
const STREAM_MIN_APPLY_INTERVAL_MS = 120;
const CONN_RATE_SAMPLE_MIN_INTERVAL_MS = 180;

const getRuntimeRate = (value, fallback = 0) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? rate : fallback;
};
const getPreferredRuntimeRate = (value, fallback = 0) => {
  const rate = Number(value);
  if (Number.isFinite(rate) && rate > 0) return rate;
  const fallbackRate = Number(fallback || 0);
  if (Number.isFinite(fallbackRate) && fallbackRate > 0) return fallbackRate;
  return Number.isFinite(rate) && rate >= 0 ? rate : fallbackRate;
};
const distributeGroupRateFallback = (entries, rateKey, totalRate, weightKey) => {
  const rate = Number(totalRate || 0);
  if (!Array.isArray(entries) || entries.length === 0 || !Number.isFinite(rate) || rate <= 0) return;
  const currentRateTotal = entries.reduce((sum, entry) => sum + (Number(entry?.[rateKey]) || 0), 0);
  if (currentRateTotal > 0) return;
  const weightTotal = entries.reduce((sum, entry) => {
    const weight = Number(entry?.[weightKey] || 0);
    return sum + (Number.isFinite(weight) && weight > 0 ? weight : 0);
  }, 0);
  const denominator = weightTotal > 0 ? weightTotal : entries.length;
  entries.forEach((entry) => {
    const rawWeight = Number(entry?.[weightKey] || 0);
    const weight = weightTotal > 0 && Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;
    entry[rateKey] = (rate * weight) / denominator;
  });
};

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
  const lastRatesSampleAtRef = useRef(0);
  const trafficTotalsRef = useRef(new Map());

  useEffect(() => {
    let disposed = false;
    let lastSnapshotAt = 0;
    let lastAppliedAt = 0;
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
      if (!latestPayload || disposed) return;
      const now = Date.now();
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      const minInterval = hidden ? HIDDEN_CONN_FLUSH_DELAY_MS : STREAM_MIN_APPLY_INTERVAL_MS;
      const elapsed = now - lastAppliedAt;
      if (elapsed < minInterval && typeof window !== 'undefined') {
        connStreamFrameRef.current = window.setTimeout(
          flushPendingConnections,
          minInterval - elapsed
        );
        return;
      }
      pendingConnRef.current = null;
      lastAppliedAt = now;
      const normalized = normalizeConnectionsPayload(latestPayload);
      startTransition(() => {
        setConnections(normalized);
      });
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
    trafficTotalsRef.current = new Map();
  }, [apiBase]);

  useEffect(() => {
    if (!isDashboardPage) return;
    const now = Date.now();
    setTrafficSeries((prev) => {
      const uploadTotal = connections.uploadTotal || 0;
      const downloadTotal = connections.downloadTotal || 0;
      const hasRuntimeRates = Boolean(connections.rateSampledAt || connections.hasRuntimeRates);
      const runtimeUp = hasRuntimeRates ? getRuntimeRate(connections.uploadRate, 0) : null;
      const runtimeDown = hasRuntimeRates ? getRuntimeRate(connections.downloadRate, 0) : null;
      const nextTrafficTotals = new Map();
      let up = runtimeUp === null ? 0 : runtimeUp;
      let down = runtimeDown === null ? 0 : runtimeDown;

      if (!hasRuntimeRates) {
        (connections.connections || []).forEach((conn) => {
          const connRateKey = getConnectionRateKey(conn);
          const details = Array.isArray(conn.details) && conn.details.length > 0
            ? conn.details
            : [conn];
          details.forEach((detail, idx) => {
            const key = detail === conn
              ? `conn:${connRateKey}`
              : `detail:${getDetailKey(connRateKey, detail, idx)}`;
            const currentUpload = Number(detail.upload || 0);
            const currentDownload = Number(detail.download || 0);
            const safeUpload = Number.isFinite(currentUpload) && currentUpload >= 0 ? currentUpload : 0;
            const safeDownload = Number.isFinite(currentDownload) && currentDownload >= 0 ? currentDownload : 0;
            const previous = trafficTotalsRef.current.get(key);
            if (previous) {
              const elapsed = (now - previous.time) / 1000;
              if (elapsed > 0) {
                up += Math.max(0, safeUpload - previous.upload) / elapsed;
                down += Math.max(0, safeDownload - previous.download) / elapsed;
              }
            }
            nextTrafficTotals.set(key, {
              upload: safeUpload,
              download: safeDownload,
              time: now
            });
          });
        });
      }
      trafficTotalsRef.current = nextTrafficTotals;

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
      if (pruned.length > TRAFFIC_MAX_SAMPLES) {
        return pruned.slice(-TRAFFIC_MAX_SAMPLES);
      }
      return pruned;
    });
  }, [connections, totalSessions, isDashboardPage]);

  useEffect(() => {
    if (!isConnectionsPage) return;
    const now = Date.now();
    if (now - lastRatesSampleAtRef.current < CONN_RATE_SAMPLE_MIN_INTERVAL_MS) {
      return;
    }
    lastRatesSampleAtRef.current = now;
    const nextConnRates = new Map();
    const nextConnTotals = new Map();
    const nextDetailRates = new Map();
    const nextDetailTotals = new Map();

    (displayConnections || []).forEach((conn) => {
      const connRateKey = getConnectionRateKey(conn);
      if (!connRateKey) return;
      const currentUpload = conn.upload || 0;
      const currentDownload = conn.download || 0;
      const prev = connTotalsRef.current.get(connRateKey);
      let uploadRate = 0;
      let downloadRate = 0;
      if (prev) {
        const elapsed = (now - prev.time) / 1000;
        if (elapsed > 0) {
          uploadRate = Math.max(0, currentUpload - prev.upload) / elapsed;
          downloadRate = Math.max(0, currentDownload - prev.download) / elapsed;
        }
      }
      uploadRate = getPreferredRuntimeRate(conn.uploadRate, uploadRate);
      downloadRate = getPreferredRuntimeRate(conn.downloadRate, downloadRate);
      nextConnRates.set(connRateKey, { upload: uploadRate, download: downloadRate });
      nextConnTotals.set(connRateKey, { upload: currentUpload, download: currentDownload, time: now });

      const detailRateEntries = [];
      (conn.details || []).forEach((detail, idx) => {
        const detailKey = getDetailKey(connRateKey, detail, idx);
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
        detailUploadRate = getPreferredRuntimeRate(detail.uploadRate, detailUploadRate);
        detailDownloadRate = getPreferredRuntimeRate(detail.downloadRate, detailDownloadRate);
        detailRateEntries.push({
          detailKey,
          uploadRate: detailUploadRate,
          downloadRate: detailDownloadRate,
          upload: detailUpload,
          download: detailDownload
        });
        nextDetailTotals.set(detailKey, { upload: detailUpload, download: detailDownload, time: now });
      });
      distributeGroupRateFallback(detailRateEntries, 'uploadRate', uploadRate, 'upload');
      distributeGroupRateFallback(detailRateEntries, 'downloadRate', downloadRate, 'download');
      detailRateEntries.forEach((entry) => {
        nextDetailRates.set(entry.detailKey, {
          upload: entry.uploadRate,
          download: entry.downloadRate
        });
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
    lastRatesSampleAtRef.current = 0;
    setConnRates(new Map());
    setDetailRates(new Map());
  }, [isConnectionsPage, connViewMode]);
}
