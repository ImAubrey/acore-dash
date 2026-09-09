import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { getConnectionProtocolView } from './connectionProtocol.js';
import { matchesConnectionSearch } from './connectionSearch.js';

test('real connection cells, regrouping and search use the same protocol identity', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom'
  });
  try {
    const { createDetailCellRenderer } = await server.ssrLoadModule('/src/features/connections/detailCellRenderer.jsx');
    const { buildConnectionsView, toSearchText, DETAIL_COLUMNS } = await server.ssrLoadModule('/src/dashboardShared.jsx');
    const renderCell = createDetailCellRenderer({ highlightConnCell: (value) => value });
    const metadata = {
      network: 'tcp', type: 'unknown', inboundName: 'dokodemo-door', inboundTag: 'transparent-in',
      sourceIP: '192.0.2.10', destinationIP: '198.51.100.20'
    };
    const detail = { id: '1', metadata };
    const known = { id: '2', metadata: { ...metadata, type: 'tls', inboundName: 'http' } };
    const connection = { id: 'group', details: [detail, known] };

    const html = renderToStaticMarkup(renderCell('protocol', connection, detail));
    assert.ok(html.includes(getConnectionProtocolView(metadata).label));
    assert.doesNotMatch(html, /dokodemo-door|transparent-in/);
    assert.equal(renderCell('inbound', connection, detail), 'transparent-in');
    assert.equal(renderCell('inboundName', connection, detail), 'dokodemo-door');
    assert.ok(DETAIL_COLUMNS.some((column) => column.key === 'inboundName'));
    const splice = { metadata: { ...metadata, type: 'http1+splice' } };
    assert.match(renderToStaticMarkup(renderCell('protocol', connection, splice)), /TCP · HTTP · H1.*splice-badge.*SPLICE/);
    assert.equal(matchesConnectionSearch(toSearchText(detail), 'tcp unknown'), true);
    assert.equal(matchesConnectionSearch(toSearchText(known), 'unknown'), false);

    for (const mode of ['source', 'destination']) {
      const [group] = buildConnectionsView([connection], mode);
      assert.equal(group.metadata.type, 'mixed');
      assert.equal(group.metadata.inboundName, 'mixed');
      assert.deepEqual(group.details, connection.details);
      const allUnknown = { ...connection, details: [detail, { ...known, metadata }] };
      assert.equal(buildConnectionsView([allUnknown], mode)[0].metadata.type, 'unknown');
      assert.equal(matchesConnectionSearch(toSearchText(group), 'unknown'), true);
    }
    const closed = { ...connection, closedAt: '2026-09-09T05:44:34Z' };
    assert.equal(renderToStaticMarkup(renderCell('protocol', closed, detail)), html);
    assert.equal(metadata.type, 'unknown');
  } finally {
    await server.close();
  }
});
