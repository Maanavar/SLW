import type { CSSProperties } from 'react';
import type { CommissionWorker, Job } from '@/types';
import { getLocalDateString, getTenDayRange, getWeekStartDate } from '@/lib/dateUtils';
import { formatCurrency } from '@/lib/currencyUtils';

export type ReportTab =
  | 'revenue'
  | 'trends'
  | 'payments'
  | 'commissionSend'
  | 'commissionReceive'
  | 'externalDcPayments'
  | 'customers'
  | 'rankings'
  | 'ageing'
  | 'cashflow'
  | 'tenday';

export type PeriodType =
  | 'today'
  | 'week'
  | 'tenday'
  | 'month'
  | 'quarter'
  | 'year'
  | 'all'
  | 'range';
export type SortOrder = 'asc' | 'desc';
export type WorkerSortKey = 'worker' | 'customer' | 'cards' | 'earned' | 'paid' | 'outstanding';
export type CustomerSortKey =
  | 'customer'
  | 'revenue'
  | 'commission'
  | 'profit'
  | 'received'
  | 'outstanding'
  | 'collectionRate'
  | 'cards';
export type CashflowSortKey =
  | 'date'
  | 'revenue'
  | 'commission'
  | 'netIncome'
  | 'expenses'
  | 'netProfit'
  | 'received'
  | 'outstanding';

export const PERIOD_TABS: { mode: PeriodType; label: string }[] = [
  { mode: 'today', label: 'Today' },
  { mode: 'week', label: 'Week' },
  { mode: 'tenday', label: '10-Day' },
  { mode: 'month', label: 'Month' },
  { mode: 'quarter', label: 'Quarter' },
  { mode: 'year', label: 'Year' },
  { mode: 'all', label: 'All' },
  { mode: 'range', label: 'Range' },
];

export const NAV_TABS: { id: ReportTab; label: string }[] = [
  { id: 'revenue', label: 'Overview' },
  { id: 'trends', label: 'Trends' },
  { id: 'tenday', label: '10-Day' },
  { id: 'externalDcPayments', label: 'External DC Payments' },
  { id: 'commissionSend', label: 'Commission to Send' },
  { id: 'commissionReceive', label: 'Commission to Receive' },
  { id: 'payments', label: 'Payments' },
  { id: 'customers', label: 'Customers' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'ageing', label: 'Ageing' },
  { id: 'cashflow', label: 'Cash Flow' },
];

export const VALID_REPORT_TABS: ReportTab[] = [
  'revenue',
  'trends',
  'payments',
  'commissionSend',
  'commissionReceive',
  'externalDcPayments',
  'customers',
  'rankings',
  'ageing',
  'cashflow',
  'tenday',
];

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function mapQueryTab(tab: string | null): ReportTab | null {
  if (!tab) return null;
  if (tab === 'commission') return 'commissionSend';
  return VALID_REPORT_TABS.includes(tab as ReportTab) ? (tab as ReportTab) : null;
}

export function nextSortState<T extends string>(
  current: { key: T; order: SortOrder } | null,
  key: T,
  defaultOrder: SortOrder = 'asc'
): { key: T; order: SortOrder } {
  if (current?.key === key) {
    return { key, order: current.order === 'asc' ? 'desc' : 'asc' };
  }
  return { key, order: defaultOrder };
}

export function sortMark<T extends string>(
  state: { key: T; order: SortOrder } | null,
  key: T
): string {
  if (!state || state.key !== key) return '\u2195';
  return state.order === 'asc' ? '\u2191' : '\u2193';
}

