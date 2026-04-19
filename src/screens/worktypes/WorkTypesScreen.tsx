import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useUIStore } from '@/stores/uiStore';
import { DataTable, Column } from '@/components/ui/DataTable';
import { formatCurrency } from '@/lib/currencyUtils';
import { WorkType } from '@/types';
import '../customers/CustomersScreen.css';
import './WorkTypesScreen.css';

export function WorkTypesScreen() {
  const { workTypes } = useDataStore();
  const { openModal } = useUIStore();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const categories = useMemo(
    () => [...new Set(workTypes.map((wt) => wt.category))].sort((a, b) => a.localeCompare(b)),
    [workTypes]
  );

  const catCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const wt of workTypes) {
      map[wt.category] = (map[wt.category] ?? 0) + 1;
    }
    return map;
  }, [workTypes]);

  const filtered = workTypes
    .filter((wt) => {
      if (catFilter !== 'all' && wt.category !== catFilter) return false;
      const q = search.toLowerCase();
      return (
        wt.name.toLowerCase().includes(q) ||
        wt.category.toLowerCase().includes(q) ||
        wt.shortCode.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const cc = a.category.localeCompare(b.category);
      return cc !== 0 ? cc : a.name.localeCompare(b.name);
    });

  const columns: Column<WorkType>[] = [
    { key: 'category', label: 'Category', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'shortCode', label: 'Code', sortable: true },
    { key: 'defaultUnit', label: 'Unit' },
    {
      key: 'defaultRate',
      label: 'Default Rate',
      render: (value) => formatCurrency(value as number),
    },
  ];

  return (
    <div className="wt-screen">
      <div className="wt-pg-header">
        <div>
          <h1 className="wt-pg-title">
            Work Types <span className="wt-pg-title-ta tamil">வேலை வகைகள்</span>
          </h1>
          <p className="wt-pg-desc">
            {workTypes.length} work type{workTypes.length !== 1 ? 's' : ''} · service and material categories
          </p>
        </div>
        <div className="wt-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => openModal('category')}
            type="button"
            title="Manage categories (add, edit, or delete)"
          >
            Manage Categories
          </button>
          <button className="btn btn-accent" onClick={() => openModal('worktype', 0)} type="button">
            + Add Work Type
          </button>
        </div>
      </div>

      <div className="wt-toolbar">
        <input
          type="text"
          className="wt-search"
          placeholder="Search name, category or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {categories.length > 0 && (
          <div className="wt-cat-tabs">
            <button
              type="button"
              className={`wt-cat-btn${catFilter === 'all' ? ' active' : ''}`}
              onClick={() => setCatFilter('all')}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`wt-cat-btn${catFilter === cat ? ' active' : ''}`}
                onClick={() => setCatFilter(cat)}
              >
                {cat} {catCounts[cat]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="wt-content">
        {workTypes.length === 0 ? (
          <div className="empty-screen-state">
            <p className="empty-screen-title">No work types yet</p>
            <p className="empty-screen-desc">Add work types to use them when creating job lines.</p>
            <button className="btn btn-accent" onClick={() => openModal('worktype', 0)} type="button">
              + Add Work Type
            </button>
          </div>
        ) : (
          <DataTable<WorkType>
            columns={columns}
            data={filtered}
            keyFn={(item) => item.id}
            onRowClick={(wt) => openModal('worktype', wt.id)}
            emptyMessage="No work types match your search"
          />
        )}
      </div>
    </div>
  );
}
