/**
 * PaymentModeGroup Component
 * Segmented buttons for selecting payment mode
 */

import './PaymentModeGroup.css';

export type PaymentMode = 'cash' | 'upi' | 'bank' | 'cheque' | 'mixed';

interface PaymentModeGroupProps {
  value: PaymentMode;
  onChange: (mode: PaymentMode) => void;
  disabled?: boolean;
}

const modes: { id: PaymentMode; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'bank', label: 'Bank' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'mixed', label: 'Mixed' },
];

export function PaymentModeGroup({
  value,
  onChange,
  disabled = false,
}: PaymentModeGroupProps) {
  return (
    <div className="payment-mode-group" role="radiogroup" aria-label="Payment mode">
      {modes.map((mode) => (
        <button
          key={mode.id}
          className={`payment-mode-btn ${value === mode.id ? 'active' : ''}`}
          onClick={() => onChange(mode.id)}
          disabled={disabled}
          type="button"
          title={`Select ${mode.label}`}
          role="radio"
          aria-checked={value === mode.id}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