export function normalizeToken(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function toCanonicalLocalDate(dateValue: string | null | undefined): string | null {
  const raw = String(dateValue || '').trim();
  if (!raw) return null;

  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (ymd) {
    const year = ymd[1];
    const month = String(Number(ymd[2])).padStart(2, '0');
    const day = String(Number(ymd[3])).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(raw);
  if (dmy) {
    const day = String(Number(dmy[1])).padStart(2, '0');
    const month = String(Number(dmy[2])).padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function resolveCommissionWorkerId(job: Job, workers: CommissionWorker[]): number | null {
  if (typeof job.commissionWorkerId === 'number') {
    return job.commissionWorkerId;
  }
  const workerName = job.commissionWorkerName?.trim();
  if (!workerName) return null;
  const normalizedName = workerName.toLowerCase();
  const matchedWorker = workers.find(
    (worker) => worker.customerId === job.customerId && worker.name.toLowerCase() === normalizedName
  );
  return matchedWorker?.id ?? null;
}

export function getDateRange(period: PeriodType): { from: string; to: string } | undefined {
  if (period === 'all' || period === 'range') return undefined;
  const today = new Date();
  const toStr = getLocalDateString(today);
  let from: Date;

  if (period === 'today') {
    from = new Date(today);
    from.setHours(0, 0, 0, 0);
  } else if (period === 'tenday') {
    return getTenDayRange(today);
  } else if (period === 'week') {
    return { from: getWeekStartDate(today), to: toStr };
  } else if (period === 'month') {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === 'quarter') {
    from = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  } else {
    from = new Date(today.getFullYear(), 0, 1);
  }

  return { from: getLocalDateString(from), to: toStr };
}

export function getDateRangeWithOffset(
  period: PeriodType,
  offset: number
): { from: string; to: string } | undefined {
  if (period === 'all' || period === 'range') return getDateRange(period);
  if (period === 'tenday') return getTenDayRange(new Date(), offset);
  if (offset === 0) return getDateRange(period);

  const today = new Date();

  if (period === 'today') {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const s = getLocalDateString(d);
    return { from: s, to: s };
  }

  if (period === 'week') {
    const base = new Date(today);
    base.setDate(base.getDate() + offset * 7);
    const ws = getWeekStartDate(base);
    const we = new Date(`${ws}T00:00:00`);
    we.setDate(we.getDate() + 6);
    return { from: ws, to: getLocalDateString(we) };
  }

  if (period === 'month') {
    let m = today.getMonth() + offset;
    const y = today.getFullYear() + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    const from = new Date(y, m, 1);
    const to = new Date(y, m + 1, 0);
    return { from: getLocalDateString(from), to: getLocalDateString(to) };
  }

  if (period === 'quarter') {
    let q = Math.floor(today.getMonth() / 3) + offset;
    const y = today.getFullYear() + Math.floor(q / 4);
    q = ((q % 4) + 4) % 4;
    const from = new Date(y, q * 3, 1);
    const to = new Date(y, q * 3 + 3, 0);
    return { from: getLocalDateString(from), to: getLocalDateString(to) };
  }

  if (period === 'year') {
    const y = today.getFullYear() + offset;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }

  return getDateRange(period);
}

export function getOffsetPeriodLabel(period: PeriodType, offset: number): string {
  const range = getDateRangeWithOffset(period, offset);
  if (!range) return '';

  if (period === 'tenday') {
    const s = new Date(`${range.from}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
    const e = new Date(`${range.to}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
    return `${s} - ${e}`;
  }

  if (period === 'today') {
    return new Date(`${range.from}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  if (period === 'week') {
    const s = new Date(`${range.from}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
    const e = new Date(`${range.to}T00:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
    return `${s} - ${e}`;
  }

  if (period === 'month') {
    const [y, m] = range.from.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  if (period === 'quarter') {
    const [y, m] = range.from.split('-').map(Number);
    return `Q${Math.ceil(m / 3)} ${y}`;
  }

  if (period === 'year') {
    return range.from.substring(0, 4);
  }

  return '';
}

export function BarChart({
  items,
  maxVal,
}: {
  items: { label: string; value: number }[];
  maxVal: number;
}) {
  return (
    <div className="fin-bar-list">
      {items.map((item) => (
        <div key={item.label} className="fin-bar-item">
          <span className="fin-bar-label" title={item.label}>
            {item.label}
          </span>
          <div className="fin-bar-track">
            <div
              className="fin-bar-fill"
              style={
                {
                  '--bar-width': maxVal > 0 ? `${(item.value / maxVal) * 100}%` : '0%',
                } as CSSProperties
              }
            />
          </div>
          <span className="fin-bar-value">{formatCurrency(item.value)}</span>
        </div>
      ))}
    </div>
  );
}
