import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, getPaymentEventsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobFinalBillValue, getJobCardPaymentSummary, getJobNetValue, getJobWorkerCommissionExpense } from '@/lib/jobUtils';
import { getLocalDateString, getTenDayRange, getWeekStartDate } from '@/lib/dateUtils';

type ActivePeriod = 'today' | 'week' | 'tenday' | 'month' | 'quarter' | 'year';

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
  paidCards: number;
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

function getTrend(
  current: number,
  prev: number,
  higherIsBetter: boolean
): { arrow: string; pct: string; cls: string } | null {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return { arrow: '↑', pct: 'new', cls: higherIsBetter ? 'trend-pos' : 'trend-neg' };
  const pct = ((current - prev) / prev) * 100;
  if (Math.abs(pct) < 3) return { arrow: '→', pct: `${Math.abs(pct).toFixed(0)}%`, cls: 'trend-neu' };
  const isUp = pct > 0;
  return {
    arrow: isUp ? '↑' : '↓',
    pct: `${Math.abs(pct).toFixed(0)}%`,
    cls: isUp === higherIsBetter ? 'trend-pos' : 'trend-neg',
  };
}

function TrendBadge({ current, prev, higher }: { current: number; prev: number; higher: boolean }) {
  const t = getTrend(current, prev, higher);
  if (!t) return null;
  return <span className={`period-trend ${t.cls}`}>{t.arrow} {t.pct}</span>;
}

function getPeriodStats(
  jobsInPeriod: ReturnType<typeof getJobsInRange>,
  paymentEventsInPeriod: ReturnType<typeof getPaymentEventsInRange>
): PeriodStats {
  const jobCards = groupJobsByCard(jobsInPeriod).length;
  const lineItems = jobsInPeriod.length;

  const totalRevenue = jobsInPeriod.reduce((sum, job) => sum + getJobFinalBillValue(job), 0);
  const commissionExpense = jobsInPeriod.reduce((sum, job) => sum + getJobWorkerCommissionExpense(job), 0);
  const grossProfit = jobsInPeriod.reduce((sum, job) => sum + getJobNetValue(job), 0);

  const received = paymentEventsInPeriod.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const outstanding = Math.max(0, totalRevenue - received);

  // Count paid job cards (cards with at least partial payment)
  const grouped = groupJobsByCard(jobsInPeriod);
  const paidCards = grouped.filter(group => {
    const payment = getJobCardPaymentSummary(group.jobs);
    return payment.status === 'Paid' || payment.status === 'Partially Paid';
  }).length;

  const receivedBreakdown: PaymentBreakdown = {
    cash: 0,
    upi: 0,
    bank: 0,
    cheque: 0,
  };

  paymentEventsInPeriod.forEach((entry) => {
    const amount = entry.amount || 0;
    if (amount <= 0) return;

    if (entry.paymentMode === 'Cash') {
      receivedBreakdown.cash += amount;
    } else if (entry.paymentMode === 'UPI') {
      receivedBreakdown.upi += amount;
    } else if (entry.paymentMode === 'Bank') {
      receivedBreakdown.bank += amount;
    } else if (entry.paymentMode === 'Cheque') {
      receivedBreakdown.cheque += amount;
    } else if (entry.paymentMode === 'Mixed' && entry.breakdown) {
      receivedBreakdown.cash += entry.breakdown.cash || 0;
      receivedBreakdown.upi += entry.breakdown.upi || 0;
      receivedBreakdown.bank += entry.breakdown.bank || 0;
      receivedBreakdown.cheque += entry.breakdown.cheque || 0;
    }
  });

  return {
    jobCards,
    lineItems,
    totalRevenue,
    commissionExpense,
    grossProfit,
    received,
    outstanding,
    paidCards,
    receivedBreakdown,
  };
}

