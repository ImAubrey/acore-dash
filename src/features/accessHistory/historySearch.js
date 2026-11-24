import {
  serializeConnectionSearchValue,
  splitConnectionSearchValue,
} from '../connections/connectionSearch.js';

const fields = { sourceIp: 'src:', domain: 'domain:' };

function historyFacet(field, value) {
  return fields[field] + value.toLowerCase();
}

export function hasHistoryFacet(value, field, item) {
  const { tokens, draft } = splitConnectionSearchValue(value);
  const facet = historyFacet(field, item);
  return [...tokens, draft].some((token) => token.toLowerCase() === facet);
}

export function toggleHistoryFacet(value, field, item) {
  const { tokens, draft } = splitConnectionSearchValue(value);
  const facet = historyFacet(field, item);
  if (hasHistoryFacet(value, field, item)) {
    return serializeConnectionSearchValue(
      tokens.filter((token) => token.toLowerCase() !== facet),
      draft.toLowerCase() === facet ? '' : draft,
    );
  }
  return serializeConnectionSearchValue([...tokens, facet], draft);
}

export function historySearchFilters(value) {
  const sourceIps = [];
  const domains = [];
  const words = [];
  for (const word of value.trim().split(/\s+/)) {
    if (!word) continue;
    const lower = word.toLowerCase();
    if (lower.startsWith(fields.sourceIp))
      sourceIps.push(word.slice(fields.sourceIp.length));
    else if (lower.startsWith(fields.domain))
      domains.push(word.slice(fields.domain.length));
    else words.push(word);
  }
  return {
    ...(sourceIps.length && { sourceIps }),
    ...(domains.length && { domains }),
    ...(words.length && { search: words.join(' ') }),
  };
}
