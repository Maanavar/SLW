import type { CSSProperties } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';
import type { PaymentMethodBreakdown, PaymentMetrics } from '@/lib/financeUtils';

interface PaymentsTabProps {
  paymentMetrics: PaymentMetrics;
  paymentMethodBreakdown: PaymentMethodBreakdown[];
}

export function PaymentsTab({ paymentMetrics, paymentMethodBreakdown }: PaymentsTabProps) {
  return (
    <div className="fin-tab-content">
      <div className="fin-stats fin-stats-4">
        <div className="fin-stat fin-stat--green">
          <span className="fin-stat-label">Total Received</span>
          <span className="fin-stat-value">{formatCurrency(paymentMetrics.totalReceived)}</span>
          <span className="fin-stat-sub">Cash collected</span>
        </div>
        <div
          className={`fin-stat${paymentMetrics.totalOutstanding > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}
        >
          <span className="fin-stat-label">Outstanding</span>
          <span className="fin-stat-value">{formatCurrency(paymentMetrics.totalOutstanding)}</span>
          <span className="fin-stat-sub">Still to collect</span>
        </div>
        <div className="fin-stat">
          <span className="fin-stat-label">Collection Rate</span>
          <span className="fin-stat-value">{paymentMetrics.collectionRate.toFixed(1)}%</span>
          <span className="fin-stat-sub">% of revenue collected</span>
        </div>
        <div className="fin-stat">
          <span className="fin-stat-label">Avg Days to Payment</span>
          <span className="fin-stat-value">{paymentMetrics.averagePaymentDays}</span>
          <span className="fin-stat-sub">Days job to receipt</span>
        </div>
      </div>

      <div className="fin-method-tile">
        <div className="fin-chart-title">Payment Method Breakdown</div>
        {paymentMethodBreakdown.length > 0 ? (
          <div className="fin-method-grid">
            {paymentMethodBreakdown.map((m) => (
              <div key={m.method} className="fin-method-row">
                <span className="fin-method-name">{m.method}</span>
                <div className="fin-bar-track">
                  <div
                    className="fin-bar-fill"
                    style={{ '--bar-width': `${m.percentage}%` } as CSSProperties}
                  />
                </div>
                <span className="fin-method-amount">{formatCurrency(m.amount)}</span>
                <span className="fin-method-pct">{m.percentage.toFixed(1)}%</span>
                <span className="fin-method-count">
                  {m.count} txn{m.count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="fin-empty">No payment data for this period</p>
        )}
      </div>
    </div>
  );
}
