import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useDataStore } from '@/stores/dataStore';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobNetValue, getJobWorkerCommissionExpense } from '@/lib/jobUtils';
import { buildCollectionEvents } from '@/lib/financeUtils';
import { rankCustomers } from '@/lib/customerRankingUtils';
import { type Customer } from '@/types';
import { CustomerBillsOverlay } from './CustomerBillsOverlay';

type CustomerTypeFilter = 'All' | 'Monthly' | 'Invoice' | 'Party-Credit' | 'Cash';
type BalanceSortKey =
  | 'customer'
  | 'type'
  | 'ourIncome'
  | 'commission'
  | 'finalBill'
  | 'paidAmount'
  | 'openingBalanceAmt'
  | 'advance'
  | 'balance';

export interface CustomerBalance extends Customer {
  ourIncome: number;
  commission: number;
  finalBill: number;
  paidAmount: number;
  openingBalanceAmt: number;
  balance: number;
  advance: number;
}

interface CustomerBalancesTableProps {
  showFilters?: boolean;
  dateRange?: { from: string; to: string };
}

function fmtRange(from: string, to: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const f = new Date(`${from}T00:00:00`).toLocaleDateString('en-IN', opts);
  const t = new Date(`${to}T00:00:00`).toLocaleDateString('en-IN', { ...opts, year: 'numeric' });
  return from === to ? t : `${f} – ${t}`;
}

function getTypeBadgeClass(type: Customer['type']): string {
  if (type === 'Monthly') return 'type-monthly';
  if (type === 'Invoice') return 'type-invoice';
  if (type === 'Party-Credit') return 'type-party-credit';
  return 'type-cash';
}

