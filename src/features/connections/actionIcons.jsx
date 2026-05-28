import React from 'react';

export function InfoIcon() {
  return (
    <svg className="conn-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="currentColor" stroke="none">
        <circle cx="12" cy="7.5" r="1.3" />
        <rect x="11" y="10.6" width="2" height="7" rx="1" />
      </g>
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg className="conn-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg className="conn-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20h4.5L19 9.5a2.1 2.1 0 0 0 0-3l-1.5-1.5a2.1 2.1 0 0 0-3 0L4 15.5V20Z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg className="conn-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 7h14" />
      <path d="M10 11v6M14 11v6" />
      <path d="M8 7l1-3h6l1 3" />
      <path d="M7 7l1 13h8l1-13" />
    </svg>
  );
}

export function ConnectionsIcon() {
  return (
    <svg className="conn-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="7" cy="12" r="3" />
      <circle cx="17" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M9.6 10.5l4.8-2M9.6 13.5l4.8 2" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg className="conn-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 19V5" />
      <path d="M6.5 10.5L12 5l5.5 5.5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg className="conn-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5v14" />
      <path d="M6.5 13.5L12 19l5.5-5.5" />
      <path d="M5 4h14" />
    </svg>
  );
}

export function ChildrenIcon() {
  return (
    <svg className="conn-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 6h6" />
      <path d="M7 12h10" />
      <path d="M7 18h8" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  );
}
