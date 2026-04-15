/**
 * ToastContainer Component
 * Portal-based toast notification container, manages toast queue from uiStore
 */

import ReactDOM from 'react-dom';
import { useUIStore } from '@/stores/uiStore';
import { Toast } from './Toast';
import './ToastContainer.css';

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  const toastRoot = document.getElementById('modal-root');
  if (!toastRoot) {
    console.warn('Toast root not found');
    return null;
  }

  const toastContent = (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onDismiss={removeToast}
        />
      ))}
    </div>
  );

  return ReactDOM.createPortal(toastContent, toastRoot);
}
