import { useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useUIStore } from '@/stores/uiStore';
import { DataTable, Column } from '@/components/ui/DataTable';
import { TypeBadge } from '@/components/ui/Badge';
import { Customer } from '@/types';
import './CustomersScreen.css';

export function CustomersScreen() {
  const { getActiveCustomers } = useDataStore();
  const { openModal } = useUIStore();
  const [search, setSearch] = useState('');

  const customers = getActiveCustomers();
  const filtered = customers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.shortCode.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const columns: Column<Customer>[] = [
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
      key: 'type',
      label: 'Type',
      render: (value) => <TypeBadge type={value as Customer['type']} />,
    },
    {
      key: 'hasCommission',
      label: 'Commission',
      render: (value) => (value ? 'Yes' : 'No'),
    },
    {
      key: 'requiresDc',
      label: 'DC Required',
      render: (value) => (value ? 'Yes' : 'No'),
    },
  ];

  const handleRowClick = (customer: Customer) => {
    openModal('customer', customer.id);
  };

  return (
    <div className="customers-screen">
      <div className="screen-header">
        <h2 className="screen-title">Customers</h2>
        <div className="screen-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => openModal('customer', 0)}
            type="button"
          >
            Add Customer
          </button>
        </div>
      </div>

      <div className="screen-content">
        <DataTable<Customer>
          columns={columns}
          data={filtered}
          keyFn={(item) => item.id}
          onRowClick={handleRowClick}
          emptyMessage="No customers found"
        />
      </div>
    </div>
  );
}
