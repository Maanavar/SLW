import { useEffect, useMemo, useState } from 'react';
import { type Job } from '@/types';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobFinalBillValue, getJobPaidAmount } from '@/lib/jobUtils';
import { type CustomerBalance } from './CustomerBalancesTable';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';

interface CustomerBillsOverlayProps {
  customer: CustomerBalance;
  jobs: Job[];
  onClose: () => void;
}

export function CustomerBillsOverlay({ customer, jobs, onClose }: CustomerBillsOverlayProps) {
  const { updateJob } = useDataStore();
  const toast = useToast();
  const [settlingJobId, setSettlingJobId] = useState<number | null>(null);
  const [isSettlingAll, setIsSettlingAll] = useState(false);
  const [settlementMode, setSettlementMode] = useState<'Cash' | 'UPI' | 'Bank' | 'Cheque'>('Cash');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const unsettledJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const due = Math.max(0, getJobFinalBillValue(job) - getJobPaidAmount(job));
        return due > 0.009;
      }),
    [jobs]
  );

  const sorted = useMemo(
    () => [...unsettledJobs].sort((a, b) => b.date.localeCompare(a.date)),
    [unsettledJobs]
  );

  const totalDue = useMemo(
    () => sorted.reduce((sum, job) => sum + Math.max(0, getJobFinalBillValue(job) - getJobPaidAmount(job)), 0),
    [sorted]
  );

  const settleJob = async (job: Job) => {
    const currentPaid = getJobPaidAmount(job);
    const finalBill = getJobFinalBillValue(job);
    const due = Math.max(0, finalBill - currentPaid);
    if (due <= 0.009) return;

    setSettlingJobId(job.id);
    try {
      await updateJob(job.id, {
        paidAmount: finalBill,
        paymentStatus: 'Paid',
        paymentMode: settlementMode,
      });
      toast.success('Settled', `Settled ${formatCurrency(due)} via ${settlementMode} for ${job.workTypeName}`);
    } catch {
      toast.error('Error', 'Failed to settle this work');
    } finally {
      setSettlingJobId(null);
    }
  };

  const settleAll = async () => {
    if (sorted.length === 0 || isSettlingAll) return;
    const ok = window.confirm(
      `Settle all pending balance for ${customer.name}?\n\nTotal due: ${formatCurrency(totalDue)}`
    );
    if (!ok) return;

    setIsSettlingAll(true);
    try {
      await Promise.all(
        sorted.map((job) =>
          updateJob(job.id, {
            paidAmount: getJobFinalBillValue(job),
            paymentStatus: 'Paid',
            paymentMode: settlementMode,
          })
        )
      );
      toast.success('Settled', `All pending works settled via ${settlementMode} for ${customer.name}`);
    } catch {
      toast.error('Error', 'Failed to settle all balances');
    } finally {
      setIsSettlingAll(false);
    }
  };

  return (
    <div className="cbo-backdrop" onClick={onClose}>
      <div className="cbo-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cbo-header">
          <div className="cbo-title">
            <span className="cbo-customer-name">{customer.name}</span>
            {customer.shortCode ? <span className="cbo-customer-code">{customer.shortCode}</span> : null}
          </div>
          <button type="button" className="cbo-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {sorted.length > 0 ? (
          <div className="cbo-toolbar">
            <div className="cbo-toolbar-meta">
              {sorted.length} unpaid work{sorted.length !== 1 ? 's' : ''} · Due {formatCurrency(totalDue)}
            </div>
            <div className="cbo-toolbar-actions">
              <label className="cbo-mode-label">
                Mode
                <select
                  className="cbo-mode-select"
                  value={settlementMode}
                  onChange={(e) => setSettlementMode(e.target.value as 'Cash' | 'UPI' | 'Bank' | 'Cheque')}
                  disabled={isSettlingAll || settlingJobId !== null}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </label>
              <button type="button" className="cbo-settle-all-btn" onClick={() => void settleAll()} disabled={isSettlingAll}>
                {isSettlingAll ? 'Settling...' : 'Settle All Balance'}
              </button>
            </div>
          </div>
        ) : null}

        {sorted.length === 0 ? (
          <div className="cbo-empty">No bills for this period.</div>
        ) : (
          <>
            <div className="cbo-table-wrap">
              <table className="cbo-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Work Type</th>
                    <th className="numeric">Due Amount</th>
                    <th className="ta-c">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((job) => (
                    <tr key={job.id}>
                      <td className="cbo-date">{job.date}</td>
                      <td className="cbo-worktype">{job.workTypeName}{job.workName ? ` — ${job.workName}` : ''}</td>
                      <td className="numeric cbo-amount">
                        {formatCurrency(Math.max(0, getJobFinalBillValue(job) - getJobPaidAmount(job)))}
                      </td>
                      <td className="ta-c">
                        <button
                          type="button"
                          className="cbo-settle-btn"
                          onClick={() => void settleJob(job)}
                          disabled={settlingJobId === job.id || isSettlingAll}
                        >
                          {settlingJobId === job.id ? 'Settling...' : 'Settle'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>{sorted.length} bill{sorted.length !== 1 ? 's' : ''}</td>
                    <td className="numeric">{formatCurrency(totalDue)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
