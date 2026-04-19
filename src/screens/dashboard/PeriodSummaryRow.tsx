import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, getPaymentsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobFinalBillValue, getJobPaidAmount } from '@/lib/jobUtils';
import { getLocalDateString, getWeekStartDate } from '@/lib/dateUtils';

type ActivePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';

interface DateRange {
  from: string;
  to: string;
}

interface PaymentBreakdown {
  cash: number;
  upi: number;
  bank: number;
  cheque: number;
}

interface PeriodStats {
  jobCards: number;
  lineItems: number;
  totalRevenue: number;
  commissionExpense: number;
  grossProfit: number;
  received: number;
  outstanding: number;
  paymentCount: number;
  receivedBreakdown: PaymentBreakdown;
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

function formatDateLabel(dateText: string): string {
  return new Date(`${dateText}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatRangeLabel(range: DateRange): string {
  if (range.from === range.to) return formatDateLabel(range.from);

  const fromDate = new Date(`${range.from}T00:00:00`);
  const toDate = new Date(`${range.to}T00:00:00`);
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();

  const fromLabel = fromDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const toLabel = toDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return `${fromLabel} - ${toLabel}`;
}

function getPeriodStats(
  jobsInPeriod: ReturnType<typeof getJobsInRange>,
  paymentsInPeriod: ReturnType<typeof getPaymentsInRange>
): PeriodStats {
  const jobCards = groupJobsByCard(jobsInPeriod).length;
  const lineItems = jobsInPeriod.length;

  const totalRevenue = jobsInPeriod.reduce((sum, job) => sum + getJobFinalBillValue(job), 0);
  const commissionExpense = jobsInPeriod.reduce((sum, job) => sum + (Number(job.commissionAmount) || 0), 0);
  const grossProfit = totalRevenue - commissionExpense;

  const receivedFromPayments = paymentsInPeriod.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const receivedFromJobs = jobsInPeriod.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
  const received = receivedFromPayments > 0 ? receivedFromPayments : receivedFromJobs;
  const outstanding = totalRevenue - received;

  const receivedBreakdown: PaymentBreakdown = {
    cash: 0,
    upi: 0,
    bank: 0,
    cheque: 0,
  };

  if (receivedFromPayments > 0) {
    paymentsInPeriod.forEach((payment) => {
      const amount = payment.amount || 0;
      if (payment.paymentMode === 'Cash') {
        receivedBreakdown.cash += amount;
      } else if (payment.paymentMode === 'UPI') {
        receivedBreakdown.upi += amount;
      } else if (payment.paymentMode === 'Bank') {
        receivedBreakdown.bank += amount;
      } else if (payment.paymentMode === 'Cheque') {
        receivedBreakdown.cheque += amount;
      } else if (payment.paymentMode === 'Mixed' && payment.breakdown) {
        receivedBreakdown.cash += payment.breakdown.cash || 0;
        receivedBreakdown.upi += payment.breakdown.upi || 0;
        receivedBreakdown.bank += payment.breakdown.bank || 0;
        receivedBreakdown.cheque += payment.breakdown.cheque || 0;
      }
    });
  } else if (receivedFromJobs > 0) {
    jobsInPeriod.forEach((job) => {
      const paidAmount = getJobPaidAmount(job);
      if (paidAmount <= 0 || !job.paymentMode) return;
      if (job.paymentMode === 'Cash') {
        receivedBreakdown.cash += paidAmount;
      } else if (job.paymentMode === 'UPI') {
        receivedBreakdown.upi += paidAmount;
      } else if (job.paymentMode === 'Bank') {
        receivedBreakdown.bank += paidAmount;
      } else if (job.paymentMode === 'Cheque') {
        receivedBreakdown.cheque += paidAmount;
      }
    });
  }

  return {
    jobCards,
    lineItems,
    totalRevenue,
    commissionExpense,
    grossProfit,
    received,
    outstanding,
    paymentCount: paymentsInPeriod.length,
    receivedBreakdown,
  };
}

export function PeriodSummaryRow() {
  const { jobs, payments } = useDataStore();
  const [activePeriod, setActivePeriod] = useState<ActivePeriod>('today');
  const [dayOffset, setDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [quarterOffset, setQuarterOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const baseToday = useMemo(() => new Date(), []);

  const dayRange: DateRange = useMemo(() => {
    const targetDay = shiftDays(baseToday, -dayOffset);
    const value = toDateString(targetDay);
    return { from: value, to: value };
  }, [dayOffset, baseToday]);

  const weekRange: DateRange = useMemo(() => {
    const base = shiftDays(baseToday, -weekOffset * 7);
    const from = getWeekStartDate(base);
    const fromDate = new Date(`${from}T00:00:00`);
    const weekEnd = shiftDays(fromDate, 6);
    const to = weekOffset === 0 ? toDateString(baseToday) : toDateString(weekEnd);
    return { from, to };
  }, [weekOffset, baseToday]);

  const monthRange: DateRange = useMemo(() => {
    const monthBase = shiftMonths(baseToday, -monthOffset);
    const fromDate = new Date(monthBase.getFullYear(), monthBase.getMonth(), 1);
    const toDate = monthOffset === 0 ? baseToday : getLastDayOfMonth(monthBase);
    return {
      from: toDateString(fromDate),
      to: toDateString(toDate),
    };
  }, [monthOffset, baseToday]);

  const quarterRange: DateRange = useMemo(() => {
    const quarterBase = shiftMonths(baseToday, -(quarterOffset * 3));
    const quarterStartMonth = Math.floor(quarterBase.getMonth() / 3) * 3;
    const fromDate = new Date(quarterBase.getFullYear(), quarterStartMonth, 1);
    const toDate =
      quarterOffset === 0
        ? baseToday
        : new Date(quarterBase.getFullYear(), quarterStartMonth + 3, 0);
    return {
      from: toDateString(fromDate),
      to: toDateString(toDate),
    };
  }, [quarterOffset, baseToday]);

  const yearRange: DateRange = useMemo(() => {
    const yearBase = new Date(baseToday.getFullYear() - yearOffset, 0, 1);
    return {
      from: toDateString(yearBase),
      to: toDateString(
        yearOffset === 0 ? baseToday : new Date(yearBase.getFullYear(), 11, 31)
      ),
    };
  }, [yearOffset, baseToday]);

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

  const quarterStats = useMemo(() => {
    const filteredJobs = getJobsInRange(jobs, quarterRange.from, quarterRange.to);
    const filteredPayments = getPaymentsInRange(payments, quarterRange.from, quarterRange.to);
    return getPeriodStats(filteredJobs, filteredPayments);
  }, [jobs, payments, quarterRange]);

  const yearStats = useMemo(() => {
    const filteredJobs = getJobsInRange(jobs, yearRange.from, yearRange.to);
    const filteredPayments = getPaymentsInRange(payments, yearRange.from, yearRange.to);
    return getPeriodStats(filteredJobs, filteredPayments);
  }, [jobs, payments, yearRange]);

  const currentRange =
    activePeriod === 'today'
      ? dayRange
      : activePeriod === 'week'
        ? weekRange
        : activePeriod === 'month'
          ? monthRange
          : activePeriod === 'quarter'
            ? quarterRange
            : yearRange;

  const currentStats =
    activePeriod === 'today'
      ? todayStats
      : activePeriod === 'week'
        ? weekStats
        : activePeriod === 'month'
          ? monthStats
          : activePeriod === 'quarter'
            ? quarterStats
            : yearStats;

  const currentOffset =
    activePeriod === 'today'
      ? dayOffset
      : activePeriod === 'week'
        ? weekOffset
        : activePeriod === 'month'
          ? monthOffset
          : activePeriod === 'quarter'
            ? quarterOffset
            : yearOffset;

  const canGoNext = currentOffset > 0;

  const paymentModes = useMemo(() => {
    const breakdown = currentStats.receivedBreakdown;
    const total = breakdown.cash + breakdown.upi + breakdown.bank + breakdown.cheque;
    return [
      { key: 'cash', label: 'Cash', value: breakdown.cash, className: 'mode-cash' },
      { key: 'upi', label: 'UPI', value: breakdown.upi, className: 'mode-upi' },
      { key: 'bank', label: 'Bank', value: breakdown.bank, className: 'mode-bank' },
      { key: 'cheque', label: 'Cheque', value: breakdown.cheque, className: 'mode-cheque' },
    ].map((entry) => ({
      ...entry,
      share: total > 0 ? (entry.value / total) * 100 : 0,
    }));
  }, [currentStats]);

  const handlePrev = () => {
    if (activePeriod === 'today') setDayOffset((value) => value + 1);
    else if (activePeriod === 'week') setWeekOffset((value) => value + 1);
    else if (activePeriod === 'month') setMonthOffset((value) => value + 1);
    else if (activePeriod === 'quarter') setQuarterOffset((value) => value + 1);
    else setYearOffset((value) => value + 1);
  };

  const handleNext = () => {
    if (!canGoNext) return;
    if (activePeriod === 'today') setDayOffset((value) => value - 1);
    else if (activePeriod === 'week') setWeekOffset((value) => value - 1);
    else if (activePeriod === 'month') setMonthOffset((value) => value - 1);
    else if (activePeriod === 'quarter') setQuarterOffset((value) => value - 1);
    else setYearOffset((value) => value - 1);
  };

  return (
    <section className="period-performance">
      <div className="period-performance-head">
        <h2 className="period-title">Period performance</h2>

        <div className="period-controls">
          <div className="period-toggle">
            {(['today', 'week', 'month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`period-toggle-btn ${activePeriod === p ? 'active' : ''}`}
                onClick={() => setActivePeriod(p)}
                aria-current={activePeriod === p ? 'true' : undefined}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <div className="period-date-nav" aria-label="Date navigation">
            <button type="button" className="period-date-btn" onClick={handlePrev} title={`Previous ${activePeriod}`}>
              <Icon name="chevronl" width={14} height={14} />
            </button>
            <span className="period-date-label">{formatRangeLabel(currentRange)}</span>
            <button
              type="button"
              className="period-date-btn"
              onClick={handleNext}
              disabled={!canGoNext}
              title={`Next ${activePeriod}`}
            >
              <Icon name="chevronr" width={14} height={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="period-cards">
        <article className="period-card">
          <p className="period-card-label">Job cards</p>
          <p className="period-card-value">{currentStats.jobCards}</p>
          <p className="period-card-meta">{currentStats.lineItems} line items</p>
        </article>

        <article className="period-card">
          <p className="period-card-label">Revenue</p>
          <p className="period-card-value">{formatCurrency(currentStats.totalRevenue)}</p>
          <p className="period-card-meta is-green">Net income</p>
        </article>

        <article className="period-card">
          <p className="period-card-label">Commission</p>
          <p className="period-card-value is-amber">{formatCurrency(currentStats.commissionExpense)}</p>
          <p className="period-card-meta">Payable to workers</p>
        </article>

        <article className="period-card">
          <p className="period-card-label">Gross profit</p>
          <p className="period-card-value">{formatCurrency(currentStats.grossProfit)}</p>
          <p className="period-card-meta">Revenue - commission</p>
        </article>

        <article className="period-card">
          <p className="period-card-label">Received</p>
          <p className="period-card-value is-green">{formatCurrency(currentStats.received)}</p>
          <p className="period-card-meta">
            {currentStats.paymentCount} payment{currentStats.paymentCount === 1 ? '' : 's'}
          </p>
        </article>

        <article className="period-card">
          <p className="period-card-label">Outstanding</p>
          <p className={`period-card-value ${currentStats.outstanding > 0 ? 'is-red' : ''}`}>
            {formatCurrency(currentStats.outstanding)}
          </p>
          <p className="period-card-meta">Final bill - received</p>
        </article>
      </div>

      <section className="payment-breakdown-panel">
        <div className="payment-breakdown-head">
          <h3 className="payment-breakdown-title">Payment mode breakdown</h3>
          <p className="payment-breakdown-subtitle">Received this {activePeriod}</p>
        </div>

        <div className="payment-breakdown-body">
          {paymentModes.map((mode) => (
            <div className="pb-row" key={mode.key}>
              <span className={`pb-dot ${mode.className}`} />
              <div className="pb-row-info">
                <div className="pb-row-top">
                  <span className="pb-row-label">{mode.label}</span>
                  <div className="pb-row-right">
                    <span className="pb-row-pct">{mode.share > 0 ? `${mode.share.toFixed(0)}%` : '—'}</span>
                    <span className="pb-row-val">{formatCurrency(mode.value)}</span>
                  </div>
                </div>
                <div className="pb-track">
                  <div
                    className={`pb-fill ${mode.className}`}
                    style={{ '--pb-w': `${mode.share.toFixed(2)}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
