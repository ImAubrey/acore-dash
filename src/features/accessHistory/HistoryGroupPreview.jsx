import { useEffect, useState } from 'react';
import { historyRequest } from './historyApi';

export function HistoryGroupPreview({ request, query, byDomain, t, onOpen }) {
  const [state, setState] = useState({ rows: null, error: false });
  useEffect(() => {
    const ctrl = new AbortController();
    historyRequest(request.url, {
      ...request,
      signal: ctrl.signal,
      body: query,
    })
      .then((result) => {
        if (!ctrl.signal.aborted) setState({ rows: result.rows, error: false });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ rows: null, error: true });
      });
    return () => ctrl.abort();
  }, [request.url, request.key, request.cluster, request.token, query]);
  return (
    <>
      {state.error ? (
        <span className="status">
          {t('无法载入明细', 'Could not load details')}
        </span>
      ) : !state.rows ? (
        <span className="status" role="status">
          {t('正在载入…', 'Loading…')}
        </span>
      ) : state.rows.length ? (
        <ul className="history-preview">
          {state.rows.map((row) => (
            <li key={byDomain ? row.sourceIp : (row.domain ?? '')}>
              <span>
                {byDomain
                  ? row.sourceIp
                  : (row.domain ?? t('域名未知', 'Unknown domain'))}
              </span>
              <span className="mono">{row.connections}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="status">
          {t('没有匹配的明细', 'No matching details')}
        </span>
      )}
      <button type="button" className="ghost small" onClick={onOpen}>
        {t('查看全部明细', 'View all details')}
      </button>
    </>
  );
}
