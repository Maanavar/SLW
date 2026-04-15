/**
 * useToast Hook - Custom hook for showing toast notifications
 * Wraps the UI store's toast functionality
 */

import { useUIStore } from '@/stores/uiStore';

export function useToast() {
  const addToast = useUIStore((state) => state.addToast);

  return {
    /**
     * Show a success toast
     */
    success: (title: string, message: string) => {
      addToast(title, message, 'success');
    },

    /**
     * Show an error toast
     */
    error: (title: string, message: string) => {
      addToast(title, message, 'error');
    },

    /**
     * Show an info toast
     */
    info: (title: string, message: string) => {
      addToast(title, message, 'info');
    },

    /**
     * Show a toast with custom type
     */
    show: (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
      addToast(title, message, type);
    },
  };
}
