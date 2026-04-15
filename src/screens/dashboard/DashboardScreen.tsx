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
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h2 className="dashboard-title">Operations Snapshot</h2>
          <p className="dashboard-subtitle">Monitor outstanding balances and daily progress</p>
        </div>
        <div className="dashboard-actions">
          <QuickActions />
        </div>
      </div>

      <div className="dashboard-content">
        <PeriodSummaryRow />
        <CustomerBalancesTable />
      </div>
    </div>
  );
}
