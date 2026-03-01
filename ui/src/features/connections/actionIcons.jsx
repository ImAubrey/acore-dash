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
