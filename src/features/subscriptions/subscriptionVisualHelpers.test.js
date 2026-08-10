import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUBSCRIPTION_FORMATS,
  formatSubscriptionValue,
  parseSubscriptionValue,
  updateSubscriptionField
} from './subscriptionVisualHelpers.js';

test('subscription formats expose only parser-supported canonical choices', () => {
  assert.deepEqual(SUBSCRIPTION_FORMATS, ['auto', 'json', 'jsonc', 'yaml', 'share']);
  assert.equal(SUBSCRIPTION_FORMATS.includes('xray'), false);
});

test('subscription visual helpers retain unknown fields while changing modeled fields', () => {
  const parsed = parseSubscriptionValue('{"url":"https://example.test/sub?token=secret","futureOption":{"keep":true},"enabled":false}');
  assert.equal(parsed.error, '');
  const next = updateSubscriptionField(parsed.entry, 'name', ' primary ');
  assert.deepEqual(JSON.parse(formatSubscriptionValue(next)), {
    url: 'https://example.test/sub?token=secret',
    futureOption: { keep: true },
    enabled: false,
    name: 'primary'
  });
});

test('subscription visual helpers require object JSON and preserve parse errors for Advanced mode', () => {
  assert.match(parseSubscriptionValue('{').error, /^Invalid JSON:/);
  assert.equal(parseSubscriptionValue('[]').error, 'Subscription configuration must be a JSON object.');
});

test('blank optional visual values remove only their own field', () => {
  const next = updateSubscriptionField({ url: 'https://example.test/sub', tagPrefix: 'old', extension: 1 }, 'tagPrefix', '');
  assert.deepEqual(next, { url: 'https://example.test/sub', extension: 1 });
});
