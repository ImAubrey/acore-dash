import React, { useEffect, useRef, useState } from 'react';
import { historyRequest, queryWindow } from './historyApi';

const defaults = {
  sourceIp: '',
  domain: '',
  range: '24',
  from: '',
  to: '',
  view: 'events',
  sort: 'time',
  order: 'desc',
};
const timeLabel = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
});
const dayLabel = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
function Stamp({ ms }) {
  const d = new Date(ms);
  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString()}>
      <strong>{timeLabel.format(d)}</strong>
      <small>{dayLabel.format(d)}</small>
    </time>
  );
}
function session(options, bounds) {
  return {
    options,
    bounds: bounds || queryWindow(options.range, options.from, options.to),
    cursors: [null],
    page: 0,
  };
}

export function HistoryList({
  url,
  accessKey,
  cluster,
  token,
  initial,
  browse,
  zh,
  explain,
}) {
  const t = (cn, en) => (zh ? cn : en);
  const [state, setState] = useState(() =>
    session({
      ...defaults,
      ...(initial?.direction && { [initial.direction]: initial.value }),
    }),
  );
  const [draft, setDraft] = useState(state.options);
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true);
  const [auto, setAuto] = useState(true);
  const loading = useRef(false);
  const { options, bounds, cursors, page } = state;
  const grouped = options.view === 'pairs' || !browse;
  const legacyEmpty = !browse && !options.domain && !options.sourceIp;
  useEffect(() => {
    if (legacyEmpty) {
      setData(null);
      setBusy(false);
      return;
    }
    const ctrl = new AbortController();
    const body = { ...bounds, limit: 50 };
    if (options.domain) body.domain = options.domain;
    if (options.sourceIp) body.sourceIp = options.sourceIp;
    if (browse)
      Object.assign(body, {
        view: options.view,
        sort: options.sort,
        order: options.order,
      });
    if (cursors[page]) body.cursor = cursors[page];
    loading.current = true;
    setBusy(true);
    setError('');
    historyRequest(url, {
      key: accessKey,
      cluster,
      token,
      signal: ctrl.signal,
      body,
    })
      .then((next) => {
        if (!ctrl.signal.aborted) setData(next);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) {
          loading.current = false;
          setBusy(false);
        }
      });
    return () => {
      ctrl.abort();
      loading.current = false;
    };
  }, [state, url, accessKey, cluster, token, browse, legacyEmpty]);
  const live =
    browse &&
    page === 0 &&
    !grouped &&
    options.order === 'desc' &&
    options.range !== 'custom';
  useEffect(() => {
    if (!auto || !live) return;
    const timer = setInterval(() => {
      if (!document.hidden && !loading.current)
        setState((s) => session(s.options));
    }, 10000);
    return () => clearInterval(timer);
  }, [auto, live]);
  function apply(next, keepWindow = false) {
    try {
      const s = session(next, keepWindow ? bounds : null);
      setError('');
      setDraft(next);
      setData(null);
      setState(s);
    } catch (e) {
      setError(e.message);
    }
  }
  function filter(key, value) {
    apply({ ...options, sourceIp: '', domain: '', [key]: value }, true);
  }
  function orderBy(sort) {
    apply(
      {
        ...options,
        sort,
        order:
          options.sort === sort && options.order === 'desc' ? 'asc' : 'desc',
      },
      true,
    );
  }
  function heading(label, sort) {
    const active = browse && options.sort === sort;
    return (
      <th
        scope="col"
        aria-sort={
          active
            ? options.order === 'desc'
              ? 'descending'
              : 'ascending'
            : undefined
        }
      >
        {browse ? (
          <button
            type="button"
            className="history-sort"
            onClick={() => orderBy(sort)}
          >
            {label}{' '}
            <span aria-hidden="true">
              {active ? (options.order === 'desc' ? '↓' : '↑') : '↕'}
            </span>
          </button>
        ) : (
          label
        )}
      </th>
    );
  }
  function turn(to, cursor) {
    setData(null);
    setState({
      ...state,
      page: to,
      cursors: cursor ? [...cursors.slice(0, to), cursor] : cursors,
    });
  }
  return (
    <>
      <div className="history-list-bar">
        {browse && (
          <div
            className="history-modes"
            role="group"
            aria-label={t('视图', 'View')}
          >
            {[
              ['events', t('访问明细', 'Access log')],
              ['pairs', t('合并统计', 'Grouped history')],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={options.view === id}
                onClick={() =>
                  apply(
                    { ...options, view: id, sort: 'time', order: 'desc' },
                    true,
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="history-live">
          {live && (
            <label>
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
              />
              {t('每 10 秒刷新', 'Refresh every 10s')}
            </label>
          )}
          <button type="button" onClick={() => apply(options)}>
            {t('刷新列表', 'Refresh list')}
          </button>
        </div>
      </div>
      <form
        className="history-filters"
        onSubmit={(e) => {
          e.preventDefault();
          apply({
            ...draft,
            sourceIp: draft.sourceIp.trim(),
            domain: draft.domain.trim(),
          });
        }}
      >
        <label>
          {t('来源 IP', 'Source IP')}
          <input
            value={draft.sourceIp}
            placeholder="192.0.2.8"
            onChange={(e) => setDraft({ ...draft, sourceIp: e.target.value })}
          />
        </label>
        <label>
          {t('域名', 'Domain')}
          <input
            value={draft.domain}
            placeholder="example.com"
            onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
          />
        </label>
        <label>
          {t('时间范围', 'Time range')}
          <select
            value={draft.range}
            onChange={(e) => setDraft({ ...draft, range: e.target.value })}
          >
            <option value="1">{t('最近 1 小时', 'Last hour')}</option>
            <option value="24">{t('最近 24 小时', 'Last 24 hours')}</option>
            <option value="all">
              {t('全部保留历史', 'All retained history')}
            </option>
            <option value="custom">{t('自定义', 'Custom')}</option>
          </select>
        </label>
        {draft.range === 'custom' &&
          ['from', 'to'].map((k) => (
            <label key={k}>
              {k === 'from' ? t('开始', 'From') : t('结束', 'To')}
              <input
                type="datetime-local"
                step="0.001"
                required
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            </label>
          ))}
        <button type="submit">{t('筛选', 'Filter')}</button>
        {(options.sourceIp || options.domain || options.range !== '24') && (
          <button
            type="button"
            onClick={() => apply({ ...defaults, view: options.view })}
          >
            {t('清除筛选', 'Clear filters')}
          </button>
        )}
      </form>
      {legacyEmpty && (
        <p role="status">
          {t(
            '此节点只支持精确查询，请输入来源 IP 或域名。升级节点后可浏览全部记录。',
            'Enter a source IP or domain to query this older server. Upgrade it to browse the log.',
          )}
        </p>
      )}
      {error && <p role="alert">{explain(error)}</p>}
      {!legacyEmpty && (
        <div className="history-results" aria-busy={busy}>
          <table>
            <thead>
              <tr>
                {heading(
                  grouped ? t('最近访问', 'Last seen') : t('访问时间', 'Time'),
                  'time',
                )}
                <th scope="col">{t('域名', 'Domain')}</th>
                <th scope="col">{t('来源 IP', 'Source IP')}</th>
                {grouped ? (
                  heading(t('连接次数', 'Connections'), 'connections')
                ) : (
                  <th scope="col">{t('连接次数', 'Connections')}</th>
                )}
                {grouped && heading(t('首次访问', 'First seen'), 'first')}
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row) => (
                <tr
                  key={JSON.stringify([
                    row.sourceIp,
                    row.domain,
                    grouped ? '' : row.lastMs,
                  ])}
                >
                  <td>
                    <Stamp ms={row.lastMs} />
                  </td>
                  <td>
                    {row.domain ? (
                      <button
                        className="history-peer"
                        onClick={() => filter('domain', row.domain)}
                      >
                        {row.domain}
                      </button>
                    ) : (
                      <span className="history-muted">
                        {t('域名未知', 'Unknown domain')}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="history-peer"
                      onClick={() => filter('sourceIp', row.sourceIp)}
                    >
                      {row.sourceIp}
                    </button>
                  </td>
                  <td>{row.connections}</td>
                  {grouped && (
                    <td>
                      <Stamp ms={row.firstMs} />
                    </td>
                  )}
                </tr>
              ))}
              {!data && !error && (
                <tr>
                  <td colSpan={grouped ? 5 : 4} role="status">
                    {t('正在读取访问记录…', 'Loading access history…')}
                  </td>
                </tr>
              )}
              {data && !data.rows.length && (
                <tr>
                  <td colSpan={grouped ? 5 : 4}>
                    {t(
                      '这个时间段和筛选条件下没有已结束的连接。',
                      'No completed connections match this time range and filters.',
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <footer className="history-pagination">
          <span>
            {t('第', 'Page')} {page + 1}
            {zh ? ' 页' : ''} · {data.rows.length} {t('条', 'rows')}
          </span>
          <button disabled={!page || busy} onClick={() => turn(page - 1)}>
            {t('上一页', 'Previous')}
          </button>
          <button
            disabled={!data.nextCursor || busy}
            onClick={() => turn(page + 1, data.nextCursor)}
          >
            {t('下一页', 'Next')}
          </button>
        </footer>
      )}
      {data?.partialRange && (
        <small className="history-muted">
          {t('可查询记录始于', 'Available history starts at')}{' '}
          {new Date(data.coverageFromMs).toLocaleString()}
        </small>
      )}
    </>
  );
}
