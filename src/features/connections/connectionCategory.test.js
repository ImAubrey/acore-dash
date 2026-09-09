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
    categories: ['google', 'category-search-engines', 'geolocation-!cn'],
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

test('unified categories show IP prefixes beside domain categories and support search', () => {
  const connection = { metadata: {
    categories: ['google', 'ip:cloudflare', 'ip:us'],
    geositeDomain: 'www.google.com', destinationIP: '203.0.113.1'
  } };
  assert.deepEqual(getConnectionCategory(connection), {
    status: 'classified', label: 'google · ip:cloudflare · ip:us',
    categories: ['google', 'ip:cloudflare', 'ip:us'],
    title: 'Categories: google, ip:cloudflare, ip:us\nDomain: www.google.com\nDestination IP: 203.0.113.1'
  });
  assert.equal(matchesConnectionSearch(JSON.stringify(connection), 'GOOGLE IP:US'), true);
  assert.equal(matchesConnectionSearch(JSON.stringify(connection), 'ip:cn'), false);
});

test('IP-only ended flows are classified without a domain', () => {
  const connection = { closedAt: '2026-09-09T04:00:00Z', metadata: {
    categories: ['ip:us'], destinationIP: '203.0.113.1'
  } };
  assert.equal(getConnectionCategory(connection).label, 'ip:us');
  assert.equal(getConnectionCategory(connection).title, 'Categories: ip:us\nDestination IP: 203.0.113.1');
});

test('empty unified categories hide stale legacy fields without requiring a status', () => {
  assert.equal(getConnectionCategory({ metadata: {
    categories: [], categoryStatus: 'mixed', geositeCategories: ['google'], geoipCategories: ['us']
  } }).label, '-');
  assert.deepEqual(getConnectionCategory({ metadata: {
    categories: [], categoryStatus: 'unknown', geositeCategories: ['stale']
  } }).categories, []);
  assert.equal(getConnectionCategory({ metadata: { categories: [] } }).label, '-');
  assert.equal(getConnectionCategory({ metadata: {
    categories: ['ip:sg'], categoryStatus: 'mixed', geositeStatus: 'unknown', geoipStatus: 'unknown'
  } }).label, 'ip:sg');
});

test('separate IP fields can coexist with legacy GeoSite metadata without duplicate entries', () => {
  assert.deepEqual(getConnectionCategory({ metadata: {
    geositeCategories: ['google'], geoipCategories: ['us', null, 'us'], geositeStatus: 'unmatched'
  } }).categories, ['google', 'ip:us']);
  assert.deepEqual(getConnectionCategory({ metadata: {
    categories: [null, 2, '', 'ip:us', 'ip:us']
  } }).categories, ['ip:us']);
});
