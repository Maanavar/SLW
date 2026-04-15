import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { StatusBadge } from '@/components/ui/Badge';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { DataTable, Column } from '@/components/ui/DataTable';
import { formatCurrency } from '@/lib/currencyUtils';
import { getReportRange, getPaymentsInRange, getJobsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobCardPaymentSummary, getJobPaidAmount } from '@/lib/jobUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { Payment } from '@/types';
import '../customers/CustomersScreen.css';
import './PaymentReportScreen.css';

type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'halfyear' | 'year' | 'range' | 'all';

interface PaymentDisplay extends Payment {
  customerName: string;
  source: 'Payment Voucher' | 'Job Paid Entry';
  jobCardId: string;
  jobCardKey?: string;
}

export function PaymentReportScreen() {
  const { payments, jobs, getCustomer, getActiveCustomers } = useDataStore();
  const [period, setPeriod] = useState<PeriodType>('month');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState(getLocalDateString(new Date()));
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const today = getLocalDateString(new Date());
  const customers = getActiveCustomers().sort((a, b) => a.name.localeCompare(b.name));

  const range = useMemo(() => {
    if (period === 'all') {
      return { from: undefined, to: undefined };
    }
    if (period === 'range') {
      return { from: rangeFrom || undefined, to: rangeTo || undefined };
    }

    return getReportRange(period);
  }, [period, rangeFrom, rangeTo]);

  const jobsInScope = useMemo(() => {
    const inRange = getJobsInRange(jobs, range.from, range.to);
    return selectedCustomerId
      ? inRange.filter((job) => job.customerId === selectedCustomerId)
      : inRange;
  }, [jobs, range.from, range.to, selectedCustomerId]);

  const groupedJobCards = useMemo(() => {
    const groups = groupJobsByCard(jobsInScope);
    return groups.sort((a, b) => {
      const aTime = new Date(a.primary.createdAt || a.primary.date).getTime();
      const bTime = new Date(b.primary.createdAt || b.primary.date).getTime();
      return bTime - aTime;
    });
  }, [jobsInScope]);

  const cardKeyById = useMemo(
    () =>
      new Map(
        groupedJobCards.map((group) => [
          group.primary.jobCardId || `LEGACY-${group.primary.id}`,
          group.key,
        ])
      ),
    [groupedJobCards]
  );

  const selectedGroup = useMemo(
    () => groupedJobCards.find((group) => group.key === selectedCardKey) || null,
    [groupedJobCards, selectedCardKey]
  );

  const filteredPayments = useMemo(() => {
    const inRange = getPaymentsInRange(payments, range.from, range.to);
    return selectedCustomerId
      ? inRange.filter((p) => p.customerId === selectedCustomerId)
      : inRange;
  }, [payments, range.from, range.to, selectedCustomerId]);

  const getCardIdFromNotes = (notes?: string): string | undefined => {
    if (!notes) {
      return undefined;
    }
    const match = notes.match(/From JobCard\s+([A-Za-z0-9-]+)/i);
    return match?.[1];
  };

  const fallbackJobPayments = useMemo(() => {
    const paidJobs = jobsInScope.filter((job) => getJobPaidAmount(job) > 0);

    return paidJobs.map<PaymentDisplay>((job) => {
      const cardId = job.jobCardId || `LEGACY-${job.id}`;
      return {
      id: -Math.abs(job.id),
      customerId: job.customerId,
      amount: getJobPaidAmount(job),
      date: job.date,
      paymentMode:
        (job.paymentMode as Payment['paymentMode']) || 'Cash',
      notes: `From JobCard ${cardId}`,
      customerName: getCustomer(job.customerId)?.name || 'Unknown',
      source: 'Job Paid Entry',
      jobCardId: cardId,
      jobCardKey: cardKeyById.get(cardId),
    };
    });
  }, [jobsInScope, getCustomer, cardKeyById]);

  const paymentsWithNames: PaymentDisplay[] = useMemo(() => {
    if (filteredPayments.length > 0) {
      return filteredPayments.map((payment) => {
        const linkedCardId = getCardIdFromNotes(payment.notes);
        return {
          ...payment,
          customerName: getCustomer(payment.customerId)?.name || 'Unknown',
          source: 'Payment Voucher',
          jobCardId: linkedCardId || '-',
          jobCardKey: linkedCardId ? cardKeyById.get(linkedCardId) : undefined,
        };
      });
    }

    return fallbackJobPayments;
  }, [filteredPayments, getCustomer, fallbackJobPayments, cardKeyById]);

  const summary = useMemo(() => {
    const total = paymentsWithNames.reduce((sum, p) => sum + (p.amount || 0), 0);
    const byCash = paymentsWithNames
      .filter((p) => p.paymentMode === 'Cash')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const byBank = paymentsWithNames
      .filter((p) => p.paymentMode === 'Bank')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const byUPI = paymentsWithNames
      .filter((p) => p.paymentMode === 'UPI')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const byCheque = paymentsWithNames
      .filter((p) => p.paymentMode === 'Cheque')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return { total, byCash, byBank, byUPI, byCheque };
  }, [paymentsWithNames]);

  const columns: Column<PaymentDisplay>[] = [
    { key: 'date', label: 'Date', sortable: true },
    {
      key: 'jobCardId',
      label: 'JobCard',
      render: (value, row) =>
        row.jobCardKey ? (
          <button
            type="button"
            className="jobcard-link-btn"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCardKey(row.jobCardKey || null);
            }}
          >
            {String(value)}
          </button>
        ) : (
          String(value)
        ),
    },
    { key: 'customerName', label: 'Customer', sortable: true },
    {
      key: 'amount',
      label: 'Amount',
      render: (value) => formatCurrency(value as number),
    },
    { key: 'paymentMode', label: 'Mode', sortable: true },
    { key: 'source', label: 'Source', sortable: true },
    { key: 'notes', label: 'Notes' },
  ];

  return (
    <div className="customers-screen">
      <div className="screen-header">
        <h2 className="screen-title">Payment Report</h2>
        <div className="screen-controls">
          <select
            className="search-input"
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodType)}
            title="Select reporting period"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="halfyear">This Half-Year</option>
            <option value="year">This Year</option>
            <option value="range">Date Range</option>
            <option value="all">All Time</option>
          </select>
          {period === 'range' ? (
            <>
              <input
                type="date"
                className="search-input"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                max={today}
              />
              <input
                type="date"
                className="search-input"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                max={today}
              />
            </>
          ) : null}
          <SearchableCustomer
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        </div>
      </div>

      <div className="screen-content">
        <div className="payment-summary">
          <div className="payment-summary-item">
            <h3>Total Received</h3>
            <p className="large-value">{formatCurrency(summary.total)}</p>
          </div>
          <div className="payment-summary-item">
            <h3>Cash</h3>
            <p className="value">{formatCurrency(summary.byCash)}</p>
          </div>
          <div className="payment-summary-item">
            <h3>Bank</h3>
            <p className="value">{formatCurrency(summary.byBank)}</p>
          </div>
          <div className="payment-summary-item">
            <h3>UPI</h3>
            <p className="value">{formatCurrency(summary.byUPI)}</p>
          </div>
          <div className="payment-summary-item">
            <h3>Cheque</h3>
            <p className="value">{formatCurrency(summary.byCheque)}</p>
          </div>
        </div>

        <DataTable<PaymentDisplay>
          columns={columns}
          data={paymentsWithNames}
          keyFn={(item) => item.id}
          sortBy="date"
          sortOrder="desc"
          emptyMessage="No payment data found in this period"
        />

        <div className="payment-jobcards-section">
          <h3 className="payment-jobcards-title">JobCards</h3>
          <div className="payment-jobcards-grid">
            {groupedJobCards.length > 0 ? (
              groupedJobCards.map((group) => {
                const cardId = group.primary.jobCardId || `LEGACY-${group.primary.id}`;
                const customerName = getCustomer(group.primary.customerId)?.name || 'Unknown';
                const payment = getJobCardPaymentSummary(group.jobs);

                return (
                  <div
                    key={group.key}
                    className="payment-jobcard payment-jobcard-clickable"
                    onClick={() => setSelectedCardKey(group.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCardKey(group.key);
                      }
                    }}
                  >
                    <div className="payment-jobcard-header">
                      <span className="payment-jobcard-id">{cardId}</span>
                      <StatusBadge status={payment.status} />
                    </div>
                    <div className="payment-jobcard-body">
                      <span>{customerName}</span>
                      <span>{group.lineCount} lines</span>
                      <span>Net: {formatCurrency(payment.net)}</span>
                      <span>Paid: {formatCurrency(payment.paid)}</span>
                      <span>Pending: {formatCurrency(payment.pending)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="payment-jobcards-empty">No JobCards found in this period</div>
            )}
          </div>
        </div>
      </div>

      <JobCardDetailsModal
        isOpen={Boolean(selectedGroup)}
        jobs={selectedGroup?.jobs || null}
        onClose={() => setSelectedCardKey(null)}
        getCustomer={getCustomer}
        onEdit={undefined}
        onDelete={undefined}
      />
    </div>
  );
}

function SearchableCustomer({
  customers,
  selectedCustomerId,
  setSelectedCustomerId,
}: {
  customers: Array<{ id: number; name: string }>;
  selectedCustomerId: number | null;
  setSelectedCustomerId: (id: number | null) => void;
}) {
  return (
    <select
      className="search-input"
      value={selectedCustomerId ?? 0}
      onChange={(e) => {
        const value = Number(e.target.value);
        setSelectedCustomerId(value === 0 ? null : value);
      }}
      title="Filter by customer"
    >
      <option value={0}>All Clients</option>
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customer.name}
        </option>
      ))}
    </select>
  );
}
