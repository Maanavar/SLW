import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useUIStore } from '@/stores/uiStore';
import './Sidebar.css';

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

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

const navSections: NavSection[] = [
  {
    title: 'Operations',
    items: [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: (
          <svg {...iconProps}>
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <rect x="13" y="3" width="8" height="5" rx="2" />
            <rect x="13" y="10" width="8" height="11" rx="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" />
          </svg>
        ),
      },
      {
        path: '/',
        label: 'Jobs',
        icon: (
          <svg {...iconProps}>
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M8 9h8M8 13h8M8 17h5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        path: '/payments',
        label: 'Payments',
        icon: (
          <svg {...iconProps}>
            <path d="M12 2v20" />
            <path d="M17 7.5C17 5.6 14.8 4 12 4s-5 1.6-5 3.5S9.2 11 12 11s5 1.5 5 3.5S14.8 18 12 18s-5-1.6-5-3.5" />
          </svg>
        ),
      },
      {
        path: '/history',
        label: 'Job History',
        icon: (
          <svg {...iconProps}>
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v4h4" />
            <path d="M12 7v6l3 2" />
          </svg>
        ),
      },
      {
        path: '/reports',
        label: 'Report',
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
      {
        path: '/finance',
        label: 'Finance',
        icon: (
          <svg {...iconProps}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M7 11h10" />
            <path d="M7 15h10" />
            <path d="M7 7h10" />
          </svg>
        ),
      },
      {
        path: '/expenses',
        label: 'Expenses',
        icon: (
          <svg {...iconProps}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v10M7 12h10" />
          </svg>
        ),
      },
      {
        path: '/commission',
        label: 'Commission',
        icon: (
          <svg {...iconProps}>
            <circle cx="9" cy="8" r="2.5" />
            <circle cx="15" cy="8" r="2.5" />
            <path d="M9 12c0 1.8-1.5 3.5-3.5 3.5S2 13.8 2 12" />
            <path d="M15 12c0 1.8 1.5 3.5 3.5 3.5S22 13.8 22 12" />
            <path d="M12 14v4" />
          </svg>
        ),
      },
      {
        path: '/logger',
        label: 'Logger',
        icon: (
          <svg {...iconProps}>
            <path d="M4 4h16v16H4z" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Masters',
    items: [
      {
        path: '/customers',
        label: 'Customer',
        icon: (
          <svg {...iconProps}>
            <circle cx="8" cy="8" r="3" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M3 19c0-3 2.2-5 5-5s5 2 5 5" />
            <path d="M13 19c.2-2 1.8-3.5 4-3.5 2 0 3.5 1.1 4 3.5" />
          </svg>
        ),
      },
      {
        path: '/work-types',
        label: 'WorkType',
        icon: (
          <svg {...iconProps}>
            <path d="M4 7h16" />
            <path d="M6 7V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V7" />
            <rect x="5" y="7" width="14" height="13" rx="2" />
            <path d="M9 12h6M9 16h4" />
          </svg>
        ),
      },
    ],
  },
];

export function Sidebar() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-mark" aria-hidden="true">
          SL
        </div>
        <div className="brand-meta">
          <h1 className="sidebar-title">Siva Lathe Works</h1>
          <p className="sidebar-subtitle">Operations Workspace</p>
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
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <footer className="sidebar-footer">
        <p className="version">React Interface</p>
      </footer>
    </aside>
  );
}
