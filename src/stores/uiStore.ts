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

  // Sidebar (desktop only)
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Mobile drawer (tablet/phone overlay nav — not persisted)
  mobileDrawerOpen: boolean;
  openMobileDrawer: () => void;
  closeMobileDrawer: () => void;

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
          syncLegacyThemeKey(newTheme);
          return { theme: newTheme };
        });
      },

      setTheme: (theme) => {
        applyThemeToDOM(theme);
        syncLegacyThemeKey(theme);
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

      // Mobile drawer state (not persisted — always starts closed)
      mobileDrawerOpen: false,

      openMobileDrawer: () => {
        set({ mobileDrawerOpen: true });
      },

      closeMobileDrawer: () => {
        set({ mobileDrawerOpen: false });
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
      name: 'slw_ui_v1',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

function applyThemeToDOM(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

// Keep the legacy siva_theme key in sync so any non-React code that reads it stays correct.
function syncLegacyThemeKey(theme: 'light' | 'dark') {
  try {
    localStorage.setItem('siva_theme', theme);
  } catch {
    // ignore — non-critical
  }
}

// On startup: migrate theme from legacy keys if the persist store doesn't have one yet.
// The persist middleware (slw_ui_v1) is the authoritative store going forward.
if (typeof document !== 'undefined') {
  try {
    const persistedRaw = localStorage.getItem('slw_ui_v1');
    const alreadyHasTheme = persistedRaw && JSON.parse(persistedRaw)?.state?.theme;
    if (!alreadyHasTheme) {
      const legacyTheme = localStorage.getItem('siva_theme');
      if (legacyTheme === 'light' || legacyTheme === 'dark') {
        useUIStore.getState().setTheme(legacyTheme);
      }
    }
  } catch {
    // ignore parse errors — default theme will be used
  }
}
