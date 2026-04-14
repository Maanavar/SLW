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
    label: 'Reports',
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
