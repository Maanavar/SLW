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
 * Status Badge - Shows job/payment status
 */
export function StatusBadge({ status }: { status: string }) {
  let variant: BadgeProps['variant'] = 'default';

  if (status.toLowerCase() === 'paid') {
    variant = 'success';
  } else if (status.toLowerCase() === 'partially paid') {
    variant = 'info';
  } else if (status.toLowerCase() === 'pending') {
    variant = 'warning';
  } else if (status.toLowerCase() === 'completed') {
    variant = 'success';
  } else if (status.toLowerCase().includes('approved')) {
    variant = 'info';
  }

  return <Badge label={status} variant={variant} />;
}

/**
 * Type Badge - Shows customer/work type
 */
export function TypeBadge({ type }: { type: string }) {
  let variant: BadgeProps['variant'] = 'default';

  if (type === 'Monthly') {
    variant = 'primary';
  } else if (type === 'Invoice') {
    variant = 'info';
  } else if (type === 'Party-Credit') {
    variant = 'warning';
  } else if (type === 'Cash') {
    variant = 'success';
  }

  return <Badge label={type} variant={variant} />;
}
