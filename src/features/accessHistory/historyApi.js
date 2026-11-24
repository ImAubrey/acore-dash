export function collectorBase(path, origin) {
  const value = path.trim().replace(/\/+$/, '');
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    throw Error('invalid_collector_path');
  const url = new URL(value, origin);
  if (url.origin !== origin || url.search || url.hash || url.pathname === '/')
    throw Error('invalid_collector_path');
  return url.pathname;
}

export async function historyRequest(
  url,
  { key, token, cluster, signal, body } = {},
) {
  const headers = { Accept: 'application/json' };
  if (cluster && token) headers.Authorization = 'Bearer ' + token;
  if (!cluster && key) headers['X-Access-Key'] = key;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    credentials: cluster && !token ? 'same-origin' : 'omit',
    cache: 'no-store',
    signal,
  });
  const json = response.headers
    .get('content-type')
    ?.includes('application/json');
  const payload = json ? await response.json() : null;
  if (!response.ok || !json) {
    const code =
      payload?.code ||
      { 401: 'unauthorized', 403: 'forbidden', 404: 'unsupported_api' }[
        response.status
      ] ||
      (!json ? 'unsupported_api' : 'request_failed');
    throw Error(code);
  }
  return payload;
}

export function queryWindow(range, from, to, now = Date.now()) {
  if (range === 'all') return {};
  if (range !== 'custom')
    return { fromMs: now - Number(range) * 3600000, toMs: now };
  const fromMs = new Date(from).getTime(),
    toMs = new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs)
    throw Error('invalid_query');
  return { fromMs, toMs };
}
