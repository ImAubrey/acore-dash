import { useCallback, useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { githubLight } from '@uiw/codemirror-theme-github';
import {
  BLACKHOLE_RESPONSE_TYPES,
  COMMON_OUTBOUND_FIELDS,
  MUX_FIELDS,
  OUTBOUND_PROTOCOLS,
  PROXY_FIELDS,
  STREAM_FIELD_GROUPS,
  appendOutboundArrayItem,
  blackholeResponseToArray,
  blackholeResponseToLegacy,
  coerceOutboundFieldValue,
  formatOutboundFieldValue,
  formatOutboundValue,
  getLegacyEndpointArrayPath,
  getPathValue,
  getProtocolGroups,
  isSupportedOutboundProtocol,
  parseOutboundValue,
  removeOutboundArrayItem,
  setPathValue,
  updateOutboundArrayItem,
  updateOutboundField,
  validateBlackholeResponseArray
} from './outboundVisualHelpers';
import { getEditorModePreference, setEditorModePreference } from '../../dashboardShared';

const ADVANCED_EXTENSIONS = [
  json(),
  lintGutter(),
  linter(jsonParseLinter()),
  EditorView.lineWrapping
];

const toProtocol = (value) => String(value || '').trim().toLowerCase();

const hasValue = (value) => value !== undefined && value !== null;

const FieldControl = ({ outbound, field, onUpdate, disabled, idPrefix = '' }) => {
  const value = getPathValue(outbound, field.path);
  const type = field.type || 'text';
  const id = `outbound-field-${idPrefix}${field.path.join('-')}`;
  const clear = () => onUpdate(field, undefined, { coerced: true });

  let control;
  if (type === 'boolean') {
    control = (
      <label className="outbound-visual-check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onUpdate(field, event.target.checked)}
        />
        <span>{value === true ? 'Enabled' : 'Disabled'}</span>
      </label>
    );
  } else if (type === 'select') {
    const current = formatOutboundFieldValue(value, type);
    const options = Array.isArray(field.options) ? field.options : [];
    const includesCurrent = !current || options.includes(current);
    control = (
      <select
        id={id}
        value={current}
        disabled={disabled}
        onChange={(event) => onUpdate(field, event.target.value)}
      >
        <option value="">Not set</option>
        {!includesCurrent ? <option value={current}>{current}</option> : null}
        {options.filter(Boolean).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  } else if (type === 'list' || type === 'integerList') {
    control = (
      <textarea
        id={id}
        rows={3}
        value={formatOutboundFieldValue(value, type)}
        placeholder={field.placeholder || 'One value per line'}
        disabled={disabled}
        onChange={(event) => onUpdate(field, event.target.value)}
      />
    );
  } else {
    control = (
      <input
        id={id}
        type={type === 'integer' ? 'number' : type}
        value={formatOutboundFieldValue(value, type)}
        min={field.min}
        max={field.max}
        placeholder={field.placeholder || ''}
        disabled={disabled}
        autoComplete={type === 'password' ? 'new-password' : field.autocomplete}
        spellCheck={type === 'password' ? false : undefined}
        onChange={(event) => onUpdate(field, event.target.value)}
      />
    );
  }

  return (
    <div className={`outbound-visual-field outbound-visual-field-${type}`}>
      <div className="outbound-visual-field-label">
        <label htmlFor={id}>{field.label}</label>
        {hasValue(value) ? (
          <button className="ghost small" type="button" onClick={clear} disabled={disabled}>
            Clear
          </button>
        ) : null}
      </div>
      {control}
    </div>
  );
};

const blackholeResponseFields = (type) => {
  const normalized = String(type || '').trim().toLowerCase();
  const fields = [{ path: ['type'], label: 'Response type', type: 'select', options: BLACKHOLE_RESPONSE_TYPES }];
  if (normalized === 'http-301' || normalized === 'http-302') {
    fields.push({ path: ['redirect_url'], label: 'Redirect URL', placeholder: 'https://example.com/' });
  }
  if (normalized === 'icmp' || normalized.startsWith('icmp-') || normalized === 'echo-request') {
    fields.push(
      { path: ['icmp'], label: 'ICMP request', type: 'select', options: ['echo-request'] },
      { path: ['delay'], label: 'Response delay', placeholder: '1ms, 1s, 500us' }
    );
  }
  return fields;
};

const BlackholeResponseEditor = ({ outbound, commit, disabled }) => {
  const response = getPathValue(outbound, ['settings', 'response']);
  const arrayMode = Array.isArray(response);
  const commitResponse = (nextResponse) => commit(setPathValue(outbound, ['settings', 'response'], nextResponse));

  if (!arrayMode) {
    return (
      <fieldset className="outbound-visual-group outbound-blackhole-response">
        <legend>Response</legend>
        <div className="outbound-visual-grid">
          {blackholeResponseFields(response?.type).map((field) => (
            <FieldControl
              key={field.path.join('.')}
              outbound={response || {}}
              field={field}
              onUpdate={(selectedField, rawValue, options = {}) => {
                const nextValue = options.coerced
                  ? rawValue
                  : coerceOutboundFieldValue(rawValue, selectedField.type);
                commitResponse(setPathValue(response || {}, selectedField.path, nextValue));
              }}
              disabled={disabled}
              idPrefix="blackhole-single-"
            />
          ))}
        </div>
        <div className="outbound-blackhole-response-actions">
          <button
            className="ghost small"
            type="button"
            disabled={disabled}
            onClick={() => commitResponse(blackholeResponseToArray(response))}
          >
            Use protocol response array
          </button>
          <span>Single-object mode remains compatible with existing configurations.</span>
        </div>
      </fieldset>
    );
  }

  const error = validateBlackholeResponseArray(response);

  const updateEntry = (index, field, rawValue, options = {}) => {
    const nextValue = options.coerced ? rawValue : coerceOutboundFieldValue(rawValue, field.type);
    const next = response.map((entry, currentIndex) => currentIndex === index
      ? setPathValue(entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {}, field.path, nextValue)
      : entry);
    commitResponse(next);
  };

  return (
    <fieldset className="outbound-visual-group outbound-blackhole-response">
      <legend>Protocol responses</legend>
      <p className="group-meta">Application protocol matches first; tcp, udp, and icmp act as network fallbacks.</p>
      {response.map((entry, index) => (
        <div className="outbound-visual-array-row outbound-blackhole-response-row" key={`${entry?.proto || 'response'}-${index}`}>
          <FieldControl
            outbound={entry || {}}
            field={{ path: ['proto'], label: 'Proto', placeholder: 'http, tls, tcp, udp, or icmp' }}
            onUpdate={(field, rawValue, options) => updateEntry(index, field, rawValue, options)}
            disabled={disabled}
            idPrefix={`blackhole-${index}-`}
          />
          {blackholeResponseFields(entry?.type).map((field) => (
            <FieldControl
              key={field.path.join('.')}
              outbound={entry || {}}
              field={field}
              onUpdate={(selectedField, rawValue, options) => updateEntry(index, selectedField, rawValue, options)}
              disabled={disabled}
              idPrefix={`blackhole-${index}-`}
            />
          ))}
          <button
            className="ghost small danger"
            type="button"
            disabled={disabled || response.length === 1}
            onClick={() => commitResponse(response.filter((_, currentIndex) => currentIndex !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      {error ? <div className="status status-danger" role="alert">{error}</div> : null}
      <div className="outbound-blackhole-response-actions">
        <button
          className="ghost small"
          type="button"
          disabled={disabled}
          onClick={() => commitResponse([...response, { proto: '', type: 'none' }])}
        >
          Add protocol response
        </button>
        <button
          className="ghost small"
          type="button"
          disabled={disabled || response.length !== 1}
          title={response.length !== 1 ? 'Remove responses until one remains before returning to single-object mode.' : ''}
          onClick={() => commitResponse(blackholeResponseToLegacy(response))}
        >
          Use single response
        </button>
      </div>
    </fieldset>
  );
};

const FieldGroup = ({ title, fields, outbound, onUpdate, disabled }) => (
  <fieldset className="outbound-visual-group">
    <legend>{title}</legend>
    <div className="outbound-visual-grid">
      {fields.map((field) => (
        <FieldControl
          key={field.path.join('.')}
          outbound={outbound}
          field={field}
          onUpdate={onUpdate}
          disabled={disabled}
        />
      ))}
    </div>
  </fieldset>
);

const SendThroughEditor = ({ outbound, commit, disabled }) => {
  const value = outbound.sendThrough;
  if (!Array.isArray(value)) {
    return (
      <fieldset className="outbound-visual-group">
        <legend>Source address</legend>
        <div className="outbound-visual-grid">
          <FieldControl
            outbound={outbound}
            field={{ path: ['sendThrough'], label: 'Send through', placeholder: '0.0.0.0, origin, srcip, or CIDR' }}
            onUpdate={(field, rawValue, options) => {
              const nextValue = options?.coerced ? rawValue : coerceOutboundFieldValue(rawValue, field.type);
              commit(setPathValue(outbound, field.path, nextValue));
            }}
            disabled={disabled}
          />
        </div>
      </fieldset>
    );
  }

  const updateEntry = (index, key, rawValue) => {
    commit(updateOutboundArrayItem(outbound, ['sendThrough'], index, [key], rawValue || undefined));
  };

  return (
    <fieldset className="outbound-visual-group outbound-send-through-list">
      <legend>Grouped source addresses</legend>
      <p className="group-meta">Each source can expose a derived outbound tag with IPv4 and IPv6 bindings.</p>
      {value.map((entry, index) => (
        <div className="outbound-visual-array-row" key={`${entry?.tag || 'source'}-${index}`}>
          <label>
            <span>Tag</span>
            <input
              value={String(entry?.tag || '')}
              disabled={disabled}
              onChange={(event) => updateEntry(index, 'tag', event.target.value)}
            />
          </label>
          <label>
            <span>IPv4 / source</span>
            <input
              value={String(entry?.v4 || '')}
              disabled={disabled}
              onChange={(event) => updateEntry(index, 'v4', event.target.value)}
            />
          </label>
          <label>
            <span>IPv6</span>
            <input
              value={String(entry?.v6 || '')}
              disabled={disabled}
              onChange={(event) => updateEntry(index, 'v6', event.target.value)}
            />
          </label>
          <button
            className="ghost small"
            type="button"
            disabled={disabled}
            onClick={() => commit(removeOutboundArrayItem(outbound, ['sendThrough'], index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        className="ghost small"
        type="button"
        disabled={disabled}
        onClick={() => commit(appendOutboundArrayItem(outbound, ['sendThrough'], { tag: '', v4: '', v6: '' }))}
      >
        Add source
      </button>
    </fieldset>
  );
};

const userFieldsForProtocol = (protocol) => {
  if (protocol === 'vmess') {
    return [
      { key: 'id', label: 'User ID / UUID' },
      { key: 'security', label: 'Security' },
      { key: 'alterId', label: 'Alter ID', type: 'integer' },
      { key: 'level', label: 'Level', type: 'integer' }
    ];
  }
  if (protocol === 'vless') {
    return [
      { key: 'id', label: 'User ID / UUID' },
      { key: 'encryption', label: 'Encryption' },
      { key: 'flow', label: 'Flow' },
      { key: 'level', label: 'Level', type: 'integer' }
    ];
  }
  return [
    { key: 'user', label: 'Username' },
    { key: 'pass', label: 'Password', type: 'password' },
    { key: 'level', label: 'Level', type: 'integer' }
  ];
};

const serverFieldsForProtocol = (protocol) => {
  if (protocol === 'trojan') {
    return [
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'email', label: 'Email' },
      { key: 'level', label: 'Level', type: 'integer' }
    ];
  }
  if (protocol === 'shadowsocks') {
    return [
      { key: 'method', label: 'Method' },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'email', label: 'Email' },
      { key: 'level', label: 'Level', type: 'integer' },
      { key: 'uot', label: 'UDP over TCP', type: 'boolean' },
      { key: 'uotVersion', label: 'UoT version', type: 'integer' }
    ];
  }
  return [];
};

const ArrayScalarInput = ({ field, value, onChange, disabled }) => {
  if (field.type === 'boolean') {
    return (
      <label className="outbound-visual-check">
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    );
  }
  return (
    <label>
      <span>{field.label}</span>
      <input
        type={field.type === 'password' ? 'password' : field.type === 'integer' ? 'number' : 'text'}
        value={value === undefined || value === null ? '' : String(value)}
        disabled={disabled}
        autoComplete={field.type === 'password' ? 'new-password' : undefined}
        spellCheck={field.type === 'password' ? false : undefined}
        onChange={(event) => onChange(
          field.type === 'integer'
            ? coerceOutboundFieldValue(event.target.value, 'integer')
            : event.target.value || undefined
        )}
      />
    </label>
  );
};

const LegacyEndpointEditor = ({ outbound, protocol, arrayPath, commit, disabled }) => {
  const endpoints = getPathValue(outbound, arrayPath);
  if (!Array.isArray(endpoints)) return null;
  const usesUsers = protocol === 'vmess' || protocol === 'vless' || protocol === 'socks' || protocol === 'http';
  const updateEndpoint = (endpointIndex, path, value) => {
    commit(updateOutboundArrayItem(outbound, arrayPath, endpointIndex, path, value));
  };

  const updateUser = (endpointIndex, userIndex, field, value) => {
    const endpoint = endpoints[endpointIndex] && typeof endpoints[endpointIndex] === 'object'
      ? endpoints[endpointIndex]
      : {};
    const users = Array.isArray(endpoint.users) ? [...endpoint.users] : [];
    const user = users[userIndex] && typeof users[userIndex] === 'object' ? users[userIndex] : {};
    users[userIndex] = setPathValue(user, [field.key], value);
    updateEndpoint(endpointIndex, ['users'], users);
  };

  const addUser = (endpointIndex) => {
    const endpoint = endpoints[endpointIndex] && typeof endpoints[endpointIndex] === 'object'
      ? endpoints[endpointIndex]
      : {};
    const users = Array.isArray(endpoint.users) ? [...endpoint.users] : [];
    users.push(protocol === 'vless'
      ? { id: '', encryption: 'none' }
      : protocol === 'vmess'
        ? { id: '', security: 'auto' }
        : { user: '', pass: '' });
    updateEndpoint(endpointIndex, ['users'], users);
  };

  const removeUser = (endpointIndex, userIndex) => {
    const endpoint = endpoints[endpointIndex] && typeof endpoints[endpointIndex] === 'object'
      ? endpoints[endpointIndex]
      : {};
    const users = Array.isArray(endpoint.users) ? endpoint.users : [];
    updateEndpoint(endpointIndex, ['users'], users.filter((_user, index) => index !== userIndex));
  };

  const newEndpoint = () => {
    const endpoint = { address: '', port: 443 };
    if (usesUsers) endpoint.users = [];
    return endpoint;
  };

  return (
    <fieldset className="outbound-visual-group outbound-endpoint-list">
      <legend>{arrayPath[arrayPath.length - 1] === 'vnext' ? 'Proxy endpoints' : 'Servers'}</legend>
      <p className="group-meta">Legacy list shape detected; every unknown endpoint and user field is preserved.</p>
      {endpoints.map((endpoint, endpointIndex) => {
        const users = Array.isArray(endpoint?.users) ? endpoint.users : [];
        return (
          <div className="outbound-visual-endpoint" key={`${endpoint?.address || 'endpoint'}-${endpointIndex}`}>
            <div className="outbound-visual-array-row">
              <ArrayScalarInput
                field={{ key: 'address', label: 'Address' }}
                value={endpoint?.address}
                disabled={disabled}
                onChange={(value) => updateEndpoint(endpointIndex, ['address'], value)}
              />
              <ArrayScalarInput
                field={{ key: 'port', label: 'Port', type: 'integer' }}
                value={endpoint?.port}
                disabled={disabled}
                onChange={(value) => updateEndpoint(endpointIndex, ['port'], value)}
              />
              {serverFieldsForProtocol(protocol).map((field) => (
                <ArrayScalarInput
                  key={field.key}
                  field={field}
                  value={endpoint?.[field.key]}
                  disabled={disabled}
                  onChange={(value) => updateEndpoint(endpointIndex, [field.key], value)}
                />
              ))}
              <button
                className="ghost small"
                type="button"
                disabled={disabled}
                onClick={() => commit(removeOutboundArrayItem(outbound, arrayPath, endpointIndex))}
              >
                Remove endpoint
              </button>
            </div>
            {usesUsers ? (
              <div className="outbound-visual-users">
                {users.map((user, userIndex) => (
                  <div className="outbound-visual-array-row" key={`${user?.id || user?.user || 'user'}-${userIndex}`}>
                    {userFieldsForProtocol(protocol).map((field) => (
                      <ArrayScalarInput
                        key={field.key}
                        field={field}
                        value={user?.[field.key]}
                        disabled={disabled}
                        onChange={(value) => updateUser(endpointIndex, userIndex, field, value)}
                      />
                    ))}
                    <button
                      className="ghost small"
                      type="button"
                      disabled={disabled}
                      onClick={() => removeUser(endpointIndex, userIndex)}
                    >
                      Remove user
                    </button>
                  </div>
                ))}
                <button className="ghost small" type="button" disabled={disabled} onClick={() => addUser(endpointIndex)}>
                  Add user
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      <button
        className="ghost small"
        type="button"
        disabled={disabled}
        onClick={() => commit(appendOutboundArrayItem(outbound, arrayPath, newEndpoint()))}
      >
        Add endpoint
      </button>
    </fieldset>
  );
};

const WireGuardPeersEditor = ({ outbound, commit, disabled }) => {
  const path = ['settings', 'peers'];
  const peers = getPathValue(outbound, path);
  const list = Array.isArray(peers) ? peers : [];
  const fields = [
    { key: 'endpoint', label: 'Endpoint' },
    { key: 'publicKey', label: 'Public key' },
    { key: 'preSharedKey', label: 'Pre-shared key', type: 'password' },
    { key: 'keepAlive', label: 'Keepalive (s)', type: 'integer' }
  ];
  return (
    <fieldset className="outbound-visual-group outbound-wireguard-peers">
      <legend>WireGuard peers</legend>
      {list.map((peer, index) => (
        <div className="outbound-visual-array-row" key={`${peer?.endpoint || 'peer'}-${index}`}>
          {fields.map((field) => (
            <ArrayScalarInput
              key={field.key}
              field={field}
              value={peer?.[field.key]}
              disabled={disabled}
              onChange={(value) => commit(updateOutboundArrayItem(outbound, path, index, [field.key], value))}
            />
          ))}
          <label>
            <span>Allowed IPs</span>
            <textarea
              rows={2}
              value={formatOutboundFieldValue(peer?.allowedIPs, 'list')}
              disabled={disabled}
              onChange={(event) => commit(updateOutboundArrayItem(
                outbound,
                path,
                index,
                ['allowedIPs'],
                coerceOutboundFieldValue(event.target.value, 'list')
              ))}
            />
          </label>
          <button
            className="ghost small"
            type="button"
            disabled={disabled}
            onClick={() => commit(removeOutboundArrayItem(outbound, path, index))}
          >
            Remove peer
          </button>
        </div>
      ))}
      <button
        className="ghost small"
        type="button"
        disabled={disabled}
        onClick={() => commit(appendOutboundArrayItem(outbound, path, {
          endpoint: '',
          publicKey: '',
          allowedIPs: ['0.0.0.0/0', '::/0']
        }))}
      >
        Add peer
      </button>
    </fieldset>
  );
};

const HeadersEditor = ({ outbound, commit, disabled }) => {
  const path = ['settings', 'headers'];
  const headers = getPathValue(outbound, path);
  const entries = headers && typeof headers === 'object' && !Array.isArray(headers)
    ? Object.entries(headers)
    : [];
  const updateHeader = (key, nextKey, nextValue) => {
    const next = { ...(headers || {}) };
    delete next[key];
    if (nextKey) {
      Object.defineProperty(next, nextKey, {
        value: nextValue,
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    commit(setPathValue(outbound, path, next));
  };
  return (
    <fieldset className="outbound-visual-group outbound-http-headers">
      <legend>HTTP headers</legend>
      {entries.map(([key, rawValue], index) => {
        const value = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue) ?? '';
        return (
          <div className="outbound-visual-array-row" key={`header-${index}`}>
            <label>
              <span>Name</span>
              <input
                value={key}
                disabled={disabled}
                onChange={(event) => updateHeader(key, event.target.value, value)}
              />
            </label>
            <label>
              <span>Value</span>
              <input
                value={value}
                disabled={disabled}
                onChange={(event) => updateHeader(key, key, event.target.value)}
              />
            </label>
            <button className="ghost small" type="button" disabled={disabled} onClick={() => updateHeader(key, '', '')}>
              Remove
            </button>
          </div>
        );
      })}
      <button
        className="ghost small"
        type="button"
        disabled={disabled}
        onClick={() => {
          let suffix = 1;
          let key = 'X-Header';
          while (headers && Object.prototype.hasOwnProperty.call(headers, key)) {
            suffix += 1;
            key = `X-Header-${suffix}`;
          }
          commit(setPathValue(outbound, path, { ...(headers || {}), [key]: '' }));
        }}
      >
        Add header
      </button>
    </fieldset>
  );
};

export function OutboundVisualEditor({ value, onChange, disabled = false }) {
  const [mode, setMode] = useState(() => getEditorModePreference('outbound', 'advanced'));
  const parsed = useMemo(() => parseOutboundValue(value), [value]);
  const outbound = parsed.outbound;
  const protocol = toProtocol(outbound?.protocol);
  const protocolSupported = isSupportedOutboundProtocol(protocol);
  const protocolOptions = OUTBOUND_PROTOCOLS.includes(protocol)
    ? OUTBOUND_PROTOCOLS
    : protocol
      ? [...OUTBOUND_PROTOCOLS, protocol]
      : OUTBOUND_PROTOCOLS;
  const endpointArrayPath = outbound ? getLegacyEndpointArrayPath(outbound, protocol) : null;
  const protocolGroups = endpointArrayPath ? [] : getProtocolGroups(protocol);

  useEffect(() => {
    if (parsed.error) {
      setEditorModePreference('outbound', 'advanced');
      setMode('advanced');
    }
  }, [parsed.error]);

  const commit = useCallback((nextOutbound) => {
    if (disabled || typeof onChange !== 'function') return;
    onChange(formatOutboundValue(nextOutbound));
  }, [disabled, onChange]);

  const updateField = useCallback((field, rawValue, options = {}) => {
    if (!outbound) return;
    if (options.coerced) {
      commit(setPathValue(outbound, field.path, rawValue));
      return;
    }
    commit(updateOutboundField(outbound, field, rawValue));
  }, [commit, outbound]);

  const renderVisual = () => {
    if (!outbound) {
      return (
        <div className="empty-state small">
          <strong>Visual editor unavailable</strong>
          <span>Fix the JSON error in Advanced mode first.</span>
        </div>
      );
    }
    return (
      <div className="outbound-visual-form">
        <fieldset className="outbound-visual-group outbound-identity-group">
          <legend>Identity</legend>
          <div className="outbound-visual-grid">
            <FieldControl
              outbound={outbound}
              field={COMMON_OUTBOUND_FIELDS[0]}
              onUpdate={updateField}
              disabled={disabled}
            />
            <div className="outbound-visual-field outbound-visual-field-select">
              <div className="outbound-visual-field-label"><label htmlFor="outbound-protocol">Protocol</label></div>
              <select
                id="outbound-protocol"
                value={protocol}
                disabled={disabled}
                onChange={(event) => commit(setPathValue(outbound, ['protocol'], event.target.value || undefined))}
              >
                <option value="">Select protocol</option>
                {protocolOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            {protocolSupported ? COMMON_OUTBOUND_FIELDS.slice(1).map((field) => (
              <FieldControl
                key={field.path.join('.')}
                outbound={outbound}
                field={field}
                onUpdate={updateField}
                disabled={disabled}
              />
            )) : null}
          </div>
        </fieldset>

        {!protocolSupported ? (
          <div className="empty-state small outbound-unsupported-protocol" role="status">
            <strong>{protocol ? `Unsupported protocol: ${protocol}` : 'Select a supported protocol'}</strong>
            <span>Protocol parameters are hidden. Existing settings remain unchanged and are available in Advanced JSON.</span>
          </div>
        ) : (
          <>
        <SendThroughEditor outbound={outbound} commit={commit} disabled={disabled} />

        {protocol === 'blackhole' || protocol === 'block' ? (
          <BlackholeResponseEditor outbound={outbound} commit={commit} disabled={disabled} />
        ) : endpointArrayPath ? (
          <LegacyEndpointEditor
            outbound={outbound}
            protocol={protocol}
            arrayPath={endpointArrayPath}
            commit={commit}
            disabled={disabled}
          />
        ) : protocolGroups.length > 0 ? (
          protocolGroups.map((group) => (
            <FieldGroup
              key={group.title}
              title={group.title}
              fields={group.fields}
              outbound={outbound}
              onUpdate={updateField}
              disabled={disabled}
            />
          ))
        ) : (
          <div className="empty-state small">
            <strong>No protocol-specific visual fields for {protocol || 'this protocol'}.</strong>
            <span>Common fields remain editable; use Advanced for protocol-specific JSON.</span>
          </div>
        )}

        {protocol === 'http' && !endpointArrayPath ? (
          <HeadersEditor outbound={outbound} commit={commit} disabled={disabled} />
        ) : null}
        {protocol === 'wireguard' ? (
          <WireGuardPeersEditor outbound={outbound} commit={commit} disabled={disabled} />
        ) : null}

        <FieldGroup title="Outbound proxy" fields={PROXY_FIELDS} outbound={outbound} onUpdate={updateField} disabled={disabled} />
        <FieldGroup title="Multiplexing" fields={MUX_FIELDS} outbound={outbound} onUpdate={updateField} disabled={disabled} />

        {protocol === 'wireguard' ? (
          <div className="connections-header-note">WireGuard does not use streamSettings; any existing value is preserved.</div>
        ) : STREAM_FIELD_GROUPS.map((group) => (
          <FieldGroup
            key={group.title}
            title={group.title}
            fields={group.fields}
            outbound={outbound}
            onUpdate={updateField}
            disabled={disabled}
          />
        ))}

        <div className="connections-header-note">
          Fields not shown here are preserved unchanged. Use Advanced to edit uncommon or extension fields.
        </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="outbound-visual-editor">
      <div className="outbound-editor-mode-switch" role="group" aria-label="Outbound editor mode">
        <button
          className={mode === 'visual' ? 'primary small' : 'ghost small'}
          type="button"
          aria-pressed={mode === 'visual'}
          disabled={Boolean(parsed.error)}
          onClick={() => { setEditorModePreference('outbound', 'visual'); setMode('visual'); }}
        >
          Visual
        </button>
        <button
          className={mode === 'advanced' ? 'primary small' : 'ghost small'}
          type="button"
          aria-pressed={mode === 'advanced'}
          onClick={() => { setEditorModePreference('outbound', 'advanced'); setMode('advanced'); }}
        >
          Advanced JSON
        </button>
      </div>

      {mode === 'visual' ? renderVisual() : (
        <div className="outbound-advanced-editor">
          <CodeMirror
            value={typeof value === 'string' ? value : parsed.text}
            minHeight="320px"
            theme={githubLight}
            extensions={ADVANCED_EXTENSIONS}
            editable={!disabled}
            onChange={(nextValue) => {
              if (!disabled && typeof onChange === 'function') onChange(nextValue);
            }}
            aria-label="Advanced outbound JSON"
          />
          {parsed.error ? <div className="status status-danger" role="alert">{parsed.error}</div> : null}
        </div>
      )}
    </div>
  );
}
