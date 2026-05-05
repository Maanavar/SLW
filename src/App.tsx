import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useDataStore } from '@/stores/dataStore';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopHeader } from '@/components/layout/TopHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { CustomerModal } from '@/components/modals/CustomerModal';
import { WorkTypeModal } from '@/components/modals/WorkTypeModal';
import { CategoryModal } from '@/components/modals/CategoryModal';
import { SessionTimeoutModal } from '@/components/ui/SessionTimeoutModal';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { apiClient } from '@/lib/apiClient';
import './App.css';

export default function App() {
  const { sidebarCollapsed, mobileDrawerOpen, closeMobileDrawer } = useUIStore();
  const initializeData = useDataStore((state) => state.initializeData);
  const location = useLocation();
  const navigate = useNavigate();
  const hasRestoredRoute = useRef(false);

  const handleSessionLogout = useCallback(async () => {
    await apiClient.logout();
    window.dispatchEvent(new Event('slw-auth-changed'));
    navigate('/login', { replace: true });
  }, [navigate]);

  const { showWarning, secondsLeft, stayActive } = useSessionTimeout(handleSessionLogout);

  useEffect(() => {
    void initializeData();
  }, [initializeData]);

  useEffect(() => {
    const key = 'slw_ui_v1.lastRoute';
    if (!hasRestoredRoute.current) {
      hasRestoredRoute.current = true;
      if (location.pathname === '/') {
        try {
          const lastRoute = localStorage.getItem(key);
          if (lastRoute && lastRoute !== '/' && lastRoute !== '/login') {
            navigate(lastRoute, { replace: true });
            return;
          }
        } catch (error) {
          console.error('Failed to restore route:', error);
        }
      }
    }

    try {
      if (location.pathname !== '/login') {
        localStorage.setItem(key, location.pathname);
      }
    } catch (error) {
      console.error('Failed to persist route:', error);
    }
  }, [location.pathname, navigate]);

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />

      {/* Backdrop — dims content when mobile drawer is open, tap to close */}
      {mobileDrawerOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={closeMobileDrawer}
          aria-hidden="true"
        />
      )}

      <div className="app-main">
        <TopHeader />

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <MobileNav />

      <ToastContainer />

      <CustomerModal />
      <WorkTypeModal />
      <CategoryModal />

      {showWarning && (
        <SessionTimeoutModal
          secondsLeft={secondsLeft}
          onStayActive={stayActive}
          onLogout={() => void handleSessionLogout()}
        />
      )}
    </div>
  );
}
