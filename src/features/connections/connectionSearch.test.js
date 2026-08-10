import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getConnectionSearchTerms,
  matchesConnectionSearch,
  serializeConnectionSearchValue,
  splitConnectionSearchValue
} from './connectionSearch.js';

test('turns every completed space-separated condition into a removable token', () => {
  assert.deepEqual(splitConnectionSearchValue('tcp 443 '), {
    tokens: ['tcp', '443'],
    draft: ''
  });
  assert.deepEqual(splitConnectionSearchValue('tcp 443'), {
    tokens: ['tcp'],
    draft: '443'
  });
  assert.equal(serializeConnectionSearchValue(['tcp'], ''), 'tcp ');
  assert.equal(serializeConnectionSearchValue(['tcp'], '443'), 'tcp 443');
});

test('matches connection conditions with AND semantics across the full search text', () => {
  const terms = getConnectionSearchTerms('TCP   443');

  assert.deepEqual(terms, ['tcp', '443']);
  assert.equal(matchesConnectionSearch('39.110.230.51 TCP outbound port 443', terms), true);
  assert.equal(matchesConnectionSearch('39.110.230.51 UDP outbound port 443', terms), false);
  assert.equal(matchesConnectionSearch('TCP outbound port 80', terms), false);
});
