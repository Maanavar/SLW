/**
 * Badge Component
 * Display type/status badges with different variants
 */

import './Badge.css';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Badge({
  label,
  variant = 'default',
  size = 'md',
  className = '',
}: BadgeProps) {
  return (
    <span className={`badge badge-${variant} badge-${size} ${className}`}>
      {label}
    </span>
  );
}

/**
 * Status Badge - Shows job/payment status with a leading dot
 */
export function StatusBadge({ status }: { status: string }) {
  let variant: BadgeProps['variant'] = 'default';
  let label = status;

  const s = status.toLowerCase();
  if (s === 'paid') {
    variant = 'success';
    label = 'Paid';
  } else if (s === 'partially paid') {
    variant = 'warning';
    label = 'Partial';
  } else if (s === 'pending') {
    variant = 'error';
    label = 'Pending';
  } else if (s === 'completed') {
    variant = 'success';
  } else if (s.includes('approved')) {
    variant = 'primary';
  }

  return (
    <span className={`badge badge-${variant} badge-md status-badge`}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Type Badge - Shows customer/work type
 */
export function TypeBadge({ type }: { type: string }) {
  let variant: BadgeProps['variant'] = 'default';

  if (type === 'Monthly') {
    variant = 'primary';
  } else if (type === 'Invoice') {
    variant = 'default';
  } else if (type === 'Party-Credit') {
    variant = 'warning';
  } else if (type === 'Cash') {
    variant = 'success';
  }

  return <Badge label={type} variant={variant} />;
}
