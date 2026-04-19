import { useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useUIStore } from '@/stores/uiStore';
import { DataTable, Column } from '@/components/ui/DataTable';
import { TypeBadge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/currencyUtils';
import { Customer } from '@/types';
import './CustomersScreen.css';

type TypeFilter = 'all' | 'Monthly' | 'Invoice' | 'Party-Credit' | 'Cash';

export function CustomersScreen() {
  const { getActiveCustomers } = useDataStore();
  const { openModal } = useUIStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const customers = getActiveCustomers();

  const typeCounts: Record<Exclude<TypeFilter, 'all'>, number> = {
    Monthly: customers.filter((c) => c.type === 'Monthly').length,
    Invoice: customers.filter((c) => c.type === 'Invoice').length,
    'Party-Credit': customers.filter((c) => c.type === 'Party-Credit').length,
    Cash: customers.filter((c) => c.type === 'Cash').length,
  };

  const filtered = customers
    .filter((c) => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.shortCode.toLowerCase().includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const columns: Column<Customer>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'shortCode', label: 'Code', sortable: true },
    {
      key: 'type',
      label: 'Type',
      render: (value) => <TypeBadge type={value as Customer['type']} />,
    },
    {
      key: 'hasCommission',
      label: 'Commission',
      render: (value) =>
        value ? (
          <span className="badge badge-primary badge-sm">Yes</span>
        ) : (
          <span className="muted-dash">—</span>
        ),
    },
    {
      key: 'requiresDc',
      label: 'DC Required',
      render: (value) =>
        value ? (
          <span className="badge badge-warning badge-sm">DC</span>
        ) : (
          <span className="muted-dash">—</span>
        ),
    },
    {
      key: 'advanceBalance',
      label: 'Advance',
      render: (value) =>
        value ? (
          <span className="cust-advance-val">{formatCurrency(value as number)}</span>
        ) : (
          <span className="muted-dash">—</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (value) => (
        <span className={`badge badge-sm status-badge ${value ? 'badge-success' : 'badge-default'}`}>
          <span className="status-dot" aria-hidden="true" />
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="cust-screen">
      <div className="cust-pg-header">
        <div>
          <h1 className="cust-pg-title">
            Customers <span className="cust-pg-title-ta tamil">வாடிக்கையாளர்கள்</span>
          </h1>
          <p className="cust-pg-desc">
            {customers.length} customer{customers.length !== 1 ? 's' : ''} · manage master data and commission workers
          </p>
        </div>
        <button className="btn btn-accent" onClick={() => openModal('customer', 0)} type="button">
          + Add customer
        </button>
      </div>

      <div className="cust-toolbar">
        <input
          type="text"
          className="cust-search"
          placeholder="Search name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="cust-type-tabs">
          {(['all', 'Monthly', 'Invoice', 'Party-Credit', 'Cash'] as TypeFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`cust-type-btn${typeFilter === f ? ' active' : ''}`}
              onClick={() => setTypeFilter(f)}
            >
              {f === 'all' ? 'All' : `${f} ${typeCounts[f as keyof typeof typeCounts]}`}
            </button>
          ))}
        </div>
      </div>

      <div className="cust-content">
        {customers.length === 0 ? (
          <div className="empty-screen-state">
            <p className="empty-screen-title">No customers yet</p>
            <p className="empty-screen-desc">Add your first customer to start creating job cards.</p>
            <button className="btn btn-accent" onClick={() => openModal('customer', 0)} type="button">
              + Add customer
            </button>
          </div>
        ) : (
          <DataTable<Customer>
            columns={columns}
            data={filtered}
            keyFn={(item) => item.id}
            onRowClick={(c) => openModal('customer', c.id)}
            emptyMessage="No customers match your search"
          />
        )}
      </div>
    </div>
  );
}
