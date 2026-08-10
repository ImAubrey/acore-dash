import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../common/panelPrimitives';
import {
  formatActiveTriggerBucket,
  getRemainingTtl,
  normalizeActiveTriggers
} from '../rules/dynamicRules';

const formatTimestamp = (value) => {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) return '-';
  return new Date(timestamp).toLocaleString();
};

const formatMode = (item) => {
  if (item.mode !== 'newConnections') return 'Active connections';
  const windowSeconds = Number(item.windowSeconds) || 0;
  return windowSeconds > 0 ? `New connections / ${windowSeconds}s` : 'New connections';
};

const formatEndpoint = (address, port) => {
  const host = String(address || '').trim() || '*';
  const normalizedPort = Number(port) || 0;
  if (!normalizedPort) return host;
  return `${host.includes(':') ? `[${host}]` : host}:${normalizedPort}`;
};

export function BlockedRulesView({ rulesData }) {
  const [now, setNow] = useState(() => Date.now());
  const activeTriggers = useMemo(
    () => normalizeActiveTriggers(rulesData?.activeTriggers),
    [rulesData?.activeTriggers]
  );

  useEffect(() => {
    if (activeTriggers.length === 0 || typeof window === 'undefined') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTriggers.length]);

  return (
    <section className="blocked-rules-view" aria-label="Blocked rules">
      {activeTriggers.length === 0 ? (
        <EmptyState small message="No blocked rule is active." />
      ) : (
        <div className="connections-table-wrap blocked-rules-table-wrap">
          <div className="table connections-table blocked-rules-table">
            <div className="row header">
              <span>Rule</span>
              <span>Source</span>
              <span>Destination</span>
              <span>Trigger</span>
              <span>Mode</span>
              <span>Remaining</span>
              <span>Blocked until</span>
            </div>
            {activeTriggers.map((item, index) => {
              const snapshotAt = Number(rulesData?.receivedAt);
              const serverRemainingMs = Number(item.remainingMs);
              const effectiveExpiry = Number.isFinite(snapshotAt)
                && snapshotAt > 0
                && Number.isFinite(serverRemainingMs)
                && serverRemainingMs >= 0
                ? snapshotAt + serverRemainingMs
                : item.blockedUntil;
              const ttl = getRemainingTtl(effectiveExpiry, now);
              const title = item.ruleTag || `blocked rule ${index + 1}`;
              const bucket = formatActiveTriggerBucket(item);
              const source = formatEndpoint(item.sourceIp, item.sourcePort);
              const destination = formatEndpoint(item.destinationIp, item.destinationPort);
              return (
                <div
                  className={`row blocked-rule-row${ttl.expired ? ' is-expired' : ''}`}
                  key={`${item.key}:${item.triggerKey}:${bucket}:${index}`}
                  title={bucket}
                >
                  <span className="mono rule-cell" title={title}>{title}</span>
                  <span className="mono blocked-rule-endpoint" title={source}>{source}</span>
                  <span className="mono blocked-rule-endpoint" title={destination}>{destination}</span>
                  <span className="mono" title={`Bucket key: ${item.triggerKey}`}>
                    {item.count} &gt; {item.max}
                  </span>
                  <span className="blocked-rule-mode" title={formatMode(item)}>{formatMode(item)}</span>
                  <span>
                    <span className={`meta-pill active-trigger-ttl-pill${ttl.expired ? ' is-expired' : ''}`}>
                      {ttl.label}
                    </span>
                  </span>
                  <span className="blocked-rule-until" title={formatTimestamp(item.blockedUntil)}>
                    {formatTimestamp(item.blockedUntil)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
