import type { Dispatch, SetStateAction } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';
import type { CommissionMetrics } from '@/lib/financeUtils';
import { nextSortState, sortMark, type SortOrder, type WorkerSortKey } from '../financeHelpers';

interface WorkerRow {
  workerId: number;
  workerName: string;
  customerName: string;
  cards: number;
  totalDue: number;
  totalPaid: number;
  outstanding: number;
}

interface CommissionSendTabProps {
  commissionMetrics: CommissionMetrics;
  agentFlowMetrics: {
    agentCards: number;
    agentCommissionIncome: number;
    agentSettlementPending: number;
  };
  sortedWorkerRows: WorkerRow[];
  workerSort: { key: WorkerSortKey; order: SortOrder } | null;
  setWorkerSort: Dispatch<SetStateAction<{ key: WorkerSortKey; order: SortOrder } | null>>;
}

export function CommissionSendTab({
  commissionMetrics,
  agentFlowMetrics,
  sortedWorkerRows,
  workerSort,
  setWorkerSort,
}: CommissionSendTabProps) {
  return (
    <div className="fin-tab-content">
      <div className="fin-stats fin-stats-4">
        <div className="fin-stat">
          <span className="fin-stat-label">Worker Commission Due</span>
          <span className="fin-stat-value">{formatCurrency(commissionMetrics.commissionDue)}</span>
          <span className="fin-stat-sub">Owed to workers</span>
        </div>
        <div className="fin-stat fin-stat--green">
          <span className="fin-stat-label">Worker Commission Paid</span>
          <span className="fin-stat-value">{formatCurrency(commissionMetrics.commissionPaid)}</span>
          <span className="fin-stat-sub">Already distributed</span>
        </div>
        <div
          className={`fin-stat${commissionMetrics.commissionOutstanding > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}
        >
          <span className="fin-stat-label">Worker Outstanding</span>
          <span className="fin-stat-value">
            {formatCurrency(commissionMetrics.commissionOutstanding)}
          </span>
          <span className="fin-stat-sub">Still to pay workers</span>
        </div>
        <div
          className={`fin-stat${agentFlowMetrics.agentSettlementPending > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}
        >
          <span className="fin-stat-label">Agent Settlement Pending</span>
          <span className="fin-stat-value">
            {formatCurrency(agentFlowMetrics.agentSettlementPending)}
          </span>
          <span className="fin-stat-sub">Need to transfer to agents</span>
        </div>
      </div>

      {sortedWorkerRows.length > 0 ? (
        <div className="fin-table-tile">
          <div className="fin-chart-title">Worker-wise Breakdown</div>
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th
                    className={`slw-sortable-th${workerSort?.key === 'worker' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setWorkerSort((prev) => nextSortState(prev, 'worker', 'asc'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setWorkerSort((prev) => nextSortState(prev, 'worker', 'asc'));
                      }
                    }}
                  >
                    Worker {sortMark(workerSort, 'worker')}
                  </th>
                  <th
                    className={`slw-sortable-th${workerSort?.key === 'customer' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setWorkerSort((prev) => nextSortState(prev, 'customer', 'asc'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setWorkerSort((prev) => nextSortState(prev, 'customer', 'asc'));
                      }
                    }}
                  >
                    Customer {sortMark(workerSort, 'customer')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${workerSort?.key === 'cards' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setWorkerSort((prev) => nextSortState(prev, 'cards', 'desc'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setWorkerSort((prev) => nextSortState(prev, 'cards', 'desc'));
                      }
                    }}
                  >
                    Jobs {sortMark(workerSort, 'cards')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${workerSort?.key === 'earned' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setWorkerSort((prev) => nextSortState(prev, 'earned', 'desc'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setWorkerSort((prev) => nextSortState(prev, 'earned', 'desc'));
                      }
                    }}
                  >
                    Earned {sortMark(workerSort, 'earned')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${workerSort?.key === 'paid' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setWorkerSort((prev) => nextSortState(prev, 'paid', 'desc'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setWorkerSort((prev) => nextSortState(prev, 'paid', 'desc'));
                      }
                    }}
                  >
                    Paid {sortMark(workerSort, 'paid')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${workerSort?.key === 'outstanding' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setWorkerSort((prev) => nextSortState(prev, 'outstanding', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setWorkerSort((prev) => nextSortState(prev, 'outstanding', 'desc'));
                      }
                    }}
                  >
                    Outstanding {sortMark(workerSort, 'outstanding')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkerRows.map((w) => (
                  <tr key={w.workerId}>
                    <td className="fw-600">{w.workerName}</td>
                    <td>{w.customerName}</td>
                    <td className="text-right">{w.cards}</td>
                    <td className="text-right">{formatCurrency(w.totalDue)}</td>
                    <td className="text-right color-green">{formatCurrency(w.totalPaid)}</td>
                    <td
                      className={`text-right${w.outstanding > 0 ? ' color-red' : ' color-green'}`}
                    >
                      {formatCurrency(w.outstanding)}
                    </td>
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
  );
}
