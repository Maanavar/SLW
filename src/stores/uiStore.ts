/**
 * UI Store - Zustand store for managing UI state
 * Handles theme, modals, and toast notifications
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Toast, Modal } from '@/types';

/**
 * Generate a unique ID for toast notifications
 * Uses crypto.randomUUID() if available, falls back to timestamp + random
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${Math.random().toString(36).substring(2, 11)}`;
}

interface UIStore {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Modal
  modal: Modal;
  openModal: (type: 'customer' | 'worktype' | 'category', id?: number) => void;
  closeModal: () => void;

  // Toasts
  toasts: Toast[];
  addToast: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

/**
 * Create the UI store with persist middleware for theme persistence
 */
export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Theme state
      theme: 'light',

      toggleTheme: () => {
        set((state) => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark';
          applyThemeToDOM(newTheme);
          return { theme: newTheme };
        });
      },

      setTheme: (theme) => {
        applyThemeToDOM(theme);
        set({ theme });
      },

      // Sidebar state
      sidebarCollapsed: false,

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },

      // Modal state
      modal: {
        isOpen: false,
        type: null,
      },

      openModal: (type, id) => {
        set({
          modal: {
            isOpen: true,
            type,
            id,
          },
        });
      },

      closeModal: () => {
        set({
          modal: {
            isOpen: false,
            type: null,
          },
        });
      },

      // Toast state
      toasts: [],

      addToast: (title, message, type = 'success') => {
        const id = generateId();
        set((state) => ({
          toasts: [...state.toasts, { id, title, message, type }],
        }));
        // Note: Auto-removal is now handled by the Toast component itself
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      clearToasts: () => {
        set({ toasts: [] });
      },
    }),
    {
      name: 'siva_ui',
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
);

/**
 * Apply theme to DOM
 * Matches the theme-init script logic from vanilla app
 */
function applyThemeToDOM(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

// Subscribe to theme changes and sync to localStorage
useUIStore.subscribe((state) => {
  try {
    localStorage.setItem('siva_theme', state.theme);
    applyThemeToDOM(state.theme);
  } catch (error) {
    console.error('Failed to save theme preference:', error);
  }
});

// Initialize theme from localStorage on mount (HTML script handles initial DOM setup)
if (typeof document !== 'undefined') {
  try {
    const savedTheme = localStorage.getItem('siva_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      useUIStore.setState({ theme: savedTheme });
    }
  } catch (error) {
    console.error('Failed to load theme preference:', error);
  }
}
