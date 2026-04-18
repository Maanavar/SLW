import { useEffect, useMemo, useState } from 'react';
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
import type { CommissionWorker, Customer, Job } from '@/types';
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

function normalizeCustomerValue(value?: string) {
  return (value || '').trim().toLowerCase();
}

function isWagenAutosCustomer(customer?: Customer | null) {
  if (!customer) return false;
  const name = normalizeCustomerValue(customer.name);
  const shortCode = normalizeCustomerValue(customer.shortCode);
  return shortCode === 'wp' || name === 'wagen autos';
}

function isRmpCustomer(customer?: Customer | null) {
  if (!customer) return false;
  const shortCode = normalizeCustomerValue(customer.shortCode);
  const name = normalizeCustomerValue(customer.name);
  return shortCode === 'rmp' || name.includes('ramani motors');
}

function isMahalingamCustomer(customer?: Customer | null) {
  if (!customer) return false;
  const name = normalizeCustomerValue(customer.name).replace(/[^a-z]/g, '');
  const shortCode = normalizeCustomerValue(customer.shortCode);
  return (
    shortCode === 'nm' ||
    name.includes('mahaling') ||
    name.includes('mahalinham')
  );
}

function shouldShowDcFields(customer?: Customer | null) {
  if (!customer) return false;
  return isDcApplicableCustomer(customer) || isMahalingamCustomer(customer);
}

function formatCustomerLabel(customer: Customer) {
  const code = String(customer.shortCode || '').trim();
  const safeCode = code !== '0' ? code : '';
  return safeCode ? `${customer.name} (${safeCode})` : customer.name;
}

