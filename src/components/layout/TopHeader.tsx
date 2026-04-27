import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { Icon } from '@/components/ui/Icon';
import { UniversalSearch } from '@/components/ui/UniversalSearch';
import { NotificationBell } from './NotificationBell';
import { apiClient } from '@/lib/apiClient';
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
  const navigate = useNavigate();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar, openMobileDrawer } = useUIStore();

  // Desktop: collapse/expand the sidebar. Mobile/tablet: open the slide-in drawer.
  const handleNavToggle = () => {
    if (window.innerWidth <= 1024) {
      openMobileDrawer();
    } else {
      toggleSidebar();
    }
  };
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const page = pageMap[location.pathname] ?? {
    title: 'Siva Lathe Works',
    subtitle: 'Workshop operations',
  };

  const handleLogout = async () => {
    await apiClient.logout();
    window.dispatchEvent(new Event('slw-auth-changed'));
    navigate('/login', { replace: true });
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userMenuOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!userMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [userMenuOpen]);

  return (
    <header className="top-header" role="banner">
      {/* Left: nav toggle + breadcrumb */}
      <div className="top-header-left">
        <button
          type="button"
          className="top-icon-btn"
          onClick={handleNavToggle}
          title="Toggle navigation"
          aria-label="Toggle navigation"
        >
          <Icon name="menu" width={16} height={16} />
        </button>

        <div className="top-header-title">
          <span className="top-header-main">{page.title}</span>
          <span className="top-header-sep" aria-hidden="true">/</span>
          <span className="top-header-sub">{page.subtitle}</span>
        </div>
      </div>

      {/* Right: Search → Theme → User (Atlassian order) */}
      <div className="top-header-actions" aria-label="Global actions">
        <UniversalSearch />

        <button
          type="button"
          className="top-icon-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} width={16} height={16} />
        </button>

        <NotificationBell />

        {/* User avatar — opens account dropdown */}
        <div className="top-user-menu" ref={menuRef}>
          <button
            type="button"
            className="top-avatar-btn"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-label="Account menu"
            aria-haspopup="true"
          >
            <span className="top-avatar-label" aria-hidden="true">SA</span>
          </button>

          {userMenuOpen && (
            <div className="top-user-dropdown" role="menu" aria-label="Account options">
              <div className="top-user-identity">
                <span className="top-user-avatar-lg" aria-hidden="true">SA</span>
                <div className="top-user-meta">
                  <span className="top-user-name">SLW Admin</span>
                  <span className="top-user-role">Owner · Siva Lathe Works</span>
                </div>
              </div>
              <hr className="top-user-sep" />
              <button
                type="button"
                role="menuitem"
                className="top-user-action top-user-action--danger"
                onClick={() => { setUserMenuOpen(false); void handleLogout(); }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
