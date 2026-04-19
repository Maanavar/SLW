import { useLocation } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { Icon } from '@/components/ui/Icon';
import './TopHeader.css';

interface PageMeta {
  title: string;
  subtitle: string;
}

const pageMap: Record<string, PageMeta> = {
  '/': { title: 'Jobs', subtitle: 'New job card' },
  '/dashboard': { title: 'Dashboard', subtitle: 'Executive snapshot' },
  '/records': { title: 'Records', subtitle: 'Cards and table view' },
  '/history': { title: 'History', subtitle: 'Day-wise card history' },
  '/payments': { title: 'Payments', subtitle: 'Record and track payments' },
  '/finance': { title: 'Finance', subtitle: 'Revenue and analysis' },
  '/commission': { title: 'Commission', subtitle: 'Workers and history' },
  '/expenses': { title: 'Expenses', subtitle: 'Overview and break-even' },
  '/customers': { title: 'Customers', subtitle: 'Customer accounts' },
  '/work-types': { title: 'Work Types', subtitle: 'Rates and categories' },
  '/logger': { title: 'Logger', subtitle: 'Activity and danger zone' },
};

export function TopHeader() {
  const location = useLocation();
  const { theme, toggleTheme } = useUIStore();

  const page = pageMap[location.pathname] || {
    title: 'Siva Lathe Works',
    subtitle: 'Workshop operations',
  };

  return (
    <header className="top-header" role="banner">
      <div className="top-header-title">
        <span className="top-header-main">{page.title}</span>
        <span className="top-header-sep">/</span>
        <span className="top-header-sub">{page.subtitle}</span>
      </div>

      <div className="top-header-actions" aria-label="Header actions">
        <button type="button" className="top-icon-btn" title="Search">
          <Icon name="search" width={16} height={16} />
        </button>
        <button type="button" className="top-icon-btn" title="Notifications">
          <Icon name="bell" width={16} height={16} />
        </button>
        <button
          type="button"
          className="top-icon-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} width={16} height={16} />
        </button>
      </div>
    </header>
  );
}
