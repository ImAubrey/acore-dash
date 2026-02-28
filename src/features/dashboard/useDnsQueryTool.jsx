import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../../dashboardShared';

const FALLBACK_DNS_QUERY_TYPES = [
  { value: 'A', supported: true },
  { value: 'AAAA', supported: true },
  { value: 'TXT', supported: true },
  { value: 'CNAME', supported: true },
  { value: 'MX', supported: true },
  { value: 'NS', supported: true },
  { value: 'SRV', supported: true },
  { value: 'PTR', supported: true },
  { value: 'CAA', supported: true },
  { value: 'NAPTR', supported: true },
  { value: 'SOA', supported: true }
];

const normalizeDnsQueryTypes = (payload) => {
  const raw = Array.isArray(payload?.types) ? payload.types : [];
  const list = raw
    .map((item) => {
      const value = String(item?.value || '').trim().toUpperCase();
      if (!value) return null;
      return {
        value,
        supported: !!item?.supported
      };
    })
    .filter((item) => !!item);
  if (!list.length) return FALLBACK_DNS_QUERY_TYPES;
  return list;
};

const pickPreferredType = (types, current) => {
  const currentType = String(current || '').trim().toUpperCase();
  if (currentType && types.some((item) => item.value === currentType)) {
    return currentType;
  }
  const firstSupported = types.find((item) => item.supported);
  if (firstSupported) return firstSupported.value;
  return types[0]?.value || 'A';
};

const findTypeInfo = (types, queryType) => {
  const target = String(queryType || '').trim().toUpperCase();
  return types.find((item) => item.value === target) || null;
};

export function useDnsQueryTool({ apiBase }) {
  const [dnsQueryTypes, setDnsQueryTypes] = useState(FALLBACK_DNS_QUERY_TYPES);
  const [dnsQueryType, setDnsQueryType] = useState('A');
  const [dnsQueryDomain, setDnsQueryDomain] = useState('');
  const [dnsQueryBusy, setDnsQueryBusy] = useState(false);
  const [dnsQueryStatus, setDnsQueryStatus] = useState('');
  const [dnsQueryResult, setDnsQueryResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadTypes = async () => {
      try {
        const payload = await fetchJson(`${apiBase}/dns/query/types`);
        if (cancelled) return;
        const normalized = normalizeDnsQueryTypes(payload);
        setDnsQueryTypes(normalized);
        setDnsQueryType((prev) => pickPreferredType(normalized, prev));
      } catch (_err) {
        if (cancelled) return;
        setDnsQueryTypes(FALLBACK_DNS_QUERY_TYPES);
        setDnsQueryType((prev) => pickPreferredType(FALLBACK_DNS_QUERY_TYPES, prev));
      }
    };
    loadTypes();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const selectedTypeInfo = useMemo(
    () => findTypeInfo(dnsQueryTypes, dnsQueryType),
    [dnsQueryTypes, dnsQueryType]
  );

  const runDnsQuery = async () => {
    const domain = String(dnsQueryDomain || '').trim();
    if (!domain) {
      setDnsQueryStatus('Domain is required.');
      return null;
    }

    const queryType = pickPreferredType(dnsQueryTypes, dnsQueryType);
    const selectedType = findTypeInfo(dnsQueryTypes, queryType);
    if (selectedType && !selectedType.supported) {
      setDnsQueryStatus(`Type ${queryType} is not supported by current Xray DNS interface.`);
      return null;
    }

    setDnsQueryBusy(true);
    setDnsQueryStatus(`Querying ${queryType} for ${domain}...`);
    try {
      const data = await fetchJson(`${apiBase}/dns/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          type: queryType
        })
      });
      setDnsQueryResult(data);
      if (data?.ok) {
        const count = Array.isArray(data?.records) ? data.records.length : 0;
        setDnsQueryStatus(count > 0 ? `Resolved ${count} record(s).` : 'Query completed with no records.');
      } else {
        setDnsQueryStatus(`DNS query failed: ${data?.error || 'unknown error'}`);
      }
      return data;
    } catch (err) {
      setDnsQueryStatus(`DNS query failed: ${err.message}`);
      return null;
    } finally {
      setDnsQueryBusy(false);
    }
  };

  return {
    dnsQueryTypes,
    dnsQueryType,
    setDnsQueryType,
    dnsQueryDomain,
    setDnsQueryDomain,
    dnsQueryBusy,
    dnsQueryStatus,
    dnsQueryResult,
    selectedTypeInfo,
    runDnsQuery
  };
}
