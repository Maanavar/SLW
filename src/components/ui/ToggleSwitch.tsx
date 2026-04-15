/**
 * ToggleSwitch Component
 * Styled checkbox toggle for boolean values
 */

import './ToggleSwitch.css';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  id,
}: ToggleSwitchProps) {
  return (
    <div className="toggle-switch-wrapper">
      <label className="toggle-switch" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className="toggle-slider"></span>
        {label && <span className="toggle-label">{label}</span>}
      </label>
    </div>
  );
}
