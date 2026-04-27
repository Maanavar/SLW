import { useEffect } from 'react';
import './Toast.css';

interface ToastProps {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: (id: string) => void;
  duration?: number;
}

export function Toast({
  id,
  title,
  message,
  type,
  onDismiss,
  duration = 2400,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, onDismiss, duration]);

  const iconMap = {
    success: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="M22 4L12 14.01l-3-3" />
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    ),
    info: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  };

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <span className="toast-icon" aria-hidden="true">{iconMap[type]}</span>
      <div className="toast-content">
        <div className="toast-title">{title}</div>
        {message ? <div className="toast-message">{message}</div> : null}
      </div>
      <button
        className="toast-close"
        onClick={() => onDismiss(id)}
        type="button"
        title="Dismiss"
        aria-label={`Dismiss ${title}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
