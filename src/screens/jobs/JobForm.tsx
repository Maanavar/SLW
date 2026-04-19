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
  return shortCode === 'wgn' || name === 'wagen autos';
}

function isRmpCustomer(customer?: Customer | null) {
  if (!customer) return false;
  const shortCode = normalizeCustomerValue(customer.shortCode);
  const name = normalizeCustomerValue(customer.name);
  return shortCode === 'rmp' || name.includes('ramani motors');
}

function shouldShowDcFields(customer?: Customer | null) {
  if (!customer) return false;
  return isDcApplicableCustomer(customer);
}

function formatCustomerLabel(customer: Customer) {
  const code = String(customer.shortCode || '').trim();
  const safeCode = code !== '0' ? code : '';
  return safeCode ? `${customer.name} (${safeCode})` : customer.name;
}

type SubmittedSortKey = 'customer' | 'lines' | 'finalBill' | 'status';

const paymentStatusOrder: Record<'Paid' | 'Pending' | 'Partially Paid', number> = {
  Pending: 0,
  'Partially Paid': 1,
  Paid: 2,
};

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
  const [paymentMode, setPaymentMode] = useState('Cash');
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
  const [submittedSort, setSubmittedSort] = useState<{ key: SubmittedSortKey; order: 'asc' | 'desc' }>(
    { key: 'finalBill', order: 'desc' }
  );

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
  const nextCardId = useMemo(() => generateJobCardId(jobDate, jobs), [jobDate, jobs]);

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

  useEffect(() => {
    const val = parseFloat(paidAmount);
    if (!isNaN(val) && val > 0) {
      setPaymentStatus('Paid');
    } else {
      setPaymentStatus('Pending');
    }
  }, [paidAmount]);

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
  const sortedTodayJobCards = useMemo(() => {
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base' });
    const direction = submittedSort.order === 'asc' ? 1 : -1;
    return [...todayJobCards].sort((a, b) => {
      if (submittedSort.key === 'customer') {
        const aName = getCustomer(a.primary.customerId)?.name || 'Unknown';
        const bName = getCustomer(b.primary.customerId)?.name || 'Unknown';
        return collator.compare(aName, bName) * direction;
      }

      if (submittedSort.key === 'lines') {
        return (a.jobs.length - b.jobs.length) * direction;
      }

      if (submittedSort.key === 'finalBill') {
        const aBill = getJobCardPaymentSummary(a.jobs).finalBill;
        const bBill = getJobCardPaymentSummary(b.jobs).finalBill;
        return (aBill - bBill) * direction;
      }

      const aStatus = getJobCardPaymentSummary(a.jobs).status;
      const bStatus = getJobCardPaymentSummary(b.jobs).status;
      return (paymentStatusOrder[aStatus] - paymentStatusOrder[bStatus]) * direction;
    });
  }, [todayJobCards, submittedSort, getCustomer]);
  const toggleSubmittedSort = (key: SubmittedSortKey) => {
    setSubmittedSort((prev) =>
      prev.key === key
        ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key === 'finalBill' ? 'desc' : 'asc' }
    );
  };
  const submittedSortMark = (key: SubmittedSortKey) => {
    if (submittedSort.key !== key) return '↕';
    return submittedSort.order === 'asc' ? '↑' : '↓';
  };
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
      toast.error('Error', 'For DC customers, enter DC Number or mark DC waived');
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
              notes: notes.trim() || undefined,
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
          notes: notes.trim() || undefined,
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

      // Reset form (keep current date per design spec)
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
      setPaymentMode('Cash');
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
    toast.success('Info', 'Edit mode activated. Modify and click "Update job card" to save changes.');
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

  const handleReset = () => {
    setSelectedCustomer(null);
    setJobLines([{ id: Date.now().toString(), workType: null, quantity: 1, amount: '', commission: '', commissionWorker: null }]);
    setWorkMode('Workshop');
    setPaymentMode('Cash');
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
    if (isEditMode) {
      setIsEditMode(false);
      setEditingJobIds([]);
    }
    setSelectedCardKey(null);
  };

  const typeVariant: Record<string, string> = {
    Monthly: 'flag-monthly',
    Invoice: 'flag-invoice',
    'Party-Credit': 'flag-party-credit',
    Cash: 'flag-cash',
  };

  const todayLabel = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  return (
    <div className="jobs-screen">

      {/* Page header */}
      <div className="jobs-pg-header">
        <div>
          <h1 className="jobs-pg-title">Jobs <span className="jobs-pg-title-ta tamil">வேலைகள்</span></h1>
          <p className="jobs-pg-desc">Create daily job cards and review today's work</p>
        </div>
        <span className="jobs-cardid-badge">
          Card ID <strong className="mono">{nextCardId}</strong>
        </span>
      </div>

      {/* 2-column top grid */}
      <div className="jobs-top-grid">

        {/* Left: New job card */}
        <div className="njc-panel">
          <div className="njc-head">
            <span className="njc-heading">{isEditMode ? 'Update job card' : 'New job card'}</span>
            <span className="njc-auto-id">Auto ID · <strong className="mono">{nextCardId}</strong></span>
          </div>

          <form onSubmit={handleSubmit} className="njc-body">

            {/* Customer + Date */}
            <div className="njc-row-2">
              <div className="form-group">
                <label className="form-label">
                  Customer <span className="req-star">*</span> <span className="label-ta tamil">வாடிக்கையாளர்</span>
                </label>
                <SearchableSelect
                  items={customers}
                  value={selectedCustomer}
                  onChange={setSelectedCustomer}
                  getLabel={formatCustomerLabel}
                  getKey={(c) => String(c.id)}
                  placeholder="Search customer..."
                  disabled={isEditMode}
                />
                {isEditMode && <p className="form-hint">Customer cannot be changed when editing.</p>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="job-date">
                  Job date <span className="label-ta tamil">தேதி</span>
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
            </div>

            {/* Customer flags */}
            {selectedCustomer && (
              <div className="customer-flags-row">
                <span className={`cust-flag ${typeVariant[selectedCustomer.type] || 'flag-invoice'}`}>
                  {selectedCustomer.type}
                </span>
                {showCommissionFields && <span className="cust-flag flag-commission">Commission</span>}
                {showDcFields && <span className="cust-flag flag-dc">DC required</span>}
                {showRmpHandlerField && <span className="cust-flag flag-rmp">RMP</span>}
                {(selectedCustomer.advanceBalance || 0) > 0 && (
                  <span className="cust-flag flag-advance">
                    Advance {formatCurrency(selectedCustomer.advanceBalance || 0)}
                  </span>
                )}
                {(() => {
                  const outstanding = jobs
                    .filter((j) => j.customerId === selectedCustomer.id)
                    .reduce((sum, job) => {
                      const due = (Number(job.amount) || 0) + (Number(job.commissionAmount) || 0);
                      return sum + Math.max(0, due - (job.paidAmount || 0));
                    }, 0);
                  return outstanding > 0 ? (
                    <span className="cust-flag flag-backlog">⚠ Backlog {formatCurrency(outstanding)}</span>
                  ) : null;
                })()}
              </div>
            )}

            {/* Work lines */}
            <div className="work-lines-section">
              <div className="work-lines-head">
                <span className="work-lines-title">
                  Work lines <span className="tamil work-lines-ta">வேலை வரிகள்</span>
                </span>
                <button type="button" className="btn-add-line" onClick={handleAddLine}>
                  + Add line
                </button>
              </div>

              <div className="work-lines-table">
                <div className="wl-col-header">
                  <span>WORK TYPE</span>
                  <span>QTY</span>
                  <span>AMOUNT ₹</span>
                  <span />
                </div>
                {jobLines.map((line) => (
                  <JobLine
                    key={line.id}
                    line={line}
                    onChange={handleLineChange}
                    onRemove={() => handleRemoveLine(line.id)}
                    showCommission={false}
                    showInlineWorker={false}
                    showInlineCommission={false}
                  />
                ))}
              </div>
            </div>

            {/* Commission assignment */}
            {showCommissionFields && (
              <div className="commission-section">
                {sortedCommissionWorkers.length === 0 ? (
                  <p className="note-text">No commission workers for this customer. Add in Customer settings.</p>
                ) : (
                  <div className="njc-row-2">
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
                        className="form-input mono"
                        value={cardTotalCommission}
                        onChange={(e) => setCardTotalCommission(e.target.value)}
                        placeholder="0"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DC Panel */}
            {showDcFields && (
              <div className="dc-panel">
                <div className="dc-panel-head">
                  <span className="dc-panel-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                    Delivery Challan
                  </span>
                  <label className="dc-waived-toggle-label">
                    <ToggleSwitch
                      checked={dcApproval}
                      onChange={setDcApproval}
                      id="dc-approval"
                      disabled={!!(dcNo.trim() || (showVehicleNoField && vehicleNo.trim()) || dcDate)}
                    />
                    <span>DC waived</span>
                  </label>
                </div>
                <div className={`dc-fields-row${showVehicleNoField ? ' dc-fields-3' : ' dc-fields-2'}`}>
                  <div className="form-group">
                    <label className="form-label">DC No.</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={dcNo}
                      onChange={(e) => setDcNo(e.target.value)}
                      placeholder="DC1234"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="dc-date">DC Date</label>
                    <input
                      id="dc-date"
                      type="date"
                      className="form-input"
                      value={dcDate}
                      onChange={(e) => setDcDate(e.target.value)}
                      max={today}
                      title="DC Date"
                    />
                  </div>
                  {showVehicleNoField && (
                    <div className="form-group">
                      <label className="form-label">Vehicle No.</label>
                      <input
                        type="text"
                        className="form-input mono"
                        value={vehicleNo}
                        onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                        placeholder="TN22AB1234"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RMP Handler */}
            {showRmpHandlerField && (
              <div className="form-group">
                <label className="form-label">RMP Handler</label>
                <div className="seg-control rmp-seg">
                  {(['Bhai', 'Raja'] as const).map((handler) => (
                    <button
                      key={handler}
                      type="button"
                      className={`seg-btn${rmpHandler === handler ? ' active' : ''}`}
                      onClick={() => setRmpHandler(rmpHandler === handler ? null : handler)}
                    >
                      {handler}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Work mode + Payment mode + Paid amount */}
            <div className="njc-row-3">
              <div className="form-group">
                <label className="form-label">Work mode</label>
                <div className="seg-control">
                  <button type="button" className={`seg-btn${workMode === 'Workshop' ? ' active' : ''}`} onClick={() => setWorkMode('Workshop')}>Workshop</button>
                  <button type="button" className={`seg-btn${workMode === 'Spot' ? ' active' : ''}`} onClick={() => setWorkMode('Spot')}>Spot</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="payment-mode">Payment mode</label>
                <select
                  id="payment-mode"
                  className="form-input"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="paid-amount">
                  Paid amount ₹
                  {summary.finalValue > 0 && (
                    <button
                      type="button"
                      className="fill-chip"
                      onClick={() => {
                        const customerJobs = jobs.filter((j) => j.customerId === selectedCustomer?.id);
                        const backlog = customerJobs.reduce((sum, job) => {
                          const due = (Number(job.amount) || 0) + (Number(job.commissionAmount) || 0);
                          return sum + Math.max(0, due - (job.paidAmount || 0));
                        }, 0);
                        const advance = selectedCustomer?.advanceBalance || 0;
                        setPaidAmount(String(Math.max(0, backlog + summary.finalValue - advance)));
                      }}
                    >
                      Fill
                    </button>
                  )}
                </label>
                <input
                  id="paid-amount"
                  type="number"
                  className="form-input mono"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            {/* Notes */}
            <textarea
              className="form-input form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
            />

            {/* Footer */}
            <div className="njc-footer">
              <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={isSubmitting}>
                Reset
              </button>
              <button
                type="submit"
                className="btn btn-accent"
                disabled={!selectedCustomer || isSubmitting || (showCommissionFields && sortedCommissionWorkers.length === 0)}
              >
                {isSubmitting ? (isEditMode ? 'Updating...' : 'Saving...') : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    {isEditMode ? 'Update job card' : 'Save job card'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Card summary + Today's metrics */}
        <div className="jobs-right-col">

          {/* Card summary */}
          <div className="njc-summary-card">
            <div className="njc-summary-head">Card summary</div>
            <div className="njc-summary-body">
              <div className="summary-row">
                <span className="summary-row-label">Total amount</span>
                <span className="summary-row-val mono">{formatCurrency(summary.totalAmount)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Commission</span>
                <span className="summary-row-val mono is-amber">{formatCurrency(summary.totalCommission)}</span>
              </div>
              <div className="summary-sep" />
              <div className="summary-row summary-row--final">
                <span className="summary-row-label">Final bill</span>
                <span className="summary-row-val mono summary-final-val">{formatCurrency(summary.finalValue)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Net income</span>
                <span className="summary-row-val mono is-green">{formatCurrency(summary.netValue)}</span>
              </div>
            </div>
          </div>

          {/* Today's metrics */}
          <div className="njc-metrics-card">
            <div className="njc-metrics-head">
              <span>Today's metrics</span>
              <span className="metrics-date mono">{todayLabel}</span>
            </div>
            <div className="njc-metrics-body">
              <div className="metrics-grid">
                <div className="metrics-cell">
                  <span className="metrics-label">Cards</span>
                  <span className="metrics-val">{jobCardsMetrics.count}</span>
                </div>
                <div className="metrics-cell">
                  <span className="metrics-label">Total bill</span>
                  <span className="metrics-val mono">{formatCurrency(jobCardsMetrics.totalFinal)}</span>
                </div>
                <div className="metrics-cell">
                  <span className="metrics-label">Paid</span>
                  <span className="metrics-val mono is-green">{formatCurrency(jobCardsMetrics.totalPaid)}</span>
                </div>
                <div className="metrics-cell">
                  <span className="metrics-label">Pending</span>
                  <span className="metrics-val mono is-red">{formatCurrency(jobCardsMetrics.totalPending)}</span>
                </div>
              </div>
              <div className="metrics-sep" />
              <div className="metrics-modes">
                <span className="metrics-modes-title">Payment modes</span>
                {[
                  { label: 'Cash', value: jobCardsMetrics.byCash },
                  { label: 'UPI', value: jobCardsMetrics.byUPI },
                  { label: 'Bank', value: jobCardsMetrics.byBank },
                  { label: 'Cheque', value: jobCardsMetrics.byCheque },
                ].map(({ label, value }) => (
                  <div key={label} className="metrics-mode-row">
                    <span className="metrics-mode-label">{label}</span>
                    <span className="metrics-mode-val mono">{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submitted today */}
      <div className="submitted-section">
        <div className="submitted-head">
          <div className="submitted-head-left">
            <span className="submitted-title">Submitted today</span>
            <span className="submitted-count">{todayJobCards.length} cards</span>
          </div>
          <div className="seg-control">
            <button type="button" className={`seg-btn${cardViewMode === 'today' ? ' active' : ''}`}
              onClick={() => { setCardViewMode('today'); setSelectedCardKey(null); }}>Today</button>
            <button type="button" className={`seg-btn${cardViewMode === 'range' ? ' active' : ''}`}
              onClick={() => { setCardViewMode('range'); setFilterStartDate(today); setFilterEndDate(today); setSelectedCardKey(null); }}>Date Range</button>
          </div>
        </div>

        {cardViewMode === 'range' && (
          <div className="date-range-row">
            <input type="date" className="form-input" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} max={today} title="Start date" aria-label="Start date" />
            <span className="date-range-sep">to</span>
            <input type="date" className="form-input" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} max={today} title="End date" aria-label="End date" />
          </div>
        )}

        <div className="submitted-table-wrap">
          <table className="submitted-table">
            <thead>
              <tr>
                <th>CARD</th>
                <th
                  className={`slw-sortable-th${submittedSort.key === 'customer' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSubmittedSort('customer')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSubmittedSort('customer');
                    }
                  }}
                >
                  CUSTOMER {submittedSortMark('customer')}
                </th>
                <th
                  className={`slw-sortable-th${submittedSort.key === 'lines' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSubmittedSort('lines')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSubmittedSort('lines');
                    }
                  }}
                >
                  LINES {submittedSortMark('lines')}
                </th>
                <th
                  className={`numeric slw-sortable-th${submittedSort.key === 'finalBill' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSubmittedSort('finalBill')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSubmittedSort('finalBill');
                    }
                  }}
                >
                  FINAL BILL {submittedSortMark('finalBill')}
                </th>
                <th className="numeric">COMMISSION</th>
                <th className="numeric">PAID</th>
                <th
                  className={`slw-sortable-th${submittedSort.key === 'status' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSubmittedSort('status')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSubmittedSort('status');
                    }
                  }}
                >
                  STATUS {submittedSortMark('status')}
                </th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {todayJobCards.length === 0 ? (
                <tr><td colSpan={8} className="table-empty-cell">{emptyCardsMessage}</td></tr>
              ) : (
                sortedTodayJobCards.map((group) => {
                  const cardNo = group.primary.jobCardId || `LEGACY-${group.primary.id}`;
                  const customer = getCustomer(group.primary.customerId);
                  const customerName = customer?.name || 'Unknown';
                  const customerCode = customer?.shortCode || '';
                  const payment = getJobCardPaymentSummary(group.jobs);
                  const firstLine = group.jobs[0];
                  const extra = group.jobs.length - 1;
                  const linesDesc = extra > 0 ? `${firstLine.workTypeName} +${extra}` : firstLine.workTypeName;
                  const totalComm = group.jobs.reduce((s, j) => s + (j.commissionAmount || 0), 0);

                  return (
                    <tr
                      key={group.key}
                      className="submitted-row"
                      onClick={() => setSelectedCardKey(group.key)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCardKey(group.key); } }}
                    >
                      <td className="mono card-no-cell">{cardNo}</td>
                      <td>
                        <div className="cust-cell-name">{customerName}</div>
                        {customerCode && <div className="cust-cell-code">{customerCode}</div>}
                      </td>
                      <td>
                        <div className="lines-cell-count">{group.jobs.length} {group.jobs.length === 1 ? 'line' : 'lines'}</div>
                        <div className="lines-cell-desc">{linesDesc}</div>
                      </td>
                      <td className="numeric">{formatCurrency(payment.finalBill)}</td>
                      <td className="numeric">{formatCurrency(totalComm)}</td>
                      <td className={`numeric ${payment.status === 'Paid' ? 'cell-val-green' : payment.status === 'Partially Paid' ? 'cell-val-amber' : 'cell-val-muted'}`}>{formatCurrency(payment.paid)}</td>
                      <td><StatusBadge status={payment.status} /></td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="row-act-btn" onClick={(e) => { e.stopPropagation(); handleEditCard(group); }} title="Edit">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button type="button" className="row-act-btn row-act-btn--del" onClick={(e) => { e.stopPropagation(); handleDeleteCard(group); }} title="Delete">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
