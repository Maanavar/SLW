import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useDataStore } from '@/stores/dataStore';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopHeader } from '@/components/layout/TopHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { CustomerModal } from '@/components/modals/CustomerModal';
import { WorkTypeModal } from '@/components/modals/WorkTypeModal';
import { CategoryModal } from '@/components/modals/CategoryModal';
import './App.css';

export default function App() {
  const { sidebarCollapsed } = useUIStore();
  const initializeData = useDataStore((state) => state.initializeData);

  useEffect(() => {
    void initializeData();
  }, [initializeData]);

  return (
    <div className="app-container">
      <Sidebar />

      <div className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
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
    </div>
  );
}
