import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useUIStore } from '@/stores/uiStore';
import './QuickActions.css';

interface QuickAction {
  label: string;
  action: () => void;
  primary?: boolean;
  icon: ReactNode;
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function QuickActions() {
  const navigate = useNavigate();
  const { openModal } = useUIStore();

  const actions: QuickAction[] = [
    {
      label: 'New Job',
      action: () => navigate('/'),
      primary: true,
      icon: (
        <svg {...iconProps}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
    },
    {
      label: 'Add Customer',
      action: () => openModal('customer'),
      icon: (
        <svg {...iconProps}>
          <circle cx="8" cy="9" r="3" />
          <path d="M3.5 19c.8-2.6 2.8-4 4.5-4s3.7 1.4 4.5 4" />
          <path d="M17 8v6M14 11h6" />
        </svg>
      ),
    },
    {
      label: 'Record Payment',
      action: () => navigate('/payments'),
      icon: (
        <svg {...iconProps}>
          <path d="M12 2v20" />
          <path d="M16.6 7.2C16.6 5.7 14.7 4.4 12 4.4 9.3 4.4 7.4 5.7 7.4 7.2s1.9 2.7 4.6 2.7c2.7 0 4.6 1.2 4.6 2.7S14.7 15.4 12 15.4c-2.7 0-4.6-1.2-4.6-2.7" />
        </svg>
      ),
    },
    {
      label: 'View Records',
      action: () => navigate('/records'),
      icon: (
        <svg {...iconProps}>
          <path d="M4 20V4" />
          <path d="M4 20h16" />
          <path d="M8 16V9" />
          <path d="M12 16V6" />
          <path d="M16 16v-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="quick-actions">
      {actions.map((action) => (
        <button
          key={action.label}
          className={`quick-action-btn ${action.primary ? 'primary' : ''}`}
          onClick={action.action}
          type="button"
        >
          <span className="quick-action-icon">{action.icon}</span>
          <span className="quick-action-label">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
