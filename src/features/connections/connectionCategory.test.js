import assert from 'node:assert/strict';
import test from 'node:test';
import { getConnectionCategory } from './connectionCategory.js';
import { matchesConnectionSearch } from './connectionSearch.js';

test('shows every matched category and the domain used for classification', () => {
  const connection = { metadata: {
    geositeCategories: ['google', 'category-search-engines', 'geolocation-!cn'],
    geositeDomain: 'www.google.com',
    geositeStatus: 'classified'
  } };
  assert.deepEqual(getConnectionCategory(connection), {
    status: 'classified',
    label: 'google · category-search-engines · geolocation-!cn',
    title: 'Categories: google, category-search-engines, geolocation-!cn\nDomain: www.google.com'
  });
  assert.equal(matchesConnectionSearch(JSON.stringify(connection), 'GOOGLE category-search-engines'), true);
  assert.equal(matchesConnectionSearch(JSON.stringify(connection), 'google gaming'), false);
});

test('distinguishes a classified miss, unavailable domain, mixed group and older core', () => {
  for (const [status, label] of [['unmatched', 'Unmatched'], ['unknown', 'Unknown'], ['mixed', 'Mixed']]) {
    assert.equal(getConnectionCategory({ metadata: { geositeStatus: status, geositeCategories: [] } }).label, label);
  }
  assert.equal(getConnectionCategory({ metadata: {} }).label, 'Unavailable');
  assert.equal(getConnectionCategory(undefined).label, 'Unavailable');
  assert.equal(getConnectionCategory({ metadata: { geositeCategories: [] } }).label, 'Unknown');
});

test('a mixed group never presents a stale category as applying to every flow', () => {
  assert.equal(getConnectionCategory({ metadata: {
    geositeStatus: 'mixed', geositeCategories: ['google']
  } }).label, 'Mixed');
});

test('ignores malformed category values and keeps ended-flow metadata usable', () => {
  const connection = { closedAt: '2026-09-08T04:00:00Z', metadata: {
    geositeCategories: [null, 2, {}, '', 'steam'], geositeStatus: 'classified'
  } };
  assert.equal(getConnectionCategory(connection).label, 'steam');
  assert.equal(getConnectionCategory({ metadata: { geositeCategories: 'steam' } }).label, 'Unavailable');
});
