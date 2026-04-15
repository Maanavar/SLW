import { useLocation } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { useUIStore } from '@/stores/uiStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { getJobNetValue, getJobPaidAmount } from '@/lib/jobUtils';
import { groupJobsByCard } from '@/lib/reportUtils';
import './TopHeader.css';

interface PageInfo {
  title: string;
  description?: string;
}

const pageMap: Record<string, PageInfo> = {
  '/': { title: 'Jobs', description: 'Create and manage job entries' },
  '/dashboard': { title: 'Dashboard', description: 'Business overview and key metrics' },
  '/customers': { title: 'Customers', description: 'Customer accounts and settings' },
  '/work-types': { title: 'Work Types', description: 'Rate cards and work catalog' },
  '/jobs': { title: 'Jobs', description: 'Create and manage job entries' },
  '/payments': { title: 'Payments', description: 'Record incoming payments' },
  '/history': { title: 'History', description: 'Track completed and pending work' },
  '/reports': { title: 'Reports', description: 'Operational and financial insights' },
  '/logger': { title: 'Logger', description: 'Audit trail and controlled data operations' },
  '/payment-report': {
    title: 'Payment Report',
    description: 'Mode-wise and period-wise payment view',
  },
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

export function TopHeader() {
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
        </div>
      </div>

      <div className="header-pills">
        <div className="header-pill">
          <span className="pill-label">Jobs Today</span>
          <span className="pill-value">{todayJobCards.length}</span>
          <span className="pill-subvalue">{formatCurrency(todayJobsNet)}</span>
        </div>
        <div className="header-pill">
          <span className="pill-label">Payments Today</span>
          <span className="pill-value">{todayPaymentsCount}</span>
          <span className="pill-subvalue">{formatCurrency(todayPaymentsAmount)}</span>
        </div>
        <div className="header-pill">
          <span className="pill-label">Date</span>
          <span className="pill-value">
            {new Date().toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          <span className="pill-subvalue">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long' })}
          </span>
        </div>
      </div>
    </header>
  );
}
