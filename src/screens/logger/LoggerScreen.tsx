import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ActivityLog } from '@/types';
import { DataTable, Column } from '@/components/ui/DataTable';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/apiClient';
import { defaultCustomers, defaultWorkTypes } from '@/lib/seedData';
import { useDataStore } from '@/stores/dataStore';
import { useUIStore } from '@/stores/uiStore';
import './LoggerScreen.css';

type PurgeAction =
  | 'jobs'
  | 'payments'
  | 'expenses'
  | 'customers'
  | 'workTypes'
  | 'allData';

interface ConfirmState {
  action: PurgeAction | 'logs' | 'seed';
  title: string;
  description: string;
  confirmLabel: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  danger?: boolean;
}

interface LogTarget {
  path: string;
  label: string;
}

const ENTITY_TARGETS: Record<string, LogTarget> = {
  CUSTOMER: { path: '/customers', label: 'Customers' },
  WORK_TYPE: { path: '/work-types', label: 'Work Types' },
  JOB: { path: '/', label: 'Jobs' },
  PAYMENT: { path: '/payments', label: 'Payments' },
  EXPENSE: { path: '/expenses', label: 'Expenses' },
  COMMISSION_WORKER: { path: '/commission', label: 'Commission' },
  COMMISSION_PAYMENT: { path: '/commission', label: 'Commission' },
  SYSTEM: { path: '/logger', label: 'Logger' },
};

