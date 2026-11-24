import React, { useEffect, useRef, useState } from 'react';
import { collectorBase, historyRequest, queryWindow } from './historyApi';
import './history.css';

const errors = {
  unauthorized: ['访问密钥无效', 'Invalid access key'],
  forbidden: ['此入口拒绝访问', 'Access denied'],
  untrusted_origin: [
    '跨源访问或内部入口需要节点访问密钥',
    'This connection requires a node access key',
  ],
  unsupported_api: [
    '当前服务缺少历史接口',
    'History API unavailable on this server',
  ],
  invalid_collector_path: [
    '请输入同源采集器路径，例如 /flowd',
    'Enter a same-origin collector path such as /flowd',
  ],
  invalid_query: ['请检查查询值和时间范围', 'Check the value and time range'],
  history_disabled: ['本机尚未启用访问历史', 'Local history is disabled'],
  history_unsupported: [
    '此构建未包含本机访问历史',
    'Local history is omitted from this build',
  ],
  temporarily_unreadable: [
    '历史库暂时不可读',
    'History temporarily unavailable',
  ],
  revision_conflict: [
    '配置已被修改，请刷新后重试',
    'Configuration changed. Refresh and try again.',
  ],
  invalid_config: [
    '请检查数据库绝对路径和保留期',
    'Check the absolute database path and retention',
  ],
};

