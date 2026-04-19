import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { getLocalDateString } from '@/lib/dateUtils';
import { groupJobsByCard } from '@/lib/reportUtils';
import { apiClient } from '@/lib/apiClient';
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

export function Sidebar() {
  const navigate = useNavigate();
  const jobs = useDataStore((s) => s.jobs);

  const handleLogout = async () => {
    await apiClient.logout();
    window.dispatchEvent(new Event('slw-auth-changed'));
    navigate('/login', { replace: true });
  };
  const today = getLocalDateString(new Date());
  const todayCount = groupJobsByCard(jobs.filter((j) => j.date === today)).length;

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
        { path: '/records', label: 'Records', tamil: '????????', icon: <Icon name="records" width={15} height={15} /> },
        { path: '/history', label: 'History', tamil: '??????', icon: <Icon name="history" width={15} height={15} /> },
      ],
    },
    {
      title: 'Finance',
      items: [
        { path: '/payments', label: 'Payments', tamil: '?????????', icon: <Icon name="payments" width={15} height={15} /> },
        { path: '/finance', label: 'Finance', tamil: '????', icon: <Icon name="finance" width={15} height={15} /> },
        { path: '/commission', label: 'Commission', tamil: '??????', icon: <Icon name="commission" width={15} height={15} /> },
        { path: '/expenses', label: 'Expenses', tamil: '????????', icon: <Icon name="expenses" width={15} height={15} /> },
      ],
    },
    {
      title: 'Admin',
      items: [
        { path: '/customers', label: 'Customers', tamil: '????????????????', icon: <Icon name="customers" width={15} height={15} /> },
        { path: '/work-types', label: 'Work Types', tamil: '???? ??????', icon: <Icon name="worktypes" width={15} height={15} /> },
        { path: '/logger', label: 'Logger', tamil: '???????', icon: <Icon name="logger" width={15} height={15} /> },
      ],
    },
  ];

  return (
    <aside className="sidebar" aria-label="Sidebar navigation">
      <div className="sidebar-header">
        <div className="brand-mark" aria-hidden="true">
          S
        </div>
        <div className="brand-meta">
          <h1 className="sidebar-title">Siva Lathe Works</h1>
          <p className="sidebar-subtitle tamil">சிவா லேத் வொர்க்ஸ்</p>
        </div>
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
