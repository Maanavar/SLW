import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import './DataTable.css';

export interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id?: string | number }> {
  columns: Column<T>[];
  data: T[];
  keyFn: (item: T, index: number) => string | number;
  onRowClick?: (item: T) => void;
  sortBy?: keyof T;
  sortOrder?: 'asc' | 'desc';
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  keyFn,
  onRowClick,
  sortBy: initialSortBy,
  sortOrder: initialSortOrder = 'asc',
  loading = false,
  emptyMessage = 'No data available',
  className = '',
}: DataTableProps<T>) {
  const [sortBy, setSortBy] = useState<keyof T | null>(initialSortBy || null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);

  const sortedData = useMemo(() => {
    if (!sortBy) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
      if (bVal == null) return sortOrder === 'asc' ? -1 : 1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return sortOrder === 'asc'
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal);
      }

      const aText = String(aVal);
      const bText = String(bVal);
      return sortOrder === 'asc'
        ? aText.localeCompare(bText, undefined, { numeric: true, sensitivity: 'base' })
        : bText.localeCompare(aText, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [data, sortBy, sortOrder]);

  const handleSort = (key: keyof T) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortBy(key);
    setSortOrder('asc');
  };

  const getSortMark = (key: keyof T): string => {
    if (sortBy !== key) return '\u2195';
    return sortOrder === 'asc' ? '\u2191' : '\u2193';
  };

  return (
    <div className={`data-table-shell ${className}`}>
      {loading ? (
        <div className="table-loading">
          <div className="loading-spinner" />
          <p>Loading data...</p>
        </div>
      ) : sortedData.length === 0 ? (
        <div className="table-empty">
          <h3 className="empty-title">No Data</h3>
          <p className="empty-message">{emptyMessage}</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={`table-header ${col.className || ''} ${
                      col.sortable ? 'sortable' : ''
                    } ${sortBy === col.key ? 'sorted' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span className="header-content">
                      {col.label}
                      {col.sortable ? (
                        <span
                          className={`sort-icon ${sortBy === col.key ? 'is-active' : ''}`}
                          aria-hidden="true"
                        >
                          {getSortMark(col.key)}
                        </span>
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, index) => (
                <tr
                  key={keyFn(row, index)}
                  className={onRowClick ? 'table-row clickable' : 'table-row'}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className={`table-cell ${col.className || ''}`}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
