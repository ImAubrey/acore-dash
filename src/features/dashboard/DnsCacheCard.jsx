export function DnsCacheCard({
  dnsCacheStats,
  dnsUpdatedLabel,
  triggerDnsCacheFlushFromDashboard,
  dnsCacheFlushBusy,
  dnsCacheStatus,
  dnsUsageRatio,
  dnsUsagePercent,
  dnsValidPercent,
  dnsValidRatio,
  dnsExpiredPercent,
  dnsExpiredRatio,
  dnsQueryTypes,
  dnsQueryType,
  setDnsQueryType,
  dnsQueryDomain,
  setDnsQueryDomain,
  dnsQueryBusy,
  dnsQueryStatus,
  dnsQueryResult,
  runDnsQuery,
  formatBytes
}) {
  const describeCacheState = (cache) => {
    const state = String(cache?.state || 'unknown').trim().toLowerCase();
    const ttl = Number(cache?.ttlSeconds || 0);
    if (state === 'hit') {
      return { tone: 'hit', text: `Hit${ttl > 0 ? ` (${ttl}s TTL)` : ''}` };
    }
    if (state === 'expired') {
      return { tone: 'expired', text: `Expired${ttl ? ` (${ttl}s)` : ''}` };
    }
    if (state === 'miss') {
      return { tone: 'miss', text: 'Not cached (new request)' };
    }
    return { tone: 'unknown', text: 'Unknown' };
  };

  const cacheBefore = describeCacheState(dnsQueryResult?.cacheBefore);
  const cacheAfter = describeCacheState(dnsQueryResult?.cacheAfter);
  const queryRecords = Array.isArray(dnsQueryResult?.records) ? dnsQueryResult.records : [];

  const onSubmitDnsQuery = async (event) => {
    event.preventDefault();
    await runDnsQuery();
  };

  return (
    <section className="panel span-12 chart-panel dns-cache-panel" style={{ '--delay': '0.12s' }}>
      <div className="panel-header">
        <div>
          <h2>DNS cache health</h2>
          <p>Cache usage and valid/expired entry split.</p>
        </div>
        <div className="chart-meta">
          <span className="meta-pill">Entries {dnsCacheStats.entryCount}</span>
          <span className="meta-pill">Updated {dnsUpdatedLabel}</span>
          <button
            className="ghost small dns-flush-btn"
            onClick={triggerDnsCacheFlushFromDashboard}
            disabled={dnsCacheFlushBusy}
          >
            {dnsCacheFlushBusy ? 'Flushing...' : 'Flush DNS cache'}
          </button>
        </div>
      </div>
      {dnsCacheStatus ? (
        <div className="chart-empty">{dnsCacheStatus}</div>
      ) : !dnsCacheStats.available ? (
        <div className="chart-empty">
          {dnsCacheStats.error ? `DNS cache unavailable: ${dnsCacheStats.error}` : 'DNS cache unavailable.'}
        </div>
      ) : (
        <div className="metric-grid">
          <div className="metric-card">
            <span className="metric-label">Cache usage</span>
            <strong className="metric-value">{formatBytes(dnsCacheStats.usageBytes)}</strong>
            <span className="metric-meta">
              {dnsCacheStats.limitBytes > 0
                ? `${formatBytes(dnsCacheStats.limitBytes)} limit`
                : 'No cache size limit'}
            </span>
            <div className="meter">
              <span style={{ transform: `scaleX(${dnsUsageRatio})` }} />
            </div>
            <span className="metric-meta">{dnsUsagePercent}% used</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Valid cache</span>
            <strong className="metric-value">{dnsCacheStats.validCount}</strong>
            <span className="metric-meta">{dnsValidPercent}% of all entries</span>
            <div className="meter">
              <span
                style={{
                  transform: `scaleX(${dnsValidRatio})`,
                  background: 'linear-gradient(90deg, #2f9aa0, #7cc57a)'
                }}
              />
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Expired cache</span>
            <strong className="metric-value">{dnsCacheStats.expiredCount}</strong>
            <span className="metric-meta">{dnsExpiredPercent}% of all entries</span>
            <div className="meter">
              <span
                style={{
                  transform: `scaleX(${dnsExpiredRatio})`,
                  background: 'linear-gradient(90deg, #f2b354, #cf8450)'
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="dns-query-card">
        <div className="dns-query-header">
          <h3>DNS lookup</h3>
          <p>Query via Xray DNS runtime and inspect cache state for the domain.</p>
        </div>
        <form className="dns-query-controls" onSubmit={onSubmitDnsQuery}>
          <input
            type="text"
            value={dnsQueryDomain}
            onChange={(event) => setDnsQueryDomain(event.target.value)}
            placeholder="example.com"
            aria-label="DNS query domain"
          />
          <select
            value={dnsQueryType}
            onChange={(event) => setDnsQueryType(event.target.value)}
            aria-label="DNS query type"
          >
            {(dnsQueryTypes || []).map((item) => (
              <option key={item.value} value={item.value}>
                {item.value}
              </option>
            ))}
          </select>
          <button className="ghost small" type="submit" disabled={dnsQueryBusy}>
            {dnsQueryBusy ? 'Querying...' : 'Query'}
          </button>
        </form>

        {dnsQueryStatus ? <div className="dns-query-status">{dnsQueryStatus}</div> : null}

        {dnsQueryResult ? (
          <div className="dns-query-result">
            <div className="dns-query-meta">
              <span className="meta-pill">Domain {dnsQueryResult.domain || '-'}</span>
              <span className="meta-pill">Type {dnsQueryResult.type || dnsQueryType}</span>
              <span className="meta-pill">Answer TTL {dnsQueryResult.ttl || 0}s</span>
            </div>
            <div className="dns-query-cache">
              <span className={`dns-cache-state ${cacheBefore.tone}`}>Before: {cacheBefore.text}</span>
              <span className={`dns-cache-state ${cacheAfter.tone}`}>After: {cacheAfter.text}</span>
            </div>
            <div className="dns-query-records">
              {queryRecords.length ? (
                queryRecords.map((item, index) => (
                  <code key={`${item}-${index}`}>{item}</code>
                ))
              ) : (
                <span className="dns-query-empty">No records returned.</span>
              )}
            </div>
            {dnsQueryResult.error ? (
              <div className="dns-query-status error">{dnsQueryResult.error}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
