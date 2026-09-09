import assert from 'node:assert/strict';
import test from 'node:test';
import { getConnectionECH, getConnectionECHLabel, getConnectionProtocol, getConnectionProtocolView, mergeConnectionECH, mergeConnectionProtocol } from './connectionProtocol.js';
import { matchesConnectionSearch } from './connectionSearch.js';

test('empty protocols display unknown independently of inbound, domain and attributes', () => {
  for (const inboundName of ['', 'dokodemo-door', 'socks', 'http']) {
    const metadata = { network: 'tcp', type: '', inboundName, host: 'example.com', alpn: 'h2', ja4: 'fingerprint' };
    assert.equal(getConnectionProtocol(metadata), 'unknown');
    assert.deepEqual(getConnectionProtocolView(metadata), { label: 'TCP · H2 · unknown', splice: false });
    assert.equal(metadata.type, '', 'formatting must not modify the input');
  }
  assert.deepEqual(getConnectionProtocolView({ network: 'udp' }), { label: 'UDP · unknown', splice: false });
  assert.deepEqual(getConnectionProtocolView(undefined), { label: '- · unknown', splice: false });
});

test('preserves known protocol, ALPN and splice display without inbound fallbacks', () => {
  for (const [type, alpn, label, splice] of [
    ['tls', 'h2', 'TCP · TLS · H2', false],
    ['tls+http2', '', 'TCP · TLS · HTTP · H2', false],
    ['http1+splice', '', 'TCP · HTTP · H1', true],
    ['ech', '', 'TCP · TLS · ECH? (legacy)', false],
    ['gquic', '', 'TCP · gquic', false],
    ['quic', 'h3-29', 'TCP · QUIC · H3', false],
    ['flow:bittorrent-mse', '', 'TCP · flow:bittorrent-mse', false],
    ['unknown-wire', '', 'TCP · unknown-wire', false],
    ['mixed', '', 'TCP · mixed', false],
    ['unknown', '', 'TCP · unknown', false]
  ]) {
    const metadata = { network: 'tcp', type, alpn, inboundName: 'dokodemo-door' };
    assert.equal(getConnectionProtocol(metadata), type);
    assert.deepEqual(getConnectionProtocolView(metadata), { label, splice });
  }
});

test('protocol aggregation keeps unknown and known flows distinct in either order', () => {
  for (const [protocols, expected] of [
    [['unknown', 'unknown'], 'unknown'],
    [['unknown', 'tls'], 'mixed'],
    [['tls', 'unknown'], 'mixed'],
    [['tls', 'tls'], 'tls'],
    [['unknown', 'flow:bittorrent-mse'], 'mixed'],
    [['tls', 'unknown', 'tls'], 'mixed']
  ]) {
    assert.equal(protocols.reduce(mergeConnectionProtocol, undefined), expected);
  }
});

test('unknown labels remain searchable in live and closed connection data', () => {
  for (const closedAt of [undefined, '2026-09-09T05:44:34Z']) {
    const detail = { closedAt, metadata: { network: 'tcp', type: 'unknown', inboundName: 'dokodemo-door' } };
    assert.equal(matchesConnectionSearch(JSON.stringify(detail), 'TCP unknown'), true);
    assert.equal(matchesConnectionSearch(JSON.stringify(detail), 'unknown dokodemo-door'), true);
    assert.equal(matchesConnectionSearch(JSON.stringify(detail), 'unknown tls'), false);
    assert.equal(getConnectionProtocolView(detail.metadata).label, 'TCP · unknown');
  }
});

test('ECH evidence is separate from protocol and never displays acceptance', () => {
  for (const type of ['tls', 'quic', 'dot', 'tls+splice']) {
    const metadata = { network: 'tcp', type, alpn: 'h2', ech: 'present', tlsOuterSNI: 'outer.example' };
    assert.equal(getConnectionProtocol(metadata), type);
    assert.equal(getConnectionECH(metadata), 'present');
    assert.equal(getConnectionECHLabel(metadata), 'ECH?');
    assert.match(getConnectionProtocolView(metadata).label, / · ECH\?$/);
    assert.doesNotMatch(getConnectionProtocolView(metadata).label, /outer\.example|accepted|confirmed/i);
    assert.equal(metadata.type, type);
  }
  assert.equal(getConnectionProtocolView({ network: 'tcp', type: 'tls', ech: 'present' }).label, 'TCP · TLS · ECH?');
  assert.equal(getConnectionECHLabel({ type: 'ech' }), 'ECH? (legacy)');
  assert.equal(getConnectionECHLabel({ type: 'mixed', ech: 'legacy' }), 'ECH? (legacy)');
  for (const ech of [undefined, '', false, true, 'accepted', 'invalid']) {
    assert.equal(getConnectionECH({ type: 'tls', ech }), '');
  }
});

test('ECH aggregation distinguishes absent, present and mixed evidence in either order', () => {
  for (const [states, expected] of [
    [['', ''], ''], [['present', 'present'], 'present'],
    [['', 'present'], 'mixed'], [['present', ''], 'mixed'],
    [['present', '', 'present'], 'mixed']
  ]) {
    assert.equal(states.reduce(mergeConnectionECH, undefined), expected);
  }
});
