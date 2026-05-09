import type { Job, Payment } from '@/types';
import { getJobFinalBillValue, getJobNetValue, isAgentWorkJob } from '@/lib/jobUtils';
import { buildCollectionEvents } from '@/lib/financeUtils';

export interface TrendDataPoint {
  label: string;
  revenue: number;
  slwRevenue: number;
  grossProfit: number;
  received: number;
  outstanding: number;
}

type GroupBy = 'day' | 'week' | 'month' | 'set';

interface TrendBucket {
  key: string;
  label: string;
  revenue: number;
  slwRevenue: number;
  grossProfit: number;
  received: number;
}

function getWeekStart(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

// 10-day set key: YYYY-MM-1 (days 1-10), YYYY-MM-2 (days 11-20), YYYY-MM-3 (days 21-end)
function setKey(dateStr: string): string {
  const day = parseInt(dateStr.split('-')[2] ?? '1', 10);
  const set = day <= 10 ? '1' : day <= 20 ? '2' : '3';
  return `${dateStr.slice(0, 7)}-${set}`;
}

function formatLabel(key: string, groupBy: GroupBy): string {
  if (groupBy === 'day') {
    return new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }
  if (groupBy === 'week') {
    const weekStart = new Date(`${key}T00:00:00`);
    const weekEnd = new Date(`${key}T00:00:00`);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${weekEnd.toLocaleDateString(
      'en-IN',
      { day: '2-digit', month: 'short' }
    )}`;
  }
  if (groupBy === 'set') {
    // key format: YYYY-MM-1/2/3
    const parts = key.split('-');
    const set = parts[2];
    const ym = parts.slice(0, 2).join('-');
    const [year, month] = ym.split('-').map(Number);
    const monthStr = new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
    if (set === '1') return `${monthStr} 1-10`;
    if (set === '2') return `${monthStr} 11-20`;
    const lastDay = new Date(year, month, 0).getDate();
    return `${monthStr} 21-${lastDay}`;
  }
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function toBucketKey(dateStr: string, groupBy: GroupBy): string {
  if (groupBy === 'day') return dateStr;
  if (groupBy === 'week') return getWeekStart(dateStr);
  if (groupBy === 'set') return setKey(dateStr);
  return monthKey(dateStr);
}

export type { GroupBy as TrendGroupBy };

export interface YoYDataPoint extends TrendDataPoint {
  lyRevenue: number;
  lySlwRevenue: number;
  lyGrossProfit: number;
  lyReceived: number;
  lyOutstanding: number;
}

function shiftDateYears(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-');
  return `${Number(y) + delta}-${m}-${d}`;
}

export function buildRevenueTrendYoY(
  jobs: Job[],
  payments: Payment[],
  groupBy: GroupBy,
  dateRange: { from: string; to: string }
): YoYDataPoint[] {
  const thisYearPoints = buildRevenueTrend(jobs, payments, groupBy, dateRange);

  // Shift last year's data forward 1 year so it falls in the same buckets as this year
  const lyJobs = jobs.map((j) => ({ ...j, date: shiftDateYears(j.date, 1) }));
  const lyPayments = payments.map((p) => ({ ...p, date: shiftDateYears(p.date, 1) }));

  // Filter to the equivalent last-year window then shift forward — use same dateRange for bucket alignment
  const lyDateRange = {
    from: shiftDateYears(dateRange.from, -1),
    to: shiftDateYears(dateRange.to, -1),
  };
  const lyJobsFiltered = lyJobs.filter(
    (j) => shiftDateYears(j.date, -1) >= lyDateRange.from && shiftDateYears(j.date, -1) <= lyDateRange.to
  );
  const lyPaymentsFiltered = lyPayments.filter(
    (p) => shiftDateYears(p.date, -1) >= lyDateRange.from && shiftDateYears(p.date, -1) <= lyDateRange.to
  );

  const lastYearPoints = buildRevenueTrend(lyJobsFiltered, lyPaymentsFiltered, groupBy, dateRange);
  const lyByLabel = new Map(lastYearPoints.map((p) => [p.label, p]));

  return thisYearPoints.map((p) => {
    const ly = lyByLabel.get(p.label);
    return {
      ...p,
      lyRevenue: ly?.revenue ?? 0,
      lySlwRevenue: ly?.slwRevenue ?? 0,
      lyGrossProfit: ly?.grossProfit ?? 0,
      lyReceived: ly?.received ?? 0,
      lyOutstanding: ly?.outstanding ?? 0,
    };
  });
}

export function buildRevenueTrend(
  jobs: Job[],
  payments: Payment[],
  groupBy: GroupBy,
  dateRange?: { from: string; to: string }
): TrendDataPoint[] {
  const buckets = new Map<string, TrendBucket>();
  const jobsInRange = dateRange
    ? jobs.filter((job) => job.date >= dateRange.from && job.date <= dateRange.to)
    : jobs;

  const ensureBucket = (dateStr: string) => {
    const key = toBucketKey(dateStr, groupBy);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: formatLabel(key, groupBy),
        revenue: 0,
        slwRevenue: 0,
        grossProfit: 0,
        received: 0,
      });
    }
    return buckets.get(key)!;
  };

  jobsInRange.forEach((job) => {
    const bucket = ensureBucket(job.date);
    const revenue = getJobFinalBillValue(job);
    bucket.revenue += revenue;
    if (!isAgentWorkJob(job)) bucket.slwRevenue += revenue;
    bucket.grossProfit += getJobNetValue(job);
  });

  // Use deduplicated collection events (vouchers + job-paid entries) so received
  // matches calculatePaymentMetrics rather than raw vouchers only.
  buildCollectionEvents(jobs, payments, dateRange).forEach((event) => {
    const bucket = ensureBucket(event.date);
    bucket.received += event.amount || 0;
  });

  const sorted = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));

  return sorted.map((bucket) => ({
    label: bucket.label,
    revenue: bucket.revenue,
    slwRevenue: bucket.slwRevenue,
    grossProfit: bucket.grossProfit,
    received: bucket.received,
    outstanding: Math.max(0, bucket.revenue - bucket.received),
  }));
}
