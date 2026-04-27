import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import './QuickActions.css';

interface QuickAction {
  label: string;
  tamil: string;
  description: string;
  action: () => void;
  icon: IconName;
}

export function QuickActions() {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      label: 'New Job Card',
      tamil: 'புதிய வேலை அட்டை',
      description: "Create today's job entry",
      action: () => navigate('/'),
      icon: 'plus',
    },
    {
      label: '10-Day Finance',
      tamil: '10 நாள் நிதி',
      description: 'Period-wise revenue view',
      action: () => navigate('/finance?tab=tenday'),
      icon: 'finance',
    },
    {
      label: 'View Records',
      tamil: 'பதிவுகளை காண்க',
      description: 'Export & filter',
      action: () => navigate('/records'),
      icon: 'records',
    },
    {
      label: 'Record Expense',
      tamil: 'செலவு பதிவு செய்',
      description: 'Add workshop expense',
      action: () => navigate('/expenses'),
      icon: 'expenses',
    },
  ];

  return (
    <div className="quick-actions">
      {actions.map((action) => (
        <button key={action.label} className="quick-action-card" onClick={action.action} type="button">
          <span className="quick-action-icon">
            <Icon name={action.icon} width={16} height={16} />
          </span>
          <span className="quick-action-copy">
            <span className="quick-action-title-row">
              <span className="quick-action-label">{action.label}</span>
              <span className="quick-action-ta tamil">{action.tamil}</span>
            </span>
            <span className="quick-action-desc">{action.description}</span>
          </span>
          <span className="quick-action-arrow" aria-hidden="true">
            <Icon name="chevronr" width={14} height={14} />
          </span>
        </button>
      ))}
    </div>
  );
}
