import { serializeConnectionSearchValue, splitConnectionSearchValue } from '../connections/connectionSearch.js';

const fields = {
  sourceIp: ['src:', 'sourceIps', 'notSourceIps'],
  domain: ['domain:', 'domains', 'notDomains'],
  outbound: ['out:', 'outbounds', 'notOutbounds'],
  routeRule: ['route:', 'routeRules', 'notRouteRules'],
  firewallRule: ['fw:', 'firewallRules', 'notFirewallRules'],
};

function facetToken(field, value) {
  const endpoint = field === 'sourceIp' || field === 'domain';
  return fields[field][0] + (endpoint ? value.toLowerCase() : encodeURIComponent(value));
}

export function invertHistoryToken(token) {
  return token.startsWith('!') ? token.slice(1) : '!' + token;
}

function parseToken(token) {
  const exclude = token.startsWith('!');
  const text = exclude ? token.slice(1) : token;
  for (const [field, [prefix]] of Object.entries(fields)) {
    if (!text.toLowerCase().startsWith(prefix)) continue;
    let value = text.slice(prefix.length);
    if (field !== 'domain' && field !== 'sourceIp') {
      try { value = decodeURIComponent(value); } catch { /* Literal percent in typed tag. */ }
    }
    return { field, value, exclude, label: prefix + value };
  }
  return { value: text, exclude, label: text };
}

export function historyTokenLabel(token) { return parseToken(token).label; }

function matchesFacet(token, field, item) {
  const parsed = parseToken(token);
  return parsed.field === field && facetToken(field, parsed.value) === facetToken(field, item);
}

export function hasHistoryFacet(value, field, item) {
  const { tokens, draft } = splitConnectionSearchValue(value);
  return [...tokens, draft].some(token => matchesFacet(token, field, item));
}

export function toggleHistoryFacet(value, field, item, invert = false) {
  const { tokens, draft } = splitConnectionSearchValue(value);
  const matches = token => matchesFacet(token, field, item);
  if (tokens.some(matches) || matches(draft)) {
    if (invert) return serializeConnectionSearchValue(
      tokens.map(token => matches(token) ? invertHistoryToken(token) : token),
      matches(draft) ? invertHistoryToken(draft) : draft,
    );
    return serializeConnectionSearchValue(tokens.filter(token => !matches(token)), matches(draft) ? '' : draft);
  }
  return serializeConnectionSearchValue([...tokens, facetToken(field, item)], draft);
}

export function historySearchFilters(value, detailed = true) {
  const result = {}, filters = {}, words = [];
  for (const token of value.trim().split(/\s+/).filter(Boolean)) {
    const { field, value: item, exclude } = parseToken(token);
    const endpoint = field === 'sourceIp' || field === 'domain';
    if (endpoint && !exclude) (result[fields[field][1]] ??= []).push(item);
    else if (detailed && (field || exclude)) {
      if (item) (filters[field ? fields[field][exclude ? 2 : 1] : 'notWords'] ??= []).push(item);
    } else words.push(token);
  }
  if (words.length) result.search = words.join(' ');
  if (Object.keys(filters).length) result.filters = filters;
  return result;
}
