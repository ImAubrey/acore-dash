export const RULE_MATCH_FIELDS = [
  ['source', 'Source (alias)'],
  ['sourceIP', 'Source IP'],
  ['ip', 'Destination IP'],
  ['domain', 'Domain'],
  ['network', 'Network'],
  ['ttl', 'TTL / Hop Limit'],
  ['port', 'Port'],
  ['sourcePort', 'Source port'],
  ['localIP', 'Local IP'],
  ['localPort', 'Local port'],
  ['vlessRoute', 'VLESS route match'],
  ['protocol', 'Protocol'],
  ['alpn', 'ALPN'],
  ['process', 'Process'],
  ['inboundTag', 'Inbound tag'],
  ['user', 'User'],
  ['requireRuleTag', 'Required rule tag']
];

export const FIREWALL_ACTIONS = ['allow', 'block', 'mark', 'limit', 'speed', 'trigger'];

export const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const asRuleRecord = (value) => (isRecord(value) ? value : {});

export const valueToText = (value) => Array.isArray(value) ? value.join(', ') : String(value ?? '');

export const normalizeRuleListValue = (value) => {
  const source = Array.isArray(value) ? value : String(value ?? '').split(/[\n,]/);
  return source.map((item) => String(item ?? '').trim()).filter(Boolean);
};

export const moveRuleListItem = (value, fromIndex, toIndex) => {
  const source = Array.isArray(value) ? [...value] : [];
  if (fromIndex < 0 || fromIndex >= source.length || toIndex < 0 || toIndex >= source.length || fromIndex === toIndex) return source;
  const [item] = source.splice(fromIndex, 1);
  source.splice(toIndex, 0, item);
  return source;
};

export const attrsToVisualText = (value) => Object.entries(isRecord(value) ? value : {})
  .map(([key, item]) => `${key}=${String(item ?? '')}`)
  .join('\n');

export const visualTextToAttrs = (text) => {
  const entries = String(text ?? '').split(/\r?\n/);
  const attrs = {};
  entries.forEach((entry) => {
    const separator = entry.indexOf('=');
    if (separator <= 0) return;
    const key = entry.slice(0, separator).trim();
    if (!key) return;
    attrs[key] = entry.slice(separator + 1).trim();
  });
  return Object.keys(attrs).length ? attrs : undefined;
};

export const textToValue = (text, previous, { arrayDefault = false } = {}) => {
  const next = String(text ?? '').trim();
  if (!next) return undefined;
  if (Array.isArray(previous) || arrayDefault) {
    return next.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  }
  return next;
};

// Each patch starts from the full source object so fields that do not have a visual
// control stay byte-for-byte equivalent as JavaScript values.
export const patchRuleText = (value, key, text, options) => {
  const source = asRuleRecord(value);
  const next = { ...source };
  const parsed = textToValue(text, source[key], options);
  if (parsed === undefined) delete next[key];
  else next[key] = parsed;
  return next;
};

export const patchRuleValue = (value, key, nextValue) => {
  const next = { ...asRuleRecord(value) };
  if (nextValue === undefined || nextValue === null || nextValue === '') delete next[key];
  else next[key] = nextValue;
  return next;
};

export const patchRuleNested = (value, key, field, nextValue) => {
  const source = asRuleRecord(value);
  const nested = isRecord(source[key]) ? source[key] : {};
  const updated = { ...nested };
  if (nextValue === undefined || nextValue === null || nextValue === '') delete updated[field];
  else updated[field] = nextValue;
  return patchRuleValue(source, key, Object.keys(updated).length ? updated : undefined);
};

export const normalizeBalancerSelectors = (selector) => {
  const values = Array.isArray(selector)
    ? selector
    : String(selector ?? '').split(/[\n,]/);
  return [...new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))];
};

export const setBalancerSelectorSelected = (value, selector, selected) => {
  const normalizedSelector = String(selector ?? '').trim();
  if (!normalizedSelector) return asRuleRecord(value);
  const selectors = normalizeBalancerSelectors(asRuleRecord(value).selector);
  const nextSelectors = selected
    ? [...new Set([...selectors, normalizedSelector])]
    : selectors.filter((item) => item !== normalizedSelector);
  return patchRuleValue(value, 'selector', nextSelectors.length ? nextSelectors : undefined);
};

