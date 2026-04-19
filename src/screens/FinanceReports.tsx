import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobFinalBillValue, getJobPaidAmount, groupJobsByCard } from '@/lib/jobUtils';
import {
  calculateRevenueMetrics,
  calculatePaymentMetrics,
  calculateCommissionMetrics,
  calculateWorkerCommissionSummary,
  calculateCustomerFinancials,
  calculatePaymentMethodBreakdown,
  calculateDailyCashFlow,
} from '@/lib/financeUtils';
import './FinanceReports.css';

type ReportTab = 'revenue' | 'payments' | 'commission' | 'customers' | 'ageing' | 'cashflow';
type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'range';
type SortOrder = 'asc' | 'desc';
type WorkerSortKey = 'customer' | 'cards' | 'outstanding';
type CustomerSortKey = 'customer' | 'revenue' | 'outstanding' | 'cards';
type AgeingSortKey = 'customer' | 'outstanding';
type CashflowSortKey = 'revenue' | 'outstanding';

const PERIOD_TABS: { mode: PeriodType; label: string }[] = [
  { mode: 'today',   label: 'Today' },
  { mode: 'week',    label: 'Week' },
  { mode: 'month',   label: 'Month' },
  { mode: 'quarter', label: 'Quarter' },
  { mode: 'year',    label: 'Year' },
  { mode: 'all',     label: 'All' },
  { mode: 'range',   label: 'Range' },
];

const NAV_TABS: { id: ReportTab; label: string }[] = [
  { id: 'revenue',    label: 'Revenue' },
  { id: 'payments',   label: 'Payments' },
  { id: 'commission', label: 'Commission' },
  { id: 'customers',  label: 'Customers' },
  { id: 'ageing',     label: 'Ageing' },
  { id: 'cashflow',   label: 'Cash Flow' },
];

