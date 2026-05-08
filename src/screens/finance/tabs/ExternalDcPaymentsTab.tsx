import { formatCurrency } from '@/lib/currencyUtils';

interface WorkerSplitRow {
  workerName: string;
  cards: number;
  commissionToReceive: number;
  settlementPending: number;
}

interface ExternalDcPaymentsBreakdown {
  externalDc: {
    cards: number;
    commissionToReceive: number;
    settlementPending: number;
  };
  noExternalDc: {
    cards: number;
    commissionToReceive: number;
    settlementPending: number;
  };
  externalDcWorkers: WorkerSplitRow[];
  noExternalDcWorkers: WorkerSplitRow[];
  workerPaymentToPay: number;
  totalAgentCards: number;
  totalCommissionToReceive: number;
  totalAgentSettlementPending: number;
}

interface ExternalDcPaymentsTabProps {
  externalDcPaymentsBreakdown: ExternalDcPaymentsBreakdown;
}

export function ExternalDcPaymentsTab({ externalDcPaymentsBreakdown }: ExternalDcPaymentsTabProps) {
  return (
    <div className="fin-tab-content">
      <div className="fin-stats fin-stats-4">
        <div className="fin-stat">
          <span className="fin-stat-label">Agent Work Cards</span>
          <span className="fin-stat-value">{externalDcPaymentsBreakdown.totalAgentCards}</span>
          <span className="fin-stat-sub">External + no external DC</span>
        </div>
        <div className="fin-stat fin-stat--green">
          <span className="fin-stat-label">Agent Commission to Receive</span>
          <span className="fin-stat-value">
            {formatCurrency(externalDcPaymentsBreakdown.totalCommissionToReceive)}
          </span>
          <span className="fin-stat-sub">Income from agent work</span>
        </div>
        <div
          className={`fin-stat${externalDcPaymentsBreakdown.totalAgentSettlementPending > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}
        >
          <span className="fin-stat-label">Agent Settlement to Pay</span>
          <span className="fin-stat-value">
            {formatCurrency(externalDcPaymentsBreakdown.totalAgentSettlementPending)}
          </span>
          <span className="fin-stat-sub">Pending transfer to agents</span>
        </div>
        <div
          className={`fin-stat${externalDcPaymentsBreakdown.workerPaymentToPay > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}
        >
          <span className="fin-stat-label">Workers Payment to Pay</span>
          <span className="fin-stat-value">
            {formatCurrency(externalDcPaymentsBreakdown.workerPaymentToPay)}
          </span>
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
                <td className="text-right color-green">
                  {formatCurrency(externalDcPaymentsBreakdown.externalDc.commissionToReceive)}
                </td>
                <td
                  className={`text-right${externalDcPaymentsBreakdown.externalDc.settlementPending > 0 ? ' color-red' : ' color-green'}`}
                >
                  {formatCurrency(externalDcPaymentsBreakdown.externalDc.settlementPending)}
                </td>
              </tr>
              <tr>
                <td className="fw-600">Agent Work - No External DC</td>
                <td className="text-right">{externalDcPaymentsBreakdown.noExternalDc.cards}</td>
                <td className="text-right color-green">
                  {formatCurrency(externalDcPaymentsBreakdown.noExternalDc.commissionToReceive)}
                </td>
                <td
                  className={`text-right${externalDcPaymentsBreakdown.noExternalDc.settlementPending > 0 ? ' color-red' : ' color-green'}`}
                >
                  {formatCurrency(externalDcPaymentsBreakdown.noExternalDc.settlementPending)}
                </td>
              </tr>
              <tr>
                <td className="fw-600">Total Agent Work</td>
                <td className="text-right fw-600">{externalDcPaymentsBreakdown.totalAgentCards}</td>
                <td className="text-right color-green fw-600">
                  {formatCurrency(externalDcPaymentsBreakdown.totalCommissionToReceive)}
                </td>
                <td
                  className={`text-right fw-600${externalDcPaymentsBreakdown.totalAgentSettlementPending > 0 ? ' color-red' : ' color-green'}`}
                >
                  {formatCurrency(externalDcPaymentsBreakdown.totalAgentSettlementPending)}
                </td>
              </tr>
              <tr>
                <td className="fw-600">Workers Payment to Pay</td>
                <td className="text-right">-</td>
                <td className="text-right">-</td>
                <td
                  className={`text-right fw-600${externalDcPaymentsBreakdown.workerPaymentToPay > 0 ? ' color-red' : ' color-green'}`}
                >
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
                  <td className="text-right color-green">
                    {formatCurrency(row.commissionToReceive)}
                  </td>
                  <td
                    className={`text-right${row.settlementPending > 0 ? ' color-red' : ' color-green'}`}
                  >
                    {formatCurrency(row.settlementPending)}
                  </td>
                </tr>
              ))}
              {externalDcPaymentsBreakdown.noExternalDcWorkers.map((row) => (
                <tr key={`noext-${row.workerName}`}>
                  <td className="fw-600">No External DC</td>
                  <td>{row.workerName}</td>
                  <td className="text-right">{row.cards}</td>
                  <td className="text-right color-green">
                    {formatCurrency(row.commissionToReceive)}
                  </td>
                  <td
                    className={`text-right${row.settlementPending > 0 ? ' color-red' : ' color-green'}`}
                  >
                    {formatCurrency(row.settlementPending)}
                  </td>
                </tr>
              ))}
              {externalDcPaymentsBreakdown.externalDcWorkers.length === 0 &&
                externalDcPaymentsBreakdown.noExternalDcWorkers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="color-muted">
                      No agent work rows for this period
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
