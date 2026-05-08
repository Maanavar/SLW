import type { Dispatch, SetStateAction } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';
import type { CustomerFinancials } from '@/lib/financeUtils';
import { nextSortState, sortMark, type CustomerSortKey, type SortOrder } from '../financeHelpers';

interface CustomersTabProps {
  sortedCustomerFinancials: CustomerFinancials[];
  customerSort: { key: CustomerSortKey; order: SortOrder } | null;
  setCustomerSort: Dispatch<SetStateAction<{ key: CustomerSortKey; order: SortOrder } | null>>;
}

export function CustomersTab({
  sortedCustomerFinancials,
  customerSort,
  setCustomerSort,
}: CustomersTabProps) {
  return (
    <div className="fin-tab-content">
      <div className="fin-table-tile">
        <div className="fin-chart-title">Customer Financial Summary</div>
        {sortedCustomerFinancials.length > 0 ? (
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th
                    className={`slw-sortable-th${customerSort?.key === 'customer' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCustomerSort((prev) => nextSortState(prev, 'customer', 'asc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCustomerSort((prev) => nextSortState(prev, 'customer', 'asc'));
                      }
                    }}
                  >
                    Customer {sortMark(customerSort, 'customer')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${customerSort?.key === 'revenue' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCustomerSort((prev) => nextSortState(prev, 'revenue', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCustomerSort((prev) => nextSortState(prev, 'revenue', 'desc'));
                      }
                    }}
                  >
                    Revenue {sortMark(customerSort, 'revenue')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${customerSort?.key === 'commission' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCustomerSort((prev) => nextSortState(prev, 'commission', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCustomerSort((prev) => nextSortState(prev, 'commission', 'desc'));
                      }
                    }}
                  >
                    Commission {sortMark(customerSort, 'commission')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${customerSort?.key === 'profit' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setCustomerSort((prev) => nextSortState(prev, 'profit', 'desc'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCustomerSort((prev) => nextSortState(prev, 'profit', 'desc'));
                      }
                    }}
                  >
                    Profit {sortMark(customerSort, 'profit')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${customerSort?.key === 'received' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCustomerSort((prev) => nextSortState(prev, 'received', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCustomerSort((prev) => nextSortState(prev, 'received', 'desc'));
                      }
                    }}
                  >
                    Received {sortMark(customerSort, 'received')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${customerSort?.key === 'outstanding' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCustomerSort((prev) => nextSortState(prev, 'outstanding', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCustomerSort((prev) => nextSortState(prev, 'outstanding', 'desc'));
                      }
                    }}
                  >
                    Outstanding {sortMark(customerSort, 'outstanding')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${customerSort?.key === 'collectionRate' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCustomerSort((prev) => nextSortState(prev, 'collectionRate', 'desc'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCustomerSort((prev) => nextSortState(prev, 'collectionRate', 'desc'));
                      }
                    }}
                  >
                    Coll. Rate {sortMark(customerSort, 'collectionRate')}
                  </th>
                  <th
                    className={`text-right slw-sortable-th${customerSort?.key === 'cards' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setCustomerSort((prev) => nextSortState(prev, 'cards', 'desc'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCustomerSort((prev) => nextSortState(prev, 'cards', 'desc'));
                      }
                    }}
                  >
                    Cards {sortMark(customerSort, 'cards')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCustomerFinancials.map((c) => (
                  <tr key={c.customerId}>
                    <td className="fw-600">{c.customerName}</td>
                    <td className="text-right">{formatCurrency(c.totalRevenue)}</td>
                    <td className="text-right color-muted">
                      {formatCurrency(c.commissionExpense)}
                    </td>
                    <td className="text-right color-green">{formatCurrency(c.grossProfit)}</td>
                    <td className="text-right">{formatCurrency(c.totalReceived)}</td>
                    <td
                      className={`text-right${c.totalOutstanding > 0 ? ' color-red' : ' color-green'}`}
                    >
                      {formatCurrency(c.totalOutstanding)}
                    </td>
                    <td className="text-right">{c.paymentRate.toFixed(0)}%</td>
                    <td className="text-right">{c.jobCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="fin-empty">No customer data for this period</p>
        )}
      </div>
    </div>
  );
}
