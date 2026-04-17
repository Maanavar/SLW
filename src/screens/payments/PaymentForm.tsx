import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { DataTable } from '@/components/ui/DataTable';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { formatCurrency } from '@/lib/currencyUtils';
import { getPaymentDisplayId, formatPaymentBreakdown } from '@/lib/paymentUtils';
import { getReportRange, getPaymentsInRange, getJobsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobPaidAmount } from '@/lib/jobUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import type { Payment } from '@/types';
import { RecordPaymentModal } from './RecordPaymentModal';
import { PaymentEditModal } from './PaymentEditModal';
import './PaymentForm.css';

type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'halfyear' | 'year' | 'range' | 'all';

interface PaymentDisplay extends Payment {
  customerName: string;
  source: 'Payment Voucher' | 'Job Paid Entry';
  jobCardId: string;
  jobCardKey?: string;
}

function shiftDate(value: string, days: number): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return getLocalDateString(new Date());
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return getLocalDateString(new Date());
  }
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function formatDayLabel(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return '';
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function PaymentForm() {
  const { payments, jobs, getCustomer, deletePayment } = useDataStore();
  const toast = useToast();
  const today = getLocalDateString(new Date());

  // Payment Report state
  const [reportPeriod, setReportPeriod] = useState<PeriodType>('today');
  const [selectedDay, setSelectedDay] = useState(today);
  const [reportRangeFrom, setReportRangeFrom] = useState('');
  const [reportRangeTo, setReportRangeTo] = useState(today);
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDisplay | null>(null);
  const [filterCustomer, setFilterCustomer] = useState('');

  // Payment Report calculations
  const reportRange = useMemo(() => {
    if (reportPeriod === 'all') {
      return { from: undefined, to: undefined, label: 'All Time' };
    }
    if (reportPeriod === 'range') {
      return { from: reportRangeFrom || undefined, to: reportRangeTo || undefined, label: 'Custom Range' };
    }
    if (reportPeriod === 'today') {
      return { from: selectedDay, to: selectedDay, label: formatDayLabel(selectedDay) };
    }
    const mapped = getReportRange(reportPeriod);
    return { from: mapped.from, to: mapped.to, label: reportPeriod };
  }, [reportPeriod, reportRangeFrom, reportRangeTo, selectedDay]);

  const jobsInReportRange = useMemo(() => getJobsInRange(jobs, reportRange.from, reportRange.to), [jobs, reportRange.from, reportRange.to]);

  const groupedJobCards = useMemo(() => {
    const groups = groupJobsByCard(jobsInReportRange);
    return groups.sort((a, b) => {
      const aTime = new Date(a.primary.createdAt || a.primary.date).getTime();
      const bTime = new Date(b.primary.createdAt || b.primary.date).getTime();
      return bTime - aTime;
    });
  }, [jobsInReportRange]);

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

  const handleDeletePayment = async (payment: PaymentDisplay) => {
    if (payment.id <= 0) {
      toast.error('Error', 'Invalid payment ID');
      return;
    }

    const isJobPayment = payment.source === 'Job Paid Entry';
    const jobPaymentWarning = isJobPayment
      ? '\n\nNote: This only removes the payment record. Edit the job if you need to change the job amount.'
      : '';

    const confirmed = window.confirm(
      `Delete payment of ${formatCurrency(payment.amount)}?${jobPaymentWarning}\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deletePayment(payment.id);
      toast.success('Success', 'Payment deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Error', 'Failed to delete payment');
    }
  };

  const filteredReportPayments = useMemo(() => {
    const inRange = getPaymentsInRange(payments, reportRange.from, reportRange.to);
    return inRange;
  }, [payments, reportRange.from, reportRange.to]);

  const getCardIdFromNotes = (notes?: string): string | undefined => {
    if (!notes) {
      return undefined;
    }
    const match = notes.match(/From JobCard\s+([A-Za-z0-9-]+)/i);
    return match?.[1];
  };

  const fallbackJobPayments = useMemo(() => {
    const paidJobs = jobsInReportRange.filter((job) => getJobPaidAmount(job) > 0);

    return paidJobs.map<PaymentDisplay>((job) => {
      const cardId = job.jobCardId || `LEGACY-${job.id}`;
      return {
        id: -Math.abs(job.id),
        customerId: job.customerId,
        amount: getJobPaidAmount(job),
        date: job.date,
        paymentMode: (job.paymentMode as Payment['paymentMode']) || 'Cash',
        notes: `From JobCard ${cardId}`,
        customerName: getCustomer(job.customerId)?.name || 'Unknown',
        source: 'Job Paid Entry',
        jobCardId: cardId,
        jobCardKey: cardKeyById.get(cardId),
      };
    });
  }, [jobsInReportRange, getCustomer, cardKeyById]);

  const reportPaymentsWithNames: PaymentDisplay[] = useMemo(() => {
    if (filteredReportPayments.length > 0) {
      return filteredReportPayments.map((payment) => {
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
  }, [filteredReportPayments, getCustomer, fallbackJobPayments, cardKeyById]);

  const paymentCustomerOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { name: string }[] = [];
    reportPaymentsWithNames.forEach((p) => {
      if (!seen.has(p.customerName)) {
        seen.add(p.customerName);
        opts.push({ name: p.customerName });
      }
    });
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [reportPaymentsWithNames]);

  const filteredPayments = useMemo(
    () =>
      filterCustomer
        ? reportPaymentsWithNames.filter((p) => p.customerName === filterCustomer)
        : reportPaymentsWithNames,
    [reportPaymentsWithNames, filterCustomer]
  );

  const reportSummary = useMemo(() => {
    const totalReceived = reportPaymentsWithNames.reduce((sum, p) => sum + (p.amount || 0), 0);
    const byCash = reportPaymentsWithNames
      .filter((p) => p.paymentMode === 'Cash')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const byBank = reportPaymentsWithNames
      .filter((p) => p.paymentMode === 'Bank')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const byUPI = reportPaymentsWithNames
      .filter((p) => p.paymentMode === 'UPI')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const byCheque = reportPaymentsWithNames
      .filter((p) => p.paymentMode === 'Cheque')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Calculate total work amount from jobs in range
    const totalWorkAmount = groupedJobCards.reduce((sum, group) => {
      return sum + group.jobs.reduce((jobSum, job) => jobSum + (job.amount || 0), 0);
    }, 0);

    const balanceToReceive = totalWorkAmount - totalReceived;

    return { totalReceived, byCash, byBank, byUPI, byCheque, totalWorkAmount, balanceToReceive };
  }, [reportPaymentsWithNames, groupedJobCards]);
  const selectedDayLabel = formatDayLabel(selectedDay);

  return (
    <div className="payment-form-container">
      <div className="payment-report-container">
        <div className="payment-report-header">
          <h2 className="form-title">Payments</h2>
          <button
            type="button"
            className="btn btn-primary btn-record-payment"
            onClick={() => setIsRecordPaymentOpen(true)}
          >
            Record Payment
          </button>
        </div>

        <div className="report-controls">
          <div>
            <label className="form-label" htmlFor="report-period">Period</label>
            <select
              id="report-period"
              className="form-input"
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value as PeriodType)}
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="halfyear">This Half-Year</option>
              <option value="year">This Year</option>
              <option value="range">Custom Date Range</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {reportPeriod === 'today' ? (
            <div className="payment-day-selector">
              <label className="form-label" htmlFor="payment-day-input">Date</label>
              <div className="payment-day-nav">
                <div className="payment-day-nav-shell">
                  <button
                    type="button"
                    className="payment-day-nav-btn"
                    onClick={() => setSelectedDay(shiftDate(selectedDay, -1))}
                    aria-label="Previous day"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M8.75 3L4.75 7L8.75 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <input
                    id="payment-day-input"
                    type="date"
                    className="form-input payment-day-input"
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    max={today}
                    aria-label={selectedDayLabel || 'Selected date'}
                  />
                  <button
                    type="button"
                    className="payment-day-nav-btn"
                    onClick={() => setSelectedDay(shiftDate(selectedDay, 1))}
                    disabled={selectedDay >= today}
                    aria-label="Next day"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5.25 3L9.25 7L5.25 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <button
                  type="button"
                  className="payment-day-today-btn"
                  onClick={() => setSelectedDay(today)}
                  disabled={selectedDay === today}
                >
                  Today
                </button>
              </div>
            </div>
          ) : null}

          {reportPeriod === 'range' ? (
            <>
              <div>
                <label className="form-label" htmlFor="report-from">From</label>
                <input
                  id="report-from"
                  type="date"
                  className="form-input"
                  value={reportRangeFrom}
                  onChange={(e) => setReportRangeFrom(e.target.value)}
                  max={today}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="report-to">To</label>
                <input
                  id="report-to"
                  type="date"
                  className="form-input"
                  value={reportRangeTo}
                  onChange={(e) => setReportRangeTo(e.target.value)}
                  max={today}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="payment-summary">
          <div className="payment-summary-item">
            <h3>Total Work</h3>
            <p>{formatCurrency(reportSummary.totalWorkAmount)}</p>
          </div>
          <div className="payment-summary-item">
            <h3>Total Received</h3>
            <p>{formatCurrency(reportSummary.totalReceived)}</p>
          </div>
          <div className="payment-summary-item highlight">
            <h3>Balance to Receive</h3>
            <p>{formatCurrency(reportSummary.balanceToReceive)}</p>
          </div>
          <div className="payment-summary-item">
            <h3>Cash</h3>
            <p>{formatCurrency(reportSummary.byCash)}</p>
          </div>
          <div className="payment-summary-item">
            <h3>Bank</h3>
            <p>{formatCurrency(reportSummary.byBank)}</p>
          </div>
          <div className="payment-summary-item">
            <h3>UPI</h3>
            <p>{formatCurrency(reportSummary.byUPI)}</p>
          </div>
          <div className="payment-summary-item">
            <h3>Cheque</h3>
            <p>{formatCurrency(reportSummary.byCheque)}</p>
          </div>
        </div>

        <div className="payment-filters">
          <select
            className="form-input payment-filter-select"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            title="Filter by customer"
          >
            <option value="">All Customers</option>
            {paymentCustomerOptions.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          {filterCustomer && (
            <button
              type="button"
              className="payment-filter-clear"
              onClick={() => setFilterCustomer('')}
              title="Clear filter"
            >
              ✕ Clear
            </button>
          )}
        </div>

        <DataTable<PaymentDisplay>
          columns={[
            { key: 'date', label: 'Date', sortable: true },
            {
              key: 'id',
              label: 'Payment ID',
              render: (_, row) => getPaymentDisplayId(row),
            },
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
            {
              key: 'paymentMode',
              label: 'Mode / Breakdown',
              render: (_, row) => formatPaymentBreakdown(row),
              sortable: true,
            },
            { key: 'source', label: 'Source', sortable: true },
            { key: 'notes', label: 'Notes' },
            {
              key: 'id',
              label: 'Actions',
              render: (_, row) => {
                const isJobPayment = row.source !== 'Payment Voucher';
                return (
                  <div className="payment-table-actions">
                    <button
                      type="button"
                      className="icon-btn icon-edit"
                      onClick={(e) => {
                        if (isJobPayment) return;
                        e.stopPropagation();
                        setSelectedPayment(row);
                      }}
                      title={isJobPayment ? 'Auto-recorded job payments cannot be edited — edit from the job card' : 'Edit payment'}
                      aria-label="Edit"
                      disabled={isJobPayment}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePayment(row);
                      }}
                      title={isJobPayment ? 'Delete auto-recorded job payment' : 'Delete payment'}
                      aria-label="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                );
              },
            },
          ]}
          data={filteredPayments}
          keyFn={(item) => item.id}
          sortBy="date"
          sortOrder="desc"
          emptyMessage="No payment data found in this period"
        />
      </div>

      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
      />

      <PaymentEditModal
        isOpen={selectedPayment !== null}
        payment={selectedPayment}
        customerName={selectedPayment?.customerName || ''}
        onClose={() => setSelectedPayment(null)}
      />

      <JobCardDetailsModal
        isOpen={Boolean(selectedGroup)}
        jobs={selectedGroup?.jobs || null}
        onClose={() => setSelectedCardKey(null)}
        getCustomer={getCustomer}
        onDelete={undefined}
      />
    </div>
  );
}
