import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString, getTenDayRange, getWeekStartDate } from '@/lib/dateUtils';
import {
  getJobAgentCommissionIncome,
  getJobAgentTdsAmount,
  getJobAgentSettlementPending,
  getJobFinalBillValue,
  getJobWorkerCommissionExpense,
  groupJobsByCard,
  isAgentWorkJob,
} from '@/lib/jobUtils';
import {
  calculateRevenueMetrics,
  calculatePaymentMetrics,
  calculateCommissionMetrics,
  calculateWorkerCommissionSummary,
  calculateCustomerFinancials,
  calculateCustomerAgeing,
  calculateCollectionMethodBreakdown,
  calculateDailyCashFlow,
  calculateTenDayBreakdown,
} from '@/lib/financeUtils';
import { rankCustomers } from '@/lib/customerRankingUtils';
import { CustomerRankingTable } from '@/components/charts/CustomerRankingTable';
import { AgeingHeatmap } from '@/components/charts/AgeingHeatmap';
import { RevenueTrendChart } from '@/components/charts/RevenueTrendChart';
import type { CommissionWorker, Job } from '@/types';
import '@/components/charts/CustomerRankingTable.css';
import '@/components/charts/AgeingHeatmap.css';
import '@/components/charts/RevenueTrendChart.css';
import './FinanceReports.css';

type ReportTab = 'revenue' | 'trends' | 'payments' | 'commission' | 'customers' | 'rankings' | 'ageing' | 'cashflow' | 'tenday';
type PeriodType = 'today' | 'week' | 'tenday' | 'month' | 'quarter' | 'year' | 'all' | 'range';
type SortOrder = 'asc' | 'desc';
type WorkerSortKey = 'customer' | 'cards' | 'outstanding';
type CustomerSortKey = 'customer' | 'revenue' | 'outstanding' | 'cards';
type CashflowSortKey = 'revenue' | 'outstanding';

const PERIOD_TABS: { mode: PeriodType; label: string }[] = [
  { mode: 'today',   label: 'Today' },
  { mode: 'week',    label: 'Week' },
  { mode: 'tenday',  label: '10-Day' },
  { mode: 'month',   label: 'Month' },
  { mode: 'quarter', label: 'Quarter' },
  { mode: 'year',    label: 'Year' },
  { mode: 'all',     label: 'All' },
  { mode: 'range',   label: 'Range' },
];

