import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attrsToVisualText,
  formatRuleEditorJson,
  getDestinationTag,
  getDestinationVlessRoute,
  moveRuleListItem,
  normalizeFirewallAction,
  normalizeRuleListValue,
  normalizeBalancerSelectors,
  parseRuleEditorJson,
  patchRuleDestination,
  patchRuleNested,
  patchRuleText,
  patchRuleValue,
  setBalancerFallbackTag,
  setBalancerSelectorSelected,
  validateRuleEditorValue,
  validateTTLMatch,
  valueToText,
  visualTextToAttrs
} from './ruleVisualEditor.js';

test('visual text patches retain unknown rule fields and existing list semantics', () => {
  const original = {
    domain: ['example.com'],
    outboundTag: 'direct',
    futureField: { keep: true },
    customFlag: false
  };
  const updated = patchRuleText(original, 'domain', 'example.org, example.net', { arrayDefault: true });
  assert.deepEqual(updated.domain, ['example.org', 'example.net']);
  assert.equal(updated.outboundTag, 'direct');
  assert.deepEqual(updated.futureField, { keep: true });
  assert.equal(updated.customFlag, false);
  assert.deepEqual(original.domain, ['example.com']);
});

test('maps filled routing attributes into visual text and back', () => {
  const attrs = { ':method': 'GET', ja4: 'threat:malware' };
  const text = attrsToVisualText(attrs);
  assert.match(text, /:method=GET/);
  assert.match(text, /ja4=threat:malware/);
  assert.deepEqual(visualTextToAttrs(text), attrs);
  assert.equal(visualTextToAttrs(''), undefined);
});

test('normalizes and reorders rule list modal values', () => {
  assert.deepEqual(normalizeRuleListValue('a, b\nc'), ['a', 'b', 'c']);
  assert.deepEqual(normalizeRuleListValue([' a ', '', 'b']), ['a', 'b']);
  assert.deepEqual(moveRuleListItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(moveRuleListItem(['a'], 0, 3), ['a']);
});

test('blank optional visual values are removed without disturbing unknown fields', () => {
  const updated = patchRuleText({ outboundTag: 'direct', extension: 42 }, 'outboundTag', '');
  assert.equal('outboundTag' in updated, false);
  assert.equal(updated.extension, 42);
  assert.equal(valueToText(['a', 'b']), 'a, b');
});

test('nested firewall patches preserve sibling and top-level fields', () => {
  const original = {
    action: 'trigger',
    trigger: { maxConnections: 10, vendorOption: 'keep' },
    futureField: true
  };
  const updated = patchRuleNested(original, 'trigger', 'blockSeconds', 60);
  assert.deepEqual(updated.trigger, { maxConnections: 10, vendorOption: 'keep', blockSeconds: 60 });
  assert.equal(updated.futureField, true);
  assert.deepEqual(patchRuleValue(updated, 'reLookup', undefined).trigger, updated.trigger);
});

test('advanced JSON parsing accepts only rule objects and produces useful feedback', () => {
  assert.deepEqual(parseRuleEditorJson('{"ruleTag":"safe"}'), { value: { ruleTag: 'safe' }, error: '' });
  assert.match(parseRuleEditorJson('[').error, /Invalid JSON/);
  assert.equal(parseRuleEditorJson('[]').error, 'Rule JSON must be an object.');
  assert.match(formatRuleEditorJson({ ruleTag: 'safe' }), /"ruleTag"/);
});

test('normalizes legacy firewall action numbers to visual action labels', () => {
  assert.equal(normalizeFirewallAction(5), 'trigger');
  assert.equal(normalizeFirewallAction('BLOCK'), 'block');
  assert.equal(normalizeFirewallAction('future-action'), 'allow');
});

test('advanced firewall validation gives feedback without rejecting unknown fields', () => {
  assert.equal(validateRuleEditorValue({ action: 'limit', futureField: true }, 'firewallRule'), 'limit action requires a limit object.');
  assert.equal(validateRuleEditorValue({ action: 'trigger', trigger: { dynamicRule: [] } }, 'firewallRule'), 'trigger.dynamicRule must be an object.');
  assert.equal(validateRuleEditorValue({ action: 'allow', futureField: { nested: true } }, 'firewallRule'), '');
});

test('validates IPv4 TTL and IPv6 Hop Limit ranges in visual rules', () => {
  assert.equal(validateTTLMatch(64), '');
  assert.equal(validateTTLMatch('1, 32, 64-128'), '');
  assert.match(validateTTLMatch(0), /1 and 255/);
  assert.match(validateTTLMatch('64-32'), /ordered/);
  assert.match(validateTTLMatch('1-256'), /1 and 255/);
  assert.match(validateTTLMatch(64, 64), /not both/);
  assert.equal(validateRuleEditorValue({ network: 'icmp', ttl: '32-64', outboundTag: 'direct' }, 'rule'), '');
  assert.match(validateRuleEditorValue({ action: 'trigger', trigger: { dynamicRule: { ttl: 256 } } }, 'firewallRule'), /dynamicRule/);
});

test('balancer selector gets list defaults while retaining unmodeled strategy settings', () => {
  const updated = patchRuleText({
    tag: 'primary',
    strategy: { type: 'leastPing' },
    selector: ['old']
  }, 'selector', 'a, b', { arrayDefault: true });
  assert.deepEqual(updated.selector, ['a', 'b']);
  assert.deepEqual(updated.strategy, { type: 'leastPing' });
});

test('balancer selectors auto-normalize strings and toggle multi-select values losslessly', () => {
  assert.deepEqual(normalizeBalancerSelectors('direct, proxy\nbackup, direct'), ['direct', 'proxy', 'backup']);
  const original = { selector: 'direct,proxy', strategy: { type: 'random' }, extension: true };
  const selected = setBalancerSelectorSelected(original, 'backup', true);
  assert.deepEqual(selected.selector, ['direct', 'proxy', 'backup']);
  assert.deepEqual(selected.strategy, original.strategy);
  assert.equal(selected.extension, true);
  const removed = setBalancerSelectorSelected(selected, 'proxy', false);
  assert.deepEqual(removed.selector, ['direct', 'backup']);
});

test('balancer fallback is a unique optional tag and preserves unrelated fields', () => {
  const original = { fallbackTag: 'direct', selector: ['direct', 'proxy'], extension: true };
  const switched = setBalancerFallbackTag(original, 'proxy');
  assert.equal(switched.fallbackTag, 'proxy');
  assert.deepEqual(switched.selector, original.selector);
  assert.equal(switched.extension, true);
  const cleared = setBalancerFallbackTag(switched, '');
  assert.equal('fallbackTag' in cleared, false);
  assert.deepEqual(cleared.selector, original.selector);
});

test('destination visual patches preserve the string form and object-only options', () => {
  const stringTarget = patchRuleDestination({ futureField: true }, 'direct');
  assert.equal(stringTarget.destination, 'direct');
  assert.equal(getDestinationTag(stringTarget), 'direct');

  const objectTarget = patchRuleDestination(stringTarget, 'proxy', '4660');
  assert.deepEqual(objectTarget.destination, { tag: 'proxy', vlessRoute: '4660' });
  assert.equal(getDestinationVlessRoute(objectTarget), '4660');
  assert.equal(objectTarget.futureField, true);

  const removed = patchRuleDestination(objectTarget, '');
  assert.equal('destination' in removed, false);
  assert.equal(removed.futureField, true);
});
