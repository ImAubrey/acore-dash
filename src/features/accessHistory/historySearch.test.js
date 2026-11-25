import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasHistoryFacet,
  historySearchFilters,
  toggleHistoryFacet,
} from './historySearch.js';

test('toggles record selections without replacing other chips or draft text', () => {
  const start = 'media stream';
  const domains = toggleHistoryFacet(toggleHistoryFacet(start, 'domain', 'a.example'), 'domain', 'B.example');
  const selected = toggleHistoryFacet(domains, 'sourceIp', '2001:DB8::1');
  assert.equal(selected, 'media domain:a.example domain:b.example src:2001:db8::1 stream');
  assert.equal(hasHistoryFacet(selected, 'domain', 'A.example'), true);
  assert.equal(toggleHistoryFacet(selected, 'domain', 'A.example'), 'media domain:b.example src:2001:db8::1 stream');
  assert.equal(toggleHistoryFacet('media domain:a.example', 'domain', 'a.example'), 'media ');
});

test('extracts same-field selections separately from free text', () => {
  assert.deepEqual(historySearchFilters('src:192.0.2.1 video DOMAIN:a.test local domain:b.test '), {
    sourceIps: ['192.0.2.1'],
    domains: ['a.test', 'b.test'],
    search: 'video local',
  });
  assert.deepEqual(historySearchFilters('  '), {});
});

test('includes and excludes exact tags separately, preserving case and spaces', () => {
  const search = toggleHistoryFacet('!src:192.0.2.1 !domain:a.test !media ', 'routeRule', 'Allow % Video');
  const excluded = toggleHistoryFacet(search, 'routeRule', 'Allow % Video', true);
  assert.deepEqual(historySearchFilters(excluded + 'fw:Allow out:JP !out:US'), {
    filters: {notSourceIps:['192.0.2.1'], notDomains:['a.test'], notWords:['media'],
      notRouteRules:['Allow % Video'], firewallRules:['Allow'], outbounds:['JP'], notOutbounds:['US']},
  });
  assert.equal(toggleHistoryFacet(excluded, 'routeRule', 'Allow % Video', true), search);
});
