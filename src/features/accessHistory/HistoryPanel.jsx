import { HistoryList } from './HistoryList';
import React, { useEffect, useRef, useState } from 'react';
import { collectorBase, historyRequest } from './historyApi';
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
  const [generation, refresh] = useState(0);
  const [config, setConfig] = useState(null),
    [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveAbort = useRef(null),
    chosenScope = useRef(false);
  const cluster = scope === 'cluster';
  const node = apiBase.replace(/\/$/, '');
  const sourceKey = JSON.stringify([scope, node, path, accessKey, token]);
  function base() {
    return cluster
      ? collectorBase(path, window.location.origin) + '/api/v1'
      : node;
  }
  useEffect(() => {
    const ctrl = new AbortController();
    setNotice('');
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
        setStatus({ ...res, sourceKey, queryUrl: base() + '/access-history/query' });
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
      saveAbort.current?.abort();
    };
  }, [scope, path, token, generation, node, accessKey]);

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
  return (
    <section className="panel access-history">
      <header>
        <h2>{t('访问历史', 'Access history')}</h2>
        <select
          aria-label={t('数据来源', 'Data source')}
          value={scope}
          onChange={(e) => {
            chosenScope.current = true;
            setNotice('');
            setScope(e.target.value);
          }}
        >
          <option value="node">{t('本机历史', 'This node')}</option>
          <option value="cluster">
            {t('集群采集器', 'Cluster collector')}
          </option>
        </select>
        {!status?.readable && (
          <button type="button" onClick={() => refresh((n) => n + 1)}>
            {t('刷新', 'Refresh')}
          </button>
        )}
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
      {notice && (
        <p role="alert">
          {!cluster && !node && !status
              ? t('当前面板网址没有可用的节点接口。请在设置的 Metrics HTTP 中选择节点，填写访问密钥后再查看记录。', 'No node API is available at this dashboard address. In Settings, select the node’s Metrics HTTP endpoint and enter its access key.')
              : notice}{' '}
          {!cluster && (
            <a href="#/settings">
              {t('检查节点连接设置', 'Check node connection settings')}
            </a>
          )}
        </p>
      )}
      {!status && !notice && (
        <p role="status">
          {t('正在连接历史数据源…', 'Connecting to history source…')}
        </p>
      )}
      {status?.readable && status.sourceKey === sourceKey && (
        <HistoryList
          key={JSON.stringify([scope, node, path])}
          url={status.queryUrl}
          accessKey={accessKey}
          cluster={cluster}
          token={token}
          initial={initial}
          browse={!!status.browse}
          zh={zh}
          explain={explain}
        />
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
