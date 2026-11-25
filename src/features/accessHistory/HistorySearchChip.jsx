import { historyTokenLabel, invertHistoryToken } from './historySearch';

export function HistorySearchChip({ token, replace, remove, t }) {
  const excluded = token.startsWith('!');
  const label = historyTokenLabel(token);
  const toggleLabel = excluded ? t('改为包含', 'Include') : t('改为排除', 'Exclude');
  return (
    <span className={`history-search-chip${excluded ? ' is-excluded' : ''}`} onClick={e => e.stopPropagation()}>
      <button type="button" className="history-chip-toggle" aria-pressed={excluded}
        aria-label={`${toggleLabel} ${label}`} title={`${toggleLabel} ${label}`}
        onClick={() => replace(invertHistoryToken(token))}>
        {excluded && <span aria-hidden="true">− </span>}{label}
      </button>
      <button type="button" className="history-chip-remove" onClick={remove}
        aria-label={`${t('删除', 'Remove')} ${label}`} title={t('删除条件', 'Remove condition')}>×</button>
    </span>
  );
}