export function PeriodSummaryRow() {
  const { jobs, payments } = useDataStore();
  const [activePeriod, setActivePeriod] = useState<ActivePeriod>('today');
  const [dayOffset, setDayOffset] = useState(0);
  const [tenDayOffset, setTenDayOffset] = useState(0);
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

  const tenDayRange: DateRange = useMemo(() => {
    const range = getTenDayRange(baseToday, -tenDayOffset, true);
    return { from: range.from, to: range.to };
  }, [tenDayOffset, baseToday]);

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
    const paymentEvents = getPaymentEventsInRange(jobs, payments, dayRange.from, dayRange.to);
    return getPeriodStats(filteredJobs, paymentEvents);
  }, [jobs, payments, dayRange]);

  const weekStats = useMemo(() => {
    const filteredJobs = getJobsInRange(jobs, weekRange.from, weekRange.to);
    const paymentEvents = getPaymentEventsInRange(jobs, payments, weekRange.from, weekRange.to);
    return getPeriodStats(filteredJobs, paymentEvents);
  }, [jobs, payments, weekRange]);

  const tenDayStats = useMemo(() => {
    const filteredJobs = getJobsInRange(jobs, tenDayRange.from, tenDayRange.to);
    const paymentEvents = getPaymentEventsInRange(jobs, payments, tenDayRange.from, tenDayRange.to);
    return getPeriodStats(filteredJobs, paymentEvents);
  }, [jobs, payments, tenDayRange]);

  const monthStats = useMemo(() => {
    const filteredJobs = getJobsInRange(jobs, monthRange.from, monthRange.to);
    const paymentEvents = getPaymentEventsInRange(jobs, payments, monthRange.from, monthRange.to);
    return getPeriodStats(filteredJobs, paymentEvents);
  }, [jobs, payments, monthRange]);

  const quarterStats = useMemo(() => {
    const filteredJobs = getJobsInRange(jobs, quarterRange.from, quarterRange.to);
    const paymentEvents = getPaymentEventsInRange(jobs, payments, quarterRange.from, quarterRange.to);
    return getPeriodStats(filteredJobs, paymentEvents);
  }, [jobs, payments, quarterRange]);

  const yearStats = useMemo(() => {
    const filteredJobs = getJobsInRange(jobs, yearRange.from, yearRange.to);
    const paymentEvents = getPaymentEventsInRange(jobs, payments, yearRange.from, yearRange.to);
    return getPeriodStats(filteredJobs, paymentEvents);
  }, [jobs, payments, yearRange]);

  const prevStats = useMemo(() => {
    let prevRange: DateRange;
    if (activePeriod === 'today') {
      const d = shiftDays(baseToday, -(dayOffset + 1));
      const val = toDateString(d);
      prevRange = { from: val, to: val };
    } else if (activePeriod === 'tenday') {
      const previousSet = getTenDayRange(baseToday, -(tenDayOffset + 1), false);
      prevRange = { from: previousSet.from, to: previousSet.to };
    } else if (activePeriod === 'week') {
      const base = shiftDays(baseToday, -(weekOffset + 1) * 7);
      const from = getWeekStartDate(base);
      const fromDate = new Date(`${from}T00:00:00`);
      prevRange = { from, to: toDateString(shiftDays(fromDate, 6)) };
    } else if (activePeriod === 'month') {
      const monthBase = shiftMonths(baseToday, -(monthOffset + 1));
      prevRange = {
        from: toDateString(new Date(monthBase.getFullYear(), monthBase.getMonth(), 1)),
        to: toDateString(getLastDayOfMonth(monthBase)),
      };
    } else if (activePeriod === 'quarter') {
      const qBase = shiftMonths(baseToday, -((quarterOffset + 1) * 3));
      const qStart = Math.floor(qBase.getMonth() / 3) * 3;
      prevRange = {
        from: toDateString(new Date(qBase.getFullYear(), qStart, 1)),
        to: toDateString(new Date(qBase.getFullYear(), qStart + 3, 0)),
      };
    } else {
      const yBase = new Date(baseToday.getFullYear() - (yearOffset + 1), 0, 1);
      prevRange = {
        from: toDateString(yBase),
        to: toDateString(new Date(yBase.getFullYear(), 11, 31)),
      };
    }
    const filteredJobs = getJobsInRange(jobs, prevRange.from, prevRange.to);
    const paymentEvents = getPaymentEventsInRange(jobs, payments, prevRange.from, prevRange.to);
    return getPeriodStats(filteredJobs, paymentEvents);
  }, [activePeriod, dayOffset, tenDayOffset, weekOffset, monthOffset, quarterOffset, yearOffset, jobs, payments, baseToday]);

  const currentRange =
    activePeriod === 'today'
      ? dayRange
      : activePeriod === 'tenday'
        ? tenDayRange
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
      : activePeriod === 'tenday'
        ? tenDayStats
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
      : activePeriod === 'tenday'
        ? tenDayOffset
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
    else if (activePeriod === 'tenday') setTenDayOffset((value) => value + 1);
    else if (activePeriod === 'week') setWeekOffset((value) => value + 1);
    else if (activePeriod === 'month') setMonthOffset((value) => value + 1);
    else if (activePeriod === 'quarter') setQuarterOffset((value) => value + 1);
    else setYearOffset((value) => value + 1);
  };

  const handleNext = () => {
    if (!canGoNext) return;
    if (activePeriod === 'today') setDayOffset((value) => value - 1);
    else if (activePeriod === 'tenday') setTenDayOffset((value) => value - 1);
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
            {(['today', 'week', 'tenday', 'month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`period-toggle-btn ${activePeriod === p ? 'active' : ''}`}
                onClick={() => setActivePeriod(p)}
                aria-current={activePeriod === p ? 'true' : undefined}
              >
                {p === 'tenday' ? '10-Day' : p.charAt(0).toUpperCase() + p.slice(1)}
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
          <p className="period-card-meta">
            {currentStats.lineItems} line items
            <TrendBadge current={currentStats.jobCards} prev={prevStats.jobCards} higher />
          </p>
        </article>

        <article className="period-card">
          <p className="period-card-label">Revenue</p>
          <p className="period-card-value">{formatCurrency(currentStats.totalRevenue)}</p>
          <p className="period-card-meta is-green">
            Net income
            <TrendBadge current={currentStats.totalRevenue} prev={prevStats.totalRevenue} higher />
          </p>
        </article>

        <article className="period-card">
          <p className="period-card-label">Commission</p>
          <p className="period-card-value is-amber">{formatCurrency(currentStats.commissionExpense)}</p>
          <p className="period-card-meta">
            Payable to workers
            <TrendBadge current={currentStats.commissionExpense} prev={prevStats.commissionExpense} higher={false} />
          </p>
        </article>

        <article className="period-card">
          <p className="period-card-label">Gross profit</p>
          <p className="period-card-value">{formatCurrency(currentStats.grossProfit)}</p>
          <p className="period-card-meta">
            Net income after flow adjustments
            <TrendBadge current={currentStats.grossProfit} prev={prevStats.grossProfit} higher />
          </p>
        </article>

        <article className="period-card">
          <p className="period-card-label">Received</p>
          <p className="period-card-value is-green">{formatCurrency(currentStats.received)}</p>
          <p className="period-card-meta">
            {currentStats.paidCards}/{currentStats.jobCards} payments
            <TrendBadge current={currentStats.received} prev={prevStats.received} higher />
          </p>
        </article>

        <article className="period-card">
          <p className="period-card-label">Outstanding</p>
          <p className={`period-card-value ${currentStats.outstanding > 0 ? 'is-red' : ''}`}>
            {formatCurrency(currentStats.outstanding)}
          </p>
          <p className="period-card-meta">
            Final bill - received
            <TrendBadge current={currentStats.outstanding} prev={prevStats.outstanding} higher={false} />
          </p>
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
              <span className="pb-row-label">{mode.label}</span>
              <div className="pb-track">
                <div
                  className={`pb-fill ${mode.className}`}
                  style={{ '--pb-w': `${mode.share.toFixed(2)}%` } as React.CSSProperties}
                />
              </div>
              <span className="pb-row-pct">{mode.share > 0 ? `${mode.share.toFixed(0)}%` : '—'}</span>
              <span className="pb-row-val">{formatCurrency(mode.value)}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
