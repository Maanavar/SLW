import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { calculateWorkerCommissionSummary } from '@/lib/financeUtils';
import type { CommissionWorker, Job } from '@/types';
import './CommissionScreen.css';

type TabType = 'workers' | 'history';
type WorkerSortKey = 'customer' | 'outstanding' | 'status';
type WorkerJobCardDetail = {
  jobCardId: string;
  date: string;
  commission: number;
};

function resolveCommissionWorkerId(job: Job, workers: CommissionWorker[]): number | null {
  if (typeof job.commissionWorkerId === 'number') {
    return job.commissionWorkerId;
  }
  const workerName = job.commissionWorkerName?.trim();
  if (!workerName) return null;
  const normalizedWorkerName = workerName.toLowerCase();
  const matchedWorker = workers.find(
    (worker) => worker.customerId === job.customerId && worker.name.toLowerCase() === normalizedWorkerName
  );
  return matchedWorker?.id ?? null;
}

export function CommissionScreen() {
  const { jobs, commissionWorkers, commissionPayments, addCommissionPayment, deleteCommissionPayment, getCustomer } =
    useDataStore();
  const toast = useToast();
  const today = getLocalDateString(new Date());

  const [activeTab, setActiveTab] = useState<TabType>('workers');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [selectedWorkerForDetails, setSelectedWorkerForDetails] = useState<number | null>(null);
  const [workerSort, setWorkerSort] = useState<{ key: WorkerSortKey; order: 'asc' | 'desc' } | null>(
    null
  );

  const workerSummary = useMemo(
    () => calculateWorkerCommissionSummary(jobs, commissionPayments, commissionWorkers),
    [jobs, commissionPayments, commissionWorkers]
  );

  const workerJobCardDetails = useMemo(() => {
    const groupedByWorker = new Map<number, Map<string, WorkerJobCardDetail>>();
    jobs.forEach((job) => {
      const commission = Number(job.commissionAmount) || 0;
      if (commission <= 0) return;
      const workerId = resolveCommissionWorkerId(job, commissionWorkers);
      if (workerId === null) return;
      if (!groupedByWorker.has(workerId)) groupedByWorker.set(workerId, new Map<string, WorkerJobCardDetail>());
      const perWorkerMap = groupedByWorker.get(workerId)!;
      const cardId = job.jobCardId?.trim() || `LEGACY-${job.id}`;
      const detail = perWorkerMap.get(cardId);
      if (detail) {
        detail.commission += commission;
      } else {
        perWorkerMap.set(cardId, { jobCardId: cardId, date: job.date, commission });
      }
    });
    const normalized = new Map<number, WorkerJobCardDetail[]>();
    groupedByWorker.forEach((cardMap, workerId) => {
      normalized.set(workerId, Array.from(cardMap.values()).sort((a, b) => b.date.localeCompare(a.date) || b.commission - a.commission));
    });
    return normalized;
  }, [jobs, commissionWorkers]);

  const selectedWorkerSummary = useMemo(
    () => workerSummary.find((w) => w.workerId === selectedWorkerForDetails) ?? null,
    [workerSummary, selectedWorkerForDetails]
  );
  const selectedWorkerJobCards = useMemo(
    () => selectedWorkerForDetails === null ? [] : (workerJobCardDetails.get(selectedWorkerForDetails) ?? []),
    [workerJobCardDetails, selectedWorkerForDetails]
  );
  const workerRows = useMemo(
    () =>
      workerSummary.map((worker) => {
        const outstanding = worker.outstanding;
        return {
          ...worker,
          customerName: getCustomer(worker.customerId)?.name || '-',
          status: outstanding > 0 ? 'Pending' : 'Settled',
        };
      }),
    [workerSummary, getCustomer]
  );
  const sortedWorkerRows = useMemo(() => {
    if (!workerSort) return workerRows;
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base' });
    const direction = workerSort.order === 'asc' ? 1 : -1;
    return [...workerRows].sort((a, b) => {
      if (workerSort.key === 'customer') return collator.compare(a.customerName, b.customerName) * direction;
      if (workerSort.key === 'outstanding') return (a.outstanding - b.outstanding) * direction;
      const statusRank = { Pending: 0, Settled: 1 } as const;
      return (statusRank[a.status] - statusRank[b.status]) * direction;
    });
  }, [workerRows, workerSort]);
  const toggleWorkerSort = (key: WorkerSortKey) => {
    setWorkerSort((prev) =>
      prev && prev.key === key
        ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key === 'customer' ? 'asc' : 'desc' }
    );
  };
  const workerSortMark = (key: WorkerSortKey) => {
    if (!workerSort || workerSort.key !== key) return '↕';
    return workerSort.order === 'asc' ? '↑' : '↓';
  };

  const handleRecordPayment = async () => {
    if (!selectedWorker) { toast.error('Error', 'Please select a worker'); return; }
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) { toast.error('Error', 'Payment amount must be greater than 0'); return; }
    const worker = commissionWorkers.find((w) => w.id === selectedWorker);
    if (!worker) { toast.error('Error', 'Worker not found'); return; }
    setIsSubmitting(true);
    try {
      await addCommissionPayment({
        workerId: selectedWorker,
        workerName: worker.name,
        customerId: worker.customerId,
        jobIds: [],
        amount: parseFloat(paymentAmount),
        date: paymentDate,
        notes: paymentNotes || undefined,
      });
      toast.success('Success', 'Commission payment recorded successfully');
      setSelectedWorker(null);
      setPaymentAmount('');
      setPaymentDate(today);
      setPaymentNotes('');
      setShowPaymentForm(false);
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Error', 'Failed to record commission payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    try {
      await deleteCommissionPayment(paymentId);
      toast.success('Success', 'Payment deleted successfully');
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Error', 'Failed to delete payment');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const totalDue = workerSummary.reduce((s, w) => s + w.totalDue, 0);
  const totalPaid = workerSummary.reduce((s, w) => s + w.totalPaid, 0);
  const totalOutstanding = workerSummary.reduce((s, w) => s + w.outstanding, 0);

  return (
    <div className="comm-screen">

      {/* Row 1 – Header */}
      <div className="comm-pg-header">
        <div>
          <h1 className="comm-pg-title">Commission</h1>
          <p className="comm-pg-desc">Track commission workers and payments</p>
        </div>
        <button
          type="button"
          className="comm-record-btn"
          onClick={() => setShowPaymentForm(v => !v)}
        >
          {showPaymentForm ? 'Cancel' : '+ Record Payment'}
        </button>
      </div>

      {/* Row 2 – Stat tiles */}
      <div className="comm-stats">
        <div className="comm-stat">
          <span className="comm-stat-label">Total Commission</span>
          <span className="comm-stat-value">{formatCurrency(totalDue)}</span>
          <span className="comm-stat-sub">Owed to workers</span>
        </div>
        <div className="comm-stat comm-stat--green">
          <span className="comm-stat-label">Commission Paid</span>
          <span className="comm-stat-value">{formatCurrency(totalPaid)}</span>
          <span className="comm-stat-sub">Already distributed</span>
        </div>
        <div className={`comm-stat${totalOutstanding > 0 ? ' comm-stat--red' : ' comm-stat--green'}`}>
          <span className="comm-stat-label">Outstanding</span>
          <span className="comm-stat-value">{formatCurrency(totalOutstanding)}</span>
          <span className="comm-stat-sub">Still to pay</span>
        </div>
        <div className="comm-stat">
          <span className="comm-stat-label">Workers</span>
          <span className="comm-stat-value">{workerSummary.length}</span>
          <span className="comm-stat-sub">Configured</span>
        </div>
      </div>

      {/* Payment form (inline) */}
      {showPaymentForm && (
        <div className="comm-form-box">
          <div className="comm-form-title">Record Commission Payment</div>
          <div className="comm-form-grid">
            <div className="comm-field">
              <label className="comm-label" htmlFor="comm-worker">Worker</label>
              <select
                id="comm-worker"
                className="comm-select"
                value={selectedWorker ? String(selectedWorker) : ''}
                onChange={(e) => setSelectedWorker(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Select a worker...</option>
                {[...workerSummary]
                  .sort((a, b) => a.workerName.localeCompare(b.workerName))
                  .map((w) => (
                    <option key={w.workerId} value={String(w.workerId)}>
                      {w.workerName} ({getCustomer(w.customerId)?.shortCode || w.customerId})
                    </option>
                  ))}
              </select>
              {selectedWorker && (() => {
                const w = workerSummary.find((ws) => ws.workerId === selectedWorker);
                return w ? (
                  <p className="comm-hint">
                    Outstanding: <strong>{formatCurrency(w.outstanding)}</strong>
                    {w.outstanding <= 0 && <span className="comm-hint--settled"> · fully settled</span>}
                  </p>
                ) : null;
              })()}
            </div>
            <div className="comm-field">
              <label className="comm-label" htmlFor="comm-amount">Amount (₹)</label>
              <input
                id="comm-amount"
                type="number"
                className="comm-input"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div className="comm-field">
              <label className="comm-label" htmlFor="comm-date">Date</label>
              <input
                id="comm-date"
                type="date"
                className="comm-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                max={today}
              />
            </div>
            <div className="comm-field comm-field--full">
              <label className="comm-label" htmlFor="comm-notes">Notes (optional)</label>
              <textarea
                id="comm-notes"
                className="comm-textarea"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Add any notes..."
                rows={2}
              />
            </div>
          </div>
          <div className="comm-form-footer">
            <button type="button" className="comm-submit-btn" onClick={handleRecordPayment} disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      )}

      {/* Row 3 – Nav tabs */}
      <div className="comm-nav-tabs">
        <button type="button" className={`comm-nav-tab${activeTab === 'workers' ? ' active' : ''}`} onClick={() => setActiveTab('workers')}>Workers</button>
        <button type="button" className={`comm-nav-tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>Payment History</button>
      </div>

      {/* Workers tab */}
      {activeTab === 'workers' && (
        sortedWorkerRows.length === 0 ? (
          <div className="comm-empty">
            <p className="comm-empty-title">No commission workers configured</p>
            <p className="comm-empty-sub">Workers are configured per customer in the customer settings</p>
          </div>
        ) : (
          <div className="comm-table-wrap">
            <table className="comm-table">
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th
                    className={`slw-sortable-th${workerSort?.key === 'customer' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleWorkerSort('customer')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorkerSort('customer'); } }}
                  >
                    Customer {workerSortMark('customer')}
                  </th>
                  <th className="ta-r">Total Due</th>
                  <th className="ta-r">Total Paid</th>
                  <th
                    className={`ta-r slw-sortable-th${workerSort?.key === 'outstanding' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleWorkerSort('outstanding')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorkerSort('outstanding'); } }}
                  >
                    Outstanding {workerSortMark('outstanding')}
                  </th>
                  <th
                    className={`ta-c slw-sortable-th${workerSort?.key === 'status' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleWorkerSort('status')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorkerSort('status'); } }}
                  >
                    Status {workerSortMark('status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkerRows.map((worker) => (
                  <tr key={worker.workerId}>
                    <td>
                      <button
                        type="button"
                        className="comm-worker-link"
                        onClick={() => setSelectedWorkerForDetails(worker.workerId)}
                        title={`View commission details for ${worker.workerName}`}
                      >
                        {worker.workerName}
                      </button>
                    </td>
                    <td className="comm-td-muted">{worker.customerName}</td>
                    <td className="ta-r">{formatCurrency(worker.totalDue)}</td>
                    <td className="ta-r comm-td-green">{formatCurrency(worker.totalPaid)}</td>
                    <td className={`ta-r${worker.outstanding > 0 ? ' comm-td-red' : ' comm-td-green'}`}>{formatCurrency(worker.outstanding)}</td>
                    <td className="ta-c">
                      {worker.status === 'Pending'
                        ? <span className="comm-badge comm-badge--pending">Pending</span>
                        : <span className="comm-badge comm-badge--settled">Settled</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        commissionPayments.length === 0 ? (
          <div className="comm-empty">
            <p className="comm-empty-title">No commission payments recorded yet</p>
          </div>
        ) : (
          <div className="comm-table-wrap">
            <table className="comm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Worker</th>
                  <th className="ta-r">Amount</th>
                  <th>Notes</th>
                  <th className="ta-c">Action</th>
                </tr>
              </thead>
              <tbody>
                {[...commissionPayments]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((payment) => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.date).toLocaleDateString('en-IN')}</td>
                      <td className="fw-600">{payment.workerName}</td>
                      <td className="ta-r">{formatCurrency(payment.amount)}</td>
                      <td className="comm-td-muted">{payment.notes || '-'}</td>
                      <td className="ta-c">
                        {confirmDeleteId === payment.id ? (
                          <span className="comm-inline-confirm">
                            <span className="comm-confirm-text">Delete?</span>
                            <button type="button" className="comm-btn-yes" onClick={() => void handleDeletePayment(payment.id)}>Yes</button>
                            <button type="button" className="comm-btn-no" onClick={() => setConfirmDeleteId(null)}>No</button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="comm-icon-btn comm-icon-delete"
                            onClick={() => setConfirmDeleteId(payment.id)}
                            title="Delete payment"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Worker detail modal */}
      <Modal
        isOpen={selectedWorkerForDetails !== null}
        onClose={() => setSelectedWorkerForDetails(null)}
        title={selectedWorkerSummary ? `${selectedWorkerSummary.workerName} — Job Card Commission` : 'Worker Commission Details'}
        size="lg"
      >
        {selectedWorkerSummary ? (
          <div className="comm-detail">
            <div className="comm-detail-stats">
              <div className="comm-detail-stat">
                <span className="comm-detail-stat-label">Total Due</span>
                <strong className="comm-detail-stat-val">{formatCurrency(selectedWorkerSummary.totalDue)}</strong>
              </div>
              <div className="comm-detail-stat">
                <span className="comm-detail-stat-label">Total Paid</span>
                <strong className="comm-detail-stat-val comm-td-green">{formatCurrency(selectedWorkerSummary.totalPaid)}</strong>
              </div>
              <div className="comm-detail-stat">
                <span className="comm-detail-stat-label">Outstanding</span>
                <strong className={`comm-detail-stat-val${selectedWorkerSummary.outstanding > 0 ? ' comm-td-red' : ' comm-td-green'}`}>{formatCurrency(selectedWorkerSummary.outstanding)}</strong>
              </div>
            </div>

            {selectedWorkerJobCards.length === 0 ? (
              <div className="comm-empty"><p className="comm-empty-title">No job card commission entries found for this worker.</p></div>
            ) : (
              <div className="comm-table-wrap">
                <table className="comm-table">
                  <thead>
                    <tr>
                      <th>Job Card ID</th>
                      <th>Date</th>
                      <th className="ta-r">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWorkerJobCards.map((jc) => (
                      <tr key={jc.jobCardId}>
                        <td className="fw-600 comm-td-accent">{jc.jobCardId}</td>
                        <td>{new Date(jc.date).toLocaleDateString('en-IN')}</td>
                        <td className="ta-r">{formatCurrency(jc.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
