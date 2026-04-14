import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { DataTable, Column } from '@/components/ui/DataTable';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { PaymentModeGroup } from '@/components/ui/PaymentModeGroup';
import { formatCurrency } from '@/lib/currencyUtils';
import {
  getLocalDateString,
  getMonthInputString,
  getWeekStartDate,
  isDateInRange,
} from '@/lib/dateUtils';
import { calculateCustomerBalance, getJobNetValue, getJobPaidAmount } from '@/lib/jobUtils';
import type { Customer, Job, Payment } from '@/types';
import './PaymentForm.css';

type PaymentMode = 'cash' | 'upi' | 'bank' | 'cheque';
type PaymentScope = 'manual' | 'week' | 'month' | 'range';

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
  const { getActiveCustomers, payments, addPayment, jobs, updateJob } = useDataStore();
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
    </div>
  );
}
