import { useLocation, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { useUIStore } from '@/stores/uiStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { getJobNetValue, getJobPaidAmount } from '@/lib/jobUtils';
import { groupJobsByCard } from '@/lib/reportUtils';
import { apiClient } from '@/lib/apiClient';
import './TopHeader.css';

interface PageInfo {
  title: string;
  description?: string;
}

const pageMap: Record<string, PageInfo> = {
  '/': { title: '', description: 'Create and manage job entries' },
  '/dashboard': { title: '', description: '' },
  '/customers': { title: '', description: 'Customer accounts and settings' },
  '/work-types': { title: ' ', description: 'Rate cards and work catalog' },
  '/jobs': { title: '', description: 'Create and manage job entries' },
  '/payments': { title: '', description: 'Record incoming payments' },
  '/history': { title: '', description: 'Track completed and pending work' },
  '/logger': { title: '', description: 'Audit trail and controlled data operations' },
};

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function SidebarIcon({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </svg>
    );
  }

  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.2M12 19.8V22M4.8 4.8l1.5 1.5M17.7 17.7l1.5 1.5M2 12h2.2M19.8 12H22M4.8 19.2l1.5-1.5M17.7 6.3l1.5-1.5" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7.3 7.3 0 0 0 20 14.5z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 16l4-4-4-4" />
      <path d="M14 12H3" />
    </svg>
  );
}

export function TopHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobs, payments } = useDataStore();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useUIStore();

  const pageInfo = pageMap[location.pathname] || {
    title: 'Workspace',
    description: undefined,
  };

  const today = getLocalDateString(new Date());
  const todayJobs = jobs.filter((job) => job.date === today);
  const todayJobCards = groupJobsByCard(todayJobs);
  const todayPayments = payments.filter((payment) => payment.date === today);
  const todayJobsNet = todayJobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
  const todayPaymentsAmountFromPayments = todayPayments.reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );
  const todayPaymentsAmountFromJobs = todayJobs.reduce(
    (sum, job) => sum + getJobPaidAmount(job),
    0
  );
  const todayPaymentsAmount =
    todayPaymentsAmountFromPayments > 0
      ? todayPaymentsAmountFromPayments
      : todayPaymentsAmountFromJobs;
  const todayPaymentsCountFromJobs = groupJobsByCard(
    todayJobs.filter((job) => getJobPaidAmount(job) > 0)
  ).length;
  const todayPaymentsCount =
    todayPayments.length > 0 ? todayPayments.length : todayPaymentsCountFromJobs;

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="top-header">
      <div className="header-top">
        <div className="header-title">
          <p className="page-eyebrow">Siva Lathe Works</p>
          <h1 className="page-title">{pageInfo.title}</h1>
          {pageInfo.description ? (
            <p className="page-description">{pageInfo.description}</p>
          ) : null}
        </div>

        <div className="header-actions">
          <button
            className="header-icon-button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            <SidebarIcon collapsed={sidebarCollapsed} />
          </button>

          <button
            className="header-icon-button"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            type="button"
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          <button
            className="header-icon-button"
            onClick={() => void handleLogout()}
            title="Sign out"
            type="button"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>

     
    </header>
  );
}
