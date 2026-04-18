/**
 * Finance Reports Screen
 * Comprehensive financial analysis and reporting
 * Follows accounting standards: Revenue, Commission (Expense), Gross Profit
 */

import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { CustomerBalancesTable } from './dashboard/CustomerBalancesTable';
import {
  calculateRevenueMetrics,
  calculatePaymentMetrics,
  calculateCommissionMetrics,
  calculateWorkerCommissionSummary,
  calculateCustomerFinancials,
  calculatePaymentMethodBreakdown,
  calculateOutstandingAgeing,
  calculateDailyCashFlow,
  type RevenueMetrics,
  type PaymentMetrics,
  type CommissionMetrics,
  type WorkerCommissionSummary,
  type CustomerFinancials,
  type PaymentMethodBreakdown,
  type AgeingBucket,
  type DailyCashFlow,
} from '@/lib/financeUtils';
import './FinanceReports.css';

type ReportTab = 'revenue' | 'payments' | 'commission' | 'customers' | 'methods' | 'ageing' | 'cashflow' | 'balances';

type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'range';

interface DateRange {
  from: string;
  to: string;
}

function getDateRange(period: PeriodType): DateRange | undefined {
  const today = new Date();
  let from: Date;

  switch (period) {
    case 'today':
      from = new Date(today);
      from.setHours(0, 0, 0, 0);
      return {
        from: from.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };

    case 'week':
      from = new Date(today);
      from.setDate(today.getDate() - today.getDay());
      from.setHours(0, 0, 0, 0);
      return {
        from: from.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };

    case 'month':
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        from: from.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };

    case 'quarter':
      const quarterStart = Math.floor(today.getMonth() / 3) * 3;
      from = new Date(today.getFullYear(), quarterStart, 1);
      return {
        from: from.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };

    case 'year':
      from = new Date(today.getFullYear(), 0, 1);
      return {
        from: from.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };

    case 'all':
    case 'range':
      return undefined;

    default:
      return undefined;
  }
}

