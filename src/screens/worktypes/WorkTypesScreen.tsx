/**
 * Work Types Screen
 * View and manage all work types
 */

import { useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useUIStore } from '@/stores/uiStore';
import { DataTable, Column } from '@/components/ui/DataTable';
import { formatCurrency } from '@/lib/currencyUtils';
import { WorkType } from '@/types';
import '../customers/CustomersScreen.css'; // Reuse styles

export function WorkTypesScreen() {
  const { workTypes } = useDataStore();
  const { openModal } = useUIStore();
  const [search, setSearch] = useState('');

  const filtered = workTypes
    .filter(
      (wt) =>
        wt.name.toLowerCase().includes(search.toLowerCase()) ||
        wt.category.toLowerCase().includes(search.toLowerCase()) ||
        wt.shortCode.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const categoryCompare = a.category.localeCompare(b.category);
      return categoryCompare !== 0 ? categoryCompare : a.name.localeCompare(b.name);
    });

  const columns: Column<WorkType>[] = [
    {
      key: 'category',
      label: 'Category',
      sortable: true,
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
    },
    {
      key: 'shortCode',
      label: 'Code',
      sortable: true,
    },
    {
      key: 'defaultUnit',
      label: 'Unit',
    },
    {
      key: 'defaultRate',
      label: 'Default Rate',
      render: (value) => formatCurrency(value as number),
    },
  ];

  const handleRowClick = (workType: WorkType) => {
    openModal('worktype', workType.id);
  };

  return (
    <div className="customers-screen">
      <div className="screen-header">
        <h2 className="screen-title">Work Types</h2>
        <div className="screen-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, category or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn btn-secondary"
            onClick={() => openModal('category')}
            type="button"
            title="Manage categories (add, edit, or delete)"
          >
            Manage Categories
          </button>
          <button
            className="btn btn-primary"
            onClick={() => openModal('worktype', 0)}
            type="button"
          >
            Add Work Type
          </button>
        </div>
      </div>

      <div className="screen-content">
        {workTypes.length === 0 ? (
          <div className="empty-screen-state">
            <p className="empty-screen-title">No work types yet</p>
            <p className="empty-screen-desc">Add work types to use them when creating job lines.</p>
            <button
              className="btn btn-primary"
              onClick={() => openModal('worktype', 0)}
              type="button"
            >
              Add Work Type
            </button>
          </div>
        ) : (
          <DataTable<WorkType>
            columns={columns}
            data={filtered}
            keyFn={(item) => item.id}
            onRowClick={handleRowClick}
            emptyMessage="No work types match your search"
          />
        )}
      </div>
    </div>
  );
}
