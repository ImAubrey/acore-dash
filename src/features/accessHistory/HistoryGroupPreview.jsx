import { useEffect, useState } from 'react';
import { historyRequest } from './historyApi';

export function HistoryGroupPreview({
  request,
  query,
  byDomain,
  t,
  onOpen,
  multiSelect,
  selectPeer,
  isPeerSelected,
}) {
  const [state, setState] = useState({ rows: null, error: false });
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    const ctrl = new AbortController();
    historyRequest(request.url, {
      ...request,
      signal: ctrl.signal,
      body: JSON.parse(queryKey),
    })
      .then((result) => {
        if (!ctrl.signal.aborted) setState({ rows: result.rows, error: false });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ rows: null, error: true });
      });
    return () => ctrl.abort();
  }, [request.url, request.key, request.cluster, request.token, queryKey]);
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
          {state.rows.map((row) => {
            const peer = byDomain ? row.sourceIp : row.domain;
            return (
              <li key={peer ?? ''}>
                {multiSelect && peer ? (
                  <button
                    type="button"
                    className="history-link"
                    aria-pressed={isPeerSelected(peer)}
                    onClick={() => selectPeer(peer)}
                  >
                    {peer}
                  </button>
                ) : (
                  <span>{peer ?? t('域名未知', 'Unknown domain')}</span>
                )}
                <span className="mono">{row.connections}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <span className="status">
          {t('没有匹配的明细', 'No matching details')}
        </span>
      )}
      {onOpen && (
        <button type="button" className="ghost small" onClick={onOpen}>
          {t('查看全部明细', 'View all details')}
        </button>
      )}
    </>
  );
}
