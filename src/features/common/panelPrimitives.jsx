import { createContext, useContext, useRef } from 'react';

const LocalEditActionsContext = createContext({
  hasLocalRoutingDraft: false,
  discardRoutingDraftBusy: false,
  discardRoutingDraft: null
});

export function LocalEditActionsProvider({ value, children }) {
  return (
    <LocalEditActionsContext.Provider value={value || {}}>
      {children}
    </LocalEditActionsContext.Provider>
  );
}

export function useLocalEditActions() {
  return useContext(LocalEditActionsContext);
}

export function joinClassNames(...names) {
  return names.filter(Boolean).join(' ');
}

export function PanelHeader({
  title,
  description,
  actions,
  className = ''
}) {
  const headerClassName = joinClassNames('panel-header', className);
  return (
    <div className={headerClassName}>
      <div>
        {title ? <h2>{title}</h2> : null}
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </div>
  );
}

export function StatusText({
  text,
  danger = false,
  title = '',
  className = ''
}) {
  if (!text) return null;
  const statusClassName = joinClassNames('status', danger ? 'status-danger' : '', className);
  return <span className={statusClassName} title={title}>{text}</span>;
}

function applyTextInputValue(nextValue, setValue, onChange) {
  if (typeof setValue === 'function') {
    setValue(nextValue);
    return;
  }

  if (typeof onChange === 'function') {
    onChange({ target: { value: nextValue } });
  }
}

export function ClearableTextInput({
  value,
  setValue,
  onChange,
  placeholder,
  ariaLabel,
  className = '',
  clearLabel = 'Clear input',
  type = 'text',
  ...inputProps
}) {
  const inputRef = useRef(null);
  const inputValue = typeof value === 'string' ? value : String(value ?? '');
  const hasValue = inputValue.length > 0;

  const handleChange = (event) => {
    applyTextInputValue(event.target.value, setValue, onChange);
  };

  const handleClear = () => {
    applyTextInputValue('', setValue, onChange);
    inputRef.current?.focus();
  };

  return (
    <div className={joinClassNames('clearable-input', className)}>
      <input
        {...inputProps}
        ref={inputRef}
        type={type}
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {hasValue ? (
        <button
          type="button"
          className="clearable-input-button"
          onClick={handleClear}
          aria-label={clearLabel}
          title={clearLabel}
        >
          X
        </button>
      ) : null}
    </div>
  );
}

export function HeaderSearchInput({
  value,
  setValue,
  onChange,
  placeholder,
  ariaLabel,
  className = 'connections-search'
}) {
  return (
    <ClearableTextInput
      value={value}
      setValue={setValue}
      onChange={onChange}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      className={className}
      clearLabel={ariaLabel ? `Clear ${ariaLabel.toLowerCase()}` : 'Clear search input'}
    />
  );
}

export function EmptyState({
  title = '',
  message = '',
  small = false,
  className = ''
}) {
  const emptyClassName = joinClassNames('empty-state', small ? 'small' : '', className);
  return (
    <div className={emptyClassName}>
      {title ? <h3>{title}</h3> : null}
      {message ? <p>{message}</p> : null}
    </div>
  );
}

export function HotReloadButton({
  busy = false,
  onClick,
  disabled = false,
  className = 'primary small',
  idleLabel = 'Hot reload core',
  busyLabel = 'Hot reloading...',
  title = '',
  draftVisible,
  draftBusy,
  onUndoDraft,
  undoDraftLabel = 'Undo',
  undoDraftBusyLabel = 'Undoing...',
  undoDraftTitle = 'Discard unsaved browser draft edits'
}) {
  const {
    hasLocalRoutingDraft = false,
    discardRoutingDraftBusy = false,
    discardRoutingDraft = null
  } = useLocalEditActions();
  const showUndo = typeof draftVisible === 'boolean' ? draftVisible : hasLocalRoutingDraft;
  const undoBusy = typeof draftBusy === 'boolean' ? draftBusy : discardRoutingDraftBusy;
  const undoHandler = typeof onUndoDraft === 'function' ? onUndoDraft : discardRoutingDraft;

  return (
    <>
      <UndoLocalChangesButton
        visible={showUndo}
        busy={undoBusy}
        onClick={undoHandler}
        label={undoDraftLabel}
        busyLabel={undoDraftBusyLabel}
        title={undoDraftTitle}
      />
      <button
        className={className}
        onClick={onClick}
        disabled={disabled || busy}
        title={title}
      >
        {busy ? busyLabel : idleLabel}
      </button>
    </>
  );
}

export function UndoLocalChangesButton({
  visible = false,
  busy = false,
  onClick,
  label = 'Undo',
  busyLabel = 'Undoing...',
  title = 'Discard unsaved browser draft edits'
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      className="ghost small undo-draft-button"
      onClick={onClick}
      disabled={busy}
      title={title}
    >
      {busy ? busyLabel : label}
    </button>
  );
}

export function EyeIcon({ hidden = false }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  };

  if (hidden) {
    return (
      <svg {...common}>
        <path d="M3 3l18 18" />
        <path d="M9.9 5.1A11.3 11.3 0 0 1 12 5c5.7 0 9.8 4.7 10 7-.1 1.2-1.3 2.9-3.2 4.4" />
        <path d="M6.4 6.4C4.1 7.8 2.3 10 2 12c.3 3 4.6 7 10 7 2.2 0 4.2-.7 5.8-1.7" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M2 12c.2-2.8 4.4-7 10-7s9.8 4.2 10 7c-.2 2.8-4.4 7-10 7S2.2 14.8 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
