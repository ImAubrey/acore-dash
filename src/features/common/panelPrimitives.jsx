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

export function HeaderSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = 'connections-search'
}) {
  return (
    <div className={className}>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
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
  title = ''
}) {
  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
    >
      {busy ? busyLabel : idleLabel}
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
