import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobFinalBillValue, getJobCardPaymentSummary, getJobWorkerCommissionExpense, getJobPaidAmount, isAgentWorkJob, getJobAgentCommissionIncome } from '@/lib/jobUtils';
import { getLocalDateString, getTenDayRange, getWeekStartDate } from '@/lib/dateUtils';

type ActivePeriod = 'today' | 'week' | 'tenday' | 'month' | 'quarter' | 'year' | 'custom';

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

const ZERO_STATS: PeriodStats = {
  jobCards: 0,
  lineItems: 0,
  totalRevenue: 0,
  commissionExpense: 0,
  grossProfit: 0,
  received: 0,
  outstanding: 0,
  paidCards: 0,
  receivedBreakdown: { cash: 0, upi: 0, bank: 0, cheque: 0 },
};

interface PeriodSummaryRowProps {
  onRangeChange?: (range: DateRange) => void;
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

function getDateRangeForOffset(period: ActivePeriod, offset: number, baseToday: Date): DateRange {
  if (period === 'today') {
    const val = toDateString(shiftDays(baseToday, -offset));
    return { from: val, to: val };
  }
  if (period === 'week') {
    const base = shiftDays(baseToday, -offset * 7);
    const from = getWeekStartDate(base);
    const to = offset === 0 ? toDateString(baseToday) : toDateString(shiftDays(new Date(`${from}T00:00:00`), 6));
    return { from, to };
  }
  if (period === 'tenday') {
    const r = getTenDayRange(baseToday, -offset, true);
    return { from: r.from, to: r.to };
  }
  if (period === 'month') {
    const monthBase = shiftMonths(baseToday, -offset);
    const fromDate = new Date(monthBase.getFullYear(), monthBase.getMonth(), 1);
    const toDate = offset === 0 ? baseToday : getLastDayOfMonth(monthBase);
    return { from: toDateString(fromDate), to: toDateString(toDate) };
  }
  if (period === 'quarter') {
    const qBase = shiftMonths(baseToday, -(offset * 3));
    const qStart = Math.floor(qBase.getMonth() / 3) * 3;
    const fromDate = new Date(qBase.getFullYear(), qStart, 1);
    const toDate = offset === 0 ? baseToday : new Date(qBase.getFullYear(), qStart + 3, 0);
    return { from: toDateString(fromDate), to: toDateString(toDate) };
  }
  const yBase = new Date(baseToday.getFullYear() - offset, 0, 1);
  return {
    from: toDateString(yBase),
    to: toDateString(offset === 0 ? baseToday : new Date(yBase.getFullYear(), 11, 31)),
  };
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

function Sparkline({ values, higherIsBetter }: { values: number[]; higherIsBetter: boolean }) {
  if (values.length < 2) return null;
  const W = 72, H = 28, PAD = 2;
  const max = Math.max(...values, 0.001);
  const min = Math.min(...values, 0);
  const span = max - min || max || 1;
  const pts = values
    .map((v, i) => {
      const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const isUp = last > first * 1.02;
  const isDown = last < first * 0.98;
  const stroke = isUp
    ? higherIsBetter ? 'var(--green)' : 'var(--red)'
    : isDown
    ? higherIsBetter ? 'var(--red)' : 'var(--green)'
    : 'var(--text-faint)';
  return (
    <svg width={W} height={H} className="kpi-sparkline" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getPeriodStats(jobsInPeriod: ReturnType<typeof getJobsInRange>): PeriodStats {
  const jobCards = groupJobsByCard(jobsInPeriod).length;
  const lineItems = jobsInPeriod.length;

  const totalRevenue = jobsInPeriod.reduce((sum, job) => sum + getJobFinalBillValue(job), 0);
  const commissionExpense = jobsInPeriod.reduce((sum, job) => sum + getJobWorkerCommissionExpense(job), 0);
  const grossProfit = jobsInPeriod.reduce((sum, job) => {
    if (isAgentWorkJob(job)) return sum + getJobAgentCommissionIncome(job);
    return sum + (Number(job.amount) || 0);
  }, 0);

  // Received and breakdown are scoped to the jobs in the period so "Received"
  // always corresponds to this period's jobs — not payments recorded on this date
  // for older jobs.
  const receivedBreakdown: PaymentBreakdown = { cash: 0, upi: 0, bank: 0, cheque: 0 };
  jobsInPeriod.forEach((job) => {
    const paid = getJobPaidAmount(job);
    if (paid <= 0) return;
    const mode = (job.paymentMode as string) || 'Cash';
    if (mode === 'UPI') receivedBreakdown.upi += paid;
    else if (mode === 'Bank') receivedBreakdown.bank += paid;
    else if (mode === 'Cheque') receivedBreakdown.cheque += paid;
    else receivedBreakdown.cash += paid;
  });

  const received = receivedBreakdown.cash + receivedBreakdown.upi + receivedBreakdown.bank + receivedBreakdown.cheque;
  const outstanding = Math.max(0, totalRevenue - received);

  const grouped = groupJobsByCard(jobsInPeriod);
  const paidCards = grouped.filter(group => {
    const payment = getJobCardPaymentSummary(group.jobs);
    return payment.status === 'Paid' || payment.status === 'Partially Paid';
  }).length;

  return { jobCards, lineItems, totalRevenue, commissionExpense, grossProfit, received, outstanding, paidCards, receivedBreakdown };
}

export function PeriodSummaryRow({ onRangeChange }: PeriodSummaryRowProps) {
  const { jobs } = useDataStore();
  const [activePeriod, setActivePeriod] = useState<ActivePeriod>('today');
  const [dayOffset, setDayOffset] = useState(0);
  const [tenDayOffset, setTenDayOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [quarterOffset, setQuarterOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const baseToday = useMemo(() => new Date(), []);

  const [customFrom, setCustomFrom] = useState(() => {
    const today = new Date();
    return toDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  });
  const [customTo, setCustomTo] = useState(() => toDateString(new Date()));

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
    return { from: toDateString(fromDate), to: toDateString(toDate) };
  }, [monthOffset, baseToday]);

  const quarterRange: DateRange = useMemo(() => {
    const quarterBase = shiftMonths(baseToday, -(quarterOffset * 3));
    const quarterStartMonth = Math.floor(quarterBase.getMonth() / 3) * 3;
    const fromDate = new Date(quarterBase.getFullYear(), quarterStartMonth, 1);
    const toDate =
      quarterOffset === 0
        ? baseToday
        : new Date(quarterBase.getFullYear(), quarterStartMonth + 3, 0);
    return { from: toDateString(fromDate), to: toDateString(toDate) };
  }, [quarterOffset, baseToday]);

  const yearRange: DateRange = useMemo(() => {
    const yearBase = new Date(baseToday.getFullYear() - yearOffset, 0, 1);
    return {
      from: toDateString(yearBase),
      to: toDateString(yearOffset === 0 ? baseToday : new Date(yearBase.getFullYear(), 11, 31)),
    };
  }, [yearOffset, baseToday]);

  const customRange: DateRange = useMemo(() => {
    const todayStr = toDateString(baseToday);
    const from = customFrom || todayStr;
    const to = customTo || todayStr;
    return from <= to ? { from, to } : { from: to, to: from };
  }, [customFrom, customTo, baseToday]);

  const todayStats = useMemo(() => {
    return getPeriodStats(getJobsInRange(jobs, dayRange.from, dayRange.to));
  }, [jobs, dayRange]);

  const weekStats = useMemo(() => {
    return getPeriodStats(getJobsInRange(jobs, weekRange.from, weekRange.to));
  }, [jobs, weekRange]);

  const tenDayStats = useMemo(() => {
    return getPeriodStats(getJobsInRange(jobs, tenDayRange.from, tenDayRange.to));
  }, [jobs, tenDayRange]);

  const monthStats = useMemo(() => {
    return getPeriodStats(getJobsInRange(jobs, monthRange.from, monthRange.to));
  }, [jobs, monthRange]);

  const quarterStats = useMemo(() => {
    return getPeriodStats(getJobsInRange(jobs, quarterRange.from, quarterRange.to));
  }, [jobs, quarterRange]);

  const yearStats = useMemo(() => {
    return getPeriodStats(getJobsInRange(jobs, yearRange.from, yearRange.to));
  }, [jobs, yearRange]);

  const customStats = useMemo(() => {
    if (activePeriod !== 'custom') return ZERO_STATS;
    return getPeriodStats(getJobsInRange(jobs, customRange.from, customRange.to));
  }, [activePeriod, jobs, customRange]);

  const currentRange =
    activePeriod === 'today' ? dayRange
    : activePeriod === 'tenday' ? tenDayRange
    : activePeriod === 'week' ? weekRange
    : activePeriod === 'month' ? monthRange
    : activePeriod === 'quarter' ? quarterRange
    : activePeriod === 'year' ? yearRange
    : customRange;

  const currentStats =
    activePeriod === 'today' ? todayStats
    : activePeriod === 'tenday' ? tenDayStats
    : activePeriod === 'week' ? weekStats
    : activePeriod === 'month' ? monthStats
    : activePeriod === 'quarter' ? quarterStats
    : activePeriod === 'year' ? yearStats
    : customStats;

  const currentOffset =
    activePeriod === 'today' ? dayOffset
    : activePeriod === 'tenday' ? tenDayOffset
    : activePeriod === 'week' ? weekOffset
    : activePeriod === 'month' ? monthOffset
    : activePeriod === 'quarter' ? quarterOffset
    : activePeriod === 'year' ? yearOffset
    : 0;

  const canGoNext = activePeriod !== 'custom' && currentOffset > 0;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onRangeChange?.(currentRange); }, [currentRange.from, currentRange.to]);

  const prevStats = useMemo(() => {
    if (activePeriod === 'custom') return ZERO_STATS;
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
    return getPeriodStats(getJobsInRange(jobs, prevRange.from, prevRange.to));
  }, [activePeriod, dayOffset, tenDayOffset, weekOffset, monthOffset, quarterOffset, yearOffset, jobs, baseToday]);

  const sparklineData = useMemo(() => {
    if (activePeriod === 'custom') return [];
    const baseOffset =
      activePeriod === 'today' ? dayOffset
      : activePeriod === 'tenday' ? tenDayOffset
      : activePeriod === 'week' ? weekOffset
      : activePeriod === 'month' ? monthOffset
      : activePeriod === 'quarter' ? quarterOffset
      : yearOffset;
    return Array.from({ length: 8 }, (_, i) => {
      const offset = baseOffset + (7 - i);
      const range = getDateRangeForOffset(activePeriod, offset, baseToday);
      return getPeriodStats(getJobsInRange(jobs, range.from, range.to));
    });
  }, [activePeriod, dayOffset, tenDayOffset, weekOffset, monthOffset, quarterOffset, yearOffset, jobs, baseToday]);

  const handlePrev = () => {
    if (activePeriod === 'today') setDayOffset((v) => v + 1);
    else if (activePeriod === 'tenday') setTenDayOffset((v) => v + 1);
    else if (activePeriod === 'week') setWeekOffset((v) => v + 1);
    else if (activePeriod === 'month') setMonthOffset((v) => v + 1);
    else if (activePeriod === 'quarter') setQuarterOffset((v) => v + 1);
    else if (activePeriod === 'year') setYearOffset((v) => v + 1);
  };

  const handleNext = () => {
    if (!canGoNext) return;
    if (activePeriod === 'today') setDayOffset((v) => v - 1);
    else if (activePeriod === 'tenday') setTenDayOffset((v) => v - 1);
    else if (activePeriod === 'week') setWeekOffset((v) => v - 1);
    else if (activePeriod === 'month') setMonthOffset((v) => v - 1);
    else if (activePeriod === 'quarter') setQuarterOffset((v) => v - 1);
    else if (activePeriod === 'year') setYearOffset((v) => v - 1);
  };

  const paymentModes = useMemo(() => {
    const breakdown = currentStats.receivedBreakdown;
    const total = breakdown.cash + breakdown.upi + breakdown.bank + breakdown.cheque;
    return [
      { key: 'cash', label: 'Cash', value: breakdown.cash, cls: 'mode-cash' },
      { key: 'upi', label: 'UPI', value: breakdown.upi, cls: 'mode-upi' },
      { key: 'bank', label: 'Bank', value: breakdown.bank, cls: 'mode-bank' },
      { key: 'cheque', label: 'Cheque', value: breakdown.cheque, cls: 'mode-cheque' },
    ].map((m) => ({ ...m, share: total > 0 ? (m.value / total) * 100 : 0 }));
  }, [currentStats]);

  const paymentTotal = paymentModes.reduce((s, m) => s + m.value, 0);

  const PERIOD_LABELS: Record<ActivePeriod, string> = {
    today: 'Today', week: 'Week', tenday: '10-Day',
    month: 'Month', quarter: 'Quarter', year: 'Year', custom: 'Custom',
  };

  return (
    <section className="period-performance">
      <div className="period-performance-head">
        <h2 className="period-title">Period performance</h2>

        <div className="period-controls">
          <div className="period-toggle">
            {(['today', 'week', 'tenday', 'month', 'quarter', 'year', 'custom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`period-toggle-btn ${activePeriod === p ? 'active' : ''}`}
                onClick={() => setActivePeriod(p)}
                aria-current={activePeriod === p ? 'true' : undefined}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <select
            className="period-toggle-select"
            value={activePeriod}
            onChange={(e) => setActivePeriod(e.target.value as ActivePeriod)}
            aria-label="Select period"
          >
            {(['today', 'week', 'tenday', 'month', 'quarter', 'year', 'custom'] as const).map((p) => (
              <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
            ))}
          </select>

          {activePeriod === 'custom' ? (
            <div className="period-custom-inputs">
              <input
                type="date"
                className="period-custom-input"
                value={customFrom}
                max={customTo || toDateString(baseToday)}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="From date"
              />
              <span className="period-custom-sep">→</span>
              <input
                type="date"
                className="period-custom-input"
                value={customTo}
                min={customFrom}
                max={toDateString(baseToday)}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="To date"
              />
            </div>
          ) : (
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
          )}
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
          <Sparkline values={sparklineData.map((s) => s.jobCards)} higherIsBetter />
        </article>

        <article className="period-card">
          <p className="period-card-label">Revenue</p>
          <p className="period-card-value">{formatCurrency(currentStats.totalRevenue)}</p>
          <p className="period-card-meta">
            Gross billed to customers
            <TrendBadge current={currentStats.totalRevenue} prev={prevStats.totalRevenue} higher />
          </p>
          <Sparkline values={sparklineData.map((s) => s.totalRevenue)} higherIsBetter />
        </article>

        <article className="period-card">
          <p className="period-card-label">Commission</p>
          <p className="period-card-value is-amber">{formatCurrency(currentStats.commissionExpense)}</p>
          <p className="period-card-meta">
            Payable to workers
            <TrendBadge current={currentStats.commissionExpense} prev={prevStats.commissionExpense} higher={false} />
          </p>
          <Sparkline values={sparklineData.map((s) => s.commissionExpense)} higherIsBetter={false} />
        </article>

        <article className="period-card">
          <p className="period-card-label">Gross profit</p>
          <p className="period-card-value">{formatCurrency(currentStats.grossProfit)}</p>
          <p className="period-card-meta">
            Net income after flow adjustments
            <TrendBadge current={currentStats.grossProfit} prev={prevStats.grossProfit} higher />
          </p>
          <Sparkline values={sparklineData.map((s) => s.grossProfit)} higherIsBetter />
        </article>

        <article className="period-card">
          <p className="period-card-label">Received</p>
          <p className="period-card-value is-green">{formatCurrency(currentStats.received)}</p>
          <p className="period-card-meta">
            {currentStats.paidCards}/{currentStats.jobCards} payments
            <TrendBadge current={currentStats.received} prev={prevStats.received} higher />
          </p>
          <Sparkline values={sparklineData.map((s) => s.received)} higherIsBetter />
        </article>

        <article className="period-card">
          <p className="period-card-label">Outstanding</p>
          <p className={`period-card-value ${currentStats.outstanding > 0 ? 'is-red' : ''}`}>
            {formatCurrency(currentStats.outstanding)}
          </p>
          <p className="period-card-meta">
            Billed but not yet collected
            <TrendBadge current={currentStats.outstanding} prev={prevStats.outstanding} higher={false} />
          </p>
          <Sparkline values={sparklineData.map((s) => s.outstanding)} higherIsBetter={false} />
        </article>
      </div>

      {/* Compact payment mode strip */}
      <div className="pb-strip">
        <span className="pb-strip-title">Payment modes</span>
        <div className="pb-stacked-bar" title={paymentTotal > 0 ? `Total received: ${formatCurrency(paymentTotal)}` : 'No payments recorded'}>
          {paymentTotal > 0 ? (
            paymentModes.filter((m) => m.value > 0).map((m) => (
              <div
                key={m.key}
                className={`pb-stacked-seg ${m.cls}`}
                style={{ '--pb-seg-w': `${m.share.toFixed(2)}%` } as React.CSSProperties}
                title={`${m.label}: ${formatCurrency(m.value)} (${m.share.toFixed(0)}%)`}
              />
            ))
          ) : (
            <div className="pb-stacked-empty" />
          )}
        </div>
        <div className="pb-strip-legend">
          {paymentModes.map((m) => (
            <div key={m.key} className={`pb-legend-chip${m.value === 0 ? ' is-zero' : ''}`}>
              <span className={`pb-dot ${m.cls}`} />
              <span className="pb-legend-chip-label">{m.label}</span>
              <span className="pb-legend-chip-val">{formatCurrency(m.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
