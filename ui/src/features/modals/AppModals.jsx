import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { githubLight } from '@uiw/codemirror-theme-github';

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
  saveRulesModal,
  configRules,
  configBalancers,
  configSubscriptionOutbounds,
  configSubscriptionDatabases,
  configOutbounds,
  getRuleLabel,
  getBalancerLabel,
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
  if (typeof document === 'undefined') return null;

  const renderRulesModal = () => {
    if (!rulesModalVisible) return null;
    const modalState = rulesModalClosing ? 'closing' : 'open';
    const modalTarget = rulesModalTarget;
    const modalItems = modalTarget === 'rule'
      ? configRules
      : modalTarget === 'balancer'
        ? configBalancers
        : modalTarget === 'subscription'
          ? configSubscriptionOutbounds
          : modalTarget === 'subscriptionDatabase'
            ? configSubscriptionDatabases
            : configOutbounds;
    const modalLabel = modalTarget === 'rule'
      ? getRuleLabel
      : modalTarget === 'balancer'
        ? getBalancerLabel
        : modalTarget === 'subscription'
          ? getSubscriptionLabel
          : modalTarget === 'subscriptionDatabase'
            ? getSubscriptionDatabaseLabel
            : getOutboundLabel;
    const modalTitle = modalTarget === 'rule'
      ? 'rule'
      : modalTarget === 'balancer'
        ? 'balancer'
        : modalTarget === 'subscription'
          ? 'subscription outbound'
          : modalTarget === 'subscriptionDatabase'
            ? 'subscription database'
            : 'outbound';
    return createPortal(
      <div className="modal-backdrop rules-modal-backdrop" role="dialog" aria-modal="true" data-state={modalState}>
        <div className="modal rules-modal" data-state={modalState}>
          <div className="modal-header">
            <div>
              <h3>
                {rulesModalMode === 'edit'
                  ? `Edit ${modalTitle} #${rulesModalIndex + 1}`
                  : `Insert new ${modalTitle}`}
              </h3>
              <p className="group-meta">
                {rulesModalMode === 'edit'
                  ? `Update JSON and choose where to place this ${modalTitle}.`
                  : 'Edit the template, then choose where to insert (numbers match the list).'}
              </p>
            </div>
            <button className="ghost small" onClick={closeRulesModal}>Close</button>
          </div>
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
          <div className="rules-modal-editor">
            <CodeMirror
              value={rulesModalText}
              height="260px"
              theme={githubLight}
              extensions={[json(), lintGutter(), linter(jsonParseLinter()), EditorView.lineWrapping]}
              onChange={(value) => {
                setRulesModalText(value);
                if (rulesModalStatus) setRulesModalStatus('');
              }}
              aria-label="Edit JSON"
            />
          </div>
          <div className="rules-modal-footer">
            <span className="status">{rulesModalStatus}</span>
            <button className="primary small" onClick={saveRulesModal} disabled={rulesModalSaving}>
              {rulesModalSaving ? 'Saving...' : 'Save'}
            </button>
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
          <div className="modal-header">
            <div>
              <h3>Restart core?</h3>
              <p className="group-meta">
                This will restart the Xray core. Pending routing edits will be uploaded first.
              </p>
            </div>
            <button className="ghost small" onClick={closeRestartConfirm}>Close</button>
          </div>
          <div className="confirm-actions">
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
        : deleteConfirmTarget === 'subscription'
          ? 'subscription outbound'
          : deleteConfirmTarget === 'subscriptionDatabase'
            ? 'subscription database'
            : 'outbound';
    const titleLabel = deleteConfirmLabel || targetLabel;
    return createPortal(
      <div className="modal-backdrop" role="dialog" aria-modal="true" data-state={modalState}>
        <div className="modal confirm-modal" data-state={modalState}>
          <div className="modal-header">
            <div>
              <h3>{`Delete ${titleLabel}?`}</h3>
              <p className="group-meta">
                {`This will remove the ${targetLabel} from the config. Hot reload core to apply.`}
              </p>
            </div>
            <button className="ghost small" onClick={closeDeleteConfirm}>Close</button>
          </div>
          <div className="confirm-actions">
            <button className="ghost small" onClick={closeDeleteConfirm}>Cancel</button>
            <button className="danger small" onClick={confirmDelete} disabled={deleteConfirmBusy}>
              Delete
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
          <div className="modal-header">
            <div>
              <h3>{infoModalTitle || 'Info'}</h3>
              <p className="group-meta">Full payload snapshot (read-only).</p>
            </div>
            <button className="ghost small" onClick={closeInfoModal}>Close</button>
          </div>
          <div className="rules-modal-editor info-modal-editor">
            <CodeMirror
              value={infoModalText}
              height="520px"
              theme={githubLight}
              extensions={[json(), EditorView.lineWrapping, EditorView.editable.of(false)]}
              aria-label="Info JSON"
            />
          </div>
          <div className="rules-modal-footer">
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
