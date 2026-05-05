import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobNetValue, getJobPaidAmount, getJobWorkerCommissionExpense } from '@/lib/jobUtils';
import { rankCustomers } from '@/lib/customerRankingUtils';
import { Customer } from '@/types';
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

function getTypeBadgeClass(type: Customer['type']): string {
  if (type === 'Monthly') return 'type-monthly';
  if (type === 'Invoice') return 'type-invoice';
  if (type === 'Party-Credit') return 'type-party-credit';
  return 'type-cash';
}

export function CustomerBalancesTable({ showFilters = true, dateRange }: CustomerBalancesTableProps) {
  const { getActiveCustomers, jobs, payments } = useDataStore();
  const [typeFilter, setTypeFilter] = useState<CustomerTypeFilter>('All');
  const [customerFilter, setCustomerFilter] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerBalance | null>(null);
  const [sortState, setSortState] = useState<{ key: BalanceSortKey; order: 'asc' | 'desc' }>({
    key: 'balance',
    order: 'desc',
  });

  const customers = useMemo(
    () => getActiveCustomers().sort((a, b) => a.name.localeCompare(b.name)),
    [getActiveCustomers]
  );
  const customerRankMap = useMemo(() => {
    const entries = rankCustomers(jobs, payments, customers);
    return new Map(entries.map((entry) => [entry.customerId, entry]));
  }, [jobs, payments, customers]);

  const scopedJobs = useMemo(
    () =>
      dateRange ? jobs.filter((job) => job.date >= dateRange.from && job.date <= dateRange.to) : jobs,
    [jobs, dateRange]
  );

  const balances = useMemo<CustomerBalance[]>(() => {
    return customers
      .map((customer) => {
        const customerJobs = scopedJobs.filter((job) => job.customerId === customer.id);
        const ourIncome = customerJobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
        const commission = customerJobs.reduce((sum, job) => sum + getJobWorkerCommissionExpense(job), 0);
        const finalBill = ourIncome + commission;
        const paidAmount = customerJobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
        const openingBalanceAmt = customer.openingBalance || 0;
        const balance = openingBalanceAmt + finalBill - paidAmount;
        const advance = customer.advanceBalance || 0;

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
      .filter((customer) => customer.balance !== 0 || customer.advance > 0 || customer.openingBalanceAmt > 0);
  }, [customers, scopedJobs]);

  const filtered = useMemo(() => {
    const q = customerFilter.trim().toLowerCase();
    return balances
      .filter((customer) => (typeFilter === 'All' ? true : customer.type === typeFilter))
      .filter((customer) => {
        if (!q) return true;
        return (
          customer.name.toLowerCase().includes(q) ||
          customer.shortCode.toLowerCase().includes(q)
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
          <h2 className="customer-balances-title">Customer balances</h2>

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
                return (
                  <tr key={customer.id}>
                    <td>
                      <div className="customer-name">
                        {customerRankMap.get(customer.id) ? (
                          <span
                            className={`customer-health-dot ${
                              customerRankMap.get(customer.id)!.healthLabel === 'Excellent'
                                ? 'excellent'
                                : customerRankMap.get(customer.id)!.healthLabel === 'Good'
                                  ? 'good'
                                  : customerRankMap.get(customer.id)!.healthLabel === 'Attention'
                                    ? 'attention'
                                    : 'risk'
                            }`}
                            title={`Health: ${customerRankMap.get(customer.id)!.healthScore}/100 - ${
                              customerRankMap.get(customer.id)!.healthLabel
                            }`}
                          />
                        ) : null}
                        <button
                          type="button"
                          className="customer-name-link"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          {customer.name}
                        </button>
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
        jobs={scopedJobs.filter((j) => j.customerId === selectedCustomer.id)}
        onClose={() => setSelectedCustomer(null)}
      />
    ) : null}
  </>
  );
}