function shiftDateString(dateStr: string, deltaDays: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + deltaDays);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function CustomerBalancesTable({ showFilters = true, dateRange }: CustomerBalancesTableProps) {
  const { jobs, payments } = useDataStore();
  const { data: allCustomers = [] } = useCustomersQuery();
  const [typeFilter, setTypeFilter] = useState<CustomerTypeFilter>('All');
  const [customerFilter, setCustomerFilter] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerBalance | null>(null);
  const [sortState, setSortState] = useState<{ key: BalanceSortKey; order: 'asc' | 'desc' }>({
    key: 'balance',
    order: 'desc',
  });

  const customers = useMemo(() => {
    return allCustomers
      .filter((customer) => customer.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCustomers]);
  const customerRankMap = useMemo(() => {
    const entries = rankCustomers(jobs, payments, customers);
    return new Map(entries.map((entry) => [entry.customerId, entry]));
  }, [jobs, payments, customers]);

  const scopedJobs = useMemo(
    () =>
      dateRange ? jobs.filter((job) => job.date >= dateRange.from && job.date <= dateRange.to) : jobs,
    [jobs, dateRange]
  );
  const scopedCollectionsByCustomer = useMemo(() => {
    const events = buildCollectionEvents(jobs, payments, dateRange);
    const totals = new Map<number, number>();
    events.forEach((event) => {
      totals.set(event.customerId, (totals.get(event.customerId) || 0) + (Number(event.amount) || 0));
    });
    return totals;
  }, [jobs, payments, dateRange]);
  const carriedOpeningByCustomer = useMemo(() => {
    const totals = new Map<number, number>();

    customers.forEach((customer) => {
      totals.set(customer.id, Number(customer.openingBalance) || 0);
    });

    if (!dateRange) {
      return totals;
    }

    const carryTo = shiftDateString(dateRange.from, -1);
    const priorJobs = jobs.filter((job) => job.date < dateRange.from);
    priorJobs.forEach((job) => {
      const current = totals.get(job.customerId) || 0;
      totals.set(job.customerId, current + getJobNetValue(job) + getJobWorkerCommissionExpense(job));
    });

    buildCollectionEvents(jobs, payments, { from: '0001-01-01', to: carryTo }).forEach((event) => {
      const current = totals.get(event.customerId) || 0;
      totals.set(event.customerId, current - (Number(event.amount) || 0));
    });

    customers.forEach((customer) => {
      totals.set(customer.id, Math.max(0, totals.get(customer.id) || 0));
    });

    return totals;
  }, [customers, jobs, payments, dateRange]);

  const balances = useMemo<CustomerBalance[]>(() => {
    return customers
      .map((customer) => {
        const customerJobs = scopedJobs.filter((job) => job.customerId === customer.id);
        const ourIncome = customerJobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
        const commission = customerJobs.reduce((sum, job) => sum + getJobWorkerCommissionExpense(job), 0);
        const finalBill = ourIncome + commission;
        const paidAmount = scopedCollectionsByCustomer.get(customer.id) || 0;
        const openingBalanceAmt = carriedOpeningByCustomer.get(customer.id) || 0;
        const balance = Math.max(0, openingBalanceAmt + finalBill - paidAmount);
        const advance = Number(customer.advanceBalance) || 0;

        return {
          ...customer,
          ourIncome,
          commission,
          finalBill,
          paidAmount,
          openingBalanceAmt,
          balance,
          advance,
        };
      })
      .filter((customer) => customer.balance !== 0);
  }, [customers, scopedJobs, scopedCollectionsByCustomer, carriedOpeningByCustomer]);

  const filtered = useMemo(() => {
    const q = customerFilter.trim().toLowerCase();
    return balances
      .filter((customer) => (typeFilter === 'All' ? true : customer.type === typeFilter))
      .filter((customer) => {
        if (!q) return true;
        return (
          customer.name.toLowerCase().includes(q) ||
          (customer.shortCode || '').toLowerCase().includes(q)
        );
      });
  }, [balances, customerFilter, typeFilter]);
  const sorted = useMemo(() => {
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base' });
    const direction = sortState.order === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortState.key === 'customer') return collator.compare(a.name, b.name) * direction;
      if (sortState.key === 'type') return collator.compare(a.type, b.type) * direction;
      if (sortState.key === 'ourIncome') return (a.ourIncome - b.ourIncome) * direction;
      if (sortState.key === 'commission') return (a.commission - b.commission) * direction;
      if (sortState.key === 'finalBill') return (a.finalBill - b.finalBill) * direction;
      if (sortState.key === 'paidAmount') return (a.paidAmount - b.paidAmount) * direction;
      if (sortState.key === 'openingBalanceAmt') return (a.openingBalanceAmt - b.openingBalanceAmt) * direction;
      if (sortState.key === 'advance') return (a.advance - b.advance) * direction;
      return (a.balance - b.balance) * direction;
    });
  }, [filtered, sortState]);
  const toggleSort = (key: BalanceSortKey) => {
    setSortState((prev) =>
      prev.key === key
        ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key === 'customer' || key === 'type' ? 'asc' : 'desc' }
    );
  };
  const sortMark = (key: BalanceSortKey) => {
    if (sortState.key !== key) return '↕';
    return sortState.order === 'asc' ? '↑' : '↓';
  };

  const totals = useMemo(() => {
    return {
      customers: sorted.length,
      ourIncome: sorted.reduce((sum, customer) => sum + customer.ourIncome, 0),
      commission: sorted.reduce((sum, customer) => sum + customer.commission, 0),
      finalBill: sorted.reduce((sum, customer) => sum + customer.finalBill, 0),
      paidAmount: sorted.reduce((sum, customer) => sum + customer.paidAmount, 0),
      openingBalanceAmt: sorted.reduce((sum, customer) => sum + customer.openingBalanceAmt, 0),
      advance: sorted.reduce((sum, customer) => sum + customer.advance, 0),
      balance: sorted.reduce((sum, customer) => sum + customer.balance, 0),
    };
  }, [sorted]);

  return (
    <>
    <section className="customer-balances">
      {showFilters ? (
        <div className="customer-balances-head">
          <h2 className="customer-balances-title">
            Customer balances
            {dateRange ? (
              <span className="customer-balances-period">{fmtRange(dateRange.from, dateRange.to)}</span>
            ) : null}
          </h2>

          <div className="customer-balances-toolbar">
            <label className="customer-search" aria-label="Search customer">
              <Icon name="search" width={14} height={14} className="search-icon" />
              <input
                type="text"
                className="customer-search-input"
                placeholder="Search customer..."
                value={customerFilter}
                onChange={(event) => setCustomerFilter(event.target.value)}
              />
            </label>

            <select
              className="customer-type-select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as CustomerTypeFilter)}
              aria-label="Filter customer type"
            >
              <option value="All">All</option>
              <option value="Monthly">Monthly</option>
              <option value="Invoice">Invoice</option>
              <option value="Party-Credit">Party-Credit</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
        </div>
      ) : null}

      <div className="customer-table-wrap">
        <table className="customer-table">
          <thead>
            <tr>
              <th
                className={`slw-sortable-th${sortState.key === 'customer' ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleSort('customer')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSort('customer');
                  }
                }}
              >
                Customer {sortMark('customer')}
              </th>
              <th
                className={`slw-sortable-th${sortState.key === 'type' ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleSort('type')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSort('type');
                  }
                }}
              >
                Type {sortMark('type')}
              </th>
              <th
                className={`numeric slw-sortable-th${sortState.key === 'ourIncome' ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleSort('ourIncome')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSort('ourIncome');
                  }
                }}
              >
                Our Income {sortMark('ourIncome')}
              </th>
              <th
                className={`numeric slw-sortable-th${sortState.key === 'commission' ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleSort('commission')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSort('commission');
                  }
                }}
              >
                Commission {sortMark('commission')}
              </th>
              <th
                className={`numeric slw-sortable-th${sortState.key === 'finalBill' ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleSort('finalBill')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSort('finalBill');
                  }
                }}
              >
                Final Bill {sortMark('finalBill')}
              </th>
              <th
                className={`numeric slw-sortable-th${sortState.key === 'paidAmount' ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleSort('paidAmount')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSort('paidAmount');
                  }
                }}
              >
                Paid {sortMark('paidAmount')}
              </th>
              <th
                className={`numeric slw-sortable-th${sortState.key === 'openingBalanceAmt' ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleSort('openingBalanceAmt')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSort('openingBalanceAmt');
                  }
                }}
              >
                Opening Bal {sortMark('openingBalanceAmt')}
              </th>
              <th
                className={`numeric slw-sortable-th${sortState.key === 'advance' ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleSort('advance')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSort('advance');
                  }
                }}
              >
                Advance {sortMark('advance')}
              </th>
              <th
                className={`numeric slw-sortable-th${sortState.key === 'balance' ? ' is-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleSort('balance')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSort('balance');
                  }
                }}
              >
                Balance {sortMark('balance')}
              </th>
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 ? (
              <tr className="table-empty-row">
                <td colSpan={9}>No customers found for this filter.</td>
              </tr>
            ) : (
              sorted.map((customer) => {
                const balanceClass =
                  customer.balance > 0 ? 'amount-balance' : customer.balance < 0 ? 'amount-paid' : '';
                const rankEntry = customerRankMap.get(customer.id);
                return (
                  <tr
                    key={customer.id}
                    className="customer-table-row"
                    tabIndex={0}
                    onClick={() => setSelectedCustomer(customer)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCustomer(customer);
                      }
                    }}
                  >
                    <td>
                      <div className="customer-name">
                        {rankEntry ? (
                          <span
                            className={`customer-health-dot ${
                              rankEntry.healthLabel === 'Excellent'
                                ? 'excellent'
                                : rankEntry.healthLabel === 'Good'
                                  ? 'good'
                                  : rankEntry.healthLabel === 'Attention'
                                    ? 'attention'
                                    : 'risk'
                            }`}
                            title={`Health: ${rankEntry.healthScore}/100 - ${rankEntry.healthLabel}`}
                          />
                        ) : null}
                        <span className="customer-name-link">{customer.name}</span>
                      </div>
                      <div className="customer-code">{customer.shortCode || '-'}</div>
                    </td>
                    <td>
                      <span className={`customer-type-badge ${getTypeBadgeClass(customer.type)}`}>
                        {customer.type}
                      </span>
                    </td>
                    <td className="numeric">{formatCurrency(customer.ourIncome)}</td>
                    <td className="numeric">{formatCurrency(customer.commission)}</td>
                    <td className="numeric">{formatCurrency(customer.finalBill)}</td>
                    <td className="numeric amount-paid">{formatCurrency(customer.paidAmount)}</td>
                    <td className="numeric">
                      {customer.openingBalanceAmt > 0 ? (
                        <span className="amount-balance">{formatCurrency(customer.openingBalanceAmt)}</span>
                      ) : (
                        <span className="muted-dash">-</span>
                      )}
                    </td>
                    <td className="numeric">
                      {customer.advance > 0 ? (
                        <span className="amount-advance">{formatCurrency(customer.advance)}</span>
                      ) : (
                        <span className="muted-dash">-</span>
                      )}
                    </td>
                    <td className={`numeric ${balanceClass}`}>{formatCurrency(customer.balance)}</td>
                  </tr>
                );
              })
            )}
          </tbody>

          {sorted.length > 0 ? (
            <tfoot>
              <tr>
                <td>{totals.customers} customers</td>
                <td />
                <td className="numeric">{formatCurrency(totals.ourIncome)}</td>
                <td className="numeric">{formatCurrency(totals.commission)}</td>
                <td className="numeric">{formatCurrency(totals.finalBill)}</td>
                <td className="numeric">{formatCurrency(totals.paidAmount)}</td>
                <td className="numeric">{formatCurrency(totals.openingBalanceAmt)}</td>
                <td className="numeric">{formatCurrency(totals.advance)}</td>
                <td className="numeric">{formatCurrency(totals.balance)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>

    {selectedCustomer ? (
      <CustomerBillsOverlay
        customer={selectedCustomer}
        jobs={jobs.filter(
          (job) =>
            job.customerId === selectedCustomer.id &&
            (!dateRange || job.date <= dateRange.to)
        )}
        onClose={() => setSelectedCustomer(null)}
      />
    ) : null}
  </>
  );
}
