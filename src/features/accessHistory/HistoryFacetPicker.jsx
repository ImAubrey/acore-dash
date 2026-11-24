import { useState } from 'react';
import { HistoryGroupPreview } from './HistoryGroupPreview';
import { hasHistoryFacet, historySearchFilters } from './historySearch';

export function HistoryFacetPicker({ request, bounds, search, onSelect, t }) {
  const [field, setField] = useState('domain');
  const bySource = field === 'sourceIp';
  const { domains, sourceIps, ...keywords } = historySearchFilters(search);
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
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`view-pill ${field === value ? 'active' : ''}`}
            aria-pressed={field === value}
            onClick={() => setField(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <HistoryGroupPreview
        key={field}
        request={request}
        query={query}
        byDomain={bySource}
        multiSelect
        selectPeer={(value) => onSelect(field, value)}
        isPeerSelected={(value) => hasHistoryFacet(search, field, value)}
        t={t}
      />
    </>
  );
}
