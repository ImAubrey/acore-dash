import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTriggerDuration,
  formatActiveTriggerBucket,
  getConfiguredDynamicRuleTriggers,
  getFirewallTriggerDetail,
  getRemainingTtl,
  normalizeDynamicRules,
  normalizeActiveTriggers,
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
    sustain: '10s',
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

test('normalizes and formats active firewall trigger buckets', () => {
  const result = normalizeActiveTriggers([{
    ruleId: '0000000000001234',
    ruleTag: 'udp-srcip-dstport-burst',
    key: 'srcIpDstPort',
    sourceIp: '192.168.69.92',
    destinationPort: 8030,
    mode: 'newConnections',
    count: 11,
    max: 10,
    blockedUntil: '2026-08-10T00:30:00Z'
  }]);

  assert.equal(result.length, 1);
  assert.equal(result[0].triggerKey, 'srcIpDstPort');
  assert.equal(result[0].count, 11);
  assert.equal(formatActiveTriggerBucket(result[0]), 'src=192.168.69.92 · dport=8030');
  assert.equal(formatActiveTriggerBucket({ triggerKey: 'ruleWide' }), 'Whole rule');
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
  assert.equal(entries[0].detail, '>9 conn · all · hold 10s · → icmp-echo · ban 60s');
});

test('validates nested dynamicRule and backend duration fields', () => {
  assert.equal(validateFirewallTrigger(validTriggerRule()), '');

  const legacyTrigger = validTriggerRule();
  delete legacyTrigger.trigger.dynamicRule;
  assert.equal(validateFirewallTrigger(legacyTrigger), '');

  const keyedTrigger = validTriggerRule();
  keyedTrigger.trigger.key = 'srcIpDstPort';
  assert.match(validateFirewallTrigger(keyedTrigger), /only supports key=ruleWide/);

  delete keyedTrigger.trigger.dynamicRule;
  assert.equal(validateFirewallTrigger(keyedTrigger), '');

  const bothDurations = validTriggerRule();
  bothDurations.trigger.blockMinutes = 1;
  assert.match(validateFirewallTrigger(bothDurations), /cannot both be set/);

  const mixedSustain = validTriggerRule();
  mixedSustain.trigger.sustainSeconds = 2;
  assert.match(validateFirewallTrigger(mixedSustain), /cannot be combined/);

  const invalidSustain = validTriggerRule();
  invalidSustain.trigger.sustain = '2 seconds';
  assert.match(validateFirewallTrigger(invalidSustain), /positive duration/);

  const missingTarget = validTriggerRule();
  delete missingTarget.trigger.dynamicRule.outboundTag;
  assert.match(validateFirewallTrigger(missingTarget), /outboundTag or balancerTag/);

  const newConnections = validTriggerRule();
  newConnections.trigger.mode = 'newConnections';
  assert.match(validateFirewallTrigger(newConnections), /windowSeconds/);
});

test('supports sustain duration strings and legacy alternatives', () => {
  assert.equal(formatTriggerDuration({ blockSeconds: 1 }), '1 second');
  assert.equal(formatTriggerDuration({ blockMinutes: 2 }), '2 minutes');
  assert.match(getFirewallTriggerDetail(validTriggerRule()), /→ icmp-echo/);

  const compactRule = validTriggerRule();
  compactRule.trigger.key = 'srcIpDstPort';
  compactRule.trigger.maxConnections = 10;
  compactRule.trigger.sustain = '2h';
  compactRule.trigger.blockSeconds = undefined;
  compactRule.trigger.blockMinutes = 30;
  delete compactRule.trigger.dynamicRule;
  assert.equal(
    getFirewallTriggerDetail(compactRule),
    '>10 conn · srcIP+dport · hold 2h · ban 30m'
  );

  compactRule.trigger.sustain = undefined;
  compactRule.trigger.sustainMinutes = 2;
  assert.match(getFirewallTriggerDetail(compactRule), /hold 2m/);

  compactRule.trigger.sustainMinutes = undefined;
  compactRule.trigger.sustainMinitues = 2;
  assert.equal(getFirewallTriggerDetail(compactRule), '>10 conn · srcIP+dport · ban 30m');
});
