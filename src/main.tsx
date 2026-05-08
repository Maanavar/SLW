import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import ENV from './lib/envConfig';
import { AppErrorBoundary } from './components/ui/AppErrorBoundary';
import { ScreenErrorBoundary } from './components/ui/ScreenErrorBoundary';
import { RequireAuth } from './components/auth/RequireAuth';
import './styles/index.css';

const App = React.lazy(() => import('./App'));
const LoginScreen = React.lazy(() =>
  import('./screens/auth/LoginScreen').then((module) => ({ default: module.LoginScreen }))
);
const JobsScreen = React.lazy(() =>
  import('./screens/jobs/JobsScreen').then((module) => ({ default: module.JobsScreen }))
);
const DashboardScreen = React.lazy(() =>
  import('./screens/dashboard/DashboardScreen').then((module) => ({ default: module.DashboardScreen }))
);
const CustomersScreen = React.lazy(() =>
  import('./screens/customers/CustomersScreen').then((module) => ({ default: module.CustomersScreen }))
);
const WorkTypesScreen = React.lazy(() =>
  import('./screens/worktypes/WorkTypesScreen').then((module) => ({ default: module.WorkTypesScreen }))
);
const PaymentsScreen = React.lazy(() =>
  import('./screens/payments/PaymentsScreen').then((module) => ({ default: module.PaymentsScreen }))
);
const HistoryScreen = React.lazy(() =>
  import('./screens/history/HistoryScreen').then((module) => ({ default: module.HistoryScreen }))
);
const RecordsScreen = React.lazy(() =>
  import('./screens/records/RecordsScreen').then((module) => ({ default: module.RecordsScreen }))
);
const FinanceReports = React.lazy(() =>
  import('./screens/FinanceReports').then((module) => ({ default: module.FinanceReports }))
);
const ExpenseManager = React.lazy(() =>
  import('./screens/ExpenseManager').then((module) => ({ default: module.ExpenseManager }))
);
const CommissionDcScreen = React.lazy(() =>
  import('./screens/commission-dc/CommissionDcScreen').then((module) => ({ default: module.CommissionDcScreen }))
);
const LoggerScreen = React.lazy(() =>
  import('./screens/logger/LoggerScreen').then((module) => ({ default: module.LoggerScreen }))
);
const InvoiceScreen = React.lazy(() =>
  import('./screens/invoice/InvoiceScreen').then((module) => ({ default: module.InvoiceScreen }))
);
const OwnerReportScreen = React.lazy(() =>
  import('./screens/owner-report/OwnerReportScreen').then((module) => ({ default: module.OwnerReportScreen }))
);
const FollowUpsScreen = React.lazy(() =>
  import('./screens/followups/FollowUpsScreen').then((module) => ({ default: module.FollowUpsScreen }))
);

function LoadingScreen() {
  return (
    <div className="auth-check-screen">
      <p>Loading...</p>
    </div>
  );
}

function withLazyBoundary(screenName: string, element: React.ReactNode) {
  return (
    <React.Suspense fallback={<LoadingScreen />}>
      <ScreenErrorBoundary screenName={screenName}>{element}</ScreenErrorBoundary>
    </React.Suspense>
  );
}

if (ENV.sentryDsn) {
  Sentry.init({
    dsn: ENV.sentryDsn,
    environment: ENV.isProduction ? 'production' : 'development',
    tracesSampleRate: ENV.isProduction ? 0.1 : 1.0,
  });
}

const router = createHashRouter([
  {
    path: '/login',
    element: (
      <React.Suspense fallback={<LoadingScreen />}>
        <LoginScreen />
      </React.Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <React.Suspense fallback={<LoadingScreen />}>
          <App />
        </React.Suspense>
      </RequireAuth>
    ),
    children: [
      {
        path: '/',
        element: withLazyBoundary('Jobs', <JobsScreen />),
      },
      {
        path: '/dashboard',
        element: withLazyBoundary('Dashboard', <DashboardScreen />),
      },
      {
        path: '/customers',
        element: withLazyBoundary('Customers', <CustomersScreen />),
      },
      {
        path: '/work-types',
        element: withLazyBoundary('Work Types', <WorkTypesScreen />),
      },
      {
        path: '/payments',
        element: withLazyBoundary('Payments', <PaymentsScreen />),
      },
      {
        path: '/history',
        element: withLazyBoundary('History', <HistoryScreen />),
      },
      {
        path: '/records',
        element: withLazyBoundary('Records', <RecordsScreen />),
      },
      {
        path: '/finance',
        element: withLazyBoundary('Audit', <FinanceReports />),
      },
      {
        path: '/expenses',
        element: withLazyBoundary('Expenses', <ExpenseManager />),
      },
      {
        path: '/commission-dc',
        element: withLazyBoundary('Commission DC', <CommissionDcScreen />),
      },
      {
        path: '/logger',
        element: withLazyBoundary('Logger', <LoggerScreen />),
      },
      {
        path: '/invoice',
        element: withLazyBoundary('Invoice', <InvoiceScreen />),
      },
      {
        path: '/owner-report',
        element: withLazyBoundary('Monthly Audit', <OwnerReportScreen />),
      },
      {
        path: '/follow-ups',
        element: withLazyBoundary('Follow-ups', <FollowUpsScreen />),
      },
    ],
  },
]);

async function clearSlwCaches() {
  if (!('caches' in window)) {
    return;
  }

  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('slw-'))
        .map((key) => caches.delete(key))
    );
  } catch (error) {
    if (ENV.isDevelopment) {
      console.warn('Failed to clear SLW caches:', error);
    }
  }
}

async function unregisterAllServiceWorkers() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    if (ENV.isDevelopment) {
      console.warn('Failed to unregister service workers:', error);
    }
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (ENV.isProduction) {
      void navigator.serviceWorker.register('/sw.js');
      return;
    }

    // In development, stale service workers can cache Vite chunks and cause runtime hook errors.
    void unregisterAllServiceWorkers().then(() => clearSlwCaches());
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
