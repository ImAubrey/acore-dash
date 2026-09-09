export const SPLICE_LABEL = 'splice';

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
  const hasTLS = parts.includes('tls');
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
    if (lower === SPLICE_LABEL || lower === 'tls' || lower === 'quic' || lower === 'http' || lower === 'http1' || lower === 'http2') return;
    if ((lower === 'tcp' || lower === 'udp') && lower === networkLower) return;
    tokens.push(part);
  });
  return { label: tokens.join(' · '), splice };
};
