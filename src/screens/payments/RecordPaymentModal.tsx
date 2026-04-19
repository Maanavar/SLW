import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { PaymentModeGroup, type PaymentMode } from '@/components/ui/PaymentModeGroup';
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
import './RecordPaymentModal.css';

type PaymentScope = 'manual' | 'week' | 'month' | 'range';

function getMonthRange(month: string, today: string): { from: string; to: string } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const mon = Number(monthStr);
  const lastDay = new Date(year, mon, 0).getDate();
  const monthEnd = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  return { from: `${yearStr}-${monthStr}-01`, to: monthEnd > today ? today : monthEnd };
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
  const useBreakdown = paymentMode === 'mixed';

  const customerBalance = useMemo(() => {
    if (!selectedCustomer) return { balance: 0 };
    return { balance: calculateCustomerBalance(jobs, payments, selectedCustomer.id) };
  }, [selectedCustomer, jobs, payments]);

  const scopeRange = useMemo(() => {
    if (paymentScope === 'week')  return { from: weekFrom, to: weekTo };
    if (paymentScope === 'month') return getMonthRange(selectedMonth, today);
    if (paymentScope === 'range') return { from: rangeFrom, to: rangeTo };
    return null;
  }, [paymentScope, weekFrom, weekTo, selectedMonth, rangeFrom, rangeTo, today]);

  const scopedJobs = useMemo<Job[]>(() => {
    if (!selectedCustomer || !scopeRange) return [];
    return jobs.filter(j => j.customerId === selectedCustomer.id && isDateInRange(j.date, scopeRange.from, scopeRange.to));
  }, [selectedCustomer, jobs, scopeRange]);

  const scopedPendingAmount = useMemo(
    () => scopedJobs.reduce((s, j) => s + Math.max(0, getJobFinalBillValue(j) - getJobPaidAmount(j)), 0),
    [scopedJobs]
  );

  useEffect(() => {
    if (isSettled && selectedCustomer) {
      setAmount(String(customerBalance.balance));
      setPaymentScope('manual');
    }
  }, [isSettled, selectedCustomer, customerBalance.balance]);

  useEffect(() => {
    if (paymentScope !== 'manual') {
      const advance = selectedCustomer?.advanceBalance || 0;
      const net = Math.max(0, scopedPendingAmount - advance);
      setAmount(net > 0 ? String(net) : '');
    }
  }, [paymentScope, scopedPendingAmount, selectedCustomer?.advanceBalance]);

  const resetForm = () => {
    setSelectedCustomer(null);
    setAmount('');
    setPaymentMode('cash');
    setBreakdownCash(''); setBreakdownUPI(''); setBreakdownBank(''); setBreakdownCheque('');
    setPaymentDate(today);
    setPaymentScope('manual');
    setWeekFrom(getWeekStartDate(new Date()));
    setWeekTo(today);
    setSelectedMonth(currentMonth);
    setRangeFrom(''); setRangeTo(today);
    setNotes('');
    setIsSettled(false);
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) { toast.error('Error', 'Please select a customer'); return; }

    let totalAmount = 0;
    if (useBreakdown) {
      totalAmount = (parseFloat(breakdownCash) || 0) + (parseFloat(breakdownUPI) || 0) +
                    (parseFloat(breakdownBank) || 0) + (parseFloat(breakdownCheque) || 0);
      if (totalAmount <= 0) { toast.error('Error', 'Enter an amount for at least one mode'); return; }
    } else {
      totalAmount = parseFloat(amount) || 0;
      if (totalAmount <= 0) { toast.error('Error', 'Enter a valid amount'); return; }
    }

    if (paymentDate > today) { toast.error('Error', 'Future payment date not allowed'); return; }

    if (paymentScope !== 'manual') {
      if (!scopeRange?.from || !scopeRange?.to) { toast.error('Error', 'Select a valid date scope'); return; }
      if (scopeRange.from > scopeRange.to)        { toast.error('Error', 'Start date must be before end date'); return; }
      if (scopeRange.from > today || scopeRange.to > today) { toast.error('Error', 'Future dates not allowed'); return; }
      if (scopedJobs.length === 0)                { toast.error('Error', 'No jobs found in selected scope'); return; }
      if (totalAmount < scopedPendingAmount)       { toast.error('Error', 'Amount must cover full scope balance'); return; }
    }

    try {
      const modeMap: Record<Exclude<PaymentMode, 'mixed'>, 'Cash' | 'UPI' | 'Bank' | 'Cheque'> = {
        cash: 'Cash', upi: 'UPI', bank: 'Bank', cheque: 'Cheque',
      };

      let finalMode: 'Cash' | 'UPI' | 'Bank' | 'Cheque' | 'Mixed' =
        paymentMode === 'mixed' ? 'Mixed' : modeMap[paymentMode];

      let breakdown: Record<string, number> | undefined;
      if (useBreakdown) {
        const cash   = parseFloat(breakdownCash) || 0;
        const upi    = parseFloat(breakdownUPI) || 0;
        const bank   = parseFloat(breakdownBank) || 0;
        const cheque = parseFloat(breakdownCheque) || 0;
        breakdown = {
          ...(cash   > 0 && { cash }),
          ...(upi    > 0 && { upi }),
          ...(bank   > 0 && { bank }),
          ...(cheque > 0 && { cheque }),
        };
        if (Object.keys(breakdown).length === 1) {
          if (cash)   finalMode = 'Cash';
          else if (upi)    finalMode = 'UPI';
          else if (bank)   finalMode = 'Bank';
          else if (cheque) finalMode = 'Cheque';
        } else {
          finalMode = 'Mixed';
        }
      }

      const paymentCount = payments.filter(p => p.date === paymentDate && p.customerId === selectedCustomer.id).length;

      const newPayment: Omit<Payment, 'id' | 'createdAt'> = {
        customerId: selectedCustomer.id,
        amount: totalAmount,
        paymentMode: finalMode,
        breakdown,
        date: paymentDate,
        referenceNumber: generateMeaningfulPaymentId(selectedCustomer, paymentDate, paymentCount + 1),
        paymentForMonth: paymentScope === 'month' ? selectedMonth : undefined,
        paymentForFromDate: paymentScope === 'week' || paymentScope === 'range' ? scopeRange?.from : undefined,
        paymentForDate:     paymentScope === 'week' || paymentScope === 'range' ? scopeRange?.to  : undefined,
        notes: notes || undefined,
      };

      await addPayment(newPayment);

      if (isSettled) {
        await Promise.all(
          jobs.filter(j => j.customerId === selectedCustomer.id).map(j =>
            updateJob(j.id, { paidAmount: getJobFinalBillValue(j), paymentStatus: 'Paid', paymentMode: finalMode as any })
          )
        );
      } else if (paymentScope !== 'manual') {
        await Promise.all(
          scopedJobs.map(j => {
            const pending = Math.max(0, getJobFinalBillValue(j) - getJobPaidAmount(j));
            return updateJob(j.id, { paidAmount: getJobPaidAmount(j) + pending, paymentStatus: 'Paid', paymentMode: finalMode as any });
          })
        );
      } else {
        const outstanding = jobs.filter(j =>
          j.customerId === selectedCustomer.id && getJobFinalBillValue(j) - getJobPaidAmount(j) > 0
        );
        let remaining = totalAmount;
        for (const job of outstanding) {
          if (remaining <= 0) break;
          const pending = Math.max(0, getJobFinalBillValue(job) - getJobPaidAmount(job));
          if (pending === 0) continue;
          const alloc = Math.min(remaining, pending);
          const newPaid = getJobPaidAmount(job) + alloc;
          await updateJob(job.id, {
            paidAmount: newPaid,
            paymentStatus: Math.abs(newPaid - getJobFinalBillValue(job)) < 0.01 ? 'Paid' : 'Partially Paid',
            paymentMode: finalMode as any,
          });
          remaining -= alloc;
        }
        if (remaining > 0) {
          await updateCustomer(selectedCustomer.id, {
            advanceBalance: (selectedCustomer.advanceBalance || 0) + remaining,
          });
        }
      }

      toast.success('Payment recorded', `${formatCurrency(totalAmount)} for ${selectedCustomer.name}`);
      resetForm();
      onClose();
    } catch {
      toast.error('Error', 'Failed to record payment');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Record Payment" size="md">
      <form onSubmit={handleSubmit} className="rpm-form">

        {/* Customer */}
        <div className="rpm-field">
          <label className="rpm-label">Customer</label>
          <SearchableSelect
            items={customers}
            value={selectedCustomer}
            onChange={setSelectedCustomer}
            getLabel={c => c.shortCode ? `${c.name} (${c.shortCode})` : c.name}
            getKey={c => String(c.id)}
            placeholder="Select customer..."
          />
        </div>

        {/* Balance info */}
        {selectedCustomer && customerBalance.balance > 0 && (
          <div className="rpm-balance">
            <div className="rpm-balance-row">
              <span className="rpm-balance-label">Outstanding</span>
              <span className="rpm-balance-val rpm-balance-val--red">{formatCurrency(customerBalance.balance)}</span>
            </div>
            {(selectedCustomer.advanceBalance ?? 0) > 0 && (
              <>
                <div className="rpm-balance-row">
                  <span className="rpm-balance-label">Advance credit</span>
                  <span className="rpm-balance-val rpm-balance-val--green">{formatCurrency(selectedCustomer.advanceBalance!)}</span>
                </div>
                <div className="rpm-balance-row rpm-balance-row--divider">
                  <span className="rpm-balance-label">To collect</span>
                  <span className="rpm-balance-val rpm-balance-val--red">
                    {formatCurrency(Math.max(0, customerBalance.balance - (selectedCustomer.advanceBalance || 0)))}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Settle toggle */}
        <label className="rpm-check-label">
          <input
            type="checkbox"
            className="rpm-check"
            checked={isSettled}
            onChange={e => setIsSettled(e.target.checked)}
            disabled={!selectedCustomer}
          />
          Mark as fully settled
        </label>

        {/* Payment scope (only when not settled) */}
        {!isSettled && (
          <div className="rpm-field">
            <label className="rpm-label">Scope</label>
            <div className="rpm-scope-tabs">
              {(['manual', 'week', 'month', 'range'] as PaymentScope[]).map(s => (
                <button
                  key={s}
                  type="button"
                  className={`rpm-scope-btn${paymentScope === s ? ' active' : ''}`}
                  onClick={() => setPaymentScope(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scope date pickers */}
        {!isSettled && paymentScope === 'week' && (
          <div className="rpm-grid-2">
            <div className="rpm-field">
              <label className="rpm-label" htmlFor="rpm-week-from">From</label>
              <input id="rpm-week-from" type="date" className="rpm-input" value={weekFrom} onChange={e => setWeekFrom(e.target.value)} max={today} />
            </div>
            <div className="rpm-field">
              <label className="rpm-label" htmlFor="rpm-week-to">To</label>
              <input id="rpm-week-to" type="date" className="rpm-input" value={weekTo} onChange={e => setWeekTo(e.target.value)} max={today} />
            </div>
          </div>
        )}

        {!isSettled && paymentScope === 'month' && (
          <div className="rpm-field">
            <label className="rpm-label">Month</label>
            <div className="rpm-grid-2">
              <select className="rpm-input"
                value={selectedMonth.split('-')[0]}
                onChange={e => setSelectedMonth(`${e.target.value}-${selectedMonth.split('-')[1]}`)}
                aria-label="Year"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select className="rpm-input"
                value={selectedMonth.split('-')[1]}
                onChange={e => setSelectedMonth(`${selectedMonth.split('-')[0]}-${e.target.value}`)}
                aria-label="Month"
              >
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                  <option key={m} value={m}>{new Date(2000, Number(m) - 1).toLocaleString('en-IN', { month: 'long' })}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {!isSettled && paymentScope === 'range' && (
          <div className="rpm-grid-2">
            <div className="rpm-field">
              <label className="rpm-label" htmlFor="rpm-range-from">From</label>
              <input id="rpm-range-from" type="date" className="rpm-input" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} max={today} />
            </div>
            <div className="rpm-field">
              <label className="rpm-label" htmlFor="rpm-range-to">To</label>
              <input id="rpm-range-to" type="date" className="rpm-input" value={rangeTo} onChange={e => setRangeTo(e.target.value)} max={today} />
            </div>
          </div>
        )}

        {/* Pending quick-fill */}
        {!isSettled && paymentScope !== 'manual' && scopedPendingAmount > 0 && (
          <div className="rpm-quick-fill">
            <span className="rpm-quick-fill-label">Pending: {formatCurrency(scopedPendingAmount)}</span>
            <button type="button" className="rpm-quick-fill-btn" onClick={() => setAmount(String(scopedPendingAmount))}>
              Use amount
            </button>
          </div>
        )}

        {/* Payment mode */}
        <div className="rpm-field">
          <label className="rpm-label">Payment mode</label>
          <PaymentModeGroup value={paymentMode} onChange={setPaymentMode} />
        </div>

        {/* Amount fields */}
        {useBreakdown ? (
          <div className="rpm-grid-2">
            {[
              { id: 'rpm-cash',   label: 'Cash',   val: breakdownCash,   set: setBreakdownCash },
              { id: 'rpm-upi',    label: 'UPI',    val: breakdownUPI,    set: setBreakdownUPI },
              { id: 'rpm-bank',   label: 'Bank',   val: breakdownBank,   set: setBreakdownBank },
              { id: 'rpm-cheque', label: 'Cheque', val: breakdownCheque, set: setBreakdownCheque },
            ].map(({ id, label, val, set }) => (
              <div key={id} className="rpm-field">
                <label className="rpm-label" htmlFor={id}>{label}</label>
                <input id={id} type="number" className="rpm-input" placeholder="0.00"
                  value={val} onChange={e => set(e.target.value)} step="0.01" min="0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rpm-field">
            <label className="rpm-label" htmlFor="rpm-amount">Amount (INR)</label>
            <input id="rpm-amount" type="number" className="rpm-input rpm-input--lg"
              placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
              step="0.01" min="0" required />
            {selectedCustomer && customerBalance.balance > 0 && (
              <div className="rpm-fill-chips">
                <button type="button" className="rpm-fill-chip"
                  onClick={() => setAmount(String(customerBalance.balance))}>
                  Balance: {formatCurrency(customerBalance.balance)}
                </button>
                {(selectedCustomer.advanceBalance ?? 0) > 0 && (
                  <button type="button" className="rpm-fill-chip"
                    onClick={() => setAmount(String(Math.max(0, customerBalance.balance - (selectedCustomer.advanceBalance || 0))))}>
                    After advance: {formatCurrency(Math.max(0, customerBalance.balance - (selectedCustomer.advanceBalance || 0)))}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Date */}
        <div className="rpm-field">
          <label className="rpm-label" htmlFor="rpm-date">Payment date</label>
          <input id="rpm-date" type="date" className="rpm-input" value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)} max={today} required />
        </div>

        {/* Notes */}
        <div className="rpm-field">
          <label className="rpm-label" htmlFor="rpm-notes">Notes</label>
          <textarea id="rpm-notes" className="rpm-input rpm-textarea" rows={2}
            placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <button type="submit" className="btn btn-accent rpm-submit" disabled={!selectedCustomer}>
          Record Payment
        </button>
      </form>
    </Modal>
  );
}
