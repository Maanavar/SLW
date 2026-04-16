/**
 * Dashboard Screen
 * Home screen with analytics and customer balance overview
 */

import { PeriodSummaryRow } from './PeriodSummaryRow';
import { CustomerBalancesTable } from './CustomerBalancesTable';
import { QuickActions } from './QuickActions';
import './DashboardScreen.css';

export function DashboardScreen() {
  return (
    <div className="dashboard-screen">
      <div className="dashboard-header dashboard-hero">
        <div className="dashboard-title-section dashboard-hero-main">
          <p className="dashboard-eyebrow">Operations Workspace</p>
          <h2 className="dashboard-title">Operations Snapshot</h2>
          <p className="dashboard-subtitle">Track inflow, outflow, and receivables with one focused command center.</p>
          <div className="dashboard-hero-pills">
            <span className="dashboard-hero-pill">Live financial visibility</span>
            <span className="dashboard-hero-pill">Daily to monthly trend context</span>
            <span className="dashboard-hero-pill">Action-first workflow</span>
          </div>
        </div>
        <div className="dashboard-actions dashboard-actions-panel">
          <div className="dashboard-actions-header">
            <h3 className="dashboard-actions-title">Quick Actions</h3>
            <p className="dashboard-actions-subtitle">Jump to the most common workflows.</p>
          </div>
          <QuickActions />
        </div>
      </div>

      <div className="dashboard-content">
        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h3 className="dashboard-section-title">Period Performance</h3>
            <p className="dashboard-section-subtitle">Switch between today, week, and month to see focused metrics.</p>
          </div>
          <PeriodSummaryRow />
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h3 className="dashboard-section-title">Customer Balances</h3>
            <p className="dashboard-section-subtitle">Monitor outstanding and advance positions by customer type.</p>
          </div>
          <CustomerBalancesTable />
        </section>
      </div>
    </div>
  );
}
