export const OUTBOUND_PROTOCOLS = [
  'freedom',
  'direct',
  'blackhole',
  'block',
  'dns',
  'socks',
  'http',
  'vmess',
  'vless',
  'trojan',
  'shadowsocks',
  'wireguard',
  'hysteria',
  'hysteria2',
  'hy2',
  'loopback'
];

export const isSupportedOutboundProtocol = (protocol) => OUTBOUND_PROTOCOLS.includes(
  String(protocol || '').trim().toLowerCase()
);

export const BLACKHOLE_RESPONSE_TYPES = [
  'none', 'http', 'http-200', 'http-204', 'http-301', 'http-302',
  'http-403', 'http-404', 'http-451', 'tls', 'tls-40', 'tls-70',
  'icmp', 'icmp-echo-request'
];

export const inferBlackholeResponseProto = (response) => {
  const type = String(response?.type || '').trim().toLowerCase();
  if (type === 'http' || type.startsWith('http-')) return 'http';
  if (type === 'tls' || type.startsWith('tls-')) return 'tls';
  if (type === 'icmp' || type.startsWith('icmp-') || type === 'echo-request') return 'icmp';
  return 'tcp';
};

export const blackholeResponseToArray = (response) => {
  const entry = response && typeof response === 'object' && !Array.isArray(response)
    ? { ...response }
    : { type: 'none' };
  const proto = String(entry.proto || '').trim().toLowerCase() || inferBlackholeResponseProto(entry);
  return [{ ...entry, proto }];
};

export const blackholeResponseToLegacy = (responses) => {
  const first = Array.isArray(responses) && responses[0] && typeof responses[0] === 'object'
    ? responses[0]
    : { type: 'none' };
  const { proto: _proto, ...response } = first;
  return response;
};

export const validateBlackholeResponseArray = (responses) => {
  if (!Array.isArray(responses)) return '';
  if (responses.length === 0) return 'Response array must contain at least one item.';
  const seen = new Set();
  for (let index = 0; index < responses.length; index += 1) {
    const entry = responses[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return `Response ${index + 1} must be an object.`;
    }
    const proto = String(entry.proto || '').trim().toLowerCase();
    if (!proto) return `Response ${index + 1} must specify proto.`;
    if (!/^[a-z0-9][a-z0-9+._-]{0,63}$/.test(proto)) {
      return `Response ${index + 1} has an invalid proto.`;
    }
    if (seen.has(proto)) return `Duplicate proto: ${proto}`;
    seen.add(proto);
  }
  return '';
};

const DOMAIN_STRATEGIES = [
  'AsIs',
  'UseIP',
  'UseIPv6v4',
  'UseIPv6',
  'UseIPv4v6',
  'UseIPv4',
  'ForceIP',
  'ForceIPv6v4',
  'ForceIPv6',
  'ForceIPv4v6',
  'ForceIPv4'
];

export const COMMON_OUTBOUND_FIELDS = [
  { path: ['tag'], label: 'Tag', placeholder: 'proxy-out' },
  { path: ['subscription'], label: 'Subscription owner', placeholder: 'Optional subscription name' },
  { path: ['sendThrough6'], label: 'Send through IPv6', placeholder: '2001:db8::/64' },
  { path: ['targetStrategy'], label: 'Target strategy', type: 'select', options: DOMAIN_STRATEGIES },
  { path: ['tcpConcurrent'], label: 'Concurrent TCP dialing', type: 'boolean' },
  { path: ['tcpConcurrentTimeout'], label: 'TCP race timeout (ms)', type: 'integer', min: 1 }
];

