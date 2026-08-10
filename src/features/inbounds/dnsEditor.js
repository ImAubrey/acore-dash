const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const parseDnsEditorText = (text) => {
  try {
    const value = JSON.parse(String(text ?? '{}'));
    if (!isRecord(value)) {
      return { config: null, error: 'dns must be a JSON object.' };
    }
    return { config: value, error: '' };
  } catch (error) {
    return { config: null, error: `Invalid JSON: ${error.message}` };
  }
};

export const formatDnsEditorConfig = (config) => JSON.stringify(isRecord(config) ? config : {}, null, 2);

export const validateDnsEditorConfig = (config) => {
  if (!isRecord(config)) return 'dns must be a JSON object.';
  if (config.servers !== undefined && !Array.isArray(config.servers)) {
    return 'dns.servers must be an array.';
  }
  for (const [index, rawServer] of (config.servers || []).entries()) {
    if (typeof rawServer === 'string') {
      if (!rawServer.trim()) return `DNS server ${index + 1} requires an address.`;
      continue;
    }
    if (!isRecord(rawServer) || !String(rawServer.address ?? '').trim()) {
      return `DNS server ${index + 1} requires an address.`;
    }
    if (rawServer.port !== undefined && (!Number.isInteger(rawServer.port) || rawServer.port < 0 || rawServer.port > 65535)) {
      return `DNS server ${index + 1} port must be an integer from 0 to 65535.`;
    }
    for (const key of ['timeoutMs', 'serveExpiredTTL']) {
      if (rawServer[key] !== undefined && (!Number.isSafeInteger(rawServer[key]) || rawServer[key] < 0)) {
        return `DNS server ${index + 1} ${key} must be a non-negative integer.`;
      }
    }
  }
  if (config.hosts !== undefined && !isRecord(config.hosts)) {
    return 'dns.hosts must be an object.';
  }
  for (const [name, value] of Object.entries(config.hosts || {})) {
    if (!String(name).trim()) return 'DNS host domain is required.';
    const targets = Array.isArray(value) ? value : [value];
    if (targets.length === 0 || targets.some((target) => !String(target ?? '').trim())) {
      return `DNS host ${name} requires at least one target.`;
    }
  }
  for (const key of ['cacheSize', 'serveExpiredTTL']) {
    if (config[key] !== undefined && (!Number.isSafeInteger(config[key]) || config[key] < 0)) {
      return `dns.${key} must be a non-negative integer.`;
    }
  }
  return '';
};

export const dnsListToText = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean).join('\n');
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

export const dnsTextToList = (value) => String(value ?? '')
  .split(/[\n,]/)
  .map((item) => item.trim())
  .filter(Boolean);

export const normalizeDnsHostTargets = (value) => {
  const targets = Array.isArray(value) ? value : dnsTextToList(value);
  return targets.map((target) => String(target ?? '').trim()).filter(Boolean);
};

export const normalizeDnsServer = (value) => {
  if (typeof value === 'string') return { address: value };
  return isRecord(value) ? { ...value } : { address: '' };
};

export const updateDnsServer = (config, index, updater) => {
  const current = isRecord(config) ? config : {};
  const servers = Array.isArray(current.servers) ? [...current.servers] : [];
  if (!Number.isInteger(index) || index < 0 || index >= servers.length) return current;
  const server = normalizeDnsServer(servers[index]);
  const next = typeof updater === 'function' ? updater(server) : updater;
  servers[index] = isRecord(next) ? next : server;
  return { ...current, servers };
};

// Commits a complete modal draft in one operation. The draft is copied as-is so
// fields not represented by the visual editor survive an edit.
export const upsertDnsServer = (config, index, draft) => {
  const current = isRecord(config) ? config : {};
  const servers = Array.isArray(current.servers) ? [...current.servers] : [];
  const next = normalizeDnsServer(draft);
  const address = String(next.address ?? '').trim();
  if (!address) return { config: current, error: 'DNS server address is required.' };
  next.address = address;
  if (next.port !== undefined && (!Number.isInteger(next.port) || next.port < 0 || next.port > 65535)) {
    return { config: current, error: 'DNS server port must be an integer from 0 to 65535.' };
  }
  for (const key of ['timeoutMs', 'serveExpiredTTL']) {
    if (next[key] !== undefined && (!Number.isSafeInteger(next[key]) || next[key] < 0)) {
      return { config: current, error: `DNS server ${key} must be a non-negative integer.` };
    }
  }
  if (index === null || index === undefined) servers.push(next);
  else if (!Number.isInteger(index) || index < 0 || index >= servers.length) {
    return { config: current, error: 'DNS server no longer exists.' };
  } else servers[index] = next;
  return { config: { ...current, servers }, error: '' };
};

export const moveDnsServer = (config, index, offset) => {
  const current = isRecord(config) ? config : {};
  const servers = Array.isArray(current.servers) ? [...current.servers] : [];
  const target = index + offset;
  if (!Number.isInteger(index) || index < 0 || index >= servers.length || target < 0 || target >= servers.length) {
    return current;
  }
  [servers[index], servers[target]] = [servers[target], servers[index]];
  return { ...current, servers };
};

export const reorderDnsServers = (config, fromIndex, targetIndex, position = 'before') => {
  const current = isRecord(config) ? config : {};
  const servers = Array.isArray(current.servers) ? [...current.servers] : [];
  if (
    !Number.isInteger(fromIndex)
    || !Number.isInteger(targetIndex)
    || fromIndex < 0
    || targetIndex < 0
    || fromIndex >= servers.length
    || targetIndex >= servers.length
  ) {
    return current;
  }

  const rawInsertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
  let insertIndex = fromIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  insertIndex = Math.min(Math.max(insertIndex, 0), servers.length - 1);
  if (insertIndex === fromIndex) return current;

  const [server] = servers.splice(fromIndex, 1);
  servers.splice(insertIndex, 0, server);
  return { ...current, servers };
};

