import './QuantityStepper.css';
import type { ChangeEvent } from 'react';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  inputLabel?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  disabled = false,
  inputLabel = 'Quantity',
}: QuantityStepperProps) {
  const handleDecrease = () => {
    onChange(Math.max(min, value - step));
  };

  const handleIncrease = () => {
    onChange(Math.min(max, value + step));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10) || 0;
    if (newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  return (
    <div className="quantity-stepper">
      <button
        className="stepper-btn stepper-minus"
        onClick={handleDecrease}
        disabled={disabled || value <= min}
        title="Decrease quantity"
        aria-label="Decrease quantity"
        type="button"
      >
        -
      </button>
      <input
        type="number"
        className="stepper-input"
        value={value}
        onChange={handleInputChange}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={inputLabel}
      />
      <button
        className="stepper-btn stepper-plus"
        onClick={handleIncrease}
        disabled={disabled || value >= max}
        title="Increase quantity"
        aria-label="Increase quantity"
        type="button"
      >
        +
      </button>
    </div>
  );
}