export const PROTOCOL_FIELD_GROUPS = {
  blackhole: [{
    title: 'Response',
    fields: [
      {
        path: ['settings', 'response', 'type'],
        label: 'Response type',
        type: 'select',
        options: BLACKHOLE_RESPONSE_TYPES
      },
      { path: ['settings', 'response', 'redirect_url'], label: 'Redirect URL', placeholder: 'https://example.com/' },
      {
        path: ['settings', 'response', 'icmp'],
        label: 'ICMP request',
        type: 'select',
        options: ['echo-request']
      },
      { path: ['settings', 'response', 'delay'], label: 'Response delay', placeholder: '1ms, 1s, 500us' }
    ]
  }],
  freedom: [{
    title: 'Freedom',
    fields: [
      { path: ['settings', 'domainStrategy'], label: 'Domain strategy', type: 'select', options: DOMAIN_STRATEGIES },
      { path: ['settings', 'redirect'], label: 'Redirect target', placeholder: '127.0.0.1:80' },
      { path: ['settings', 'userLevel'], label: 'User level', type: 'integer', min: 0 },
      { path: ['settings', 'testpre'], label: 'Pre-connect count', type: 'integer', min: 0 },
      { path: ['settings', 'preConKeep'], label: 'Pre-connect keepalive', placeholder: '25s' },
      { path: ['settings', 'proxyProtocol'], label: 'PROXY protocol', type: 'integer', min: 0, max: 2 },
      { path: ['settings', 'fragment', 'packets'], label: 'Fragment packets', placeholder: 'tlshello' },
      { path: ['settings', 'fragment', 'length'], label: 'Fragment length', placeholder: '100-200' },
      { path: ['settings', 'fragment', 'interval'], label: 'Fragment interval (ms)', placeholder: '10-20' },
      { path: ['settings', 'fragment', 'maxSplit'], label: 'Maximum splits', placeholder: '2-4' }
    ]
  }],
  dns: [{
    title: 'DNS forwarding',
    fields: [
      { path: ['settings', 'network'], label: 'Network', type: 'select', options: ['tcp', 'udp'] },
      { path: ['settings', 'address'], label: 'DNS server', placeholder: '1.1.1.1' },
      { path: ['settings', 'port'], label: 'Port', type: 'integer', min: 1, max: 65535 },
      { path: ['settings', 'userLevel'], label: 'User level', type: 'integer', min: 0 },
      { path: ['settings', 'nonIPQuery'], label: 'Non-IP queries', type: 'select', options: ['reject', 'skip', 'drop'] },
      { path: ['settings', 'blockTypes'], label: 'Blocked query types', type: 'integerList', placeholder: '65\n28' }
    ]
  }],
  socks: [{
    title: 'SOCKS server',
    fields: [
      { path: ['settings', 'address'], label: 'Address', placeholder: '127.0.0.1' },
      { path: ['settings', 'port'], label: 'Port', type: 'integer', min: 1, max: 65535 },
      { path: ['settings', 'user'], label: 'Username', autocomplete: 'username' },
      { path: ['settings', 'pass'], label: 'Password', type: 'password' },
      { path: ['settings', 'level'], label: 'User level', type: 'integer', min: 0 },
      { path: ['settings', 'email'], label: 'Email', type: 'email' }
    ]
  }],
  http: [{
    title: 'HTTP proxy',
    fields: [
      { path: ['settings', 'address'], label: 'Address', placeholder: '192.168.1.1' },
      { path: ['settings', 'port'], label: 'Port', type: 'integer', min: 1, max: 65535 },
      { path: ['settings', 'user'], label: 'Username', autocomplete: 'username' },
      { path: ['settings', 'pass'], label: 'Password', type: 'password' },
      { path: ['settings', 'level'], label: 'User level', type: 'integer', min: 0 },
      { path: ['settings', 'email'], label: 'Email', type: 'email' }
    ]
  }],
  vmess: [{
    title: 'VMess server',
    fields: [
      { path: ['settings', 'address'], label: 'Address', placeholder: 'example.com' },
      { path: ['settings', 'port'], label: 'Port', type: 'integer', min: 1, max: 65535 },
      { path: ['settings', 'id'], label: 'User ID / UUID' },
      {
        path: ['settings', 'security'],
        label: 'Security',
        type: 'select',
        options: ['auto', 'aes-128-gcm', 'chacha20-poly1305', 'none', 'zero']
      },
      { path: ['settings', 'level'], label: 'User level', type: 'integer', min: 0 },
      { path: ['settings', 'experiments'], label: 'Experiments' }
    ]
  }],
  vless: [{
    title: 'VLESS server',
    fields: [
      { path: ['settings', 'address'], label: 'Address', placeholder: 'example.com' },
      { path: ['settings', 'port'], label: 'Port', type: 'integer', min: 1, max: 65535 },
      { path: ['settings', 'id'], label: 'User ID / UUID' },
      { path: ['settings', 'encryption'], label: 'Encryption', placeholder: 'none' },
      {
        path: ['settings', 'flow'],
        label: 'Flow',
        type: 'select',
        options: ['', 'xtls-rprx-vision', 'xtls-rprx-vision-udp443']
      },
      { path: ['settings', 'level'], label: 'User level', type: 'integer', min: 0 },
      { path: ['settings', 'testpre'], label: 'Pre-connect count', type: 'integer', min: 0 },
      { path: ['settings', 'preConKeep'], label: 'Pre-connect keepalive', placeholder: '25s' },
      { path: ['settings', 'testseed'], label: 'Vision seed', type: 'integerList', placeholder: '900\n500\n900\n256' },
      { path: ['settings', 'reverse', 'tag'], label: 'Reverse inbound tag' }
    ]
  }],
  trojan: [{
    title: 'Trojan server',
    fields: [
      { path: ['settings', 'address'], label: 'Address', placeholder: 'example.com' },
      { path: ['settings', 'port'], label: 'Port', type: 'integer', min: 1, max: 65535 },
      { path: ['settings', 'password'], label: 'Password', type: 'password' },
      { path: ['settings', 'email'], label: 'Email', type: 'email' },
      { path: ['settings', 'level'], label: 'User level', type: 'integer', min: 0 }
    ]
  }],
  shadowsocks: [{
    title: 'Shadowsocks server',
    fields: [
      { path: ['settings', 'address'], label: 'Address', placeholder: 'example.com' },
      { path: ['settings', 'port'], label: 'Port', type: 'integer', min: 1, max: 65535 },
      {
        path: ['settings', 'method'],
        label: 'Method',
        type: 'select',
        options: [
          '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm',
          '2022-blake3-chacha20-poly1305', 'aes-128-gcm', 'aes-256-gcm',
          'chacha20-poly1305', 'xchacha20-poly1305', 'none'
        ]
      },
      { path: ['settings', 'password'], label: 'Password', type: 'password' },
      { path: ['settings', 'email'], label: 'Email', type: 'email' },
      { path: ['settings', 'level'], label: 'User level', type: 'integer', min: 0 },
      { path: ['settings', 'ivCheck'], label: 'Legacy IV replay check', type: 'boolean' },
      { path: ['settings', 'uot'], label: 'UDP over TCP', type: 'boolean' },
      { path: ['settings', 'uotVersion'], label: 'UoT version', type: 'integer', min: 1, max: 2 }
    ]
  }],
  wireguard: [{
    title: 'WireGuard',
    fields: [
      { path: ['settings', 'secretKey'], label: 'Private key', type: 'password' },
      { path: ['settings', 'address'], label: 'Local addresses', type: 'list', placeholder: '10.0.0.1/32\nfd00::1/128' },
      { path: ['settings', 'noKernelTun'], label: 'Disable kernel TUN', type: 'boolean' },
      { path: ['settings', 'mtu'], label: 'MTU', type: 'integer', min: 576 },
      { path: ['settings', 'reserved'], label: 'Reserved bytes', type: 'integerList', placeholder: '1\n2\n3' },
      { path: ['settings', 'workers'], label: 'Workers', type: 'integer', min: 1 },
      {
        path: ['settings', 'domainStrategy'],
        label: 'Domain strategy',
        type: 'select',
        options: ['ForceIP', 'ForceIPv6v4', 'ForceIPv6', 'ForceIPv4v6', 'ForceIPv4']
      }
    ]
  }],
  loopback: [{
    title: 'Loopback',
    fields: [
      { path: ['settings', 'inboundTag'], label: 'Inbound tag' }
    ]
  }],
  hysteria: [{
    title: 'Hysteria server',
    fields: [
      { path: ['settings', 'version'], label: 'Version', type: 'integer', min: 2, max: 2 },
      { path: ['settings', 'address'], label: 'Address', placeholder: 'example.com' },
      { path: ['settings', 'port'], label: 'Port', type: 'integer', min: 1, max: 65535 }
    ]
  }, {
    title: 'Hysteria transport',
    fields: [
      { path: ['streamSettings', 'hysteriaSettings', 'version'], label: 'Version', type: 'integer', min: 2, max: 2 },
      { path: ['streamSettings', 'hysteriaSettings', 'auth'], label: 'Authentication', type: 'password' },
      { path: ['streamSettings', 'hysteriaSettings', 'congestion'], label: 'Congestion mode', type: 'select', options: ['bbr', 'brutal', 'force-brutal'] },
      { path: ['streamSettings', 'hysteriaSettings', 'up'], label: 'Upload rate', placeholder: '100 mbps or 0' },
      { path: ['streamSettings', 'hysteriaSettings', 'down'], label: 'Download rate', placeholder: '100 mbps or 0' },
      { path: ['streamSettings', 'hysteriaSettings', 'udphop', 'port'], label: 'UDP hop ports', placeholder: '1145-1919' },
      { path: ['streamSettings', 'hysteriaSettings', 'udphop', 'interval'], label: 'UDP hop interval (s)', type: 'integer', min: 5 },
      { path: ['streamSettings', 'hysteriaSettings', 'obfs'], label: 'Obfuscation' },
      { path: ['streamSettings', 'hysteriaSettings', 'obfsPassword'], label: 'Obfuscation password', type: 'password' },
      { path: ['streamSettings', 'hysteriaSettings', 'initStreamReceiveWindow'], label: 'Initial stream window', type: 'integer', min: 16384 },
      { path: ['streamSettings', 'hysteriaSettings', 'maxStreamReceiveWindow'], label: 'Maximum stream window', type: 'integer', min: 16384 },
      { path: ['streamSettings', 'hysteriaSettings', 'initConnectionReceiveWindow'], label: 'Initial connection window', type: 'integer', min: 16384 },
      { path: ['streamSettings', 'hysteriaSettings', 'maxConnectionReceiveWindow'], label: 'Maximum connection window', type: 'integer', min: 16384 },
      { path: ['streamSettings', 'hysteriaSettings', 'maxIdleTimeout'], label: 'Idle timeout (s)', type: 'integer', min: 4, max: 120 },
      { path: ['streamSettings', 'hysteriaSettings', 'keepAlivePeriod'], label: 'Keepalive (s)', type: 'integer', min: 2, max: 60 },
      { path: ['streamSettings', 'hysteriaSettings', 'disablePathMTUDiscovery'], label: 'Disable path MTU discovery', type: 'boolean' },
      { path: ['streamSettings', 'hysteriaSettings', 'udpIdleTimeout'], label: 'UDP idle timeout (s)', type: 'integer', min: 2, max: 600 }
    ]
  }]
};