export const addDnsServer = (config) => {
  const current = isRecord(config) ? config : {};
  const servers = Array.isArray(current.servers) ? [...current.servers] : [];
  servers.push({ address: '1.1.1.1' });
  return { ...current, servers };
};

export const removeDnsServer = (config, index) => {
  const current = isRecord(config) ? config : {};
  const servers = Array.isArray(current.servers) ? [...current.servers] : [];
  if (!Number.isInteger(index) || index < 0 || index >= servers.length) return current;
  servers.splice(index, 1);
  return { ...current, servers };
};

export const setDnsObjectField = (value, key, nextValue, { deleteEmpty = false } = {}) => {
  const next = isRecord(value) ? { ...value } : {};
  if (nextValue === undefined || (deleteEmpty && String(nextValue ?? '').trim() === '')) {
    delete next[key];
  } else {
    next[key] = nextValue;
  }
  return next;
};

export const renameDnsHost = (config, previousName, nextName) => {
  const current = isRecord(config) ? config : {};
  const hosts = isRecord(current.hosts) ? { ...current.hosts } : {};
  const previous = String(previousName ?? '').trim();
  const next = String(nextName ?? '').trim();
  if (!previous || !Object.prototype.hasOwnProperty.call(hosts, previous)) {
    return { config: current, error: 'Host rule no longer exists.' };
  }
  if (!next) return { config: current, error: 'Host domain is required.' };
  if (next !== previous && Object.prototype.hasOwnProperty.call(hosts, next)) {
    return { config: current, error: `Host rule ${next} already exists.` };
  }
  if (next === previous) return { config: current, error: '' };

  const entries = Object.entries(hosts).map(([name, value]) => (name === previous ? [next, value] : [name, value]));
  return { config: { ...current, hosts: Object.fromEntries(entries) }, error: '' };
};

export const setDnsHostValue = (config, name, rawValue) => {
  const current = isRecord(config) ? config : {};
  const hosts = isRecord(current.hosts) ? { ...current.hosts } : {};
  const values = dnsTextToList(rawValue);
  if (values.length === 0) return { config: current, error: 'Host target is required.' };
  hosts[name] = values.length === 1 ? values[0] : values;
  return { config: { ...current, hosts }, error: '' };
};

export const setDnsHostTargets = (config, name, rawTargets) => {
  const current = isRecord(config) ? config : {};
  const hosts = isRecord(current.hosts) ? { ...current.hosts } : {};
  if (!Object.prototype.hasOwnProperty.call(hosts, name)) {
    return { config: current, error: 'Host rule no longer exists.' };
  }
  const targets = normalizeDnsHostTargets(rawTargets);
  if (targets.length === 0) return { config: current, error: 'Host target is required.' };
  hosts[name] = targets.length === 1 ? targets[0] : targets;
  return { config: { ...current, hosts }, error: '' };
};

// Adds or replaces an entire host mapping from a local modal draft. Existing
// host order is retained when renaming, and all root-level DNS fields survive.
export const upsertDnsHost = (config, previousName, nextName, rawTargets) => {
  const current = isRecord(config) ? config : {};
  const hosts = isRecord(current.hosts) ? { ...current.hosts } : {};
  const previous = previousName === null || previousName === undefined ? '' : String(previousName).trim();
  const next = String(nextName ?? '').trim();
  const targets = normalizeDnsHostTargets(rawTargets);
  if (!next) return { config: current, error: 'Host domain is required.' };
  if (!targets.length) return { config: current, error: 'Host target is required.' };
  if (previous && !Object.prototype.hasOwnProperty.call(hosts, previous)) {
    return { config: current, error: 'Host rule no longer exists.' };
  }
  if (next !== previous && Object.prototype.hasOwnProperty.call(hosts, next)) {
    return { config: current, error: `Host rule ${next} already exists.` };
  }
  const value = targets.length === 1 ? targets[0] : targets;
  if (!previous) return { config: { ...current, hosts: { ...hosts, [next]: value } }, error: '' };
  const entries = Object.entries(hosts).map(([name, target]) => [name === previous ? next : name, name === previous ? value : target]);
  return { config: { ...current, hosts: Object.fromEntries(entries) }, error: '' };
};

export const addDnsHost = (config) => {
  const current = isRecord(config) ? config : {};
  const hosts = isRecord(current.hosts) ? { ...current.hosts } : {};
  let suffix = 1;
  let name = 'example.local';
  while (Object.prototype.hasOwnProperty.call(hosts, name)) {
    suffix += 1;
    name = `example-${suffix}.local`;
  }
  hosts[name] = '127.0.0.1';
  return { ...current, hosts };
};

export const removeDnsHost = (config, name) => {
  const current = isRecord(config) ? config : {};
  const hosts = isRecord(current.hosts) ? { ...current.hosts } : {};
  delete hosts[name];
  return { ...current, hosts };
};

export const dnsServerSummary = (server, index = 0) => {
  const current = normalizeDnsServer(server);
  const address = String(current.address ?? '').trim() || '(address required)';
  const port = Number(current.port) > 0 ? `:${current.port}` : '';
  const domains = dnsTextToList(current.domains ?? current.domain).length;
  return {
    title: String(current.tag ?? '').trim() || `DNS server ${index + 1}`,
    endpoint: `${address}${port}`,
    domains
  };
};
