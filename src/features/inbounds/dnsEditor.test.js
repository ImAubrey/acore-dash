import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDnsHost,
  dnsListToText,
  dnsTextToList,
  formatDnsEditorConfig,
  moveDnsServer,
  normalizeDnsHostTargets,
  parseDnsEditorText,
  reorderDnsServers,
  renameDnsHost,
  setDnsHostValue,
  setDnsHostTargets,
  upsertDnsHost,
  upsertDnsServer,
  updateDnsServer,
  validateDnsEditorConfig
} from './dnsEditor.js';

test('parses only DNS objects and formats them deterministically', () => {
  const parsed = parseDnsEditorText('{"servers":["1.1.1.1"]}');
  assert.equal(parsed.error, '');
  assert.deepEqual(parsed.config.servers, ['1.1.1.1']);
  assert.match(formatDnsEditorConfig(parsed.config), /"servers": \[/);
  assert.match(parseDnsEditorText('[]').error, /JSON object/);
  assert.match(parseDnsEditorText('{').error, /Invalid JSON/);
});

test('converts multiline and comma separated rule lists', () => {
  assert.deepEqual(dnsTextToList('domain:a.test\nfull:b.test, geosite:cn'), [
    'domain:a.test',
    'full:b.test',
    'geosite:cn'
  ]);
  assert.equal(dnsListToText(['a', '', 'b']), 'a\nb');
});

test('updates and reorders DNS servers without dropping unknown fields', () => {
  const config = {
    customRoot: true,
    servers: [{ address: '1.1.1.1', customServer: 'keep' }, '8.8.8.8']
  };
  const updated = updateDnsServer(config, 0, (server) => ({ ...server, skipFallback: true }));
  assert.equal(updated.customRoot, true);
  assert.equal(updated.servers[0].customServer, 'keep');
  assert.equal(updated.servers[0].skipFallback, true);
  const moved = moveDnsServer(updated, 0, 1);
  assert.equal(moved.servers[0], '8.8.8.8');
  assert.equal(moved.servers[1].customServer, 'keep');
});

test('drag reorders DNS server rules before or after the target', () => {
  const config = {
    extension: { keep: true },
    servers: ['one', 'two', 'three', 'four']
  };
  const movedAfter = reorderDnsServers(config, 0, 2, 'after');
  assert.deepEqual(movedAfter.servers, ['two', 'three', 'one', 'four']);
  assert.deepEqual(movedAfter.extension, { keep: true });

  const movedBefore = reorderDnsServers(movedAfter, 3, 1, 'before');
  assert.deepEqual(movedBefore.servers, ['two', 'four', 'three', 'one']);
  assert.equal(reorderDnsServers(config, -1, 2, 'after'), config);
  assert.equal(reorderDnsServers(config, 1, 1, 'before'), config);
});

test('renames host rules safely and preserves order', () => {
  const config = { hosts: { 'a.test': '1.1.1.1', 'b.test': ['2.2.2.2'] } };
  const renamed = renameDnsHost(config, 'a.test', 'full:c.test');
  assert.equal(renamed.error, '');
  assert.deepEqual(Object.keys(renamed.config.hosts), ['full:c.test', 'b.test']);
  assert.match(renameDnsHost(renamed.config, 'b.test', 'full:c.test').error, /already exists/);
});

test('edits host targets and creates a collision-free default host', () => {
  const edited = setDnsHostValue({ hosts: { 'a.test': '1.1.1.1' } }, 'a.test', '2.2.2.2, 2001:db8::1');
  assert.deepEqual(edited.config.hosts['a.test'], ['2.2.2.2', '2001:db8::1']);
  const added = addDnsHost({ hosts: { 'example.local': '127.0.0.1' } });
  assert.equal(added.hosts['example-2.local'], '127.0.0.1');
});

test('treats every DNS host target as an independent IP block', () => {
  assert.deepEqual(normalizeDnsHostTargets('1.1.1.1, 8.8.8.8\n2001:db8::1'), [
    '1.1.1.1',
    '8.8.8.8',
    '2001:db8::1'
  ]);
  const original = { hosts: { 'dns.test': ['1.1.1.1', '8.8.8.8'] }, extension: true };
  const updated = setDnsHostTargets(original, 'dns.test', ['9.9.9.9', '2001:4860:4860::8888']);
  assert.deepEqual(updated.config.hosts['dns.test'], ['9.9.9.9', '2001:4860:4860::8888']);
  assert.equal(updated.config.extension, true);
  assert.match(setDnsHostTargets(original, 'dns.test', []).error, /required/);
});

test('validates server and host fields before saving', () => {
  assert.equal(validateDnsEditorConfig({ servers: [{ address: '1.1.1.1', port: 53 }] }), '');
  assert.match(validateDnsEditorConfig({ servers: [{ address: '', port: 53 }] }), /requires an address/);
  assert.match(validateDnsEditorConfig({ servers: [{ address: '1.1.1.1', port: 70000 }] }), /0 to 65535/);
  assert.match(validateDnsEditorConfig({ hosts: { 'a.test': [] } }), /at least one target/);
});

test('commits a DNS server modal draft once without losing extension fields', () => {
  const original = {
    extension: { keep: true },
    servers: [{ address: '1.1.1.1', customServerField: { preserved: true } }]
  };
  const draft = { address: 'https://dns.example/dns-query', customServerField: { preserved: true }, timeoutMs: 2000 };
  const result = upsertDnsServer(original, 0, draft);
  assert.equal(result.error, '');
  assert.equal(original.servers[0].address, '1.1.1.1');
  assert.equal(result.config.servers[0].address, 'https://dns.example/dns-query');
  assert.deepEqual(result.config.servers[0].customServerField, { preserved: true });
  assert.deepEqual(result.config.extension, { keep: true });
  assert.match(upsertDnsServer(original, null, { address: '' }).error, /address is required/);
});

test('commits or rejects host modal drafts without touching the original config', () => {
  const original = { extension: 'keep', hosts: { 'a.test': '1.1.1.1', 'b.test': '8.8.8.8' } };
  const renamed = upsertDnsHost(original, 'a.test', 'full:a.test', ['9.9.9.9', '2001:db8::1']);
  assert.equal(renamed.error, '');
  assert.deepEqual(Object.keys(renamed.config.hosts), ['full:a.test', 'b.test']);
  assert.deepEqual(renamed.config.hosts['full:a.test'], ['9.9.9.9', '2001:db8::1']);
  assert.deepEqual(original.hosts, { 'a.test': '1.1.1.1', 'b.test': '8.8.8.8' });
  assert.match(upsertDnsHost(original, 'a.test', 'b.test', ['9.9.9.9']).error, /already exists/);
});
