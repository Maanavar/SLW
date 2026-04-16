import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { DataTable, Column } from '@/components/ui/DataTable';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { JobCardEditOverlay } from '@/components/job-card/JobCardEditOverlay';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobCardPaymentSummary, getJobPaidAmount } from '@/lib/jobUtils';
import type { PaymentBreakdown } from '@/components/ui/StatCard';
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

type HistoryViewMode = 'cards' | 'table';
type PaymentFilter = 'all' | 'paid' | 'unpaid';

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getCardStatusClass(status: 'Paid' | 'Pending' | 'Partially Paid'): string {
  if (status === 'Paid') return 'history-job-card--paid';
  if (status === 'Partially Paid') return 'history-job-card--partial';
  return 'history-job-card--pending';
}

export function HistoryScreen() {
  const navigate = useNavigate();
  const { jobs, getCustomer, deleteJob } = useDataStore();
  const toast = useToast();
  const today = getLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<HistoryViewMode>('cards');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');

  const jobsInRange = getJobsInRange(jobs, selectedDate, selectedDate);
  const groups = groupJobsByCard(jobsInRange);
  const filteredGroups = useMemo(
    () =>
      groups.filter((group) => {
        if (paymentFilter === 'all') {
          return true;
        }

        const status = getJobCardPaymentSummary(group.jobs).status;
        return paymentFilter === 'paid' ? status === 'Paid' : status !== 'Paid';
      }),
    [groups, paymentFilter]
  );

  const rows: CardHistoryRow[] = useMemo(
    () =>
      filteredGroups.map((group) => {
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
    [filteredGroups, getCustomer]
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

    if (!confirmed) return;

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
    { key: 'workSummary', label: 'Works', render: (value) => String(value) },
    { key: 'finalBill', label: 'Final Bill', render: (value) => formatCurrency(value as number) },
    { key: 'commission', label: 'Commission', render: (value) => formatCurrency(value as number) },
    { key: 'ourNet', label: 'Our Net', render: (value) => formatCurrency(value as number) },
    { key: 'paid', label: 'Paid', render: (value) => formatCurrency(value as number) },
    { key: 'pending', label: 'Pending', render: (value) => formatCurrency(value as number) },
    {
      key: 'paymentStatus',
      label: 'Status',
      render: (value) => <StatusBadge status={value as string} />,
    },
  ];

  const summary = useMemo(
    () => ({
      totalCards: rows.length,
      totalNetIncome: rows.reduce((sum, row) => sum + row.ourNet, 0),
      totalValue: rows.reduce((sum, row) => sum + row.finalBill, 0),
      totalPaid: rows.reduce((sum, row) => sum + row.paid, 0),
      totalPending: rows.reduce((sum, row) => sum + row.pending, 0),
    }),
    [rows]
  );

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const dateSort = b.date.localeCompare(a.date);
        if (dateSort !== 0) return dateSort;
        return b.jobCardId.localeCompare(a.jobCardId);
      }),
    [rows]
  );

  const isToday = selectedDate === today;

  const [showReceivedBreakdown, setShowReceivedBreakdown] = useState(false);

  const receivedBreakdown = useMemo<PaymentBreakdown>(() => {
    const bd: PaymentBreakdown = { cash: 0, upi: 0, bank: 0, cheque: 0 };
    filteredGroups.forEach((group) => {
      group.jobs.forEach((job) => {
        const paid = getJobPaidAmount(job);
        if (paid > 0 && job.paymentMode) {
          if (job.paymentMode === 'Cash') bd.cash = (bd.cash || 0) + paid;
          else if (job.paymentMode === 'UPI') bd.upi = (bd.upi || 0) + paid;
          else if (job.paymentMode === 'Bank') bd.bank = (bd.bank || 0) + paid;
          else if (job.paymentMode === 'Cheque') bd.cheque = (bd.cheque || 0) + paid;
        }
      });
    });
    return bd;
  }, [filteredGroups]);

  const hasReceivedBreakdown = Boolean(
    receivedBreakdown.cash || receivedBreakdown.upi || receivedBreakdown.bank || receivedBreakdown.cheque
  );

  return (
    <div className="customers-screen history-screen">
      {/* Header */}
      <div className="history-header">
        <div className="history-header-top">
          <div className="history-title-block">
            <h2 className="screen-title">Job History</h2>
            <p className="history-subtitle">
              Review daily job cards with quick filters and layout controls.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/')} type="button">
            + Create JobCard
          </button>
        </div>

        <div className="history-toolbar">
          <div className="history-date-panel">
            <span className="history-control-label">Date</span>
            <div className="history-date-nav">
              <button
                className="history-date-nav-btn"
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                type="button"
                aria-label="Previous day"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 3L5 8L10 13"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <div className="history-date-control">
                <input
                  id="history-date-input"
                  type="date"
                  className="history-date-input"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={today}
                  aria-label="Select history date"
                />
                <span className="history-date-readable">
                  {isToday ? 'Today - ' : ''}
                  {formatDisplayDate(selectedDate)}
                </span>
              </div>

              <button
                className="history-date-nav-btn"
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                type="button"
                disabled={selectedDate >= today}
                aria-label="Next day"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 3L11 8L6 13"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {!isToday && (
                <button
                  className="history-today-btn"
                  onClick={() => setSelectedDate(today)}
                  type="button"
                >
                  Today
                </button>
              )}
            </div>
          </div>

          <div className="history-toolbar-right">
            <div className="history-control-group">
              <span className="history-control-label">Payment</span>
              <div className="history-view-toggle">
                <button
                  className={`history-view-btn ${paymentFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setPaymentFilter('all')}
                  type="button"
                  aria-pressed={paymentFilter === 'all'}
                >
                  All
                </button>
                <button
                  className={`history-view-btn ${paymentFilter === 'paid' ? 'active' : ''}`}
                  onClick={() => setPaymentFilter('paid')}
                  type="button"
                  aria-pressed={paymentFilter === 'paid'}
                >
                  Paid
                </button>
                <button
                  className={`history-view-btn ${paymentFilter === 'unpaid' ? 'active' : ''}`}
                  onClick={() => setPaymentFilter('unpaid')}
                  type="button"
                  aria-pressed={paymentFilter === 'unpaid'}
                >
                  Unpaid
                </button>
              </div>
            </div>

            <div className="history-control-group">
              <span className="history-control-label">Layout</span>
              <div className="history-view-toggle">
                <button
                  className={`history-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  type="button"
                  aria-pressed={viewMode === 'cards'}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="0.5" y="0.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                    <rect x="8" y="0.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                    <rect x="0.5" y="8" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                    <rect x="8" y="8" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                  </svg>
                  Cards
                </button>
                <button
                  className={`history-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  type="button"
                  aria-pressed={viewMode === 'table'}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="0.5" y="0.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                    <line x1="0.5" y1="4.5" x2="13.5" y2="4.5" stroke="currentColor" strokeWidth="1.25" />
                    <line x1="0.5" y1="8.5" x2="13.5" y2="8.5" stroke="currentColor" strokeWidth="1.25" />
                  </svg>
                  Table
                </button>
              </div>
            </div>

            <span className="history-results-pill">{rows.length} cards</span>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      {rows.length > 0 && (
        <div className="history-summary">
          <div className="history-summary-stat history-summary-stat--blue">
            <span className="history-summary-label">Job Cards</span>
            <span className="history-summary-value">{summary.totalCards}</span>
          </div>
          <div className="history-summary-stat history-summary-stat--indigo">
            <span className="history-summary-label">Net Income</span>
            <span className="history-summary-value">{formatCurrency(summary.totalNetIncome)}</span>
          </div>
          <div className="history-summary-stat history-summary-stat--slate">
            <span className="history-summary-label">Total Bill</span>
            <span className="history-summary-value">{formatCurrency(summary.totalValue)}</span>
          </div>
          <div
            className={`history-summary-stat history-summary-stat--green${hasReceivedBreakdown ? ' history-summary-stat--hoverable' : ''}`}
            onMouseEnter={() => hasReceivedBreakdown && setShowReceivedBreakdown(true)}
            onMouseLeave={() => setShowReceivedBreakdown(false)}
          >
            <span className="history-summary-label">Received</span>
            <span className="history-summary-value">{formatCurrency(summary.totalPaid)}</span>
            {hasReceivedBreakdown && showReceivedBreakdown && (
              <div className="history-summary-breakdown">
                <div className="breakdown-header">Payment Breakdown</div>
                <div className="breakdown-items">
                  {(receivedBreakdown.cash || 0) > 0 && (
                    <div className="breakdown-item">
                      <span className="breakdown-label">Cash</span>
                      <span className="breakdown-value">{formatCurrency(receivedBreakdown.cash || 0)}</span>
                    </div>
                  )}
                  {(receivedBreakdown.upi || 0) > 0 && (
                    <div className="breakdown-item">
                      <span className="breakdown-label">UPI</span>
                      <span className="breakdown-value">{formatCurrency(receivedBreakdown.upi || 0)}</span>
                    </div>
                  )}
                  {(receivedBreakdown.bank || 0) > 0 && (
                    <div className="breakdown-item">
                      <span className="breakdown-label">Bank</span>
                      <span className="breakdown-value">{formatCurrency(receivedBreakdown.bank || 0)}</span>
                    </div>
                  )}
                  {(receivedBreakdown.cheque || 0) > 0 && (
                    <div className="breakdown-item">
                      <span className="breakdown-label">Cheque</span>
                      <span className="breakdown-value">{formatCurrency(receivedBreakdown.cheque || 0)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="history-summary-stat history-summary-stat--red">
            <span className="history-summary-label">Outstanding</span>
            <span className="history-summary-value">{formatCurrency(summary.totalPending)}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="screen-content">
        {viewMode === 'cards' ? (
          sortedRows.length > 0 ? (
            <div className="history-job-cards-grid">
              {sortedRows.map((row) => (
                <div
                  key={row.id}
                  className={`history-job-card ${getCardStatusClass(row.paymentStatus)}`}
                  onClick={() => setSelectedCardId(row.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCardId(row.id);
                    }
                  }}
                >
                  {/* Card Header */}
                  <div className="history-job-card-header">
                    <div className="history-job-card-title-group">
                      <h3 className="history-job-card-title">{row.customerName}</h3>
                      <div className="history-job-card-meta">
                        <span className="history-job-card-id">{row.jobCardId}</span>
                        <span className="history-job-card-dot" />
                        <span className="history-job-card-lines">
                          {row.lineCount} line{row.lineCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={row.paymentStatus} />
                  </div>

                  {/* Work Tags */}
                  {row.workSummary ? (
                    <div className="history-job-card-tags">
                      {row.workSummary.split(', ').map((tag) => (
                        <span key={tag} className="history-job-card-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {/* Financials */}
                  <div className="history-job-card-financials">
                    <div className="history-job-card-fin">
                      <span className="history-job-card-fin-label">Final Bill</span>
                      <span className="history-job-card-fin-value">{formatCurrency(row.finalBill)}</span>
                    </div>
                    <div className="history-job-card-fin">
                      <span className="history-job-card-fin-label">Our Net</span>
                      <span className="history-job-card-fin-value history-job-card-fin-value--net">
                        {formatCurrency(row.ourNet)}
                      </span>
                    </div>
                    <div className="history-job-card-fin">
                      <span className="history-job-card-fin-label">Paid</span>
                      <span className="history-job-card-fin-value history-job-card-fin-value--paid">
                        {formatCurrency(row.paid)}
                      </span>
                    </div>
                    <div className="history-job-card-fin">
                      <span className="history-job-card-fin-label">Pending</span>
                      <span className="history-job-card-fin-value history-job-card-fin-value--pending">
                        {formatCurrency(row.pending)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="history-empty">
              <svg className="history-empty-icon" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
                <line x1="15" y1="16" x2="33" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="15" y1="23" x2="33" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="15" y1="30" x2="24" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="history-empty-title">
                {paymentFilter === 'all'
                  ? 'No job cards for this date'
                  : paymentFilter === 'paid'
                    ? 'No paid job cards for this date'
                    : 'No unpaid job cards for this date'}
              </p>
              <p className="history-empty-sub">
                Try a different date/filter or create a new job card
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/')} type="button">
                Create JobCard
              </button>
            </div>
          )
        ) : (
          <DataTable<CardHistoryRow>
            columns={columns}
            data={rows}
            keyFn={(item) => item.id}
            sortBy="date"
            sortOrder="desc"
            onRowClick={(row) => setSelectedCardId(row.id)}
            emptyMessage={
              paymentFilter === 'all'
                ? 'No JobCards found for selected date'
                : paymentFilter === 'paid'
                  ? 'No paid JobCards found for selected date'
                  : 'No unpaid JobCards found for selected date'
            }
          />
        )}
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
        onSave={() => setEditingCardId(null)}
      />
    </div>
  );
}
