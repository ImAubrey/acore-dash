// Canonical formats accepted by infra/subscription/parser.go. Existing aliases
// and future values are still surfaced by SelectField without being discarded.
export const SUBSCRIPTION_FORMATS = ['auto', 'json', 'jsonc', 'yaml', 'share'];
export const DATABASE_TYPES = ['geoip', 'geosite', 'ja4'];
export const DATABASE_SOURCE_TYPES = ['auto', 'json', 'db'];

export function parseSubscriptionValue(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2);
  try {
    const entry = JSON.parse(text);
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { entry: null, text, error: 'Subscription configuration must be a JSON object.' };
    }
    return { entry, text, error: '' };
  } catch (error) {
    return { entry: null, text, error: `Invalid JSON: ${error.message}` };
  }
}

export function updateSubscriptionField(entry, field, rawValue, options = {}) {
  const next = { ...(entry && typeof entry === 'object' ? entry : {}) };
  const value = typeof rawValue === 'string' && options.trim !== false ? rawValue.trim() : rawValue;
  if (value === '' || value === undefined || value === null) delete next[field];
  else next[field] = value;
  return next;
}

export function formatSubscriptionValue(entry) {
  return JSON.stringify(entry && typeof entry === 'object' ? entry : {}, null, 2);
}
