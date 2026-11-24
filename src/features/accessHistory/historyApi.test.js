import assert from 'node:assert/strict';
import test from 'node:test';
import { collectorBase, historyRequest, queryWindow } from './historyApi.js';

test('collector requests use their own credentials and same-origin mount', async t => {
  const origin = 'https://dash.example';
  assert.equal(collectorBase('/flowd/', origin), '/flowd');
  for (const path of ['https://other.example', '//other.example', '/']) {
    assert.throws(() => collectorBase(path, origin));
  }
  let request;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    request = options;
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  });
  await historyRequest('/flowd/api/v1/access-history/query', {
    cluster: true, key: 'node-only', token: 'cluster-only', body: { domain: 'example.com' }
  });
  assert.equal(request.headers.Authorization, 'Bearer cluster-only');
  assert.equal(request.headers['X-Access-Key'], undefined);
  assert.equal(request.redirect, 'error');
  assert.equal(request.credentials, 'omit');
});

test('fixed and custom windows preserve millisecond boundaries', () => {
  assert.deepEqual(queryWindow('all'), {});
  assert.deepEqual(queryWindow('1', '', '', 3600001), { fromMs: 1, toMs: 3600001 });
  assert.throws(() => queryWindow('custom', 'invalid', 'invalid'));
});
