import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { PaymentModeGroup } from '@/components/ui/PaymentModeGroup';
import { formatCurrency } from '@/lib/currencyUtils';
import {
  getLocalDateString,
  getMonthInputString,
  getWeekStartDate,
  isDateInRange,
} from '@/lib/dateUtils';
import { calculateCustomerBalance, getJobNetValue, getJobPaidAmount, getJobCardPaymentSummary } from '@/lib/jobUtils';
import { getReportRange, getPaymentsInRange, getJobsInRange, groupJobsByCard } from '@/lib/reportUtils';
import type { Customer, Job, Payment } from '@/types';
import './PaymentForm.css';

type PaymentMode = 'cash' | 'upi' | 'bank' | 'cheque';
type PaymentScope = 'manual' | 'week' | 'month' | 'range';
type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'halfyear' | 'year' | 'range' | 'all';

interface PaymentDisplay extends Payment {
  customerName: string;
  source: 'Payment Voucher' | 'Job Paid Entry';
  jobCardId: string;
  jobCardKey?: string;
}

function getMonthRange(month: string, today: string): { from: string; to: string } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const mon = Number(monthStr);
  const monthStart = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const monthEnd = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  return {
    from: monthStart,
    to: monthEnd > today ? today : monthEnd,
  };
}

export function PaymentForm() {
  const { getActiveCustomers, payments, addPayment, jobs, updateJob, getCustomer } = useDataStore();
  const toast = useToast();

  const customers = getActiveCustomers();
  const today = getLocalDateString(new Date());
  const currentMonth = getMonthInputString(new Date());

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentScope, setPaymentScope] = useState<PaymentScope>('manual');
  const [weekFrom, setWeekFrom] = useState(getWeekStartDate(new Date()));
  const [weekTo, setWeekTo] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState(today);
  const [notes, setNotes] = useState('');

  // Payment Report state
  const [reportPeriod, setReportPeriod] = useState<PeriodType>('month');
  const [reportRangeFrom, setReportRangeFrom] = useState('');
  const [reportRangeTo, setReportRangeTo] = useState(today);
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);

  const customerBalance = useMemo(() => {
    if (!selectedCustomer) return { balance: 0 };
    return {
      balance: calculateCustomerBalance(jobs, payments, selectedCustomer.id),
    };
  }, [selectedCustomer, jobs, payments]);

  const scopeRange = useMemo(() => {
    if (paymentScope === 'week') {
      return { from: weekFrom, to: weekTo, label: `${weekFrom} to ${weekTo}` };
    }
    if (paymentScope === 'month') {
      const { from, to } = getMonthRange(selectedMonth, today);
      return { from, to, label: selectedMonth };
    }
    if (paymentScope === 'range') {
      return { from: rangeFrom, to: rangeTo, label: `${rangeFrom} to ${rangeTo}` };
    }
    return null;
  }, [paymentScope, weekFrom, weekTo, selectedMonth, rangeFrom, rangeTo, today]);

  const scopedJobs = useMemo(() => {
    if (!selectedCustomer || !scopeRange) {
      return [] as Job[];
    }

    return jobs.filter(
      (job) =>
        job.customerId === selectedCustomer.id &&
        isDateInRange(job.date, scopeRange.from, scopeRange.to)
    );
  }, [selectedCustomer, jobs, scopeRange]);

  const scopedPendingAmount = useMemo(() => {
    return scopedJobs.reduce((sum, job) => {
      const pending = getJobNetValue(job) - getJobPaidAmount(job);
      return sum + (pending > 0 ? pending : 0);
    }, 0);
  }, [scopedJobs]);

  useEffect(() => {
    if (paymentScope !== 'manual') {
      setAmount(scopedPendingAmount > 0 ? String(scopedPendingAmount) : '');
    }
  }, [paymentScope, scopedPendingAmount]);

  const allPayments = useMemo(() => {
    if (!selectedCustomer) return [];
    return payments
      .filter((p) => p.customerId === selectedCustomer.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedCustomer, payments]);

  // Payment Report calculations
  const reportRange = useMemo(() => {
    if (reportPeriod === 'all') {
      return { from: undefined, to: undefined, label: 'All Time' };
    }
    if (reportPeriod === 'range') {
      return { from: reportRangeFrom || undefined, to: reportRangeTo || undefined, label: 'Custom Range' };
    }
    const mapped = getReportRange(reportPeriod);
    return { from: mapped.from, to: mapped.to, label: reportPeriod };
  }, [reportPeriod, reportRangeFrom, reportRangeTo]);

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

  const reportSummary = useMemo(() => {
    const total = reportPaymentsWithNames.reduce((sum, p) => sum + (p.amount || 0), 0);
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

    return { total, byCash, byBank, byUPI, byCheque };
  }, [reportPaymentsWithNames]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast.error('Error', 'Please select a customer');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Error', 'Please enter a valid amount');
      return;
    }

    if (paymentDate > today) {
      toast.error('Error', 'Future payment date is not allowed');
      return;
    }

    if (paymentScope !== 'manual') {
      if (!scopeRange?.from || !scopeRange?.to) {
        toast.error('Error', 'Please select a valid date scope');
        return;
      }

      if (scopeRange.from > scopeRange.to) {
        toast.error('Error', 'Start date must be before end date');
        return;
      }

      if (scopeRange.from > today || scopeRange.to > today) {
        toast.error('Error', 'Future dates are not allowed');
        return;
      }

      if (scopedJobs.length === 0) {
        toast.error('Error', 'No jobs found in selected scope');
        return;
      }

      if (parseFloat(amount) < scopedPendingAmount) {
        toast.error('Error', 'Amount must cover full selected scope balance');
        return;
      }
    }

    try {
      const modeMap: Record<PaymentMode, 'Cash' | 'UPI' | 'Bank' | 'Cheque'> = {
        cash: 'Cash',
        upi: 'UPI',
        bank: 'Bank',
        cheque: 'Cheque',
      };

      const newPayment: Payment = {
        id: Date.now(),
        customerId: selectedCustomer.id,
        amount: parseFloat(amount),
        paymentMode: modeMap[paymentMode],
        date: paymentDate,
        paymentForMonth: paymentScope === 'month' ? selectedMonth : undefined,
        paymentForFromDate:
          paymentScope === 'week' || paymentScope === 'range'
            ? scopeRange?.from
            : undefined,
        paymentForDate:
          paymentScope === 'week' || paymentScope === 'range'
            ? scopeRange?.to
            : undefined,
        notes: notes || undefined,
      };

      addPayment(newPayment);

      // Update jobs based on payment scope
      if (paymentScope !== 'manual') {
        // For week/month/range scope, mark all scoped jobs as fully paid
        scopedJobs.forEach((job) => {
          const currentPaid = getJobPaidAmount(job);
          const net = getJobNetValue(job);
          const pending = Math.max(0, net - currentPaid);

          updateJob(job.id, {
            paidAmount: currentPaid + pending,
            paymentStatus: 'Paid',
            paymentMode: modeMap[paymentMode],
          });
        });
      } else {
        // For manual scope, apply payment to outstanding jobs
        const customerOutstandingJobs = jobs.filter(
          (job) =>
            job.customerId === selectedCustomer.id &&
            getJobNetValue(job) - getJobPaidAmount(job) > 0
        );

        let remainingAmount = parseFloat(amount);

        for (const job of customerOutstandingJobs) {
          if (remainingAmount <= 0) break;

          const currentPaid = getJobPaidAmount(job);
          const net = getJobNetValue(job);
          const pending = Math.max(0, net - currentPaid);

          if (pending === 0) continue;

          const paymentAllocation = Math.min(remainingAmount, pending);
          const newPaidAmount = currentPaid + paymentAllocation;
          const isFullyPaid = Math.abs(newPaidAmount - net) < 0.01; // Handle floating point

          updateJob(job.id, {
            paidAmount: newPaidAmount,
            paymentStatus: isFullyPaid ? 'Paid' : 'Partially Paid',
            paymentMode: modeMap[paymentMode],
          });

          remainingAmount -= paymentAllocation;
        }
      }

      toast.success(
        'Success',
        paymentScope === 'manual'
          ? `Payment of ${formatCurrency(parseFloat(amount))} recorded`
          : `Payment recorded and ${scopedJobs.length} job(s) marked paid`
      );

      setAmount('');
      setPaymentMode('cash');
      setPaymentDate(today);
      setPaymentScope('manual');
      setWeekFrom(getWeekStartDate(new Date()));
      setWeekTo(today);
      setSelectedMonth(currentMonth);
      setRangeFrom('');
      setRangeTo(today);
      setNotes('');
    } catch {
      toast.error('Error', 'Failed to record payment');
    }
  };

  return (
    <div className="payment-form-container">
      <div className="form-section">
        <h2 className="form-title">Record Payment</h2>

        <form onSubmit={handleSubmit} className="payment-form">
          <div className="form-group">
            <label className="form-label" htmlFor="customer-select">
              Customer
            </label>
            <SearchableSelect
              items={customers}
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              getLabel={(c) => `${c.name} (${c.shortCode})`}
              getKey={(c) => String(c.id)}
              placeholder="Select customer..."
            />
          </div>

          {selectedCustomer ? (
            <div className="balance-info">
              <div className="balance-item">
                <span className="balance-label">Outstanding Balance</span>
                <span className={`balance-amount ${customerBalance.balance > 0 ? 'positive' : ''}`}>
                  {formatCurrency(customerBalance.balance)}
                </span>
              </div>
              {paymentScope !== 'manual' ? (
                <div className="balance-item scoped-balance-row">
                  <span className="balance-label">Selected Scope Balance</span>
                  <span className="balance-amount positive">{formatCurrency(scopedPendingAmount)}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="form-group">
            <label className="form-label">Payment Scope</label>
            <div className="scope-buttons">
              <button
                type="button"
                className={`scope-btn ${paymentScope === 'manual' ? 'active' : ''}`}
                onClick={() => setPaymentScope('manual')}
              >
                Manual
              </button>
              <button
                type="button"
                className={`scope-btn ${paymentScope === 'week' ? 'active' : ''}`}
                onClick={() => setPaymentScope('week')}
              >
                Week
              </button>
              <button
                type="button"
                className={`scope-btn ${paymentScope === 'month' ? 'active' : ''}`}
                onClick={() => setPaymentScope('month')}
              >
                Month
              </button>
              <button
                type="button"
                className={`scope-btn ${paymentScope === 'range' ? 'active' : ''}`}
                onClick={() => setPaymentScope('range')}
              >
                Date Range
              </button>
            </div>
          </div>

          {paymentScope === 'week' ? (
            <div className="scope-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="week-from">
                  Week From
                </label>
                <input
                  id="week-from"
                  type="date"
                  className="form-input"
                  value={weekFrom}
                  onChange={(e) => setWeekFrom(e.target.value)}
                  max={today}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="week-to">
                  Week To
                </label>
                <input
                  id="week-to"
                  type="date"
                  className="form-input"
                  value={weekTo}
                  onChange={(e) => setWeekTo(e.target.value)}
                  max={today}
                />
              </div>
            </div>
          ) : null}

          {paymentScope === 'month' ? (
            <div className="form-group">
              <label className="form-label" htmlFor="payment-month">
                Month
              </label>
              <input
                id="payment-month"
                type="month"
                className="form-input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                max={currentMonth}
              />
            </div>
          ) : null}

          {paymentScope === 'range' ? (
            <div className="scope-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="range-from">
                  Range From
                </label>
                <input
                  id="range-from"
                  type="date"
                  className="form-input"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  max={today}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="range-to">
                  Range To
                </label>
                <input
                  id="range-to"
                  type="date"
                  className="form-input"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  max={today}
                />
              </div>
            </div>
          ) : null}

          <div className="form-group">
            <label className="form-label" htmlFor="amount">
              Amount (INR)
            </label>
            <input
              id="amount"
              type="number"
              className="form-input"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <PaymentModeGroup value={paymentMode} onChange={setPaymentMode} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="payment-date">
              Payment Date
            </label>
            <input
              id="payment-date"
              type="date"
              className="form-input"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={today}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              className="form-textarea"
              placeholder="Add any notes about this payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-submit" disabled={!selectedCustomer}>
            Record Payment
          </button>
        </form>
      </div>

      {selectedCustomer && allPayments.length > 0 ? (
        <div className="payment-history-section">
          <h3 className="section-title">Payment History</h3>
          <DataTable<Payment>
            columns={[
              { key: 'date', label: 'Date', sortable: true },
              {
                key: 'amount',
                label: 'Amount',
                render: (value) => formatCurrency(value as number),
              },
              { key: 'paymentMode', label: 'Mode', sortable: true },
              {
                key: 'paymentForMonth',
                label: 'Period',
                render: (value, row) => {
                  if (row.paymentForMonth) return `Month: ${row.paymentForMonth}`;
                  if (row.paymentForFromDate && row.paymentForDate) {
                    return `Range: ${row.paymentForFromDate} to ${row.paymentForDate}`;
                  }
                  return 'Manual';
                },
              },
              { key: 'notes', label: 'Notes' },
            ]}
            data={allPayments}
            keyFn={(item) => item.id}
            sortBy="date"
            sortOrder="desc"
            emptyMessage="No payments recorded for this customer"
          />
        </div>
      ) : null}

      <div className="payment-report-section">
        <h3 className="section-title">Payment Report</h3>
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
            <h3>Total Received</h3>
            <p>{formatCurrency(reportSummary.total)}</p>
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

        <DataTable<PaymentDisplay>
          columns={[
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
          ]}
          data={reportPaymentsWithNames}
          keyFn={(item) => item.id}
          sortBy="date"
          sortOrder="desc"
          emptyMessage="No payment data found in this period"
        />

        {groupedJobCards.length > 0 ? (
          <div className="payment-jobcards">
            <h3 className="payment-jobcards-title">Job Cards</h3>
            <div className="payment-jobcards-grid">
              {groupedJobCards.map((group) => {
                const cardId = group.primary.jobCardId || `LEGACY-${group.primary.id}`;
                const cardCustomerName = getCustomer(group.primary.customerId)?.name || 'Unknown';
                const payment = getJobCardPaymentSummary(group.jobs);

                return (
                  <div
                    key={group.key}
                    onClick={() => setSelectedCardKey(group.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCardKey(group.key);
                      }
                    }}
                    className="payment-jobcard"
                  >
                    <div className="payment-jobcard-header">
                      <span className="payment-jobcard-id">{cardId}</span>
                      <StatusBadge status={payment.status} />
                    </div>
                    <div className="payment-jobcard-body">
                      <div>{cardCustomerName}</div>
                      <div>{group.lineCount} lines</div>
                      <div>Net: {formatCurrency(payment.net)}</div>
                      <div>Paid: {formatCurrency(payment.paid)}</div>
                      <div>Pending: {formatCurrency(payment.pending)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

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
