import { formatCurrency } from '@/lib/currencyUtils';

interface CommissionReceiveTabProps {
  agentCards: number;
  commissionReceivableBreakdown: {
    rmpExternalLeafBhai: number;
    rmpInternalBhaiRaja: number;
    wwPalanisamy: number;
    other: number;
    total: number;
  };
}

export function CommissionReceiveTab({
  agentCards,
  commissionReceivableBreakdown,
}: CommissionReceiveTabProps) {
  return (
    <div className="fin-tab-content">
      <div className="fin-stats fin-stats-4">
        <div className="fin-stat fin-stat--green">
          <span className="fin-stat-label">Total Commission to Receive</span>
          <span className="fin-stat-value">
            {formatCurrency(commissionReceivableBreakdown.total)}
          </span>
          <span className="fin-stat-sub">
            From {agentCards} agent job{agentCards !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="fin-stat">
          <span className="fin-stat-label">RMP External DC - Leaf Bhai</span>
          <span className="fin-stat-value">
            {formatCurrency(commissionReceivableBreakdown.rmpExternalLeafBhai)}
          </span>
          <span className="fin-stat-sub">Agent flow / external DC</span>
        </div>
        <div className="fin-stat">
          <span className="fin-stat-label">RMP No External DC - Bhai/Raja</span>
          <span className="fin-stat-value">
            {formatCurrency(commissionReceivableBreakdown.rmpInternalBhaiRaja)}
          </span>
          <span className="fin-stat-sub">Agent flow / no external DC</span>
        </div>
        <div className="fin-stat">
          <span className="fin-stat-label">WW - Palanisamy</span>
          <span className="fin-stat-value">
            {formatCurrency(commissionReceivableBreakdown.wwPalanisamy)}
          </span>
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
                <td className="text-right color-green">
                  {formatCurrency(commissionReceivableBreakdown.rmpExternalLeafBhai)}
                </td>
              </tr>
              <tr>
                <td className="fw-600">Bhai / Raja - RMP No External DC</td>
                <td className="text-right color-green">
                  {formatCurrency(commissionReceivableBreakdown.rmpInternalBhaiRaja)}
                </td>
              </tr>
              <tr>
                <td className="fw-600">WW - Palanisamy</td>
                <td className="text-right color-green">
                  {formatCurrency(commissionReceivableBreakdown.wwPalanisamy)}
                </td>
              </tr>
              {commissionReceivableBreakdown.other > 0 && (
                <tr>
                  <td className="fw-600">Other Agent Commission</td>
                  <td className="text-right color-muted">
                    {formatCurrency(commissionReceivableBreakdown.other)}
                  </td>
                </tr>
              )}
              <tr>
                <td className="fw-600">Total</td>
                <td className="text-right color-green fw-600">
                  {formatCurrency(commissionReceivableBreakdown.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
