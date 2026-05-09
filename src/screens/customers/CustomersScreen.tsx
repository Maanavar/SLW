import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { useUIStore } from '@/stores/uiStore';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TypeBadge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/currencyUtils';
import { rankCustomers } from '@/lib/customerRankingUtils';
import { calculateCustomerAgeing } from '@/lib/financeUtils';
import { type Customer } from '@/types';
import './CustomersScreen.css';

type TypeFilter = 'all' | 'Monthly' | 'Invoice' | 'Party-Credit' | 'Cash';

export function CustomersScreen() {
  const [searchParams] = useSearchParams();
  const { data: allCustomers = [], isLoading, isError } = useCustomersQuery();
  const { jobs, payments } = useDataStore();
  const { openModal } = useUIStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showInactive, setShowInactive] = useState(false);
  const appliedSearchParamRef = useRef<string | null>(null);
  const openedCustomerParamRef = useRef<number | null>(null);

  const deepLinkSearch = (searchParams.get('search') || '').trim();
  const deepLinkCustomerId = Number(searchParams.get('customerId') || 0);

  const customers = showInactive ? allCustomers : allCustomers.filter((c) => c.isActive);
  const inactiveCount = allCustomers.filter((c) => !c.isActive).length;

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

  const customerRankMap = useMemo(() => {
    const rankEntries = rankCustomers(jobs, payments, allCustomers);
    return new Map(rankEntries.map((entry) => [entry.customerId, entry]));
  }, [jobs, payments, allCustomers]);

  const customerAgeingMap = useMemo(() => {
    const ageingRows = calculateCustomerAgeing(jobs, payments, allCustomers);
    return new Map(ageingRows.map((row) => [row.customerId, row]));
  }, [jobs, payments, allCustomers]);

  useEffect(() => {
    if (!deepLinkSearch || appliedSearchParamRef.current === deepLinkSearch) return;
    setSearch(deepLinkSearch);
    appliedSearchParamRef.current = deepLinkSearch;
  }, [deepLinkSearch]);

  useEffect(() => {
    if (!Number.isInteger(deepLinkCustomerId) || deepLinkCustomerId <= 0) {
      openedCustomerParamRef.current = null;
      return;
    }
    if (openedCustomerParamRef.current === deepLinkCustomerId) return;

    const target = allCustomers.find((customer) => customer.id === deepLinkCustomerId);
    if (!target) return;

    if (!target.isActive) {
      setShowInactive(true);
    }
    if (!deepLinkSearch) {
      setSearch(target.name);
    }

    openModal('customer', target.id);
    openedCustomerParamRef.current = deepLinkCustomerId;
  }, [deepLinkCustomerId, deepLinkSearch, allCustomers, openModal]);

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (value, row) => {
        const rank = customerRankMap.get(row.id);
        const healthClass =
          rank?.healthLabel === 'Excellent'
            ? 'excellent'
            : rank?.healthLabel === 'Good'
              ? 'good'
              : rank?.healthLabel === 'Attention'
                ? 'attention'
                : 'risk';
        const ageing = customerAgeingMap.get(row.id);
        const ageingClass =
          !ageing || ageing.total <= 0
            ? ''
            : ageing.band4 > 0 || ageing.band3 > 0
              ? 'critical'
              : ageing.band2 > 0
                ? 'high'
                : 'pending';
        const ageingLabel =
          !ageing || ageing.total <= 0
            ? ''
            : ageing.band4 > 0
              ? '90d+'
              : ageing.band3 > 0
                ? '61-90d'
                : ageing.band2 > 0
                  ? '60d'
                  : '30d';
        return (
          <div className="cust-name-wrap">
            {rank ? (
              <span
                className={`cust-health-dot ${healthClass}`}
                title={`Health: ${rank.healthScore}/100 - ${rank.healthLabel}`}
              />
            ) : null}
            <span>{value as string}</span>
            {ageingLabel ? (
              <span className={`cust-ageing-badge ${ageingClass}`} title="Worst outstanding ageing bucket">
                {ageingLabel}
              </span>
            ) : null}
          </div>
        );
      },
    },
    { key: 'shortCode', label: 'Code', sortable: true },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (value) => <TypeBadge type={value as Customer['type']} />,
    },
    {
      key: 'hasCommission',
      label: 'Commission',
      sortable: true,
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
      sortable: true,
      render: (value) =>
        value ? (
          <span className="badge badge-warning badge-sm">DC</span>
        ) : (
          <span className="muted-dash">—</span>
        ),
    },
    {
      key: 'hasBillNo',
      label: 'Bill No',
      sortable: true,
      render: (value) =>
        value ? (
          <span className="badge badge-info badge-sm">Required</span>
        ) : (
          <span className="muted-dash">—</span>
        ),
    },
    {
      key: 'advanceBalance',
      label: 'Advance',
      sortable: true,
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
      sortable: true,
      render: (value) => (
        <span className={`badge badge-sm status-badge ${value ? 'badge-success' : 'badge-default'}`}>
          <span className="status-dot" aria-hidden="true" />
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  if (isLoading) return <div className="loading-screen"><p>Loading customers…</p></div>;
  if (isError) return <div className="loading-screen"><p className="text-danger">Failed to load customers.</p></div>;

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
        {inactiveCount > 0 && (
          <label className="cust-inactive-toggle">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive ({inactiveCount})
          </label>
        )}
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

