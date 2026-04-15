/**
 * Customer Balances Table Component
 * Shows customer balances with type filtering
 */

import { useState, useMemo } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { DataTable, Column } from '@/components/ui/DataTable';
import { TypeBadge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/currencyUtils';
import { calculateCustomerBalance, getJobNetValue, getJobPaidAmount } from '@/lib/jobUtils';
import { Customer } from '@/types';

interface CustomerBalance extends Customer {
  ourIncome: number;
  commission: number;
  netIncome: number;
  paidAmount: number;
  balance: number;
}

export function CustomerBalancesTable() {
  const { getActiveCustomers, jobs, payments } = useDataStore();
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState('');

  const customers = getActiveCustomers().sort((a, b) => a.name.localeCompare(b.name));

  // Calculate balances for all customers
  const customersWithBalances: CustomerBalance[] = useMemo(() => {
    return customers.map((customer) => {
      const customerJobs = jobs.filter((j) => j.customerId === customer.id);
      const customerPayments = payments.filter((p) => p.customerId === customer.id);

      const totalNet = customerJobs.reduce((sum, j) => sum + getJobNetValue(j), 0);
      const totalCommission = customerJobs.reduce(
        (sum, j) => sum + (Number(j.commissionAmount) || 0),
        0
      );
      const paidFromJobs = customerJobs.reduce((sum, j) => sum + getJobPaidAmount(j), 0);
      const paidFromPayments = customerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const balance = calculateCustomerBalance(jobs, payments, customer.id);

      return {
        ...customer,
        ourIncome: totalNet,
        commission: totalCommission,
        netIncome: totalNet + totalCommission,
        paidAmount: paidFromJobs + paidFromPayments,
        balance,
      };
    });
  }, [customers, jobs, payments]);

  // Filter by type if selected, and show only customers with non-zero balance
  const filteredByType = typeFilter
    ? customersWithBalances.filter((c) => c.type === typeFilter && c.balance !== 0)
    : customersWithBalances.filter((c) => c.balance !== 0);

  const filtered = customerFilter.trim()
    ? filteredByType.filter((c) =>
        c.name.toLowerCase().includes(customerFilter.trim().toLowerCase())
      )
    : filteredByType;

  // Sort by balance (highest first)
  const sorted = [...filtered].sort((a, b) => b.balance - a.balance);

  const columns: Column<CustomerBalance>[] = [
    {
      key: 'name',
      label: 'Customer Name',
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
      render: (value) => <TypeBadge type={value as string} />,
    },
    {
      key: 'ourIncome',
      label: 'Our Income',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'commission',
      label: 'Commission',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'netIncome',
      label: 'Net Income',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'paidAmount',
      label: 'Paid Amount',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (value) => {
        const balance = value as number;
        const className = balance > 0 ? 'balance-positive' : balance < 0 ? 'balance-negative' : '';
        return <span className={className}>{formatCurrency(balance)}</span>;
      },
    },
  ];


  // Calculate summary
  const summary = useMemo(() => {
    return {
      totalCustomers: sorted.length,
      ourIncome: sorted.reduce((sum, c) => sum + c.ourIncome, 0),
      commission: sorted.reduce((sum, c) => sum + c.commission, 0),
      netIncome: sorted.reduce((sum, c) => sum + c.netIncome, 0),
      totalPaid: sorted.reduce((sum, c) => sum + c.paidAmount, 0),
      totalBalance: sorted.reduce((sum, c) => sum + c.balance, 0),
    };
  }, [sorted]);

  return (
    <div className="customer-balances">
      <div className="balances-header">
        <h3 className="balances-title">Customer Balances</h3>
        <div className="type-filters">
          <input
            type="text"
            className="search-input"
            placeholder="Filter customer name..."
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          />
          <button
            className={`filter-btn ${!typeFilter ? 'active' : ''}`}
            onClick={() => setTypeFilter(null)}
            type="button"
          >
            All Types
          </button>
          <button
            className={`filter-btn ${typeFilter === 'Monthly' ? 'active' : ''}`}
            onClick={() => setTypeFilter('Monthly')}
            type="button"
          >
            Monthly
          </button>
          <button
            className={`filter-btn ${typeFilter === 'Invoice' ? 'active' : ''}`}
            onClick={() => setTypeFilter('Invoice')}
            type="button"
          >
            Invoice
          </button>
          <button
            className={`filter-btn ${typeFilter === 'Party-Credit' ? 'active' : ''}`}
            onClick={() => setTypeFilter('Party-Credit')}
            type="button"
          >
            Party-Credit
          </button>
          <button
            className={`filter-btn ${typeFilter === 'Cash' ? 'active' : ''}`}
            onClick={() => setTypeFilter('Cash')}
            type="button"
          >
            Cash
          </button>
        </div>
      </div>

      <div className="balances-summary">
        <div className="summary-stat">
          <span className="stat-label">Customers:</span>
          <span className="stat-value">{summary.totalCustomers}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Our Income:</span>
          <span className="stat-value">{formatCurrency(summary.ourIncome)}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Commission:</span>
          <span className="stat-value">{formatCurrency(summary.commission)}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Net Income:</span>
          <span className="stat-value">{formatCurrency(summary.netIncome)}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Total Paid:</span>
          <span className="stat-value">{formatCurrency(summary.totalPaid)}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Total Balance:</span>
          <span className={`stat-value ${summary.totalBalance > 0 ? 'positive' : summary.totalBalance < 0 ? 'negative' : ''}`}>
            {formatCurrency(summary.totalBalance)}
          </span>
        </div>
      </div>

      <div className="balances-table">
        <DataTable<CustomerBalance>
          columns={columns}
          data={sorted}
          keyFn={(item) => item.id}
          sortBy="balance"
          sortOrder="desc"
          emptyMessage="No customers found"
        />
      </div>
    </div>
  );
}
