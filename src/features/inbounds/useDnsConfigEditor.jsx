import {
  fetchJson,
  toDnsEditorSection,
  formatJson,
  formatJsonText,
  isPlainObject,
  hasOwn
} from '../../dashboardShared';

export function useDnsConfigEditor({
  apiBase,
  notify,
  configMainPath,
  configDnsPath,
  setConfigDnsPath,
  configDnsText,
  setConfigDnsText,
  configDnsRootLoaded,
  setConfigDnsRootLoaded,
  configDnsStatus,
  setConfigDnsStatus,
  configDnsDirty,
  setConfigDnsDirty,
  configDnsSaving,
  setConfigDnsSaving,
  isFailedStatusText
}) {
  const loadDnsConfig = async (base = apiBase) => {
    setConfigDnsStatus('');
    try {
      const preferredPath = String(configDnsPath || configMainPath || '').trim();
      const endpoint = preferredPath
        ? `${base}/config/main?path=${encodeURIComponent(preferredPath)}`
        : `${base}/config/main`;
      const resp = await fetchJson(endpoint);
      const main = resp && typeof resp.main === 'object' && !Array.isArray(resp.main) ? resp.main : {};
      const dns = toDnsEditorSection(main);
      setConfigDnsRootLoaded(main);
      setConfigDnsText(formatJson(dns));
      setConfigDnsPath(resp.path || '');
      setConfigDnsDirty(false);
      const hasDns = hasOwn(main, 'dns') || hasOwn(main, 'DNS');
      if (!hasDns) {
        notify?.({ channel: 'dns-config', message: 'DNS section was not found; saving will create it.', tone: 'info' });
      }
      setConfigDnsStatus('');
      return resp;
    } catch (err) {
      setConfigDnsStatus('');
      notify?.({ channel: 'dns-config', message: `DNS config load failed: ${err.message}`, tone: 'error' });
      throw err;
    }
  };

  const saveDnsConfig = async () => {
    if (configDnsSaving) return;
    let parsed;
    try {
      parsed = JSON.parse(configDnsText);
    } catch (err) {
      setConfigDnsStatus(`Invalid JSON: ${err.message}`);
      return;
    }
    if (!isPlainObject(parsed)) {
      setConfigDnsStatus('dns must be a JSON object.');
      return;
    }
    const nextMain = isPlainObject(configDnsRootLoaded) ? { ...configDnsRootLoaded } : {};
    nextMain.dns = parsed;
    if (hasOwn(nextMain, 'DNS')) {
      delete nextMain.DNS;
    }
    setConfigDnsSaving(true);
    notify?.({ channel: 'dns-config', message: 'Saving DNS config...', tone: 'progress' });
    try {
      const resp = await fetchJson(`${apiBase}/config/main`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          main: nextMain,
          path: configDnsPath || undefined
        })
      });
      if (resp?.path) {
        setConfigDnsPath(resp.path);
      }
      setConfigDnsRootLoaded(nextMain);
      setConfigDnsText(formatJson(parsed));
      setConfigDnsDirty(false);
      setConfigDnsStatus('');
      notify?.({ channel: 'dns-config', message: 'DNS config saved. Hot reload or restart core to apply.', tone: 'success' });
    } catch (err) {
      setConfigDnsStatus('');
      notify?.({ channel: 'dns-config', message: `DNS config save failed: ${err.message}`, tone: 'error' });
    } finally {
      setConfigDnsSaving(false);
    }
  };

  const resetDnsEditor = () => {
    setConfigDnsText(formatJson(toDnsEditorSection(configDnsRootLoaded)));
    setConfigDnsDirty(false);
    setConfigDnsStatus('');
    notify?.({ channel: 'dns-config', message: 'DNS editor reset to the loaded config.', tone: 'info' });
  };

  const formatDnsEditor = () => {
    try {
      const next = formatJsonText(configDnsText);
      setConfigDnsText(next);
      setConfigDnsDirty(true);
      if (configDnsStatus && !isFailedStatusText(configDnsStatus)) {
        setConfigDnsStatus('');
      }
    } catch (err) {
      setConfigDnsStatus(`Invalid JSON: ${err.message}`);
    }
  };

  return {
    loadDnsConfig,
    saveDnsConfig,
    resetDnsEditor,
    formatDnsEditor
  };
}
