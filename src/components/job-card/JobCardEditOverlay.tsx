import { useEffect, useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { getJobPaidAmount, getPaymentStatusFromAmounts, isDcApplicableCustomer, isCommissionApplicableCustomer } from '@/lib/jobUtils';
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
  const { getCustomer, updateJob, addJobsBulk, deleteJob, getCommissionWorkersForCustomer } = useDataStore();
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
  const [billNo, setBillNo] = useState(primary?.billNo || '');
  const [dcNo, setDcNo] = useState(primary?.dcNo || '');
  const [vehicleNo, setVehicleNo] = useState(primary?.vehicleNo || '');
  const [dcDate, setDcDate] = useState(primary?.dcDate || '');
  const [dcApproval, setDcApproval] = useState(primary?.dcApproval || false);
  const [paidAmount, setPaidAmount] = useState(
    String(primary && jobs ? jobs.reduce((s, j) => s + getJobPaidAmount(j), 0) : 0)
  );
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
  const [jobFlowType, setJobFlowType] = useState<'slw_work' | 'agent_work'>(primary?.jobFlowType || 'slw_work');
  const [externalDc, setExternalDc] = useState(Boolean(primary?.externalDc));
  const [agentName, setAgentName] = useState(primary?.agentName || '');
  const [agentCommissionAmount, setAgentCommissionAmount] = useState(String(primary?.agentCommissionAmount || 0));
  const [agentTdsAmount, setAgentTdsAmount] = useState(String(primary?.agentTdsAmount || 0));
  const [agentSettlementPaidAmount, setAgentSettlementPaidAmount] = useState(String(primary?.agentSettlementPaidAmount || 0));

  const showDcFields = isDcApplicableCustomer(selectedCustomer);
  const showBillNoField = selectedCustomer?.hasBillNo === true;
  const showCommissionFields = isCommissionApplicableCustomer(selectedCustomer);
  const showAgentFlowFields = Boolean(
    selectedCustomer &&
    (
      ['rmp', 'ww'].includes((selectedCustomer.shortCode || '').toLowerCase()) ||
      (selectedCustomer.name || '').toLowerCase().includes('ramani motors') ||
      (selectedCustomer.name || '').toLowerCase().includes('ramani cars')
    )
  );
  const useWorkerCommission = showCommissionFields && jobFlowType === 'slw_work';
  const useAgentCommission = showAgentFlowFields && jobFlowType === 'agent_work';
  const showRmpHandlerField = Boolean(
    selectedCustomer &&
    ((selectedCustomer.shortCode || '').toLowerCase() === 'rmp' ||
     (selectedCustomer.name || '').toLowerCase().includes('ramani motors'))
  );
  const commissionWorkersForCustomer = useMemo(
    () =>
      useWorkerCommission && selectedCustomer
        ? getCommissionWorkersForCustomer(selectedCustomer.id)
        : [],
    [useWorkerCommission, selectedCustomer?.id, getCommissionWorkersForCustomer]
  );
  const sortedCommissionWorkers = useMemo(
    () => [...commissionWorkersForCustomer].sort((a, b) => a.name.localeCompare(b.name)),
    [commissionWorkersForCustomer]
  );

  useEffect(() => {
    if (!useWorkerCommission) {
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
  }, [useWorkerCommission, sortedCommissionWorkers, cardCommissionWorker]);

  // Auto-deselect DC exempt when DC details are filled
  useEffect(() => {
    if (!showBillNoField && billNo) {
      setBillNo('');
    }
  }, [showBillNoField, billNo]);

  useEffect(() => {
    if (dcNo.trim() || vehicleNo.trim() || dcDate) {
      setDcApproval(false);
    }
  }, [dcNo, vehicleNo, dcDate]);

  // Auto-assign commission worker when RMP handler is selected
  useEffect(() => {
    if (!showRmpHandlerField || !rmpHandler || !useWorkerCommission) return;
    const matched = sortedCommissionWorkers.find(
      (w) => w.name.trim().toLowerCase() === rmpHandler.toLowerCase()
    );
    if (matched) setCardCommissionWorker(matched);
  }, [rmpHandler, showRmpHandlerField, sortedCommissionWorkers, useWorkerCommission]);

  useEffect(() => {
    if (!showAgentFlowFields) {
      setJobFlowType('slw_work');
      setExternalDc(false);
      setAgentName('');
      setAgentCommissionAmount('0');
      setAgentTdsAmount('0');
      setAgentSettlementPaidAmount('0');
    }
  }, [showAgentFlowFields]);

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
      setPaidAmount(String(jobs.reduce((s, j) => s + getJobPaidAmount(j), 0)));
      setPaymentMode(firstJob.paymentMode || '');
      setBillNo(firstJob.billNo || '');

      if (firstJob.dcNo || firstJob.dcApproval || firstJob.vehicleNo || firstJob.dcDate) {
        setDcNo(firstJob.dcNo || '');
        setVehicleNo(firstJob.vehicleNo || '');
        setDcDate(firstJob.dcDate || '');
        setDcApproval(firstJob.dcApproval || false);
      }

      setRmpHandler((firstJob.rmpHandler as 'Bhai' | 'Raja' | null) || null);
      setJobFlowType(firstJob.jobFlowType || 'slw_work');
      setExternalDc(Boolean(firstJob.externalDc));
      setAgentName(firstJob.agentName || '');
      setAgentCommissionAmount(String(firstJob.agentCommissionAmount || 0));
      setAgentTdsAmount(String(firstJob.agentTdsAmount || 0));
      setAgentSettlementPaidAmount(String(firstJob.agentSettlementPaidAmount || 0));

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
    const finalLine = useWorkerCommission
      ? updatedLine
      : { ...updatedLine, commission: '0', commissionWorker: null };
    setJobLines(jobLines.map((line) => (line.id === updatedLine.id ? finalLine : line)));
  };

  const totalAmount = jobLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  const totalCommission = useWorkerCommission ? (parseFloat(cardTotalCommission) || 0) : 0;
  const agentCommission = useAgentCommission ? (parseFloat(agentCommissionAmount) || 0) : 0;
  const agentTds = useAgentCommission ? (parseFloat(agentTdsAmount) || 0) : 0;
  const agentNetPayable = useAgentCommission ? Math.max(0, totalAmount - agentCommission - agentTds) : 0;
  const agentSettlementPaid = useAgentCommission ? Math.max(0, parseFloat(agentSettlementPaidAmount) || 0) : 0;
  const agentSettlementPending = useAgentCommission ? Math.max(0, agentNetPayable - agentSettlementPaid) : 0;
  const summary = {
    totalAmount,
    totalCommission,
    netValue: totalAmount,
    finalValue: totalAmount + totalCommission,
    agentCommission,
    agentTds,
    agentNetPayable,
    agentSettlementPaid,
    agentSettlementPending,
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

    if (showBillNoField && !billNo.trim()) {
      toast.error('Error', 'Bill number is required for this customer');
      return;
    }

    if (useWorkerCommission && (cardTotalCommission === '' || parseFloat(cardTotalCommission) < 0)) {
      toast.error('Error', 'Please enter commission amount');
      return;
    }

    if (useWorkerCommission && sortedCommissionWorkers.length === 0) {
      toast.error('Error', 'Add at least one commission worker for this customer');
      return;
    }

    if (useWorkerCommission && !cardCommissionWorker) {
      toast.error('Error', 'Select one commission worker for this job card');
      return;
    }

    if (useAgentCommission && !agentName.trim()) {
      toast.error('Error', 'Enter agent name');
      return;
    }

    if (useAgentCommission && (agentCommissionAmount === '' || Number(agentCommissionAmount) < 0)) {
      toast.error('Error', 'Enter valid agent commission amount');
      return;
    }

    if (useAgentCommission && (agentTdsAmount === '' || Number(agentTdsAmount) < 0)) {
      toast.error('Error', 'Enter valid TDS amount');
      return;
    }

    if (useAgentCommission && (agentSettlementPaidAmount === '' || Number(agentSettlementPaidAmount) < 0)) {
      toast.error('Error', 'Enter valid settled amount');
      return;
    }

    setIsSaving(true);
    try {
      const totalPaidAmount =
        paymentStatus === 'Paid' ? Math.max(0, parseFloat(paidAmount) || 0) : 0;
      const lineFinalBills = jobLines.map((line, index) => {
        const lineAmount = parseFloat(line.amount) || 0;
        const lineCommission = useWorkerCommission && index === 0 ? parseFloat(cardTotalCommission) || 0 : 0;
        return lineAmount + lineCommission;
      });
      let remaining = totalPaidAmount;
      const paidAllocations = lineFinalBills.map((due) => {
        const alloc = Math.min(Math.max(0, due), remaining);
        remaining -= alloc;
        return alloc;
      });

      const sortedExistingJobs = [...jobs].sort((a, b) => (a.jobCardLine || a.id) - (b.jobCardLine || b.id));
      const baseCardId = sortedExistingJobs[0]?.jobCardId;

      const buildLinePayload = (line: JobLineState, index: number): Partial<Job> => {
        const payload: Partial<Job> = {
          date: jobDate,
          amount: parseFloat(line.amount),
          commissionAmount: useWorkerCommission && index === 0 ? parseFloat(cardTotalCommission) || 0 : 0,
          commissionWorkerId:
            useWorkerCommission && cardCommissionWorker ? cardCommissionWorker.id : undefined,
          commissionWorkerName:
            useWorkerCommission && cardCommissionWorker ? cardCommissionWorker.name : undefined,
          quantity: line.quantity,
          workTypeName: line.workType?.name ?? '',
          workName: line.workType?.shortCode,
          paymentStatus,
          workMode,
          notes: notes.trim() ? notes.trim() : undefined,
          jobCardId: baseCardId || undefined,
          jobCardLine: index + 1,
          billNo: showBillNoField ? billNo.trim() : undefined,
        };

        if (paymentStatus === 'Paid') {
          const alloc = paidAllocations[index] || 0;
          payload.paidAmount = alloc;
          payload.paymentStatus = getPaymentStatusFromAmounts(alloc, lineFinalBills[index] || 0);
          payload.paymentMode = alloc > 0 ? paymentMode : undefined;
        } else {
          payload.paidAmount = 0;
          payload.paymentMode = undefined;
        }

        if (showDcFields) {
          payload.dcNo = dcNo || undefined;
          payload.vehicleNo = vehicleNo.toUpperCase() || undefined;
          payload.dcDate = dcDate || undefined;
          payload.dcApproval = dcApproval;
        }

        payload.rmpHandler = showRmpHandlerField ? rmpHandler : null;
        payload.jobFlowType = jobFlowType;
        payload.externalDc = useAgentCommission ? externalDc : false;
        payload.agentName = useAgentCommission ? agentName.trim() : undefined;
        payload.agentCommissionAmount = useAgentCommission && index === 0 ? Number(agentCommissionAmount) || 0 : 0;
        payload.agentTdsAmount = useAgentCommission && index === 0 ? Number(agentTdsAmount) || 0 : 0;
        payload.agentSettlementPaidAmount = useAgentCommission && index === 0 ? Number(agentSettlementPaidAmount) || 0 : 0;

        return payload;
      };

      const commonLength = Math.min(sortedExistingJobs.length, jobLines.length);
      await Promise.all(
        jobLines.slice(0, commonLength).map((line, index) => {
          const updates = buildLinePayload(line, index);
          return updateJob(sortedExistingJobs[index].id, updates);
        })
      );

      if (jobLines.length > sortedExistingJobs.length && primary) {
        const extraLines = jobLines.slice(sortedExistingJobs.length);
        await addJobsBulk(
          extraLines.map((line, extraIndex) => {
            const index = sortedExistingJobs.length + extraIndex;
            return {
              customerId: primary.customerId,
              ...buildLinePayload(line, index),
            } as Omit<Job, 'id' | 'createdAt'>;
          })
        );
      }

      if (sortedExistingJobs.length > jobLines.length) {
        const removedJobs = sortedExistingJobs.slice(jobLines.length);
        await Promise.all(removedJobs.map((job) => deleteJob(job.id)));
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

  const typeVariant: Record<string, string> = {
    Monthly: 'flag-monthly',
    Invoice: 'flag-invoice',
    'Party-Credit': 'flag-party-credit',
    Cash: 'flag-cash',
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

        {/* 1. Customer + Date */}
        <div className="edit-header-2col edit-section">
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
        </div>

        {/* 2. Customer flags */}
        {selectedCustomer && (
          <div className="edit-flags-row edit-section">
            <span className={`cust-flag ${typeVariant[selectedCustomer.type] || 'flag-invoice'}`}>
              {selectedCustomer.type}
            </span>
            {showCommissionFields && <span className="cust-flag flag-commission">Commission</span>}
            {showDcFields && <span className="cust-flag flag-dc">DC required</span>}
            {showBillNoField && <span className="cust-flag">Bill No</span>}
            {showRmpHandlerField && <span className="cust-flag flag-rmp">RMP</span>}
          </div>
        )}

        {/* 3. Job lines — Bill No inline in header, matching creation form */}
        <div className="edit-job-details edit-section">
          <div className="edit-job-details-header">
            <h3 className="edit-section-title">Work Lines</h3>
            {showBillNoField && (
              <div className="edit-bill-no-inline">
                <label className="edit-bill-no-label">Bill No <span className="req-star">*</span></label>
                <input
                  type="text"
                  className="edit-bill-no-input mono"
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  placeholder="Bill number"
                  maxLength={40}
                  required={showBillNoField}
                  aria-label="Bill Number"
                />
              </div>
            )}
            <button type="button" onClick={handleAddLine} className="edit-add-line-btn">
              + Add Line
            </button>
          </div>
          {jobLines.map((line) => (
            <JobLine
              key={line.id}
              line={line}
              onChange={handleLineChange}
              onRemove={() => handleRemoveLine(line.id)}
              showCommission={useWorkerCommission}
              showInlineWorker={false}
              showInlineCommission={false}
            />
          ))}
        </div>

        {/* 4. Flow Type — full width, same as creation form */}
        {showAgentFlowFields && (
          <div className="edit-section">
            <label className="edit-field-label">Flow Type</label>
            <div className="edit-mode-buttons edit-flow-seg">
              <button
                type="button"
                className={`edit-mode-btn${jobFlowType === 'slw_work' ? ' active' : ''}`}
                onClick={() => setJobFlowType('slw_work')}
              >
                SLW Work (Pay Worker)
              </button>
              <button
                type="button"
                className={`edit-mode-btn${jobFlowType === 'agent_work' ? ' active' : ''}`}
                onClick={() => setJobFlowType('agent_work')}
              >
                Agent Work (Receive Commission)
              </button>
            </div>
          </div>
        )}

        {/* 5. RMP Handler — compact seg, outside commission, same as creation form */}
        {showRmpHandlerField && (
          <div className="edit-section">
            <label className="edit-field-label">RMP Handler</label>
            <div className="edit-mode-buttons edit-rmp-seg">
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
          </div>
        )}

        {/* 6a. Worker commission — accent blue panel */}
        {useWorkerCommission && (
          <div className="edit-section edit-worker-commission-panel">
            {sortedCommissionWorkers.length === 0 ? (
              <p className="edit-assignment-empty">
                No commission workers found for this customer. Add workers in Customer settings.
              </p>
            ) : (
              <div className="edit-2col">
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
                  <label className="edit-field-label">Commission (INR)</label>
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

        {/* 6b. Agent commission — amber panel */}
        {useAgentCommission && (
          <div className="edit-section edit-agent-commission-panel">
            <label className="edit-agent-dc-label">
              <input
                type="checkbox"
                checked={externalDc}
                onChange={(e) => setExternalDc(e.target.checked)}
              />
              External DC (not worked by SLW)
            </label>
            <div className="edit-2col">
              <div className="edit-field-group">
                <label className="edit-field-label">Agent Name</label>
                <input
                  type="text"
                  className="edit-input"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Sudha / Palanisamy"
                  aria-label="Agent Name"
                />
              </div>
              <div className="edit-field-group">
                <label className="edit-field-label">Our Commission (INR)</label>
                <input
                  type="number"
                  className="edit-input"
                  value={agentCommissionAmount}
                  onChange={(e) => setAgentCommissionAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  aria-label="Our Commission"
                />
              </div>
            </div>
            <div className="edit-2col">
              <div className="edit-field-group">
                <label className="edit-field-label">TDS (INR)</label>
                <input
                  type="number"
                  className="edit-input"
                  value={agentTdsAmount}
                  onChange={(e) => setAgentTdsAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  aria-label="TDS Amount"
                />
              </div>
              <div className="edit-field-group">
                <label className="edit-field-label">Net Payable To Agent</label>
                <input
                  type="text"
                  className="edit-input edit-input--readonly"
                  value={formatCurrency(summary.agentNetPayable)}
                  readOnly
                  aria-label="Net Payable To Agent"
                />
              </div>
            </div>
            <div className="edit-2col">
              <div className="edit-field-group">
                <label className="edit-field-label">Settled To Agent (INR)</label>
                <input
                  type="number"
                  className="edit-input"
                  value={agentSettlementPaidAmount}
                  onChange={(e) => setAgentSettlementPaidAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  aria-label="Settled To Agent"
                />
              </div>
              <div className="edit-field-group">
                <label className="edit-field-label">Pending To Agent</label>
                <input
                  type="text"
                  className="edit-input edit-input--readonly"
                  value={formatCurrency(summary.agentSettlementPending)}
                  readOnly
                  aria-label="Pending To Agent"
                />
              </div>
            </div>
          </div>
        )}

        {/* 7. Summary */}
        <div className="edit-summary-grid edit-section">
          <div className="edit-summary-item">
            <div className="edit-summary-label">Amount</div>
            <div className="edit-summary-value">{formatCurrency(summary.totalAmount)}</div>
          </div>
          {useWorkerCommission && (
            <div className="edit-summary-item">
              <div className="edit-summary-label">Commission</div>
              <div className="edit-summary-value">{formatCurrency(summary.totalCommission)}</div>
            </div>
          )}
          {useWorkerCommission && (
            <div className="edit-summary-item">
              <div className="edit-summary-label">Final Bill</div>
              <div className="edit-summary-value">{formatCurrency(summary.finalValue)}</div>
            </div>
          )}
          <div className="edit-summary-item">
            <div className="edit-summary-label">{useWorkerCommission ? 'Net Income' : 'Net Value'}</div>
            <div className="edit-summary-value">{formatCurrency(summary.netValue)}</div>
          </div>
        </div>

        {/* 8. DC Panel — amber bordered, matching creation form */}
        {showDcFields && (
          <div className="edit-dc-panel edit-section">
            <div className="edit-dc-panel-head">
              <span className="edit-dc-panel-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <line x1="10" y1="9" x2="8" y2="9"/>
                </svg>
                Delivery Challan
              </span>
              <label className="edit-dc-waived-label">
                <input
                  type="checkbox"
                  checked={dcApproval}
                  onChange={(e) => setDcApproval(e.target.checked)}
                />
                DC waived
              </label>
            </div>
            <div className="edit-dc-fields">
              <div className="edit-field-group">
                <label className="edit-field-label">DC No.</label>
                <input
                  type="text"
                  value={dcNo}
                  onChange={(e) => setDcNo(e.target.value)}
                  className="edit-input mono"
                  placeholder="DC1234"
                />
              </div>
              <div className="edit-field-group">
                <label className="edit-field-label">Vehicle No.</label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  className="edit-input mono"
                  placeholder="TN22AB1234"
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
            </div>
          </div>
        )}

        {/* 9. Work Mode + Payment — 2-col row, matching creation form */}
        <div className="edit-section">
          <div className="edit-2col">
            <div className="edit-field-group">
              <label className="edit-field-label">Work Mode</label>
              <div className="edit-mode-buttons">
                {(['Workshop', 'Spot'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setWorkMode(mode)}
                    className={`edit-mode-btn${workMode === mode ? ' active' : ''}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="edit-field-group">
              <label className="edit-field-label">Payment</label>
              <div className="edit-payment-toggle">
                {(['Pending', 'Paid'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setPaymentStatus(status);
                      if (status === 'Pending') {
                        setPaymentMode('');
                        setPaidAmount('0');
                      } else {
                        setPaidAmount(String(summary.finalValue));
                      }
                    }}
                    className={`edit-payment-seg${paymentStatus === status ? ` active active--${status.toLowerCase()}` : ''}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {paymentStatus === 'Paid' && (
            <div className="edit-2col edit-paid-gap">
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

        {/* 10. Notes */}
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

        {/* 11. Actions */}
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
