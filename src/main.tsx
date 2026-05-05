import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import App from './App';
import { AppErrorBoundary } from './components/ui/AppErrorBoundary';
import { ScreenErrorBoundary } from './components/ui/ScreenErrorBoundary';
import { RequireAuth } from './components/auth/RequireAuth';
import { DashboardScreen } from './screens/dashboard/DashboardScreen';
import { CustomersScreen } from './screens/customers/CustomersScreen';
import { WorkTypesScreen } from './screens/worktypes/WorkTypesScreen';
import { JobsScreen } from './screens/jobs/JobsScreen';
import { PaymentsScreen } from './screens/payments/PaymentsScreen';
import { HistoryScreen } from './screens/history/HistoryScreen';
import { RecordsScreen } from './screens/records/RecordsScreen';
import { FinanceReports } from './screens/FinanceReports';
import { ExpenseManager } from './screens/ExpenseManager';
import { CommissionDcScreen } from './screens/commission-dc/CommissionDcScreen';
import { LoggerScreen } from './screens/logger/LoggerScreen';
import { InvoiceScreen } from './screens/invoice/InvoiceScreen';
import { OwnerReportScreen } from './screens/owner-report/OwnerReportScreen';
import { LoginScreen } from './screens/auth/LoginScreen';
import './styles/index.css';

const router = createHashRouter([
  {
    path: '/login',
    element: <LoginScreen />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    children: [
      {
        path: '/',
        element: <ScreenErrorBoundary screenName="Jobs"><JobsScreen /></ScreenErrorBoundary>,
      },
      {
        path: '/dashboard',
        element: <ScreenErrorBoundary screenName="Dashboard"><DashboardScreen /></ScreenErrorBoundary>,
      },
      {
        path: '/customers',
        element: <ScreenErrorBoundary screenName="Customers"><CustomersScreen /></ScreenErrorBoundary>,
      },
      {
        path: '/work-types',
        element: <ScreenErrorBoundary screenName="Work Types"><WorkTypesScreen /></ScreenErrorBoundary>,
      },
      {
        path: '/payments',
        element: <ScreenErrorBoundary screenName="Payments"><PaymentsScreen /></ScreenErrorBoundary>,
      },
      {
        path: '/history',
        element: <ScreenErrorBoundary screenName="History"><HistoryScreen /></ScreenErrorBoundary>,
      },
      {
        path: '/records',
        element: <ScreenErrorBoundary screenName="Records"><RecordsScreen /></ScreenErrorBoundary>,
      },
      {
        path: '/finance',
        element: <ScreenErrorBoundary screenName="Audit"><FinanceReports /></ScreenErrorBoundary>,
      },
      {
        path: '/expenses',
        element: <ScreenErrorBoundary screenName="Expenses"><ExpenseManager /></ScreenErrorBoundary>,
      },
      {
        path: '/commission-dc',
        element: <ScreenErrorBoundary screenName="Commission DC"><CommissionDcScreen /></ScreenErrorBoundary>,
      },
      {
        path: '/logger',
        element: <ScreenErrorBoundary screenName="Logger"><LoggerScreen /></ScreenErrorBoundary>,
      },
      {
        path: '/invoice',
        element: <ScreenErrorBoundary screenName="Invoice"><InvoiceScreen /></ScreenErrorBoundary>,
      },
      {
        path: '/owner-report',
        element: <ScreenErrorBoundary screenName="Monthly Audit"><OwnerReportScreen /></ScreenErrorBoundary>,
      },
    ],
  },
]);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  </React.StrictMode>
);
