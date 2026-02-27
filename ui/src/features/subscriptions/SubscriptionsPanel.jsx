import React from 'react';

export function SubscriptionsPanel(props) {
  const {
    page,
    configSubscriptionStatus,
    isFailedStatusText,
    saveSubscriptionBlock,
    clearSubscriptionBlock,
    triggerHotReloadFromSubscriptions,
    hotReloadBusy,
    configSubscriptionInbound,
    setConfigSubscriptionInbound,
    configSubscriptionPath,
    configSubscriptionOutbounds,
    openRulesModal,
    getSubscriptionUrlDisplay,
    AutoFoldText,
    toggleSubscriptionOutboundEnabled,
    openDeleteConfirm,
    configSubscriptionDatabases,
    toggleSubscriptionDatabaseEnabled
  } = props;

  if (page !== 'subscriptions') return null;

  return (
    <section className="panel subscriptions" style={{ '--delay': '0.14s' }}>
      <div className="panel-header">
        <div>
          <h2>Subscriptions</h2>
          <p>Edit the top-level subscription block (`subscription`) and persist changes to config.</p>
        </div>
        <div className="header-actions">
          {configSubscriptionStatus ? (
            <div className="header-status">
              <span className={`status${isFailedStatusText(configSubscriptionStatus) ? ' status-danger' : ''}`}>
                {configSubscriptionStatus}
              </span>
            </div>
          ) : null}
          <button className="ghost small" onClick={saveSubscriptionBlock}>
            Save
          </button>
          <button className="ghost small danger-text" onClick={clearSubscriptionBlock}>
            Clear
          </button>
          <button
            className="primary small"
            onClick={triggerHotReloadFromSubscriptions}
            disabled={hotReloadBusy}
          >
            {hotReloadBusy ? 'Hot reloading...' : 'Hot reload core'}
          </button>
        </div>
      </div>

      <div className="settings-inline">
        <div className="control-block">
          <label>subscription-inbound</label>
          <input
            value={configSubscriptionInbound}
            onChange={(event) => setConfigSubscriptionInbound(event.target.value)}
            placeholder="(optional) e.g. sub-in"
          />
          <span className="hint">
            When set, subscription fetch/update traffic is routed through Xray (matchable by inboundTag).
          </span>
        </div>
        <div className="control-block">
          <label>config file</label>
          <p className="group-meta mono">{configSubscriptionPath || '(auto)'}</p>
          <span className="hint">
            The UI patches the config file where `subscription` was found (or a fallback config).
          </span>
        </div>
      </div>

      <div className="rules-grid">
        <div className="group-card">
          <div className="group-header">
            <div>
              <h3>Outbound subscriptions</h3>
              <p className="group-meta">Total {configSubscriptionOutbounds.length}</p>
            </div>
            <div className="rules-editor-actions">
              <button className="primary small" onClick={() => openRulesModal('subscription', 'insert')}>
                Add outbound subscription
              </button>
            </div>
          </div>

          {configSubscriptionOutbounds.length === 0 ? (
            <div className="empty-state small">
              <p>No outbound subscriptions configured.</p>
            </div>
          ) : (
            <div className="outbound-grid">
              {(configSubscriptionOutbounds || []).map((sub, index) => {
                const name = String(sub?.name || '').trim();
                const url = String(sub?.url || '').trim();
                const displayUrl = getSubscriptionUrlDisplay(url);
                const format = String(sub?.format || 'auto').trim() || 'auto';
                const insert = String(sub?.insert || 'tail').trim() || 'tail';
                const tagPrefix = String(sub?.tagPrefix || '').trim();
                const enabled = sub?.enabled;
                const interval = String(sub?.interval || '').trim();
                const cron = String(sub?.cron || sub?.crontab || '').trim();
                const key = `${name || url || 'subscription'}-${index}`;
                return (
                  <div className="outbound-card" key={key}>
                    <div className="outbound-info">
                      <div className="outbound-title">
                        <span className="rule-index">{index + 1}</span>
                        <h3>{name || '(unnamed)'}</h3>
                      </div>
                      {url ? (
                        <p className="mono">
                          <AutoFoldText className="mono" fullText={displayUrl} foldedText={displayUrl} />
                        </p>
                      ) : (
                        <p className="group-meta mono">(no url)</p>
                      )}
                    </div>
                    <div className="outbound-side">
                      <div className="outbound-meta">
                        <span className="meta-pill">{format}</span>
                        <span className="meta-pill">{insert}</span>
                        {tagPrefix ? <span className="meta-pill">{tagPrefix}</span> : null}
                        {interval ? <span className="meta-pill">{`every ${interval}`}</span> : null}
                        {cron ? <span className="meta-pill">{`cron ${cron}`}</span> : null}
                        <span className="meta-pill">{enabled === false ? 'disabled' : 'enabled'}</span>
                      </div>
                      <div className="outbound-actions">
                        <button
                          className="ghost small"
                          onClick={() => toggleSubscriptionOutboundEnabled(index)}
                          title={enabled === false ? 'Enable this subscription' : 'Disable this subscription'}
                        >
                          {enabled === false ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          className="ghost small"
                          onClick={triggerHotReloadFromSubscriptions}
                          disabled={hotReloadBusy}
                          title="Fetch and apply subscription updates (hot reload core)."
                        >
                          {hotReloadBusy ? 'Updating...' : 'Update now'}
                        </button>
                        <button
                          className="ghost small danger-text"
                          onClick={() => openDeleteConfirm('subscription', index)}
                        >
                          Delete
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => openRulesModal('subscription', 'edit', index, index, sub)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="group-card">
          <div className="group-header">
            <div>
              <h3>Database subscriptions</h3>
              <p className="group-meta">Total {configSubscriptionDatabases.length}</p>
            </div>
            <div className="rules-editor-actions">
              <button
                className="primary small"
                onClick={() => openRulesModal('subscriptionDatabase', 'insert')}
              >
                Add database subscription
              </button>
            </div>
          </div>

          {configSubscriptionDatabases.length === 0 ? (
            <div className="empty-state small">
              <p>No database subscriptions configured.</p>
            </div>
          ) : (
            <div className="outbound-grid">
              {(configSubscriptionDatabases || []).map((db, index) => {
                const type = String(db?.type || '').trim() || '(no type)';
                const url = String(db?.url || '').trim();
                const displayUrl = getSubscriptionUrlDisplay(url);
                const enabled = db?.enabled;
                const interval = String(db?.interval || '').trim();
                const cron = String(db?.cron || db?.crontab || '').trim();
                const key = `${type || url || 'database'}-${index}`;
                return (
                  <div className="outbound-card" key={key}>
                    <div className="outbound-info">
                      <div className="outbound-title">
                        <span className="rule-index">{index + 1}</span>
                        <h3>{type}</h3>
                      </div>
                      {url ? (
                        <p className="mono">
                          <AutoFoldText className="mono" fullText={displayUrl} foldedText={displayUrl} />
                        </p>
                      ) : (
                        <p className="group-meta mono">(no url)</p>
                      )}
                    </div>
                    <div className="outbound-side">
                      <div className="outbound-meta">
                        {interval ? <span className="meta-pill">{`every ${interval}`}</span> : null}
                        {cron ? <span className="meta-pill">{`cron ${cron}`}</span> : null}
                        <span className="meta-pill">{enabled === false ? 'disabled' : 'enabled'}</span>
                      </div>
                      <div className="outbound-actions">
                        <button
                          className="ghost small"
                          onClick={() => toggleSubscriptionDatabaseEnabled(index)}
                          title={enabled === false ? 'Enable this subscription' : 'Disable this subscription'}
                        >
                          {enabled === false ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          className="ghost small"
                          onClick={triggerHotReloadFromSubscriptions}
                          disabled={hotReloadBusy}
                          title="Fetch and apply subscription updates (hot reload core)."
                        >
                          {hotReloadBusy ? 'Updating...' : 'Update now'}
                        </button>
                        <button
                          className="ghost small danger-text"
                          onClick={() => openDeleteConfirm('subscriptionDatabase', index)}
                        >
                          Delete
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => openRulesModal('subscriptionDatabase', 'edit', index, index, db)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