export function HistoryPanel({
  apiBase,
  accessKey,
  uiLanguage,
  initial,
  onRestart,
}) {
  const zh = uiLanguage?.startsWith('zh');
  const t = (cn, en) => (zh ? cn : en);
  const explain = (e) => errors[e]?.[zh ? 0 : 1] || e;
  const storageKey = 'acore_history_collector:' + apiBase;
  const [path, setPath] = useState(
    () => localStorage.getItem(storageKey) || '',
  );
  const [draftPath, setDraftPath] = useState(path);
  const [token, setToken] = useState(''),
    [draftToken, setDraftToken] = useState('');
  const [scope, setScope] = useState('node');
  const [status, setStatus] = useState(null);
  const [notice, setNotice] = useState('');
  const [direction, setDirection] = useState(initial?.direction || 'sourceIp');
  const [value, setValue] = useState(initial?.value || '');
  const [range, setRange] = useState('24');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [result, setResult] = useState(null),
    [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false),
    [generation, refresh] = useState(0);
  const [config, setConfig] = useState(null),
    [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(null),
    saveAbort = useRef(null),
    chosenScope = useRef(false);
  const cluster = scope === 'cluster';
  const node = apiBase.replace(/\/$/, '');
  function invalidate() {
    pending.current?.abort();
    pending.current = null;
    setResult(null);
    setActive(null);
    setBusy(false);
    setNotice('');
  }
  function base() {
    return cluster
      ? collectorBase(path, window.location.origin) + '/api/v1'
      : node;
  }
  useEffect(() => {
    const ctrl = new AbortController();
    invalidate();
    setStatus(null);
    setConfig(null);
    setDraft(null);
    setSaving(false);
    async function load() {
      try {
        const res = await historyRequest(base() + '/access-history/status', {
          key: accessKey,
          cluster,
          token,
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        if (
          !cluster &&
          !initial?.settings &&
          !chosenScope.current &&
          res.flowExportEnabled &&
          !res.readable &&
          path
        ) {
          setScope('cluster');
          return;
        }
        setStatus(res);
      } catch (e) {
        if (!ctrl.signal.aborted) setNotice(explain(e.message));
      }
      if (!cluster && !ctrl.signal.aborted) {
        try {
          const cfg = await historyRequest(node + '/config/access-history', {
            key: accessKey,
            signal: ctrl.signal,
          });
          if (!ctrl.signal.aborted) {
            setConfig(cfg);
            setDraft(cfg.saved);
          }
        } catch (e) {
          if (!ctrl.signal.aborted) setNotice(explain(e.message));
        }
      }
    }
    load();
    return () => {
      ctrl.abort();
      pending.current?.abort();
      saveAbort.current?.abort();
    };
  }, [scope, path, token, generation, node, accessKey]);

  async function run(query, cursor) {
    pending.current?.abort();
    const ctrl = new AbortController();
    pending.current = ctrl;
    setBusy(true);
    setNotice('');
    if (!cursor) setResult(null);
    try {
      const data = await historyRequest(base() + '/access-history/query', {
        key: accessKey,
        cluster,
        token,
        signal: ctrl.signal,
        body: { ...query, ...(cursor && { cursor }) },
      });
      if (!ctrl.signal.aborted) {
        setResult(data);
        setActive(query);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setNotice(explain(e.message));
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }
  function submit(event) {
    event.preventDefault();
    try {
      run({
        [direction]: value.trim(),
        ...queryWindow(range, from, to),
        limit: 50,
      });
    } catch (e) {
      setNotice(explain(e.message));
    }
  }
  function reverse(row) {
    const next = direction === 'sourceIp' ? 'domain' : 'sourceIp';
    const peer = row[next];
    if (!peer || !active) return;
    setDirection(next);
    setValue(peer);
    const { sourceIp, domain, ...window } = active;
    run({ ...window, [next]: peer });
  }
  async function save() {
    const ctrl = new AbortController();
    saveAbort.current = ctrl;
    setSaving(true);
    setNotice('');
    try {
      const cfg = await historyRequest(node + '/config/access-history', {
        key: accessKey,
        signal: ctrl.signal,
        body: { accessHistory: draft, revision: config.revision },
      });
      if (!ctrl.signal.aborted) {
        setConfig(cfg);
        setDraft(cfg.saved);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setNotice(explain(e.message));
    } finally {
      if (!ctrl.signal.aborted) setSaving(false);
    }
  }
  const date = (ms) =>
    new Date(ms).toLocaleString(undefined, {
      fractionalSecondDigits: 3,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  return (
    <section className="panel access-history">
      <header>
        <h2>{t('访问历史', 'Access history')}</h2>
        <select
          aria-label={t('数据来源', 'Data source')}
          value={scope}
          onChange={(e) => {
            chosenScope.current = true;
            invalidate();
            setScope(e.target.value);
          }}
        >
          <option value="node">{t('本机历史', 'This node')}</option>
          <option value="cluster">
            {t('集群采集器', 'Cluster collector')}
          </option>
        </select>
        <button type="button" onClick={() => refresh((n) => n + 1)}>
          {t('刷新', 'Refresh')}
        </button>
      </header>
      {(cluster || status?.flowExportEnabled) && (
        <details open={(cluster && !path) || undefined}>
          <summary>{t('采集器连接', 'Collector connection')}</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const p = collectorBase(draftPath, location.origin);
                setPath(p);
                setToken(draftToken);
                localStorage.setItem(storageKey, p);
                chosenScope.current = true;
                setScope('cluster');
                refresh((n) => n + 1);
              } catch (err) {
                setNotice(explain(err.message));
              }
            }}
          >
            <label>
              {t('同源路径', 'Same-origin path')}
              <input
                value={draftPath}
                placeholder="/flowd"
                onChange={(e) => setDraftPath(e.target.value)}
              />
            </label>
            <label>
              {t('采集器令牌', 'Collector token')}
              <input
                type="password"
                value={draftToken}
                onChange={(e) => setDraftToken(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button>{t('连接', 'Connect')}</button>
          </form>
        </details>
      )}
      {status && !status.readable && (
        <p role="status">
          {status.state === 'disabled' && status.flowExportEnabled
            ? t(
                '该节点仅导出 Flow，可选择集群采集器。',
                'This node exports Flow. Select the cluster collector.',
              )
            : explain(
                {
                  unsupported: 'history_unsupported',
                  disabled: 'history_disabled',
                }[status.state] || 'temporarily_unreadable',
              )}
        </p>
      )}
      {status?.state === 'degraded' && status.readable && (
        <p>
          {t(
            '历史写入异常，已提交数据仍可查询。',
            'Recording degraded. Committed history is available.',
          )}
        </p>
      )}
      {status?.queueDropped > 0 && (
        <p>
          {t('队列丢弃的连接', 'Connections dropped by the queue')} ·{' '}
          {status.queueDropped}
        </p>
      )}
      <form onSubmit={submit} onChange={() => invalidate()}>
        <label>
          {t('查询方向', 'Search by')}
          <select
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value);
              setValue('');
            }}
          >
            <option value="sourceIp">{t('来源 IP', 'Source IP')}</option>
            <option value="domain">{t('域名', 'Domain')}</option>
          </select>
        </label>
        <label>
          {direction === 'domain'
            ? t('域名', 'Domain')
            : t('来源 IP', 'Source IP')}
          <input
            required
            value={value}
            placeholder={direction === 'domain' ? 'example.com' : '192.0.2.8'}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label>
          {t('时间范围', 'Time range')}
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="1">{t('最近 1 小时', 'Last hour')}</option>
            <option value="24">{t('最近 24 小时', 'Last 24 hours')}</option>
            <option value="all">
              {t('全部保留历史', 'All retained history')}
            </option>
            <option value="custom">{t('自定义', 'Custom')}</option>
          </select>
        </label>
        {range === 'custom' && (
          <>
            <label>
              {t('起始', 'From')}
              <input
                required
                type="datetime-local"
                step="0.001"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              {t('结束', 'To')}
              <input
                required
                type="datetime-local"
                step="0.001"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </>
        )}
        <button disabled={!status?.readable || busy}>
          {busy ? t('查询中…', 'Searching…') : t('查询', 'Search')}
        </button>
      </form>
      {notice && <p role="alert">{notice}</p>}
      {result && (
        <>
          {result.partialRange && (
            <p>
              {t(
                '部分时间早于可查询历史。',
                'Part of the range predates available history.',
              )}
            </p>
          )}
          {result.rows.length === 0 ? (
            <p>{t('没有匹配的连接', 'No matching connections')}</p>
          ) : (
            <div className="history-results">
              <table>
                <thead>
                  <tr>
                    {[
                      direction === 'domain'
                        ? t('来源 IP', 'Source IP')
                        : t('域名', 'Domain'),
                      cluster
                        ? t('集群观测连接数', 'Cluster observations')
                        : t('连接数', 'Connections'),
                      t('首次', 'First'),
                      t('最近', 'Last'),
                    ].map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={JSON.stringify([row.sourceIp, row.domain])}>
                      <td>
                        {direction === 'domain' || row.domain ? (
                          <button onClick={() => reverse(row)}>
                            {direction === 'domain' ? row.sourceIp : row.domain}
                          </button>
                        ) : (
                          t('域名未知', 'Unknown domain')
                        )}
                      </td>
                      <td>{row.connections}</td>
                      <td>{date(row.firstMs)}</td>
                      <td>{date(row.lastMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.nextCursor && (
            <button
              disabled={busy}
              onClick={() => run(active, result.nextCursor)}
            >
              {t('下一页', 'Next page')}
            </button>
          )}
        </>
      )}
      {!cluster && config && draft && status?.state !== 'unsupported' && (
        <details open={initial?.settings || undefined}>
          <summary>{t('本机记录设置', 'Local recording settings')}</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={!!draft.enabled}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
              />
              {t('启用本机记录', 'Enable recording')}
            </label>
            <label>
              {t('数据库绝对路径', 'Absolute database path')}
              <input
                required={draft.enabled}
                value={draft.path || ''}
                onChange={(e) => setDraft({ ...draft, path: e.target.value })}
              />
            </label>
            <label>
              {t('保留天数，0 表示长期', 'Retention days, 0 for unlimited')}
              <input
                type="number"
                min="0"
                step="1"
                value={draft.retentionDays ?? 30}
                onChange={(e) =>
                  setDraft({ ...draft, retentionDays: Number(e.target.value) })
                }
              />
            </label>
            <button disabled={!config.editable || saving}>
              {t('保存', 'Save')}
            </button>
          </form>
          {config.path && <p>{config.path}</p>}
          {!config.inStartupConfig && config.exists && (
            <p>
              {t(
                '请将此文件加入启动参数',
                'Add this file to the startup arguments',
              )}{' '}
              · -c {config.path}
            </p>
          )}
          {config.inStartupConfig && config.restartRequired && (
            <button onClick={onRestart}>
              {t(
                '配置已保存，重启以应用',
                'Restart to apply saved configuration',
              )}
            </button>
          )}
        </details>
      )}
    </section>
  );
}
