import { formatCurrency } from '@/lib/currencyUtils';
import type { RevenueMetrics } from '@/lib/financeUtils';
import { BarChart } from '../financeHelpers';

interface RevenueTabProps {
  revenueMetrics: RevenueMetrics;
  topCustomers: Array<{ name: string; value: number }>;
  topWorkTypes: Array<{ label: string; value: number }>;
  revenueJobCardMix: {
    slwWorkCards: number;
    agentWorkInternalCards: number;
    agentWorkExternalCards: number;
  };
  revenueFlowSplit: {
    slwRevenue: number;
    agentWorkRevenue: number;
  };
  revenueGrossProfitFormula: {
    slwRevenue: number;
    workerCommission: number;
    agentCommissionIncome: number;
    agentTdsIncome: number;
  };
}

export function RevenueTab({
  revenueMetrics,
  topCustomers,
  topWorkTypes,
  revenueJobCardMix,
  revenueFlowSplit,
  revenueGrossProfitFormula,
}: RevenueTabProps) {
  return (
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
        <div
          className={`fin-stat fin-stat--hoverable${revenueMetrics.netProfit >= 0 ? ' fin-stat--green' : ' fin-stat--red'}`}
        >
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
          {topCustomers.length > 0 ? (
            <BarChart
              items={topCustomers.map((c) => ({ label: c.name, value: c.value }))}
              maxVal={topCustomers[0]?.value || 1}
            />
          ) : (
            <p className="fin-empty">No revenue data for this period</p>
          )}
        </div>
        <div className="fin-chart-tile">
          <div className="fin-chart-title">Top 10 - Work Type Revenue</div>
          {topWorkTypes.length > 0 ? (
            <BarChart items={topWorkTypes} maxVal={topWorkTypes[0]?.value || 1} />
          ) : (
            <p className="fin-empty">No work type data for this period</p>
          )}
        </div>
      </div>
    </div>
  );
}
