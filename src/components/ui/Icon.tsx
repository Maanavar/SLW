import type { SVGProps } from 'react';

export type IconName =
  | 'dashboard'
  | 'jobs'
  | 'records'
  | 'payments'
  | 'finance'
  | 'commission'
  | 'expenses'
  | 'customers'
  | 'worktypes'
  | 'history'
  | 'logger'
  | 'plus'
  | 'x'
  | 'close'
  | 'search'
  | 'chevron'
  | 'chevronl'
  | 'chevronr'
  | 'edit'
  | 'trash'
  | 'check'
  | 'eye'
  | 'sun'
  | 'moon'
  | 'download'
  | 'upload'
  | 'filter'
  | 'calendar'
  | 'arrow_up'
  | 'arrow_down'
  | 'bell'
  | 'settings'
  | 'info'
  | 'offline'
  | 'copy'
  | 'refresh'
  | 'menu'
  | 'tool'
  | 'user';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'dashboard':
      return <svg {...common} {...props}><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></svg>;
    case 'jobs':
      return <svg {...common} {...props}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>;
    case 'records':
      return <svg {...common} {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h10M7 16h6" /><path d="M16 2v4" /><path d="M8 2v4" /></svg>;
    case 'payments':
      return <svg {...common} {...props}><path d="M12 2v20" /><path d="M17 7.5C17 5.6 14.8 4 12 4s-5 1.6-5 3.5S9.2 11 12 11s5 1.5 5 3.5S14.8 18 12 18s-5-1.6-5-3.5" /></svg>;
    case 'finance':
      return <svg {...common} {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 11h10M7 15h10M7 7h10" /></svg>;
    case 'commission':
      return <svg {...common} {...props}><circle cx="9" cy="8" r="2.5" /><circle cx="15" cy="8" r="2.5" /><path d="M9 12c0 1.8-1.5 3.5-3.5 3.5S2 13.8 2 12" /><path d="M15 12c0 1.8 1.5 3.5 3.5 3.5S22 13.8 22 12" /><path d="M12 14v4" /></svg>;
    case 'expenses':
      return <svg {...common} {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M7 12h10" /></svg>;
    case 'customers':
      return <svg {...common} {...props}><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19c0-3 2.2-5 5-5s5 2 5 5" /><path d="M13 19c.2-2 1.8-3.5 4-3.5 2 0 3.5 1.1 4 3.5" /></svg>;
    case 'worktypes':
    case 'tool':
      return <svg {...common} {...props}><path d="M4 7h16" /><path d="M6 7V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V7" /><rect x="5" y="7" width="14" height="13" rx="2" /><path d="M9 12h6M9 16h4" /></svg>;
    case 'history':
      return <svg {...common} {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'logger':
      return <svg {...common} {...props}><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
    case 'plus':
      return <svg {...common} {...props}><path d="M12 5v14M5 12h14" /></svg>;
    case 'x':
    case 'close':
      return <svg {...common} {...props}><path d="M18 6L6 18M6 6l12 12" /></svg>;
    case 'search':
      return <svg {...common} {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case 'chevron':
      return <svg {...common} {...props}><path d="M6 9l6 6 6-6" /></svg>;
    case 'chevronl':
      return <svg {...common} {...props}><path d="M15 18l-6-6 6-6" /></svg>;
    case 'chevronr':
      return <svg {...common} {...props}><path d="M9 18l6-6-6-6" /></svg>;
    case 'edit':
      return <svg {...common} {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
    case 'trash':
      return <svg {...common} {...props}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>;
    case 'check':
      return <svg {...common} {...props}><path d="M20 6 9 17l-5-5" /></svg>;
    case 'eye':
      return <svg {...common} {...props}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" /></svg>;
    case 'sun':
      return <svg {...common} {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2.2M12 19.8V22M4.8 4.8l1.5 1.5M17.7 17.7l1.5 1.5M2 12h2.2M19.8 12H22M4.8 19.2l1.5-1.5M17.7 6.3l1.5-1.5" /></svg>;
    case 'moon':
      return <svg {...common} {...props}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7.3 7.3 0 0 0 20 14.5z" /></svg>;
    case 'download':
      return <svg {...common} {...props}><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></svg>;
    case 'upload':
      return <svg {...common} {...props}><path d="M12 21V9" /><path d="m17 13-5-5-5 5" /><path d="M4 4h16" /></svg>;
    case 'filter':
      return <svg {...common} {...props}><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
    case 'calendar':
      return <svg {...common} {...props}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    case 'arrow_up':
      return <svg {...common} {...props}><path d="m12 19 0-14" /><path d="m7 10 5-5 5 5" /></svg>;
    case 'arrow_down':
      return <svg {...common} {...props}><path d="m12 5 0 14" /><path d="m7 14 5 5 5-5" /></svg>;
    case 'bell':
      return <svg {...common} {...props}><path d="M6 10a6 6 0 0 1 12 0v4l2 2H4l2-2z" /><path d="M10 18a2 2 0 0 0 4 0" /></svg>;
    case 'settings':
      return <svg {...common} {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1z" /></svg>;
    case 'info':
      return <svg {...common} {...props}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>;
    case 'offline':
      return <svg {...common} {...props}><path d="M3 12a9 9 0 0 1 15.6-6.1" /><path d="M3 12a9 9 0 0 0 15.6 6.1" /><path d="M2 2l20 20" /></svg>;
    case 'copy':
      return <svg {...common} {...props}><rect x="9" y="9" width="11" height="11" rx="2" /><rect x="4" y="4" width="11" height="11" rx="2" /></svg>;
    case 'refresh':
      return <svg {...common} {...props}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>;
    case 'menu':
      return <svg {...common} {...props}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case 'user':
      return <svg {...common} {...props}><circle cx="12" cy="8" r="3.5" /><path d="M4 20a8 8 0 0 1 16 0" /></svg>;
    default:
      return <svg {...common} {...props}><circle cx="12" cy="12" r="9" /></svg>;
  }
}