export const PROXY_FIELDS = [
  { path: ['proxySettings', 'tag'], label: 'Proxy outbound tag' },
  { path: ['proxySettings', 'transportLayer'], label: 'Use proxy transport layer', type: 'boolean' }
];

export const MUX_FIELDS = [
  { path: ['mux', 'enabled'], label: 'Enable Mux', type: 'boolean' },
  { path: ['mux', 'concurrency'], label: 'TCP concurrency', type: 'integer', min: -1, max: 128 },
  { path: ['mux', 'xudpConcurrency'], label: 'XUDP concurrency', type: 'integer', min: -1, max: 1024 },
  {
    path: ['mux', 'xudpProxyUDP443'],
    label: 'UDP/443 policy',
    type: 'select',
    options: ['reject', 'allow', 'skip']
  }
];

export const STREAM_FIELD_GROUPS = [
  {
    title: 'Transport',
    fields: [
      {
        path: ['streamSettings', 'network'],
        label: 'Network',
        type: 'select',
        options: ['tcp', 'kcp', 'ws', 'http', 'httpupgrade', 'grpc', 'xhttp', 'quic', 'hysteria', 'axpath']
      },
      { path: ['streamSettings', 'security'], label: 'Security', type: 'select', options: ['none', 'tls', 'reality'] },
      { path: ['streamSettings', 'tlsSettings', 'serverName'], label: 'TLS server name' },
      { path: ['streamSettings', 'tlsSettings', 'allowInsecure'], label: 'Allow insecure TLS', type: 'boolean' },
      { path: ['streamSettings', 'tlsSettings', 'fingerprint'], label: 'TLS fingerprint' },
      { path: ['streamSettings', 'tlsSettings', 'alpn'], label: 'TLS ALPN', type: 'list', placeholder: 'h2\nhttp/1.1' },
      { path: ['streamSettings', 'realitySettings', 'serverName'], label: 'REALITY server name' },
      { path: ['streamSettings', 'realitySettings', 'fingerprint'], label: 'REALITY fingerprint' },
      { path: ['streamSettings', 'realitySettings', 'publicKey'], label: 'REALITY public key' },
      { path: ['streamSettings', 'realitySettings', 'shortId'], label: 'REALITY short ID' },
      { path: ['streamSettings', 'realitySettings', 'spiderX'], label: 'REALITY spider path' }
    ]
  },
  {
    title: 'Transport details',
    fields: [
      { path: ['streamSettings', 'wsSettings', 'path'], label: 'WebSocket path' },
      { path: ['streamSettings', 'wsSettings', 'headers', 'Host'], label: 'WebSocket Host' },
      { path: ['streamSettings', 'httpSettings', 'host'], label: 'HTTP hosts', type: 'list' },
      { path: ['streamSettings', 'httpSettings', 'path'], label: 'HTTP path' },
      { path: ['streamSettings', 'grpcSettings', 'serviceName'], label: 'gRPC service name' },
      { path: ['streamSettings', 'grpcSettings', 'multiMode'], label: 'gRPC multi mode', type: 'boolean' },
      { path: ['streamSettings', 'axpathSettings', 'subflows'], label: 'AXPath subflows', type: 'integer', min: 1 },
      { path: ['streamSettings', 'axpathSettings', 'reconnect'], label: 'AXPath reconnect', type: 'boolean' }
    ]
  },
  {
    title: 'Socket options',
    fields: [
      { path: ['streamSettings', 'sockopt', 'interface'], label: 'Interface' },
      { path: ['streamSettings', 'sockopt', 'mark'], label: 'Socket mark', type: 'integer', min: 0 },
      { path: ['streamSettings', 'sockopt', 'domainStrategy'], label: 'Socket domain strategy', type: 'select', options: DOMAIN_STRATEGIES },
      { path: ['streamSettings', 'sockopt', 'tcpFastOpen'], label: 'TCP Fast Open', type: 'boolean' },
      { path: ['streamSettings', 'sockopt', 'dialerProxy'], label: 'Dialer proxy tag' },
      { path: ['streamSettings', 'sockopt', 'sourcePortSync'], label: 'Preserve source port', type: 'boolean' }
    ]
  }
];

