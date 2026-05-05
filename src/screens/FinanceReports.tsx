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
import { exportFinanceSummaryToExcel } from '@/lib/exportUtils';
import type { CommissionWorker, Job } from '@/types';
import '@/components/charts/CustomerRankingTable.css';
import '@/components/charts/AgeingHeatmap.css';
import '@/components/charts/RevenueTrendChart.css';
import './FinanceReports.css';

type ReportTab = 'revenue' | 'trends' | 'payments' | 'commissionSend' | 'commissionReceive' | 'externalDcPayments' | 'customers' | 'rankings' | 'ageing' | 'cashflow' | 'tenday';
type PeriodType = 'today' | 'week' | 'tenday' | 'month' | 'quarter' | 'year' | 'all' | 'range';
type SortOrder = 'asc' | 'desc';
type WorkerSortKey = 'worker' | 'customer' | 'cards' | 'earned' | 'paid' | 'outstanding';
type CustomerSortKey = 'customer' | 'revenue' | 'commission' | 'profit' | 'received' | 'outstanding' | 'collectionRate' | 'cards';
type CashflowSortKey = 'date' | 'revenue' | 'commission' | 'netIncome' | 'expenses' | 'netProfit' | 'received' | 'outstanding';

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
  { id: 'tenday',     label: '10-Day' },
    { id: 'externalDcPayments', label: 'External DC Payments' },
  { id: 'commissionSend', label: 'Commission to Send' },
  { id: 'commissionReceive', label: 'Commission to Receive' },
  { id: 'payments',   label: 'Payments' },
  { id: 'customers',  label: 'Customers' },
  { id: 'rankings',   label: 'Rankings' },
  { id: 'ageing',     label: 'Ageing' },
  { id: 'cashflow',   label: 'Cash Flow' },
];

