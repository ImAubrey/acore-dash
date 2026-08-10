import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const connectionsPanelPath = fileURLToPath(new URL('./ConnectionsPanel.jsx', import.meta.url));
const blockedRulesViewPath = fileURLToPath(new URL('./BlockedRulesView.jsx', import.meta.url));
const dashboardPath = fileURLToPath(new URL('../../DashboardApp.jsx', import.meta.url));

test('adds Blocked Rules beside Live and Closed connections', async () => {
  const source = await readFile(connectionsPanelPath, 'utf8');
  const live = source.indexOf("setConnListMode('live')");
  const closed = source.indexOf("setConnListMode('closed')");
  const blocked = source.indexOf("setConnListMode('blocked')");

  assert.ok(live >= 0, 'Live tab is present');
  assert.ok(closed > live, 'Closed follows Live');
  assert.ok(blocked > closed, 'Blocked Rules follows Closed');
  assert.match(source, /connListMode === 'blocked'/);
  assert.match(source, /<BlockedRulesView rulesData=\{rulesData\}/);
});

test('keeps blocked-rule counts live throughout the Connections page', async () => {
  const source = await readFile(dashboardPath, 'utf8');

  assert.match(
    source,
    /displayPage === 'rules'[\s\S]*displayPage === 'connections'/
  );
  assert.match(source, /rulesData,[\s\S]*connSearchQuery/);
});

test('renders blocked rules as one Connections-style table row per bucket', async () => {
  const source = await readFile(blockedRulesViewPath, 'utf8');

  assert.match(source, /className="table connections-table blocked-rules-table"/);
  assert.match(source, /className=\{`row blocked-rule-row/);
  assert.match(
    source,
    /<span>Rule<\/span>[\s\S]*<span>Source<\/span>[\s\S]*<span>Destination<\/span>[\s\S]*<span>Trigger<\/span>[\s\S]*<span>Mode<\/span>[\s\S]*<span>Remaining<\/span>[\s\S]*<span>Blocked until<\/span>/
  );
  assert.doesNotMatch(source, /dynamic-rule-item|<details|rules-list/);
});

test('uses tokenized AND search for live and closed connections', async () => {
  const source = await readFile(connectionsPanelPath, 'utf8');

  assert.match(source, /<ConnectionSearchInput/);
  assert.match(source, /matchesConnectionSearch\(toSearchText\(detail\), connectionSearchTerms\)/);
  assert.doesNotMatch(source, /<HeaderSearchInput/);
});
