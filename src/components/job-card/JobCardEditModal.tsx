import { useEffect, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/currencyUtils';
import type { Job } from '@/types';
import './JobCardDetailsModal.css';

interface JobCardEditModalProps {
  isOpen: boolean;
  jobs: Job[] | null;
  onClose: () => void;
  onSave?: () => void;
}

export function JobCardEditModal({ isOpen, jobs, onClose, onSave }: JobCardEditModalProps) {
  const { updateJob } = useDataStore();
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0];

  const primary = jobs && jobs.length > 0 ? jobs[0] : null;
  const cardId = primary ? primary.jobCardId || `LEGACY-${primary.id}` : '';

  const [editedJobs, setEditedJobs] = useState<
    Record<
      number,
      {
        amount: string;
        commission: string;
        paidAmount: string;
      }
    >
  >({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize edited values when modal opens
  useEffect(() => {
    if (jobs && isOpen) {
      const initialValues: typeof editedJobs = {};
      jobs.forEach((job) => {
        initialValues[job.id as any] = {
          amount: String(job.amount || 0),
          commission: String(job.commissionAmount || 0),
          paidAmount: String(job.paidAmount || 0),
        };
      });
      setEditedJobs(initialValues);
    }
  }, [jobs, isOpen]);

  const handleSave = async () => {
    if (!jobs) return;

    setIsSaving(true);
    try {
      let hasChanges = false;

      for (const job of jobs) {
        const edited = editedJobs[job.id as any];
        if (!edited) continue;

        const newAmount = parseFloat(edited.amount) || 0;
        const newCommission = parseFloat(edited.commission) || 0;
        const newPaidAmount = parseFloat(edited.paidAmount) || 0;

        // Only update if something changed
        if (
          newAmount !== job.amount ||
          newCommission !== (job.commissionAmount || 0) ||
          newPaidAmount !== (job.paidAmount || 0)
        ) {
          hasChanges = true;
          await updateJob(job.id, {
            amount: newAmount,
            commissionAmount: newCommission,
            paidAmount: newPaidAmount,
          });
        }
      }

      if (hasChanges) {
        toast.success('Success', 'Job card updated successfully');
      } else {
        toast.info('Info', 'No changes made');
      }

      onClose();
      onSave?.();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Error', 'Failed to update job card');
    } finally {
      setIsSaving(false);
    }
  };

  const totalAmount = jobs
    ? jobs.reduce((sum, job) => sum + (parseFloat(editedJobs[job.id as any]?.amount || '0') || 0), 0)
    : 0;

  const totalCommission = jobs
    ? jobs.reduce((sum, job) => sum + (parseFloat(editedJobs[job.id as any]?.commission || '0') || 0), 0)
    : 0;

  const totalPaid = jobs
    ? jobs.reduce((sum, job) => sum + (parseFloat(editedJobs[job.id as any]?.paidAmount || '0') || 0), 0)
    : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit JobCard ${cardId}`} size="lg">
      {jobs && jobs.length > 0 ? (
        <div className="job-card-detail">
          <div className="job-card-edit-table">
            <table>
              <thead>
                <tr>
                  <th>Work Type</th>
                  <th>Qty</th>
                  <th>Amount (INR)</th>
                  <th>Commission (INR)</th>
                  <th>Paid (INR)</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const edited = editedJobs[job.id as any] || {
                    amount: String(job.amount || 0),
                    commission: String(job.commissionAmount || 0),
                    paidAmount: String(job.paidAmount || 0),
                  };

                  return (
                    <tr key={job.id}>
                      <td>{job.workTypeName}</td>
                      <td>{job.quantity}</td>
                      <td>
                        <input
                          type="number"
                          value={edited.amount}
                          onChange={(e) => {
                            setEditedJobs({
                              ...editedJobs,
                              [job.id as any]: { ...edited, amount: e.target.value },
                            });
                          }}
                          step="0.01"
                          min="0"
                          style={{
                            width: '100%',
                            padding: '4px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '12px',
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={edited.commission}
                          onChange={(e) => {
                            setEditedJobs({
                              ...editedJobs,
                              [job.id as any]: { ...edited, commission: e.target.value },
                            });
                          }}
                          step="0.01"
                          min="0"
                          style={{
                            width: '100%',
                            padding: '4px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '12px',
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={edited.paidAmount}
                          onChange={(e) => {
                            setEditedJobs({
                              ...editedJobs,
                              [job.id as any]: { ...edited, paidAmount: e.target.value },
                            });
                          }}
                          step="0.01"
                          min="0"
                          style={{
                            width: '100%',
                            padding: '4px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '12px',
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="job-card-edit-summary">
            <div className="summary-row">
              <span className="summary-label">Total Amount:</span>
              <span className="summary-value">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Total Commission:</span>
              <span className="summary-value">{formatCurrency(totalCommission)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Total Paid:</span>
              <span className="summary-value">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Pending:</span>
              <span className="summary-value">{formatCurrency(totalAmount - totalPaid)}</span>
            </div>
          </div>

          <div className="job-card-detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
