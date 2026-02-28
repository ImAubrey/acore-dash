import React from 'react';

const NAV_ACCENTS = {
  dashboard: '#ff8a5b',
  connections: '#2f9aa0',
  nodes: '#7c8be0',
  rules: '#cf8450',
  subscriptions: '#3b73d4',
  inbounds: '#3ba475',
  logs: '#5e85d4',
  settings: '#855fbe'
};

const NavIcon = ({ pageKey }) => {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  };

  if (pageKey === 'dashboard') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="4" rx="1.2" />
        <rect x="14" y="10" width="7" height="11" rx="1.5" />
        <rect x="3" y="13" width="7" height="8" rx="1.5" />
      </svg>
    );
  }
  if (pageKey === 'connections') {
    return (
      <svg {...common}>
        <path d="M8 7h6" />
        <path d="M10 5l-2 2 2 2" />
        <path d="M16 17h-6" />
        <path d="M14 15l2 2-2 2" />
        <path d="M7 17a5 5 0 0 1 0-10" />
        <path d="M17 7a5 5 0 0 1 0 10" />
      </svg>
    );
  }
  if (pageKey === 'nodes') {
    return (
      <svg {...common}>
        <circle cx="5" cy="6" r="2.5" />
        <circle cx="19" cy="6" r="2.5" />
        <circle cx="12" cy="18" r="2.5" />
        <path d="M7 7.4l3.2 7.2" />
        <path d="M17 7.4l-3.2 7.2" />
        <path d="M7.6 6h8.8" />
      </svg>
    );
  }
  if (pageKey === 'rules') {
    return (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M4 12h10" />
        <path d="M4 18h7" />
        <circle cx="17.5" cy="12" r="2.2" />
        <circle cx="14.5" cy="18" r="2.2" />
      </svg>
    );
  }
  if (pageKey === 'subscriptions') {
    return (
      <svg {...common}>
        <path d="M4 18a8 8 0 0 1 16 0" />
        <path d="M7 18a5 5 0 0 1 10 0" />
        <path d="M10 18a2 2 0 0 1 4 0" />
        <circle cx="12" cy="7" r="2.5" />
      </svg>
    );
  }
  if (pageKey === 'inbounds') {
    return (
      <svg {...common}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 9h8" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </svg>
    );
  }
  if (pageKey === 'logs') {
    return (
      <svg {...common}>
        <path d="M6 5h12" />
        <path d="M6 10h12" />
        <path d="M6 15h8" />
        <path d="M6 19h5" />
        <path d="M17 15l2 2-2 2" />
      </svg>
    );
  }
  if (pageKey === 'settings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="2.8" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7.3 7.3 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  );
};

export function PageNav({ page, pages }) {
  return (
    <nav className="nav">
      {Object.entries(pages).map(([key, value]) => (
        <a
          key={key}
          href={`#/${key}`}
          className={`nav-link${page === key ? ' active' : ''}`}
          style={{ '--nav-accent': NAV_ACCENTS[key] || '#5e85d4' }}
        >
          <span className="nav-link-icon"><NavIcon pageKey={key} /></span>
          <span className="nav-link-text">{value.label}</span>
        </a>
      ))}
    </nav>
  );
}
