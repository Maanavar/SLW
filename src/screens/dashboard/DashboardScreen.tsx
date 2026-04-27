import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { Icon } from '@/components/ui/Icon';
import { PeriodSummaryRow } from './PeriodSummaryRow';
import { CustomerBalancesTable } from './CustomerBalancesTable';
import { QuickActions } from './QuickActions';
import { AnomalyAlerts } from '@/components/dashboard/AnomalyAlerts';
import '@/components/dashboard/AnomalyAlerts.css';
import './DashboardScreen.css';

export function DashboardScreen() {
  const navigate = useNavigate();
  const { openModal } = useUIStore();

  return (
    <div className="dashboard-screen">
      <div className="dashboard-page-header">
        <div>
          <h1 className="dashboard-title">Dashboard <span className="dashboard-title-ta tamil">முகப்பு</span></h1>
          <p className="dashboard-desc">Operations snapshot and outstanding balances</p>
        </div>

        <div className="dashboard-header-actions">
          <button type="button" className="btn btn-secondary dashboard-header-btn" onClick={() => navigate('/payments')}>
            <Icon name="payments" width={14} height={14} />
            Record payment
          </button>
          <button type="button" className="btn btn-accent dashboard-header-btn dashboard-header-btn--primary" onClick={() => openModal('customer')}>
            <Icon name="plus" width={14} height={14} />
            New customer
          </button>
        </div>
      </div>

      <AnomalyAlerts />
      <QuickActions />
      <PeriodSummaryRow />
      <CustomerBalancesTable />
    </div>
  );
}
