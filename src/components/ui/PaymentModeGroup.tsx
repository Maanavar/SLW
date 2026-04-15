/**
 * PaymentModeGroup Component
 * Toggle buttons for selecting payment mode (Cash/UPI/Bank/Cheque)
 */

import './PaymentModeGroup.css';

type PaymentMode = 'cash' | 'upi' | 'bank' | 'cheque';

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
];

export function PaymentModeGroup({
  value,
  onChange,
  disabled = false,
}: PaymentModeGroupProps) {
  return (
    <div className="payment-mode-group">
      {modes.map((mode) => (
        <button
          key={mode.id}
          className={`payment-mode-btn ${value === mode.id ? 'active' : ''}`}
          onClick={() => onChange(mode.id)}
          disabled={disabled}
          type="button"
          title={`Select ${mode.label}`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
