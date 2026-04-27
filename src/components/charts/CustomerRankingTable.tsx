import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';
import type { CustomerRank } from '@/lib/customerRankingUtils';
import './CustomerRankingTable.css';

type RankingSortKey = 'revenue' | 'outstanding' | 'jobVolume' | 'healthScore';

interface CustomerRankingTableProps {
  rankings: CustomerRank[];
}

function getHealthClass(label: CustomerRank['healthLabel']): string {
  if (label === 'Excellent') {
    return 'excellent';
  }
  if (label === 'Good') {
    return 'good';
  }
  if (label === 'Attention') {
    return 'attention';
  }
  return 'risk';
}

export function CustomerRankingTable({ rankings }: CustomerRankingTableProps) {
  const [sortBy, setSortBy] = useState<RankingSortKey>('revenue');

  const sorted = useMemo(() => {
    const next = [...rankings];
    next.sort((a, b) => {
      if (sortBy === 'outstanding') {
        return b.totalOutstanding - a.totalOutstanding;
      }
      if (sortBy === 'jobVolume') {
        return b.jobCardCount - a.jobCardCount;
      }
      if (sortBy === 'healthScore') {
        return b.healthScore - a.healthScore;
      }
      return b.totalRevenue - a.totalRevenue;
    });
    return next.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }, [rankings, sortBy]);

  return (
    <div className="rankings-tile">
      <div className="rankings-header">
        <h3 className="rankings-title">Customer Rankings</h3>
        <div className="rankings-sort">
          <button
            type="button"
            className={`rankings-sort-btn${sortBy === 'revenue' ? ' active' : ''}`}
            onClick={() => setSortBy('revenue')}
          >
            Revenue
          </button>
          <button
            type="button"
            className={`rankings-sort-btn${sortBy === 'outstanding' ? ' active' : ''}`}
            onClick={() => setSortBy('outstanding')}
          >
            Outstanding
          </button>
          <button
            type="button"
            className={`rankings-sort-btn${sortBy === 'jobVolume' ? ' active' : ''}`}
            onClick={() => setSortBy('jobVolume')}
          >
            Job Volume
          </button>
          <button
            type="button"
            className={`rankings-sort-btn${sortBy === 'healthScore' ? ' active' : ''}`}
            onClick={() => setSortBy('healthScore')}
          >
            Health
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="rankings-empty">No customer ranking data for this period</p>
      ) : (
        <div className="rankings-table-wrap">
          <table className="rankings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Collection</th>
                <th className="text-right">Jobs</th>
                <th className="text-right">Avg Job</th>
                <th className="text-right">Last Job</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.customerId}>
                  <td className="text-right">{row.rank}</td>
                  <td>
                    <div className="rankings-customer">
                      <span className={`customer-health-dot ${getHealthClass(row.healthLabel)}`} />
                      <span>{row.customerName}</span>
                      <span className={`customer-health-pill ${getHealthClass(row.healthLabel)}`}>
                        {row.healthScore}/100
                      </span>
                    </div>
                  </td>
                  <td className="text-right">{formatCurrency(row.totalRevenue)}</td>
                  <td className={`text-right${row.totalOutstanding > 0 ? ' color-red' : ' color-green'}`}>
                    {formatCurrency(row.totalOutstanding)}
                  </td>
                  <td className="text-right">{row.collectionRate.toFixed(0)}%</td>
                  <td className="text-right">{row.jobCardCount}</td>
                  <td className="text-right">{formatCurrency(row.avgJobValue)}</td>
                  <td className="text-right">
                    {row.lastJobDate ? new Date(row.lastJobDate).toLocaleDateString('en-IN') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
