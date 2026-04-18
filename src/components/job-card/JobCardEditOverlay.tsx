import { useEffect, useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { isDcApplicableCustomer, isCommissionApplicableCustomer } from '@/lib/jobUtils';
import type { Customer, Job } from '@/types';
import { JobLine, JobLineState } from '@/screens/jobs/JobLine';
import './JobCardEditOverlay.css';

interface JobCardEditOverlayProps {
  isOpen: boolean;
  jobs: Job[] | null;
  onClose: () => void;
  onSave?: () => void;
}

const normalizeOverlayPaymentStatus = (status?: Job['paymentStatus']): 'Paid' | 'Pending' =>
  status === 'Paid' || status === 'Partially Paid' ? 'Paid' : 'Pending';

export function JobCardEditOverlay({ isOpen, jobs, onClose, onSave }: JobCardEditOverlayProps) {
  const { getCustomer, updateJob, getCommissionWorkersForCustomer } = useDataStore();
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
  const [cardCommissionWorker, setCardCommissionWorker] = useState<typeof commissionWorkersForCustomer[0] | null>(null);
  const [cardTotalCommission, setCardTotalCommission] = useState('0');

  const [rmpHandler, setRmpHandler] = useState<'Bhai' | 'Raja' | null>(
    (primary?.rmpHandler as 'Bhai' | 'Raja' | null) || null
  );

  const hasExistingDcValues = Boolean(
    primary && (primary.dcNo || primary.vehicleNo || primary.dcDate || primary.dcApproval)
  );
  const showDcFields = isDcApplicableCustomer(selectedCustomer) || hasExistingDcValues;
  const showCommissionFields = isCommissionApplicableCustomer(selectedCustomer);
  const showRmpHandlerField = Boolean(
    selectedCustomer &&
    ((selectedCustomer.shortCode || '').toLowerCase() === 'rmp' ||
     (selectedCustomer.name || '').toLowerCase().includes('ramani motors'))
  );
  const commissionWorkersForCustomer = useMemo(
    () =>
      showCommissionFields && selectedCustomer
        ? getCommissionWorkersForCustomer(selectedCustomer.id)
        : [],
    [showCommissionFields, selectedCustomer?.id, getCommissionWorkersForCustomer]
  );
  const sortedCommissionWorkers = useMemo(
    () => [...commissionWorkersForCustomer].sort((a, b) => a.name.localeCompare(b.name)),
    [commissionWorkersForCustomer]
  );

  useEffect(() => {
    if (!showCommissionFields) {
      return;
    }

    if (sortedCommissionWorkers.length === 1) {
      const onlyWorker = sortedCommissionWorkers[0];
      if (!cardCommissionWorker || cardCommissionWorker.id !== onlyWorker.id) {
        setCardCommissionWorker(onlyWorker);
      }
      return;
    }

    if (
      cardCommissionWorker &&
      !sortedCommissionWorkers.some((worker) => worker.id === cardCommissionWorker.id)
    ) {
      setCardCommissionWorker(null);
    }
  }, [showCommissionFields, sortedCommissionWorkers, cardCommissionWorker]);

  // Auto-deselect DC exempt when DC details are filled
  useEffect(() => {
    if (dcNo.trim() || vehicleNo.trim() || dcDate) {
      setDcApproval(false);
    }
  }, [dcNo, vehicleNo, dcDate]);

  // Auto-assign commission worker when RMP handler is selected
  useEffect(() => {
    if (!showRmpHandlerField || !rmpHandler) return;
    const matched = sortedCommissionWorkers.find(
      (w) => w.name.trim().toLowerCase() === rmpHandler.toLowerCase()
    );
    if (matched) setCardCommissionWorker(matched);
  }, [rmpHandler, showRmpHandlerField, sortedCommissionWorkers]);

  // Initialize when modal opens
  useEffect(() => {
    if (jobs && isOpen && jobs.length > 0) {
      const firstJob = jobs[0];
      const workersForCard = getCommissionWorkersForCustomer(firstJob.customerId);
      setSelectedCustomer(getCustomer(firstJob.customerId) || null);
      setJobDate(firstJob.date);
      setWorkMode((firstJob.workMode as 'Workshop' | 'Spot') || 'Workshop');
      setNotes(firstJob.notes || '');
      setPaymentStatus(normalizeOverlayPaymentStatus(firstJob.paymentStatus));
      setPaidAmount(String(firstJob.paidAmount || '0'));
      setPaymentMode(firstJob.paymentMode || '');

      if (firstJob.dcNo || firstJob.dcApproval || firstJob.vehicleNo || firstJob.dcDate) {
        setDcNo(firstJob.dcNo || '');
        setVehicleNo(firstJob.vehicleNo || '');
        setDcDate(firstJob.dcDate || '');
        setDcApproval(firstJob.dcApproval || false);
      }

      setRmpHandler((firstJob.rmpHandler as 'Bhai' | 'Raja' | null) || null);

      const lines: JobLineState[] = jobs.map((job) => {
        return {
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
          commission: '0',
          commissionWorker: null,
        };
      });
      setJobLines(lines);

      // Set card-level commission from first job
      if (firstJob.commissionWorkerId) {
        const commissionWorker = workersForCard.find((w) => w.id === firstJob.commissionWorkerId);
        setCardCommissionWorker(commissionWorker || null);
      }
      setCardTotalCommission(String(firstJob.commissionAmount || 0));
    }
  }, [jobs, isOpen, getCustomer, getCommissionWorkersForCustomer]);

  const handleAddLine = () => {
    setJobLines([
      ...jobLines,
      {
        id: Date.now().toString(),
        workType: null,
        quantity: 1,
        amount: '',
        commission: '',
        commissionWorker: null,
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
    const finalLine = showCommissionFields
      ? updatedLine
      : { ...updatedLine, commission: '0', commissionWorker: null };
    setJobLines(jobLines.map((line) => (line.id === updatedLine.id ? finalLine : line)));
  };

  const totalAmount = jobLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  const totalCommission = parseFloat(cardTotalCommission) || 0;
  const summary = {
    totalAmount,
    totalCommission,
    netValue: totalAmount,
    finalValue: totalAmount + totalCommission,
  };

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

    if (paymentStatus === 'Paid' && (!paidAmount || parseFloat(paidAmount) <= 0)) {
      toast.error('Error', 'Paid amount is mandatory when status is Paid');
      return;
    }

    if (paymentStatus === 'Paid' && !paymentMode) {
      toast.error('Error', 'Payment mode is mandatory when status is Paid');
      return;
    }

    if (showCommissionFields && (cardTotalCommission === '' || parseFloat(cardTotalCommission) < 0)) {
      toast.error('Error', 'Please enter commission amount');
      return;
    }

    if (showCommissionFields && sortedCommissionWorkers.length === 0) {
      toast.error('Error', 'Add at least one commission worker for this customer');
      return;
    }

    if (showCommissionFields && !cardCommissionWorker) {
      toast.error('Error', 'Select one commission worker for this job card');
      return;
    }

    setIsSaving(true);
    try {
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const line = jobLines[i];

        if (!line) continue;

        const updates: any = {
          date: jobDate,
          amount: parseFloat(line.amount),
          commissionAmount: i === 0 ? parseFloat(cardTotalCommission) || 0 : 0,
          commissionWorkerId:
            showCommissionFields && cardCommissionWorker ? cardCommissionWorker.id : undefined,
          commissionWorkerName:
            showCommissionFields && cardCommissionWorker ? cardCommissionWorker.name : undefined,
          quantity: line.quantity,
          workTypeName: line.workType?.name,
          workName: line.workType?.shortCode,
          paymentStatus,
          workMode,
          notes: notes.trim() ? notes.trim() : null,
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

        updates.rmpHandler = showRmpHandlerField ? rmpHandler : null;

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
            <input
              type="date"
              value={jobDate}
              onChange={(e) => setJobDate(e.target.value)}
              max={today}
              className="edit-input"
              aria-label="Job Date"
            />
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
              showInlineWorker={false}
              showInlineCommission={false}
            />
          ))}
        </div>

        {showRmpHandlerField && (
          <div className="edit-section">
            <h3 className="edit-section-title">RMP Handler</h3>
            <div className="edit-rmp-handler-buttons">
              {(['Bhai', 'Raja'] as const).map((handler) => (
                <button
                  key={handler}
                  type="button"
                  className={`edit-mode-btn${rmpHandler === handler ? ' active' : ''}`}
                  onClick={() => setRmpHandler(rmpHandler === handler ? null : handler)}
                >
                  {handler}
                </button>
              ))}
            </div>
            <p className="edit-rmp-handler-note">
              Bhai — people vehicles · Raja — commercial vehicles. Commission auto-assigned.
            </p>
          </div>
        )}

        {showCommissionFields && (
          <div className="edit-commission-assignment edit-section">
            <div className="edit-job-details-header">
              <h3 className="edit-section-title">Commission Assignment</h3>
              <span className="edit-assignment-note">One job card can be tagged to only one commission worker.</span>
            </div>

            {sortedCommissionWorkers.length === 0 ? (
              <p className="edit-assignment-empty">
                No commission workers found for this customer. Add workers in Customer settings.
              </p>
            ) : (
              <div className="edit-assignment-simple">
                <div className="edit-field-group">
                  <label className="edit-field-label">Commission Worker</label>
                  <select
                    className="edit-select"
                    value={cardCommissionWorker ? String(cardCommissionWorker.id) : ''}
                    onChange={(e) => {
                      const worker = sortedCommissionWorkers.find((w) => String(w.id) === e.target.value);
                      setCardCommissionWorker(worker || null);
                    }}
                    aria-label="Commission Worker"
                  >
                    <option value="">Select worker...</option>
                    {sortedCommissionWorkers.map((worker) => (
                      <option key={worker.id} value={String(worker.id)}>
                        {worker.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="edit-field-group">
                  <label className="edit-field-label">Total Commission (INR)</label>
                  <input
                    type="number"
                    className="edit-input"
                    value={cardTotalCommission}
                    onChange={(e) => setCardTotalCommission(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    aria-label="Total Commission"
                  />
                </div>
              </div>
            )}
          </div>
        )}

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
          {showCommissionFields && (
            <div className="edit-summary-item">
              <div className="edit-summary-label">Final Bill</div>
              <div className="edit-summary-value">{formatCurrency(summary.finalValue)}</div>
            </div>
          )}
          <div className="edit-summary-item">
            <div className="edit-summary-label">{showCommissionFields ? 'Our Net Income' : 'Net Value'}</div>
            <div className="edit-summary-value">{formatCurrency(summary.netValue)}</div>
          </div>
        </div>

        {/* DC Fields */}
        {showDcFields && (
          <div className="edit-dc-fields edit-section">
            <div className="edit-field-group">
              <label className="edit-field-label" htmlFor="edit-dc-no">DC Number</label>
              <input
                id="edit-dc-no"
                type="text"
                value={dcNo}
                onChange={(e) => setDcNo(e.target.value)}
                className="edit-input"
                placeholder="e.g. DC-001"
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
                  } else {
                    setPaidAmount(String(summary.finalValue));
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
                <label className="edit-field-label">
                  Paid Amount (INR)
                  <span className="edit-paid-chips">
                    <button
                      type="button"
                      className="edit-paid-chip"
                      onClick={() => setPaidAmount(String(summary.finalValue))}
                    >
                      Full {formatCurrency(summary.finalValue)}
                    </button>
                    {summary.totalCommission > 0 && (
                      <button
                        type="button"
                        className="edit-paid-chip"
                        onClick={() => setPaidAmount(String(summary.netValue))}
                      >
                        Net {formatCurrency(summary.netValue)}
                      </button>
                    )}
                  </span>
                </label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  onFocus={(e) => e.target.select()}
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