const NAV_TABS: { id: ReportTab; label: string }[] = [
  { id: 'revenue',    label: 'Overview' },
  { id: 'trends',     label: 'Trends' },
  { id: 'payments',   label: 'Payments' },
  { id: 'tenday',     label: '10-Day' },
  { id: 'commission', label: 'Commission' },
  { id: 'customers',  label: 'Customers' },
  { id: 'rankings',   label: 'Rankings' },
  { id: 'ageing',     label: 'Ageing' },
  { id: 'cashflow',   label: 'Cash Flow' },
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function resolveCommissionWorkerId(job: Job, workers: CommissionWorker[]): number | null {
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

function getDateRange(period: PeriodType): { from: string; to: string } | undefined {
  if (period === 'all' || period === 'range') return undefined;
  const today = new Date();
  const toStr = getLocalDateString(today);
  let from: Date;
  if (period === 'today') {
    from = new Date(today); from.setHours(0, 0, 0, 0);
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

function getDateRangeWithOffset(period: PeriodType, offset: number): { from: string; to: string } | undefined {
  if (period === 'all' || period === 'range') return getDateRange(period);
  if (period === 'tenday') return getTenDayRange(new Date(), offset);
  if (offset === 0) return getDateRange(period);
  const today = new Date();
  if (period === 'today') {
    const d = new Date(today); d.setDate(d.getDate() + offset);
    const s = getLocalDateString(d); return { from: s, to: s };
  }
  if (period === 'week') {
    const base = new Date(today); base.setDate(base.getDate() + offset * 7);
    const ws = getWeekStartDate(base);
    const we = new Date(`${ws}T00:00:00`); we.setDate(we.getDate() + 6);
    return { from: ws, to: getLocalDateString(we) };
  }
  if (period === 'month') {
    let m = today.getMonth() + offset;
    const y = today.getFullYear() + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    const from = new Date(y, m, 1); const to = new Date(y, m + 1, 0);
    return { from: getLocalDateString(from), to: getLocalDateString(to) };
  }
  if (period === 'quarter') {
    let q = Math.floor(today.getMonth() / 3) + offset;
    const y = today.getFullYear() + Math.floor(q / 4);
    q = ((q % 4) + 4) % 4;
    const from = new Date(y, q * 3, 1); const to = new Date(y, q * 3 + 3, 0);
    return { from: getLocalDateString(from), to: getLocalDateString(to) };
  }
  if (period === 'year') {
    const y = today.getFullYear() + offset;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return getDateRange(period);
}

function getOffsetPeriodLabel(period: PeriodType, offset: number): string {
  const range = getDateRangeWithOffset(period, offset);
  if (!range) return '';
  if (period === 'tenday') {
    const s = new Date(`${range.from}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const e = new Date(`${range.to}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `${s} – ${e}`;
  }
  if (period === 'today') {
    return new Date(`${range.from}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (period === 'week') {
    const s = new Date(`${range.from}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const e = new Date(`${range.to}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `${s} – ${e}`;
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

function nextSortState<T extends string>(
  current: { key: T; order: SortOrder } | null,
  key: T,
  defaultOrder: SortOrder = 'asc'
): { key: T; order: SortOrder } {
  if (current?.key === key) {
    return { key, order: current.order === 'asc' ? 'desc' : 'asc' };
  }
  return { key, order: defaultOrder };
}

function sortMark<T extends string>(state: { key: T; order: SortOrder } | null, key: T): string {
  if (!state || state.key !== key) return '↕';
  return state.order === 'asc' ? '↑' : '↓';
}

function BarChart({ items, maxVal }: { items: { label: string; value: number }[]; maxVal: number }) {
  return (
    <div className="fin-bar-list">
      {items.map(item => (
        <div key={item.label} className="fin-bar-item">
          <span className="fin-bar-label" title={item.label}>{item.label}</span>
          <div className="fin-bar-track">
            <div className="fin-bar-fill" style={{ '--bar-width': maxVal > 0 ? `${(item.value / maxVal) * 100}%` : '0%' } as React.CSSProperties} />
          </div>
          <span className="fin-bar-value">{formatCurrency(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function FinanceReports() {
  const { jobs, payments, customers, commissionPayments, commissionWorkers, expenses, getCustomer } = useDataStore();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ReportTab>(() => {
    const tab = searchParams.get('tab');
    const valid: ReportTab[] = ['revenue','trends','payments','commission','customers','rankings','ageing','cashflow','tenday'];
    return (valid.includes(tab as ReportTab) ? tab : 'revenue') as ReportTab;
  });
  const [period, setPeriod] = useState<PeriodType>('month');
  const [periodOffset, setPeriodOffset] = useState(0);
  const today = getLocalDateString(new Date());
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);
  const [workerSort, setWorkerSort] = useState<{ key: WorkerSortKey; order: SortOrder } | null>(
    null
  );
  const [customerSort, setCustomerSort] = useState<{ key: CustomerSortKey; order: SortOrder } | null>(
    null
  );
  const [cashflowSort, setCashflowSort] = useState<{ key: CashflowSortKey; order: SortOrder } | null>(
    null
  );

  const todayDate = new Date();
  const [tenDayYear, setTenDayYear] = useState(todayDate.getFullYear());
  const [tenDayMonth, setTenDayMonth] = useState(todayDate.getMonth() + 1);

  function navigateTenDayMonth(delta: number) {
    let m = tenDayMonth + delta;
    let y = tenDayYear;
    if (m < 1) { m = 12; y--; }
    else if (m > 12) { m = 1; y++; }
    setTenDayMonth(m);
    setTenDayYear(y);
  }

  const [selectedDay, setSelectedDay] = useState<{ setNum: number; dayNum: number } | null>(null);

  const navTabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = navTabsRef.current?.querySelector<HTMLElement>('.fin-nav-tab.active');
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeTab]);

  // Sync tab from URL on SPA navigation (useState initialiser only runs once)
  useEffect(() => {
    const tab = searchParams.get('tab');
    const valid: ReportTab[] = ['revenue','trends','payments','commission','customers','rankings','ageing','cashflow','tenday'];
    if (valid.includes(tab as ReportTab)) {
      setActiveTab(tab as ReportTab);
    }
  }, [searchParams]);

  const dateRange = useMemo(() => {
    if (period === 'range') return rangeFrom && rangeTo ? { from: rangeFrom, to: rangeTo } : undefined;
    if (period === 'all') return undefined;
    return getDateRangeWithOffset(period, periodOffset);
  }, [period, rangeFrom, rangeTo, periodOffset]);

  const filteredJobs = useMemo(
    () => dateRange ? jobs.filter(j => j.date >= dateRange.from && j.date <= dateRange.to) : jobs,
    [jobs, dateRange]
  );

  // ── Revenue ───────────────────────────────────────────────────────────────
  const revenueMetrics = useMemo(() => calculateRevenueMetrics(jobs, expenses, dateRange), [jobs, expenses, dateRange]);

  const topCustomers = useMemo(() => {
    const map = new Map<number, { name: string; value: number }>();
    filteredJobs.forEach(j => {
      const v = getJobFinalBillValue(j);
      const name = getCustomer(j.customerId)?.name || 'Unknown';
      const cur = map.get(j.customerId) || { name, value: 0 };
      map.set(j.customerId, { name, value: cur.value + v });
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredJobs, getCustomer]);

  const topWorkTypes = useMemo(() => {
    const map = new Map<string, number>();
    filteredJobs.forEach(j => map.set(j.workTypeName, (map.get(j.workTypeName) || 0) + getJobFinalBillValue(j)));
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredJobs]);

  const revenueJobCardMix = useMemo(() => {
    return groupJobsByCard(filteredJobs).reduce(
      (acc, group) => {
        const isAgentCard = group.jobs.some((job) => isAgentWorkJob(job));
        if (!isAgentCard) {
          acc.slwWorkCards += 1;
          return acc;
        }

        const isExternalCard = group.jobs.some((job) => Boolean(job.externalDc));
        if (isExternalCard) {
          acc.agentWorkExternalCards += 1;
        } else {
          acc.agentWorkInternalCards += 1;
        }
        return acc;
      },
      { slwWorkCards: 0, agentWorkInternalCards: 0, agentWorkExternalCards: 0 }
    );
  }, [filteredJobs]);

  const revenueFlowSplit = useMemo(() => {
    return filteredJobs.reduce(
      (acc, job) => {
        if (isAgentWorkJob(job)) {
          acc.agentWorkRevenue += getJobFinalBillValue(job);
        } else {
          acc.slwRevenue += getJobFinalBillValue(job);
        }
        return acc;
      },
      { slwRevenue: 0, agentWorkRevenue: 0 }
    );
  }, [filteredJobs]);


  const revenueGrossProfitFormula = useMemo(() => {
    return filteredJobs.reduce(
      (acc, job) => {
        if (isAgentWorkJob(job)) {
          acc.agentCommissionIncome += getJobAgentCommissionIncome(job);
          acc.agentTdsIncome += getJobAgentTdsAmount(job);
          return acc;
        }
        acc.slwRevenue += getJobFinalBillValue(job);
        acc.workerCommission += getJobWorkerCommissionExpense(job);
        return acc;
      },
      { slwRevenue: 0, workerCommission: 0, agentCommissionIncome: 0, agentTdsIncome: 0 }
    );
  }, [filteredJobs]);

  // ── Payments ──────────────────────────────────────────────────────────────
  const paymentMetrics = useMemo(() => calculatePaymentMetrics(jobs, payments, dateRange), [jobs, payments, dateRange]);
  const paymentMethodBreakdown = useMemo(
    () => calculateCollectionMethodBreakdown(jobs, payments, dateRange),
    [jobs, payments, dateRange]
  );

  // ── Commission ────────────────────────────────────────────────────────────
  const commissionMetrics = useMemo(
    () => calculateCommissionMetrics(jobs, commissionPayments, dateRange),
    [jobs, commissionPayments, dateRange]
  );
  const workerSummary = useMemo(
    () => calculateWorkerCommissionSummary(jobs, commissionPayments, commissionWorkers, dateRange),
    [jobs, commissionPayments, commissionWorkers, dateRange]
  );
  const workerJobCounts = useMemo(() => {
    const map = new Map<number, number>();
    filteredJobs.forEach(j => {
      if (getJobWorkerCommissionExpense(j) <= 0) return;
      const workerId = resolveCommissionWorkerId(j, commissionWorkers);
      if (workerId === null) return;
      map.set(workerId, (map.get(workerId) || 0) + 1);
    });
    return map;
  }, [filteredJobs, commissionWorkers]);
  const agentFlowMetrics = useMemo(() => {
    return filteredJobs.reduce(
      (acc, job) => {
        if (!isAgentWorkJob(job)) return acc;
        acc.agentCards += 1;
        acc.agentCommissionIncome += getJobAgentCommissionIncome(job);
        acc.agentSettlementPending += getJobAgentSettlementPending(job);
        return acc;
      },
      { agentCards: 0, agentCommissionIncome: 0, agentSettlementPending: 0 }
    );
  }, [filteredJobs]);
  const workerRows = useMemo(
    () =>
      workerSummary.map((worker) => ({
        ...worker,
        customerName: getCustomer(worker.customerId)?.name || '-',
        cards: workerJobCounts.get(worker.workerId) || 0,
      })),
    [workerSummary, workerJobCounts, getCustomer]
  );
  const sortedWorkerRows = useMemo(() => {
    if (!workerSort) return workerRows;
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base' });
    const direction = workerSort.order === 'asc' ? 1 : -1;
    return [...workerRows].sort((a, b) => {
      if (workerSort.key === 'customer') return collator.compare(a.customerName, b.customerName) * direction;
      if (workerSort.key === 'cards') return (a.cards - b.cards) * direction;
      return (a.outstanding - b.outstanding) * direction;
    });
  }, [workerRows, workerSort]);

  // ── Customers ─────────────────────────────────────────────────────────────
  const customerFinancials = useMemo(
    () => calculateCustomerFinancials(jobs, payments, customers, dateRange),
    [jobs, payments, customers, dateRange]
  );
  const sortedCustomerFinancials = useMemo(() => {
    if (!customerSort) return customerFinancials;
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base' });
    const direction = customerSort.order === 'asc' ? 1 : -1;
    return [...customerFinancials].sort((a, b) => {
      if (customerSort.key === 'customer') return collator.compare(a.customerName, b.customerName) * direction;
      if (customerSort.key === 'revenue') return (a.totalRevenue - b.totalRevenue) * direction;
      if (customerSort.key === 'outstanding') return (a.totalOutstanding - b.totalOutstanding) * direction;
      return (a.jobCount - b.jobCount) * direction;
    });
  }, [customerFinancials, customerSort]);

  // ── Ageing (customer-wise) ────────────────────────────────────────────────
  const customerRankings = useMemo(
    () => rankCustomers(jobs, payments, customers),
    [jobs, payments, customers]
  );
  const customerAgeingRows = useMemo(
    () => calculateCustomerAgeing(jobs, payments, customers),
    [jobs, payments, customers]
  );

  // ── Ten-Day ───────────────────────────────────────────────────────────────
  const tenDaySets = useMemo(
    () => calculateTenDayBreakdown(jobs, expenses, tenDayYear, tenDayMonth),
    [jobs, expenses, tenDayYear, tenDayMonth]
  );

  const tenDayPayables = useMemo(() => {
    type Entry = { custId: number; subLabel: string; amount: number };
    const monthStr = `${tenDayYear}-${String(tenDayMonth).padStart(2, '0')}`;
    const monthJobs = jobs.filter(j => j.date.startsWith(monthStr));

    const agentCommissionMap              = new Map<string, Entry>();
    const agentTdsMap                     = new Map<string, Entry>();
    const slwWorkerMap                    = new Map<string, Entry>();
    const agentSettlementInternalByCustomer = new Map<number, number>();
    let agentSettlementExternal = 0;

    const addSub = (map: Map<string, Entry>, custId: number, subLabel: string, val: number) => {
      const key = `${custId}|${subLabel}`;
      const e = map.get(key) ?? { custId, subLabel, amount: 0 };
      e.amount += val;
      map.set(key, e);
    };

    monthJobs.forEach(job => {
      if (isAgentWorkJob(job)) {
        const sub = job.agentName || (job.rmpHandler ?? '');
        addSub(agentCommissionMap, job.customerId, sub, getJobAgentCommissionIncome(job));
        addSub(agentTdsMap,        job.customerId, sub, getJobAgentTdsAmount(job));
        const p = getJobAgentSettlementPending(job);
        if (job.externalDc) agentSettlementExternal += p;
        else agentSettlementInternalByCustomer.set(job.customerId, (agentSettlementInternalByCustomer.get(job.customerId) || 0) + p);
      } else {
        const sub = job.rmpHandler ?? '';
        addSub(slwWorkerMap, job.customerId, sub, getJobWorkerCommissionExpense(job));
      }
    });

    const totalMap = (map: Map<string, Entry>) => Array.from(map.values()).reduce((s, e) => s + e.amount, 0);
    const totalNum = (map: Map<number, number>) => Array.from(map.values()).reduce((s, v) => s + v, 0);
    return {
      agentCommissionMap,
      agentTdsMap,
      slwWorkerMap,
      agentSettlementInternalByCustomer,
      agentSettlementExternal,
      totalAgentCommission: totalMap(agentCommissionMap),
      totalAgentTds:        totalMap(agentTdsMap),
      totalSlwWorker:       totalMap(slwWorkerMap),
      totalAgentInternal:   totalNum(agentSettlementInternalByCustomer),
    };
  }, [jobs, tenDayYear, tenDayMonth]);

  // ── Cash Flow ─────────────────────────────────────────────────────────────
  const cashFlowDays = period === 'year' ? 365 : period === 'range' ? 90 : period === 'month' ? 30 : period === 'tenday' ? 10 : 7;
  const dailyCashFlow = useMemo(
    () => calculateDailyCashFlow(jobs, payments, expenses, cashFlowDays),
    [jobs, payments, expenses, cashFlowDays]
  );
  const sortedDailyCashFlow = useMemo(() => {
    if (!cashflowSort) return dailyCashFlow;
    const direction = cashflowSort.order === 'asc' ? 1 : -1;
    return [...dailyCashFlow].sort((a, b) => {
      if (cashflowSort.key === 'revenue') return (a.revenue - b.revenue) * direction;
      return (a.outstanding - b.outstanding) * direction;
    });
  }, [dailyCashFlow, cashflowSort]);

  return (
    <div className="fin-screen">

      {/* Row 1 – Header */}
      <div className="fin-pg-header">
        <div>
          <h1 className="fin-pg-title">Finance</h1>
          <p className="fin-pg-desc">Financial reports and business analytics</p>
        </div>
        <div className="fin-period-tabs">
          {PERIOD_TABS.map(({ mode, label }) => (
            <button key={mode} type="button"
              className={`fin-period-tab${period === mode ? ' active' : ''}`}
              onClick={() => { setPeriod(mode); setPeriodOffset(0); }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Period navigation — prev/next for navigable periods */}
      {period !== 'all' && period !== 'range' && (
        <div className="fin-period-nav">
          <button type="button" className="fin-period-nav-btn"
            onClick={() => setPeriodOffset(o => o - 1)} aria-label="Previous period">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="fin-period-nav-label">{getOffsetPeriodLabel(period, periodOffset)}</span>
          <button type="button" className="fin-period-nav-btn"
            onClick={() => setPeriodOffset(o => o + 1)} disabled={periodOffset >= 0} aria-label="Next period">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {periodOffset < 0 && (
            <button type="button" className="fin-period-nav-reset"
              onClick={() => setPeriodOffset(0)}>
              Current
            </button>
          )}
        </div>
      )}

      {/* Range inputs */}
      {period === 'range' && (
        <div className="fin-range-row">
          <div className="fin-range-field">
            <label className="fin-range-label" htmlFor="fin-from">From</label>
            <input id="fin-from" type="date" className="fin-range-input" value={rangeFrom}
              onChange={e => setRangeFrom(e.target.value)} max={rangeTo || today} />
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="fin-range-arrow" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="fin-range-field">
            <label className="fin-range-label" htmlFor="fin-to">To</label>
            <input id="fin-to" type="date" className="fin-range-input" value={rangeTo}
              onChange={e => setRangeTo(e.target.value)} min={rangeFrom} max={today} />
          </div>
        </div>
      )}

      {/* Row 2 – Nav tabs */}
      <div className="fin-nav-tabs" ref={navTabsRef}>
        {NAV_TABS.map(tab => (
          <button key={tab.id} type="button"
            className={`fin-nav-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Revenue ── */}
      {activeTab === 'revenue' && (
        <div className="fin-tab-content">
          <div className="fin-stats fin-stats-4">
            <div className="fin-stat fin-stat--green fin-stat--hoverable">
              <span className="fin-stat-label">Job Cards</span>
              <span className="fin-stat-value">{revenueMetrics.jobCount}</span>
              <span className="fin-stat-sub">Cards in period</span>
              <div className="fin-stat-tooltip" role="tooltip" aria-label="Job Cards breakdown">
                <div className="fin-stat-tooltip-title">Job Cards Breakdown</div>
                <div className="fin-stat-tooltip-row">
                  <span>SLW Work</span>
                  <strong>{revenueJobCardMix.slwWorkCards}</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Agent Work (Not External)</span>
                  <strong>{revenueJobCardMix.agentWorkInternalCards}</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Agent Work (External)</span>
                  <strong>{revenueJobCardMix.agentWorkExternalCards}</strong>
                </div>
              </div>
            </div>
            <div className="fin-stat fin-stat--hoverable">
              <span className="fin-stat-label">Total Revenue</span>
              <span className="fin-stat-value">{formatCurrency(revenueMetrics.totalRevenue)}</span>
              <span className="fin-stat-sub">Gross billed to customers</span>
              <div className="fin-stat-tooltip" role="tooltip" aria-label="Total Revenue breakdown">
                <div className="fin-stat-tooltip-title">Revenue Breakdown</div>
                <div className="fin-stat-tooltip-row">
                  <span>SLW Revenue</span>
                  <strong>{formatCurrency(revenueFlowSplit.slwRevenue)}</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Agent Work Revenue</span>
                  <strong>{formatCurrency(revenueFlowSplit.agentWorkRevenue)}</strong>
                </div>
              </div>
            </div>
            <div className="fin-stat fin-stat--green fin-stat--hoverable">
              <span className="fin-stat-label">Gross Profit</span>
              <span className="fin-stat-value">{formatCurrency(revenueMetrics.grossProfit)}</span>
              <span className="fin-stat-sub">After commission deductions</span>
              <div className="fin-stat-tooltip" role="tooltip" aria-label="Gross Profit details">
                <div className="fin-stat-tooltip-title">Gross Profit Formula</div>
                <div className="fin-stat-tooltip-row">
                  <span>Calculation</span>
                  <strong>SLW Revenue − Worker Comm + Agent Comm</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>SLW Revenue</span>
                  <strong>{formatCurrency(revenueGrossProfitFormula.slwRevenue)}</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Worker Commission</span>
                  <strong>−{formatCurrency(revenueGrossProfitFormula.workerCommission)}</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Agent Commission Income</span>
                  <strong>{formatCurrency(revenueGrossProfitFormula.agentCommissionIncome)}</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Total Gross Profit</span>
                  <strong>{formatCurrency(revenueMetrics.grossProfit)}</strong>
                </div>
              </div>
            </div>
            <div className={`fin-stat fin-stat--hoverable${revenueMetrics.netProfit >= 0 ? ' fin-stat--green' : ' fin-stat--red'}`}>
              <span className="fin-stat-label">Net Profit</span>
              <span className="fin-stat-value">{formatCurrency(revenueMetrics.netProfit)}</span>
              <span className="fin-stat-sub">Final profit after all costs</span>
              <div className="fin-stat-tooltip" role="tooltip" aria-label="Net Profit details">
                <div className="fin-stat-tooltip-title">Net Profit Breakdown</div>
                <div className="fin-stat-tooltip-row">
                  <span>Calculation</span>
                  <strong>Gross Profit − Expenses</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Gross Profit</span>
                  <strong>{formatCurrency(revenueMetrics.grossProfit)}</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Expenses</span>
                  <strong>−{formatCurrency(revenueMetrics.totalExpenses)}</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Net Margin</span>
                  <strong>
                    {revenueMetrics.totalRevenue > 0
                      ? `${((revenueMetrics.netProfit / revenueMetrics.totalRevenue) * 100).toFixed(1)}%`
                      : '0.0%'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="fin-chart-row">
            <div className="fin-chart-tile">
              <div className="fin-chart-title">Top 10 — Customer Revenue</div>
              {topCustomers.length > 0
                ? <BarChart items={topCustomers.map(c => ({ label: c.name, value: c.value }))} maxVal={topCustomers[0]?.value || 1} />
                : <p className="fin-empty">No revenue data for this period</p>}
            </div>
            <div className="fin-chart-tile">
              <div className="fin-chart-title">Top 10 — Work Type Revenue</div>
              {topWorkTypes.length > 0
                ? <BarChart items={topWorkTypes} maxVal={topWorkTypes[0]?.value || 1} />
                : <p className="fin-empty">No work type data for this period</p>}
            </div>
          </div>

        </div>
      )}

      {/* Trends */}
      {activeTab === 'trends' && (
        <div className="fin-tab-content">
          <RevenueTrendChart jobs={jobs} payments={payments} dateRange={dateRange} />
        </div>
      )}

      {/* Payments */}
      {activeTab === 'payments' && (
        <div className="fin-tab-content">
          <div className="fin-stats fin-stats-4">
            <div className="fin-stat fin-stat--green">
              <span className="fin-stat-label">Total Received</span>
              <span className="fin-stat-value">{formatCurrency(paymentMetrics.totalReceived)}</span>
              <span className="fin-stat-sub">Cash collected</span>
            </div>
            <div className={`fin-stat${paymentMetrics.totalOutstanding > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}>
              <span className="fin-stat-label">Outstanding</span>
              <span className="fin-stat-value">{formatCurrency(paymentMetrics.totalOutstanding)}</span>
              <span className="fin-stat-sub">Still to collect</span>
            </div>
            <div className="fin-stat">
              <span className="fin-stat-label">Collection Rate</span>
              <span className="fin-stat-value">{paymentMetrics.collectionRate.toFixed(1)}%</span>
              <span className="fin-stat-sub">% of revenue collected</span>
            </div>
            <div className="fin-stat">
              <span className="fin-stat-label">Avg Days to Payment</span>
              <span className="fin-stat-value">{paymentMetrics.averagePaymentDays}</span>
              <span className="fin-stat-sub">Days job → receipt</span>
            </div>
          </div>

          <div className="fin-method-tile">
            <div className="fin-chart-title">Payment Method Breakdown</div>
            {paymentMethodBreakdown.length > 0 ? (
              <div className="fin-method-grid">
                {paymentMethodBreakdown.map(m => (
                  <div key={m.method} className="fin-method-row">
                    <span className="fin-method-name">{m.method}</span>
                    <div className="fin-bar-track">
                      <div className="fin-bar-fill" style={{ '--bar-width': `${m.percentage}%` } as React.CSSProperties} />
                    </div>
                    <span className="fin-method-amount">{formatCurrency(m.amount)}</span>
                    <span className="fin-method-pct">{m.percentage.toFixed(1)}%</span>
                    <span className="fin-method-count">{m.count} txn{m.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="fin-empty">No payment data for this period</p>
      )}
          </div>
        </div>
      )}

      {/* ── Commission ── */}
      {activeTab === 'commission' && (
        <div className="fin-tab-content">
          <div className="fin-stats fin-stats-4">
            <div className="fin-stat">
              <span className="fin-stat-label">Worker Commission Due</span>
              <span className="fin-stat-value">{formatCurrency(commissionMetrics.commissionDue)}</span>
              <span className="fin-stat-sub">Owed to workers</span>
            </div>
            <div className="fin-stat fin-stat--green">
              <span className="fin-stat-label">Agent Commission Income</span>
              <span className="fin-stat-value">{formatCurrency(agentFlowMetrics.agentCommissionIncome)}</span>
              <span className="fin-stat-sub">From {agentFlowMetrics.agentCards} agent job{agentFlowMetrics.agentCards !== 1 ? 's' : ''}</span>
            </div>
            <div className="fin-stat fin-stat--green">
              <span className="fin-stat-label">Worker Commission Paid</span>
              <span className="fin-stat-value">{formatCurrency(commissionMetrics.commissionPaid)}</span>
              <span className="fin-stat-sub">Already distributed</span>
            </div>
            <div className={`fin-stat${agentFlowMetrics.agentSettlementPending > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}>
              <span className="fin-stat-label">Agent Settlement Pending</span>
              <span className="fin-stat-value">{formatCurrency(agentFlowMetrics.agentSettlementPending)}</span>
              <span className="fin-stat-sub">Need to transfer to agents</span>
            </div>
          </div>

          {sortedWorkerRows.length > 0 ? (
            <div className="fin-table-tile">
              <div className="fin-chart-title">Worker-wise Breakdown</div>
              <div className="fin-table-wrap">
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th
                        className={`slw-sortable-th${workerSort?.key === 'customer' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setWorkerSort((prev) => nextSortState(prev, 'customer', 'asc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWorkerSort((prev) => nextSortState(prev, 'customer', 'asc')); } }}
                      >
                        Customer {sortMark(workerSort, 'customer')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${workerSort?.key === 'cards' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setWorkerSort((prev) => nextSortState(prev, 'cards', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWorkerSort((prev) => nextSortState(prev, 'cards', 'desc')); } }}
                      >
                        Jobs {sortMark(workerSort, 'cards')}
                      </th>
                      <th className="text-right">Earned</th>
                      <th className="text-right">Paid</th>
                      <th
                        className={`text-right slw-sortable-th${workerSort?.key === 'outstanding' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setWorkerSort((prev) => nextSortState(prev, 'outstanding', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWorkerSort((prev) => nextSortState(prev, 'outstanding', 'desc')); } }}
                      >
                        Outstanding {sortMark(workerSort, 'outstanding')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWorkerRows.map(w => (
                      <tr key={w.workerId}>
                        <td className="fw-600">{w.workerName}</td>
                        <td>{w.customerName}</td>
                        <td className="text-right">{w.cards}</td>
                        <td className="text-right">{formatCurrency(w.totalDue)}</td>
                        <td className="text-right color-green">{formatCurrency(w.totalPaid)}</td>
                        <td className={`text-right${w.outstanding > 0 ? ' color-red' : ' color-green'}`}>{formatCurrency(w.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="fin-empty">No commission workers configured</p>
          )}
        </div>
      )}

      {/* ── Customers ── */}
      {activeTab === 'customers' && (
        <div className="fin-tab-content">
          <div className="fin-table-tile">
            <div className="fin-chart-title">Customer Financial Summary</div>
            {sortedCustomerFinancials.length > 0 ? (
              <div className="fin-table-wrap">
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th
                        className={`slw-sortable-th${customerSort?.key === 'customer' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCustomerSort((prev) => nextSortState(prev, 'customer', 'asc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCustomerSort((prev) => nextSortState(prev, 'customer', 'asc')); } }}
                      >
                        Customer {sortMark(customerSort, 'customer')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${customerSort?.key === 'revenue' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCustomerSort((prev) => nextSortState(prev, 'revenue', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCustomerSort((prev) => nextSortState(prev, 'revenue', 'desc')); } }}
                      >
                        Revenue {sortMark(customerSort, 'revenue')}
                      </th>
                      <th className="text-right">Commission</th>
                      <th className="text-right">Profit</th>
                      <th className="text-right">Received</th>
                      <th
                        className={`text-right slw-sortable-th${customerSort?.key === 'outstanding' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCustomerSort((prev) => nextSortState(prev, 'outstanding', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCustomerSort((prev) => nextSortState(prev, 'outstanding', 'desc')); } }}
                      >
                        Outstanding {sortMark(customerSort, 'outstanding')}
                      </th>
                      <th className="text-right">Coll. Rate</th>
                      <th
                        className={`text-right slw-sortable-th${customerSort?.key === 'cards' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCustomerSort((prev) => nextSortState(prev, 'cards', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCustomerSort((prev) => nextSortState(prev, 'cards', 'desc')); } }}
                      >
                        Cards {sortMark(customerSort, 'cards')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCustomerFinancials.map(c => (
                      <tr key={c.customerId}>
                        <td className="fw-600">{c.customerName}</td>
                        <td className="text-right">{formatCurrency(c.totalRevenue)}</td>
                        <td className="text-right color-muted">{formatCurrency(c.commissionExpense)}</td>
                        <td className="text-right color-green">{formatCurrency(c.grossProfit)}</td>
                        <td className="text-right">{formatCurrency(c.totalReceived)}</td>
                        <td className={`text-right${c.totalOutstanding > 0 ? ' color-red' : ' color-green'}`}>{formatCurrency(c.totalOutstanding)}</td>
                        <td className="text-right">{c.paymentRate.toFixed(0)}%</td>
                        <td className="text-right">{c.jobCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="fin-empty">No customer data for this period</p>
            )}
          </div>
        </div>
      )}

      {/* ── Rankings ── */}
      {activeTab === 'rankings' && (
        <div className="fin-tab-content">
          <CustomerRankingTable rankings={customerRankings} />
        </div>
      )}

      {/* Ageing */}
      {activeTab === 'ageing' && (
        <div className="fin-tab-content">
          <AgeingHeatmap rows={customerAgeingRows} />
        </div>
      )}

      {activeTab === 'cashflow' && (
        <div className="fin-tab-content">
          <div className="fin-table-tile">
            <div className="fin-chart-title">Daily Cash Flow</div>
            {sortedDailyCashFlow.length > 0 ? (
              <div className="fin-table-wrap">
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th
                        className={`text-right slw-sortable-th${cashflowSort?.key === 'revenue' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCashflowSort((prev) => nextSortState(prev, 'revenue', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCashflowSort((prev) => nextSortState(prev, 'revenue', 'desc')); } }}
                      >
                        Revenue {sortMark(cashflowSort, 'revenue')}
                      </th>
                      <th className="text-right">Commission</th>
                      <th className="text-right">Net Income</th>
                      <th className="text-right">Expenses</th>
                      <th className="text-right">Net Profit</th>
                      <th className="text-right">Received</th>
                      <th
                        className={`text-right slw-sortable-th${cashflowSort?.key === 'outstanding' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCashflowSort((prev) => nextSortState(prev, 'outstanding', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCashflowSort((prev) => nextSortState(prev, 'outstanding', 'desc')); } }}
                      >
                        Outstanding {sortMark(cashflowSort, 'outstanding')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDailyCashFlow.map(flow => (
                      <tr key={flow.date}>
                        <td>{new Date(flow.date).toLocaleDateString('en-IN')}</td>
                        <td className="text-right">{formatCurrency(flow.revenue)}</td>
                        <td className="text-right color-muted">{formatCurrency(flow.commission)}</td>
                        <td className="text-right">{formatCurrency(flow.netIncome)}</td>
                        <td className={`text-right${flow.expenses > 0 ? ' color-red' : ' color-muted'}`}>{flow.expenses > 0 ? `−${formatCurrency(flow.expenses)}` : '—'}</td>
                        <td className={`text-right${flow.netProfit >= 0 ? ' color-green' : ' color-red'}`}>{formatCurrency(flow.netProfit)}</td>
                        <td className="text-right">{formatCurrency(flow.received)}</td>
                        <td className={`text-right${flow.outstanding > 0 ? ' color-red' : ' color-green'}`}>{formatCurrency(flow.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="fin-empty">No cash flow data for this period</p>
            )}
          </div>
        </div>
      )}

      {/* ── Ten-Day Range ── */}
      {activeTab === 'tenday' && (
        <div className="fin-tab-content" onClick={() => setSelectedDay(null)}>

          {/* Month navigator */}
          <div className="td-month-nav">
            <button type="button" className="td-month-btn" onClick={(e) => { e.stopPropagation(); navigateTenDayMonth(-1); }}>←</button>
            <span className="td-month-label">{MONTH_NAMES[tenDayMonth - 1]} {tenDayYear}</span>
            <button type="button" className="td-month-btn" onClick={(e) => { e.stopPropagation(); navigateTenDayMonth(1); }}>→</button>
          </div>

          {/* Month Total + Commission Summary */}
          {(() => {
            const mRev    = tenDaySets.reduce((s, t) => s + t.totalRevenue, 0);
            const mCom    = tenDaySets.reduce((s, t) => s + t.totalCommission, 0);
            const mSlw    = tenDaySets.reduce((s, t) => s + t.totalSlwNetProfit, 0);
            const mAgent  = tenDaySets.reduce((s, t) => s + t.totalAgentNetProfit, 0);
            const mExp    = tenDaySets.reduce((s, t) => s + t.totalExpenses, 0);
            const mNet    = tenDaySets.reduce((s, t) => s + t.totalNetProfit, 0);
            const mCards  = tenDaySets.reduce((s, t) => s + t.totalCards, 0);
            const totalPayables = tenDayPayables.totalSlwWorker + tenDayPayables.totalAgentInternal + tenDayPayables.agentSettlementExternal;
            return (
              <div className="td-summary-row">

                {/* Card 1 — Month Total */}
                <div className="td-sum-card">
                  <div className="td-sum-card-hd">
                    <span className="td-sum-card-title">Month Total</span>
                    <span className="td-sum-card-period">{MONTH_NAMES[tenDayMonth - 1]} {tenDayYear}</span>
                  </div>
                  <div className="td-sum-stats">
                    <div className="td-sum-stat">
                      <span className="td-sum-stat-lbl">Revenue</span>
                      <span className="td-sum-stat-val">{formatCurrency(mRev)}</span>
                    </div>
                    <div className="td-sum-stat">
                      <span className="td-sum-stat-lbl">Commission Out</span>
                      <span className="td-sum-stat-val color-muted">−{formatCurrency(mCom)}</span>
                    </div>
                    {mExp > 0 && (
                      <div className="td-sum-stat td-sum-stat--wide">
                        <span className="td-sum-stat-lbl">Expenses</span>
                        <span className="td-sum-stat-val color-red">−{formatCurrency(mExp)}</span>
                      </div>
                    )}
                    <div className="td-sum-stat td-sum-stat--wide">
                      <span className="td-sum-stat-lbl">Net Profit</span>
                      <span className={`td-sum-stat-val${mNet >= 0 ? ' color-green' : ' color-red'}`}>{formatCurrency(mNet)}</span>
                    </div>
                    <div className="td-sum-stat">
                      <span className="td-sum-stat-lbl">Cards</span>
                      <span className="td-sum-stat-val">{mCards}</span>
                    </div>
                  </div>
                  <div className="td-sum-breakdown">
                    <div className="td-sum-brk">
                      <span className="td-sum-brk-lbl">SLW Work</span>
                      <span className="td-sum-brk-val">{formatCurrency(mSlw)}</span>
                    </div>
                    <div className="td-sum-brk-sep" />
                    <div className="td-sum-brk">
                      <span className="td-sum-brk-lbl">Agent / Ext DC</span>
                      <span className="td-sum-brk-val">{formatCurrency(mAgent)}</span>
                    </div>
                  </div>
                </div>

                {/* Card 2 — Commission & Payables */}
                <div className="td-sum-card">
                  <div className="td-sum-card-hd">
                    <span className="td-sum-card-title">Commission &amp; Payables</span>
                    <span className="td-sum-card-period">{MONTH_NAMES[tenDayMonth - 1]} {tenDayYear}</span>
                  </div>
                  <div className="td-com-body">

                    {/* Received column */}
                    {(() => {
                      const entryLabel = (custId: number, sub: string) => {
                        const cust = getCustomer(custId);
                        const base = cust?.shortCode ? cust.shortCode.toUpperCase() : cust?.name ?? `#${custId}`;
                        return sub ? `${base} — ${sub}` : base;
                      };
                      const commEntries = Array.from(tenDayPayables.agentCommissionMap.values())
                        .filter(e => e.amount > 0 && getCustomer(e.custId)?.hasCommission);
                      const tdsEntries  = Array.from(tenDayPayables.agentTdsMap.values())
                        .filter(e => e.amount > 0 && getCustomer(e.custId)?.hasCommission);
                      return (
                        <div className="td-com-col td-com-col--in">
                          <div className="td-com-col-hd">Receivable</div>
                          <div className="td-com-subhd">Namakku Commission</div>
                          {commEntries.map(e => (
                            <div key={`comm-${e.custId}|${e.subLabel}`} className="td-com-row">
                              <span>{entryLabel(e.custId, e.subLabel)}</span>
                              <span>{formatCurrency(e.amount)}</span>
                            </div>
                          ))}
                          <div className="td-com-subhd td-com-subhd--tds">TDS Collected</div>
                          {tdsEntries.map(e => (
                            <div key={`tds-${e.custId}|${e.subLabel}`} className="td-com-row td-com-row--tds">
                              <span>{entryLabel(e.custId, e.subLabel)}</span>
                              <span>{formatCurrency(e.amount)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="td-com-vsep" />

                    {/* To Pay column */}
                    {(() => {
                      const entryLabel = (custId: number, sub: string) => {
                        const cust = getCustomer(custId);
                        const base = cust?.shortCode ? cust.shortCode.toUpperCase() : cust?.name ?? `#${custId}`;
                        return sub ? `${base} — ${sub}` : base;
                      };
                      const workerEntries = Array.from(tenDayPayables.slwWorkerMap.values())
                        .filter(e => e.amount > 0 && getCustomer(e.custId)?.hasCommission);
                      const internalEntries = Array.from(tenDayPayables.agentSettlementInternalByCustomer.entries())
                        .filter(([custId, amt]) => amt > 0 && getCustomer(custId)?.hasCommission);
                      return (
                        <div className="td-com-col td-com-col--out">
                          <div className="td-com-col-hd">To Pay</div>
                          <div className="td-com-subhd">Worker — SLW Work</div>
                          {workerEntries.map(e => (
                            <div key={`slw-${e.custId}|${e.subLabel}`} className="td-com-row">
                              <span>{entryLabel(e.custId, e.subLabel)}</span>
                              <span>{formatCurrency(e.amount)}</span>
                            </div>
                          ))}
                          <div className="td-com-subhd">Full Commission DC</div>
                          {internalEntries.map(([custId, amt]) => {
                            const cust = getCustomer(custId);
                            const lbl = cust?.shortCode ? cust.shortCode.toUpperCase() : cust?.name ?? `#${custId}`;
                            return (
                              <div key={`int-${custId}`} className="td-com-row">
                                <span>{lbl}</span>
                                <span>{formatCurrency(amt)}</span>
                              </div>
                            );
                          })}
                          {tenDayPayables.agentSettlementExternal > 0 && (
                            <div className="td-com-row">
                              <span className="td-com-subhd" style={{ marginTop: 0 }}>Leaf Cut Bhai</span>
                              <span>{formatCurrency(tenDayPayables.agentSettlementExternal)}</span>
                            </div>
                          )}
                          <div className="td-com-total">
                            <span>Total Payables</span>
                            <span>{formatCurrency(totalPayables)}</span>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>

              </div>
            );
          })()}

          {/* Daily Revenue — 3-column breakdown */}
          <div className="fin-table-tile">
            <div className="fin-chart-title">Daily Net Profit — {MONTH_NAMES[tenDayMonth - 1]} {tenDayYear}</div>
            <div className="td-daily-3col">
              {tenDaySets.map(set => {
                const maxDayNet = Math.max(...set.days.map(d => Math.max(0, d.netProfit)), 1);
                return (
                  <div key={set.setNumber} className="td-daily-col">
                    <div className="td-daily-col-hd">
                      <span className="td-daily-col-set">Set {set.setNumber}</span>
                      <span className="td-daily-col-range">
                        {new Date(`${set.fromDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' – '}
                        {new Date(`${set.toDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="td-daily-col-body">
                      {set.days.map(day => (
                        <div
                          key={day.dayNum}
                          className={`td-daily-row${day.netProfit === 0 ? ' is-zero' : ''}${day.date === today ? ' is-today' : ''}`}
                        >
                          <span className="td-daily-daynum">{day.dayNum}</span>
                          <div className="td-daily-bar-wrap">
                            <div
                              className="td-daily-bar"
                              style={{ '--pct': `${(Math.max(0, day.netProfit) / maxDayNet) * 100}%` } as React.CSSProperties}
                            />
                          </div>
                          <span className="td-daily-amount">{formatCurrency(Math.max(0, day.netProfit))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="td-daily-col-footer">
                      <span className="td-daily-footer-label">Net Profit</span>
                      <span className="td-daily-footer-val color-green">{formatCurrency(set.totalNetProfit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3 set cards */}
          <div className="td-sets-row">
            {tenDaySets.map(set => {
              const maxRev = Math.max(...set.days.map(d => d.revenue), 1);
              const activeDay = selectedDay?.setNum === set.setNumber
                ? set.days.find(d => d.dayNum === selectedDay.dayNum) ?? null
                : null;

              return (
                <div key={set.setNumber} className="td-set-card" onClick={(e) => e.stopPropagation()}>
                  <div className="td-set-header">
                    <span className="td-set-title">{set.label}</span>
                    <div className="td-set-header-badges">
                      {today >= set.fromDate && today <= set.toDate && (
                        <span className="td-set-current-badge">Current</span>
                      )}
                      <span className="td-set-badge">{set.totalCards} cards</span>
                    </div>
                  </div>

                  {/* Vertical daily bar chart */}
                  <div className="td-vbar-wrap">
                    <div className="td-vbar-chart">
                      {set.days.map(day => {
                        const isSelected = selectedDay?.setNum === set.setNumber && selectedDay?.dayNum === day.dayNum;
                        return (
                          <div
                            key={day.dayNum}
                            className="td-vbar-col"
                            role="button"
                            tabIndex={0}
                            aria-label={`Day ${day.dayNum}: ${formatCurrency(day.revenue)}`}
                            onClick={() => {
                              setSelectedDay(isSelected ? null : { setNum: set.setNumber, dayNum: day.dayNum });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedDay(isSelected ? null : { setNum: set.setNumber, dayNum: day.dayNum });
                              }
                            }}
                          >
                            <div
                              className={`td-vbar-bar${day.revenue === 0 ? ' td-vbar-bar--empty' : ''}${isSelected ? ' td-vbar-bar--selected' : ''}`}
                              style={{ '--bar-height': `${Math.max((day.revenue / maxRev) * 72, day.revenue > 0 ? 4 : 1)}px` } as React.CSSProperties}
                            />
                            <span className="td-vbar-label">{day.dayNum}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Day detail panel — shown on tap/click */}
                  {activeDay && (
                    <div className="td-day-detail">
                      <div className="td-day-detail-header">
                        <span className="td-day-detail-title">
                          {new Date(`${activeDay.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <button
                          type="button"
                          className="td-day-detail-close"
                          onClick={() => setSelectedDay(null)}
                          aria-label="Close"
                        >×</button>
                      </div>
                      <div className="td-day-detail-grid">
                        <div className="td-day-detail-item">
                          <span>Revenue</span>
                          <span>{formatCurrency(activeDay.revenue)}</span>
                        </div>
                        <div className="td-day-detail-item">
                          <span>Commission</span>
                          <span className="color-muted">{formatCurrency(activeDay.commission)}</span>
                        </div>
                        <div className="td-day-detail-item">
                          <span>SLW Work</span>
                          <span>{formatCurrency(activeDay.slwNetProfit)}</span>
                        </div>
                        <div className="td-day-detail-item">
                          <span>Agent / Ext DC</span>
                          <span>{formatCurrency(activeDay.agentNetProfit)}</span>
                        </div>
                        {activeDay.expenses > 0 && (
                          <div className="td-day-detail-item">
                            <span>Expenses</span>
                            <span className="color-red">−{formatCurrency(activeDay.expenses)}</span>
                          </div>
                        )}
                        <div className="td-day-detail-item">
                          <span>Net Profit</span>
                          <span className={activeDay.netProfit >= 0 ? 'color-green' : 'color-red'}>{formatCurrency(activeDay.netProfit)}</span>
                        </div>
                        <div className="td-day-detail-item">
                          <span>Cards</span>
                          <span>{activeDay.cards}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Period summary stats */}
                  <div className="td-set-stats">
                    <div className="td-stat-row">
                      <span className="td-stat-key">Revenue</span>
                      <span className="td-stat-val">{formatCurrency(set.totalRevenue)}</span>
                    </div>
                    <div className="td-stat-row">
                      <span className="td-stat-key">Commission</span>
                      <span className="td-stat-val color-muted">{formatCurrency(set.totalCommission)}</span>
                    </div>
                    <div className="td-stat-divider" />
                    <div className="td-stat-row">
                      <span className="td-stat-key">SLW Work</span>
                      <span className="td-stat-val">{formatCurrency(set.totalSlwNetProfit)}</span>
                    </div>
                    <div className="td-stat-row">
                      <span className="td-stat-key">Agent / Ext DC</span>
                      <span className="td-stat-val">{formatCurrency(set.totalAgentNetProfit)}</span>
                    </div>
                    {set.totalExpenses > 0 && (
                      <>
                        <div className="td-stat-divider" />
                        <div className="td-stat-row">
                          <span className="td-stat-key">Expenses</span>
                          <span className="td-stat-val color-red">−{formatCurrency(set.totalExpenses)}</span>
                        </div>
                      </>
                    )}
                    <div className="td-stat-divider" />
                    <div className="td-stat-row td-stat-row--total">
                      <span className="td-stat-key">Net Profit</span>
                      <span className={`td-stat-val${set.totalNetProfit >= 0 ? ' color-green' : ' color-red'}`}>{formatCurrency(set.totalNetProfit)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}
