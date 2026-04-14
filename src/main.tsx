import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import App from './App';
import { DashboardScreen } from './screens/dashboard/DashboardScreen';
import { CustomersScreen } from './screens/customers/CustomersScreen';
import { WorkTypesScreen } from './screens/worktypes/WorkTypesScreen';
import { JobsScreen } from './screens/jobs/JobsScreen';
import { PaymentsScreen } from './screens/payments/PaymentsScreen';
import { HistoryScreen } from './screens/history/HistoryScreen';
import { ReportsScreen } from './screens/reports/ReportsScreen';
import './styles/index.css';

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: '/',
        element: <JobsScreen />,
      },
      {
        path: '/dashboard',
        element: <DashboardScreen />,
      },
      {
        path: '/customers',
        element: <CustomersScreen />,
      },
      {
        path: '/work-types',
        element: <WorkTypesScreen />,
      },
      {
        path: '/payments',
        element: <PaymentsScreen />,
      },
      {
        path: '/history',
        element: <HistoryScreen />,
      },
      {
        path: '/reports',
        element: <ReportsScreen />,
      },
    ],
  },
]);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
