import { useState } from 'react';
import { HistoryGroupPreview } from './HistoryGroupPreview';
import { hasHistoryFacet, historySearchFilters } from './historySearch';

export function HistoryFacetPicker({ request, bounds, search, onSelect, t, detailedFilters, rows }) {
  const [field, setField] = useState('domain');
  const [tag, setTag] = useState('');
  const rowField = { outbound: 'outboundTags', routeRule: 'routeRuleTags', firewallRule: 'firewallRuleTags' }[field];
  const choices = rowField ? [...new Set(rows.flatMap(row => row[rowField] || []))].sort() : [];
  const bySource = field === 'sourceIp';
  const { domains, sourceIps, ...keywords } = historySearchFilters(search, detailedFilters);
  const query = {
    ...bounds,
    ...keywords,
    ...(bySource && domains && { domains }),
    ...(!bySource && sourceIps && { sourceIps }),
    view: bySource ? 'sources' : 'domains',
    sort: 'time',
    order: 'desc',
    limit: 50,
  };

  return (
    <>
      <div className="history-view-options">
        {[
          ['domain', t('域名', 'Domains')],
          ['sourceIp', t('来源 IP', 'Source IPs')],
          ...(detailedFilters ? [
            ['outbound', t('出口', 'Outbound')],
            ['routeRule', t('路由规则', 'Routing rules')],
            ['firewallRule', t('防火墙规则', 'Firewall rules')],
          ] : []),
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`view-pill ${field === value ? 'active' : ''}`}
            aria-pressed={field === value}
            onClick={() => { setField(value); setTag(''); }}
          >
            {label}
          </button>
        ))}
      </div>
      {rowField ? (
        <div className="history-tag-picker">
          <div>
            <input value={tag} aria-label={t('标签名称', 'Tag name')} placeholder={t('输入标签名称', 'Enter tag name')}
              onChange={e => setTag(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); if (tag.trim()) onSelect(field, tag.trim()); } }} />
            <button type="button" disabled={!tag.trim()} onClick={() => onSelect(field, tag.trim())}>{t('添加', 'Add')}</button>
          </div>
          <ul className="history-preview">{choices.filter(value => value.toLowerCase().includes(tag.toLowerCase())).map(value => (
            <li key={value}><button type="button" className="history-link" aria-pressed={hasHistoryFacet(search, field, value)}
              onClick={() => onSelect(field, value)}>{value}</button></li>
          ))}</ul>
        </div>
      ) : <HistoryGroupPreview
        key={field}
        request={request}
        query={query}
        byDomain={bySource}
        multiSelect
        selectPeer={(value) => onSelect(field, value)}
        isPeerSelected={(value) => hasHistoryFacet(search, field, value)}
        t={t}
      />}
    </>
  );
}
