import { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { getLocalDateString } from '@/lib/dateUtils';
import { groupJobsByCard } from '@/lib/reportUtils';
import { apiClient } from '@/lib/apiClient';
import { useUIStore } from '@/stores/uiStore';
import { Icon } from '@/components/ui/Icon';
import './Sidebar.css';

interface NavItem {
  path: string;
  label: string;
  tamil?: string;
  icon: ReactNode;
  count?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

type SyncStatus = 'ok' | 'offline' | 'error' | 'unknown';

function useSyncInfo(lastSyncAt: string | null, backendConnected: boolean, syncError: string | null): { label: string; status: SyncStatus } {
  if (syncError) return { label: 'Sync failed', status: 'error' };
  if (!backendConnected) return { label: 'Offline', status: 'offline' };
  if (!lastSyncAt) return { label: 'Not synced', status: 'unknown' };
  const diff = Date.now() - new Date(lastSyncAt).getTime();
  const mins = Math.floor(diff / 60000);
  const label = mins < 1 ? 'Synced just now' : mins < 60 ? `Synced ${mins}m ago` : 'Synced';
  return { label, status: 'ok' };
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const jobs = useDataStore((s) => s.jobs);
  const lastSyncAt = useDataStore((s) => s.lastSyncAt);
  const backendConnected = useDataStore((s) => s.backendConnected);
  const syncError = useDataStore((s) => s.syncError);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const mobileDrawerOpen = useUIStore((s) => s.mobileDrawerOpen);
  const closeMobileDrawer = useUIStore((s) => s.closeMobileDrawer);

  // Close drawer whenever the route changes (user tapped a nav link)
  useEffect(() => {
    closeMobileDrawer();
  }, [location.pathname, closeMobileDrawer]);

  const handleLogout = async () => {
    await apiClient.logout();
    window.dispatchEvent(new Event('slw-auth-changed'));
    navigate('/login', { replace: true });
  };
  const today = getLocalDateString(new Date());
  const todayCount = groupJobsByCard(jobs.filter((j) => j.date === today)).length;
  const sync = useSyncInfo(lastSyncAt, backendConnected, syncError);

  const navSections: NavSection[] = [
    {
      title: 'Operations',
      items: [
        { path: '/dashboard', label: 'Dashboard', tamil: 'முகப்பு', icon: <Icon name="dashboard" width={15} height={15} /> },
        { path: '/', label: 'Jobs', tamil: 'முகப்பு', icon: <Icon name="jobs" width={15} height={15} />, count: todayCount },
      ],
    },
    {
      title: 'Reporting',
      items: [
        { path: '/history', label: 'History', tamil: '??????', icon: <Icon name="history" width={15} height={15} /> },
        { path: '/records', label: 'Records', tamil: '????????', icon: <Icon name="records" width={15} height={15} /> },
        { path: '/follow-ups', label: 'Follow-ups', icon: <Icon name="bell" width={15} height={15} /> },
        { path: '/commission-dc', label: 'Commission DC', icon: <Icon name="commission" width={15} height={15} /> },
      ],
    },
    {
      title: 'Finance',
      items: [
        { path: '/invoice', label: 'Invoice', tamil: '??????', icon: <Icon name="invoice" width={15} height={15} /> },
        { path: '/payments', label: 'Record Payments', tamil: '?????????', icon: <Icon name="payments" width={15} height={15} /> },
        { path: '/finance', label: 'Audit', tamil: '????', icon: <Icon name="finance" width={15} height={15} /> },
        {
          path: '/owner-report',
          label: 'Monthly Report',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Admin',
      items: [
        { path: '/expenses', label: 'Expense', tamil: '????????', icon: <Icon name="expenses" width={15} height={15} /> },
        { path: '/customers', label: 'Customer', tamil: '????????????????', icon: <Icon name="customers" width={15} height={15} /> },
        { path: '/work-types', label: 'Worktype', tamil: '???? ??????', icon: <Icon name="worktypes" width={15} height={15} /> },
        { path: '/logger', label: 'Logger', tamil: '???????', icon: <Icon name="logger" width={15} height={15} /> },
      ],
    },
  ];

  return (
    <aside
      className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileDrawerOpen ? 'mobile-open' : ''}`}
      aria-label="Sidebar navigation"
    >
      <div className="sidebar-header">
        <div className="brand-mark" aria-hidden="true">
          S
        </div>
        <div className="brand-meta">
          <h1 className="sidebar-title">Siva Lathe Works</h1>
          <p className="sidebar-subtitle tamil">சிவா லேத் வொர்க்ஸ்</p>
        </div>
        {/* Close button — only rendered as a drawer on mobile/tablet */}
        <button
          type="button"
          className="sidebar-drawer-close"
          onClick={closeMobileDrawer}
          aria-label="Close navigation"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navSections.map((section) => (
          <section className="nav-section" key={section.title}>
            <h2 className="nav-section-title">{section.title}</h2>
            <ul className="nav-list">
              {section.items.map((item) => (
                <li key={item.path} className="nav-item">
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    title={item.label}
                    aria-label={item.label}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                    <span className="nav-copy">
                      <span className="nav-label">{item.label}</span>
                    </span>
                    {typeof item.count === 'number' ? (
                      <span className="nav-count numeric">{item.count}</span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="sidebar-sync" data-sync={sync.status} title={syncError ?? sync.label}>
        <span className="sidebar-sync-dot" />
        <span className="sidebar-sync-label">{sync.label}</span>
      </div>

      <footer className="sidebar-footer">
        <span className="sidebar-avatar numeric" aria-hidden="true">SA</span>
        <span className="sidebar-user-meta">
          <span className="sidebar-user">SLW Admin</span>
          <span className="sidebar-role">Owner</span>
        </span>
        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={() => void handleLogout()}
          title="Sign out"
          aria-label="Sign out"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </footer>
    </aside>
  );
}
