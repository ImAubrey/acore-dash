import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  formatRuleEditorJson,
  parseRuleEditorJson,
  patchRuleText,
  validateRuleEditorValue
} from './ruleVisualEditor.js';

test('unknown protocol selectors round-trip in routing and firewall editors', () => {
  for (const kind of ['rule', 'firewallRule']) {
    const target = kind === 'rule' ? { destination: 'blackhole' } : { action: 'block' };
    for (const protocols of [['unknown'], ['!unknown'], ['unknown', 'bittorrent'], ['!unknown', '!tls', '!http']]) {
      const original = { ...target, ruleTag: 'empty-protocol', domain: ['!'], network: 'tcp', port: '3309' };
      const updated = patchRuleText(original, 'protocol', protocols.join(', '), { arrayDefault: true });
      assert.deepEqual(updated.protocol, protocols);
      assert.equal(validateRuleEditorValue(updated, kind), '');
      const decoded = parseRuleEditorJson(formatRuleEditorJson(updated));
      assert.equal(decoded.error, '');
      assert.deepEqual(decoded.value, updated);
      assert.deepEqual(original.domain, ['!']);
      assert.equal(original.protocol, undefined);
    }
  }
});

test('shared protocol choices describe unknown as an empty field, not an inbound or detector', async () => {
  const source = await readFile(new URL('./RuleVisualEditor.jsx', import.meta.url), 'utf8');
  const options = source.slice(source.indexOf('const PROTOCOL_OPTIONS'), source.indexOf('const MATCH_FIELD_DEFINITIONS'));
  assert.match(options, /value: 'unknown', label: 'unknown \(Empty protocol at evaluation\)'/);
  assert.match(options, /value: '!unknown', label: '!unknown \(Non-empty protocol\)'/);
  assert.match(source, /key: 'protocol', label: 'Protocol', kind: 'choices', options: PROTOCOL_OPTIONS/);
  assert.match(source, /<MatchFields value=\{rule\} onChange=\{update\} disabled=\{disabled\} \/>/);
});
