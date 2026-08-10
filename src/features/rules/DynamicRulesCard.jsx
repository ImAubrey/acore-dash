import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../common/panelPrimitives';
import { ScrollArea } from '../common/ScrollArea';
import { FIREWALL_TRIGGER_RULE_TEMPLATE } from '../../dashboardShared';
import {
  getRemainingTtl,
  normalizeDynamicRules
} from './dynamicRules';

const formatTimestamp = (value) => {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) return '-';
  return new Date(timestamp).toLocaleString();
};

const formatJson = (value) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch (_err) {
    return '{}';
  }
};

export function DynamicRulesCard({
  rulesData,
  openRulesModal
}) {
  const [now, setNow] = useState(() => Date.now());
  const activeRules = useMemo(
    () => normalizeDynamicRules(rulesData?.dynamicRules),
    [rulesData?.dynamicRules]
  );
  useEffect(() => {
    if (activeRules.length === 0 || typeof window === 'undefined') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeRules.length]);

  const insertTrigger = () => {
    openRulesModal(
      'firewallRule',
      'insert',
      -1,
      -1,
      null,
      FIREWALL_TRIGGER_RULE_TEMPLATE
    );
  };

  return (
    <div className="group-card dynamic-rules-card">
      <div className="group-header">
        <div>
          <h3>Dynamic rules</h3>
          <p className="group-meta">
            Active {activeRules.length} · Runtime rules created by firewall triggers
          </p>
        </div>
        <button className="primary small" type="button" onClick={insertTrigger}>
          Add trigger
        </button>
      </div>

      <div className="dynamic-rule-priority-note">
        Dynamic rules are evaluated before every static routing rule.
      </div>

      <div className="dynamic-rules-section">
        <div className="dynamic-rules-section-head">
          <h4>Runtime</h4>
          <span className="meta-pill dynamic-runtime-pill">live</span>
        </div>
        {activeRules.length === 0 ? (
          <EmptyState small message="No dynamic rules are active." />
        ) : (
          <div className="rules-list dynamic-rules-list">
            {activeRules.map((item, index) => {
              const snapshotAt = Number(rulesData?.receivedAt);
              const serverRemainingMs = Number(item.remainingMs);
              const effectiveExpiry = Number.isFinite(snapshotAt)
                && snapshotAt > 0
                && Number.isFinite(serverRemainingMs)
                && serverRemainingMs >= 0
                ? snapshotAt + serverRemainingMs
                : item.expiresAt;
              const ttl = getRemainingTtl(effectiveExpiry, now);
              const title = item.ruleTag || item.sourceRuleTag || `dynamic rule ${index + 1}`;
              return (
                <div
                  className={`rule-item dynamic-rule-item${ttl.expired ? ' is-expired' : ''}`}
                  key={`${item.key}:${index}`}
                >
                  <div className="dynamic-rule-item-head">
                    <h4 className="mono" title={title}>{title}</h4>
                    <span className={`meta-pill dynamic-ttl-pill${ttl.expired ? ' is-expired' : ''}`}>
                      {ttl.label}
                    </span>
                  </div>
                  <dl className="dynamic-rule-facts">
                    <div>
                      <dt>Target</dt>
                      <dd className="mono">{item.target || '-'}</dd>
                    </div>
                    <div>
                      <dt>Trigger</dt>
                      <dd className="mono">{item.sourceRuleTag || '-'}</dd>
                    </div>
                    <div>
                      <dt>Activated</dt>
                      <dd>{formatTimestamp(item.activatedAt)}</dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>{formatTimestamp(item.expiresAt)}</dd>
                    </div>
                  </dl>
                  <details className="dynamic-rule-details">
                    <summary>Runtime rule JSON</summary>
                    <ScrollArea className="rule-json-scroll" axis="both" ariaLabel="Runtime rule JSON">
                      <pre className="rule-json">{formatJson(item.raw)}</pre>
                    </ScrollArea>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
