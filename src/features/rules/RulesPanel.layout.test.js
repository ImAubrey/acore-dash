import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rulesPanelPath = fileURLToPath(new URL('./RulesPanel.jsx', import.meta.url));
const stylesPath = fileURLToPath(new URL('../../styles.css', import.meta.url));
const configLoadersPath = fileURLToPath(new URL('../settings/useConfigDataLoaders.jsx', import.meta.url));

test('keeps Dynamic Rules in the Firewall column directly above Firewall Rules', async () => {
  const source = await readFile(rulesPanelPath, 'utf8');
  const columnStart = source.indexOf('<div className="rules-firewall-column">');
  const dynamicStart = source.indexOf('<DynamicRulesCard', columnStart);
  const firewallStart = source.indexOf('<FirewallRulesCard', columnStart);

  assert.ok(columnStart >= 0, 'Firewall content has a dedicated column');
  assert.ok(dynamicStart > columnStart, 'Dynamic Rules are rendered in that column');
  assert.ok(firewallStart > dynamicStart, 'Firewall Rules follow Dynamic Rules in that column');
  assert.doesNotMatch(source, /ActiveTriggersCard/);
  assert.equal(
    source.indexOf('<DynamicRulesCard', dynamicStart + 1),
    -1,
    'Dynamic Rules have one render location'
  );
});

test('uses a stacked right column and a two-column combined layout', async () => {
  const styles = await readFile(stylesPath, 'utf8');

  assert.match(styles, /\.rules-firewall-column\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*16px;/);
  assert.match(
    styles,
    /\.rules \.rules-firewall-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(360px, 1fr\);/
  );
});

test('polls the lightweight rules runtime endpoint', async () => {
  const source = await readFile(configLoadersPath, 'utf8');

  assert.match(source, /fetchJson\(`\$\{base\}\/rules\/runtime`\)/);
  assert.doesNotMatch(source, /fetchJson\(`\$\{base\}\/rules`\)/);
});
