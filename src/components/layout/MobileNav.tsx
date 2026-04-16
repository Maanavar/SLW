import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import './MobileNav.css';

interface MobileNavItem {
  path: string;
  label: string;
  icon: ReactNode;
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

const navItems: MobileNavItem[] = [
  // Operations
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
        <path d="M8 9h8M8 13h8M8 17h4" />
      </svg>
    ),
  },
  // Reporting
  {
    path: '/records',
    label: 'Records',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 8h10M7 12h10M7 16h6" />
        <path d="M16 2v4" />
        <path d="M8 2v4" />
      </svg>
    ),
  },
  // Finance
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
    path: '/expenses',
    label: 'Expenses',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M7 12h10" />
      </svg>
    ),
  },
  // Settings
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
];

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <ul className="mobile-nav-list">
        {navItems.map((item) => (
          <li key={item.path} className="mobile-nav-item">
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `mobile-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
