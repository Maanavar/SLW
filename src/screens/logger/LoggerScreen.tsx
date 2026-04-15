import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityLog } from '@/types';
import { DataTable, Column } from '@/components/ui/DataTable';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/apiClient';
import { defaultCustomers, defaultWorkTypes } from '@/lib/seedData';
import { useDataStore } from '@/stores/dataStore';
import { useUIStore } from '@/stores/uiStore';
import '../customers/CustomersScreen.css';
import './LoggerScreen.css';

type PurgeAction =
  | 'jobs'
  | 'payments'
  | 'expenses'
  | 'customers'
  | 'workTypes'
  | 'allData';

export function LoggerScreen() {
  const toast = useToast();
  const addToast = useUIStore((state) => state.addToast);
  const refreshData = useDataStore((state) => state.refreshData);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [purging, setPurging] = useState<PurgeAction | null>(null);
  const [seeding, setSeeding] = useState(false);
  const isLoadingRef = useRef(false);
  const errorNotifiedRef = useRef(false);

  const loadLogs = useCallback(async () => {
    if (isLoadingRef.current) {
      return;
    }
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const response = await apiClient.getLogs({ limit: 500, offset: 0 });
      setLogs(response.items);
      errorNotifiedRef.current = false;
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      if (!errorNotifiedRef.current) {
        addToast('Error', 'Failed to load activity logs', 'error');
        errorNotifiedRef.current = true;
      }
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return logs;
    }

    return logs.filter((item) => {
      const text = [
        item.entityType,
        item.action,
        item.message || '',
        item.actorName || '',
        item.entityId || '',
      ]
        .join(' ')
        .toLowerCase();
      return text.includes(keyword);
    });
  }, [logs, query]);

  const ensureAdminKey = () => {
    if (apiClient.hasAdminApiKey()) {
      return true;
    }

    const key = window.prompt(
      'Enter Admin API Key (same as backend ADMIN_API_KEY)',
      ''
    );

    if (!key || !key.trim()) {
      toast.error('Error', 'Admin key is required for this operation');
      return false;
    }

    apiClient.setAdminApiKey(key.trim());
    return true;
  };

  const runPurge = async (action: PurgeAction) => {
    const confirmText = window.prompt(
      `Type DELETE ALL DATA to continue: ${action}`,
      ''
    );

    if (confirmText !== 'DELETE ALL DATA') {
      toast.info('Cancelled', 'Delete operation cancelled');
      return;
    }

    const scopeMap = {
      jobs: { jobs: true },
      payments: { payments: true },
      expenses: { expenses: true },
      customers: { customers: true },
      workTypes: { workTypes: true },
      allData: { allData: true },
    } as const;

    try {
      if (!ensureAdminKey()) {
        return;
      }

      setPurging(action);
      await apiClient.purgeData(scopeMap[action]);
      toast.success('Success', 'Delete operation completed');
      await refreshData();
      await loadLogs();
    } catch (error) {
      console.error('Purge failed:', error);
      const message = error instanceof Error ? error.message : 'Delete operation failed';
      if (message.toLowerCase().includes('x-admin-key') || message.includes('401')) {
        apiClient.clearAdminApiKey();
      }
      toast.error('Error', message);
    } finally {
      setPurging(null);
    }
  };

  const runDeleteAllLogs = async () => {
    const confirmText = window.prompt(
      'Type DELETE ALL LOGS to permanently delete all activity logs (cannot be undone)',
      ''
    );

    if (confirmText !== 'DELETE ALL LOGS') {
      toast.info('Cancelled', 'Delete operation cancelled');
      return;
    }

    try {
      if (!ensureAdminKey()) {
        return;
      }

      setPurging('jobs'); // Reuse purging state
      await apiClient.purgeData({ logs: true });
      toast.success('Success', 'All logs deleted successfully');
      await loadLogs();
    } catch (error) {
      console.error('Delete logs failed:', error);
      const message = error instanceof Error ? error.message : 'Delete operation failed';
      if (message.toLowerCase().includes('x-admin-key') || message.includes('401')) {
        apiClient.clearAdminApiKey();
      }
      toast.error('Error', message);
    } finally {
      setPurging(null);
    }
  };

  const runSeedImport = async () => {
    const confirmText = window.prompt(
      'Type REPLACE WITH SEED to replace existing DB data with seed customers/work types',
      ''
    );

    if (confirmText !== 'REPLACE WITH SEED') {
      toast.info('Cancelled', 'Seed import cancelled');
      return;
    }

    try {
      if (!ensureAdminKey()) {
        return;
      }

      setSeeding(true);
      await apiClient.importLegacyData({
        overwrite: true,
        customers: defaultCustomers,
        workTypes: defaultWorkTypes,
        jobs: [],
        payments: [],
        expenses: [],
      });
      toast.success(
        'Success',
        `Seed data imported (${defaultCustomers.length} customers, ${defaultWorkTypes.length} work types)`
      );
      await refreshData();
      await loadLogs();
    } catch (error) {
      console.error('Seed import failed:', error);
      const message = error instanceof Error ? error.message : 'Seed import failed';
      if (message.toLowerCase().includes('x-admin-key') || message.includes('401')) {
        apiClient.clearAdminApiKey();
      }
      toast.error('Error', message);
    } finally {
      setSeeding(false);
    }
  };

  const isDangerActionRunning = purging !== null || seeding;

  const columns: Column<ActivityLog>[] = [
    {
      key: 'createdAt',
      label: 'Time',
      sortable: true,
      render: (value) =>
        new Date(String(value)).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
    },
    {
      key: 'entityType',
      label: 'Entity',
      sortable: true,
    },
    {
      key: 'action',
      label: 'Action',
      sortable: true,
    },
    {
      key: 'actorName',
      label: 'Actor',
      render: (value) => String(value || 'System'),
    },
    {
      key: 'message',
      label: 'Message',
      render: (value) => String(value || '-'),
    },
  ];

  return (
    <div className="customers-screen logger-screen">
      <div className="screen-header">
        <h2 className="screen-title">Logger</h2>
        <div className="screen-controls logger-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search logs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={() => void loadLogs()} type="button">
            Refresh
          </button>
          <button
            className="btn btn-danger"
            onClick={() => void runDeleteAllLogs()}
            type="button"
            disabled={isDangerActionRunning}
            title="Delete all activity logs"
          >
            {purging === 'jobs' ? 'Deleting...' : 'Delete All Logs'}
          </button>
        </div>
      </div>

      <div className="screen-content">
        <DataTable<ActivityLog>
          columns={columns}
          data={filteredLogs}
          keyFn={(item) => item.id}
          sortBy="createdAt"
          sortOrder="desc"
          loading={loading}
          emptyMessage="No logs found"
        />

        <section className="danger-zone">
          <h3>Danger Zone</h3>
          <p>Use carefully. These actions permanently delete data.</p>
          <div className="danger-actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => void runPurge('jobs')}
            >
              {purging === 'jobs' ? 'Deleting...' : 'Delete All JobCards'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => void runPurge('payments')}
            >
              {purging === 'payments' ? 'Deleting...' : 'Delete All Payments'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => void runPurge('expenses')}
            >
              {purging === 'expenses' ? 'Deleting...' : 'Delete All Expenses'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => void runPurge('customers')}
            >
              {purging === 'customers' ? 'Deleting...' : 'Delete All Customers'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => void runPurge('workTypes')}
            >
              {purging === 'workTypes' ? 'Deleting...' : 'Delete All Work Types'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => void runSeedImport()}
            >
              {seeding ? 'Importing...' : 'Replace DB With Seed Data'}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-danger-strong"
              disabled={isDangerActionRunning}
              onClick={() => void runPurge('allData')}
            >
              {purging === 'allData' ? 'Deleting...' : 'Delete ALL Data'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