function formatJsonForDisplay(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getTargetForLog(log: ActivityLog): LogTarget | null {
  return ENTITY_TARGETS[log.entityType] || null;
}

function ConfirmModal({
  state,
  onConfirm,
  onCancel,
}: {
  state: ConfirmState;
  onConfirm: (inputValue: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const inputId = useId();

  return (
    <div className="logger-overlay" onClick={onCancel}>
      <div
        className="logger-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logger-modal-title"
      >
        <h3 id="logger-modal-title" className="logger-modal-title">
          {state.title}
        </h3>
        <p className="logger-modal-desc">{state.description}</p>
        {state.inputLabel ? (
          <div className="logger-modal-field">
            <label className="logger-modal-label" htmlFor={inputId}>
              {state.inputLabel}
            </label>
            <input
              id={inputId}
              autoFocus
              type="text"
              className="logger-modal-input"
              placeholder={state.inputPlaceholder ?? ''}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm(value);
                if (e.key === 'Escape') onCancel();
              }}
            />
          </div>
        ) : null}
        <div className="logger-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onConfirm(value)}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogDetailModal({
  log,
  onClose,
  onOpenTarget,
}: {
  log: ActivityLog;
  onClose: () => void;
  onOpenTarget: () => void;
}) {
  const target = getTargetForLog(log);
  const beforeJson = formatJsonForDisplay(log.before);
  const afterJson = formatJsonForDisplay(log.after);
  const metadataJson = formatJsonForDisplay(log.metadata);

  return (
    <div className="logger-overlay" onClick={onClose}>
      <div
        className="logger-modal logger-modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-detail-title"
      >
        <div className="logger-detail-header">
          <h3 id="log-detail-title" className="logger-modal-title">
            Log Entry #{log.id}
          </h3>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="logger-detail-grid">
          <p>
            <strong>Time:</strong>{' '}
            {new Date(log.createdAt).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
          <p>
            <strong>Entity:</strong> {log.entityType}
          </p>
          <p>
            <strong>Action:</strong> {log.action}
          </p>
          <p>
            <strong>Actor:</strong> {log.actorName || 'System'}
          </p>
          <p>
            <strong>Entity ID:</strong> {log.entityId || '-'}
          </p>
          <p>
            <strong>Message:</strong> {log.message || '-'}
          </p>
        </div>

        <div className="logger-detail-actions">
          {target ? (
            <button type="button" className="btn btn-primary" onClick={onOpenTarget}>
              Open {target.label}
            </button>
          ) : null}
          {log.entityId ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(log.entityId || '');
              }}
            >
              Copy Entity ID
            </button>
          ) : null}
        </div>

        {beforeJson ? (
          <section className="logger-json-block">
            <h4>Before</h4>
            <pre>{beforeJson}</pre>
          </section>
        ) : null}
        {afterJson ? (
          <section className="logger-json-block">
            <h4>After</h4>
            <pre>{afterJson}</pre>
          </section>
        ) : null}
        {metadataJson ? (
          <section className="logger-json-block">
            <h4>Metadata</h4>
            <pre>{metadataJson}</pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function LoggerScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const addToast = useUIStore((state) => state.addToast);
  const refreshData = useDataStore((state) => state.refreshData);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [purging, setPurging] = useState<PurgeAction | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const isLoadingRef = useRef(false);
  const errorNotifiedRef = useRef(false);
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null);
  const expectedPhraseRef = useRef('');

  const loadLogs = useCallback(async () => {
    if (isLoadingRef.current) {
      return;
    }
    if (apiClient.hasOfflineSession()) {
      setLoading(false);
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

  const entityOptions = useMemo(
    () => [...new Set(logs.map((log) => log.entityType))].sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const actionOptions = useMemo(
    () => [...new Set(logs.map((log) => log.action))].sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return logs.filter((item) => {
      if (entityFilter !== 'all' && item.entityType !== entityFilter) {
        return false;
      }
      if (actionFilter !== 'all' && item.action !== actionFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
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
  }, [logs, query, entityFilter, actionFilter]);

  const openLogTarget = (log: ActivityLog) => {
    const target = getTargetForLog(log);
    if (!target) {
      toast.info('No target', 'This log entry does not map to a screen');
      return;
    }

    const params = new URLSearchParams();
    params.set('fromLog', String(log.id));
    if (log.entityId) {
      params.set('focus', String(log.entityId));
    }
    navigate(`${target.path}?${params.toString()}`);
  };

  const requireConfirmThenRun = (
    confirmConfig: ConfirmState,
    expectedPhrase: string,
    action: () => Promise<void>
  ) => {
    pendingActionRef.current = action;
    setConfirmState(confirmConfig);
    expectedPhraseRef.current = expectedPhrase;
  };

  const handleConfirmSubmit = async (inputValue: string) => {
    if (!confirmState) {
      return;
    }

    if (inputValue !== expectedPhraseRef.current) {
      toast.error('Cancelled', 'Confirmation phrase did not match');
      setConfirmState(null);
      pendingActionRef.current = null;
      return;
    }

    setConfirmState(null);
    if (pendingActionRef.current) {
      await pendingActionRef.current();
      pendingActionRef.current = null;
    }
  };

  const handleConfirmCancel = () => {
    setConfirmState(null);
    pendingActionRef.current = null;
    toast.info('Cancelled', 'Operation cancelled');
  };

  const runPurge = (action: PurgeAction) => {
    const labelMap: Record<PurgeAction, string> = {
      jobs: 'all job cards',
      payments: 'all payments',
      expenses: 'all expenses',
      customers: 'all customers',
      workTypes: 'all work types',
      allData: 'ALL data',
    };

    const scopeMap = {
      jobs: { jobs: true },
      payments: { payments: true },
      expenses: { expenses: true },
      customers: { customers: true },
      workTypes: { workTypes: true },
      allData: { allData: true },
    } as const;

    requireConfirmThenRun(
      {
        action,
        title: `Delete ${labelMap[action]}`,
        description: `This will permanently delete ${labelMap[action]}. Type DELETE to confirm.`,
        confirmLabel: 'Delete',
        inputLabel: 'Type DELETE to confirm',
        inputPlaceholder: 'DELETE',
        danger: true,
      },
      'DELETE',
      async () => {
        setPurging(action);
        try {
          await apiClient.purgeData(scopeMap[action]);
          toast.success('Success', `Deleted ${labelMap[action]} successfully`);
          await refreshData();
          await loadLogs();
        } catch (error) {
          console.error('Purge failed:', error);
          const message = error instanceof Error ? error.message : 'Delete operation failed';
          toast.error('Error', message);
        } finally {
          setPurging(null);
        }
      }
    );
  };

  const runDeleteAllLogs = () => {
    requireConfirmThenRun(
      {
        action: 'logs',
        title: 'Delete All Logs',
        description:
          'This will permanently delete all activity logs and cannot be undone. Type DELETE to confirm.',
        confirmLabel: 'Delete Logs',
        inputLabel: 'Type DELETE to confirm',
        inputPlaceholder: 'DELETE',
        danger: true,
      },
      'DELETE',
      async () => {
        setPurging('jobs');
        try {
          await apiClient.purgeData({ logs: true });
          toast.success('Success', 'All logs deleted successfully');
          await loadLogs();
        } catch (error) {
          console.error('Delete logs failed:', error);
          const message = error instanceof Error ? error.message : 'Delete operation failed';
          toast.error('Error', message);
        } finally {
          setPurging(null);
        }
      }
    );
  };

  const runSeedImport = () => {
    requireConfirmThenRun(
      {
        action: 'seed',
        title: 'Replace with Seed Data',
        description:
          'This will replace existing customers and work types with seed data. Type REPLACE to confirm.',
        confirmLabel: 'Replace',
        inputLabel: 'Type REPLACE to confirm',
        inputPlaceholder: 'REPLACE',
        danger: true,
      },
      'REPLACE',
      async () => {
        setSeeding(true);
        try {
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
          toast.error('Error', message);
        } finally {
          setSeeding(false);
        }
      }
    );
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
      key: 'entityId',
      label: 'Entity ID',
      render: (value, row) =>
        value ? (
          <button
            type="button"
            className="logger-link-btn"
            onClick={(event) => {
              event.stopPropagation();
              openLogTarget(row);
            }}
          >
            {String(value)}
          </button>
        ) : (
          '-'
        ),
    },
    {
      key: 'actorName',
      label: 'Actor',
      render: (value) => String(value || 'System'),
    },
    {
      key: 'message',
      label: 'Message',
      render: (value) => (
        <span className="logger-message" title={String(value || '-')}>
          {String(value || '-')}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Details',
      render: (_value, row) => (
        <button
          type="button"
          className="logger-link-btn"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedLog(row);
          }}
        >
          Open
        </button>
      ),
    },
  ];

  return (
    <div className="lgr-screen">
      {confirmState ? (
        <ConfirmModal
          state={confirmState}
          onConfirm={(val) => void handleConfirmSubmit(val)}
          onCancel={handleConfirmCancel}
        />
      ) : null}

      {selectedLog ? (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onOpenTarget={() => {
            openLogTarget(selectedLog);
            setSelectedLog(null);
          }}
        />
      ) : null}

      <div className="lgr-pg-header">
        <div>
          <h1 className="lgr-pg-title">
            Logger <span className="lgr-pg-title-ta tamil">பதிவேடு</span>
          </h1>
          <p className="lgr-pg-desc">
            {filteredLogs.length} entr{filteredLogs.length !== 1 ? 'ies' : 'y'} · activity log and data management
          </p>
        </div>
        <div className="lgr-header-actions">
          <button className="btn btn-secondary" onClick={() => void loadLogs()} type="button">
            Refresh
          </button>
          <button
            className="btn btn-danger"
            onClick={() => runDeleteAllLogs()}
            type="button"
            disabled={isDangerActionRunning}
            title="Delete all activity logs"
          >
            {purging === 'jobs' ? 'Clearing...' : 'Clear Logs'}
          </button>
        </div>
      </div>

      <div className="lgr-toolbar">
        <input
          type="text"
          className="lgr-search"
          placeholder="Search logs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search logs"
        />
        <select
          className="lgr-select"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          aria-label="Filter by entity"
        >
          <option value="all">All Entities</option>
          {entityOptions.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </select>
        <select
          className="lgr-select"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Filter by action"
        >
          <option value="all">All Actions</option>
          {actionOptions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </div>

      <div className="lgr-content">
        <div className="lgr-table-wrap">
        <DataTable<ActivityLog>
          columns={columns}
          data={filteredLogs}
          keyFn={(item) => item.id}
          sortBy="createdAt"
          sortOrder="desc"
          loading={loading}
          emptyMessage={apiClient.hasOfflineSession() ? 'Logs unavailable in offline mode' : 'No logs found'}
          onRowClick={(row) => setSelectedLog(row)}
        />
        </div>

        <section className="danger-zone">
          <h3>Danger Zone</h3>
          <p>Use carefully. These actions permanently delete data and cannot be undone.</p>
          <div className="danger-actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => runPurge('jobs')}
            >
              {purging === 'jobs' ? 'Purging...' : 'Purge Jobs'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => runPurge('payments')}
            >
              {purging === 'payments' ? 'Purging...' : 'Purge Payments'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => runPurge('expenses')}
            >
              {purging === 'expenses' ? 'Purging...' : 'Purge Expenses'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => runPurge('customers')}
            >
              {purging === 'customers' ? 'Purging...' : 'Purge Customers'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => runPurge('workTypes')}
            >
              {purging === 'workTypes' ? 'Purging...' : 'Purge Work Types'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isDangerActionRunning}
              onClick={() => runSeedImport()}
            >
              {seeding ? 'Seeding...' : 'Seed Demo Data'}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-danger-strong"
              disabled={isDangerActionRunning}
              onClick={() => runPurge('allData')}
            >
              {purging === 'allData' ? 'Purging...' : 'Purge All'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
