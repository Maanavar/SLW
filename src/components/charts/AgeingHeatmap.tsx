import { formatCurrency } from '@/lib/currencyUtils';
import type { CustomerAgeingRow } from '@/lib/financeUtils';
import './AgeingHeatmap.css';

interface AgeingHeatmapProps {
  rows: CustomerAgeingRow[];
}

function getCellClass(bucket: 'current' | 'band1' | 'band2' | 'band3' | 'band4', amount: number): string {
  if (amount <= 0) {
    return 'cell-clear';
  }
  if (bucket === 'current' || bucket === 'band1') {
    return 'cell-yellow';
  }
  if (bucket === 'band2') {
    return 'cell-orange';
  }
  return 'cell-red';
}

function getWorstBand(row: CustomerAgeingRow): string {
  if (row.band4 > 0) {
    return '90d+';
  }
  if (row.band3 > 0) {
    return '61-90d';
  }
  if (row.band2 > 0) {
    return '31-60d';
  }
  if (row.band1 > 0 || row.current > 0) {
    return '0-30d';
  }
  return 'Clear';
}

export function AgeingHeatmap({ rows }: AgeingHeatmapProps) {
  return (
    <div className="ageing-heatmap-tile">
      <h3 className="ageing-heatmap-title">Outstanding Ageing Heatmap</h3>
      {rows.length === 0 ? (
        <p className="ageing-heatmap-empty">No outstanding balances. All customers are settled.</p>
      ) : (
        <div className="ageing-heatmap-wrap">
          <table className="ageing-heatmap-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="text-right">0–7d</th>
                <th className="text-right">8–30d</th>
                <th className="text-right">31–60d</th>
                <th className="text-right">61–90d</th>
                <th className="text-right">90d+</th>
                <th className="text-right">Total</th>
                <th className="text-right">Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.customerId}>
                  <td>{row.customerName}</td>
                  <td className={`text-right ${getCellClass('current', row.current)}`}>
                    {row.current > 0 ? formatCurrency(row.current) : '₹0'}
                  </td>
                  <td className={`text-right ${getCellClass('band1', row.band1)}`}>
                    {row.band1 > 0 ? formatCurrency(row.band1) : '₹0'}
                  </td>
                  <td className={`text-right ${getCellClass('band2', row.band2)}`}>
                    {row.band2 > 0 ? formatCurrency(row.band2) : '₹0'}
                  </td>
                  <td className={`text-right ${getCellClass('band3', row.band3)}`}>
                    {row.band3 > 0 ? formatCurrency(row.band3) : '₹0'}
                  </td>
                  <td className={`text-right ${getCellClass('band4', row.band4)}`}>
                    {row.band4 > 0 ? formatCurrency(row.band4) : '₹0'}
                  </td>
                  <td className="text-right fw-600">{formatCurrency(row.total)}</td>
                  <td className="text-right">
                    <span className={`ageing-risk-badge risk-${getWorstBand(row).toLowerCase().replace('+', 'plus')}`}>
                      {getWorstBand(row)}
                    </span>
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
