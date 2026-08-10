const toText = (value) => String(value ?? '');

export const getConnectionSearchTerms = (value) => (
  toText(value)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
);

export const matchesConnectionSearch = (value, terms) => {
  const normalizedTerms = Array.isArray(terms)
    ? terms
    : getConnectionSearchTerms(terms);
  if (normalizedTerms.length === 0) return true;
  const haystack = toText(value).toLowerCase();
  return normalizedTerms.every((term) => haystack.includes(term));
};

export const splitConnectionSearchValue = (value) => {
  const raw = toText(value);
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { tokens: [], draft: '' };
  }
  if (/\s$/.test(raw)) {
    return { tokens: parts, draft: '' };
  }
  return {
    tokens: parts.slice(0, -1),
    draft: parts[parts.length - 1]
  };
};

export const serializeConnectionSearchValue = (tokens, draft = '') => {
  const normalizedTokens = (Array.isArray(tokens) ? tokens : [])
    .map((token) => toText(token).trim())
    .filter(Boolean);
  const normalizedDraft = toText(draft).trim();
  if (normalizedDraft) {
    return [...normalizedTokens, normalizedDraft].join(' ');
  }
  return normalizedTokens.length > 0 ? `${normalizedTokens.join(' ')} ` : '';
};
