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

const SearchIcon = () => (
  <svg className="ss-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="6.5" cy="6.5" r="4" />
    <path d="M10 10l2.5 2.5" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <span className="select-item-check">
    <svg viewBox="0 0 13 13">
      <path d="M2.5 6.5l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const ChevronIcon = () => (
  <svg className="select-chevron" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 5l4 4 4-4" />
  </svg>
);

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

  const filteredItems = items
    .filter((item) => {
      const searchBase = getSearchText ? getSearchText(item) : getLabel(item);
      return searchBase.toLowerCase().includes(search.toLowerCase());
    })
    .slice(0, 30);

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
        <span className={`select-value${value ? '' : ' placeholder'}`}>
          {value ? getLabel(value) : placeholder}
        </span>
        <ChevronIcon />
      </button>

      {isOpen ? (
        <div className="searchable-select-dropdown">
          <div className="ss-search-wrap">
            <SearchIcon />
            <input
              ref={inputRef}
              type="text"
              className="searchable-select-input"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
            />
          </div>

          <div className="searchable-select-list">
            {displayItems.every((g) => g.items.length === 0) ? (
              <div className="select-empty">No items found</div>
            ) : (
              displayItems.map((group) => (
                <div key={group.group || 'default'}>
                  {group.group ? <div className="select-group-label">{group.group}</div> : null}
                  {group.items.map((item) => {
                    const isSelected = Boolean(value && getKey(value) === getKey(item));
                    return (
                      <button
                        key={getKey(item)}
                        className={`select-item${isSelected ? ' selected' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelect(item);
                        }}
                        type="button"
                      >
                        <span>{getLabel(item)}</span>
                        {isSelected ? <CheckIcon /> : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
