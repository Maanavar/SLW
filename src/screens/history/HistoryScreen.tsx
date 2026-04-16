import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { DataTable, Column } from '@/components/ui/DataTable';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { JobCardEditOverlay } from '@/components/job-card/JobCardEditOverlay';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobCardPaymentSummary } from '@/lib/jobUtils';
import { StatusBadge } from '@/components/ui/Badge';
import { getLocalDateString } from '@/lib/dateUtils';
import '../customers/CustomersScreen.css';
import './HistoryScreen.css';

interface CardHistoryRow {
  id: string;
  date: string;
  jobCardId: string;
  customerName: string;
  lineCount: number;
  workSummary: string;
  finalBill: number;
  commission: number;
  ourNet: number;
  paid: number;
  pending: number;
  paymentStatus: 'Paid' | 'Pending' | 'Partially Paid';
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

export function HistoryScreen() {
  const { jobs, getCustomer, deleteJob } = useDataStore();
  const toast = useToast();
  const today = getLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const jobsInRange = getJobsInRange(jobs, selectedDate, selectedDate);
  const groups = groupJobsByCard(jobsInRange);

  const rows: CardHistoryRow[] = useMemo(
    () =>
      groups.map((group) => {
        const customerName = getCustomer(group.primary.customerId)?.name || 'Unknown';
        const payment = getJobCardPaymentSummary(group.jobs);
        const commission = group.jobs.reduce(
          (sum, job) => sum + (Number(job.commissionAmount) || 0),
          0
        );
        const workSummary = group.jobs
          .map((job) => job.workTypeName)
          .filter((value, index, arr) => arr.indexOf(value) === index)
          .join(', ');

        return {
          id: group.key,
          date: group.primary.date,
          jobCardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
          customerName,
          lineCount: group.lineCount,
          workSummary,
          finalBill: payment.finalBill,
          commission,
          ourNet: payment.net,
          paid: payment.paid,
          pending: payment.pending,
          paymentStatus: payment.status,
        };
      }),
    [groups, getCustomer]
  );

  const selectedGroup = useMemo(
    () => groups.find((group) => group.key === selectedCardId) || null,
    [groups, selectedCardId]
  );

  const editingGroup = useMemo(
    () => groups.find((group) => group.key === editingCardId) || null,
    [groups, editingCardId]
  );

  const handleEditCard = () => {
    if (!selectedGroup) return;
    setEditingCardId(selectedGroup.key);
  };

  const handleDeleteCard = async () => {
    if (!selectedGroup) return;

    const cardId = selectedGroup.primary.jobCardId || `LEGACY-${selectedGroup.primary.id}`;
    const confirmed = window.confirm(
      `Are you sure you want to delete JobCard ${cardId}?\n\nThis will remove ${selectedGroup.jobs.length} job line(s) and cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(selectedGroup.jobs.map((job) => deleteJob(job.id)));
      toast.success('Success', `JobCard ${cardId} deleted`);
      setSelectedCardId(null);
    } catch (error) {
      console.error('Error deleting job card:', error);
      toast.error('Error', 'Failed to delete job card');
    }
  };

  const columns: Column<CardHistoryRow>[] = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'jobCardId', label: 'JobCard', sortable: true },
    { key: 'customerName', label: 'Customer', sortable: true },
    {
      key: 'workSummary',
      label: 'Works',
      render: (value) => String(value),
    },
    {
      key: 'finalBill',
      label: 'Final Bill',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'commission',
      label: 'Commission',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'ourNet',
      label: 'Our Net',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'paid',
      label: 'Paid',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'pending',
      label: 'Pending',
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'paymentStatus',
      label: 'Status',
      render: (value) => <StatusBadge status={value as string} />,
    },
  ];

  const summary = useMemo(
    () => ({
      totalCards: rows.length,
      totalValue: rows.reduce((sum, row) => sum + row.finalBill, 0),
      totalPaid: rows.reduce((sum, row) => sum + row.paid, 0),
      totalPending: rows.reduce((sum, row) => sum + row.pending, 0),
    }),
    [rows]
  );

  return (
    <div className="customers-screen">
      <div className="screen-header">
        <h2 className="screen-title">Job History</h2>
        <div className="screen-controls history-filters">
          <button
            className="btn btn-secondary"
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            type="button"
          >
            Prev Day
          </button>
          <div className="filter-group">
            <label className="filter-label" htmlFor="history-date">
              Date
            </label>
            <input
              id="history-date"
              type="date"
              className="search-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={today}
            />
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            type="button"
            disabled={selectedDate >= today}
          >
            Next Day
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setSelectedDate(today)}
            type="button"
          >
            Today
          </button>
        </div>
      </div>

      <div className="screen-content">
        {rows.length > 0 ? (
          <div className="history-summary">
            <div className="summary-item">
              <span className="summary-label">Total JobCards</span>
              <span className="summary-value">{summary.totalCards}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Final Bill</span>
              <span className="summary-value">{formatCurrency(summary.totalValue)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Paid</span>
              <span className="summary-value">{formatCurrency(summary.totalPaid)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Pending</span>
              <span className="summary-value">{formatCurrency(summary.totalPending)}</span>
            </div>
          </div>
        ) : null}

        <DataTable<CardHistoryRow>
          columns={columns}
          data={rows}
          keyFn={(item) => item.id}
          sortBy="date"
          sortOrder="desc"
          onRowClick={(row) => setSelectedCardId(row.id)}
          emptyMessage="No JobCards found for selected date"
        />
      </div>

      <JobCardDetailsModal
        isOpen={Boolean(selectedGroup)}
        jobs={selectedGroup?.jobs || null}
        onClose={() => setSelectedCardId(null)}
        getCustomer={getCustomer}
        onEdit={handleEditCard}
        onDelete={handleDeleteCard}
      />

      <JobCardEditOverlay
        isOpen={Boolean(editingGroup)}
        jobs={editingGroup?.jobs || null}
        onClose={() => setEditingCardId(null)}
        onSave={() => {
          setEditingCardId(null);
        }}
      />
    </div>
  );
}
