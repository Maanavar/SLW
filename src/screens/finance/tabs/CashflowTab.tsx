import type { Dispatch, SetStateAction } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';
import type { DailyCashFlow } from '@/lib/financeUtils';
import { nextSortState, sortMark, type CashflowSortKey, type SortOrder } from '../financeHelpers';

interface CashflowTabProps {
  sortedDailyCashFlow: DailyCashFlow[];
  cashflowSort: { key: CashflowSortKey; order: SortOrder } | null;
  setCashflowSort: Dispatch<SetStateAction<{ key: CashflowSortKey; order: SortOrder } | null>>;
}

export function CashflowTab({
  sortedDailyCashFlow,
  cashflowSort,
  setCashflowSort,
}: CashflowTabProps) {
  return (
    <div className="fin-tab-content">
      <div className="fin-table-tile">
        <div className="fin-chart-title">Daily Cash Flow</div>
        {sortedDailyCashFlow.length > 0 ? (
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th
                    className={`slw-sortable-th${cashflowSort?.key === 'date' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setCashflowSort((prev) => nextSortState(prev, 'date', 'desc'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCashflowSort((prev) => nextSortState(prev, 'date', 'desc'));
                      }
                    }}
                  >
                    Date {sortMark(cashflowSort, 'date')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${cashflowSort?.key === 'revenue' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCashflowSort((prev) => nextSortState(prev, 'revenue', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCashflowSort((prev) => nextSortState(prev, 'revenue', 'desc'));
                      }
                    }}
                  >
                    Revenue {sortMark(cashflowSort, 'revenue')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${cashflowSort?.key === 'commission' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCashflowSort((prev) => nextSortState(prev, 'commission', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCashflowSort((prev) => nextSortState(prev, 'commission', 'desc'));
                      }
                    }}
                  >
                    Commission {sortMark(cashflowSort, 'commission')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${cashflowSort?.key === 'netIncome' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCashflowSort((prev) => nextSortState(prev, 'netIncome', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCashflowSort((prev) => nextSortState(prev, 'netIncome', 'desc'));
                      }
                    }}
                  >
                    Net Income {sortMark(cashflowSort, 'netIncome')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${cashflowSort?.key === 'expenses' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCashflowSort((prev) => nextSortState(prev, 'expenses', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCashflowSort((prev) => nextSortState(prev, 'expenses', 'desc'));
                      }
                    }}
                  >
                    Expenses {sortMark(cashflowSort, 'expenses')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${cashflowSort?.key === 'netProfit' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCashflowSort((prev) => nextSortState(prev, 'netProfit', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCashflowSort((prev) => nextSortState(prev, 'netProfit', 'desc'));
                      }
                    }}
                  >
                    Net Profit {sortMark(cashflowSort, 'netProfit')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${cashflowSort?.key === 'received' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCashflowSort((prev) => nextSortState(prev, 'received', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCashflowSort((prev) => nextSortState(prev, 'received', 'desc'));
                      }
                    }}
                  >
                    Received {sortMark(cashflowSort, 'received')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${cashflowSort?.key === 'outstanding' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCashflowSort((prev) => nextSortState(prev, 'outstanding', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCashflowSort((prev) => nextSortState(prev, 'outstanding', 'desc'));
                      }
                    }}
                  >
                    Outstanding {sortMark(cashflowSort, 'outstanding')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDailyCashFlow.map((flow) => (
                  <tr key={flow.date}>
                    <td>{new Date(flow.date).toLocaleDateString('en-IN')}</td>
                    <td className="text-right">{formatCurrency(flow.revenue)}</td>
                    <td className="text-right color-muted">{formatCurrency(flow.commission)}</td>
                    <td className="text-right">{formatCurrency(flow.netIncome)}</td>
                    <td
                      className={`text-right${flow.expenses > 0 ? ' color-red' : ' color-muted'}`}
                    >
                      {flow.expenses > 0 ? `-${formatCurrency(flow.expenses)}` : '-'}
                    </td>
                    <td
                      className={`text-right${flow.netProfit >= 0 ? ' color-green' : ' color-red'}`}
                    >
                      {formatCurrency(flow.netProfit)}
                    </td>
                    <td className="text-right">{formatCurrency(flow.received)}</td>
                    <td
                      className={`text-right${flow.outstanding > 0 ? ' color-red' : ' color-green'}`}
                    >
                      {formatCurrency(flow.outstanding)}
                    </td>
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
  );
}
