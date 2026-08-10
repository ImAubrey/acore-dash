import { useCallback, useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { githubLight } from '@uiw/codemirror-theme-github';
import {
  DATABASE_SOURCE_TYPES,
  DATABASE_TYPES,
  SUBSCRIPTION_FORMATS,
  formatSubscriptionValue,
  parseSubscriptionValue,
  updateSubscriptionField
} from './subscriptionVisualHelpers';

const ADVANCED_EXTENSIONS = [json(), lintGutter(), linter(jsonParseLinter()), EditorView.lineWrapping];

function TextField({ label, field, entry, commit, disabled, secret = false, placeholder = '' }) {
  const [visible, setVisible] = useState(false);
  const value = entry?.[field] == null ? '' : String(entry[field]);
  return (
    <div className="outbound-visual-field">
      <div className="outbound-visual-field-label"><label htmlFor={`subscription-${field}`}>{label}</label></div>
      <div className="subscription-secret-input">
        <input
          id={`subscription-${field}`}
          type={secret && !visible ? 'password' : 'text'}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={secret ? 'new-password' : undefined}
          spellCheck={secret ? false : undefined}
          onChange={(event) => commit(updateSubscriptionField(entry, field, event.target.value))}
        />
        {secret ? <button className="ghost small" type="button" onClick={() => setVisible(!visible)} disabled={disabled}>{visible ? 'Hide' : 'Reveal'}</button> : null}
      </div>
    </div>
  );
}

function SelectField({ label, field, entry, options, commit, disabled }) {
  const current = entry?.[field] == null ? '' : String(entry[field]);
  const values = options.includes(current) || !current ? options : [...options, current];
  return (
    <div className="outbound-visual-field outbound-visual-field-select">
      <div className="outbound-visual-field-label"><label htmlFor={`subscription-${field}`}>{label}</label></div>
      <select id={`subscription-${field}`} value={current} disabled={disabled} onChange={(event) => commit(updateSubscriptionField(entry, field, event.target.value))}>
        <option value="">Not set</option>
        {values.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

export function SubscriptionVisualEditor({ target, value, onChange, disabled = false }) {
  const [mode, setMode] = useState('visual');
  const parsed = useMemo(() => parseSubscriptionValue(value), [value]);
  const entry = parsed.entry;
  const isDatabase = target === 'subscriptionDatabase';
  const observatory = entry?.observatory;
  const observatoryObject = observatory && typeof observatory === 'object' ? observatory : null;
  const observatoryEnabled = observatory === true || Boolean(observatoryObject && observatoryObject.enabled !== false);
  useEffect(() => { if (parsed.error) setMode('advanced'); }, [parsed.error]);
  const commit = useCallback((next) => {
    if (!disabled && typeof onChange === 'function') onChange(formatSubscriptionValue(next));
  }, [disabled, onChange]);

  const visual = !entry ? (
    <div className="empty-state small"><strong>Visual editor unavailable</strong><span>Fix the JSON error in Advanced mode first.</span></div>
  ) : isDatabase ? (
    <div className="outbound-visual-form">
      <fieldset className="outbound-visual-group"><legend>Database source</legend><div className="outbound-visual-grid">
        <SelectField label="Database type" field="type" entry={entry} options={DATABASE_TYPES} commit={commit} disabled={disabled} />
        <TextField label="Source URL or local path" field="url" entry={entry} commit={commit} disabled={disabled} secret placeholder="https://example.com/geosite.dat" />
        <TextField label="Output file" field="file" entry={entry} commit={commit} disabled={disabled} placeholder="Optional resource file name" />
        {String(entry.type || '').toLowerCase() === 'ja4' ? <SelectField label="JA4 source type" field="sourceType" entry={{ ...entry, sourceType: entry.sourceType ?? entry.format }} options={DATABASE_SOURCE_TYPES} commit={commit} disabled={disabled} /> : null}
      </div></fieldset>
      <Schedule entry={entry} commit={commit} disabled={disabled} />
    </div>
  ) : (
    <div className="outbound-visual-form">
      <fieldset className="outbound-visual-group"><legend>Subscription source</legend><div className="outbound-visual-grid">
        <TextField label="Name" field="name" entry={entry} commit={commit} disabled={disabled} placeholder="Optional display name" />
        <TextField label="Source URL or local path" field="url" entry={entry} commit={commit} disabled={disabled} secret placeholder="https://example.com/sub" />
        <SelectField label="Content format" field="format" entry={entry} options={SUBSCRIPTION_FORMATS} commit={commit} disabled={disabled} />
        <TextField label="Tag prefix" field="tagPrefix" entry={entry} commit={commit} disabled={disabled} placeholder="e.g. provider-" />
        <SelectField label="Insert position" field="insert" entry={entry} options={['head', 'tail']} commit={commit} disabled={disabled} />
      </div></fieldset>
      <fieldset className="outbound-visual-group"><legend>Observatory</legend><div className="outbound-visual-grid">
        <label className="outbound-visual-check"><input type="checkbox" checked={observatoryEnabled} disabled={disabled} onChange={(event) => commit(updateSubscriptionField(entry, 'observatory', observatoryObject ? { ...observatoryObject, enabled: event.target.checked } : event.target.checked, { trim: false }))} /><span>Include refreshed nodes in observatory</span></label>
        {observatoryObject ? <TextField label="Probe URL" field="testUrl" entry={{ ...observatoryObject, testUrl: observatoryObject.testUrl ?? observatoryObject.testURL ?? observatoryObject.probeURL }} commit={(next) => commit({ ...entry, observatory: next })} disabled={disabled} secret placeholder="Optional test URL" /> : null}
      </div></fieldset>
      <Schedule entry={entry} commit={commit} disabled={disabled} />
    </div>
  );
  return <div className="outbound-visual-editor subscription-visual-editor">
    <div className="outbound-editor-mode-switch" role="group" aria-label="Subscription editor mode">
      <button className={mode === 'visual' ? 'primary small' : 'ghost small'} type="button" aria-pressed={mode === 'visual'} disabled={Boolean(parsed.error)} onClick={() => setMode('visual')}>Visual</button>
      <button className={mode === 'advanced' ? 'primary small' : 'ghost small'} type="button" aria-pressed={mode === 'advanced'} onClick={() => setMode('advanced')}>Advanced JSON</button>
    </div>
    {mode === 'visual' ? visual : <div className="outbound-advanced-editor"><CodeMirror value={typeof value === 'string' ? value : parsed.text} minHeight="320px" theme={githubLight} extensions={ADVANCED_EXTENSIONS} editable={!disabled} onChange={(next) => !disabled && onChange?.(next)} aria-label="Advanced subscription JSON" />{parsed.error ? <div className="status status-danger" role="alert">{parsed.error}</div> : null}</div>}
  </div>;
}

function Schedule({ entry, commit, disabled }) {
  const interval = String(entry?.interval || '');
  const cron = String(entry?.cron || entry?.crontab || '');
  return <fieldset className="outbound-visual-group"><legend>Refresh schedule</legend><div className="outbound-visual-grid">
    <TextField label="Interval" field="interval" entry={entry} commit={(next) => { if (!next.interval) { commit(next); return; } const { cron: _cron, crontab: _crontab, ...rest } = next; commit(rest); }} disabled={disabled} placeholder="e.g. 1h" />
    <TextField label="Cron" field="cron" entry={{ ...entry, cron }} commit={(next) => { const { crontab: _crontab, ...withoutAlias } = next; if (!withoutAlias.cron) { commit(withoutAlias); return; } const { interval: _interval, ...rest } = withoutAlias; commit(rest); }} disabled={disabled} placeholder="e.g. 0 3 * * *" />
    <label className="outbound-visual-check"><input type="checkbox" checked={entry?.enabled !== false} disabled={disabled} onChange={(event) => commit(updateSubscriptionField(entry, 'enabled', event.target.checked ? undefined : false, { trim: false }))} /><span>Enabled</span></label>
  </div><p className="group-meta">Use either interval or cron. Unknown and extension fields are preserved; use Advanced JSON to edit them.</p></fieldset>;
}
