import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Job, Payment } from '@/types';
import { buildRevenueTrend } from '@/lib/trendUtils';
import type { TrendGroupBy as GroupBy } from '@/lib/trendUtils';
import { formatCurrency } from '@/lib/currencyUtils';
import './RevenueTrendChart.css';

interface RevenueTrendChartProps {
  jobs: Job[];
  payments: Payment[];
  dateRange?: { from: string; to: string };
}

type TrendMetricView = 'all' | 'slwRevenue' | 'revenue' | 'grossProfit' | 'received' | 'outstanding';

export function RevenueTrendChart({ jobs, payments, dateRange }: RevenueTrendChartProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('set');
  const [metricView, setMetricView] = useState<TrendMetricView>('all');
  const trendData = useMemo(
    () => buildRevenueTrend(jobs, payments, groupBy, dateRange),
    [jobs, payments, groupBy, dateRange]
  );
  const showLine = (metric: Exclude<TrendMetricView, 'all'>) => metricView === 'all' || metricView === metric;

  return (
    <div className="trend-chart-tile">
      <div className="trend-chart-head">
        <h3 className="trend-chart-title">Revenue Trends</h3>
        <div className="trend-chart-controls">
          <div className="trend-group-toggle">
            <button
            type="button"
            className={`trend-group-btn${groupBy === 'set' ? ' active' : ''}`}
            onClick={() => setGroupBy('set')}
          >
            10 Days
          </button>
          <button
            type="button"
            className={`trend-group-btn${groupBy === 'day' ? ' active' : ''}`}
            onClick={() => setGroupBy('day')}
          >
            Daily
          </button>
          <button
            type="button"
            className={`trend-group-btn${groupBy === 'week' ? ' active' : ''}`}
            onClick={() => setGroupBy('week')}
          >
            Weekly
          </button>
          <button
            type="button"
            className={`trend-group-btn${groupBy === 'month' ? ' active' : ''}`}
            onClick={() => setGroupBy('month')}
          >
            Monthly
          </button>
          </div>
          <label className="trend-metric-select-wrap" htmlFor="trend-metric-view">
            <span className="trend-metric-label">Show</span>
            <select
              id="trend-metric-view"
              className="trend-metric-select"
              value={metricView}
              onChange={(event) => setMetricView(event.target.value as TrendMetricView)}
            >
              <option value="all">All Metrics</option>
              <option value="slwRevenue">SLW Revenue</option>
              <option value="revenue">Total Revenue</option>
              <option value="grossProfit">Gross Profit</option>
              <option value="received">Received</option>
              <option value="outstanding">Outstanding</option>
            </select>
          </label>
        </div>
      </div>

      {trendData.length === 0 ? (
        <p className="trend-chart-empty">No trend data for this period</p>
      ) : (
        <div className="trend-chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-faint)' }} />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value) || 0)}
                contentStyle={{
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'var(--text-muted)' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {showLine('slwRevenue') && (
                <Line
                  type="monotone"
                  dataKey="slwRevenue"
                  name="SLW Revenue"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {showLine('revenue') && (
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Total Revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {showLine('grossProfit') && (
                <Line
                  type="monotone"
                  dataKey="grossProfit"
                  name="Gross Profit"
                  stroke="var(--green)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {showLine('received') && (
                <Line
                  type="monotone"
                  dataKey="received"
                  name="Received"
                  stroke="var(--amber)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {showLine('outstanding') && (
                <Line
                  type="monotone"
                  dataKey="outstanding"
                  name="Outstanding"
                  stroke="var(--red)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
