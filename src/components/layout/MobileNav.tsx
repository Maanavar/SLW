import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import './MobileNav.css';

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const primaryItems: NavItem[] = [
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
    path: '/records',
    label: 'Records',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 8h10M7 12h10M7 16h6" />
        <path d="M16 2v4M8 2v4" />
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
];

const moreItems: NavItem[] = [
  {
    path: '/follow-ups',
    label: 'Follow-ups',
    icon: (
      <svg {...iconProps}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    path: '/history',
    label: 'History',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    path: '/invoice',
    label: 'Invoice',
    icon: (
      <svg {...iconProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    path: '/commission-dc',
    label: 'Commission DC',
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
  {
    path: '/finance',
    label: 'Audit',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 11h10M7 15h10M7 7h10" />
      </svg>
    ),
  },
  {
    path: '/settlement',
    label: 'Settlement',
    icon: (
      <svg {...iconProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 14l2 2 5-5" />
      </svg>
    ),
  },
  {
    path: '/owner-report',
    label: 'Monthly Report',
    icon: (
      <svg {...iconProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    path: '/customers',
    label: 'Customers',
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
    label: 'Work Types',
    icon: (
      <svg {...iconProps}>
        <path d="M4 7h16" />
        <path d="M6 7V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V7" />
        <rect x="5" y="7" width="14" height="13" rx="2" />
        <path d="M9 12h6M9 16h4" />
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
];

const moreIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const closeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Close drawer on outside tap
  useEffect(() => {
    if (!drawerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [drawerOpen]);

  const isMoreActive = moreItems.some((item) => location.pathname === item.path);

  return (
    <>
      {/* More drawer backdrop */}
      {drawerOpen && (
        <div
          className="mobile-more-backdrop"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* More drawer */}
      <div
        ref={drawerRef}
        className={`mobile-more-drawer ${drawerOpen ? 'open' : ''}`}
        aria-label="More navigation"
        role="dialog"
        aria-modal="true"
        aria-hidden={drawerOpen ? undefined : true}
      >
        <div className="mobile-more-header">
          <span className="mobile-more-title">More</span>
          <button
            type="button"
            className="mobile-more-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close"
          >
            {closeIcon}
          </button>
        </div>
        <ul className="mobile-more-list">
          {moreItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `mobile-more-link ${isActive ? 'active' : ''}`
                }
              >
                <span className="mobile-more-icon">{item.icon}</span>
                <span className="mobile-more-label">{item.label}</span>
                <svg className="mobile-more-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom tab bar */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <ul className="mobile-nav-list">
          {primaryItems.map((item) => (
            <li key={item.path} className="mobile-nav-item">
              <NavLink
                to={item.path}
                end={item.path === '/'}
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) =>
                  `mobile-nav-link ${isActive ? 'active' : ''}`
                }
              >
                <span className="mobile-nav-icon">{item.icon}</span>
                <span className="mobile-nav-label">{item.label}</span>
              </NavLink>
            </li>
          ))}

          {/* More button */}
          <li className="mobile-nav-item">
            <button
              type="button"
              className={`mobile-nav-link mobile-nav-more-btn ${isMoreActive || drawerOpen ? 'active' : ''}`}
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="More screens"
              aria-expanded={drawerOpen ? true : undefined}
            >
              <span className="mobile-nav-icon">{moreIcon}</span>
              <span className="mobile-nav-label">More</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