function getDateRange(period: PeriodType): { from: string; to: string } | undefined {
  if (period === 'all' || period === 'range') return undefined;
  const today = new Date();
  const toStr = today.toISOString().split('T')[0];
  let from: Date;
  if (period === 'today') {
    from = new Date(today); from.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    from = new Date(today); from.setDate(today.getDate() - today.getDay()); from.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === 'quarter') {
    from = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  } else {
    from = new Date(today.getFullYear(), 0, 1);
  }
  return { from: from.toISOString().split('T')[0], to: toStr };
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
  const { jobs, payments, customers, commissionPayments, commissionWorkers, getCustomer } = useDataStore();
  const [activeTab, setActiveTab] = useState<ReportTab>('revenue');
  const [period, setPeriod] = useState<PeriodType>('month');
  const today = new Date().toISOString().split('T')[0];
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);
  const [workerSort, setWorkerSort] = useState<{ key: WorkerSortKey; order: SortOrder } | null>(
    null
  );
  const [customerSort, setCustomerSort] = useState<{ key: CustomerSortKey; order: SortOrder } | null>(
    null
  );
  const [ageingSort, setAgeingSort] = useState<{ key: AgeingSortKey; order: SortOrder } | null>(
    null
  );
  const [cashflowSort, setCashflowSort] = useState<{ key: CashflowSortKey; order: SortOrder } | null>(
    null
  );

  const dateRange = useMemo(() => {
    if (period === 'range') return rangeFrom && rangeTo ? { from: rangeFrom, to: rangeTo } : undefined;
    return getDateRange(period);
  }, [period, rangeFrom, rangeTo]);

  const filteredJobs = useMemo(
    () => dateRange ? jobs.filter(j => j.date >= dateRange.from && j.date <= dateRange.to) : jobs,
    [jobs, dateRange]
  );

  // ── Revenue ───────────────────────────────────────────────────────────────
  const revenueMetrics = useMemo(() => calculateRevenueMetrics(jobs, dateRange), [jobs, dateRange]);

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

  // ── Payments ──────────────────────────────────────────────────────────────
  const paymentMetrics = useMemo(() => calculatePaymentMetrics(jobs, payments, dateRange), [jobs, payments, dateRange]);
  const paymentMethodBreakdown = useMemo(() => calculatePaymentMethodBreakdown(payments, dateRange), [payments, dateRange]);

  // ── Commission ────────────────────────────────────────────────────────────
  const commissionMetrics = useMemo(
    () => calculateCommissionMetrics(jobs, commissionPayments, dateRange),
    [jobs, commissionPayments, dateRange]
  );
  const workerSummary = useMemo(
    () => calculateWorkerCommissionSummary(jobs, commissionPayments, commissionWorkers),
    [jobs, commissionPayments, commissionWorkers]
  );
  const jobsWithCommission = useMemo(
    () => groupJobsByCard(filteredJobs.filter(j => (Number(j.commissionAmount) || 0) > 0)).length,
    [filteredJobs]
  );
  const workerJobCounts = useMemo(() => {
    const map = new Map<number, number>();
    filteredJobs.forEach(j => {
      if ((Number(j.commissionAmount) || 0) > 0 && j.commissionWorkerId) {
        map.set(j.commissionWorkerId, (map.get(j.commissionWorkerId) || 0) + 1);
      }
    });
    return map;
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
  const customerAgeing = useMemo(() => {
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0];
    const custMap = new Map<number, { name: string; outstanding: number; oldestDate: string }>();
    const groups = groupJobsByCard(jobs);
    groups.forEach(g => {
      const outstanding = g.jobs.reduce((s, j) => s + Math.max(0, getJobFinalBillValue(j) - getJobPaidAmount(j)), 0);
      if (outstanding <= 0) return;
      const name = getCustomer(g.primary.customerId)?.name || 'Unknown';
      const existing = custMap.get(g.primary.customerId);
      const date = g.primary.date;
      if (!existing || date < existing.oldestDate) {
        custMap.set(g.primary.customerId, { name, outstanding: (existing?.outstanding || 0) + outstanding, oldestDate: date });
      } else {
        custMap.set(g.primary.customerId, { ...existing, outstanding: existing.outstanding + outstanding });
      }
    });
    return Array.from(custMap.values()).map(c => ({
      ...c,
      days: Math.floor((now.getTime() - new Date(`${c.oldestDate}T00:00:00`).getTime()) / 86400000),
    })).sort((a, b) => b.days - a.days);
  }, [jobs, getCustomer]);
  const sortedCustomerAgeing = useMemo(() => {
    if (!ageingSort) return customerAgeing;
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base' });
    const direction = ageingSort.order === 'asc' ? 1 : -1;
    return [...customerAgeing].sort((a, b) => {
      if (ageingSort.key === 'customer') return collator.compare(a.name, b.name) * direction;
      return (a.outstanding - b.outstanding) * direction;
    });
  }, [customerAgeing, ageingSort]);

  // ── Cash Flow ─────────────────────────────────────────────────────────────
  const cashFlowDays = period === 'year' ? 365 : period === 'range' ? 90 : period === 'month' ? 30 : 7;
  const dailyCashFlow = useMemo(
    () => calculateDailyCashFlow(jobs, payments, cashFlowDays),
    [jobs, payments, cashFlowDays]
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
              onClick={() => setPeriod(mode)}>
              {label}
            </button>
          ))}
        </div>
      </div>

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
      <div className="fin-nav-tabs">
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
          <div className="fin-stats fin-stats-3">
            <div className="fin-stat">
              <span className="fin-stat-label">Total Revenue</span>
              <span className="fin-stat-value">{formatCurrency(revenueMetrics.totalRevenue)}</span>
              <span className="fin-stat-sub">Gross billed to customers</span>
            </div>
            <div className="fin-stat fin-stat--green">
              <span className="fin-stat-label">Job Cards</span>
              <span className="fin-stat-value">{revenueMetrics.jobCount}</span>
              <span className="fin-stat-sub">Cards in period</span>
            </div>
            <div className="fin-stat">
              <span className="fin-stat-label">Avg Revenue / Card</span>
              <span className="fin-stat-value">
                {formatCurrency(revenueMetrics.jobCount > 0 ? revenueMetrics.totalRevenue / revenueMetrics.jobCount : 0)}
              </span>
              <span className="fin-stat-sub">Per job card</span>
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

      {/* ── Payments ── */}
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
              <span className="fin-stat-label">Total Commission</span>
              <span className="fin-stat-value">{formatCurrency(commissionMetrics.commissionDue)}</span>
              <span className="fin-stat-sub">Owed to workers</span>
            </div>
            <div className="fin-stat">
              <span className="fin-stat-label">Cards with Commission</span>
              <span className="fin-stat-value">{jobsWithCommission}</span>
              <span className="fin-stat-sub">In period</span>
            </div>
            <div className="fin-stat fin-stat--green">
              <span className="fin-stat-label">Commission Paid</span>
              <span className="fin-stat-value">{formatCurrency(commissionMetrics.commissionPaid)}</span>
              <span className="fin-stat-sub">Already distributed</span>
            </div>
            <div className={`fin-stat${commissionMetrics.commissionOutstanding > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}>
              <span className="fin-stat-label">Commission Outstanding</span>
              <span className="fin-stat-value">{formatCurrency(commissionMetrics.commissionOutstanding)}</span>
              <span className="fin-stat-sub">Still to pay</span>
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
                      <th className="text-right">Rate</th>
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

      {/* ── Ageing ── */}
      {activeTab === 'ageing' && (
        <div className="fin-tab-content">
          <div className="fin-table-tile">
            <div className="fin-chart-title">Outstanding Balance Ageing — by Customer</div>
            {sortedCustomerAgeing.length > 0 ? (
              <div className="fin-table-wrap">
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th
                        className={`slw-sortable-th${ageingSort?.key === 'customer' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setAgeingSort((prev) => nextSortState(prev, 'customer', 'asc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAgeingSort((prev) => nextSortState(prev, 'customer', 'asc')); } }}
                      >
                        Customer {sortMark(ageingSort, 'customer')}
                      </th>
                      <th
                        className={`text-right slw-sortable-th${ageingSort?.key === 'outstanding' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setAgeingSort((prev) => nextSortState(prev, 'outstanding', 'desc'))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAgeingSort((prev) => nextSortState(prev, 'outstanding', 'desc')); } }}
                      >
                        Outstanding {sortMark(ageingSort, 'outstanding')}
                      </th>
                      <th className="text-right">Oldest Invoice</th>
                      <th className="text-right">Days Overdue</th>
                      <th>Ageing Band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCustomerAgeing.map((c, i) => {
                      const band = c.days <= 7 ? 'Current' : c.days <= 30 ? '8–30 days' : c.days <= 60 ? '31–60 days' : c.days <= 90 ? '61–90 days' : '90+ days';
                      const bandClass = c.days <= 7 ? 'color-green' : c.days <= 30 ? '' : c.days <= 60 ? 'color-amber' : 'color-red';
                      return (
                        <tr key={i}>
                          <td className="fw-600">{c.name}</td>
                          <td className="text-right color-red">{formatCurrency(c.outstanding)}</td>
                          <td className="text-right color-muted">{c.oldestDate}</td>
                          <td className={`text-right ${bandClass}`}>{c.days}d</td>
                          <td><span className={`fin-band ${bandClass}`}>{band}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="fin-empty">No outstanding balances — all customers settled!</p>
            )}
          </div>
        </div>
      )}

      {/* ── Cash Flow ── */}
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
                        <td className="text-right color-green">{formatCurrency(flow.netIncome)}</td>
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

    </div>
  );
}
