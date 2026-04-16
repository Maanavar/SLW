import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { PaymentModeGroup } from '@/components/ui/PaymentModeGroup';
import { formatCurrency } from '@/lib/currencyUtils';
import { generateMeaningfulPaymentId } from '@/lib/paymentUtils';
import {
  getLocalDateString,
  getMonthInputString,
  getWeekStartDate,
  isDateInRange,
} from '@/lib/dateUtils';
import { calculateCustomerBalance, getJobFinalBillValue, getJobPaidAmount } from '@/lib/jobUtils';
import type { Customer, Job, Payment } from '@/types';

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

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecordPaymentModal({ isOpen, onClose }: RecordPaymentModalProps) {
  const { getActiveCustomers, payments, addPayment, jobs, updateJob, updateCustomer } = useDataStore();
  const toast = useToast();

  const customers = getActiveCustomers().sort((a, b) => a.name.localeCompare(b.name));
  const today = getLocalDateString(new Date());
  const currentMonth = getMonthInputString(new Date());

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [useBreakdown, setUseBreakdown] = useState(false);
  const [breakdownCash, setBreakdownCash] = useState('');
  const [breakdownUPI, setBreakdownUPI] = useState('');
  const [breakdownBank, setBreakdownBank] = useState('');
  const [breakdownCheque, setBreakdownCheque] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentScope, setPaymentScope] = useState<PaymentScope>('manual');
  const [weekFrom, setWeekFrom] = useState(getWeekStartDate(new Date()));
  const [weekTo, setWeekTo] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState(today);
  const [notes, setNotes] = useState('');
  const [isSettled, setIsSettled] = useState(false);

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
      const pending = getJobFinalBillValue(job) - getJobPaidAmount(job);
      return sum + (pending > 0 ? pending : 0);
    }, 0);
  }, [scopedJobs]);

  // Auto-fill settled amount
  useEffect(() => {
    if (isSettled && selectedCustomer) {
      setAmount(String(customerBalance.balance));
      setPaymentScope('manual');
    }
  }, [isSettled, selectedCustomer, customerBalance.balance]);

  useEffect(() => {
    if (paymentScope !== 'manual') {
      const advance = selectedCustomer?.advanceBalance || 0;
      const amountAfterAdvance = Math.max(0, scopedPendingAmount - advance);
      setAmount(amountAfterAdvance > 0 ? String(amountAfterAdvance) : '');
    }
  }, [paymentScope, scopedPendingAmount, selectedCustomer?.advanceBalance]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast.error('Error', 'Please select a customer');
      return;
    }

    let totalAmount = 0;

    if (useBreakdown) {
      const cash = parseFloat(breakdownCash) || 0;
      const upi = parseFloat(breakdownUPI) || 0;
      const bank = parseFloat(breakdownBank) || 0;
      const cheque = parseFloat(breakdownCheque) || 0;

      totalAmount = cash + upi + bank + cheque;

      if (totalAmount <= 0) {
        toast.error('Error', 'Please enter valid amounts for at least one payment mode');
        return;
      }

    } else {
      totalAmount = parseFloat(amount) || 0;
      if (totalAmount <= 0) {
        toast.error('Error', 'Please enter a valid amount');
        return;
      }
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

      if (totalAmount < scopedPendingAmount) {
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

      let breakdown;
      let finalPaymentMode: 'Cash' | 'UPI' | 'Bank' | 'Cheque' | 'Mixed' = modeMap[paymentMode];

      if (useBreakdown) {
        const cash = parseFloat(breakdownCash) || 0;
        const upi = parseFloat(breakdownUPI) || 0;
        const bank = parseFloat(breakdownBank) || 0;
        const cheque = parseFloat(breakdownCheque) || 0;

        breakdown = {
          ...(cash > 0 && { cash }),
          ...(upi > 0 && { upi }),
          ...(bank > 0 && { bank }),
          ...(cheque > 0 && { cheque }),
        };

        if (Object.keys(breakdown).length > 1) {
          finalPaymentMode = 'Mixed';
        } else if (cash > 0) {
          finalPaymentMode = 'Cash';
        } else if (upi > 0) {
          finalPaymentMode = 'UPI';
        } else if (bank > 0) {
          finalPaymentMode = 'Bank';
        } else if (cheque > 0) {
          finalPaymentMode = 'Cheque';
        }
      }

      // Count payments on the same date for sequence
      const paymentCount = payments.filter((p) => p.date === paymentDate && p.customerId === selectedCustomer.id).length;

      const newPayment: Omit<Payment, 'id' | 'createdAt'> = {
        customerId: selectedCustomer.id,
        amount: totalAmount,
        paymentMode: finalPaymentMode,
        breakdown,
        date: paymentDate,
        referenceNumber: generateMeaningfulPaymentId(selectedCustomer, paymentDate, paymentCount + 1),
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

      await addPayment(newPayment);

      // Handle settled or scope-based payments
      if (isSettled) {
        // Mark all jobs of this customer as fully paid
        await Promise.all(
          jobs
            .filter((job) => job.customerId === selectedCustomer.id)
            .map((job) => {
              const net = getJobFinalBillValue(job);
              return updateJob(job.id, {
                paidAmount: net,
                paymentStatus: 'Paid',
                paymentMode: finalPaymentMode as any,
              });
            })
        );
      } else if (paymentScope !== 'manual') {
        // Mark scoped jobs as fully paid
        await Promise.all(
          scopedJobs.map((job) => {
            const currentPaid = getJobPaidAmount(job);
            const net = getJobFinalBillValue(job);
            const pending = Math.max(0, net - currentPaid);

            return updateJob(job.id, {
              paidAmount: currentPaid + pending,
              paymentStatus: 'Paid',
              paymentMode: finalPaymentMode as any,
            });
          })
        );
      } else {
        // Manual scope - allocate to outstanding jobs
        const customerOutstandingJobs = jobs.filter(
          (job) =>
            job.customerId === selectedCustomer.id &&
            getJobFinalBillValue(job) - getJobPaidAmount(job) > 0
        );

        let remainingAmount = parseFloat(amount);

        for (const job of customerOutstandingJobs) {
          if (remainingAmount <= 0) break;

          const currentPaid = getJobPaidAmount(job);
          const net = getJobFinalBillValue(job);
          const pending = Math.max(0, net - currentPaid);

          if (pending === 0) continue;

          const paymentAllocation = Math.min(remainingAmount, pending);
          const newPaidAmount = currentPaid + paymentAllocation;
          const isFullyPaid = Math.abs(newPaidAmount - net) < 0.01;

          await updateJob(job.id, {
            paidAmount: newPaidAmount,
            paymentStatus: isFullyPaid ? 'Paid' : 'Partially Paid',
            paymentMode: finalPaymentMode as any,
          });

          remainingAmount -= paymentAllocation;
        }

        // If there's remaining amount after allocating to all outstanding jobs, save as advance
        if (remainingAmount > 0) {
          const currentAdvance = selectedCustomer.advanceBalance || 0;
          await updateCustomer(selectedCustomer.id, {
            advanceBalance: currentAdvance + remainingAmount,
          });
        }
      }

      toast.success(
        'Success',
        isSettled
          ? `Customer ${selectedCustomer.name} marked as settled`
          : `Payment of ${formatCurrency(parseFloat(amount))} recorded`
      );

      // Reset form
      setAmount('');
      setPaymentMode('cash');
      setUseBreakdown(false);
      setBreakdownCash('');
      setBreakdownUPI('');
      setBreakdownBank('');
      setBreakdownCheque('');
      setPaymentDate(today);
      setPaymentScope('manual');
      setWeekFrom(getWeekStartDate(new Date()));
      setWeekTo(today);
      setSelectedMonth(currentMonth);
      setRangeFrom('');
      setRangeTo(today);
      setNotes('');
      setIsSettled(false);
      setSelectedCustomer(null);
      onClose();
    } catch {
      toast.error('Error', 'Failed to record payment');
    }
  };

  const handleClose = () => {
    setSelectedCustomer(null);
    setAmount('');
    setPaymentMode('cash');
    setUseBreakdown(false);
    setBreakdownCash('');
    setBreakdownUPI('');
    setBreakdownBank('');
    setBreakdownCheque('');
    setPaymentDate(today);
    setPaymentScope('manual');
    setNotes('');
    setIsSettled(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Record Payment" size="md">
      <form onSubmit={handleSubmit} className="payment-form">
        <div className="form-group">
          <label className="form-label" htmlFor="customer-select">
            Customer
          </label>
          <SearchableSelect
            items={customers}
            value={selectedCustomer}
            onChange={setSelectedCustomer}
            getLabel={(c) => (c.shortCode ? `${c.name} (${c.shortCode})` : c.name)}
            getKey={(c) => String(c.id)}
            placeholder="Select customer..."
          />
        </div>

        {selectedCustomer && (
          <div className="balance-info">
            <div className="balance-item">
              <span className="balance-label">Outstanding Balance (Backlog)</span>
              <span
                className={`balance-amount ${customerBalance.balance > 0 ? 'positive' : ''}`}
              >
                {formatCurrency(Math.max(0, customerBalance.balance))}
              </span>
            </div>
            {selectedCustomer.advanceBalance && selectedCustomer.advanceBalance > 0 && (
              <>
                <div className="balance-item">
                  <span className="balance-label">Available Advance (Credit)</span>
                  <span className="balance-amount balance-negative">
                    {formatCurrency(selectedCustomer.advanceBalance)}
                  </span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">Amount to Collect (After Advance)</span>
                  <span className="balance-amount balance-positive">
                    {formatCurrency(Math.max(0, customerBalance.balance - selectedCustomer.advanceBalance))}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isSettled}
              onChange={(e) => setIsSettled(e.target.checked)}
              disabled={!selectedCustomer}
            />
            Mark as Settled (Pay entire balance)
          </label>
        </div>

        {!isSettled && (
          <>
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
                  Range
                </button>
              </div>
            </div>

            {paymentScope !== 'manual' && scopedPendingAmount > 0 && (
              <div className="quick-fill-info">
                <span className="quick-fill-label">Pending: {formatCurrency(scopedPendingAmount)}</span>
                <button
                  type="button"
                  className="quick-fill-btn"
                  onClick={() => setAmount(String(scopedPendingAmount))}
                >
                  Use Amount
                </button>
              </div>
            )}
          </>
        )}

        {paymentScope === 'week' && !isSettled && (
          <div className="scope-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="week-from">
                From
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
                To
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
        )}

        {paymentScope === 'month' && !isSettled && (
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
        )}

        {paymentScope === 'range' && !isSettled && (
          <div className="scope-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="range-from">
                From
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
                To
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
        )}

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={useBreakdown}
              onChange={(e) => setUseBreakdown(e.target.checked)}
            />
            Split Payment by Mode
          </label>
        </div>

        {useBreakdown ? (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="breakdown-cash">
                Cash (INR)
              </label>
              <input
                id="breakdown-cash"
                type="number"
                className="form-input"
                placeholder="0.00"
                value={breakdownCash}
                onChange={(e) => setBreakdownCash(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="breakdown-upi">
                UPI (INR)
              </label>
              <input
                id="breakdown-upi"
                type="number"
                className="form-input"
                placeholder="0.00"
                value={breakdownUPI}
                onChange={(e) => setBreakdownUPI(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="breakdown-bank">
                Bank (INR)
              </label>
              <input
                id="breakdown-bank"
                type="number"
                className="form-input"
                placeholder="0.00"
                value={breakdownBank}
                onChange={(e) => setBreakdownBank(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="breakdown-cheque">
                Cheque (INR)
              </label>
              <input
                id="breakdown-cheque"
                type="number"
                className="form-input"
                placeholder="0.00"
                value={breakdownCheque}
                onChange={(e) => setBreakdownCheque(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>
          </>
        ) : (
          <>
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
              {selectedCustomer && (
                <div className="quick-fill-buttons">
                  <button
                    type="button"
                    className="quick-fill-small-btn"
                    onClick={() => setAmount(String(customerBalance.balance))}
                    title={`Fill with outstanding balance: ${formatCurrency(customerBalance.balance)}`}
                  >
                    Balance: {formatCurrency(customerBalance.balance)}
                  </button>
                  {selectedCustomer.advanceBalance && selectedCustomer.advanceBalance > 0 && (
                    <button
                      type="button"
                      className="quick-fill-small-btn"
                      onClick={() => setAmount(String(Math.max(0, customerBalance.balance - selectedCustomer.advanceBalance)))}
                      title="Fill with amount after deducting advance"
                    >
                      After Advance: {formatCurrency(Math.max(0, customerBalance.balance - selectedCustomer.advanceBalance))}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <PaymentModeGroup value={paymentMode} onChange={setPaymentMode} />
            </div>
          </>
        )}

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
    </Modal>
  );
}
