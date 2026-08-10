import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTriggerDuration,
  getConfiguredDynamicRuleTriggers,
  getFirewallTriggerDetail,
  getRemainingTtl,
  normalizeDynamicRules,
  validateFirewallTrigger
} from './dynamicRules.js';

const validTriggerRule = () => ({
  sourceIP: ['172.19.0.111'],
  network: 'icmp',
  ruleTag: 'icmp-burst-trigger',
  action: 'trigger',
  trigger: {
    mode: 'activeConnections',
    maxConnections: 9,
    sustainSeconds: 10,
    blockSeconds: 60,
    dynamicRule: {
      sourceIP: ['172.19.0.111'],
      network: 'icmp',
      ruleTag: 'icmp-blackhole-echo',
      outboundTag: 'icmp-echo'
    }
  }
});

test('normalizes the runtime /rules dynamicRules snapshot', () => {
  const result = normalizeDynamicRules([{
    sourceRuleTag: 'icmp-burst-trigger',
    activatedAt: '2026-08-10T00:00:00Z',
    expiresAt: '2026-08-10T00:00:10Z',
    target: 'blackhole',
    rule: {
      ruleTag: 'icmp-blackhole-echo',
      outboundTag: 'blackhole'
    }
  }]);

  assert.equal(result.length, 1);
  assert.equal(result[0].sourceRuleTag, 'icmp-burst-trigger');
  assert.equal(result[0].ruleTag, 'icmp-blackhole-echo');
  assert.equal(result[0].target, 'blackhole');
});

test('formats a live and expired remaining TTL', () => {
  assert.deepEqual(
    getRemainingTtl('2026-08-10T00:01:05Z', Date.parse('2026-08-10T00:00:00Z')),
    { label: '1m 05s remaining', remainingMs: 65000, expired: false }
  );
  assert.equal(
    getRemainingTtl('2026-08-10T00:00:00Z', Date.parse('2026-08-10T00:00:01Z')).expired,
    true
  );
  assert.equal(getRemainingTtl(2000, 1000).label, '1s remaining');
});

test('extracts configured firewall trigger declarations', () => {
  const triggerRule = validTriggerRule();
  const entries = getConfiguredDynamicRuleTriggers({
    rules: [
      { action: 'block', domain: ['example.com'] },
      { match: { sourceIP: triggerRule.sourceIP }, ...triggerRule }
    ]
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].index, 1);
  assert.equal(entries[0].source, '172.19.0.111');
  assert.equal(entries[0].target, 'icmp-echo');
  assert.match(entries[0].detail, /10\+ connections/);
  assert.match(entries[0].detail, /TTL 60 seconds/);
});

test('validates nested dynamicRule and backend duration fields', () => {
  assert.equal(validateFirewallTrigger(validTriggerRule()), '');

  const legacyTrigger = validTriggerRule();
  delete legacyTrigger.trigger.dynamicRule;
  assert.equal(validateFirewallTrigger(legacyTrigger), '');

  const bothDurations = validTriggerRule();
  bothDurations.trigger.blockMinutes = 1;
  assert.match(validateFirewallTrigger(bothDurations), /cannot both be set/);

  const missingTarget = validTriggerRule();
  delete missingTarget.trigger.dynamicRule.outboundTag;
  assert.match(validateFirewallTrigger(missingTarget), /outboundTag or balancerTag/);

  const newConnections = validTriggerRule();
  newConnections.trigger.mode = 'newConnections';
  assert.match(validateFirewallTrigger(newConnections), /windowSeconds/);
});

test('supports second and minute duration alternatives', () => {
  assert.equal(formatTriggerDuration({ blockSeconds: 1 }), '1 second');
  assert.equal(formatTriggerDuration({ blockMinutes: 2 }), '2 minutes');
  assert.match(getFirewallTriggerDetail(validTriggerRule()), /→ icmp-echo/);
});