export const setBalancerFallbackTag = (value, tag) => {
  const normalizedTag = String(tag ?? '').trim();
  return patchRuleValue(value, 'fallbackTag', normalizedTag || undefined);
};

export const getDestinationTag = (value) => {
  const destination = asRuleRecord(value).destination;
  return isRecord(destination) ? String(destination.tag ?? '') : String(destination ?? '');
};

export const getDestinationVlessRoute = (value) => {
  const destination = asRuleRecord(value).destination;
  return isRecord(destination) ? String(destination.vlessRoute ?? '') : '';
};

export const patchRuleDestination = (value, tagText, vlessRouteText = getDestinationVlessRoute(value)) => {
  const source = asRuleRecord(value);
  const next = { ...source };
  const tag = String(tagText ?? '').trim();
  const vlessRoute = String(vlessRouteText ?? '').trim();
  if (!tag) {
    delete next.destination;
    return next;
  }
  if (vlessRoute || isRecord(source.destination)) {
    const destination = isRecord(source.destination) ? { ...source.destination } : {};
    destination.tag = tag;
    if (vlessRoute) destination.vlessRoute = vlessRoute;
    else delete destination.vlessRoute;
    next.destination = destination;
  } else {
    next.destination = tag;
  }
  return next;
};

export const parseRuleEditorJson = (text) => {
  try {
    const value = JSON.parse(text);
    if (!isRecord(value)) return { value: null, error: 'Rule JSON must be an object.' };
    return { value, error: '' };
  } catch (error) {
    return { value: null, error: `Invalid JSON: ${error.message}` };
  }
};

export const formatRuleEditorJson = (value) => JSON.stringify(asRuleRecord(value), null, 2);

export const normalizeFirewallAction = (action) => {
  if (typeof action === 'number') {
    return ['mark', 'allow', 'block', 'limit', 'speed', 'trigger'][action] || 'allow';
  }
  const normalized = String(action || 'allow').trim().toLowerCase();
  return FIREWALL_ACTIONS.includes(normalized) ? normalized : 'allow';
};

export const validateTTLMatch = (ttl, hopLimit) => {
  if (ttl !== undefined && hopLimit !== undefined) return 'Use ttl or hopLimit, not both.';
  const raw = ttl ?? hopLimit;
  if (raw === undefined || raw === null || raw === '') return '';
  const items = (Array.isArray(raw) ? raw : String(raw).split(','))
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  if (items.length === 0) return 'ttl must contain a value from 1 to 255.';
  for (const item of items) {
    const matched = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(item);
    if (!matched) return 'ttl must use numbers or ranges such as 64 or 1-32.';
    const from = Number(matched[1]);
    const to = matched[2] === undefined ? from : Number(matched[2]);
    if (from < 1 || from > 255 || to < 1 || to > 255 || from > to) {
      return 'ttl values must be ordered between 1 and 255.';
    }
  }
  return '';
};

export const validateRuleEditorValue = (value, target) => {
  const rule = asRuleRecord(value);
  const ttlError = validateTTLMatch(rule.ttl, rule.hopLimit);
  if (ttlError) return ttlError;
  if (target !== 'firewallRule' && target !== 'firewall') return '';
  for (const key of ['destination', 'outboundTag', 'balancerTag', 'reLookup']) {
    if (rule[key] !== undefined) return `Firewall rules do not support ${key}.`;
  }
  const rawAction = rule.action;
  const action = normalizeFirewallAction(rawAction);
  if (rawAction !== undefined && action === 'allow' && String(rawAction).trim().toLowerCase() !== 'allow' && rawAction !== 1) {
    return 'action must be mark, allow, block, limit, speed, or trigger.';
  }
  if (action === 'limit' && !isRecord(rule.limit)) return 'limit action requires a limit object.';
  if (action === 'speed' && !isRecord(rule.speed)) return 'speed action requires a speed object.';
  if (action === 'trigger') {
    if (!isRecord(rule.trigger)) return 'trigger action requires a trigger object.';
    const dynamicRule = rule.trigger.dynamicRule;
    if (dynamicRule !== undefined && !isRecord(dynamicRule)) return 'trigger.dynamicRule must be an object.';
    if (isRecord(dynamicRule)) {
      const dynamicTTLError = validateTTLMatch(dynamicRule.ttl, dynamicRule.hopLimit);
      if (dynamicTTLError) return `trigger.dynamicRule ${dynamicTTLError}`;
    }
  }
  return '';
};
