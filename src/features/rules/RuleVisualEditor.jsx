import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { githubLight } from '@uiw/codemirror-theme-github';
import {
  FIREWALL_ACTIONS,
  RULE_MATCH_FIELDS,
  attrsToVisualText,
  asRuleRecord,
  formatRuleEditorJson,
  getDestinationTag,
  getDestinationVlessRoute,
  isRecord,
  moveRuleListItem,
  normalizeBalancerSelectors,
  normalizeRuleListValue,
  normalizeFirewallAction,
  parseRuleEditorJson,
  patchRuleDestination,
  patchRuleNested,
  patchRuleText,
  patchRuleValue,
  setBalancerFallbackTag,
  setBalancerSelectorSelected,
  validateRuleEditorValue,
  valueToText,
  visualTextToAttrs
} from './ruleVisualEditor';
import { ScrollArea } from '../common/ScrollArea';
import { TrashIcon } from '../connections/actionIcons';

const JSON_EDITOR_EXTENSIONS = [json(), lintGutter(), linter(jsonParseLinter()), EditorView.lineWrapping];
const ARRAY_MATCH_FIELDS = new Set([
  'source', 'sourceIP', 'ip', 'domain', 'localIP', 'protocol', 'alpn',
  'process', 'inboundTag', 'user', 'requireRuleTag'
]);
const TRIGGER_KEY_OPTIONS = [
  { value: 'ruleWide', label: 'Whole rule (legacy)' },
  { value: 'srcIp', label: 'Source IP' },
  { value: 'srcPort', label: 'Source port' },
  { value: 'srcIpSrcPort', label: 'Source IP + source port' },
  { value: 'dstIp', label: 'Destination IP' },
  { value: 'srcIpDstIp', label: 'Source IP + destination IP' },
  { value: 'srcPortDstIp', label: 'Source port + destination IP' },
  { value: 'srcIpSrcPortDstIp', label: 'Source IP + source port + destination IP' },
  { value: 'dstPort', label: 'Destination port' },
  { value: 'srcIpDstPort', label: 'Source IP + destination port' },
  { value: 'srcPortDstPort', label: 'Source port + destination port' },
  { value: 'srcIpSrcPortDstPort', label: 'Source IP + source port + destination port' },
  { value: 'dstIpDstPort', label: 'Destination IP + destination port' },
  { value: 'srcIpDstIpDstPort', label: 'Source IP + destination IP + destination port' },
  { value: 'srcPortDstIpDstPort', label: 'Source port + destination IP + destination port' },
  { value: 'srcIpSrcPortDstIpDstPort', label: 'Full four-tuple' }
];

function TextField({ label, value, onChange, disabled, placeholder = '' }) {
  return (
    <label className="rule-visual-field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange, disabled, min = 0 }) {
  return (
    <label className="rule-visual-field">
      <span>{label}</span>
      <input type="number" min={min} value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))} />
    </label>
  );
}

