import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { useCommissionWorkersQuery } from '@/hooks/useCommissionWorkersQuery';
import { useCommissionPaymentsQuery } from '@/hooks/useCommissionPaymentsQuery';
import { getLocalDateString } from '@/lib/dateUtils';
import {
  getJobAgentCommissionIncome,
  getJobAgentSettlementPending,
  getJobAgentTdsAmount,
  getJobFinalBillValue,
  getJobWorkerCommissionExpense,
  groupJobsByCard,
  isAgentWorkJob,
} from '@/lib/jobUtils';
import {
  calculateCollectionMethodBreakdown,
  calculateCommissionMetrics,
  calculateCustomerAgeing,
  calculateCustomerFinancials,
  calculateDailyCashFlow,
  calculatePaymentMetrics,
  calculateRevenueMetrics,
  calculateTenDayBreakdown,
  calculateWorkerCommissionSummary,
} from '@/lib/financeUtils';
import { rankCustomers } from '@/lib/customerRankingUtils';
import { isRmpCustomer, isWwCustomer } from '@/constants/customers';
import { exportFinanceSummaryToExcel } from '@/lib/exportUtils';
import type { BandKey } from '@/components/charts/AgeingHeatmap';
import { AgeingDrillDownModal } from './finance/AgeingDrillDownModal';
import {
  getDateRangeWithOffset,
  getOffsetPeriodLabel,
  mapQueryTab,
  NAV_TABS,
  normalizeToken,
  PERIOD_TABS,
  resolveCommissionWorkerId,
  toCanonicalLocalDate,
  type CashflowSortKey,
  type CustomerSortKey,
  type PeriodType,
  type ReportTab,
  type SortOrder,
  type WorkerSortKey,
} from './finance/financeHelpers';
import {
  AgeingTab,
  CashflowTab,
  CommissionReceiveTab,
  CommissionSendTab,
  CustomersTab,
  ExternalDcPaymentsTab,
  PaymentsTab,
  RankingsTab,
  RevenueTab,
  TenDayTab,
  TrendsTab,
} from './finance/tabs';
import './FinanceReports.css';
export function FinanceReports() {
  const {
    jobs,
    payments,
    expenses,
    getCustomer,
    ensureRangeLoaded,
  } = useDataStore();
  const { data: customers = [] } = useCustomersQuery();
  const { data: commissionWorkers = [] } = useCommissionWorkersQuery();
  const { data: commissionPayments = [] } = useCommissionPaymentsQuery();
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
  const [customerSort, setCustomerSort] = useState<{
    key: CustomerSortKey;
    order: SortOrder;
  } | null>(null);
  const [cashflowSort, setCashflowSort] = useState<{
    key: CashflowSortKey;
    order: SortOrder;
  } | null>(null);
  const [ageingDrillDown, setAgeingDrillDown] = useState<{
    customerId: number;
    customerName: string;
    band: BandKey;
  } | null>(null);

  const todayDate = new Date();
  const [tenDayYear, setTenDayYear] = useState(todayDate.getFullYear());
  const [tenDayMonth, setTenDayMonth] = useState(todayDate.getMonth() + 1);

  function navigateTenDayMonth(delta: number) {
    let m = tenDayMonth + delta;
    let y = tenDayYear;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
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
    if (period === 'range')
      return rangeFrom && rangeTo ? { from: rangeFrom, to: rangeTo } : undefined;
    if (period === 'all') return undefined;
    return getDateRangeWithOffset(period, periodOffset);
  }, [period, rangeFrom, rangeTo, periodOffset]);

  useEffect(() => {
    if (!dateRange) return;
    void ensureRangeLoaded(dateRange);
  }, [dateRange, ensureRangeLoaded]);

  const filteredJobs = useMemo(
    () =>
      dateRange ? jobs.filter((j) => j.date >= dateRange.from && j.date <= dateRange.to) : jobs,
    [jobs, dateRange]
  );

  // ── Revenue ───────────────────────────────────────────────────────────────
  const revenueMetrics = useMemo(
    () => calculateRevenueMetrics(jobs, expenses, dateRange),
    [jobs, expenses, dateRange]
  );

  const topCustomers = useMemo(() => {
    const map = new Map<number, { name: string; value: number }>();
    filteredJobs.forEach((j) => {
      const v = getJobFinalBillValue(j);
      const name = getCustomer(j.customerId)?.name || 'Unknown';
      const cur = map.get(j.customerId) || { name, value: 0 };
      map.set(j.customerId, { name, value: cur.value + v });
    });
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredJobs, getCustomer]);

  const topWorkTypes = useMemo(() => {
    const map = new Map<string, number>();
    filteredJobs.forEach((j) =>
      map.set(j.workTypeName, (map.get(j.workTypeName) || 0) + getJobFinalBillValue(j))
    );
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
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
  const paymentMetrics = useMemo(
    () => calculatePaymentMetrics(jobs, payments, dateRange),
    [jobs, payments, dateRange]
  );
  const paymentMethodBreakdown = useMemo(
    () => calculateCollectionMethodBreakdown(jobs, payments, dateRange),
    [jobs, payments, dateRange]
  );

  // ── Commission ────────────────────────────────────────────────────────────
  const commissionMetrics = useMemo(
    () => calculateCommissionMetrics(jobs, commissionPayments, dateRange),
    [jobs, commissionPayments, dateRange]
  );
  const filteredCommissionPayments = useMemo(
    () =>
      dateRange
        ? commissionPayments.filter((p) => p.date >= dateRange.from && p.date <= dateRange.to)
        : commissionPayments,
    [commissionPayments, dateRange]
  );
  const workerSummary = useMemo(
    () => calculateWorkerCommissionSummary(jobs, commissionPayments, commissionWorkers, dateRange),
    [jobs, commissionPayments, commissionWorkers, dateRange]
  );
  const workerJobCounts = useMemo(() => {
    const map = new Map<number, number>();
    filteredJobs.forEach((j) => {
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
      const isRmp = isRmpCustomer(customer?.shortCode, customer?.name);
      const isWw = isWwCustomer(customer?.shortCode, customer?.name);
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
    const externalDcByWorker = new Map<
      string,
      {
        workerName: string;
        cards: number;
        commissionToReceive: number;
        settlementPending: number;
      }
    >();
    const noExternalDcByWorker = new Map<
      string,
      {
        workerName: string;
        cards: number;
        commissionToReceive: number;
        settlementPending: number;
      }
    >();

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
    const totalCommissionToReceive =
      externalDc.commissionToReceive + noExternalDc.commissionToReceive;
    const totalAgentSettlementPending =
      externalDc.settlementPending + noExternalDc.settlementPending;
    const sortByAmountThenName = (
      a: { workerName: string; settlementPending: number; commissionToReceive: number },
      b: { workerName: string; settlementPending: number; commissionToReceive: number }
    ) => {
      if (b.settlementPending !== a.settlementPending)
        return b.settlementPending - a.settlementPending;
      if (b.commissionToReceive !== a.commissionToReceive)
        return b.commissionToReceive - a.commissionToReceive;
      return a.workerName.localeCompare(b.workerName, 'en-IN');
    };
    const externalDcWorkers = Array.from(externalDcByWorker.values()).sort(sortByAmountThenName);
    const noExternalDcWorkers = Array.from(noExternalDcByWorker.values()).sort(
      sortByAmountThenName
    );

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
      if (workerSort.key === 'worker')
        return collator.compare(a.workerName, b.workerName) * direction;
      if (workerSort.key === 'customer')
        return collator.compare(a.customerName, b.customerName) * direction;
      if (workerSort.key === 'cards') return (a.cards - b.cards) * direction;
      if (workerSort.key === 'earned') return (a.totalDue - b.totalDue) * direction;
      if (workerSort.key === 'paid') return (a.totalPaid - b.totalPaid) * direction;
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
      if (customerSort.key === 'customer')
        return collator.compare(a.customerName, b.customerName) * direction;
      if (customerSort.key === 'revenue') return (a.totalRevenue - b.totalRevenue) * direction;
      if (customerSort.key === 'commission')
        return (a.commissionExpense - b.commissionExpense) * direction;
      if (customerSort.key === 'profit') return (a.grossProfit - b.grossProfit) * direction;
      if (customerSort.key === 'received') return (a.totalReceived - b.totalReceived) * direction;
      if (customerSort.key === 'outstanding')
        return (a.totalOutstanding - b.totalOutstanding) * direction;
      if (customerSort.key === 'collectionRate') return (a.paymentRate - b.paymentRate) * direction;
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
    const monthJobs = jobs.filter((job) => {
      const normalized = toCanonicalLocalDate(job.date);
      return Boolean(normalized && normalized.startsWith(monthStr));
    });

    const agentCommissionMap = new Map<string, Entry>();
    const agentTdsMap = new Map<string, Entry>();
    const slwWorkerMap = new Map<string, Entry>();
    const agentSettlementInternalByCustomer = new Map<number, number>();
    let agentSettlementExternal = 0;

    const addSub = (map: Map<string, Entry>, custId: number, subLabel: string, val: number) => {
      const key = `${custId}|${subLabel}`;
      const e = map.get(key) ?? { custId, subLabel, amount: 0 };
      e.amount += val;
      map.set(key, e);
    };

    monthJobs.forEach((job) => {
      if (isAgentWorkJob(job)) {
        const sub = job.agentName || (job.rmpHandler ?? '');
        addSub(agentCommissionMap, job.customerId, sub, getJobAgentCommissionIncome(job));
        addSub(agentTdsMap, job.customerId, sub, getJobAgentTdsAmount(job));
        const p = getJobAgentSettlementPending(job);
        if (job.externalDc) agentSettlementExternal += p;
        else
          agentSettlementInternalByCustomer.set(
            job.customerId,
            (agentSettlementInternalByCustomer.get(job.customerId) || 0) + p
          );
      } else {
        const sub = job.rmpHandler ?? '';
        addSub(slwWorkerMap, job.customerId, sub, getJobWorkerCommissionExpense(job));
      }
    });

    const totalMap = (map: Map<string, Entry>) =>
      Array.from(map.values()).reduce((s, e) => s + e.amount, 0);
    const totalNum = (map: Map<number, number>) =>
      Array.from(map.values()).reduce((s, v) => s + v, 0);
    return {
      agentCommissionMap,
      agentTdsMap,
      slwWorkerMap,
      agentSettlementInternalByCustomer,
      agentSettlementExternal,
      totalAgentCommission: totalMap(agentCommissionMap),
      totalAgentTds: totalMap(agentTdsMap),
      totalSlwWorker: totalMap(slwWorkerMap),
      totalAgentInternal: totalNum(agentSettlementInternalByCustomer),
    };
  }, [jobs, tenDayYear, tenDayMonth]);

  // ── Cash Flow ─────────────────────────────────────────────────────────────
  const cashFlowDays =
    period === 'year'
      ? 365
      : period === 'range'
        ? 90
        : period === 'month'
          ? 30
          : period === 'tenday'
            ? 10
            : 7;
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

  const handleExportExcel = async () => {
    const periodLabel = getOffsetPeriodLabel(period, periodOffset);
    const filteredPayments = dateRange
      ? payments.filter((p) => p.date >= dateRange.from && p.date <= dateRange.to)
      : payments;
    const filteredExpenses = dateRange
      ? expenses.filter((e) => e.date >= dateRange.from && e.date <= dateRange.to)
      : expenses;

    await exportFinanceSummaryToExcel(
      {
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
        customerFinancials: sortedCustomerFinancials,
        customerAgeingRows,
        workerRows: sortedWorkerRows,
        cashflowRows: dailyCashFlow,
        customerRankings,
      },
      `slw-finance-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.xlsx`
    );
  };

  return (
    <div className="fin-screen">
      {/* Row 1 – Header */}
      <div className="fin-pg-header">
        <div className="fin-pg-title-row">
          <h1 className="fin-pg-title">Finance</h1>
          <button
            type="button"
            className="fin-export-btn"
            onClick={() => void handleExportExcel()}
            title="Export to Excel"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2 12v2h12v-2M8 2v8M5 7l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Export Excel
          </button>
        </div>
        <p className="fin-pg-desc">Financial reports and business analytics</p>
        <div className="fin-period-tabs">
          {PERIOD_TABS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              className={`fin-period-tab${period === mode ? ' active' : ''}`}
              onClick={() => {
                setPeriod(mode);
                setPeriodOffset(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Period navigation — prev/next for navigable periods */}
      {period !== 'all' && period !== 'range' && (
        <div className="fin-period-nav">
          <button
            type="button"
            className="fin-period-nav-btn"
            onClick={() => setPeriodOffset((o) => o - 1)}
            aria-label="Previous period"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 3L5 8L10 13"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="fin-period-nav-label">{getOffsetPeriodLabel(period, periodOffset)}</span>
          <button
            type="button"
            className="fin-period-nav-btn"
            onClick={() => setPeriodOffset((o) => o + 1)}
            disabled={periodOffset >= 0}
            aria-label="Next period"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 3L11 8L6 13"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {periodOffset < 0 && (
            <button
              type="button"
              className="fin-period-nav-reset"
              onClick={() => setPeriodOffset(0)}
            >
              Current
            </button>
          )}
        </div>
      )}

      {/* Range inputs */}
      {period === 'range' && (
        <div className="fin-range-row">
          <div className="fin-range-field">
            <label className="fin-range-label" htmlFor="fin-from">
              From
            </label>
            <input
              id="fin-from"
              type="date"
              className="fin-range-input"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              max={rangeTo || today}
            />
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="fin-range-arrow"
            aria-hidden="true"
          >
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="fin-range-field">
            <label className="fin-range-label" htmlFor="fin-to">
              To
            </label>
            <input
              id="fin-to"
              type="date"
              className="fin-range-input"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              min={rangeFrom}
              max={today}
            />
          </div>
        </div>
      )}

      {/* Row 2 – Nav tabs */}
      <div className="fin-nav-tabs" ref={navTabsRef}>
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`fin-nav-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Revenue ── */}
      {activeTab === 'revenue' && (
        <RevenueTab
          revenueMetrics={revenueMetrics}
          topCustomers={topCustomers}
          topWorkTypes={topWorkTypes}
          revenueJobCardMix={revenueJobCardMix}
          revenueFlowSplit={revenueFlowSplit}
          revenueGrossProfitFormula={revenueGrossProfitFormula}
        />
      )}

      {activeTab === 'trends' && (
        <TrendsTab jobs={jobs} payments={payments} dateRange={dateRange} />
      )}

      {activeTab === 'payments' && (
        <PaymentsTab
          paymentMetrics={paymentMetrics}
          paymentMethodBreakdown={paymentMethodBreakdown}
        />
      )}

      {activeTab === 'commissionSend' && (
        <CommissionSendTab
          commissionMetrics={commissionMetrics}
          agentFlowMetrics={agentFlowMetrics}
          sortedWorkerRows={sortedWorkerRows}
          workerSort={workerSort}
          setWorkerSort={setWorkerSort}
          commissionPayments={filteredCommissionPayments}
        />
      )}

      {activeTab === 'commissionReceive' && (
        <CommissionReceiveTab
          agentCards={agentFlowMetrics.agentCards}
          commissionReceivableBreakdown={commissionReceivableBreakdown}
        />
      )}

      {activeTab === 'externalDcPayments' && (
        <ExternalDcPaymentsTab externalDcPaymentsBreakdown={externalDcPaymentsBreakdown} />
      )}

      {activeTab === 'customers' && (
        <CustomersTab
          sortedCustomerFinancials={sortedCustomerFinancials}
          customerSort={customerSort}
          setCustomerSort={setCustomerSort}
        />
      )}

      {activeTab === 'rankings' && <RankingsTab customerRankings={customerRankings} />}

      {activeTab === 'ageing' && (
        <AgeingTab
          customerAgeingRows={customerAgeingRows}
          onCellClick={(customerId, customerName, band) =>
            setAgeingDrillDown({ customerId, customerName, band })
          }
        />
      )}

      {activeTab === 'cashflow' && (
        <CashflowTab
          sortedDailyCashFlow={sortedDailyCashFlow}
          cashflowSort={cashflowSort}
          setCashflowSort={setCashflowSort}
        />
      )}

      {activeTab === 'tenday' && (
        <TenDayTab
          today={today}
          tenDayYear={tenDayYear}
          tenDayMonth={tenDayMonth}
          tenDaySets={tenDaySets}
          tenDayPayables={tenDayPayables}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          navigateTenDayMonth={navigateTenDayMonth}
          getCustomer={getCustomer}
        />
      )}
      {ageingDrillDown && (
        <AgeingDrillDownModal
          customerId={ageingDrillDown.customerId}
          customerName={ageingDrillDown.customerName}
          band={ageingDrillDown.band}
          jobs={jobs}
          onClose={() => setAgeingDrillDown(null)}
        />
      )}
    </div>
  );
}