export function FinanceReports() {
  const { jobs, payments, customers, commissionPayments, commissionWorkers } = useDataStore();
  const [activeTab, setActiveTab] = useState<ReportTab>('revenue');
  const [period, setPeriod] = useState<PeriodType>('month');
  const today = new Date().toISOString().split('T')[0];
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);

  const dateRange = useMemo(() => {
    if (period === 'range') {
      if (rangeFrom && rangeTo) return { from: rangeFrom, to: rangeTo };
      return undefined;
    }
    return getDateRange(period);
  }, [period, rangeFrom, rangeTo]);

  // Calculate all metrics
  const revenueMetrics = useMemo(
    () => calculateRevenueMetrics(jobs, dateRange),
    [jobs, dateRange]
  );

  const paymentMetrics = useMemo(
    () => calculatePaymentMetrics(jobs, payments, dateRange),
    [jobs, payments, dateRange]
  );

  const commissionMetrics = useMemo(
    () => calculateCommissionMetrics(jobs, commissionPayments, dateRange),
    [jobs, commissionPayments, dateRange]
  );

  const workerCommissionSummary = useMemo(
    () => calculateWorkerCommissionSummary(jobs, commissionPayments, commissionWorkers),
    [jobs, commissionPayments, commissionWorkers]
  );

  const customerFinancials = useMemo(
    () => calculateCustomerFinancials(jobs, payments, customers, dateRange),
    [jobs, payments, customers, dateRange]
  );

  const paymentMethodBreakdown = useMemo(
    () => calculatePaymentMethodBreakdown(payments, dateRange),
    [payments, dateRange]
  );

  const outstandingAgeing = useMemo(
    () => calculateOutstandingAgeing(jobs, payments),
    [jobs, payments]
  );

  const dailyCashFlow = useMemo(
    () => calculateDailyCashFlow(jobs, payments, period === 'month' ? 30 : period === 'year' ? 365 : period === 'range' ? 90 : 7),
    [jobs, payments, period]
  );

  return (
    <div className="finance-reports">
      <div className="finance-header">
        <h1>Finance Reports</h1>
        <p className="finance-subtitle">Accounting-standard financial analysis</p>
      </div>

      {/* Period Filter */}
      <div className="period-filter">
        <label>Period:</label>
        <div className="period-buttons">
          {(['today', 'week', 'month', 'quarter', 'year', 'all', 'range'] as PeriodType[]).map(
            (p) => (
              <button
                key={p}
                type="button"
                className={`period-btn ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p === 'range' ? 'Date Range' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            )
          )}
        </div>
        {period === 'range' && (
          <div className="period-range-inputs">
            <input
              type="date"
              className="period-range-date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              max={rangeTo || today}
              title="From date"
              placeholder="From"
            />
            <span className="period-range-sep">–</span>
            <input
              type="date"
              className="period-range-date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              min={rangeFrom}
              max={today}
              title="To date"
              placeholder="To"
            />
          </div>
        )}
      </div>

      {/* Report Tabs */}
      <div className="report-tabs">
        <button type="button" className={`tab-btn ${activeTab === 'revenue' ? 'active' : ''}`} onClick={() => setActiveTab('revenue')}>Revenue & Profit</button>
        <button type="button" className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments</button>
        <button type="button" className={`tab-btn ${activeTab === 'commission' ? 'active' : ''}`} onClick={() => setActiveTab('commission')}>Commission</button>
        <button type="button" className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>Customers</button>
        <button type="button" className={`tab-btn ${activeTab === 'methods' ? 'active' : ''}`} onClick={() => setActiveTab('methods')}>Methods</button>
        <button type="button" className={`tab-btn ${activeTab === 'ageing' ? 'active' : ''}`} onClick={() => setActiveTab('ageing')}>Ageing</button>
        <button type="button" className={`tab-btn ${activeTab === 'balances' ? 'active' : ''}`} onClick={() => setActiveTab('balances')}>Customer Balance</button>
        <button type="button" className={`tab-btn ${activeTab === 'cashflow' ? 'active' : ''}`} onClick={() => setActiveTab('cashflow')}>Cashflow</button>
      </div>

      {/* Report Content */}
      <div className="report-content">
        {activeTab === 'revenue' && <RevenueReport metrics={revenueMetrics} dateRange={dateRange} />}
        {activeTab === 'payments' && <PaymentReport metrics={paymentMetrics} />}
        {activeTab === 'commission' && <CommissionReport metrics={commissionMetrics} workers={workerCommissionSummary} />}
        {activeTab === 'customers' && <CustomerReport customers={customerFinancials} />}
        {activeTab === 'methods' && <PaymentMethodReport breakdown={paymentMethodBreakdown} />}
        {activeTab === 'ageing' && <AgeingReport buckets={outstandingAgeing} />}
        {activeTab === 'cashflow' && <CashFlowReport flows={dailyCashFlow} />}
        {activeTab === 'balances' && <CustomerBalancesTable showFilters={false} dateRange={dateRange} />}
      </div>
    </div>
  );
}

// ============================================================================
// REVENUE & PROFIT REPORT
// ============================================================================

function daysInDateRange(dateRange: DateRange | undefined): number {
  if (!dateRange) return 1;
  const from = new Date(`${dateRange.from}T00:00:00`);
  const to   = new Date(`${dateRange.to}T00:00:00`);
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
}

function RevenueReport({ metrics, dateRange }: { metrics: RevenueMetrics; dateRange: DateRange | undefined }) {
  const days  = daysInDateRange(dateRange);
  const weeks = Math.max(1, Math.round(days / 7));
  return (
    <div className="report-section">
      <h2>Revenue & Profit Analysis</h2>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Revenue</div>
          <div className="metric-value">{formatCurrency(metrics.totalRevenue)}</div>
          <div className="metric-subtitle">Amount quoted to customers</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Commission Expense</div>
          <div className="metric-value negative">{formatCurrency(metrics.commissionExpense)}</div>
          <div className="metric-subtitle">Paid to managers</div>
        </div>

        <div className="metric-card highlight">
          <div className="metric-label">Gross Profit</div>
          <div className="metric-value">{formatCurrency(metrics.grossProfit)}</div>
          <div className="metric-subtitle">Our actual income</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Profit Margin</div>
          <div className="metric-value">
            {metrics.totalRevenue > 0
              ? ((metrics.grossProfit / metrics.totalRevenue) * 100).toFixed(1)
              : '0'}
            %
          </div>
          <div className="metric-subtitle">Gross profit ratio</div>
        </div>
      </div>

      <div className="details-table">
        <table>
          <tbody>
            <tr>
              <td>Job Cards Created</td>
              <td className="value">{metrics.jobCount}</td>
            </tr>
            <tr>
              <td>Average Revenue per Card</td>
              <td className="value">
                {formatCurrency(metrics.jobCount > 0 ? metrics.totalRevenue / metrics.jobCount : 0)}
              </td>
            </tr>
            <tr>
              <td>Average Profit per Card</td>
              <td className="value">
                {formatCurrency(metrics.jobCount > 0 ? metrics.grossProfit / metrics.jobCount : 0)}
              </td>
            </tr>
            <tr>
              <td>Average Revenue / Day</td>
              <td className="value">{formatCurrency(metrics.totalRevenue / days)}</td>
            </tr>
            <tr>
              <td>Average Profit / Day</td>
              <td className="value">{formatCurrency(metrics.grossProfit / days)}</td>
            </tr>
            {days > 7 && (
              <tr>
                <td>Average Revenue / Week</td>
                <td className="value">{formatCurrency(metrics.totalRevenue / weeks)}</td>
              </tr>
            )}
            {days > 7 && (
              <tr>
                <td>Average Profit / Week</td>
                <td className="value">{formatCurrency(metrics.grossProfit / weeks)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// PAYMENT REPORT
// ============================================================================

function PaymentReport({ metrics }: { metrics: PaymentMetrics }) {
  return (
    <div className="report-section">
      <h2>Payment & Collection Analysis</h2>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Received</div>
          <div className="metric-value">{formatCurrency(metrics.totalReceived)}</div>
          <div className="metric-subtitle">Cash collected</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Outstanding Balance</div>
          <div className="metric-value warning">{formatCurrency(metrics.totalOutstanding)}</div>
          <div className="metric-subtitle">Still to collect</div>
        </div>

        <div className="metric-card highlight">
          <div className="metric-label">Collection Rate</div>
          <div className="metric-value">{metrics.collectionRate.toFixed(1)}%</div>
          <div className="metric-subtitle">% of revenue collected</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Avg Days to Payment</div>
          <div className="metric-value">{metrics.averagePaymentDays}</div>
          <div className="metric-subtitle">Days from job to receipt</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMMISSION REPORT
// ============================================================================

function CommissionReport({
  metrics,
  workers,
}: {
  metrics: CommissionMetrics;
  workers: WorkerCommissionSummary[];
}) {
  return (
    <div className="report-section">
      <h2>Commission Tracking</h2>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Commission Due</div>
          <div className="metric-value">{formatCurrency(metrics.commissionDue)}</div>
          <div className="metric-subtitle">Total owed to managers</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Commission Paid</div>
          <div className="metric-value">{formatCurrency(metrics.commissionPaid)}</div>
          <div className="metric-subtitle">Already distributed</div>
        </div>

        <div className="metric-card highlight">
          <div className="metric-label">Commission Outstanding</div>
          <div className="metric-value">{formatCurrency(metrics.commissionOutstanding)}</div>
          <div className="metric-subtitle">Still to pay</div>
        </div>
      </div>

      {workers.length > 0 && (
        <>
          <h3 className="section-subheading">Worker-wise Breakdown</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th className="text-right">Total Due</th>
                  <th className="text-right">Total Paid</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker.workerId}>
                    <td>{worker.workerName}</td>
                    <td className="text-right">{formatCurrency(worker.totalDue)}</td>
                    <td className="text-right">{formatCurrency(worker.totalPaid)}</td>
                    <td className="text-right warning">
                      {formatCurrency(worker.outstanding)}
                    </td>
                    <td className="text-center">
                      {worker.outstanding > 0 ? 'Pending' : 'Settled'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// CUSTOMER FINANCIAL REPORT
// ============================================================================

function CustomerReport({ customers }: { customers: CustomerFinancials[] }) {
  return (
    <div className="report-section">
      <h2>Customer-wise Financial Analysis</h2>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">Commission</th>
              <th className="text-right">Profit</th>
              <th className="text-right">Received</th>
              <th className="text-right">Outstanding</th>
              <th className="text-center">Rate</th>
              <th className="text-right">Cards</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.customerId}>
                <td>{customer.customerName}</td>
                <td className="text-right">{formatCurrency(customer.totalRevenue)}</td>
                <td className="text-right negative">{formatCurrency(customer.commissionExpense)}</td>
                <td className="text-right">{formatCurrency(customer.grossProfit)}</td>
                <td className="text-right">{formatCurrency(customer.totalReceived)}</td>
                <td className="text-right warning">{formatCurrency(customer.totalOutstanding)}</td>
                <td className="text-center">{customer.paymentRate.toFixed(0)}%</td>
                <td className="text-right">{customer.jobCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// PAYMENT METHOD BREAKDOWN REPORT
// ============================================================================

function PaymentMethodReport({ breakdown }: { breakdown: PaymentMethodBreakdown[] }) {
  const totalAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="report-section">
      <h2>Payment Method Breakdown</h2>

      <div className="method-cards">
        {breakdown.length > 0 ? (
          breakdown.map((method) => (
            <div key={method.method} className="method-card">
              <div className="method-name">{method.method}</div>
              <div className="method-amount">{formatCurrency(method.amount)}</div>
              <div className="method-bar">
                <div className="method-fill" style={{ '--bar-width': `${method.percentage}%` } as React.CSSProperties}></div>
              </div>
              <div className="method-details">
                <span>{method.percentage.toFixed(1)}%</span>
                <span>{method.count} transaction(s)</span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No payments recorded in this period</div>
        )}
      </div>

      {totalAmount > 0 && (
        <div className="total-box">
          <span>Total Received:</span>
          <span>{formatCurrency(totalAmount)}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// OUTSTANDING BALANCE AGEING REPORT
// ============================================================================

function AgeingReport({ buckets }: { buckets: AgeingBucket[] }) {
  const totalOutstanding = buckets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="report-section">
      <h2>Outstanding Balance Ageing</h2>

      {buckets.length > 0 ? (
        <div className="ageing-cards">
          {buckets.map((bucket) => (
            <div key={bucket.range} className="ageing-card">
              <div className="ageing-range">{bucket.range}</div>
              <div className="ageing-amount">{formatCurrency(bucket.amount)}</div>
              <div className="ageing-bar">
                <div className="ageing-fill" style={{ '--bar-width': `${bucket.percentage}%` } as React.CSSProperties}></div>
              </div>
              <div className="ageing-details">
                <span>{bucket.percentage.toFixed(1)}%</span>
                <span>{bucket.jobCount} jobs</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">No outstanding balance</div>
      )}

      <div className="total-box">
        <span>Total Outstanding:</span>
        <span>{formatCurrency(totalOutstanding)}</span>
      </div>
    </div>
  );
}

// ============================================================================
// CASH FLOW REPORT
// ============================================================================

function CashFlowReport({ flows }: { flows: DailyCashFlow[] }) {
  return (
    <div className="report-section">
      <h2>Daily Cash Flow Analysis</h2>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">Commission</th>
              <th className="text-right">Net Income</th>
              <th className="text-right">Received</th>
              <th className="text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((flow) => (
              <tr key={flow.date}>
                <td>{new Date(flow.date).toLocaleDateString('en-IN')}</td>
                <td className="text-right">{formatCurrency(flow.revenue)}</td>
                <td className="text-right negative">{formatCurrency(flow.commission)}</td>
                <td className="text-right">{formatCurrency(flow.netIncome)}</td>
                <td className="text-right">{formatCurrency(flow.received)}</td>
                <td className="text-right warning">{formatCurrency(flow.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
