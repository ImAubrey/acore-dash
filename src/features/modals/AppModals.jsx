import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { githubLight } from '@uiw/codemirror-theme-github';
import { getFirewallRuleList } from '../../dashboardShared';
import { ScrollArea } from '../common/ScrollArea';
import { TrashIcon } from '../connections/actionIcons';
import { OutboundVisualEditor } from '../nodes/OutboundVisualEditor';
import { RuleVisualEditor } from '../rules/RuleVisualEditor.jsx';
import { SubscriptionVisualEditor } from '../subscriptions/SubscriptionVisualEditor.jsx';

const INFO_MODAL_EDITOR_EXTENSIONS = [
  json(),
  EditorView.lineWrapping,
  EditorView.editable.of(false),
  EditorView.theme({
    '&.cm-focused .cm-cursor, & .cm-cursor': {
      display: 'none'
    },
    '& .cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'transparent'
    },
    '& .cm-activeLine, & .cm-activeLineGutter': {
      backgroundColor: 'transparent'
    }
  })
];

export function AppModals({
  rulesModalVisible,
  rulesModalClosing,
  rulesModalTarget,
  rulesModalMode,
  rulesModalIndex,
  rulesModalInsertAfter,
  setRulesModalInsertAfter,
  rulesModalText,
  setRulesModalText,
  rulesModalStatus,
  setRulesModalStatus,
  rulesModalSaving,
  closeRulesModal,
  formatRulesModalJson,
  saveRulesModal,
  configRules,
  configBalancers,
  configFirewall,
  configInbounds,
  configSubscriptionOutbounds,
  configSubscriptionDatabases,
  configOutbounds,
  runtimeOutbounds,
  getRuleLabel,
  getBalancerLabel,
  getFirewallRuleLabel,
  getInboundLabel,
  getSubscriptionLabel,
  getSubscriptionDatabaseLabel,
  getOutboundLabel,
  restartConfirmVisible,
  restartConfirmClosing,
  closeRestartConfirm,
  confirmRestart,
  restartConfirmBusy,
  deleteConfirmVisible,
  deleteConfirmClosing,
  deleteConfirmTarget,
  deleteConfirmLabel,
  closeDeleteConfirm,
  confirmDelete,
  deleteConfirmBusy,
  infoModalVisible,
  infoModalClosing,
  infoModalTitle,
  infoModalText,
  infoModalStatus,
  copyInfoModal,
  closeInfoModal
}) {
  const [rulesVisualError, setRulesVisualError] = useState('');
  useEffect(() => {
    setRulesVisualError('');
  }, [rulesModalVisible, rulesModalTarget, rulesModalIndex]);
  const infoModalEditor = useMemo(() => (
    <CodeMirror
      value={infoModalText}
      minHeight="360px"
      theme={githubLight}
      extensions={INFO_MODAL_EDITOR_EXTENSIONS}
      aria-label="Info JSON"
    />
  ), [infoModalText]);
  const parsedRulesModalValue = useMemo(() => {
    try {
      const value = JSON.parse(rulesModalText);
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { value: null, error: 'Configuration must be a JSON object.' };
      }
      return { value, error: '' };
    } catch (error) {
      return { value: null, error: `Invalid JSON: ${error.message}` };
    }
  }, [rulesModalText]);
  if (typeof document === 'undefined') return null;

  const renderRulesModal = () => {
    if (!rulesModalVisible) return null;
    const modalState = rulesModalClosing ? 'closing' : 'open';
    const modalTarget = rulesModalTarget;
    const modalItems = modalTarget === 'rule'
      ? configRules
      : modalTarget === 'balancer'
        ? configBalancers
        : modalTarget === 'firewallRule'
          ? getFirewallRuleList(configFirewall)
        : modalTarget === 'inbound'
          ? configInbounds
          : modalTarget === 'subscription'
            ? configSubscriptionOutbounds
            : modalTarget === 'subscriptionDatabase'
              ? configSubscriptionDatabases
              : configOutbounds;
    const modalLabel = modalTarget === 'rule'
      ? getRuleLabel
      : modalTarget === 'balancer'
        ? getBalancerLabel
        : modalTarget === 'firewallRule'
          ? getFirewallRuleLabel
        : modalTarget === 'inbound'
          ? getInboundLabel
          : modalTarget === 'subscription'
            ? getSubscriptionLabel
            : modalTarget === 'subscriptionDatabase'
              ? getSubscriptionDatabaseLabel
              : getOutboundLabel;
    const modalTitle = modalTarget === 'rule'
      ? 'rule'
      : modalTarget === 'balancer'
        ? 'balancer'
        : modalTarget === 'firewallRule'
          ? 'firewall rule'
        : modalTarget === 'inbound'
          ? 'inbound'
          : modalTarget === 'subscription'
            ? 'subscription outbound'
            : modalTarget === 'subscriptionDatabase'
              ? 'subscription database'
              : 'outbound';
    const usesRuleVisualEditor = modalTarget === 'rule'
      || modalTarget === 'firewallRule'
      || modalTarget === 'balancer';
    const usesSubscriptionVisualEditor = modalTarget === 'subscription'
      || modalTarget === 'subscriptionDatabase';
    const updateRulesModalText = (nextValue) => {
      setRulesModalText(typeof nextValue === 'string' ? nextValue : JSON.stringify(nextValue, null, 2));
      if (rulesModalStatus) setRulesModalStatus('');
    };
    const balancerSelectorOptions = modalTarget === 'balancer' ? [
      ...(Array.isArray(configOutbounds) ? configOutbounds : []).map((item) => ({
        value: String(item?.tag || '').trim(),
        label: String(item?.tag || '').trim(),
        kind: 'outbound'
      })),
      ...(Array.isArray(runtimeOutbounds) ? runtimeOutbounds : []).map((item) => ({
        value: String(item?.tag || '').trim(),
        label: String(item?.tag || '').trim(),
        kind: 'runtime outbound'
      })),
      ...(Array.isArray(configBalancers) ? configBalancers : []).map((item) => ({
        value: String(item?.tag || '').trim(),
        label: String(item?.tag || '').trim(),
        kind: 'balancer'
      }))
    ].filter((item) => item.value) : [];
    const editor = usesRuleVisualEditor && parsedRulesModalValue.value ? (
      <RuleVisualEditor
        key={`${modalTarget}:${rulesModalMode}:${rulesModalIndex}`}
        target={modalTarget}
        value={parsedRulesModalValue.value}
        disabled={rulesModalSaving}
        onChange={updateRulesModalText}
        onValidationChange={setRulesVisualError}
        selectorOptions={balancerSelectorOptions}
      />
    ) : modalTarget === 'outbound' ? (
      <OutboundVisualEditor
        value={rulesModalText}
        disabled={rulesModalSaving}
        onChange={updateRulesModalText}
      />
    ) : usesSubscriptionVisualEditor ? (
      <SubscriptionVisualEditor
        target={modalTarget}
        value={rulesModalText}
        disabled={rulesModalSaving}
        onChange={updateRulesModalText}
      />
    ) : (
      <div className="rules-modal-editor">
        <CodeMirror
          value={rulesModalText}
          minHeight="300px"
          theme={githubLight}
          extensions={[json(), lintGutter(), linter(jsonParseLinter()), EditorView.lineWrapping]}
          onChange={updateRulesModalText}
          aria-label={usesRuleVisualEditor ? 'Repair invalid JSON' : 'Edit JSON'}
        />
        {usesRuleVisualEditor && parsedRulesModalValue.error ? (
          <p className="rule-visual-error" role="alert">
            {parsedRulesModalValue.error} Fix it here to return to the visual editor.
          </p>
        ) : null}
      </div>
    );
    return createPortal(
      <div className="modal-backdrop rules-modal-backdrop" role="dialog" aria-modal="true" data-state={modalState}>
        <div className="modal rules-modal" data-state={modalState}>
          <div className="modal-header modal-fixed-header">
            <div>
              <h3>
                {rulesModalMode === 'edit'
                  ? `Edit ${modalTitle} #${rulesModalIndex + 1}`
                  : `Insert new ${modalTitle}`}
              </h3>
              <p className="group-meta">
                {rulesModalMode === 'edit'
                  ? `Update this ${modalTitle} and choose where to place it. JSON remains available under Advanced.`
                  : 'Complete the visual form, then choose where to insert it. JSON remains available under Advanced.'}
              </p>
            </div>
            <button className="ghost small" onClick={closeRulesModal}>Close</button>
          </div>
          <ScrollArea className="modal-body-scroll" contentClassName="modal-body-content" ariaLabel={`${modalTitle} editor`}>
            {rulesModalMode === 'insert' || rulesModalMode === 'edit' ? (
              <div className="rules-modal-row">
                <label className="rules-modal-label" htmlFor="rules-insert-position">Position</label>
                <select
                  id="rules-insert-position"
                  value={rulesModalInsertAfter}
                  onChange={(event) => setRulesModalInsertAfter(Number(event.target.value))}
                >
                  <option value={-1}>Top</option>
                  {modalItems.map((item, index) => (
                    <option key={`after-${index}`} value={index}>
                      {`After ${modalLabel(item, index)}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="rules-modal-editor-host">{editor}</div>
          </ScrollArea>
          <div className="rules-modal-footer modal-fixed-footer">
            <span className="status">{rulesModalStatus}</span>
            <div className="confirm-actions">
              <button className="ghost small" onClick={formatRulesModalJson} disabled={rulesModalSaving}>
                Format
              </button>
              <button className="ghost small" onClick={closeRulesModal} disabled={rulesModalSaving}>
                Cancel
              </button>
              <button className="primary small" onClick={saveRulesModal} disabled={rulesModalSaving || Boolean(rulesVisualError)}>
                {rulesModalSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderRestartConfirm = () => {
    if (!restartConfirmVisible) return null;
    const modalState = restartConfirmClosing ? 'closing' : 'open';
    return createPortal(
      <div className="modal-backdrop" role="dialog" aria-modal="true" data-state={modalState}>
        <div className="modal confirm-modal" data-state={modalState}>
          <div className="modal-header modal-fixed-header">
            <div>
              <h3>Restart core?</h3>
            </div>
            <button className="ghost small" onClick={closeRestartConfirm}>Close</button>
          </div>
          <ScrollArea className="modal-body-scroll" contentClassName="modal-body-content" ariaLabel="Restart confirmation">
            <p className="group-meta">
              This will restart the Acore core. Pending routing edits will be uploaded first.
            </p>
          </ScrollArea>
          <div className="confirm-actions modal-fixed-footer">
            <button className="ghost small" onClick={closeRestartConfirm}>Cancel</button>
            <button className="danger small" onClick={confirmRestart} disabled={restartConfirmBusy}>
              Restart core
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderDeleteConfirm = () => {
    if (!deleteConfirmVisible) return null;
    const modalState = deleteConfirmClosing ? 'closing' : 'open';
    const targetLabel = deleteConfirmTarget === 'rule'
      ? 'routing rule'
      : deleteConfirmTarget === 'balancer'
        ? 'balancer'
        : deleteConfirmTarget === 'firewallRule'
          ? 'firewall rule'
        : deleteConfirmTarget === 'inbound'
          ? 'inbound'
          : deleteConfirmTarget === 'subscription'
            ? 'subscription outbound'
            : deleteConfirmTarget === 'subscriptionDatabase'
              ? 'subscription database'
              : 'outbound';
    const titleLabel = deleteConfirmLabel || targetLabel;
    return createPortal(
      <div className="modal-backdrop" role="dialog" aria-modal="true" data-state={modalState}>
        <div className="modal confirm-modal" data-state={modalState}>
          <div className="modal-header modal-fixed-header">
            <div>
              <h3>{`Delete ${titleLabel}?`}</h3>
            </div>
            <button className="ghost small" onClick={closeDeleteConfirm}>Close</button>
          </div>
          <ScrollArea className="modal-body-scroll" contentClassName="modal-body-content" ariaLabel="Delete confirmation">
            <p className="group-meta">
              {`This will remove the ${targetLabel} from the config. Hot reload core to apply.`}
            </p>
          </ScrollArea>
          <div className="confirm-actions modal-fixed-footer">
            <button className="ghost small" onClick={closeDeleteConfirm}>Cancel</button>
            <button
              className="action-icon-button action-icon-danger"
              type="button"
              title="Delete"
              aria-label={`Confirm delete ${titleLabel}`}
              onClick={confirmDelete}
              disabled={deleteConfirmBusy}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderInfoModal = () => {
    if (!infoModalVisible) return null;
    const modalState = infoModalClosing ? 'closing' : 'open';
    return createPortal(
      <div className="modal-backdrop" role="dialog" aria-modal="true" data-state={modalState}>
        <div className="modal info-modal" data-state={modalState}>
          <div className="modal-header modal-fixed-header">
            <div>
              <h3>{infoModalTitle || 'Info'}</h3>
              <p className="group-meta">Full payload snapshot (read-only).</p>
            </div>
            <button className="ghost small" onClick={closeInfoModal}>Close</button>
          </div>
          <ScrollArea className="modal-body-scroll" contentClassName="modal-body-content" ariaLabel="Information payload">
            <div className="rules-modal-editor info-modal-editor">
              {infoModalEditor}
            </div>
          </ScrollArea>
          <div className="rules-modal-footer modal-fixed-footer">
            <span className="status">{infoModalStatus}</span>
            <div className="confirm-actions">
              <button className="ghost small" onClick={copyInfoModal}>Copy</button>
              <button className="ghost small" onClick={closeInfoModal}>Close</button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      {renderRulesModal()}
      {renderInfoModal()}
      {renderDeleteConfirm()}
      {renderRestartConfirm()}
    </>
  );
}