export function JobForm() {
  const { getActiveCustomers, getCustomer, jobs, addJobsBulk, updateJob, deleteJob, getCommissionWorkersForCustomer, updateCustomer } = useDataStore();
  const toast = useToast();

  const customers = useMemo(() => {
    const jobCountByCustomer: Record<number, number> = {};
    jobs.forEach((job) => {
      jobCountByCustomer[job.customerId] = (jobCountByCustomer[job.customerId] || 0) + 1;
    });
    return getActiveCustomers().sort((a, b) => {
      const diff = (jobCountByCustomer[b.id] || 0) - (jobCountByCustomer[a.id] || 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [getActiveCustomers, jobs]);
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
      commissionWorker: null,
    },
  ]);
  const [workMode, setWorkMode] = useState<'Workshop' | 'Spot'>('Workshop');
  const [paymentMode, setPaymentMode] = useState('');
  const [dcNo, setDcNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [dcDate, setDcDate] = useState('');
  const [dcApproval, setDcApproval] = useState(false);
  const [rmpHandler, setRmpHandler] = useState<'Bhai' | 'Raja' | null>(null);
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
  const [cardCommissionWorker, setCardCommissionWorker] = useState<CommissionWorker | null>(null);
  const [cardTotalCommission, setCardTotalCommission] = useState('');

  const showDcFields = shouldShowDcFields(selectedCustomer);
  const showVehicleNoField = showDcFields && !isWagenAutosCustomer(selectedCustomer);
  const showCommissionFields = isCommissionApplicableCustomer(selectedCustomer);
  const showRmpHandlerField = isRmpCustomer(selectedCustomer);
  const commissionWorkersForCustomer = showCommissionFields && selectedCustomer
    ? getCommissionWorkersForCustomer(selectedCustomer.id)
    : [];
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

  useEffect(() => {
    if (!showRmpHandlerField || !rmpHandler) return;
    const matched = sortedCommissionWorkers.find(
      (w) => w.name.trim().toLowerCase() === rmpHandler.toLowerCase()
    );
    if (matched) setCardCommissionWorker(matched);
  }, [rmpHandler, showRmpHandlerField, sortedCommissionWorkers]);

  useEffect(() => {
    if (!showRmpHandlerField) setRmpHandler(null);
  }, [showRmpHandlerField]);

  const totalAmount = jobLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  const totalCommission = parseFloat(cardTotalCommission) || 0;
  const summary = {
    totalAmount,
    totalCommission,
    netValue: totalAmount,
    finalValue: totalAmount + totalCommission,
  };

  useEffect(() => {
    if (!showCommissionFields) {
      setJobLines((prev) =>
        prev.map((line) => ({
          ...line,
          commission: '0',
          commissionWorker: null,
        }))
      );
      setCardCommissionWorker(null);
      setCardTotalCommission('');
    }
  }, [showCommissionFields]);

  useEffect(() => {
    if (dcNo.trim() || (showVehicleNoField && vehicleNo.trim()) || dcDate) {
      setDcApproval(false);
    }
  }, [dcNo, vehicleNo, dcDate, showVehicleNoField]);

  useEffect(() => {
    if (!showVehicleNoField && vehicleNo) {
      setVehicleNo('');
    }
  }, [showVehicleNoField, vehicleNo]);

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
  const [showReceivedBreakdown, setShowReceivedBreakdown] = useState(false);

  const jobCardsMetrics = useMemo(() => {
    let totalFinal = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let byCash = 0;
    let byBank = 0;
    let byUPI = 0;
    let byCheque = 0;

    todayJobCards.forEach((group) => {
      const payment = getJobCardPaymentSummary(group.jobs);
      totalFinal += payment.finalBill;
      totalPaid += payment.paid;
      totalPending += payment.pending;

      group.jobs.forEach((job) => {
        const paid = job.paidAmount || 0;
        if (paid > 0) {
          if (job.paymentMode === 'Cash') byCash += paid;
          else if (job.paymentMode === 'Bank') byBank += paid;
          else if (job.paymentMode === 'UPI') byUPI += paid;
          else if (job.paymentMode === 'Cheque') byCheque += paid;
        }
      });
    });

    return {
      count: todayJobCards.length,
      totalFinal,
      totalPaid,
      totalPending,
      byCash,
      byBank,
      byUPI,
      byCheque,
    };
  }, [todayJobCards]);
  const emptyCardsMessage =
    cardViewMode === 'today'
      ? 'No JobCards created today.'
      : 'No JobCards found for the selected date range.';

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
    // If commission is not applicable, set it to 0
    const finalLine = showCommissionFields ? updatedLine : { ...updatedLine, commission: '0' };
    setJobLines(jobLines.map((line) => (line.id === updatedLine.id ? finalLine : line)));
  };

  const handleCommissionWorkerChange = (lineId: string, worker: CommissionWorker | null) => {
    setJobLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, commissionWorker: worker } : line))
    );
  };

  const handleCommissionValueChange = (lineId: string, value: string) => {
    setJobLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, commission: value } : line)));
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
          ? getPaymentStatusFromAmounts(enteredPaidAmount, summary.finalValue)
          : 'Pending';

      if (isEditMode && editingJobIds.length > 0) {
        // EDIT MODE: Update existing jobs
        await Promise.all(
          jobLines.map((line, index) =>
            updateJob(editingJobIds[index], {
              date: jobDate,
              workTypeName: line.workType!.name,
              workName: line.workType!.shortCode,
              quantity: line.quantity,
              amount: parseFloat(line.amount),
              commissionAmount: index === 0 ? parseFloat(cardTotalCommission) || 0 : 0,
              commissionWorkerId:
                showCommissionFields && cardCommissionWorker ? cardCommissionWorker.id : undefined,
              commissionWorkerName:
                showCommissionFields && cardCommissionWorker ? cardCommissionWorker.name : undefined,
              netAmount: parseFloat(line.amount),
              paymentStatus: resolvedPaymentStatus,
              paymentMode: paymentStatus === 'Paid' ? paymentMode : undefined,
              paidAmount: index === 0 && enteredPaidAmount > 0 ? enteredPaidAmount : 0,
              workMode,
              isSpotWork: workMode === 'Spot',
              notes: notes.trim() ? notes.trim() : null,
              ...(showDcFields && {
                dcNo: dcNo || undefined,
                vehicleNo: showVehicleNoField ? vehicleNo || undefined : undefined,
                dcDate: dcDate || undefined,
                dcApproval: dcApproval || undefined,
              }),
              rmpHandler: showRmpHandlerField ? rmpHandler : null,
            })
          )
        );

        // Create advance if payment > finalBill (edit mode)
        if (selectedCustomer && paymentStatus === 'Paid') {
          const enteredPaidAmount = parseFloat(paidAmount) || 0;
          const overpayment = Math.max(0, enteredPaidAmount - summary.finalValue);
          if (overpayment > 0) {
            const currentAdvance = selectedCustomer.advanceBalance || 0;
            await updateCustomer(selectedCustomer.id, {
              advanceBalance: currentAdvance + overpayment,
            });
            toast.info('Advance Created', `₹${overpayment.toFixed(2)} saved as advance for ${selectedCustomer.name}`);
          }
        }

        // Deduct advance if it was applied during edit
        if (selectedCustomer && paymentStatus === 'Paid') {
          const enteredPaidAmount = parseFloat(paidAmount) || 0;
          const currentAdvance = selectedCustomer.advanceBalance || 0;
          const advanceUsed = Math.min(enteredPaidAmount, currentAdvance);
          if (advanceUsed > 0 && advanceUsed < currentAdvance) {
            // Only deduct if not creating advance
            await updateCustomer(selectedCustomer.id, {
              advanceBalance: Math.max(0, currentAdvance - advanceUsed),
            });
          }
        }

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
          commissionAmount: index === 0 ? parseFloat(cardTotalCommission) || 0 : 0,
          commissionWorkerId:
            showCommissionFields && cardCommissionWorker ? cardCommissionWorker.id : undefined,
          commissionWorkerName:
            showCommissionFields && cardCommissionWorker ? cardCommissionWorker.name : undefined,
          netAmount: parseFloat(line.amount),
          date: jobDate,
          paymentStatus: resolvedPaymentStatus,
          paymentMode: paymentStatus === 'Paid' ? paymentMode : undefined,
          paidAmount: index === 0 && enteredPaidAmount > 0 ? enteredPaidAmount : 0,
          workMode,
          isSpotWork: workMode === 'Spot',
          jobCardId,
          jobCardLine: index + 1,
          notes: notes.trim() ? notes.trim() : null,
          ...(showDcFields && {
            dcNo: dcNo || undefined,
            vehicleNo: showVehicleNoField ? vehicleNo || undefined : undefined,
            dcDate: dcDate || undefined,
            dcApproval: dcApproval || undefined,
          }),
          rmpHandler: showRmpHandlerField ? rmpHandler : null,
        }));

        await addJobsBulk(newJobs);
        toast.success('Success', `JobCard ${jobCardId} created with ${newJobs.length} line(s)`);

        // Create advance if payment > finalBill
        if (selectedCustomer && paymentStatus === 'Paid') {
          const enteredPaidAmount = parseFloat(paidAmount) || 0;
          const overpayment = Math.max(0, enteredPaidAmount - summary.finalValue);
          if (overpayment > 0) {
            const currentAdvance = selectedCustomer.advanceBalance || 0;
            await updateCustomer(selectedCustomer.id, {
              advanceBalance: currentAdvance + overpayment,
            });
            toast.info('Advance Created', `₹${overpayment.toFixed(2)} saved as advance for ${selectedCustomer.name}`);
          }
        }
      }

      // Deduct advance if it was applied during creation (edit mode)
      if (selectedCustomer && paymentStatus === 'Paid') {
        const enteredPaidAmount = parseFloat(paidAmount) || 0;
        const currentAdvance = selectedCustomer.advanceBalance || 0;
        const advanceUsed = Math.min(enteredPaidAmount, currentAdvance);
        if (advanceUsed > 0) {
          await updateCustomer(selectedCustomer.id, {
            advanceBalance: Math.max(0, currentAdvance - advanceUsed),
          });
        }
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
          commissionWorker: null,
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
      setRmpHandler(null);
      setNotes('');
      setCardCommissionWorker(null);
      setCardTotalCommission('');
      setSelectedCardKey(null);
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

    const editCustomer = getCustomer(cardToEdit.primary.customerId) || null;
    const editWorkers = editCustomer ? getCommissionWorkersForCustomer(editCustomer.id) : [];
    setSelectedCustomer(editCustomer);
    setJobDate(cardToEdit.primary.date);
    setWorkMode(cardToEdit.primary.workMode as 'Workshop' | 'Spot');

    const lines: JobLineState[] = cardToEdit.jobs.map((job) => {
      const legacyDistribution = (job as Job & { commissionDistribution?: Array<{ workerId?: number }> })
        .commissionDistribution;
      const fallbackWorkerId = Array.isArray(legacyDistribution) ? legacyDistribution[0]?.workerId : undefined;
      const resolvedWorkerId = job.commissionWorkerId ?? fallbackWorkerId;
      const commissionWorker =
        resolvedWorkerId !== undefined
          ? editWorkers.find((w) => w.id === resolvedWorkerId) || null
          : null;

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
        commission: String(job.commissionAmount || 0),
        commissionWorker:
          commissionWorker ||
          (job.commissionWorkerName
            ? editWorkers.find((w) => w.name === job.commissionWorkerName) || null
            : null),
      };
    });

    setJobLines(lines);
    setNotes(cardToEdit.primary.notes || '');

    // Set card-level commission from first job
    const firstJob = cardToEdit.primary;
    if (firstJob.commissionWorkerId) {
      const commissionWorker = editWorkers.find((w) => w.id === firstJob.commissionWorkerId);
      setCardCommissionWorker(commissionWorker || null);
    }
    setCardTotalCommission(String(firstJob.commissionAmount || 0));

    if (cardToEdit.primary.dcNo || cardToEdit.primary.dcApproval) {
      setDcNo(cardToEdit.primary.dcNo || '');
      setVehicleNo(cardToEdit.primary.vehicleNo || '');
      setDcDate(cardToEdit.primary.dcDate || '');
      setDcApproval(cardToEdit.primary.dcApproval || false);
    }

    if (cardToEdit.primary.rmpHandler) {
      setRmpHandler(cardToEdit.primary.rmpHandler as 'Bhai' | 'Raja');
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
      <div className="jobs-page-header">
        <div className="jobs-title-block">
          <h2 className="form-title">{isEditMode ? 'Update JobCard' : 'Create Job'}</h2>
          <p className="jobs-subtitle">
            Capture job details quickly and track recent cards in one place.
          </p>
        </div>
        <span className="jobs-header-pill">{jobCardsMetrics.count} cards in view</span>
      </div>

      <form onSubmit={handleSubmit} className="job-form">
        <div className="form-section">
          <h3 className="section-title job-info-title">Job Information</h3>

          <div className="header-fields">
            <div className="form-group">
              <label className="form-label">Customer</label>
              <SearchableSelect
                items={customers}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                getLabel={formatCustomerLabel}
                getKey={(c) => String(c.id)}
                placeholder="Select customer..."
                disabled={isEditMode}
              />
              {isEditMode && (
                <p className="form-hint-text">Customer cannot be changed when editing a job card.</p>
              )}
              {selectedCustomer && (
                <>
                  {(selectedCustomer.advanceBalance || 0) > 0 && (
                    <div className="customer-info-banner advance">
                      ✓ {selectedCustomer.name} has {formatCurrency(selectedCustomer.advanceBalance)} advance. Apply it in the Payment section below.
                    </div>
                  )}
                  {(() => {
                    const customerJobs = jobs.filter((j) => j.customerId === selectedCustomer.id);
                    const outstanding = customerJobs.reduce((sum, job) => {
                      const jobDue = (Number(job.amount) || 0) + (Number(job.commissionAmount) || 0);
                      const jobPaid = job.paidAmount || 0;
                      return sum + Math.max(0, jobDue - jobPaid);
                    }, 0);

                    if (outstanding > 0) {
                      return (
                        <div className="customer-info-banner backlog">
                          ⚠️ {selectedCustomer.name} has {formatCurrency(outstanding)} backlog (unpaid previous jobs).
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
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
                showInlineWorker={false}
                showInlineCommission={false}
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
              <span className="summary-label">{showCommissionFields ? 'Our Net Income' : 'Total Value'}</span>
              <span className="summary-value highlight">{formatCurrency(summary.netValue)}</span>
            </div>
          </div>
        </div>

        {showRmpHandlerField && (
          <div className="form-section">
            <h3 className="section-title">RMP Handler</h3>
            <div className="rmp-handler-buttons">
              {(['Bhai', 'Raja'] as const).map((handler) => (
                <button
                  key={handler}
                  type="button"
                  className={`status-btn${rmpHandler === handler ? ' active' : ''}`}
                  onClick={() => setRmpHandler(rmpHandler === handler ? null : handler)}
                >
                  {handler}
                </button>
              ))}
            </div>
            <p className="dc-validation-note">
              Bhai handles people vehicles · Raja handles commercial vehicles. Commission is auto-assigned.
            </p>
          </div>
        )}

        {showCommissionFields && (
          <div className="form-section commission-assignment-section">
            <div className="section-header">
              <h3 className="section-title">Commission Assignment</h3>
              <span className="commission-assignment-note">
                One job card can be tagged to only one commission worker.
              </span>
            </div>

            {sortedCommissionWorkers.length === 0 ? (
              <p className="dc-validation-note">
                No commission workers found for this customer. Add workers in Customer settings.
              </p>
            ) : (
              <div className="commission-assignment-simple">
                <div className="form-group">
                  <label className="form-label">Commission Worker</label>
                  <SearchableSelect
                    items={sortedCommissionWorkers}
                    value={cardCommissionWorker}
                    onChange={setCardCommissionWorker}
                    getLabel={(w) => w.name}
                    getKey={(w) => String(w.id)}
                    placeholder="Select worker..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Commission (INR)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={cardTotalCommission}
                    onChange={(e) => setCardTotalCommission(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            )}
          </div>
        )}

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

              {showVehicleNoField ? (
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
              ) : null}

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
                <label className="form-label">Mark as DC-Exempt</label>
                <ToggleSwitch
                  checked={dcApproval}
                  onChange={setDcApproval}
                  id="dc-approval"
                  disabled={!!(dcNo.trim() || (showVehicleNoField && vehicleNo.trim()) || dcDate)}
                />
              </div>
            </div>
            <p className="dc-validation-note">
              Enter a DC Number, or toggle Mark as DC-Exempt if approved without one.
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
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
                  {summary.finalValue > 0 && (
                    <button
                      type="button"
                      className="suggestion-chip suggestion-chip-action"
                      onClick={() => {
                        const customerJobs = jobs.filter((j) => j.customerId === selectedCustomer?.id);
                        const backlog = customerJobs.reduce((sum, job) => {
                          const jobDue = (Number(job.amount) || 0) + (Number(job.commissionAmount) || 0);
                          const jobPaid = job.paidAmount || 0;
                          return sum + Math.max(0, jobDue - jobPaid);
                        }, 0);
                        const advance = selectedCustomer?.advanceBalance || 0;
                        const totalNeeded = backlog + summary.finalValue - advance;
                        setPaidAmount(String(Math.max(0, totalNeeded)));
                      }}
                      title={(() => {
                        const customerJobs = jobs.filter((j) => j.customerId === selectedCustomer?.id);
                        const backlog = customerJobs.reduce((sum, job) => {
                          const jobDue = (Number(job.amount) || 0) + (Number(job.commissionAmount) || 0);
                          const jobPaid = job.paidAmount || 0;
                          return sum + Math.max(0, jobDue - jobPaid);
                        }, 0);
                        const advance = selectedCustomer?.advanceBalance || 0;
                        if (backlog > 0 && advance > 0) {
                          return `Backlog (${formatCurrency(backlog)}) + Current (${formatCurrency(summary.finalValue)}) - Advance (${formatCurrency(advance)})`;
                        } else if (backlog > 0) {
                          return `Backlog (${formatCurrency(backlog)}) + Current (${formatCurrency(summary.finalValue)})`;
                        } else if (advance > 0) {
                          return `Current (${formatCurrency(summary.finalValue)}) - Advance (${formatCurrency(advance)})`;
                        }
                        return "Fill with total amount due";
                      })()}
                    >
                      Fill: {(() => {
                        const customerJobs = jobs.filter((j) => j.customerId === selectedCustomer?.id);
                        const backlog = customerJobs.reduce((sum, job) => {
                          const jobDue = (Number(job.amount) || 0) + (Number(job.commissionAmount) || 0);
                          const jobPaid = job.paidAmount || 0;
                          return sum + Math.max(0, jobDue - jobPaid);
                        }, 0);
                        const advance = selectedCustomer?.advanceBalance || 0;
                        return formatCurrency(Math.max(0, backlog + summary.finalValue - advance));
                      })()}
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
            disabled={
              !selectedCustomer ||
              isSubmitting ||
              (showCommissionFields && sortedCommissionWorkers.length === 0)
            }
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
                    commissionWorker: null,
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
                setRmpHandler(null);
                setNotes('');
                setCardCommissionWorker(null);
                setCardTotalCommission('');
                setSelectedCardKey(null);
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
        <div className="jobs-cards-header">
          <div className="jobs-cards-title-wrap">
            <h3 className="section-title">JobCards</h3>
            <p className="jobs-cards-subtitle">Click any card to view, edit, or delete.</p>
          </div>
          <div className="jobs-cards-toolbar">
            <div className="jobs-cards-control-group">
              <span className="jobs-control-label">Scope</span>
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
            </div>

            {cardViewMode === 'range' && (
              <div className="jobs-cards-control-group">
                <span className="jobs-control-label">Range</span>
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
              </div>
            )}

            <span className="jobs-results-pill">{jobCardsMetrics.count} cards</span>
          </div>
        </div>

        <div className="jobs-cards-summary">
          <div className="jobs-card-stat">
            <span className="jobs-card-stat-label">Final Bill</span>
            <span className="jobs-card-stat-value">{formatCurrency(jobCardsMetrics.totalFinal)}</span>
          </div>
          <div
            className={`jobs-card-stat jobs-card-stat--positive${jobCardsMetrics.totalPaid > 0 ? ' jobs-card-stat--hoverable' : ''}`}
            onMouseEnter={() => jobCardsMetrics.totalPaid > 0 && setShowReceivedBreakdown(true)}
            onMouseLeave={() => setShowReceivedBreakdown(false)}
          >
            <span className="jobs-card-stat-label">Received</span>
            <span className="jobs-card-stat-value">{formatCurrency(jobCardsMetrics.totalPaid)}</span>
            {showReceivedBreakdown && (
              <div className="jobs-stat-breakdown">
                {jobCardsMetrics.byCash > 0 && (
                  <div className="jobs-stat-breakdown-row"><span>Cash</span><span>{formatCurrency(jobCardsMetrics.byCash)}</span></div>
                )}
                {jobCardsMetrics.byBank > 0 && (
                  <div className="jobs-stat-breakdown-row"><span>Bank</span><span>{formatCurrency(jobCardsMetrics.byBank)}</span></div>
                )}
                {jobCardsMetrics.byUPI > 0 && (
                  <div className="jobs-stat-breakdown-row"><span>UPI</span><span>{formatCurrency(jobCardsMetrics.byUPI)}</span></div>
                )}
                {jobCardsMetrics.byCheque > 0 && (
                  <div className="jobs-stat-breakdown-row"><span>Cheque</span><span>{formatCurrency(jobCardsMetrics.byCheque)}</span></div>
                )}
              </div>
            )}
          </div>
          <div className="jobs-card-stat jobs-card-stat--warning">
            <span className="jobs-card-stat-label">Pending</span>
            <span className="jobs-card-stat-value">{formatCurrency(jobCardsMetrics.totalPending)}</span>
          </div>
        </div>

        {todayJobCards.length === 0 ? (
          <p className="empty-today-cards">{emptyCardsMessage}</p>
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
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
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
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="today-card-stats">
                    <span>Final: {formatCurrency(payment.finalBill)}</span>
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

