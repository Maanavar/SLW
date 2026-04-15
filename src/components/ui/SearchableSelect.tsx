import { useEffect, useRef, useState } from 'react';
import './SearchableSelect.css';

export interface SearchableSelectProps<T> {
  items: T[];
  value: T | null;
  onChange: (item: T) => void;
  getLabel: (item: T) => string;
  getKey: (item: T) => string;
  getSearchText?: (item: T) => string;
  placeholder?: string;
  disabled?: boolean;
  groupBy?: (item: T) => string;
  className?: string;
}

export function SearchableSelect<T>({
  items,
  value,
  onChange,
  getLabel,
  getKey,
  getSearchText,
  placeholder = 'Select...',
  disabled = false,
  groupBy,
  className = '',
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = items.filter((item) => {
    const searchBase = getSearchText ? getSearchText(item) : getLabel(item);
    return searchBase.toLowerCase().includes(search.toLowerCase());
  });

  const displayItems: { group: string; items: T[] }[] = (() => {
    if (!groupBy) return [{ group: '', items: filteredItems }];

    const groups = new Map<string, T[]>();
    filteredItems.forEach((item) => {
      const groupKey = groupBy(item);
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(item);
    });

    const result: { group: string; items: T[] }[] = [];
    groups.forEach((groupItems, groupKey) => {
      result.push({ group: groupKey, items: groupItems });
    });
    return result;
  })();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (!isOpen) return;

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSelect = (item: T) => {
    onChange(item);
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div className={`searchable-select ${className}`} ref={containerRef}>
      <button
        className={`searchable-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        type="button"
      >
        <span className="select-value">{value ? getLabel(value) : placeholder}</span>
        <span className="select-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {isOpen ? (
        <div className="searchable-select-dropdown">
          <input
            ref={inputRef}
            type="text"
            className="searchable-select-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
          />

          <div className="searchable-select-list">
            {displayItems.length === 0 ? (
              <div className="select-empty">No items found</div>
            ) : (
              displayItems.map((group) => (
                <div key={group.group || 'default'}>
                  {group.group ? <div className="select-group-label">{group.group}</div> : null}
                  {group.items.map((item) => (
                    <button
                      key={getKey(item)}
                      className={`select-item ${
                        value && getKey(value) === getKey(item) ? 'selected' : ''
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(item);
                      }}
                      type="button"
                    >
                      {getLabel(item)}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
