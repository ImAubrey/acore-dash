import React, { useEffect, useId, useRef, useState } from 'react';
import {
  ClearableTextInput,
  EmptyState,
  StatusText,
} from '../common/panelPrimitives';
import { ScrollArea } from '../common/ScrollArea';
import { ZEBRA_ROW_BACKGROUNDS } from '../../dashboardShared';
import { ConnectionSearchInput } from '../connections/ConnectionSearchInput';
import { HistoryPopover } from './HistoryPopover';
import { HistoryGroupPreview } from './HistoryGroupPreview';
import { HistoryFacetPicker } from './HistoryFacetPicker';
import { historyRequest, queryWindow } from './historyApi';
import {
  hasHistoryFacet,
  historySearchFilters,
  toggleHistoryFacet,
} from './historySearch';

const defaults = {
  sourceIp: '',
  domain: '',
  search: '',
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
    <time
      className="history-stamp mono"
      dateTime={d.toISOString()}
      title={d.toLocaleString()}
    >
      <span>{timeLabel.format(d)}</span>
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
  grouping,
  multiSelect,
  zh,
  explain,
}) {
  const fieldId = useId();
  const t = (cn, en) => (zh ? cn : en);
  const [state, setState] = useState(() =>
    session({
      ...defaults,
      ...(initial?.direction &&
        (multiSelect
          ? { search: toggleHistoryFacet('', initial.direction, initial.value) }
          : {
              [initial.direction]: initial.value,
              search: initial.value + ' ',
            })),
    }),
  );
  const [draft, setDraft] = useState(state.options);
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true);
  const [auto, setAuto] = useState(true);
  const loading = useRef(false);
  const { options, bounds, cursors, page } = state;
  const byDomain = options.view === 'domains';
  const bySource = options.view === 'sources';
  const grouped = options.view !== 'events' || !browse;
  const modes = [
    ['events', t('访问明细', 'Access log')],
    ['pairs', t('按连接组合', 'By source and domain')],
    ['domains', t('按域名', 'By domain')],
    ['sources', t('按来源 IP', 'By source IP')],
  ];
  const activeSearch = options.search.trim();
  const additionalSearch = Boolean(
    activeSearch &&
      activeSearch !== options.sourceIp &&
      activeSearch !== options.domain,
  );
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
    if (multiSelect) Object.assign(body, historySearchFilters(options.search));
    else if (grouping && additionalSearch) body.search = activeSearch;
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
  }, [
    state,
    url,
    accessKey,
    cluster,
    token,
    browse,
    grouping,
    multiSelect,
    legacyEmpty,
    additionalSearch,
    activeSearch,
  ]);
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
  const pendingSearch = draft.search.trim();
  const pendingSource = draft.sourceIp.trim();
  const pendingDomain = draft.domain.trim();
  useEffect(() => {
    const changed = grouping
      ? pendingSearch !== activeSearch
      : pendingSource !== options.sourceIp || pendingDomain !== options.domain;
    if (!changed) return undefined;
    const filters = grouping
      ? { search: pendingSearch, sourceIp: '', domain: '' }
      : { sourceIp: pendingSource, domain: pendingDomain };
    const timer = window.setTimeout(() => {
      setBusy(true);
      setState((current) =>
        session({ ...current.options, ...filters }, current.bounds),
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    grouping,
    pendingSearch,
    pendingSource,
    pendingDomain,
    activeSearch,
    options.sourceIp,
    options.domain,
  ]);

  function apply(
    next,
    { keepWindow = false, preserveDraft = false, retainRows = false } = {},
  ) {
    try {
      const s = session(next, keepWindow ? bounds : null);
      setError('');
      setDraft((current) =>
        preserveDraft
          ? { ...current, view: next.view, sort: next.sort, order: next.order }
          : next,
      );
      if (!retainRows) setData(null);
      setBusy(true);
      setState(s);
    } catch (e) {
      setError(e.message);
    }
  }

  function commitSearch(search) {
    setDraft((current) => ({ ...current, search, sourceIp: '', domain: '' }));
    setError('');
    if (search.trim() === activeSearch && !options.sourceIp && !options.domain)
      return;
    setBusy(true);
    setState((current) =>
      session(
        { ...current.options, search: search.trim(), sourceIp: '', domain: '' },
        current.bounds,
      ),
    );
  }

  function filter(key, value) {
    if (multiSelect) {
      commitSearch(toggleHistoryFacet(draft.search, key, value));
      return;
    }
    apply(
      {
        ...options,
        sourceIp: '',
        domain: '',
        search: value + ' ',
        view: 'pairs',
        [key]: value,
      },
      { keepWindow: true },
    );
  }

  function changeWindow(range, from, to) {
    const next = { ...draft, range, from, to };
    if (range === 'custom' && (!from || !to)) {
      setDraft(next);
      return;
    }
    // A completed time change uses the currently displayed search as well.
    const filters =
      grouping && pendingSearch !== activeSearch
        ? { sourceIp: '', domain: '' }
        : { sourceIp: next.sourceIp.trim(), domain: next.domain.trim() };
    setDraft(next);
    apply({ ...next, ...filters }, { retainRows: true });
  }

  function orderBy(sort) {
    apply(
      {
        ...options,
        sort,
        order:
          options.sort === sort && options.order === 'desc' ? 'asc' : 'desc',
      },
      { keepWindow: true, preserveDraft: multiSelect, retainRows: true },
    );
  }
  function heading(label, sort) {
    const active = browse && options.sort === sort;
    return (
      <th
        role="columnheader"
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
            className={`sort-header ${active ? 'active' : ''}`}
            onClick={() => orderBy(sort)}
          >
            <span>{label}</span>
            <span className="sort-indicator" aria-hidden="true">
              {active ? (options.order === 'desc' ? '▼' : '▲') : '↕'}
            </span>
          </button>
        ) : (
          label
        )}
      </th>
    );
  }
  function setMode(view) {
    apply(
      {
        ...options,
        view,
        sort: view === 'domains' || view === 'sources' ? 'connections' : 'time',
        order: 'desc',
      },
      { keepWindow: true, preserveDraft: multiSelect },
    );
  }

  function preview(row) {
    const label = byDomain ? row.domain : row.sourceIp;
    if (!label) return t('域名未知', 'Unknown domain');
    const field = byDomain ? 'domain' : 'sourceIp';
    const query = {
      ...bounds,
      view: 'pairs',
      sort: 'connections',
      order: 'desc',
      limit: 6,
      ...(options.sourceIp && { sourceIp: options.sourceIp }),
      ...(options.domain && { domain: options.domain }),
      ...(multiSelect
        ? historySearchFilters(options.search)
        : additionalSearch && { search: activeSearch }),
      [field]: label,
    };
    return (
      <HistoryPopover
        className="history-link"
        label={label}
        onSelect={multiSelect ? () => filter(field, label) : undefined}
        selected={multiSelect && hasHistoryFacet(draft.search, field, label)}
        title={
          byDomain
            ? t('展开来源 IP', 'Show source IPs')
            : t('展开访问的域名', 'Show domains')
        }
      >
        {(close) => (
          <HistoryGroupPreview
            request={{ url, key: accessKey, cluster, token }}
            query={query}
            byDomain={byDomain}
            t={t}
            multiSelect={multiSelect}
            selectPeer={(peer) =>
              filter(byDomain ? 'sourceIp' : 'domain', peer)
            }
            isPeerSelected={(peer) =>
              hasHistoryFacet(
                draft.search,
                byDomain ? 'sourceIp' : 'domain',
                peer,
              )
            }
            onOpen={() => {
              close();
              if (!multiSelect) {
                apply(
                  { ...options, view: 'pairs', [field]: label },
                  { keepWindow: true },
                );
                return;
              }
              const search = hasHistoryFacet(draft.search, field, label)
                ? draft.search
                : toggleHistoryFacet(draft.search, field, label);
              apply(
                { ...options, search, view: 'pairs' },
                { keepWindow: true },
              );
            }}
          />
        )}
      </HistoryPopover>
    );
  }

  function facetButton(field, value, className = 'history-link') {
    return (
      <button
        type="button"
        className={className}
        aria-pressed={
          multiSelect ? hasHistoryFacet(draft.search, field, value) : undefined
        }
        onClick={() => filter(field, value)}
      >
        {value}
      </button>
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
        {grouping ? (
          <HistoryPopover
            className="ghost small history-view-trigger"
            label={
              <>
                {modes.find(([view]) => view === options.view)?.[1]}{' '}
                <span aria-hidden="true">▾</span>
              </>
            }
            title={t('聚合方式', 'Group by')}
          >
            {(close) => (
              <div className="history-view-options">
                {modes.map(([view, label]) => (
                  <button
                    key={view}
                    type="button"
                    className={`view-pill ${options.view === view ? 'active' : ''}`}
                    aria-pressed={options.view === view}
                    onClick={() => {
                      close();
                      setMode(view);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </HistoryPopover>
        ) : (
          browse && (
            <div
              className="view-toggle history-modes"
              role="group"
              aria-label={t('视图', 'View')}
            >
              {modes.slice(0, 2).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  className={`view-pill ${options.view === view ? 'active' : ''}`}
                  aria-pressed={options.view === view}
                  onClick={() => setMode(view)}
                >
                  {label}
                </button>
              ))}
            </div>
          )
        )}
        <div className="history-live">
          {live && (
            <button
              type="button"
              className={`pill ${auto ? 'live' : 'paused'}`}
              aria-pressed={auto}
              onClick={() => setAuto((current) => !current)}
              title={t('每 10 秒自动刷新', 'Refresh every 10 seconds')}
            >
              {auto
                ? t('自动刷新', 'Auto refresh')
                : t('手动刷新', 'Manual refresh')}
            </button>
          )}
          <button
            className="ghost small"
            type="button"
            onClick={() =>
              apply(options, { preserveDraft: multiSelect, retainRows: true })
            }
          >
            {t('刷新列表', 'Refresh list')}
          </button>
        </div>
      </div>
      <form
        className="history-form history-filters"
        onSubmit={(e) => {
          e.preventDefault();
          if (grouping) commitSearch(draft.search);
          else
            apply(
              { ...options, sourceIp: pendingSource, domain: pendingDomain },
              { keepWindow: true, retainRows: true },
            );
        }}
      >
        {grouping ? (
          <div className="history-keywords">
            <ConnectionSearchInput
              compact
              commitValue={commitSearch}
              value={draft.search}
              setValue={(search) => setDraft({ ...draft, search })}
              ariaLabel={t('搜索访问记录', 'Search access history')}
              placeholder={t(
                '搜索域名、IP、出口、命中规则，空格添加条件',
                'Search domain, IP, outbound, rule; Space adds a condition',
              )}
            />
          </div>
        ) : (
          <>
            <div className="history-filter-input">
              <label htmlFor={fieldId + '-ip'}>
                {t('来源 IP', 'Source IP')}
              </label>
              <ClearableTextInput
                className="connections-search"
                id={fieldId + '-ip'}
                value={draft.sourceIp}
                placeholder="192.0.2.8"
                ariaLabel={t('来源 IP', 'Source IP')}
                clearLabel={t('清除来源 IP', 'Clear source IP')}
                setValue={(sourceIp) => setDraft({ ...draft, sourceIp })}
              />
            </div>
            <div className="history-filter-input">
              <label htmlFor={fieldId + '-domain'}>{t('域名', 'Domain')}</label>
              <ClearableTextInput
                className="connections-search"
                id={fieldId + '-domain'}
                value={draft.domain}
                placeholder="example.com"
                ariaLabel={t('域名', 'Domain')}
                clearLabel={t('清除域名', 'Clear domain')}
                setValue={(domain) => setDraft({ ...draft, domain })}
              />
            </div>
          </>
        )}
        <label>
          {t('时间范围', 'Time range')}
          <select
            value={draft.range}
            onChange={(e) => changeWindow(e.target.value, draft.from, draft.to)}
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
                onChange={(e) =>
                  changeWindow(
                    draft.range,
                    k === 'from' ? e.target.value : draft.from,
                    k === 'to' ? e.target.value : draft.to,
                  )
                }
              />
            </label>
          ))}
        <div className="history-filter-actions">
          <button
            type="submit"
            hidden
            aria-label={t('立即筛选', 'Filter now')}
          />
          {multiSelect && (
            <HistoryPopover
              className="ghost small"
              label={t('添加筛选', 'Add filter')}
            >
              {() => (
                <HistoryFacetPicker
                  request={{ url, key: accessKey, cluster, token }}
                  bounds={bounds}
                  search={draft.search}
                  onSelect={filter}
                  t={t}
                />
              )}
            </HistoryPopover>
          )}
          {(options.sourceIp ||
            options.domain ||
            draft.sourceIp ||
            draft.domain ||
            draft.search ||
            options.search ||
            draft.range !== '24' ||
            options.range !== '24') && (
            <button
              type="button"
              className="ghost small"
              onClick={() =>
                apply(
                  {
                    ...defaults,
                    view: options.view,
                    sort: options.sort,
                    order: options.order,
                  },
                  { retainRows: true },
                )
              }
            >
              {t('清除筛选', 'Clear filters')}
            </button>
          )}
        </div>
      </form>
      {legacyEmpty && (
        <p role="status">
          {t(
            '此节点只支持精确查询，请输入来源 IP 或域名。升级节点后可浏览全部记录。',
            'Enter a source IP or domain to query this older server. Upgrade it to browse the log.',
          )}
        </p>
      )}
      {error && (
        <div role="alert">
          <StatusText danger text={explain(error)} />
        </div>
      )}
      {!legacyEmpty && (
        <div className="history-results" aria-busy={busy}>
          {data?.rows.length ? (
            <ScrollArea
              className="history-table-scroll"
              axis="both"
              ariaLabel={t('访问记录列表', 'Access history rows')}
            >
              <table
                className={`table history-table ${grouped ? 'is-grouped' : ''}`}
                role="table"
              >
                <colgroup>
                  <col className="history-col-time" />
                  <col />
                  <col className="history-col-source" />
                  <col className="history-col-outbound" />
                  <col className="history-col-rule" />
                  <col className="history-col-count" />
                  {grouped && <col className="history-col-time" />}
                </colgroup>
                <thead role="rowgroup">
                  <tr className="row header" role="row">
                    {heading(
                      grouped
                        ? t('最近访问', 'Last seen')
                        : t('访问时间', 'Time'),
                      'time',
                    )}
                    <th
                      scope="col"
                      role="columnheader"
                      className="history-static-heading"
                    >
                      {bySource
                        ? t('域名数', 'Domains')
                        : t('域名 / 目标', 'Domain / destination')}
                    </th>
                    <th
                      scope="col"
                      role="columnheader"
                      className="history-static-heading"
                    >
                      {byDomain
                        ? t('来源 IP 数', 'Source IPs')
                        : t('来源 IP', 'Source IP')}
                    </th>
                    <th
                      scope="col"
                      role="columnheader"
                      className="history-static-heading"
                    >
                      {grouped
                        ? t('最近出口', 'Last outbound')
                        : t('出口', 'Outbound')}
                    </th>
                    <th
                      scope="col"
                      role="columnheader"
                      className="history-static-heading"
                    >
                      {grouped
                        ? t('最近命中规则', 'Last matched rules')
                        : t('命中规则', 'Matched rules')}
                    </th>
                    {grouped ? (
                      heading(t('连接次数', 'Connections'), 'connections')
                    ) : (
                      <th
                        scope="col"
                        role="columnheader"
                        className="history-static-heading"
                      >
                        {t('连接次数', 'Connections')}
                      </th>
                    )}
                    {grouped && heading(t('首次访问', 'First seen'), 'first')}
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {data.rows.map((row, index) => (
                    <tr
                      className="row"
                      role="row"
                      style={{
                        '--row-bg':
                          ZEBRA_ROW_BACKGROUNDS[
                            index % ZEBRA_ROW_BACKGROUNDS.length
                          ],
                      }}
                      key={JSON.stringify([
                        row.sourceIp,
                        row.domain,
                        grouped ? '' : row.lastMs,
                      ])}
                    >
                      <td
                        className="history-time"
                        role="cell"
                        data-label={
                          grouped ? t('最近访问', 'Last seen') : undefined
                        }
                      >
                        <Stamp ms={row.lastMs} />
                      </td>
                      <td className="history-domain" role="cell">
                        {bySource ? (
                          <span className="mono">{row.peerCount}</span>
                        ) : byDomain ? (
                          preview(row)
                        ) : row.domain ? (
                          facetButton('domain', row.domain)
                        ) : (
                          <span className="hint">
                            {t('域名未知', 'Unknown domain')}
                          </span>
                        )}
                        {row.destinations?.length > 0 && (
                          <div className="history-destination hint mono">
                            {row.destinations.map(({ ip, port }) => (
                              <span key={JSON.stringify([ip, port])}>
                                {ip
                                  ? (ip.includes(':') && port
                                      ? '[' + ip + ']'
                                      : ip) + (port ? ':' + port : '')
                                  : t('端口', 'Port') + ' ' + port}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td
                        className="history-ip"
                        role="cell"
                        data-label={
                          byDomain
                            ? t('来源 IP 数', 'Source IPs')
                            : t('来源 IP', 'Source IP')
                        }
                      >
                        {byDomain ? (
                          <span className="mono">{row.peerCount}</span>
                        ) : bySource ? (
                          preview(row)
                        ) : (
                          facetButton(
                            'sourceIp',
                            row.sourceIp,
                            'history-link mono',
                          )
                        )}
                      </td>
                      <td
                        className={
                          row.outboundTags?.length
                            ? 'history-outbound'
                            : 'history-outbound history-detail-missing'
                        }
                        role="cell"
                        data-label={t('出口', 'Outbound')}
                      >
                        {row.outboundTags?.length ? (
                          <span className="mono">
                            {row.outboundTags.join(' · ')}
                          </span>
                        ) : (
                          <span
                            className="hint"
                            aria-label={t(
                              '未记录出口',
                              'Outbound not recorded',
                            )}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td
                        className={
                          row.routeRuleTags?.length ||
                          row.firewallRuleTags?.length
                            ? 'history-rule'
                            : 'history-rule history-detail-missing'
                        }
                        role="cell"
                        data-label={t('命中规则', 'Matched rules')}
                      >
                        {row.routeRuleTags?.length ||
                        row.firewallRuleTags?.length ? (
                          <div className="history-rule-value">
                            {(row.routeRuleTags || []).map((tag) => (
                              <span
                                className="mono"
                                key={'route:' + tag}
                                title={t('路由规则', 'Routing rule')}
                              >
                                {tag}
                              </span>
                            ))}
                            {(row.firewallRuleTags || []).map((tag) => (
                              <span
                                className="mono history-firewall-rule"
                                key={'firewall:' + tag}
                                title={t('防火墙规则', 'Firewall rule')}
                              >
                                <span className="hint">
                                  {t('防火墙', 'Firewall')}
                                </span>{' '}
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span
                            className="hint"
                            aria-label={t('未记录规则', 'Rule not recorded')}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td
                        className="history-count mono"
                        role="cell"
                        data-label={t('连接次数', 'Connections')}
                      >
                        {row.connections}
                      </td>
                      {grouped && (
                        <td
                          className="history-first"
                          role="cell"
                          data-label={t('首次访问', 'First seen')}
                        >
                          <Stamp ms={row.firstMs} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            !error && (
              <div role="status">
                <EmptyState
                  small
                  message={
                    busy
                      ? t('正在读取访问记录…', 'Loading access history…')
                      : t(
                          '这个时间段和筛选条件下没有已结束的连接。',
                          'No completed connections match this time range and filters.',
                        )
                  }
                />
              </div>
            )
          )}
        </div>
      )}
      {data && (
        <footer className="history-pagination">
          <StatusText
            text={
              zh
                ? `第 ${page + 1} 页 · ${data.rows.length} 条`
                : `Page ${page + 1} · ${data.rows.length} rows`
            }
          />
          <button
            type="button"
            className="ghost small"
            disabled={!page || busy}
            onClick={() => turn(page - 1)}
          >
            {t('上一页', 'Previous')}
          </button>
          <button
            type="button"
            className="ghost small"
            disabled={!data.nextCursor || busy}
            onClick={() => turn(page + 1, data.nextCursor)}
          >
            {t('下一页', 'Next')}
          </button>
        </footer>
      )}
      {data?.partialRange && (
        <span className="hint">
          {t('可查询记录始于', 'Available history starts at')}{' '}
          {new Date(data.coverageFromMs).toLocaleString()}
        </span>
      )}
    </>
  );
}