const FORBIDDEN_PATH_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const safePath = (path) => Array.isArray(path)
  && path.length > 0
  && path.every((part) => {
    const key = String(part);
    return key && !FORBIDDEN_PATH_KEYS.has(key);
  });

export const parseOutboundValue = (value) => {
  if (isRecord(value)) {
    return { outbound: value, error: '', text: JSON.stringify(value, null, 2) };
  }
  const text = String(value ?? '').trim();
  if (!text) return { outbound: null, error: 'Outbound JSON is empty.', text: '' };
  try {
    const parsed = JSON.parse(text);
    if (!isRecord(parsed)) {
      return { outbound: null, error: 'Outbound JSON must be an object.', text };
    }
    return { outbound: parsed, error: '', text };
  } catch (err) {
    return { outbound: null, error: `Invalid outbound JSON: ${err.message}`, text };
  }
};

export const formatOutboundValue = (value) => JSON.stringify(value ?? {}, null, 2);

export const getPathValue = (source, path) => {
  if (!safePath(path)) return undefined;
  let current = source;
  for (const part of path) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
};

export const setPathValue = (source, path, value) => {
  if (!isRecord(source) || !safePath(path)) return source;
  const root = { ...source };
  let previous = source;
  let current = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    const previousChild = previous && typeof previous === 'object' ? previous[key] : undefined;
    const nextChild = Array.isArray(previousChild)
      ? [...previousChild]
      : isRecord(previousChild)
        ? { ...previousChild }
        : {};
    current[key] = nextChild;
    previous = previousChild;
    current = nextChild;
  }
  const leaf = path[path.length - 1];
  if (value === undefined) {
    delete current[leaf];
  } else {
    current[leaf] = value;
  }
  return root;
};

