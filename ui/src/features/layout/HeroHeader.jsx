export function HeroHeader({
  page,
  pageMeta,
  PAGES,
  formatBytes,
  connections,
  totalSessions
}) {
  return (
    <header className="hero">
      <div className="hero-main">
        <p className="eyebrow">Xray Control</p>
        <h1 className={page === 'connections' ? 'nowrap' : ''}>{pageMeta.title}</h1>
        <p className={`subhead ${page === 'connections' ? 'nowrap' : ''}`}>{pageMeta.description}</p>
        <nav className="nav">
          {Object.entries(PAGES).map(([key, value]) => (
            <a
              key={key}
              href={`#/${key}`}
              className={page === key ? 'active' : ''}
            >
              {value.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="hero-stats">
        <div className="stat-card">
          <span>Upload</span>
          <strong>{formatBytes(connections.uploadTotal)}</strong>
        </div>
        <div className="stat-card">
          <span>Download</span>
          <strong>{formatBytes(connections.downloadTotal)}</strong>
        </div>
        <div className="stat-card">
          <span>Sessions</span>
          <strong>{totalSessions}</strong>
        </div>
      </div>
    </header>
  );
}
