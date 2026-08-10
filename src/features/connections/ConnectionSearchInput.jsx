import { useRef } from 'react';
import {
  serializeConnectionSearchValue,
  splitConnectionSearchValue
} from './connectionSearch';

export function ConnectionSearchInput({
  value,
  setValue,
  placeholder,
  ariaLabel = 'Search all connection fields'
}) {
  const inputRef = useRef(null);
  const { tokens, draft } = splitConnectionSearchValue(value);
  const hasValue = tokens.length > 0 || Boolean(draft);

  const updateValue = (nextTokens, nextDraft = '') => {
    setValue(serializeConnectionSearchValue(nextTokens, nextDraft));
  };

  const handleInputChange = (event) => {
    const nextDraft = event.target.value;
    const combined = tokens.length > 0
      ? `${tokens.join(' ')} ${nextDraft}`
      : nextDraft;
    setValue(combined);
  };

  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter' && draft.trim()) {
      event.preventDefault();
      updateValue([...tokens, draft], '');
      return;
    }
    if (event.key === 'Backspace' && !draft && tokens.length > 0) {
      event.preventDefault();
      updateValue(tokens.slice(0, -1), '');
    }
  };

  const removeToken = (index) => {
    updateValue(tokens.filter((_, tokenIndex) => tokenIndex !== index), draft);
    inputRef.current?.focus();
  };

  const clearSearch = () => {
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div
      className="connections-search connection-token-search"
      onClick={() => inputRef.current?.focus()}
    >
      {tokens.map((token, index) => (
        <button
          type="button"
          className="connection-search-token"
          key={`${token}:${index}`}
          onClick={(event) => {
            event.stopPropagation();
            removeToken(index);
          }}
          aria-label={`Remove search condition ${token}`}
          title={`Remove condition: ${token}`}
        >
          <span>{token}</span>
          <span className="connection-search-token-remove" aria-hidden="true">×</span>
        </button>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        placeholder={tokens.length > 0 ? 'Add condition…' : placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
      />
      {hasValue ? (
        <button
          type="button"
          className="clearable-input-button connection-token-search-clear"
          onClick={(event) => {
            event.stopPropagation();
            clearSearch();
          }}
          aria-label="Clear all search conditions"
          title="Clear all search conditions"
        >
          X
        </button>
      ) : null}
    </div>
  );
}