export const coerceOutboundFieldValue = (rawValue, type = 'text') => {
  if (type === 'boolean') return Boolean(rawValue);
  if (rawValue === '' || rawValue === null || rawValue === undefined) return undefined;
  if (type === 'integer') {
    const value = Number(rawValue);
    return Number.isInteger(value) ? value : undefined;
  }
  if (type === 'list') {
    return String(rawValue).split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  }
  if (type === 'integerList') {
    return String(rawValue)
      .split(/[\n,]+/)
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item));
  }
  return String(rawValue);
};

export const formatOutboundFieldValue = (value, type = 'text') => {
  if (value === undefined || value === null) return '';
  if (type === 'list' || type === 'integerList') {
    return Array.isArray(value) ? value.join('\n') : String(value);
  }
  return String(value);
};

export const updateOutboundField = (outbound, field, rawValue) => setPathValue(
  outbound,
  field.path,
  coerceOutboundFieldValue(rawValue, field.type)
);

export const updateOutboundArrayItem = (outbound, arrayPath, index, itemPath, value) => {
  const current = getPathValue(outbound, arrayPath);
  if (!Array.isArray(current) || index < 0 || index >= current.length) return outbound;
  const item = isRecord(current[index]) ? current[index] : {};
  const nextItem = setPathValue(item, itemPath, value);
  const next = [...current];
  next[index] = nextItem;
  return setPathValue(outbound, arrayPath, next);
};

