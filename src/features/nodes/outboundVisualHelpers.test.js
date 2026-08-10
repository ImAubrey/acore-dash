import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROTOCOL_FIELD_GROUPS,
  appendOutboundArrayItem,
  blackholeResponseToArray,
  blackholeResponseToLegacy,
  formatOutboundValue,
  getLegacyEndpointArrayPath,
  getPathValue,
  getProtocolGroups,
  isSupportedOutboundProtocol,
  parseOutboundValue,
  removeOutboundArrayItem,
  setPathValue,
  updateOutboundArrayItem,
  updateOutboundField,
  validateBlackholeResponseArray
} from './outboundVisualHelpers.js';

test('blackhole response conversion preserves legacy fields and assigns an explicit proto', () => {
  const legacy = {
    type: 'http-302',
    redirect_url: 'https://example.com/',
    extension: { keep: true }
  };
  const responses = blackholeResponseToArray(legacy);
  assert.deepEqual(responses, [{ ...legacy, proto: 'http' }]);
  assert.deepEqual(blackholeResponseToLegacy(responses), legacy);

  assert.equal(blackholeResponseToArray({ type: 'tls-40' })[0].proto, 'tls');
  assert.equal(blackholeResponseToArray({ type: 'icmp-echo-request' })[0].proto, 'icmp');
  assert.equal(blackholeResponseToArray({ type: 'none' })[0].proto, 'tcp');
});

test('blackhole response arrays require safe unique proto selectors', () => {
  assert.equal(validateBlackholeResponseArray([{ proto: 'http', type: 'http-204' }]), '');
  assert.match(validateBlackholeResponseArray([]), /at least one/);
  assert.match(validateBlackholeResponseArray([{ type: 'none' }]), /specify proto/);
  assert.match(validateBlackholeResponseArray([{ proto: 'http tls', type: 'none' }]), /invalid proto/);
  assert.match(validateBlackholeResponseArray([
    { proto: 'HTTP', type: 'http-204' },
    { proto: 'http', type: 'http-403' }
  ]), /Duplicate proto/);
});

test('parses only outbound objects and reports useful JSON errors', () => {
  const parsed = parseOutboundValue('{"tag":"direct","protocol":"freedom"}');
  assert.equal(parsed.error, '');
  assert.equal(parsed.outbound.tag, 'direct');
  assert.match(parseOutboundValue('[1,2]').error, /must be an object/);
  assert.match(parseOutboundValue('{').error, /Invalid outbound JSON/);
});

test('path updates preserve unknown sibling and extension fields', () => {
  const original = {
    tag: 'proxy',
    extension: { untouched: true },
    settings: { address: 'old.example', customOption: { enabled: true } }
  };
  const updated = setPathValue(original, ['settings', 'address'], 'new.example');

  assert.equal(updated.settings.address, 'new.example');
  assert.deepEqual(updated.settings.customOption, { enabled: true });
  assert.deepEqual(updated.extension, { untouched: true });
  assert.equal(original.settings.address, 'old.example');
  assert.equal(setPathValue(original, ['__proto__', 'polluted'], true), original);
  assert.equal({}.polluted, undefined);
});

test('field updates coerce common visual input types without dropping unknown data', () => {
  const outbound = { settings: { custom: 42 } };
  const withPort = updateOutboundField(outbound, {
    path: ['settings', 'port'],
    type: 'integer'
  }, '443');
  const withAddresses = updateOutboundField(withPort, {
    path: ['settings', 'address'],
    type: 'list'
  }, '10.0.0.1/32\nfd00::1/128');

  assert.equal(withPort.settings.port, 443);
  assert.deepEqual(withAddresses.settings.address, ['10.0.0.1/32', 'fd00::1/128']);
  assert.equal(withAddresses.settings.custom, 42);
  assert.match(formatOutboundValue(withAddresses), /"custom": 42/);
});

test('array helpers update endpoints immutably and preserve unknown endpoint fields', () => {
  const outbound = {
    settings: {
      vnext: [{ address: 'a.example', port: 443, custom: 'keep' }]
    }
  };
  const updated = updateOutboundArrayItem(
    outbound,
    ['settings', 'vnext'],
    0,
    ['address'],
    'b.example'
  );
  const appended = appendOutboundArrayItem(updated, ['settings', 'vnext'], { address: 'c.example' });
  const removed = removeOutboundArrayItem(appended, ['settings', 'vnext'], 0);

  assert.equal(updated.settings.vnext[0].custom, 'keep');
  assert.equal(outbound.settings.vnext[0].address, 'a.example');
  assert.equal(appended.settings.vnext.length, 2);
  assert.equal(removed.settings.vnext[0].address, 'c.example');
  assert.equal(getPathValue(updated, ['settings', 'vnext', 0, 'address']), 'b.example');
});

test('detects legacy endpoint arrays and maps protocol aliases', () => {
  assert.deepEqual(
    getLegacyEndpointArrayPath({ settings: { vnext: [] } }, 'vless'),
    ['settings', 'vnext']
  );
  assert.deepEqual(
    getLegacyEndpointArrayPath({ settings: { servers: [] } }, 'shadowsocks'),
    ['settings', 'servers']
  );
  assert.equal(getLegacyEndpointArrayPath({ settings: {} }, 'vless'), null);
  assert.equal(getProtocolGroups('direct'), PROTOCOL_FIELD_GROUPS.freedom);
  assert.equal(getProtocolGroups('block'), PROTOCOL_FIELD_GROUPS.blackhole);
  assert.equal(getProtocolGroups('hy2'), PROTOCOL_FIELD_GROUPS.hysteria);
  assert.equal(isSupportedOutboundProtocol('VLESS'), true);
  assert.equal(isSupportedOutboundProtocol('hysteria2'), true);
  assert.equal(isSupportedOutboundProtocol('custom-extension'), false);
  assert.equal(isSupportedOutboundProtocol(''), false);
});

test('protocol schemas cover requested settings and mark secrets as password fields', () => {
  const required = [
    'blackhole', 'freedom', 'dns', 'socks', 'http', 'vmess',
    'vless', 'trojan', 'shadowsocks', 'wireguard', 'hysteria'
  ];
  required.forEach((protocol) => assert.ok(PROTOCOL_FIELD_GROUPS[protocol]?.length, protocol));

  const fieldFor = (protocol, suffix) => PROTOCOL_FIELD_GROUPS[protocol]
    .flatMap((group) => group.fields)
    .find((field) => field.path.join('.').endsWith(suffix));

  assert.equal(fieldFor('socks', 'settings.pass').type, 'password');
  assert.equal(fieldFor('trojan', 'settings.password').type, 'password');
  assert.equal(fieldFor('shadowsocks', 'settings.password').type, 'password');
  assert.equal(fieldFor('wireguard', 'settings.secretKey').type, 'password');
  assert.equal(fieldFor('hysteria', 'hysteriaSettings.auth').type, 'password');
  assert.ok(fieldFor('blackhole', 'settings.response.delay'));
  assert.ok(fieldFor('blackhole', 'settings.response.icmp'));
  assert.ok(fieldFor('wireguard', 'settings.address'));
});
