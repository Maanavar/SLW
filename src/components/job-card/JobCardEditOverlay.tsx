import { useEffect, useState, useMemo } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { isDcApplicableCustomer, isCommissionApplicableCustomer, computeDefaultDistribution } from '@/lib/jobUtils';
import type { Customer, Job, CommissionDistribution } from '@/types';
import { JobLine, JobLineState } from '@/screens/jobs/JobLine';
import './JobCardEditOverlay.css';

interface JobCardEditOverlayProps {
  isOpen: boolean;
  jobs: Job[] | null;
  onClose: () => void;
  onSave?: () => void;
}

export function JobCardEditOverlay({ isOpen, jobs, onClose, onSave }: JobCardEditOverlayProps) {
  const { getActiveCustomers, getCustomer, updateJob, getCommissionWorkersForCustomer } = useDataStore();
  const toast = useToast();
  const today = getLocalDateString(new Date());

  const primary = jobs && jobs.length > 0 ? jobs[0] : null;
  const customer = primary ? getCustomer(primary.customerId) : null;
  const cardId = primary ? primary.jobCardId || `LEGACY-${primary.id}` : '';

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(customer || null);
  const [jobDate, setJobDate] = useState(primary?.date || today);
  const [jobLines, setJobLines] = useState<JobLineState[]>([]);
  const [workMode, setWorkMode] = useState<'Workshop' | 'Spot'>(
    (primary?.workMode as 'Workshop' | 'Spot') || 'Workshop'
  );
  const [paymentMode, setPaymentMode] = useState(primary?.paymentMode || '');
  const [dcNo, setDcNo] = useState(primary?.dcNo || '');
  const [vehicleNo, setVehicleNo] = useState(primary?.vehicleNo || '');
  const [dcDate, setDcDate] = useState(primary?.dcDate || '');
  const [dcApproval, setDcApproval] = useState(primary?.dcApproval || false);
  const [paidAmount, setPaidAmount] = useState(String(primary?.paidAmount || '0'));
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>(
    primary?.paymentStatus === 'Paid' ? 'Paid' : 'Pending'
  );
  const [notes, setNotes] = useState(primary?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [commissionDistribution, setCommissionDistribution] = useState<CommissionDistribution[]>(
    primary?.commissionDistribution || []
  );

  const showDcFields = isDcApplicableCustomer(selectedCustomer);
  const showCommissionFields = isCommissionApplicableCustomer(selectedCustomer);

  // Initialize when modal opens
  useEffect(() => {
    if (jobs && isOpen && jobs.length > 0) {
      const firstJob = jobs[0];
      setSelectedCustomer(getCustomer(firstJob.customerId) || null);
      setJobDate(firstJob.date);
      setWorkMode((firstJob.workMode as 'Workshop' | 'Spot') || 'Workshop');
      setNotes(firstJob.notes || '');
      setPaymentStatus((firstJob.paymentStatus as 'Paid' | 'Pending') || 'Pending');
      setPaidAmount(String(firstJob.paidAmount || '0'));
      setPaymentMode(firstJob.paymentMode || '');

      if (firstJob.dcNo || firstJob.dcApproval || firstJob.vehicleNo || firstJob.dcDate) {
        setDcNo(firstJob.dcNo || '');
        setVehicleNo(firstJob.vehicleNo || '');
        setDcDate(firstJob.dcDate || '');
        setDcApproval(firstJob.dcApproval || false);
      }

      const lines: JobLineState[] = jobs.map((job) => ({
        id: job.id.toString(),
        workType: {
          id: 0,
          name: job.workTypeName,
          shortCode: job.workName || '',
          category: '',
          defaultUnit: '',
          defaultRate: 0,
        },
        quantity: job.quantity,
        amount: String(job.amount),
        commission: String(job.commissionAmount || 0),
      }));
      setJobLines(lines);
    }
  }, [jobs, isOpen, getCustomer]);

  const handleAddLine = () => {
    setJobLines([
      ...jobLines,
      {
        id: Date.now().toString(),
        workType: null,
        quantity: 1,
        amount: '',
        commission: '',
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (jobLines.length <= 1) {
      toast.error('Error', 'At least one job line is required');
      return;
    }
    setJobLines(jobLines.filter((line) => line.id !== id));
  };

  const handleLineChange = (updatedLine: JobLineState) => {
    const finalLine = showCommissionFields ? updatedLine : { ...updatedLine, commission: '0' };
    setJobLines(jobLines.map((line) => (line.id === updatedLine.id ? finalLine : line)));
  };

  const totalAmount = jobLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  const totalCommission = jobLines.reduce((sum, line) => sum + (parseFloat(line.commission) || 0), 0);
  const summary = {
    totalAmount,
    totalCommission,
    netValue: totalAmount - totalCommission,
  };

  // Auto-calculate commission distribution when commission changes
  useMemo(() => {
    if (showCommissionFields && selectedCustomer && summary.totalCommission > 0) {
      const workers = getCommissionWorkersForCustomer(selectedCustomer.id);
      if (workers.length > 0) {
        const distribution = computeDefaultDistribution(workers, summary.totalCommission);
        setCommissionDistribution(distribution);
      }
    }
  }, [selectedCustomer, summary.totalCommission, showCommissionFields, getCommissionWorkersForCustomer]);

  const handleSave = async () => {
    if (!jobs) return;

    if (jobLines.some((line) => !line.workType)) {
      toast.error('Error', 'All job lines must have a work type selected');
      return;
    }

    if (jobLines.some((line) => !line.quantity || line.quantity <= 0)) {
      toast.error('Error', 'All job lines must have quantity > 0');
      return;
    }

    if (jobLines.some((line) => !line.amount || parseFloat(line.amount) <= 0)) {
      toast.error('Error', 'All job lines must have amount');
      return;
    }

    setIsSaving(true);
    try {
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const line = jobLines[i];

        if (!line) continue;

        const updates: any = {
          amount: parseFloat(line.amount),
          commissionAmount: parseFloat(line.commission) || 0,
          quantity: line.quantity,
          workTypeName: line.workType?.name,
          workName: line.workType?.shortCode,
          paymentStatus,
          workMode,
          notes: notes || undefined,
        };

        if (paymentStatus === 'Paid') {
          updates.paidAmount = parseFloat(paidAmount) / jobs.length;
          updates.paymentMode = paymentMode;
        } else {
          updates.paidAmount = 0;
        }

        if (showDcFields) {
          updates.dcNo = dcNo || undefined;
          updates.vehicleNo = vehicleNo.toUpperCase() || undefined;
          updates.dcDate = dcDate || undefined;
          updates.dcApproval = dcApproval;
        }

        await updateJob(job.id, updates);
      }

      toast.success('Success', 'Job card updated successfully');
      onClose();
      onSave?.();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Error', 'Failed to update job card');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Job Card ${cardId}`}
      size="lg"
      className="job-card-edit-modal"
    >
      <div className="edit-card-form">
        {/* Header Fields */}
        <div className="edit-header-fields edit-section">
          <div className="edit-field-group">
            <label className="edit-field-label">Customer</label>
            <div className="edit-field-display">{selectedCustomer?.name}</div>
          </div>
          <div className="edit-field-group">
            <label className="edit-field-label">Date</label>
            <div className="edit-field-display">{jobDate}</div>
          </div>
          <div className="edit-field-group">
            <label className="edit-field-label">Work Mode</label>
            <div className="edit-mode-buttons">
              {['Workshop', 'Spot'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setWorkMode(mode as 'Workshop' | 'Spot')}
                  className={`edit-mode-btn ${workMode === mode ? 'active' : ''}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Job Lines */}
        <div className="edit-job-details edit-section">
          <div className="edit-job-details-header">
            <h3 className="edit-section-title">Job Details</h3>
            <button type="button" onClick={handleAddLine} className="edit-add-line-btn">
              + Add Line
            </button>
          </div>
          {jobLines.map((line, index) => (
            <JobLine
              key={line.id}
              line={line}
              onChange={handleLineChange}
              onRemove={() => handleRemoveLine(line.id)}
              lineNumber={index + 1}
              showCommission={showCommissionFields}
            />
          ))}
        </div>

        {/* Summary */}
        <div className={`edit-summary-grid edit-section ${!showCommissionFields ? 'two-column' : ''}`}>
          <div className="edit-summary-item">
            <div className="edit-summary-label">Amount</div>
            <div className="edit-summary-value">{formatCurrency(summary.totalAmount)}</div>
          </div>
          {showCommissionFields && (
            <div className="edit-summary-item">
              <div className="edit-summary-label">Commission</div>
              <div className="edit-summary-value">{formatCurrency(summary.totalCommission)}</div>
            </div>
          )}
          <div className="edit-summary-item">
            <div className="edit-summary-label">Net Value</div>
            <div className="edit-summary-value">{formatCurrency(summary.netValue)}</div>
          </div>
        </div>

        {/* Commission Distribution */}
        {showCommissionFields && commissionDistribution.length > 0 && (
          <div className="edit-commission-distribution edit-section">
            <h3 className="edit-section-title">Commission Distribution</h3>
            <div className="edit-commission-breakdown">
              <div className="edit-breakdown-header">
                <span>Worker Name</span>
                <span>Amount</span>
              </div>
              {commissionDistribution.map((dist) => (
                <div key={dist.workerId} className="edit-breakdown-row">
                  <span>{dist.workerName}</span>
                  <span>{formatCurrency(dist.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DC Fields */}
        {showDcFields && (
          <div className="edit-dc-fields edit-section">
            <div className="edit-field-group">
              <label className="edit-field-label">DC Number</label>
              <input
                type="text"
                value={dcNo}
                onChange={(e) => setDcNo(e.target.value)}
                className="edit-input"
              />
            </div>
            <div className="edit-field-group">
              <label className="edit-field-label">Vehicle Number</label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                className="edit-input"
                placeholder="e.g. MH01AB1234"
              />
            </div>
            <div className="edit-field-group">
              <label className="edit-field-label">DC Date</label>
              <input
                type="date"
                value={dcDate}
                onChange={(e) => setDcDate(e.target.value)}
                max={today}
                className="edit-input"
                aria-label="DC Date"
              />
            </div>
            <div className="edit-dc-checkbox-wrapper">
              <input
                type="checkbox"
                id="dc-approval"
                checked={dcApproval}
                onChange={(e) => setDcApproval(e.target.checked)}
              />
              <label htmlFor="dc-approval">Approved Without DC</label>
            </div>
          </div>
        )}

        {/* Payment */}
        <div className="edit-payment-section edit-section">
          <h3 className="edit-section-title edit-payment-label">Payment</h3>
          <div className="edit-payment-status-buttons">
            {['Pending', 'Paid'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setPaymentStatus(status as 'Pending' | 'Paid');
                  if (status === 'Pending') {
                    setPaymentMode('');
                    setPaidAmount('0');
                  }
                }}
                className={`edit-payment-btn ${paymentStatus === status ? 'active' : ''}`}
              >
                {status}
              </button>
            ))}
          </div>

          {paymentStatus === 'Paid' && (
            <div className="edit-paid-fields">
              <div className="edit-field-group">
                <label className="edit-field-label">Paid Amount (INR)</label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  className="edit-input"
                  aria-label="Paid Amount"
                />
              </div>
              <div className="edit-field-group">
                <label className="edit-field-label">Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="edit-select"
                  aria-label="Payment Mode"
                >
                  <option value="">Select mode...</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="edit-notes-section edit-section">
          <label className="edit-field-label">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any special instructions or remarks..."
            rows={3}
            className="edit-textarea"
          />
        </div>

        {/* Actions */}
        <div className="edit-actions">
          <button type="button" onClick={handleSave} disabled={isSaving} className="edit-btn-save">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={onClose} disabled={isSaving} className="edit-btn-cancel">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