export const appendOutboundArrayItem = (outbound, arrayPath, item) => {
  const current = getPathValue(outbound, arrayPath);
  const next = Array.isArray(current) ? [...current, item] : [item];
  return setPathValue(outbound, arrayPath, next);
};

export const removeOutboundArrayItem = (outbound, arrayPath, index) => {
  const current = getPathValue(outbound, arrayPath);
  if (!Array.isArray(current) || index < 0 || index >= current.length) return outbound;
  const next = current.filter((_item, itemIndex) => itemIndex !== index);
  return setPathValue(outbound, arrayPath, next);
};

export const getLegacyEndpointArrayPath = (outbound, protocol) => {
  const settings = isRecord(outbound?.settings) ? outbound.settings : {};
  if ((protocol === 'vmess' || protocol === 'vless') && Array.isArray(settings.vnext)) {
    return ['settings', 'vnext'];
  }
  if (['socks', 'http', 'trojan', 'shadowsocks'].includes(protocol) && Array.isArray(settings.servers)) {
    return ['settings', 'servers'];
  }
  return null;
};

export const getProtocolGroups = (protocol) => {
  const normalized = String(protocol || '').trim().toLowerCase();
  if (normalized === 'direct') return PROTOCOL_FIELD_GROUPS.freedom;
  if (normalized === 'block') return PROTOCOL_FIELD_GROUPS.blackhole;
  if (normalized === 'hysteria2' || normalized === 'hy2') return PROTOCOL_FIELD_GROUPS.hysteria;
  return PROTOCOL_FIELD_GROUPS[normalized] || [];
};
