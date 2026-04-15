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
  isCommissionApplicableCustomer,
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
  const { getActiveCustomers, getCustomer, jobs, addJobsBulk, updateJob, deleteJob } = useDataStore();
  const toast = useToast();

  const customers = getActiveCustomers().sort((a, b) => a.name.localeCompare(b.name));
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
  const [notes, setNotes] = useState('');
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardViewMode, setCardViewMode] = useState<'today' | 'range'>('today');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState(today);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingJobIds, setEditingJobIds] = useState<number[]>([]);

  const showDcFields = isDcApplicableCustomer(selectedCustomer);
  const showCommissionFields = isCommissionApplicableCustomer(selectedCustomer);

  const totalAmount = jobLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  const totalCommission = jobLines.reduce((sum, line) => sum + (parseFloat(line.commission) || 0), 0);
  const summary = {
    totalAmount,
    totalCommission,
    netValue: totalAmount - totalCommission,
    finalValue: totalAmount + totalCommission,
  };

  const todayJobCards = useMemo(() => {
    let filteredJobs = jobs;

    if (cardViewMode === 'today') {
      // Show only today's jobs
      filteredJobs = jobs.filter((job) => job.date === today);
    } else if (cardViewMode === 'range') {
      // Show jobs in the selected date range
      if (filterStartDate && filterEndDate) {
        filteredJobs = jobs.filter((job) => job.date >= filterStartDate && job.date <= filterEndDate);
      }
    }

    const groups = groupJobsByCard(filteredJobs);

    return groups.sort((a, b) => {
      const aTime = new Date(a.primary.createdAt || a.primary.date).getTime();
      const bTime = new Date(b.primary.createdAt || b.primary.date).getTime();
      return bTime - aTime;
    });
  }, [jobs, today, cardViewMode, filterStartDate, filterEndDate]);

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
    // If commission is not applicable, set it to 0
    const finalLine = showCommissionFields ? updatedLine : { ...updatedLine, commission: '0' };
    setJobLines(jobLines.map((line) => (line.id === updatedLine.id ? finalLine : line)));
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

    if (showCommissionFields && jobLines.some((line) => line.commission === '' || parseFloat(line.commission) < 0)) {
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
      const enteredPaidAmount = paymentStatus === 'Paid' ? parseFloat(paidAmount) || 0 : 0;
      const resolvedPaymentStatus =
        paymentStatus === 'Paid'
          ? getPaymentStatusFromAmounts(enteredPaidAmount, summary.netValue)
          : 'Pending';

      if (isEditMode && editingJobIds.length > 0) {
        // EDIT MODE: Update existing jobs
        await Promise.all(
          jobLines.map((line, index) =>
            updateJob(editingJobIds[index], {
              workTypeName: line.workType!.name,
              workName: line.workType!.shortCode,
              quantity: line.quantity,
              amount: parseFloat(line.amount),
              commissionAmount: parseFloat(line.commission) || 0,
              netAmount: parseFloat(line.amount),
              paymentStatus: resolvedPaymentStatus,
              paymentMode: paymentStatus === 'Paid' ? paymentMode : undefined,
              paidAmount: index === 0 && enteredPaidAmount > 0 ? enteredPaidAmount : 0,
              workMode,
              isSpotWork: workMode === 'Spot',
              notes: notes || undefined,
              ...(showDcFields && {
                dcNo: dcNo || undefined,
                vehicleNo: vehicleNo || undefined,
                dcDate: dcDate || undefined,
                dcApproval: dcApproval || undefined,
              }),
            })
          )
        );

        toast.success('Success', 'JobCard updated successfully');
        setIsEditMode(false);
        setEditingJobIds([]);
      } else {
        // CREATE MODE: Create new jobs
        const jobCardId = generateJobCardId(jobDate, jobs);
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
          notes: notes || undefined,
          ...(showDcFields && {
            dcNo: dcNo || undefined,
            vehicleNo: vehicleNo || undefined,
            dcDate: dcDate || undefined,
            dcApproval: dcApproval || undefined,
          }),
        }));

        await addJobsBulk(newJobs);
        toast.success('Success', `JobCard ${jobCardId} created with ${newJobs.length} line(s)`);
      }

      // Reset form
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
      setNotes('');
    } catch (error) {
      console.error('Error saving job:', error);
      toast.error('Error', `Failed to ${isEditMode ? 'update' : 'create'} job. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCard = (card?: typeof selectedTodayCard) => {
    const cardToEdit = card || selectedTodayCard;
    if (!cardToEdit) return;

    setSelectedCustomer(getCustomer(cardToEdit.primary.customerId) || null);
    setJobDate(cardToEdit.primary.date);
    setWorkMode(cardToEdit.primary.workMode as 'Workshop' | 'Spot');

    const lines: JobLineState[] = cardToEdit.jobs.map((job) => ({
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
    setNotes(cardToEdit.primary.notes || '');

    if (cardToEdit.primary.dcNo || cardToEdit.primary.dcApproval) {
      setDcNo(cardToEdit.primary.dcNo || '');
      setVehicleNo(cardToEdit.primary.vehicleNo || '');
      setDcDate(cardToEdit.primary.dcDate || '');
      setDcApproval(cardToEdit.primary.dcApproval || false);
    }

    if (cardToEdit.primary.paymentStatus === 'Paid' && cardToEdit.primary.paidAmount) {
      setPaymentStatus('Paid');
      setPaidAmount(String(cardToEdit.primary.paidAmount));
      setPaymentMode(cardToEdit.primary.paymentMode || '');
    }

    setEditingJobIds(cardToEdit.jobs.map((j) => j.id));
    setIsEditMode(true);
    setSelectedCardKey(null);
    toast.success('Info', 'Edit mode activated. Modify and click "Update Job" to save changes.');
  };

  const handleDeleteCard = async (card?: typeof selectedTodayCard) => {
    const cardToDelete = card || selectedTodayCard;
    if (!cardToDelete) return;

    const cardId = cardToDelete.primary.jobCardId || `LEGACY-${cardToDelete.primary.id}`;
    const confirmed = window.confirm(
      `Are you sure you want to delete JobCard ${cardId}?\n\nThis will remove ${cardToDelete.jobs.length} job line(s) and cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(cardToDelete.jobs.map((job) => deleteJob(job.id)));
      toast.success('Success', `JobCard ${cardId} deleted`);
      setSelectedCardKey(null);
    } catch (error) {
      console.error('Error deleting job card:', error);
      toast.error('Error', 'Failed to delete job card');
    }
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
                showCommission={showCommissionFields}
              />
            ))}
          </div>

          <div className="job-summary">
            <div className="summary-item">
              <span className="summary-label">Total Amount</span>
              <span className="summary-value">{formatCurrency(summary.totalAmount)}</span>
            </div>
            {showCommissionFields && (
              <>
                <div className="summary-item">
                  <span className="summary-label">Commission (Extra)</span>
                  <span className="summary-value">{formatCurrency(summary.totalCommission)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Final Bill (Amt + Comm)</span>
                  <span className="summary-value">{formatCurrency(summary.finalValue)}</span>
                </div>
              </>
            )}
            <div className="summary-item">
              <span className="summary-label">{showCommissionFields ? 'Net Value' : 'Total Value'}</span>
              <span className="summary-value highlight">{formatCurrency(summary.netValue)}</span>
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
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
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
                <ToggleSwitch
                  checked={dcApproval}
                  onChange={setDcApproval}
                  id="dc-approval"
                  disabled={!!(dcNo.trim() || vehicleNo.trim() || dcDate)}
                />
              </div>
            </div>
            <p className="dc-validation-note">
              Validation rule: DC Number is mandatory, or mark Approved Without DC.
            </p>
          </div>
        ) : null}

        <div className="form-section">
          <h3 className="section-title">Notes</h3>

          <div className="form-group">
            <label className="form-label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or remarks about this job card..."
              rows={3}
            />
          </div>
        </div>

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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
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
                    style={{ flex: 1 }}
                  />
                  {summary.netValue > 0 && (
                    <button
                      type="button"
                      className="suggestion-chip suggestion-chip-action"
                      onClick={() => setPaidAmount(String(summary.netValue))}
                      style={{ marginTop: '8px', whiteSpace: 'nowrap' }}
                      title="Fill with net value"
                    >
                      Fill: {formatCurrency(summary.netValue)}
                    </button>
                  )}
                </div>
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
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              isEditMode ? 'Update Job' : 'Create Job'
            )}
          </button>
          {isEditMode && (
            <button
              type="button"
              className="btn btn-secondary btn-submit"
              onClick={() => {
                setIsEditMode(false);
                setEditingJobIds([]);
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
                setNotes('');
                toast.info('Info', 'Edit cancelled');
              }}
              disabled={isSubmitting}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <div className="form-section today-cards-section">
        <div className="section-header">
          <h3 className="section-title">JobCards</h3>
          <div className="today-cards-header-controls">
            <div className="view-mode-buttons">
              <button
                type="button"
                className={`mode-btn ${cardViewMode === 'today' ? 'active' : ''}`}
                onClick={() => {
                  setCardViewMode('today');
                  setSelectedCardKey(null);
                }}
                title="Show today's job cards only"
              >
                Today
              </button>
              <button
                type="button"
                className={`mode-btn ${cardViewMode === 'range' ? 'active' : ''}`}
                onClick={() => {
                  setCardViewMode('range');
                  setFilterStartDate(today);
                  setFilterEndDate(today);
                  setSelectedCardKey(null);
                }}
                title="Show job cards from a date range"
              >
                Range
              </button>
            </div>

            {cardViewMode === 'range' && (
              <div className="date-range-wrapper">
                <input
                  type="date"
                  className="filter-date-input"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  max={today}
                  title="Start date"
                  aria-label="From date"
                />
                <span className="date-range-separator">to</span>
                <input
                  type="date"
                  className="filter-date-input"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  max={today}
                  title="End date"
                  aria-label="To date"
                />
              </div>
            )}

            <span className="today-cards-count">{todayJobCards.length}</span>
          </div>
        </div>

        {todayJobCards.length === 0 ? (
          <p className="empty-today-cards">No JobCards created today.</p>
        ) : (
          <div className="today-cards-list">
            {todayJobCards.map((group) => {
              const cardNo = group.primary.jobCardId || `LEGACY-${group.primary.id}`;
              const customerName = getCustomer(group.primary.customerId)?.name || 'Unknown';
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
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                      <span className="today-card-id">{cardNo}</span>
                      <span className="today-card-customer">{customerName}</span>
                      <StatusBadge status={payment.status} />
                    </div>
                    <div className="today-card-actions">
                      <button
                        type="button"
                        className="icon-btn icon-edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCard(group);
                        }}
                        title="Edit this job card"
                        aria-label="Edit"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCard(group);
                        }}
                        title="Delete this job card"
                        aria-label="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <div className="today-card-stats">
                    <span>{formatCurrency(group.totalAmount)}</span>
                    <span>Paid: {formatCurrency(payment.paid)}</span>
                    <span>Pending: {formatCurrency(payment.pending)}</span>
                  </div>
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
