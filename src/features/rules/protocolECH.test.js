import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { formatRuleEditorJson, parseRuleEditorJson, patchRuleText, validateRuleEditorValue } from './ruleVisualEditor.js';

test('routing and firewall preserve explicit ECH evidence selectors and the legacy alias', () => {
  for (const kind of ['rule', 'firewallRule']) {
    for (const protocols of [['ech:present'], ['!ech:present'], ['ech'], ['tls', '!ech'], ['tls', '!ech:present']]) {
      const original = kind === 'rule' ? { destination: 'direct' } : { action: 'block' };
      const rule = patchRuleText(original, 'protocol', protocols.join(', '), { arrayDefault: true });
      assert.equal(validateRuleEditorValue(rule, kind), '');
      assert.deepEqual(parseRuleEditorJson(formatRuleEditorJson(rule)).value.protocol, protocols);
      assert.equal(original.protocol, undefined);
    }
  }
});

test('shared ECH options explicitly describe evidence, GREASE and compatibility', async () => {
  const source = await readFile(new URL('./RuleVisualEditor.jsx', import.meta.url), 'utf8');
  assert.match(source, /value: 'ech:present', label: 'ech:present \(ECH extension; may be GREASE\)'/);
  assert.match(source, /value: '!ech:present'/);
  assert.match(source, /value: 'ech', label: 'ech \(Legacy alias for ech:present; unconfirmed\)'/);
});
