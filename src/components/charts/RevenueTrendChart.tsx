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

export function RevenueTrendChart({ jobs, payments, dateRange }: RevenueTrendChartProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('set');
  const trendData = useMemo(
    () => buildRevenueTrend(jobs, payments, groupBy, dateRange),
    [jobs, payments, groupBy, dateRange]
  );

  return (
    <div className="trend-chart-tile">
      <div className="trend-chart-head">
        <h3 className="trend-chart-title">Revenue Trends</h3>
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
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="grossProfit"
                name="Gross Profit"
                stroke="var(--green)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="received"
                name="Received"
                stroke="var(--amber)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
