/**
 * Customer Balances Table Component
 * Shows customer balances with type filtering
 */

import { useState, useMemo } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { DataTable, Column } from '@/components/ui/DataTable';
import { TypeBadge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobNetValue, getJobPaidAmount } from '@/lib/jobUtils';
import { Customer } from '@/types';

interface CustomerBalance extends Customer {
  ourIncome: number;
  commission: number;
  finalBill: number;
  paidAmount: number;
  balance: number;
  advance: number;
}

interface CustomerBalancesTableProps {
  showFilters?: boolean;
  dateRange?: { from: string; to: string };
}

export function CustomerBalancesTable({ showFilters = true, dateRange }: CustomerBalancesTableProps) {
  const { getActiveCustomers, jobs } = useDataStore();
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState('');

  const customers = getActiveCustomers().sort((a, b) => a.name.localeCompare(b.name));

  const scopedJobs = useMemo(
    () => dateRange ? jobs.filter(j => j.date >= dateRange.from && j.date <= dateRange.to) : jobs,
    [jobs, dateRange]
  );

  // Calculate balances for all customers
  // Paid is derived from job.paidAmount only (same as Records page) to avoid
  // double-counting payment records that were already allocated back to jobs.
  const customersWithBalances: CustomerBalance[] = useMemo(() => {
    return customers.map((customer) => {
      const customerJobs = scopedJobs.filter((j) => j.customerId === customer.id);

      const totalNet = customerJobs.reduce((sum, j) => sum + getJobNetValue(j), 0);
      const totalCommission = customerJobs.reduce(
        (sum, j) => sum + (Number(j.commissionAmount) || 0),
        0
      );
      const finalBill = totalNet + totalCommission;
      const paidFromJobs = customerJobs.reduce((sum, j) => sum + getJobPaidAmount(j), 0);
      const balance = finalBill - paidFromJobs;

      return {
        ...customer,
        ourIncome: totalNet,
        commission: totalCommission,
        finalBill,
        paidAmount: paidFromJobs,
        balance,
        advance: customer.advanceBalance || 0,
      };
    });
  }, [customers, scopedJobs]);

  // Filter by type if selected, and show only customers with non-zero balance or advance
  const filteredByType = typeFilter
    ? customersWithBalances.filter((c) => c.type === typeFilter && (c.balance !== 0 || c.advance > 0 || c.ourIncome > 0))
    : customersWithBalances.filter((c) => c.balance !== 0 || c.advance > 0 || c.ourIncome > 0);

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
      key: 'finalBill',
      label: 'Final Bill',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'paidAmount',
      label: 'Paid Amount',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'advance',
      label: 'Advance',
      render: (value) => {
        const advance = value as number;
        return advance > 0 ? <span className="balance-negative">{formatCurrency(advance)}</span> : <span>-</span>;
      },
    },
    {
      key: 'balance',
      label: 'Balance',
      sortable: true,
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
      finalBill: sorted.reduce((sum, c) => sum + c.finalBill, 0),
      totalPaid: sorted.reduce((sum, c) => sum + c.paidAmount, 0),
      totalBalance: sorted.reduce((sum, c) => sum + c.balance, 0),
    };
  }, [sorted]);

  return (
    <div className="customer-balances">
      {showFilters && (
        <div className="balances-header">
          <div className="balances-title-wrap">
            <h3 className="balances-title">Open Customer Positions</h3>
            <p className="balances-subtitle">Showing customers with non-zero balance or advance.</p>
          </div>
          <div className="type-filters">
            <input
              type="text"
              className="search-input"
              placeholder="Filter customer name..."
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            />
            <div className="type-filter-buttons">
              <button className={`filter-btn ${!typeFilter ? 'active' : ''}`} onClick={() => setTypeFilter(null)} type="button">All Types</button>
              <button className={`filter-btn ${typeFilter === 'Monthly' ? 'active' : ''}`} onClick={() => setTypeFilter('Monthly')} type="button">Pay by month</button>
              <button className={`filter-btn ${typeFilter === 'Invoice' ? 'active' : ''}`} onClick={() => setTypeFilter('Invoice')} type="button">Pay by Invoice</button>
              <button className={`filter-btn ${typeFilter === 'Party-Credit' ? 'active' : ''}`} onClick={() => setTypeFilter('Party-Credit')} type="button">Party-Credit</button>
              <button className={`filter-btn ${typeFilter === 'Cash' ? 'active' : ''}`} onClick={() => setTypeFilter('Cash')} type="button">Cash</button>
            </div>
          </div>
        </div>
      )}

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
          <span className="stat-label">Final Bill:</span>
          <span className="stat-value">{formatCurrency(summary.finalBill)}</span>
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
          emptyMessage={customers.length === 0 ? 'No customers yet — add customers to track balances' : 'All customers are fully settled'}
        />
      </div>
    </div>
  );
}