const VALID_REPORT_TABS: ReportTab[] = [
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

function mapQueryTab(tab: string | null): ReportTab | null {
  if (!tab) return null;
  if (tab === 'commission') return 'commissionSend';
  return VALID_REPORT_TABS.includes(tab as ReportTab) ? (tab as ReportTab) : null;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function normalizeToken(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isRmpCustomerLabel(shortCode?: string, name?: string): boolean {
  const code = normalizeToken(shortCode).replace(/\s/g, '');
  const label = normalizeToken(name);
  return code === 'rmp' || label.includes('ramani motors');
}

function isWwCustomerLabel(shortCode?: string, name?: string): boolean {
  const code = normalizeToken(shortCode).replace(/\s/g, '');
  const label = normalizeToken(name);
  return code === 'ww' || label.includes('ramani cars');
}

function toCanonicalLocalDate(dateValue: string | null | undefined): string | null {
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
    return `${s} - ${e}`;
  }
  if (period === 'today') {
    return new Date(`${range.from}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (period === 'week') {
    const s = new Date(`${range.from}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const e = new Date(`${range.to}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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
  if (!state || state.key !== key) return '<>';
  return state.order === 'asc' ? '^' : 'v';
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
    return mapQueryTab(searchParams.get('tab')) ?? 'revenue';
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
  useEffect(() => {
    setSelectedDay(null);
  }, [tenDayYear, tenDayMonth]);

  // Keep 10-day month in sync with the main period navigator when Month is selected.
  useEffect(() => {
    if (activeTab !== 'tenday' || period !== 'month') return;
    const monthRange = getDateRangeWithOffset('month', periodOffset);
    if (!monthRange) return;
    const [yearStr, monthStr] = monthRange.from.split('-');
    const nextYear = Number(yearStr);
    const nextMonth = Number(monthStr);
    if (!Number.isFinite(nextYear) || !Number.isFinite(nextMonth)) return;

    if (nextYear !== tenDayYear) setTenDayYear(nextYear);
    if (nextMonth !== tenDayMonth) setTenDayMonth(nextMonth);
  }, [activeTab, period, periodOffset, tenDayYear, tenDayMonth]);

  const navTabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = navTabsRef.current?.querySelector<HTMLElement>('.fin-nav-tab.active');
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeTab]);

  // Sync tab from URL on SPA navigation (useState initialiser only runs once)
  useEffect(() => {
    const mappedTab = mapQueryTab(searchParams.get('tab'));
    if (mappedTab) {
      setActiveTab(mappedTab);
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

  // â”€â”€ Revenue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const paymentMetrics = useMemo(() => calculatePaymentMetrics(jobs, payments, dateRange), [jobs, payments, dateRange]);
  const paymentMethodBreakdown = useMemo(
    () => calculateCollectionMethodBreakdown(jobs, payments, dateRange),
    [jobs, payments, dateRange]
  );

  // â”€â”€ Commission â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const commissionReceivableBreakdown = useMemo(() => {
    const breakdown = {
      rmpExternalLeafBhai: 0,
      rmpInternalBhaiRaja: 0,
      wwPalanisamy: 0,
      other: 0,
    };

    filteredJobs.forEach((job) => {
      if (!isAgentWorkJob(job)) return;
      const commission = getJobAgentCommissionIncome(job);
      if (commission <= 0) return;

      const customer = getCustomer(job.customerId);
      const isRmp = isRmpCustomerLabel(customer?.shortCode, customer?.name);
      const isWw = isWwCustomerLabel(customer?.shortCode, customer?.name);
      const agentName = normalizeToken(job.agentName);

      if (isRmp && job.externalDc) {
        if (agentName.includes('leaf') || agentName.includes('bhai')) {
          breakdown.rmpExternalLeafBhai += commission;
          return;
        }
      }

      if (isRmp && !job.externalDc) {
        if (agentName.includes('bhai') || agentName.includes('raja')) {
          breakdown.rmpInternalBhaiRaja += commission;
          return;
        }
      }

      if (isWw && agentName.includes('palanisamy')) {
        breakdown.wwPalanisamy += commission;
        return;
      }

      breakdown.other += commission;
    });

    const total =
      breakdown.rmpExternalLeafBhai +
      breakdown.rmpInternalBhaiRaja +
      breakdown.wwPalanisamy +
      breakdown.other;

    return { ...breakdown, total };
  }, [filteredJobs, getCustomer]);
  const externalDcPaymentsBreakdown = useMemo(() => {
    const externalDc = {
      cards: 0,
      commissionToReceive: 0,
      settlementPending: 0,
    };
    const noExternalDc = {
      cards: 0,
      commissionToReceive: 0,
      settlementPending: 0,
    };
    const externalDcByWorker = new Map<string, {
      workerName: string;
      cards: number;
      commissionToReceive: number;
      settlementPending: number;
    }>();
    const noExternalDcByWorker = new Map<string, {
      workerName: string;
      cards: number;
      commissionToReceive: number;
      settlementPending: number;
    }>();

    filteredJobs.forEach((job) => {
      if (!isAgentWorkJob(job)) return;
      const target = job.externalDc ? externalDc : noExternalDc;
      target.cards += 1;
      target.commissionToReceive += getJobAgentCommissionIncome(job);
      target.settlementPending += getJobAgentSettlementPending(job);

      const workerName = job.agentName?.trim() || 'Unassigned';
      const bucket = job.externalDc ? externalDcByWorker : noExternalDcByWorker;
      const existing = bucket.get(workerName) ?? {
        workerName,
        cards: 0,
        commissionToReceive: 0,
        settlementPending: 0,
      };
      existing.cards += 1;
      existing.commissionToReceive += getJobAgentCommissionIncome(job);
      existing.settlementPending += getJobAgentSettlementPending(job);
      bucket.set(workerName, existing);
    });

    const workerPaymentToPay = workerSummary.reduce((sum, worker) => sum + worker.outstanding, 0);
    const totalAgentCards = externalDc.cards + noExternalDc.cards;
    const totalCommissionToReceive = externalDc.commissionToReceive + noExternalDc.commissionToReceive;
    const totalAgentSettlementPending = externalDc.settlementPending + noExternalDc.settlementPending;
    const sortByAmountThenName = (
      a: { workerName: string; settlementPending: number; commissionToReceive: number },
      b: { workerName: string; settlementPending: number; commissionToReceive: number }
    ) => {
      if (b.settlementPending !== a.settlementPending) return b.settlementPending - a.settlementPending;
      if (b.commissionToReceive !== a.commissionToReceive) return b.commissionToReceive - a.commissionToReceive;
      return a.workerName.localeCompare(b.workerName, 'en-IN');
    };
    const externalDcWorkers = Array.from(externalDcByWorker.values()).sort(sortByAmountThenName);
    const noExternalDcWorkers = Array.from(noExternalDcByWorker.values()).sort(sortByAmountThenName);

    return {
      externalDc,
      noExternalDc,
      externalDcWorkers,
      noExternalDcWorkers,
      workerPaymentToPay,
      totalAgentCards,
      totalCommissionToReceive,
      totalAgentSettlementPending,
    };
  }, [filteredJobs, workerSummary]);
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
      if (workerSort.key === 'worker') return collator.compare(a.workerName, b.workerName) * direction;
      if (workerSort.key === 'customer') return collator.compare(a.customerName, b.customerName) * direction;
      if (workerSort.key === 'cards') return (a.cards - b.cards) * direction;
      if (workerSort.key === 'earned') return (a.totalDue - b.totalDue) * direction;
      if (workerSort.key === 'paid') return (a.totalPaid - b.totalPaid) * direction;
      return (a.outstanding - b.outstanding) * direction;
    });
  }, [workerRows, workerSort]);

  // â”€â”€ Customers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      if (customerSort.key === 'commission') return (a.commissionExpense - b.commissionExpense) * direction;
      if (customerSort.key === 'profit') return (a.grossProfit - b.grossProfit) * direction;
      if (customerSort.key === 'received') return (a.totalReceived - b.totalReceived) * direction;
      if (customerSort.key === 'outstanding') return (a.totalOutstanding - b.totalOutstanding) * direction;
      if (customerSort.key === 'collectionRate') return (a.paymentRate - b.paymentRate) * direction;
      return (a.jobCount - b.jobCount) * direction;
    });
  }, [customerFinancials, customerSort]);

  // â”€â”€ Ageing (customer-wise) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const customerRankings = useMemo(
    () => rankCustomers(jobs, payments, customers),
    [jobs, payments, customers]
  );
  const customerAgeingRows = useMemo(
    () => calculateCustomerAgeing(jobs, payments, customers),
    [jobs, payments, customers]
  );

  // â”€â”€ Ten-Day â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tenDaySets = useMemo(
    () => calculateTenDayBreakdown(jobs, expenses, tenDayYear, tenDayMonth),
    [jobs, expenses, tenDayYear, tenDayMonth]
  );

  const tenDayPayables = useMemo(() => {
    type Entry = { custId: number; subLabel: string; amount: number };
    const monthStr = `${tenDayYear}-${String(tenDayMonth).padStart(2, '0')}`;
    const monthJobs = jobs.filter((job) => {
      const normalized = toCanonicalLocalDate(job.date);
      return Boolean(normalized && normalized.startsWith(monthStr));
    });

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

  // â”€â”€ Cash Flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cashFlowDays = period === 'year' ? 365 : period === 'range' ? 90 : period === 'month' ? 30 : period === 'tenday' ? 10 : 7;
  const dailyCashFlow = useMemo(
    () => calculateDailyCashFlow(jobs, payments, expenses, cashFlowDays),
    [jobs, payments, expenses, cashFlowDays]
  );
  const sortedDailyCashFlow = useMemo(() => {
    if (!cashflowSort) return dailyCashFlow;
    const direction = cashflowSort.order === 'asc' ? 1 : -1;
    return [...dailyCashFlow].sort((a, b) => {
      if (cashflowSort.key === 'date') return a.date.localeCompare(b.date) * direction;
      if (cashflowSort.key === 'revenue') return (a.revenue - b.revenue) * direction;
      if (cashflowSort.key === 'commission') return (a.commission - b.commission) * direction;
      if (cashflowSort.key === 'netIncome') return (a.netIncome - b.netIncome) * direction;
      if (cashflowSort.key === 'expenses') return (a.expenses - b.expenses) * direction;
      if (cashflowSort.key === 'netProfit') return (a.netProfit - b.netProfit) * direction;
      if (cashflowSort.key === 'received') return (a.received - b.received) * direction;
      return (a.outstanding - b.outstanding) * direction;
    });
  }, [dailyCashFlow, cashflowSort]);

  const handleExportExcel = () => {
    const periodLabel = getOffsetPeriodLabel(period, periodOffset);
    const filteredPayments = dateRange
      ? payments.filter(p => p.date >= dateRange.from && p.date <= dateRange.to)
      : payments;
    const filteredExpenses = dateRange
      ? expenses.filter(e => e.date >= dateRange.from && e.date <= dateRange.to)
      : expenses;

    exportFinanceSummaryToExcel({
      periodLabel,
      revenue: revenueMetrics.totalRevenue,
      grossProfit: revenueMetrics.grossProfit,
      netProfit: revenueMetrics.netProfit,
      totalExpenses: revenueMetrics.totalExpenses,
      totalReceived: paymentMetrics.totalReceived,
      outstanding: paymentMetrics.totalOutstanding,
      collectionRate: paymentMetrics.collectionRate,
      jobs: filteredJobs,
      payments: filteredPayments,
      expenses: filteredExpenses,
      customers,
    }, `slw-finance-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
  };

  return (
    <div className="fin-screen">

      {/* Row 1 â€“ Header */}
      <div className="fin-pg-header">
        <div className="fin-pg-title-row">
          <h1 className="fin-pg-title">Finance</h1>
          <button type="button" className="fin-export-btn" onClick={handleExportExcel} title="Export to Excel">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 12v2h12v-2M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export Excel
          </button>
        </div>
        <p className="fin-pg-desc">Financial reports and business analytics</p>
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

      {/* Period navigation â€” prev/next for navigable periods */}
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

      {/* Row 2 â€“ Nav tabs */}
      <div className="fin-nav-tabs" ref={navTabsRef}>
        {NAV_TABS.map(tab => (
          <button key={tab.id} type="button"
            className={`fin-nav-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* â”€â”€ Revenue â”€â”€ */}
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
                  <strong>SLW Revenue - Worker Comm + Agent Comm</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>SLW Revenue</span>
                  <strong>{formatCurrency(revenueGrossProfitFormula.slwRevenue)}</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Worker Commission</span>
                  <strong>-{formatCurrency(revenueGrossProfitFormula.workerCommission)}</strong>
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
                  <strong>Gross Profit - Expenses</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Gross Profit</span>
                  <strong>{formatCurrency(revenueMetrics.grossProfit)}</strong>
                </div>
                <div className="fin-stat-tooltip-row">
                  <span>Expenses</span>
                  <strong>-{formatCurrency(revenueMetrics.totalExpenses)}</strong>
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
              <div className="fin-chart-title">Top 10 - Customer Revenue</div>
              {topCustomers.length > 0
                ? <BarChart items={topCustomers.map(c => ({ label: c.name, value: c.value }))} maxVal={topCustomers[0]?.value || 1} />
                : <p className="fin-empty">No revenue data for this period</p>}
            </div>
            <div className="fin-chart-tile">
              <div className="fin-chart-title">Top 10 - Work Type Revenue</div>
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
              <span className="fin-stat-sub">Days job to receipt</span>
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

      {/* â”€â”€ Commission â”€â”€ */}
      {activeTab === 'commissionSend' && (
        <div className="fin-tab-content">
          <div className="fin-stats fin-stats-4">
            <div className="fin-stat">
              <span className="fin-stat-label">Worker Commission Due</span>
              <span className="fin-stat-value">{formatCurrency(commissionMetrics.commissionDue)}</span>
              <span className="fin-stat-sub">Owed to workers</span>
            </div>
            <div className="fin-stat fin-stat--green">
              <span className="fin-stat-label">Worker Commission Paid</span>
              <span className="fin-stat-value">{formatCurrency(commissionMetrics.commissionPaid)}</span>
              <span className="fin-stat-sub">Already distributed</span>
            </div>
            <div className={`fin-stat${commissionMetrics.commissionOutstanding > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}>
              <span className="fin-stat-label">Worker Outstanding</span>
              <span className="fin-stat-value">{formatCurrency(commissionMetrics.commissionOutstanding)}</span>
              <span className="fin-stat-sub">Still to pay workers</span>
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
                      <th
                        className={`slw-sortable-th${workerSort?.key === 'worker' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setWorkerSort((prev) => nextSortState(prev, 'worker', 'asc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWorkerSort((prev) => nextSortState(prev, 'worker', 'asc')); } }}
                      >
                        Worker {sortMark(workerSort, 'worker')}
                      </th>
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
                      <th
                        className={`text-right slw-sortable-th${workerSort?.key === 'earned' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setWorkerSort((prev) => nextSortState(prev, 'earned', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWorkerSort((prev) => nextSortState(prev, 'earned', 'desc')); } }}
                      >
                        Earned {sortMark(workerSort, 'earned')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${workerSort?.key === 'paid' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setWorkerSort((prev) => nextSortState(prev, 'paid', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWorkerSort((prev) => nextSortState(prev, 'paid', 'desc')); } }}
                      >
                        Paid {sortMark(workerSort, 'paid')}
                      </th>
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

      {/* â”€â”€ Commission To Receive â”€â”€ */}
      {activeTab === 'commissionReceive' && (
        <div className="fin-tab-content">
          <div className="fin-stats fin-stats-4">
            <div className="fin-stat fin-stat--green">
              <span className="fin-stat-label">Total Commission to Receive</span>
              <span className="fin-stat-value">{formatCurrency(commissionReceivableBreakdown.total)}</span>
              <span className="fin-stat-sub">From {agentFlowMetrics.agentCards} agent job{agentFlowMetrics.agentCards !== 1 ? 's' : ''}</span>
            </div>
            <div className="fin-stat">
              <span className="fin-stat-label">RMP External DC - Leaf Bhai</span>
              <span className="fin-stat-value">{formatCurrency(commissionReceivableBreakdown.rmpExternalLeafBhai)}</span>
              <span className="fin-stat-sub">Agent flow / external DC</span>
            </div>
            <div className="fin-stat">
              <span className="fin-stat-label">RMP No External DC - Bhai/Raja</span>
              <span className="fin-stat-value">{formatCurrency(commissionReceivableBreakdown.rmpInternalBhaiRaja)}</span>
              <span className="fin-stat-sub">Agent flow / no external DC</span>
            </div>
            <div className="fin-stat">
              <span className="fin-stat-label">WW - Palanisamy</span>
              <span className="fin-stat-value">{formatCurrency(commissionReceivableBreakdown.wwPalanisamy)}</span>
              <span className="fin-stat-sub">Agent flow for WW</span>
            </div>
          </div>

          <div className="fin-table-tile">
            <div className="fin-chart-title">Commission Receivable Details</div>
            <div className="fin-table-wrap">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-600">Leaf Bhai - RMP External DC</td>
                    <td className="text-right color-green">{formatCurrency(commissionReceivableBreakdown.rmpExternalLeafBhai)}</td>
                  </tr>
                  <tr>
                    <td className="fw-600">Bhai / Raja - RMP No External DC</td>
                    <td className="text-right color-green">{formatCurrency(commissionReceivableBreakdown.rmpInternalBhaiRaja)}</td>
                  </tr>
                  <tr>
                    <td className="fw-600">WW - Palanisamy</td>
                    <td className="text-right color-green">{formatCurrency(commissionReceivableBreakdown.wwPalanisamy)}</td>
                  </tr>
                  {commissionReceivableBreakdown.other > 0 && (
                    <tr>
                      <td className="fw-600">Other Agent Commission</td>
                      <td className="text-right color-muted">{formatCurrency(commissionReceivableBreakdown.other)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="fw-600">Total</td>
                    <td className="text-right color-green fw-600">{formatCurrency(commissionReceivableBreakdown.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'externalDcPayments' && (
        <div className="fin-tab-content">
          <div className="fin-stats fin-stats-4">
            <div className="fin-stat">
              <span className="fin-stat-label">Agent Work Cards</span>
              <span className="fin-stat-value">{externalDcPaymentsBreakdown.totalAgentCards}</span>
              <span className="fin-stat-sub">External + no external DC</span>
            </div>
            <div className="fin-stat fin-stat--green">
              <span className="fin-stat-label">Agent Commission to Receive</span>
              <span className="fin-stat-value">{formatCurrency(externalDcPaymentsBreakdown.totalCommissionToReceive)}</span>
              <span className="fin-stat-sub">Income from agent work</span>
            </div>
            <div className={`fin-stat${externalDcPaymentsBreakdown.totalAgentSettlementPending > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}>
              <span className="fin-stat-label">Agent Settlement to Pay</span>
              <span className="fin-stat-value">{formatCurrency(externalDcPaymentsBreakdown.totalAgentSettlementPending)}</span>
              <span className="fin-stat-sub">Pending transfer to agents</span>
            </div>
            <div className={`fin-stat${externalDcPaymentsBreakdown.workerPaymentToPay > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}>
              <span className="fin-stat-label">Workers Payment to Pay</span>
              <span className="fin-stat-value">{formatCurrency(externalDcPaymentsBreakdown.workerPaymentToPay)}</span>
              <span className="fin-stat-sub">Outstanding worker commission</span>
            </div>
          </div>

          <div className="fin-table-tile">
            <div className="fin-chart-title">External DC vs No External DC</div>
            <div className="fin-table-wrap">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="text-right">Cards</th>
                    <th className="text-right">Commission to Receive</th>
                    <th className="text-right">Agent Settlement to Pay</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-600">Agent Work - External DC</td>
                    <td className="text-right">{externalDcPaymentsBreakdown.externalDc.cards}</td>
                    <td className="text-right color-green">{formatCurrency(externalDcPaymentsBreakdown.externalDc.commissionToReceive)}</td>
                    <td className={`text-right${externalDcPaymentsBreakdown.externalDc.settlementPending > 0 ? ' color-red' : ' color-green'}`}>
                      {formatCurrency(externalDcPaymentsBreakdown.externalDc.settlementPending)}
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-600">Agent Work - No External DC</td>
                    <td className="text-right">{externalDcPaymentsBreakdown.noExternalDc.cards}</td>
                    <td className="text-right color-green">{formatCurrency(externalDcPaymentsBreakdown.noExternalDc.commissionToReceive)}</td>
                    <td className={`text-right${externalDcPaymentsBreakdown.noExternalDc.settlementPending > 0 ? ' color-red' : ' color-green'}`}>
                      {formatCurrency(externalDcPaymentsBreakdown.noExternalDc.settlementPending)}
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-600">Total Agent Work</td>
                    <td className="text-right fw-600">{externalDcPaymentsBreakdown.totalAgentCards}</td>
                    <td className="text-right color-green fw-600">{formatCurrency(externalDcPaymentsBreakdown.totalCommissionToReceive)}</td>
                    <td className={`text-right fw-600${externalDcPaymentsBreakdown.totalAgentSettlementPending > 0 ? ' color-red' : ' color-green'}`}>
                      {formatCurrency(externalDcPaymentsBreakdown.totalAgentSettlementPending)}
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-600">Workers Payment to Pay</td>
                    <td className="text-right">-</td>
                    <td className="text-right">-</td>
                    <td className={`text-right fw-600${externalDcPaymentsBreakdown.workerPaymentToPay > 0 ? ' color-red' : ' color-green'}`}>
                      {formatCurrency(externalDcPaymentsBreakdown.workerPaymentToPay)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="fin-table-tile">
            <div className="fin-chart-title">Split by Worker Name</div>
            <div className="fin-table-wrap">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Worker Name</th>
                    <th className="text-right">Cards</th>
                    <th className="text-right">Commission to Receive</th>
                    <th className="text-right">Agent Settlement to Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {externalDcPaymentsBreakdown.externalDcWorkers.map((row) => (
                    <tr key={`ext-${row.workerName}`}>
                      <td className="fw-600">External DC</td>
                      <td>{row.workerName}</td>
                      <td className="text-right">{row.cards}</td>
                      <td className="text-right color-green">{formatCurrency(row.commissionToReceive)}</td>
                      <td className={`text-right${row.settlementPending > 0 ? ' color-red' : ' color-green'}`}>
                        {formatCurrency(row.settlementPending)}
                      </td>
                    </tr>
                  ))}
                  {externalDcPaymentsBreakdown.noExternalDcWorkers.map((row) => (
                    <tr key={`noext-${row.workerName}`}>
                      <td className="fw-600">No External DC</td>
                      <td>{row.workerName}</td>
                      <td className="text-right">{row.cards}</td>
                      <td className="text-right color-green">{formatCurrency(row.commissionToReceive)}</td>
                      <td className={`text-right${row.settlementPending > 0 ? ' color-red' : ' color-green'}`}>
                        {formatCurrency(row.settlementPending)}
                      </td>
                    </tr>
                  ))}
                  {externalDcPaymentsBreakdown.externalDcWorkers.length === 0 &&
                    externalDcPaymentsBreakdown.noExternalDcWorkers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="color-muted">No agent work rows for this period</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
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
                      <th
                        className={`text-right slw-sortable-th${customerSort?.key === 'commission' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCustomerSort((prev) => nextSortState(prev, 'commission', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCustomerSort((prev) => nextSortState(prev, 'commission', 'desc')); } }}
                      >
                        Commission {sortMark(customerSort, 'commission')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${customerSort?.key === 'profit' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCustomerSort((prev) => nextSortState(prev, 'profit', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCustomerSort((prev) => nextSortState(prev, 'profit', 'desc')); } }}
                      >
                        Profit {sortMark(customerSort, 'profit')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${customerSort?.key === 'received' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCustomerSort((prev) => nextSortState(prev, 'received', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCustomerSort((prev) => nextSortState(prev, 'received', 'desc')); } }}
                      >
                        Received {sortMark(customerSort, 'received')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${customerSort?.key === 'outstanding' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCustomerSort((prev) => nextSortState(prev, 'outstanding', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCustomerSort((prev) => nextSortState(prev, 'outstanding', 'desc')); } }}
                      >
                        Outstanding {sortMark(customerSort, 'outstanding')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${customerSort?.key === 'collectionRate' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCustomerSort((prev) => nextSortState(prev, 'collectionRate', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCustomerSort((prev) => nextSortState(prev, 'collectionRate', 'desc')); } }}
                      >
                        Coll. Rate {sortMark(customerSort, 'collectionRate')}
                      </th>
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

      {/* â”€â”€ Rankings â”€â”€ */}
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
                      <th
                        className={`slw-sortable-th${cashflowSort?.key === 'date' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCashflowSort((prev) => nextSortState(prev, 'date', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCashflowSort((prev) => nextSortState(prev, 'date', 'desc')); } }}
                      >
                        Date {sortMark(cashflowSort, 'date')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${cashflowSort?.key === 'revenue' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCashflowSort((prev) => nextSortState(prev, 'revenue', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCashflowSort((prev) => nextSortState(prev, 'revenue', 'desc')); } }}
                      >
                        Revenue {sortMark(cashflowSort, 'revenue')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${cashflowSort?.key === 'commission' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCashflowSort((prev) => nextSortState(prev, 'commission', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCashflowSort((prev) => nextSortState(prev, 'commission', 'desc')); } }}
                      >
                        Commission {sortMark(cashflowSort, 'commission')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${cashflowSort?.key === 'netIncome' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCashflowSort((prev) => nextSortState(prev, 'netIncome', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCashflowSort((prev) => nextSortState(prev, 'netIncome', 'desc')); } }}
                      >
                        Net Income {sortMark(cashflowSort, 'netIncome')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${cashflowSort?.key === 'expenses' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCashflowSort((prev) => nextSortState(prev, 'expenses', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCashflowSort((prev) => nextSortState(prev, 'expenses', 'desc')); } }}
                      >
                        Expenses {sortMark(cashflowSort, 'expenses')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${cashflowSort?.key === 'netProfit' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCashflowSort((prev) => nextSortState(prev, 'netProfit', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCashflowSort((prev) => nextSortState(prev, 'netProfit', 'desc')); } }}
                      >
                        Net Profit {sortMark(cashflowSort, 'netProfit')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${cashflowSort?.key === 'received' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setCashflowSort((prev) => nextSortState(prev, 'received', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCashflowSort((prev) => nextSortState(prev, 'received', 'desc')); } }}
                      >
                        Received {sortMark(cashflowSort, 'received')}
                      </th>
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
                        <td className={`text-right${flow.expenses > 0 ? ' color-red' : ' color-muted'}`}>{flow.expenses > 0 ? `-${formatCurrency(flow.expenses)}` : '-'}</td>
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

      {/* â”€â”€ Ten-Day Range â”€â”€ */}
      {activeTab === 'tenday' && (
        <div className="fin-tab-content" onClick={() => setSelectedDay(null)}>

          {/* Month navigator */}
          <div className="td-month-nav">
            <button type="button" className="td-month-btn" onClick={(e) => { e.stopPropagation(); navigateTenDayMonth(-1); }}>&lt;</button>
            <span className="td-month-label">{MONTH_NAMES[tenDayMonth - 1]} {tenDayYear}</span>
            <button type="button" className="td-month-btn" onClick={(e) => { e.stopPropagation(); navigateTenDayMonth(1); }}>&gt;</button>
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

                {/* Card 1 â€” Month Total */}
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
                      <span className="td-sum-stat-val color-muted">-{formatCurrency(mCom)}</span>
                    </div>
                    {mExp > 0 && (
                      <div className="td-sum-stat td-sum-stat--wide">
                        <span className="td-sum-stat-lbl">Expenses</span>
                        <span className="td-sum-stat-val color-red">-{formatCurrency(mExp)}</span>
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

                {/* Card 2 â€” Commission & Payables */}
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
                        return sub ? `${base} - ${sub}` : base;
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
                        return sub ? `${base} - ${sub}` : base;
                      };
                      const workerEntries = Array.from(tenDayPayables.slwWorkerMap.values())
                        .filter(e => e.amount > 0 && getCustomer(e.custId)?.hasCommission);
                      const internalEntries = Array.from(tenDayPayables.agentSettlementInternalByCustomer.entries())
                        .filter(([custId, amt]) => amt > 0 && getCustomer(custId)?.hasCommission);
                      return (
                        <div className="td-com-col td-com-col--out">
                          <div className="td-com-col-hd">To Pay</div>
                          <div className="td-com-subhd">Worker - SLW Work</div>
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

          {/* Daily Revenue â€” 3-column breakdown */}
          <div className="fin-table-tile">
            <div className="fin-chart-title">Daily Net Profit - {MONTH_NAMES[tenDayMonth - 1]} {tenDayYear}</div>
            <div className="td-daily-3col">
              {tenDaySets.map(set => {
                const maxDayNet = Math.max(...set.days.map(d => Math.max(0, d.netProfit)), 1);
                return (
                  <div key={set.setNumber} className="td-daily-col">
                    <div className="td-daily-col-hd">
                      <span className="td-daily-col-set">Set {set.setNumber}</span>
                      <span className="td-daily-col-range">
                        {new Date(`${set.fromDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' - '}
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

                  {/* Day detail panel â€” shown on tap/click */}
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
                        >x</button>
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
                            <span className="color-red">-{formatCurrency(activeDay.expenses)}</span>
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
                          <span className="td-stat-val color-red">-{formatCurrency(set.totalExpenses)}</span>
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
