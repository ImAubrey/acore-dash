import {
  MAIN_EDITOR_ALLOWED_KEYS,
  fetchJson,
  isPlainObject,
  toMainEditorSections,
  applyMainEditorSectionsToRoot,
  formatJson,
  formatJsonText
} from '../../dashboardShared';

export function useMainConfigEditor({
  apiBase,
  configMainPath,
  setConfigMainPath,
  configMainText,
  setConfigMainText,
  configMainLoaded,
  setConfigMainLoaded,
  configMainStatus,
  setConfigMainStatus,
  configMainDirty,
  setConfigMainDirty,
  configMainSaving,
  setConfigMainSaving,
  isFailedStatusText
}) {
  const loadMainConfig = async (base = apiBase) => {
    setConfigMainStatus('Loading config...');
    try {
      const preferredPath = String(configMainPath || '').trim();
      const endpoint = preferredPath
        ? `${base}/config/main?path=${encodeURIComponent(preferredPath)}`
        : `${base}/config/main`;
      const resp = await fetchJson(endpoint);
      const main = resp && typeof resp.main === 'object' && !Array.isArray(resp.main) ? resp.main : {};
      const sections = toMainEditorSections(main);
      setConfigMainLoaded(main);
      setConfigMainText(formatJson(sections));
      setConfigMainPath(resp.path || '');
      setConfigMainDirty(false);
      if (resp.foundMain === false) {
        setConfigMainStatus('Main config not found.');
      } else {
        setConfigMainStatus('');
      }
      return resp;
    } catch (err) {
      setConfigMainStatus(`Config load failed: ${err.message}`);
      throw err;
    }
  };

  const saveMainConfig = async () => {
    if (configMainSaving) return;
    let parsed;
    try {
      parsed = JSON.parse(configMainText);
    } catch (err) {
      setConfigMainStatus(`Invalid JSON: ${err.message}`);
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setConfigMainStatus('main must be a JSON object.');
      return;
    }
    const extraKeys = Object.keys(parsed).filter((key) => !MAIN_EDITOR_ALLOWED_KEYS.includes(key));
    if (extraKeys.length > 0) {
      setConfigMainStatus(`Only ${MAIN_EDITOR_ALLOWED_KEYS.join(', ')} are editable here.`);
      return;
    }
    const observatory = parsed.Observatory === undefined ? {} : parsed.Observatory;
    const log = parsed.log === undefined ? {} : parsed.log;
    const metrics = parsed.metrics === undefined ? {} : parsed.metrics;
    const stats = parsed.stats === undefined ? {} : parsed.stats;
    if (!isPlainObject(observatory)) {
      setConfigMainStatus('Observatory must be a JSON object.');
      return;
    }
    if (!isPlainObject(log)) {
      setConfigMainStatus('log must be a JSON object.');
      return;
    }
    if (!isPlainObject(metrics)) {
      setConfigMainStatus('metrics must be a JSON object.');
      return;
    }
    if (!isPlainObject(stats)) {
      setConfigMainStatus('stats must be a JSON object.');
      return;
    }
    const nextSections = {
      Observatory: observatory,
      log,
      metrics,
      stats
    };
    const nextMain = applyMainEditorSectionsToRoot(configMainLoaded, nextSections);
    setConfigMainSaving(true);
    setConfigMainStatus('Saving...');
    try {
      const resp = await fetchJson(`${apiBase}/config/main`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          main: nextMain,
          path: configMainPath || undefined
        })
      });
      if (resp?.path) {
        setConfigMainPath(resp.path);
      }
      setConfigMainLoaded(nextMain);
      setConfigMainText(formatJson(toMainEditorSections(nextMain)));
      setConfigMainDirty(false);
      setConfigMainStatus('Saved to config. Hot reload or restart core to apply.');
    } catch (err) {
      setConfigMainStatus(`Save failed: ${err.message}`);
    } finally {
      setConfigMainSaving(false);
    }
  };

  const resetMainConfigEditor = () => {
    setConfigMainText(formatJson(toMainEditorSections(configMainLoaded)));
    setConfigMainDirty(false);
    setConfigMainStatus('Main editor reset to loaded config.');
  };

  const formatMainConfigEditor = () => {
    try {
      const next = formatJsonText(configMainText);
      setConfigMainText(next);
      setConfigMainDirty(true);
      if (configMainStatus && !isFailedStatusText(configMainStatus)) {
        setConfigMainStatus('');
      }
    } catch (err) {
      setConfigMainStatus(`Invalid JSON: ${err.message}`);
    }
  };

  return {
    loadMainConfig,
    saveMainConfig,
    resetMainConfigEditor,
    formatMainConfigEditor
  };
}
