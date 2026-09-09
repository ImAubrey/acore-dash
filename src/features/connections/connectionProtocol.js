export const SPLICE_LABEL = 'splice';
export const ECH_HINT = 'ECH extension observed; may be GREASE. ECH acceptance is not confirmed. Outer SNI is not the inner destination.';

export const getConnectionECH = (metadata) => {
  if (metadata?.ech === 'present' || metadata?.ech === 'mixed' || metadata?.ech === 'legacy') return metadata.ech;
  return /(^|\+)ech(\+|$)/i.test(metadata?.type || '') ? 'legacy' : '';
};

const ECH_LABELS = { present: 'ECH?', mixed: 'ECH mixed', legacy: 'ECH? (legacy)' };
export const getConnectionECHLabel = (metadata) => ECH_LABELS[getConnectionECH(metadata)] || '';

// Unlike protocol identity, an empty ECH field is meaningful in mixed groups.
export const mergeConnectionECH = (current, incoming) => (
  current === undefined || current === incoming ? incoming : 'mixed'
);

// The API owns protocol identity. Never infer it from the inbound, domain or ALPN.
export const getConnectionProtocol = (metadata) => (
  typeof metadata?.type === 'string' && metadata.type !== '' ? metadata.type : 'unknown'
);

export const mergeConnectionProtocol = (current, incoming) => (
  !current || current === incoming ? incoming : 'mixed'
);

// Shared by connection details and the dashboard protocol distribution.
export const getConnectionProtocolView = (metadata) => {
  const network = String(metadata?.network || '-').trim() || '-';
  const type = getConnectionProtocol(metadata);
  const rawAlpn = String(metadata?.alpn || '').trim();
  const networkLower = network.toLowerCase();
  const rawParts = type.split('+').map((part) => part.trim()).filter(Boolean);
  const parts = rawParts.map((part) => part.toLowerCase());
  const hasTLS = parts.includes('tls') || parts.includes('ech');
  const hasQUIC = parts.includes('quic');
  const hasHTTP2 = parts.includes('http2');
  const hasHTTP = hasHTTP2 || parts.includes('http1') || parts.includes('http');
  const splice = parts.includes(SPLICE_LABEL);
  const tokens = [networkLower === 'tcp' ? 'TCP' : networkLower === 'udp' ? 'UDP' : network];
  if (hasTLS) tokens.push('TLS');
  if (hasQUIC) tokens.push('QUIC');
  if (hasHTTP) tokens.push('HTTP');

  const alpn = rawAlpn.toLowerCase();
  const alpnDisplay = rawAlpn
    ? (alpn === 'http/1.1' || alpn === 'http/1.0'
      ? 'H1'
      : (alpn === 'h2' || alpn.startsWith('h2-'))
        ? 'H2'
        : (alpn === 'h3' || alpn.startsWith('h3-')) ? 'H3' : rawAlpn)
    : (hasHTTP2 ? 'H2' : hasHTTP ? 'H1' : '');
  if (alpnDisplay) tokens.push(alpnDisplay);

  rawParts.forEach((part, index) => {
    const lower = parts[index];
    if (lower === SPLICE_LABEL || lower === 'tls' || lower === 'ech' || lower === 'quic' || lower === 'http' || lower === 'http1' || lower === 'http2') return;
    if ((lower === 'tcp' || lower === 'udp') && lower === networkLower) return;
    tokens.push(part);
  });
  const echLabel = getConnectionECHLabel(metadata);
  if (echLabel) tokens.push(echLabel);
  return { label: tokens.join(' · '), splice };
};