function ArrayListField({ label, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const titleId = useId();
  const items = normalizeRuleListValue(value);

  const openEditor = () => {
    setDraft(items.length ? items : ['']);
    setOpen(true);
  };
  const closeEditor = () => setOpen(false);
  const updateItem = (index, nextValue) => {
    setDraft((current) => current.map((item, itemIndex) => itemIndex === index ? nextValue : item));
  };
  const removeItem = (index) => {
    setDraft((current) => current.length <= 1 ? [''] : current.filter((_, itemIndex) => itemIndex !== index));
  };
  const moveItem = (index, offset) => {
    setDraft((current) => moveRuleListItem(current, index, index + offset));
  };
  const saveEditor = () => {
    onChange(normalizeRuleListValue(draft));
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !disabled) closeEditor();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, open]);

  const modal = open && typeof document !== 'undefined' ? createPortal(
    <div
      className="modal-backdrop rule-list-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !disabled) closeEditor();
      }}
    >
      <div className="modal rule-list-modal">
        <div className="modal-header modal-fixed-header">
          <div>
            <h3 id={titleId}>{label}</h3>
            <p className="group-meta">Edit one list item per row. Changes apply only after Save.</p>
          </div>
          <button className="ghost small" type="button" onClick={closeEditor} disabled={disabled}>Close</button>
        </div>
        <ScrollArea className="modal-body-scroll rule-list-modal-scroll" contentClassName="modal-body-content rule-list-modal-content" ariaLabel={`${label} list editor`}>
          <div className="rule-list-modal-rows">
            {draft.map((item, index) => (
              <div className="rule-list-modal-row" key={index}>
                <span className="rule-list-modal-index">{index + 1}</span>
                <input
                  autoFocus={index === 0}
                  value={item}
                  disabled={disabled}
                  aria-label={`${label} item ${index + 1}`}
                  onChange={(event) => updateItem(index, event.target.value)}
                />
                <button className="ghost small" type="button" disabled={disabled || index === 0} onClick={() => moveItem(index, -1)} aria-label={`Move ${label} item ${index + 1} up`}>↑</button>
                <button className="ghost small" type="button" disabled={disabled || index === draft.length - 1} onClick={() => moveItem(index, 1)} aria-label={`Move ${label} item ${index + 1} down`}>↓</button>
                <button
                  className="action-icon-button action-icon-danger"
                  type="button"
                  title="Delete"
                  aria-label={`Delete ${label} item ${index + 1}`}
                  disabled={disabled}
                  onClick={() => removeItem(index)}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
          <button className="ghost small rule-list-modal-add" type="button" disabled={disabled} onClick={() => setDraft((current) => [...current, ''])}>Add item</button>
        </ScrollArea>
        <div className="modal-fixed-footer rule-list-modal-footer">
          <span className="group-meta">{normalizeRuleListValue(draft).length} valid items</span>
          <div className="confirm-actions">
            <button className="ghost small" type="button" onClick={closeEditor} disabled={disabled}>Cancel</button>
            <button className="primary small" type="button" onClick={saveEditor} disabled={disabled}>Save list</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="rule-visual-field rule-visual-array-field">
      <span>{label}</span>
      <button className="rule-visual-array-trigger" type="button" disabled={disabled} onClick={openEditor}>
        <strong>{items.length ? `${items.length} items` : 'Not set'}</strong>
        <small>{items.length ? items.slice(0, 2).join(' · ') : 'Open list editor'}</small>
      </button>
      {modal}
    </div>
  );
}

function DurationField({ label, value, secondsField, minutesField, onChange, disabled, required = false }) {
  const detectedUnit = value[minutesField] !== undefined && value[secondsField] === undefined
    ? 'minutes'
    : 'seconds';
  const [unit, setUnit] = useState(detectedUnit);
  useEffect(() => {
    if (value[secondsField] !== undefined || value[minutesField] !== undefined) setUnit(detectedUnit);
  }, [detectedUnit, minutesField, secondsField, value]);
  const activeField = unit === 'minutes' ? minutesField : secondsField;
  const counterpart = unit === 'minutes' ? secondsField : minutesField;
  const amount = value[activeField] ?? '';

  return (
    <label className="rule-visual-field rule-visual-duration">
      <span>{label}</span>
      <div className="rule-visual-duration-control">
        <input
          type="number"
          min={1}
          value={amount}
          required={required}
          disabled={disabled}
          placeholder={required ? 'Required' : 'Optional'}
          onChange={(event) => onChange(activeField, counterpart, event.target.value === '' ? undefined : Number(event.target.value))}
        />
        <select
          value={unit}
          disabled={disabled}
          aria-label={`${label} unit`}
          onChange={(event) => {
            const nextUnit = event.target.value;
            setUnit(nextUnit);
            if (amount !== '') {
              const nextField = nextUnit === 'minutes' ? minutesField : secondsField;
              const oldField = nextUnit === 'minutes' ? secondsField : minutesField;
              onChange(nextField, oldField, Number(amount));
            }
          }}
        >
          <option value="seconds">Seconds</option>
          <option value="minutes">Minutes</option>
        </select>
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, disabled, options }) {
  return (
    <label className="rule-visual-field">
      <span>{label}</span>
      <select value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function MatchFields({ value, onChange, disabled }) {
  return (
    <div className="rule-visual-fields rule-visual-match-fields">
      {RULE_MATCH_FIELDS.map(([key, label]) => (
        ARRAY_MATCH_FIELDS.has(key) ? (
          <ArrayListField
            key={key}
            label={label}
            value={value[key]}
            disabled={disabled}
            onChange={(items) => onChange(patchRuleValue(value, key, items.length ? items : undefined))}
          />
        ) : (
          <TextField
            key={key}
            label={label}
            value={valueToText(value[key])}
            disabled={disabled}
            onChange={(text) => onChange(patchRuleText(value, key, text))}
          />
        )
      ))}
      <label className="rule-visual-field rule-visual-attrs-field">
        <span>HTTP attributes</span>
        <textarea
          value={attrsToVisualText(value.attrs)}
          placeholder={':method=GET\nja4=threat:malware'}
          disabled={disabled}
          rows={3}
          onChange={(event) => onChange(patchRuleValue(value, 'attrs', visualTextToAttrs(event.target.value)))}
        />
        <small>One key=value pair per line.</small>
      </label>
    </div>
  );
}

function FirewallOptions({ value, onChange, disabled, onValidationChange }) {
  const action = normalizeFirewallAction(value.action);
  const limit = isRecord(value.limit) ? value.limit : {};
  const speed = isRecord(value.speed) ? value.speed : {};
  const trigger = isRecord(value.trigger) ? value.trigger : {};
  const dynamicRule = isRecord(trigger.dynamicRule) ? trigger.dynamicRule : {};
  const hasDynamicRule = isRecord(trigger.dynamicRule);
  const updateAction = (nextAction) => onChange(patchRuleValue(value, 'action', nextAction));
  const updateNested = (key, field, nextValue) => onChange(patchRuleNested(value, key, field, nextValue));
  const updateTriggerDuration = (field, counterpart, nextValue) => {
    let next = patchRuleNested(value, 'trigger', field, nextValue);
    if (nextValue !== undefined) next = patchRuleNested(next, 'trigger', counterpart, undefined);
    onChange(next);
  };

  return (
    <section className="rule-visual-section">
      <label className="rule-visual-field">
        <span>Action</span>
        <select value={action} disabled={disabled} onChange={(event) => updateAction(event.target.value)}>
          {FIREWALL_ACTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      {action === 'limit' ? (
        <div className="rule-visual-fields">
          <SelectField label="Count by" value={valueToText(limit.key ?? limit.countBy)} disabled={disabled} onChange={(item) => updateNested('limit', 'key', item)} options={[
            { value: '', label: 'Select a bucket' },
            { value: 'srcIp', label: 'Source IP' },
            { value: 'dstIp', label: 'Destination IP' },
            { value: 'srcDstIp', label: 'Source + destination IP' },
            { value: 'srcPrefix', label: 'Source prefix' },
            { value: 'dstPrefix', label: 'Destination prefix' },
            { value: 'dstDomain', label: 'Destination domain' },
            { value: 'srcIpDstDomain', label: 'Source IP + destination domain' }
          ]} />
          <SelectField label="Mode" value={valueToText(limit.mode)} disabled={disabled} onChange={(item) => updateNested('limit', 'mode', item)} options={[
            { value: 'activeConnections', label: 'Active connections' },
            { value: 'newConnections', label: 'New connections in a window' }
          ]} />
          <SelectField label="Domain type" value={valueToText(limit.domainType)} disabled={disabled} onChange={(item) => updateNested('limit', 'domainType', item || undefined)} options={[
            { value: '', label: 'Default (root domain)' },
            { value: 'root', label: 'Root domain' },
            { value: 'exact', label: 'Exact domain' },
            { value: 'wildcard', label: 'Wildcard domain' }
          ]} />
          <NumberField label="Max connections" value={limit.maxConnections} disabled={disabled} min={1} onChange={(item) => updateNested('limit', 'maxConnections', item)} />
          {limit.mode === 'newConnections' ? <NumberField label="Window seconds" value={limit.windowSeconds} disabled={disabled} min={1} onChange={(item) => updateNested('limit', 'windowSeconds', item)} /> : null}
        </div>
      ) : null}
      {action === 'speed' ? (
        <div className="rule-visual-fields">
          <SelectField label="Count by" value={valueToText(speed.key ?? speed.countBy)} disabled={disabled} onChange={(item) => updateNested('speed', 'key', item)} options={[
            { value: '', label: 'Select a bucket' },
            { value: 'srcIp', label: 'Source IP' },
            { value: 'dstIp', label: 'Destination IP' },
            { value: 'srcDstIp', label: 'Source + destination IP' },
            { value: 'srcPrefix', label: 'Source prefix' },
            { value: 'dstPrefix', label: 'Destination prefix' }
          ]} />
          <NumberField label="Upload Bps" value={speed.uploadBps} disabled={disabled} onChange={(item) => updateNested('speed', 'uploadBps', item)} />
          <NumberField label="Download Bps" value={speed.downloadBps} disabled={disabled} onChange={(item) => updateNested('speed', 'downloadBps', item)} />
          <NumberField label="Burst bytes" value={speed.burstBytes} disabled={disabled} onChange={(item) => updateNested('speed', 'burstBytes', item)} />
        </div>
      ) : null}
      {action === 'trigger' ? (
        <div className="rule-visual-trigger">
          <div className="rule-visual-fields">
            <SelectField label="Bucket key" value={valueToText(trigger.key || 'ruleWide')} disabled={disabled} onChange={(item) => updateNested('trigger', 'key', item === 'ruleWide' ? undefined : item)} options={TRIGGER_KEY_OPTIONS} />
            <SelectField label="Mode" value={valueToText(trigger.mode || 'activeConnections')} disabled={disabled} onChange={(item) => updateNested('trigger', 'mode', item)} options={[
              { value: 'activeConnections', label: 'Active connections' },
              { value: 'newConnections', label: 'New connections in a window' }
            ]} />
            <NumberField label="Max connections" value={trigger.maxConnections} disabled={disabled} min={1} onChange={(item) => updateNested('trigger', 'maxConnections', item)} />
            {trigger.mode === 'newConnections' ? <NumberField label="Window seconds" value={trigger.windowSeconds} disabled={disabled} min={1} onChange={(item) => updateNested('trigger', 'windowSeconds', item)} /> : null}
            <DurationField label="Sustain duration" value={trigger} secondsField="sustainSeconds" minutesField="sustainMinutes" disabled={disabled} onChange={updateTriggerDuration} />
            <DurationField label="Lifetime / block duration" value={trigger} secondsField="blockSeconds" minutesField="blockMinutes" disabled={disabled} required onChange={updateTriggerDuration} />
          </div>
          <label className="rule-visual-check">
            <input
              type="checkbox"
              checked={hasDynamicRule}
              disabled={disabled || Boolean(trigger.key && trigger.key !== 'ruleWide')}
              onChange={(event) => updateNested('trigger', 'dynamicRule', event.target.checked ? { ruleTag: '', outboundTag: '' } : undefined)}
            />
            Activate a higher-priority dynamic routing rule
          </label>
          {hasDynamicRule ? (
            <div className="rule-visual-nested-rule">
              <RuleVisualEditor
                target="rule"
                value={dynamicRule}
                disabled={disabled}
                onChange={(item) => updateNested('trigger', 'dynamicRule', item)}
                onValidationChange={onValidationChange}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function BalancerOptions({ value, onChange, disabled, selectorOptions = [] }) {
  const strategy = isRecord(value.strategy) ? value.strategy : {};
  const [customSelector, setCustomSelector] = useState('');
  const [customFallback, setCustomFallback] = useState('');
  const selectedSelectors = normalizeBalancerSelectors(value.selector);
  const ownTag = String(value.tag || '').trim();
  const fallbackTag = String(value.fallbackTag || '').trim();
  const candidates = [];
  const seen = new Set();
  [
    ...selectorOptions,
    ...selectedSelectors.map((selector) => ({ value: selector, kind: 'custom' })),
    ...(fallbackTag ? [{ value: fallbackTag, kind: 'custom fallback' }] : [])
  ]
    .forEach((rawOption) => {
      const option = typeof rawOption === 'string' ? { value: rawOption } : rawOption;
      const selector = String(option?.value || '').trim();
      if (!selector || selector === ownTag || seen.has(selector)) return;
      seen.add(selector);
      candidates.push({
        value: selector,
        label: String(option?.label || selector),
        kind: option?.kind || 'custom'
      });
    });

  const addCustomSelector = () => {
    const selector = customSelector.trim();
    if (!selector) return;
    onChange(setBalancerSelectorSelected(value, selector, true));
    setCustomSelector('');
  };

  const setCustomFallbackTag = () => {
    const tag = customFallback.trim();
    if (!tag || tag === ownTag) return;
    onChange(setBalancerFallbackTag(value, tag));
    setCustomFallback('');
  };

  return (
    <section className="rule-visual-section rule-visual-balancer">
      <div className="rule-visual-fields">
        <TextField
          label="Balancer tag"
          value={valueToText(value.tag)}
          disabled={disabled}
          onChange={(text) => onChange(patchRuleText(value, 'tag', text))}
        />
        <SelectField
          label="Strategy"
          value={valueToText(strategy.type || 'random')}
          disabled={disabled}
          options={[
            { value: 'random', label: 'Random' },
            { value: 'leastping', label: 'Least ping' },
            { value: 'leastload', label: 'Least load' },
            { value: 'roundrobin', label: 'Round robin' },
            { value: 'selector', label: 'Manual selector' },
            { value: 'fallback', label: 'Fallback' }
          ]}
          onChange={(type) => onChange(patchRuleValue(value, 'strategy', { ...strategy, type }))}
        />
      </div>
      <fieldset className="rule-visual-selector-group">
        <legend>Selector</legend>
        <p className="group-meta">Outbound and balancer tags are detected automatically. Select one or more.</p>
        {candidates.length ? (
          <div className="rule-visual-selector-options">
            {candidates.map((option) => (
              <label className="rule-visual-selector-option" key={option.value}>
                <input
                  type="checkbox"
                  checked={selectedSelectors.includes(option.value)}
                  disabled={disabled}
                  onChange={(event) => onChange(setBalancerSelectorSelected(value, option.value, event.target.checked))}
                />
                <span className="rule-visual-selector-text">
                  <strong>{option.label}</strong>
                  <small>{option.kind}</small>
                </span>
              </label>
            ))}
          </div>
        ) : <p className="status">No outbound or balancer tags detected.</p>}
        <div className="rule-visual-selector-custom">
          <input
            value={customSelector}
            disabled={disabled}
            placeholder="Custom tag or selector prefix"
            aria-label="Custom balancer selector"
            onChange={(event) => setCustomSelector(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustomSelector();
              }
            }}
          />
          <button type="button" className="ghost small" disabled={disabled || !customSelector.trim()} onClick={addCustomSelector}>Add selector</button>
        </div>
      </fieldset>
      <fieldset className="rule-visual-selector-group rule-visual-fallback-group">
        <legend>Fallback tag</legend>
        <p className="group-meta">Optional and unique. Check one tag; check the active tag again to clear it.</p>
        {candidates.length ? (
          <div className="rule-visual-selector-options">
            {candidates.map((option) => (
              <label className="rule-visual-selector-option" key={`fallback:${option.value}`}>
                <input
                  type="checkbox"
                  checked={fallbackTag === option.value}
                  disabled={disabled}
                  onChange={(event) => onChange(setBalancerFallbackTag(value, event.target.checked ? option.value : ''))}
                />
                <span className="rule-visual-selector-text">
                  <strong>{option.label}</strong>
                  <small>{option.kind}</small>
                </span>
              </label>
            ))}
          </div>
        ) : <p className="status">No outbound or balancer tags detected.</p>}
        <div className="rule-visual-selector-custom">
          <input
            value={customFallback}
            disabled={disabled}
            placeholder="Custom fallback tag"
            aria-label="Custom balancer fallback tag"
            onChange={(event) => setCustomFallback(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                setCustomFallbackTag();
              }
            }}
          />
          <button type="button" className="ghost small" disabled={disabled || !customFallback.trim() || customFallback.trim() === ownTag} onClick={setCustomFallbackTag}>Set fallback</button>
        </div>
      </fieldset>
    </section>
  );
}

/**
 * Visual-first editor for a single routing or firewall rule. `value` and the
 * value passed to `onChange` are objects; the component never discards fields
 * that it does not control. JSON is intentionally contained in Advanced mode.
 */
export function RuleVisualEditor({ target, value, onChange, onValidationChange, selectorOptions = [], disabled = false }) {
  const rule = asRuleRecord(value);
  const [mode, setMode] = useState('visual');
  const [advancedText, setAdvancedText] = useState(() => formatRuleEditorJson(rule));
  const [advancedError, setAdvancedError] = useState('');
  const isFirewall = target === 'firewallRule' || target === 'firewall';
  const isBalancer = target === 'balancer';
  const update = (next) => {
    onValidationChange?.('');
    onChange?.(next);
  };

  useEffect(() => {
    if (mode === 'advanced') return;
    setAdvancedText(formatRuleEditorJson(rule));
  }, [value, mode]);

  const modeDescription = useMemo(() => (
    isFirewall
      ? 'Edit matching conditions and firewall action visually. Advanced JSON retains every unsupported field.'
      : isBalancer
        ? 'Edit balancer selection visually. Advanced JSON retains every unsupported field.'
        : 'Edit routing matches and destination visually. Advanced JSON retains every unsupported field.'
  ), [isFirewall, isBalancer]);

  return (
    <div className="rule-visual-editor" data-target={isFirewall ? 'firewall' : isBalancer ? 'balancer' : 'routing'}>
      <div className="rule-visual-toolbar">
        <div>
          <strong>{mode === 'visual' ? 'Visual editor' : 'Advanced JSON'}</strong>
          <small>{modeDescription}</small>
        </div>
        <div className="rule-visual-mode-switch" role="group" aria-label="Rule editor mode">
          <button type="button" className={mode === 'visual' ? 'active' : ''} onClick={() => { setAdvancedError(''); onValidationChange?.(''); setMode('visual'); }} disabled={disabled}>Visual</button>
          <button type="button" className={mode === 'advanced' ? 'active' : ''} onClick={() => { const error = validateRuleEditorValue(rule, target); setAdvancedText(formatRuleEditorJson(rule)); setAdvancedError(error); onValidationChange?.(error); setMode('advanced'); }} disabled={disabled}>Advanced JSON</button>
        </div>
      </div>
      {mode === 'advanced' ? (
        <div className="rules-modal-editor rule-visual-advanced-editor">
          <CodeMirror
            value={advancedText}
            minHeight="300px"
            theme={githubLight}
            extensions={JSON_EDITOR_EXTENSIONS}
            editable={!disabled}
            aria-label="Advanced rule JSON"
            onChange={(text) => {
              setAdvancedText(text);
              const parsed = parseRuleEditorJson(text);
              const validationError = parsed.error ? '' : validateRuleEditorValue(parsed.value, target);
              const error = parsed.error || validationError;
              setAdvancedError(error);
              onValidationChange?.(error);
              if (!parsed.error) onChange?.(parsed.value);
            }}
          />
          {advancedError ? <p className="rule-visual-error" role="alert">{advancedError}</p> : <p className="rule-visual-valid">JSON is valid. Changes are applied to the visual rule.</p>}
        </div>
      ) : (
        <div className="rule-visual-body">
          {isBalancer ? <BalancerOptions value={rule} onChange={update} disabled={disabled} selectorOptions={selectorOptions} /> : <>
            <section className="rule-visual-section">
              <TextField label="Rule type" value={valueToText(rule.type)} placeholder="field" disabled={disabled} onChange={(text) => update(patchRuleText(rule, 'type', text))} />
              <TextField label="Rule tag" value={valueToText(rule.ruleTag)} disabled={disabled} onChange={(text) => update(patchRuleText(rule, 'ruleTag', text))} />
              <MatchFields value={rule} onChange={update} disabled={disabled} />
            </section>
            {isFirewall ? <FirewallOptions value={rule} onChange={update} disabled={disabled} onValidationChange={onValidationChange} /> : (
            <section className="rule-visual-section rule-visual-destination">
              <div className="rule-visual-fields">
                <TextField label="Destination tag (preferred)" value={getDestinationTag(rule)} disabled={disabled} onChange={(text) => update(patchRuleDestination(rule, text))} />
                <TextField label="Destination VLESS route" value={getDestinationVlessRoute(rule)} disabled={disabled} onChange={(text) => update(patchRuleDestination(rule, getDestinationTag(rule), text))} />
                <TextField label="Outbound tag" value={valueToText(rule.outboundTag)} disabled={disabled} onChange={(text) => update(patchRuleText(rule, 'outboundTag', text))} />
                <TextField label="Balancer tag" value={valueToText(rule.balancerTag)} disabled={disabled} onChange={(text) => update(patchRuleText(rule, 'balancerTag', text))} />
              </div>
              <label className="rule-visual-check">
                <input type="checkbox" checked={Boolean(rule.reLookup)} disabled={disabled} onChange={(event) => update(patchRuleValue(rule, 'reLookup', event.target.checked || undefined))} />
                Re-lookup after route selection
              </label>
            </section>
            )}
          </>}
        </div>
      )}
    </div>
  );
}

export default RuleVisualEditor;
