import { useEffect } from 'react';
import {
  appendAccessKeyParam,
  fetchJson,
  LOG_MAX_LINES,
  toNewestFirst
} from '../../dashboardShared';

export function useLogsStream({
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
}) {
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
    if (page !== 'logs') return;
    loadLogConfig();
  }, [page, apiBase]);

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

  return {
    applyLogLevel
  };
}
