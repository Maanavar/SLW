import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { StatusBadge } from '@/components/ui/Badge';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { JobLine, JobLineState } from './JobLine';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { groupJobsByCard } from '@/lib/reportUtils';
import {
  getJobCardPaymentSummary,
  getPaymentStatusFromAmounts,
  isDcApplicableCustomer,
} from '@/lib/jobUtils';
import { Customer, Job } from '@/types';
import './JobForm.css';

function generateJobCardId(jobDate: string, existingJobs: Job[]) {
  const [, month = '', day = ''] = jobDate.split('-');
  const prefix = `${day}${month}`;
  let maxSerial = 0;

  existingJobs.forEach((job) => {
    const id = job.jobCardId || '';
    const match = id.match(new RegExp(`^${prefix}(\\d{3})$`));
    if (match) {
      maxSerial = Math.max(maxSerial, Number(match[1]));
    }
  });

  return `${prefix}${String(maxSerial + 1).padStart(3, '0')}`;
}

export function JobForm() {
  const { getActiveCustomers, getCustomer, jobs, addJob, deleteJob, clearAllJobs } = useDataStore();
  const toast = useToast();

  const customers = getActiveCustomers();
  const today = getLocalDateString(new Date());

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [jobDate, setJobDate] = useState(getLocalDateString(new Date()));
  const [jobLines, setJobLines] = useState<JobLineState[]>([
    {
      id: Date.now().toString(),
      workType: null,
      quantity: 1,
      amount: '',
      commission: '',
    },
  ]);
  const [workMode, setWorkMode] = useState<'Workshop' | 'Spot'>('Workshop');
  const [paymentMode, setPaymentMode] = useState('');
  const [dcNo, setDcNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [dcDate, setDcDate] = useState('');
  const [dcApproval, setDcApproval] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>('Pending');
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showDcFields = isDcApplicableCustomer(selectedCustomer);

  const summary = {
    totalAmount: jobLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0),
    totalCommission: jobLines.reduce((sum, line) => sum + (parseFloat(line.commission) || 0), 0),
    netValue: jobLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0),
    finalValue: jobLines.reduce(
      (sum, line) =>
        sum + (parseFloat(line.amount) || 0) + (parseFloat(line.commission) || 0),
      0
    ),
  };

  const todayJobCards = useMemo(() => {
    const todayJobs = jobs.filter((job) => job.date === today);
    const groups = groupJobsByCard(todayJobs);

    return groups.sort((a, b) => {
      const aTime = new Date(a.primary.createdAt || a.primary.date).getTime();
      const bTime = new Date(b.primary.createdAt || b.primary.date).getTime();
      return bTime - aTime;
    });
  }, [jobs, today]);

  const selectedTodayCard = useMemo(
    () => todayJobCards.find((group) => group.key === selectedCardKey) || null,
    [todayJobCards, selectedCardKey]
  );

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
    setJobLines(jobLines.map((line) => (line.id === updatedLine.id ? updatedLine : line)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast.error('Error', 'Please select a customer');
      return;
    }

    if (!jobDate) {
      toast.error('Error', 'Please select a job date');
      return;
    }

    if (jobDate > today) {
      toast.error('Error', 'Future date is not allowed');
      return;
    }

    if (jobLines.some((line) => !line.workType)) {
      toast.error('Error', 'All job lines must have a work type selected');
      return;
    }

    if (jobLines.some((line) => !line.quantity || line.quantity <= 0)) {
      toast.error('Error', 'All job lines must include quantity greater than 0');
      return;
    }

    if (jobLines.some((line) => !line.amount || parseFloat(line.amount) <= 0)) {
      toast.error('Error', 'All job lines must include amount');
      return;
    }

    if (jobLines.some((line) => line.commission === '' || parseFloat(line.commission) < 0)) {
      toast.error('Error', 'All job lines must include commission value');
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

    if (showDcFields && !dcNo.trim() && !dcApproval) {
      toast.error('Error', 'For DC customers, enter DC Number or mark Approved');
      return;
    }

    setIsSubmitting(true);
    try {
      const jobCardId = generateJobCardId(jobDate, jobs);
      const enteredPaidAmount = paymentStatus === 'Paid' ? parseFloat(paidAmount) || 0 : 0;
      const resolvedPaymentStatus =
        paymentStatus === 'Paid'
          ? getPaymentStatusFromAmounts(enteredPaidAmount, summary.netValue)
          : 'Pending';

      const newJobs: Job[] = jobLines.map((line, index) => ({
        id: Date.now() + Math.random(),
        customerId: selectedCustomer.id,
        workTypeName: line.workType!.name,
        workName: line.workType!.shortCode,
        quantity: line.quantity,
        amount: parseFloat(line.amount),
        commissionAmount: parseFloat(line.commission) || 0,
        netAmount: parseFloat(line.amount),
        date: jobDate,
        paymentStatus: resolvedPaymentStatus,
        paymentMode: paymentStatus === 'Paid' ? paymentMode : undefined,
        paidAmount: index === 0 && enteredPaidAmount > 0 ? enteredPaidAmount : 0,
        workMode,
        isSpotWork: workMode === 'Spot',
        jobCardId,
        jobCardLine: index + 1,
        ...(showDcFields && {
          dcNo: dcNo || undefined,
          vehicleNo: vehicleNo || undefined,
          dcDate: dcDate || undefined,
          dcApproval: dcApproval || undefined,
        }),
      }));

      newJobs.forEach((job) => addJob(job));
      toast.success('Success', `JobCard ${jobCardId} created with ${newJobs.length} line(s)`);

      setJobDate(getLocalDateString(new Date()));
      setSelectedCustomer(null);
      setJobLines([
        {
          id: Date.now().toString(),
          workType: null,
          quantity: 1,
          amount: '',
          commission: '',
        },
      ]);
      setWorkMode('Workshop');
      setPaymentMode('');
      setPaidAmount('');
      setPaymentStatus('Pending');
      setDcNo('');
      setVehicleNo('');
      setDcDate('');
      setDcApproval(false);
    } catch (error) {
      console.error('Error creating jobs:', error);
      toast.error('Error', 'Failed to create jobs. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCard = () => {
    if (!selectedTodayCard) return;

    const card = selectedTodayCard;
    setSelectedCustomer(getCustomer(card.primary.customerId) || null);
    setJobDate(card.primary.date);
    setWorkMode(card.primary.workMode as 'Workshop' | 'Spot');

    const lines: JobLineState[] = card.jobs.map((job) => ({
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

    if (card.primary.dcNo || card.primary.dcApproval) {
      setDcNo(card.primary.dcNo || '');
      setVehicleNo(card.primary.vehicleNo || '');
      setDcDate(card.primary.dcDate || '');
      setDcApproval(card.primary.dcApproval || false);
    }

    if (card.primary.paymentStatus === 'Paid' && card.primary.paidAmount) {
      setPaymentStatus('Paid');
      setPaidAmount(String(card.primary.paidAmount));
      setPaymentMode(card.primary.paymentMode || '');
    }

    setSelectedCardKey(null);
    toast.success('Info', 'Edit mode activated. Modify the form and create to save changes.');
  };

  const handleDeleteCard = () => {
    if (!selectedTodayCard) return;

    const cardId = selectedTodayCard.primary.jobCardId || `LEGACY-${selectedTodayCard.primary.id}`;
    const confirmed = window.confirm(
      `Are you sure you want to delete JobCard ${cardId}?\n\nThis will remove ${selectedTodayCard.jobs.length} job line(s) and cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      selectedTodayCard.jobs.forEach((job) => {
        deleteJob(job.id);
      });
      toast.success('Success', `JobCard ${cardId} deleted`);
      setSelectedCardKey(null);
    } catch (error) {
      console.error('Error deleting job card:', error);
      toast.error('Error', 'Failed to delete job card');
    }
  };

  const handleDeleteAllJobCards = () => {
    const totalCards = groupJobsByCard(jobs).length;
    if (totalCards === 0) {
      toast.error('Error', 'No JobCards available to delete');
      return;
    }

    const confirmed = window.confirm(
      `WARNING: Delete ALL ${totalCards} JobCards?\n\nThis action will permanently remove all job lines from all dates and cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    clearAllJobs();
    toast.success('Success', 'All JobCards deleted');
  };

  return (
    <div className="job-form-container">
      <form onSubmit={handleSubmit} className="job-form">
        <div className="form-section">
          <h2 className="form-title">Create Job</h2>

          <div className="header-fields">
            <div className="form-group">
              <label className="form-label">Customer</label>
              <SearchableSelect
                items={customers}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                getLabel={(c) => (c.shortCode ? `${c.name} (${c.shortCode})` : c.name)}
                getKey={(c) => String(c.id)}
                placeholder="Select customer..."
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="job-date">
                Date
              </label>
              <input
                id="job-date"
                type="date"
                className="form-input"
                value={jobDate}
                onChange={(e) => setJobDate(e.target.value)}
                max={today}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Work Mode</label>
              <div className="mode-buttons">
                <button
                  type="button"
                  className={`mode-btn ${workMode === 'Workshop' ? 'active' : ''}`}
                  onClick={() => setWorkMode('Workshop')}
                >
                  Workshop
                </button>
                <button
                  type="button"
                  className={`mode-btn ${workMode === 'Spot' ? 'active' : ''}`}
                  onClick={() => setWorkMode('Spot')}
                >
                  Spot
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h3 className="section-title">Job Details</h3>
            <button type="button" className="btn btn-secondary btn-add-line" onClick={handleAddLine}>
              Add Line
            </button>
          </div>

          <div className="job-lines">
            {jobLines.map((line, index) => (
              <JobLine
                key={line.id}
                line={line}
                onChange={handleLineChange}
                onRemove={() => handleRemoveLine(line.id)}
                lineNumber={index + 1}
              />
            ))}
          </div>

          <div className="job-summary">
            <div className="summary-item">
              <span className="summary-label">Total Amount</span>
              <span className="summary-value">{formatCurrency(summary.totalAmount)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Commission (Extra)</span>
              <span className="summary-value">{formatCurrency(summary.totalCommission)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Net Value</span>
              <span className="summary-value highlight">{formatCurrency(summary.netValue)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Final Bill (Amt + Comm)</span>
              <span className="summary-value">{formatCurrency(summary.finalValue)}</span>
            </div>
          </div>
        </div>

        {showDcFields ? (
          <div className="form-section dc-section">
            <h3 className="section-title">Delivery Challan</h3>

            <div className="dc-fields">
              <div className="form-group">
                <label className="form-label" htmlFor="dc-no">
                  DC Number
                </label>
                <input
                  id="dc-no"
                  type="text"
                  className="form-input"
                  value={dcNo}
                  onChange={(e) => setDcNo(e.target.value)}
                  placeholder="DC number..."
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="vehicle-no">
                  Vehicle Number
                </label>
                <input
                  id="vehicle-no"
                  type="text"
                  className="form-input"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="Vehicle registration..."
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="dc-date">
                  DC Date
                </label>
                <input
                  id="dc-date"
                  type="date"
                  className="form-input"
                  value={dcDate}
                  onChange={(e) => setDcDate(e.target.value)}
                  max={today}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Approved Without DC</label>
                <ToggleSwitch checked={dcApproval} onChange={setDcApproval} id="dc-approval" />
              </div>
            </div>
            <p className="dc-validation-note">
              Validation rule: DC Number is mandatory, or mark Approved Without DC.
            </p>
          </div>
        ) : null}

        <div className="form-section">
          <h3 className="section-title">Payment</h3>

          <div className="payment-fields">
            <div className="form-group">
              <label className="form-label">Status</label>
              <div className="status-buttons">
                <button
                  type="button"
                  className={`status-btn ${paymentStatus === 'Pending' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentStatus('Pending');
                    setPaymentMode('');
                    setPaidAmount('');
                  }}
                >
                  Pending
                </button>
                <button
                  type="button"
                  className={`status-btn ${paymentStatus === 'Paid' ? 'active' : ''}`}
                  onClick={() => setPaymentStatus('Paid')}
                >
                  Paid
                </button>
              </div>
            </div>

            {paymentStatus === 'Paid' ? (
              <div className="form-group">
                <label className="form-label" htmlFor="paid-amount">
                  Paid Amount (INR)
                </label>
                <input
                  id="paid-amount"
                  type="number"
                  className="form-input"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required={paymentStatus === 'Paid'}
                />
              </div>
            ) : null}

            {paymentStatus === 'Paid' ? (
              <div className="form-group">
                <label className="form-label" htmlFor="payment-mode">
                  Mode
                </label>
                <select
                  id="payment-mode"
                  className="form-input"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  required={paymentStatus === 'Paid'}
                >
                  <option value="">Select mode...</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            ) : null}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary btn-submit"
            disabled={!selectedCustomer || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="loading-spinner-inline" aria-hidden="true">⏳</span>
                Creating...
              </>
            ) : (
              'Create Job'
            )}
          </button>
        </div>
      </form>

      <div className="form-section today-cards-section">
        <div className="section-header">
          <h3 className="section-title">Today's JobCards</h3>
          <div className="today-cards-header-actions">
            <span className="today-cards-count">{todayJobCards.length} cards</span>
            <button
              type="button"
              className="btn btn-secondary btn-danger"
              onClick={handleDeleteAllJobCards}
            >
              Delete All JobCards
            </button>
          </div>
        </div>

        {todayJobCards.length === 0 ? (
          <p className="empty-today-cards">No JobCards created today.</p>
        ) : (
          <div className="today-cards-list">
            {todayJobCards.map((group) => {
              const cardNo = group.primary.jobCardId || `LEGACY-${group.primary.id}`;
              const customerName = getCustomer(group.primary.customerId)?.name || 'Unknown';
              const finalValue = group.totalAmount + group.totalCommission;
              const payment = getJobCardPaymentSummary(group.jobs);

              return (
                <div
                  key={group.key}
                  className="today-card-item today-card-item-clickable"
                  onClick={() => setSelectedCardKey(group.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCardKey(group.key);
                    }
                  }}
                >
                  <div className="today-card-main">
                    <span className="today-card-id">{cardNo}</span>
                    <span className="today-card-customer">{customerName}</span>
                    <StatusBadge status={payment.status} />
                  </div>
                  <div className="today-card-stats">
                    <span>Lines: {group.lineCount}</span>
                    <span>Amt: {formatCurrency(group.totalAmount)}</span>
                    <span>Comm: {formatCurrency(group.totalCommission)}</span>
                    <span>Final: {formatCurrency(finalValue)}</span>
                    <span>Paid: {formatCurrency(payment.paid)}</span>
                    <span>Pending: {formatCurrency(payment.pending)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-view-card"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCardKey(group.key);
                    }}
                  >
                    View JobCard
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <JobCardDetailsModal
        isOpen={Boolean(selectedTodayCard)}
        jobs={selectedTodayCard?.jobs || null}
        onClose={() => setSelectedCardKey(null)}
        getCustomer={getCustomer}
        onEdit={handleEditCard}
        onDelete={handleDeleteCard}
      />
    </div>
  );
}
