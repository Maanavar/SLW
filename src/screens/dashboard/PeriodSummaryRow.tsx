import { useMemo, useState } from 'react';
import { StatCard, PaymentBreakdown } from '@/components/ui/StatCard';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, getPaymentsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobFinalBillValue, getJobPaidAmount } from '@/lib/jobUtils';
import { getLocalDateString, getWeekStartDate } from '@/lib/dateUtils';

interface PeriodStats {
  jobsCount: number;
  totalRevenue: number;     // Total amount quoted/invoiced (sum of job.amount)
  commissionExpense: number; // Total commission to managers (sum of job.commissionAmount)
  grossProfit: number;       // Our actual income (Revenue - Commission)
  received: number;          // Cash received from customers
  outstanding: number;       // Amount still to be collected (Revenue - Received)
  receivedBreakdown: PaymentBreakdown;
}

interface DateRange {
  from: string;
  to: string;
  label: string;
}

function toDateString(date: Date): string {
  return getLocalDateString(date);
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function shiftMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getLastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getPeriodStats(
  jobsInPeriod: ReturnType<typeof getJobsInRange>,
  paymentsInPeriod: ReturnType<typeof getPaymentsInRange>
): PeriodStats {
  const jobsCount = groupJobsByCard(jobsInPeriod).length;

  // Revenue & Expense Calculations
  const totalRevenue = jobsInPeriod.reduce((sum, job) => sum + getJobFinalBillValue(job), 0);
  const commissionExpense = jobsInPeriod.reduce(
    (sum, job) => sum + (Number(job.commissionAmount) || 0),
    0
  );
  const grossProfit = totalRevenue - commissionExpense;

  // Payment Calculations
  const receivedFromPayments = paymentsInPeriod.reduce((sum, p) => sum + (p.amount || 0), 0);
  const receivedFromJobs = jobsInPeriod.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
  const received = receivedFromPayments > 0 ? receivedFromPayments : receivedFromJobs;
  const outstanding = totalRevenue - received;

  // Calculate payment mode breakdown
  const receivedBreakdown: PaymentBreakdown = {
    cash: 0,
    upi: 0,
    bank: 0,
    cheque: 0,
  };

  if (receivedFromPayments > 0) {
    // Breakdown from payment vouchers
    paymentsInPeriod.forEach((payment) => {
      const amount = payment.amount || 0;
      if (payment.paymentMode === 'Cash') {
        receivedBreakdown.cash = (receivedBreakdown.cash || 0) + amount;
      } else if (payment.paymentMode === 'UPI') {
        receivedBreakdown.upi = (receivedBreakdown.upi || 0) + amount;
      } else if (payment.paymentMode === 'Bank') {
        receivedBreakdown.bank = (receivedBreakdown.bank || 0) + amount;
      } else if (payment.paymentMode === 'Cheque') {
        receivedBreakdown.cheque = (receivedBreakdown.cheque || 0) + amount;
      } else if (payment.paymentMode === 'Mixed' && payment.breakdown) {
        // Handle mixed payments with breakdown
        receivedBreakdown.cash = (receivedBreakdown.cash || 0) + (payment.breakdown.cash || 0);
        receivedBreakdown.upi = (receivedBreakdown.upi || 0) + (payment.breakdown.upi || 0);
        receivedBreakdown.bank = (receivedBreakdown.bank || 0) + (payment.breakdown.bank || 0);
        receivedBreakdown.cheque = (receivedBreakdown.cheque || 0) + (payment.breakdown.cheque || 0);
      }
    });
  } else if (receivedFromJobs > 0) {
    // Breakdown from job paid amounts
    jobsInPeriod.forEach((job) => {
      const paidAmount = getJobPaidAmount(job);
      if (paidAmount > 0 && job.paymentMode) {
        if (job.paymentMode === 'Cash') {
          receivedBreakdown.cash = (receivedBreakdown.cash || 0) + paidAmount;
        } else if (job.paymentMode === 'UPI') {
          receivedBreakdown.upi = (receivedBreakdown.upi || 0) + paidAmount;
        } else if (job.paymentMode === 'Bank') {
          receivedBreakdown.bank = (receivedBreakdown.bank || 0) + paidAmount;
        } else if (job.paymentMode === 'Cheque') {
          receivedBreakdown.cheque = (receivedBreakdown.cheque || 0) + paidAmount;
        }
      }
    });
  }

  return {
    jobsCount,
    totalRevenue,
    commissionExpense,
    grossProfit,
    received,
    outstanding,
    receivedBreakdown,
  };
}

function formatRangeLabel(from: string, to: string): string {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const fromText = fromDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const toText = toDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return from === to ? fromText : `${fromText} - ${toText}`;
}

export function PeriodSummaryRow() {
  const { jobs, payments } = useDataStore();
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month'>('today');
  const [dayOffset, setDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();

  const dayRange: DateRange = useMemo(() => {
    const targetDay = shiftDays(today, -dayOffset);
    const value = toDateString(targetDay);
    return {
      from: value,
      to: value,
      label: formatRangeLabel(value, value),
    };
  }, [dayOffset, today]);

  const weekRange: DateRange = useMemo(() => {
    const base = shiftDays(today, -weekOffset * 7);
    const from = getWeekStartDate(base);
    const fromDate = new Date(`${from}T00:00:00`);
    const weekEnd = shiftDays(fromDate, 6);
    const to = weekOffset === 0 ? toDateString(today) : toDateString(weekEnd);
    return {
      from,
      to,
      label: formatRangeLabel(from, to),
    };
  }, [weekOffset, today]);

  const monthRange: DateRange = useMemo(() => {
    const monthBase = shiftMonths(today, -monthOffset);
    const fromDate = new Date(monthBase.getFullYear(), monthBase.getMonth(), 1);
    const toDate = monthOffset === 0 ? today : getLastDayOfMonth(monthBase);
    const from = toDateString(fromDate);
    const to = toDateString(toDate);
    return {
      from,
      to,
      label: monthBase.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    };
  }, [monthOffset, today]);

  const todayStats = useMemo(() => {
    const filteredJobs = getJobsInRange(jobs, dayRange.from, dayRange.to);
    const filteredPayments = getPaymentsInRange(payments, dayRange.from, dayRange.to);
    return getPeriodStats(filteredJobs, filteredPayments);
  }, [jobs, payments, dayRange]);

  const weekStats = useMemo(() => {
    const filteredJobs = getJobsInRange(jobs, weekRange.from, weekRange.to);
    const filteredPayments = getPaymentsInRange(payments, weekRange.from, weekRange.to);
    return getPeriodStats(filteredJobs, filteredPayments);
  }, [jobs, payments, weekRange]);

  const monthStats = useMemo(() => {
    const filteredJobs = getJobsInRange(jobs, monthRange.from, monthRange.to);
    const filteredPayments = getPaymentsInRange(payments, monthRange.from, monthRange.to);
    return getPeriodStats(filteredJobs, filteredPayments);
  }, [jobs, payments, monthRange]);

  const currentRange = activePeriod === 'today' ? dayRange : activePeriod === 'week' ? weekRange : monthRange;
  const currentStats = activePeriod === 'today' ? todayStats : activePeriod === 'week' ? weekStats : monthStats;
  const currentOffset =
    activePeriod === 'today' ? dayOffset : activePeriod === 'week' ? weekOffset : monthOffset;
  const currentTitle = activePeriod === 'today' ? 'Today' : activePeriod === 'week' ? 'This Week' : 'This Month';
  const canGoNext = currentOffset > 0;
  const collectionRate =
    currentStats.totalRevenue > 0 ? (currentStats.received / currentStats.totalRevenue) * 100 : 0;
  const marginRate =
    currentStats.totalRevenue > 0 ? (currentStats.grossProfit / currentStats.totalRevenue) * 100 : 0;

  const handlePrev = () => {
    if (activePeriod === 'today') setDayOffset((value) => value + 1);
    else if (activePeriod === 'week') setWeekOffset((value) => value + 1);
    else setMonthOffset((value) => value + 1);
  };

  const handleNext = () => {
    if (!canGoNext) return;
    if (activePeriod === 'today') setDayOffset((value) => value - 1);
    else if (activePeriod === 'week') setWeekOffset((value) => value - 1);
    else setMonthOffset((value) => value - 1);
  };

  const handleReset = () => {
    if (activePeriod === 'today') setDayOffset(0);
    else if (activePeriod === 'week') setWeekOffset(0);
    else setMonthOffset(0);
  };

  return (
    <div className="period-summary">
      <div className="summary-section summary-section--active">
        <div className="summary-section-header">
          <div className="summary-heading-block">
            <h3 className="summary-section-title">{currentTitle}</h3>
            <p className="summary-range-label">{currentRange.label}</p>
          </div>

          <div className="period-toggle">
            <button
              type="button"
              className={`period-toggle-btn ${activePeriod === 'today' ? 'active' : ''}`}
              onClick={() => setActivePeriod('today')}
              aria-pressed={activePeriod === 'today'}
            >
              Today
            </button>
            <button
              type="button"
              className={`period-toggle-btn ${activePeriod === 'week' ? 'active' : ''}`}
              onClick={() => setActivePeriod('week')}
              aria-pressed={activePeriod === 'week'}
            >
              Week
            </button>
            <button
              type="button"
              className={`period-toggle-btn ${activePeriod === 'month' ? 'active' : ''}`}
              onClick={() => setActivePeriod('month')}
              aria-pressed={activePeriod === 'month'}
            >
              Month
            </button>
          </div>

          <div className="summary-nav">
            <button type="button" className="summary-nav-btn" onClick={handlePrev}>
              Prev
            </button>
            <button type="button" className="summary-nav-btn" onClick={handleNext} disabled={!canGoNext}>
              Next
            </button>
            <button
              type="button"
              className="summary-nav-btn summary-nav-btn--soft"
              onClick={handleReset}
              disabled={!canGoNext}
            >
              Current
            </button>
          </div>
        </div>
        <div className="summary-cards">
          <StatCard title="JobCards" value={currentStats.jobsCount} subtitle="Cards created" icon="J" />
          <StatCard title="Revenue" value={formatCurrency(currentStats.totalRevenue)} subtitle="Total quoted amount" icon="R" />
          <StatCard title="Commission" value={formatCurrency(currentStats.commissionExpense)} subtitle="Paid to managers" icon="C" />
          <StatCard title="Gross Profit" value={formatCurrency(currentStats.grossProfit)} subtitle="Our actual income" icon="G" />
          <StatCard title="Received" value={formatCurrency(currentStats.received)} subtitle="Cash collected" icon="P" breakdown={currentStats.receivedBreakdown} />
          <StatCard title="Outstanding" value={formatCurrency(currentStats.outstanding)} subtitle="Still to collect" icon="O" />
        </div>
        <div className="summary-micro-metrics">
          <span className="summary-micro-pill">Collection Rate: {collectionRate.toFixed(1)}%</span>
          <span className="summary-micro-pill">Margin: {marginRate.toFixed(1)}%</span>
          <span className="summary-micro-pill">Outstanding: {formatCurrency(currentStats.outstanding)}</span>
        </div>
      </div>
    </div>
  );
}
