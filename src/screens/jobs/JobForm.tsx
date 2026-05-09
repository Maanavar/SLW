import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { useWorkTypesQuery } from '@/hooks/useWorkTypesQuery';
import { useToast } from '@/hooks/useToast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { StatusBadge } from '@/components/ui/Badge';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { JobLine, type JobLineState } from './JobLine';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { groupJobsByCard } from '@/lib/reportUtils';
import {
  getJobCardPaymentSummary,
  getPaymentStatusFromAmounts,
  isDcApplicableCustomer,
  isCommissionApplicableCustomer,
} from '@/lib/jobUtils';
import {
  isMahalingamCustomerLabel,
  isRmpCustomer as isRmpCustomerLabel,
  isWagenAutosCustomerLabel,
  isWwCustomer as isWwCustomerLabel,
} from '@/constants/customers';
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

function isWagenAutosCustomer(customer?: Customer | null) {
  return Boolean(customer && isWagenAutosCustomerLabel(customer.name, customer.shortCode));
}

function isRmpCustomer(customer?: Customer | null) {
  return Boolean(customer && isRmpCustomerLabel(customer.shortCode, customer.name));
}

function isNmCustomer(customer?: Customer | null) {
  return Boolean(customer && isMahalingamCustomerLabel(customer.shortCode, customer.name));
}

function isRamaniCarsCustomer(customer?: Customer | null) {
  return Boolean(customer && isWwCustomerLabel(customer.shortCode, customer.name));
}

function isAgentFlowCustomer(customer?: Customer | null) {
  return isRmpCustomer(customer) || isRamaniCarsCustomer(customer);
}

function shouldShowDcFields(customer?: Customer | null) {
  if (!customer) return false;
  return isDcApplicableCustomer(customer);
}

function formatCustomerLabel(customer: Customer) {
  return customer.name;
}

type SubmittedSortKey = 'card' | 'customer' | 'lines' | 'finalBill' | 'commission' | 'paid' | 'status';

const paymentStatusOrder: Record<'Paid' | 'Pending' | 'Partially Paid', number> = {
  Pending: 0,
  'Partially Paid': 1,
  Paid: 2,
};

function createEmptyJobLine(): JobLineState {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workType: null,
    quantity: 1,
    amount: '',
    commission: '',
    commissionWorker: null,
  };
}

function isJobLineComplete(line: JobLineState) {
  return Boolean(line.workType) && line.quantity > 0 && (parseFloat(line.amount) || 0) > 0;
}

function isPristineJobLine(line: JobLineState) {
  const commissionRaw = (line.commission || '').trim();
  const commissionValue = commissionRaw === '' ? 0 : parseFloat(commissionRaw) || 0;
  return (
    !line.workType &&
    line.quantity === 1 &&
    (line.amount || '').trim() === '' &&
    commissionValue === 0 &&
    !line.commissionWorker
  );
}

export function JobForm() {
  const { getCustomer, jobs, addJobsBulk, updateJob, deleteJob, getCommissionWorkersForCustomer, updateCustomer, addCustomer, addWorkType } = useDataStore();
  const { data: allCustomers = [] } = useCustomersQuery();
  const { data: workTypes = [] } = useWorkTypesQuery();
  const toast = useToast();

  const customers = useMemo(() => {
    const jobCountByCustomer: Record<number, number> = {};
    jobs.forEach((job) => {
      jobCountByCustomer[job.customerId] = (jobCountByCustomer[job.customerId] || 0) + 1;
    });
    return allCustomers.filter((c) => c.isActive).sort((a, b) => {
      const diff = (jobCountByCustomer[b.id] || 0) - (jobCountByCustomer[a.id] || 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [allCustomers, jobs]);
  const today = getLocalDateString(new Date());

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [jobDate, setJobDate] = useState(getLocalDateString(new Date()));
  const [jobLines, setJobLines] = useState<JobLineState[]>([createEmptyJobLine()]);
  const [workMode, setWorkMode] = useState<'Workshop' | 'Spot'>('Workshop');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [dcNo, setDcNo] = useState('');
  const [billNo, setBillNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [dcDate, setDcDate] = useState('');
  const [dcApproval, setDcApproval] = useState(false);
  const [rmpHandler, setRmpHandler] = useState<'Bhai' | 'Raja' | null>(null);
  const [jobFlowType, setJobFlowType] = useState<'slw_work' | 'agent_work'>('slw_work');
  const [externalDc, setExternalDc] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentCommissionAmount, setAgentCommissionAmount] = useState('');
  const [agentTdsAmount, setAgentTdsAmount] = useState('');
  const [paymentIntent, setPaymentIntent] = useState<'now' | 'later'>('later');
  const [paidAmount, setPaidAmount] = useState('');
  const [autoGenerateCount, setAutoGenerateCount] = useState('9');
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

  // Quick-add state
  const [quickAddMode, setQuickAddMode] = useState<null | 'customer' | 'worktype'>(null);
  const [quickAddPendingLineId, setQuickAddPendingLineId] = useState<string | null>(null);
  const [qaSubmitting, setQaSubmitting] = useState(false);
  // Customer form
  const [qaCustomerName, setQaCustomerName] = useState('');
  const [qaCustomerCode, setQaCustomerCode] = useState('');
  const [qaCustomerType, setQaCustomerType] = useState<Customer['type']>('Monthly');
  const [qaCustomerHasComm, setQaCustomerHasComm] = useState(false);
  const [qaCustomerRequiresDc, setQaCustomerRequiresDc] = useState(false);
  const [qaCustomerHasBillNo, setQaCustomerHasBillNo] = useState(false);
  // Work type form
  const [qaWorkTypeName, setQaWorkTypeName] = useState('');
  const [qaWorkTypeCode, setQaWorkTypeCode] = useState('');
  const [qaWorkTypeCategory, setQaWorkTypeCategory] = useState('');
  const [qaWorkTypeRate, setQaWorkTypeRate] = useState('');

  const showDcFields = shouldShowDcFields(selectedCustomer);
  const showBillNoField = selectedCustomer?.hasBillNo === true || isRmpCustomer(selectedCustomer) || isNmCustomer(selectedCustomer);
  const showVehicleNoField = showDcFields && !isWagenAutosCustomer(selectedCustomer);
  const showCommissionFields = isCommissionApplicableCustomer(selectedCustomer);
  const showRmpHandlerField = isRmpCustomer(selectedCustomer);
  const showAgentFlowFields = isAgentFlowCustomer(selectedCustomer);
  const useWorkerCommission = showCommissionFields && jobFlowType === 'slw_work';
  const useAgentCommission = showAgentFlowFields && jobFlowType === 'agent_work';
  const selectedCustomerId = selectedCustomer?.id ?? null;
  const selectedCustomerType = selectedCustomer?.type ?? null;
  const commissionWorkersForCustomer = useMemo(
    () =>
      useWorkerCommission && selectedCustomerId !== null
        ? getCommissionWorkersForCustomer(selectedCustomerId)
        : [],
    [useWorkerCommission, selectedCustomerId, getCommissionWorkersForCustomer]
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

  useEffect(() => {
    if (!showRmpHandlerField || !rmpHandler || !useWorkerCommission) return;
    const matched = sortedCommissionWorkers.find(
      (w) => w.name.trim().toLowerCase() === rmpHandler.toLowerCase()
    );
    if (matched) setCardCommissionWorker(matched);
  }, [rmpHandler, showRmpHandlerField, sortedCommissionWorkers, useWorkerCommission]);

  useEffect(() => {
    if (!showRmpHandlerField) setRmpHandler(null);
  }, [showRmpHandlerField]);

  useEffect(() => {
    if (!showAgentFlowFields) {
      setJobFlowType('slw_work');
      setExternalDc(false);
      setAgentName('');
      setAgentCommissionAmount('');
      setAgentTdsAmount('');
    }
  }, [showAgentFlowFields]);

  const totalAmount = jobLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  const totalCommission = useWorkerCommission ? (parseFloat(cardTotalCommission) || 0) : 0;
  const agentCommission = useAgentCommission ? (parseFloat(agentCommissionAmount) || 0) : 0;
  const agentTds = useAgentCommission ? (parseFloat(agentTdsAmount) || 0) : 0;
  const agentNetPayable = useAgentCommission ? Math.max(0, totalAmount - agentCommission - agentTds) : 0;
  const summary = {
    totalAmount,
    totalCommission,
    netValue: totalAmount,
    finalValue: totalAmount + totalCommission,
    agentCommission,
    agentTds,
    agentNetPayable,
  };
  const nextCardId = useMemo(() => generateJobCardId(jobDate, jobs), [jobDate, jobs]);

  useEffect(() => {
    if (!useWorkerCommission) {
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
  }, [useWorkerCommission]);

  useEffect(() => {
    if (dcNo.trim() || (showVehicleNoField && vehicleNo.trim()) || dcDate) {
      setDcApproval(false);
    }
  }, [dcNo, vehicleNo, dcDate, showVehicleNoField]);

  useEffect(() => {
    if (!showBillNoField && billNo) {
      setBillNo('');
    }
  }, [showBillNoField, billNo]);

  useEffect(() => {
    if (!showVehicleNoField && vehicleNo) {
      setVehicleNo('');
    }
  }, [showVehicleNoField, vehicleNo]);

  useEffect(() => {
    if (!selectedCustomerType) return;
    const deferredTypes = ['Monthly', 'Invoice', 'Party-Credit'];
    setPaymentIntent(deferredTypes.includes(selectedCustomerType) ? 'later' : 'now');
    setPaidAmount('');
  }, [selectedCustomerId, selectedCustomerType]);

  useEffect(() => {
    if (paymentIntent === 'later') {
      setPaidAmount('');
    }
  }, [paymentIntent]);

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
      if (submittedSort.key === 'card') {
        const aCard = a.primary.jobCardId || `LEGACY-${a.primary.id}`;
        const bCard = b.primary.jobCardId || `LEGACY-${b.primary.id}`;
        return collator.compare(aCard, bCard) * direction;
      }

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

      if (submittedSort.key === 'commission') {
        const aComm = a.jobs.reduce((sum, job) => sum + (job.commissionAmount || 0), 0);
        const bComm = b.jobs.reduce((sum, job) => sum + (job.commissionAmount || 0), 0);
        return (aComm - bComm) * direction;
      }

      if (submittedSort.key === 'paid') {
        const aPaid = getJobCardPaymentSummary(a.jobs).paid;
        const bPaid = getJobCardPaymentSummary(b.jobs).paid;
        return (aPaid - bPaid) * direction;
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
        : { key, order: key === 'finalBill' || key === 'commission' || key === 'paid' ? 'desc' : 'asc' }
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
    setJobLines((prev) => [...prev, createEmptyJobLine()]);
  };

  const handleRemoveLine = (id: string) => {
    if (jobLines.length <= 1) {
      toast.error('Error', 'At least one job line is required');
      return;
    }

    setJobLines(jobLines.filter((line) => line.id !== id));
  };

  const handleLineChange = (updatedLine: JobLineState) => {
    setJobLines((prev) => {
      const updatedIndex = prev.findIndex((line) => line.id === updatedLine.id);
      if (updatedIndex === -1) {
        return prev;
      }

      // If commission is not applicable, keep it at 0.
      const finalLine = useWorkerCommission ? updatedLine : { ...updatedLine, commission: '0' };
      const nextLines = prev.map((line) => (line.id === updatedLine.id ? finalLine : line));

      const isLastLine = updatedIndex === nextLines.length - 1;
      if (!isLastLine || !isJobLineComplete(finalLine)) {
        return nextLines;
      }

      const hasIncompleteLine = nextLines.some((line) => !isJobLineComplete(line));
      if (hasIncompleteLine) {
        return nextLines;
      }

      return [...nextLines, createEmptyJobLine()];
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const linesForSubmit = [...jobLines];
    while (
      linesForSubmit.length > 1 &&
      isPristineJobLine(linesForSubmit[linesForSubmit.length - 1])
    ) {
      linesForSubmit.pop();
    }

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

    if (linesForSubmit.some((line) => !line.workType)) {
      toast.error('Error', 'All job lines must have a work type selected');
      return;
    }

    if (linesForSubmit.some((line) => !line.quantity || line.quantity <= 0)) {
      toast.error('Error', 'All job lines must include quantity greater than 0');
      return;
    }

    if (linesForSubmit.some((line) => !line.amount || parseFloat(line.amount) <= 0)) {
      toast.error('Error', 'All job lines must include amount');
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

    if (paymentIntent === 'now' && (!paidAmount || parseFloat(paidAmount) <= 0)) {
      toast.error('Error', 'Enter paid amount, or switch to "Pay later"');
      return;
    }

    if (paymentIntent === 'now' && !paymentMode) {
      toast.error('Error', 'Payment mode is mandatory when paying now');
      return;
    }

    if (showDcFields && !dcNo.trim() && !dcApproval) {
      toast.error('Error', 'For DC customers, enter DC Number or mark DC waived');
      return;
    }

    if (showBillNoField && !billNo.trim()) {
      toast.error('Error', 'Bill number is required for this customer');
      return;
    }

    setIsSubmitting(true);
    try {
      const enteredPaidAmount = paymentIntent === 'now' ? parseFloat(paidAmount) || 0 : 0;

      const allocateAcrossLines = (lineFinalBills: number[], totalPaid: number) => {
        let remaining = Math.max(0, totalPaid);
        return lineFinalBills.map((due) => {
          const alloc = Math.min(Math.max(0, due), remaining);
          remaining -= alloc;
          return alloc;
        });
      };

      const lineFinalBills = linesForSubmit.map((line, index) => {
        const lineAmount = parseFloat(line.amount) || 0;
        const lineCommission = useWorkerCommission && index === 0 ? parseFloat(cardTotalCommission) || 0 : 0;
        return lineAmount + lineCommission;
      });

      const paidAllocations =
        paymentIntent === 'now' && enteredPaidAmount > 0
          ? allocateAcrossLines(lineFinalBills, enteredPaidAmount)
          : linesForSubmit.map(() => 0);

      if (isEditMode && editingJobIds.length > 0) {
        // EDIT MODE: sync lines (update existing, create added lines, delete removed lines)
        const existingJobs = editingJobIds
          .map((id) => jobs.find((j) => j.id === id))
          .filter((j): j is Job => Boolean(j));
        const baseCardId = existingJobs[0]?.jobCardId;

        const buildLinePayload = (line: JobLineState, index: number) => ({
          date: jobDate,
          workTypeName: line.workType!.name,
          workName: line.workType!.shortCode,
          quantity: line.quantity,
          amount: parseFloat(line.amount),
          commissionAmount: useWorkerCommission && index === 0 ? parseFloat(cardTotalCommission) || 0 : 0,
          commissionWorkerId:
            useWorkerCommission && cardCommissionWorker ? cardCommissionWorker.id : undefined,
          commissionWorkerName:
            useWorkerCommission && cardCommissionWorker ? cardCommissionWorker.name : undefined,
          netAmount: parseFloat(line.amount),
          paymentStatus:
            paymentIntent === 'now' && enteredPaidAmount > 0
              ? getPaymentStatusFromAmounts(paidAllocations[index] || 0, lineFinalBills[index] || 0)
              : 'Pending',
          paymentMode:
            paymentIntent === 'now' && (paidAllocations[index] || 0) > 0 ? paymentMode : undefined,
          paidAmount: paymentIntent === 'now' ? (paidAllocations[index] || 0) : 0,
          workMode,
          isSpotWork: workMode === 'Spot',
          notes: notes.trim() || undefined,
          jobCardId: baseCardId || undefined,
          jobCardLine: index + 1,
          billNo: showBillNoField ? billNo.trim() : undefined,
          ...(showDcFields && {
            dcNo: dcNo || undefined,
            vehicleNo: showVehicleNoField ? vehicleNo || undefined : undefined,
            dcDate: dcDate || undefined,
            dcApproval: dcApproval || undefined,
          }),
          rmpHandler: showRmpHandlerField ? rmpHandler : null,
          jobFlowType,
          externalDc: useAgentCommission ? externalDc : false,
          agentName: useAgentCommission ? agentName.trim() : undefined,
          agentCommissionAmount: useAgentCommission && index === 0 ? Number(agentCommissionAmount) || 0 : 0,
          agentTdsAmount: useAgentCommission && index === 0 ? Number(agentTdsAmount) || 0 : 0,
          agentSettlementPaidAmount:
            index === 0
              ? (existingJobs[0]?.agentSettlementPaidAmount || 0)
              : 0,
        });

        const commonLength = Math.min(existingJobs.length, linesForSubmit.length);
        await Promise.all(
          linesForSubmit.slice(0, commonLength).map((line, index) => updateJob(existingJobs[index].id, buildLinePayload(line, index)))
        );

        if (linesForSubmit.length > existingJobs.length) {
          const extraLines = linesForSubmit.slice(existingJobs.length);
          await addJobsBulk(
            extraLines.map((line, extraIndex) => {
              const index = existingJobs.length + extraIndex;
              return {
                customerId: selectedCustomer.id,
                ...buildLinePayload(line, index),
              };
            })
          );
        }

        if (existingJobs.length > linesForSubmit.length) {
          const removedJobs = existingJobs.slice(linesForSubmit.length);
          await Promise.all(removedJobs.map((job) => deleteJob(job.id)));
        }

        // Create advance if payment > finalBill (edit mode)
        if (selectedCustomer && paymentIntent === 'now' && enteredPaidAmount > 0) {
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
        if (selectedCustomer && paymentIntent === 'now' && enteredPaidAmount > 0) {
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
        const newJobs: Job[] = linesForSubmit.map((line, index) => ({
          id: Date.now() + Math.random(),
          customerId: selectedCustomer.id,
          workTypeName: line.workType!.name,
          workName: line.workType!.shortCode,
          quantity: line.quantity,
          amount: parseFloat(line.amount),
          commissionAmount: useWorkerCommission && index === 0 ? parseFloat(cardTotalCommission) || 0 : 0,
          commissionWorkerId:
            useWorkerCommission && cardCommissionWorker ? cardCommissionWorker.id : undefined,
          commissionWorkerName:
            useWorkerCommission && cardCommissionWorker ? cardCommissionWorker.name : undefined,
          netAmount: parseFloat(line.amount),
          date: jobDate,
          paymentStatus:
            paymentIntent === 'now' && enteredPaidAmount > 0
              ? getPaymentStatusFromAmounts(paidAllocations[index] || 0, lineFinalBills[index] || 0)
              : 'Pending',
          paymentMode:
            paymentIntent === 'now' && (paidAllocations[index] || 0) > 0 ? paymentMode : undefined,
          paidAmount: paymentIntent === 'now' ? (paidAllocations[index] || 0) : 0,
          workMode,
          isSpotWork: workMode === 'Spot',
          jobCardId,
          jobCardLine: index + 1,
          billNo: showBillNoField ? billNo.trim() : undefined,
          notes: notes.trim() || undefined,
          ...(showDcFields && {
            dcNo: dcNo || undefined,
            vehicleNo: showVehicleNoField ? vehicleNo || undefined : undefined,
            dcDate: dcDate || undefined,
            dcApproval: dcApproval || undefined,
          }),
          rmpHandler: showRmpHandlerField ? rmpHandler : null,
          jobFlowType,
          externalDc: useAgentCommission ? externalDc : false,
          agentName: useAgentCommission ? agentName.trim() : undefined,
          agentCommissionAmount: useAgentCommission && index === 0 ? Number(agentCommissionAmount) || 0 : 0,
          agentTdsAmount: useAgentCommission && index === 0 ? Number(agentTdsAmount) || 0 : 0,
          agentSettlementPaidAmount: 0,
        }));

        await addJobsBulk(newJobs);
        toast.success('Success', `JobCard ${jobCardId} created with ${newJobs.length} line(s)`);

        // Create advance if payment > finalBill
        if (selectedCustomer && paymentIntent === 'now' && enteredPaidAmount > 0) {
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
      if (selectedCustomer && paymentIntent === 'now' && enteredPaidAmount > 0) {
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
      setJobLines([createEmptyJobLine()]);
      setWorkMode('Workshop');
      setPaymentIntent('later');
      setPaymentMode('Cash');
      setPaidAmount('');
      setDcNo('');
      setBillNo('');
      setVehicleNo('');
      setDcDate('');
      setDcApproval(false);
      setRmpHandler(null);
      setJobFlowType('slw_work');
      setExternalDc(false);
      setAgentName('');
      setAgentCommissionAmount('');
      setAgentTdsAmount('');
      setNotes('');
      setCardCommissionWorker(null);
      setCardTotalCommission('');
      setSelectedCardKey(null);
    } catch (error) {
      console.error('Error saving job:', error);
      const msg = error instanceof Error ? error.message : null;
      toast.error('Error', msg || `Failed to ${isEditMode ? 'update' : 'create'} job. Please try again.`);
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
    setJobFlowType(cardToEdit.primary.jobFlowType || 'slw_work');
    setExternalDc(Boolean(cardToEdit.primary.externalDc));
    // Normalize legacy agent names created before standardisation
    const rawAgent = cardToEdit.primary.agentName || '';
    let normalizedAgent = rawAgent === 'Palanisamy External' ? 'Palanisamy'
      : rawAgent === 'Bhai External' ? 'Bhai'
      : rawAgent === 'Raja External' ? 'Raja'
      : rawAgent;
    // WW has exactly one agent — force it regardless of what was stored (handles partial/legacy values)
    if (isRamaniCarsCustomer(editCustomer) && cardToEdit.primary.jobFlowType === 'agent_work') {
      normalizedAgent = 'Palanisamy';
    }
    setAgentName(normalizedAgent);
    setAgentCommissionAmount(String(cardToEdit.primary.agentCommissionAmount || 0));
    setAgentTdsAmount(String(cardToEdit.primary.agentTdsAmount || 0));

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
    setBillNo(cardToEdit.primary.billNo || '');

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
    } else {
      setRmpHandler(null);
    }

    if (cardToEdit.primary.paymentStatus === 'Paid' && cardToEdit.primary.paidAmount) {
      setPaymentIntent('now');
      setPaidAmount(String(cardToEdit.primary.paidAmount));
      setPaymentMode(cardToEdit.primary.paymentMode || 'Cash');
    } else {
      setPaymentIntent('later');
      setPaidAmount('');
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

  const openQuickAddCustomer = (searchText: string) => {
    setQaCustomerName(searchText);
    setQaCustomerCode('');
    setQaCustomerType('Monthly');
    setQaCustomerHasComm(false);
    setQaCustomerRequiresDc(false);
    setQaCustomerHasBillNo(false);
    setQuickAddMode('customer');
  };

  const openQuickAddWorkType = (lineId: string, searchText: string) => {
    const cats = [...new Set(workTypes.map((wt) => wt.category).filter(Boolean))].sort() as string[];
    setQaWorkTypeName(searchText);
    setQaWorkTypeCode('');
    setQaWorkTypeCategory(cats[0] || '');
    setQaWorkTypeRate('');
    setQuickAddPendingLineId(lineId);
    setQuickAddMode('worktype');
  };

  const handleQuickAddCustomerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!qaCustomerName.trim()) return;
    if (!qaCustomerCode.trim()) {
      toast.error('Error', 'Short code is required');
      return;
    }
    setQaSubmitting(true);
    try {
      const newCustomer = await addCustomer({
        name: qaCustomerName.trim(),
        shortCode: qaCustomerCode.trim().toUpperCase(),
        type: qaCustomerType,
        hasCommission: qaCustomerHasComm,
        requiresDc: qaCustomerRequiresDc,
        hasBillNo: qaCustomerHasBillNo,
        advanceBalance: 0,
        notes: '',
        isActive: true,
      });
      setSelectedCustomer(newCustomer);
      setQuickAddMode(null);
      toast.success('Customer added', `"${newCustomer.name}" created and selected`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create customer';
      toast.error('Error', message);
    } finally {
      setQaSubmitting(false);
    }
  };

  const handleQuickAddWorkTypeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!qaWorkTypeName.trim()) return;
    setQaSubmitting(true);
    try {
      const newWorkType = await addWorkType({
        name: qaWorkTypeName.trim(),
        shortCode: qaWorkTypeCode.trim(),
        category: qaWorkTypeCategory.trim() || 'General',
        defaultUnit: 'nos',
        defaultRate: parseFloat(qaWorkTypeRate) || 0,
        isActive: true,
      });
      if (quickAddPendingLineId) {
        setJobLines((prev) =>
          prev.map((line) =>
            line.id === quickAddPendingLineId ? { ...line, workType: newWorkType } : line
          )
        );
      }
      setQuickAddMode(null);
      setQuickAddPendingLineId(null);
      toast.success('Work type added', `"${newWorkType.name}" created and selected`);
    } catch {
      toast.error('Error', 'Failed to create work type');
    } finally {
      setQaSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedCustomer(null);
    setJobLines([createEmptyJobLine()]);
    setWorkMode('Workshop');
    setPaymentIntent('later');
    setPaymentMode('Cash');
    setPaidAmount('');
    setDcNo('');
    setBillNo('');
    setVehicleNo('');
    setDcDate('');
    setDcApproval(false);
    setRmpHandler(null);
    setJobFlowType('slw_work');
    setAgentName('');
    setAgentCommissionAmount('');
    setAgentTdsAmount('');
    setNotes('');
    setCardCommissionWorker(null);
    setCardTotalCommission('');
    if (isEditMode) {
      setIsEditMode(false);
      setEditingJobIds([]);
    }
    setSelectedCardKey(null);
  };

  const handleAutoGenerateRamaniCards = async () => {
    if (!selectedCustomer) {
      toast.error('Error', 'Please select a customer');
      return;
    }

    if (!isRamaniCarsCustomer(selectedCustomer)) {
      toast.error('Error', 'Auto generate is available only for WW Ramani Cars');
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

    if (showBillNoField && !billNo.trim()) {
      toast.error('Error', 'Bill number is required for this customer');
      return;
    }

    const requestedCount = parseInt(autoGenerateCount, 10);
    if (!Number.isInteger(requestedCount) || requestedCount <= 0) {
      toast.error('Error', 'Enter a valid auto-generate count');
      return;
    }

    const rotorWorkType = workTypes.find((workType) => {
      const label = `${workType.name} ${workType.shortCode}`.toLowerCase();
      return label.includes('rotor') && label.includes('skim') && label.includes('2') && label.includes('disc');
    });

    if (!rotorWorkType) {
      toast.error('Error', 'Work type "Rotor Skimming - 2 Disc" not found. Add it in Work Type master first.');
      return;
    }

    const lineAmount = Number(rotorWorkType.defaultRate) || 0;
    if (lineAmount <= 0) {
      toast.error('Error', `Set a default rate for "${rotorWorkType.name}" to auto generate cards`);
      return;
    }

    const palanisamyWorker = getCommissionWorkersForCustomer(selectedCustomer.id).find(
      (worker) => worker.name.trim().toLowerCase() === 'palanisamy'
    );
    if (!palanisamyWorker) {
      toast.error('Error', 'Commission worker "Palanisamy" not found for this customer.');
      return;
    }

    const jobsSnapshot = [...jobs];
    const newJobs: Job[] = [];
    for (let i = 0; i < requestedCount; i += 1) {
      const generatedCardId = generateJobCardId(jobDate, jobsSnapshot);
      newJobs.push({
        id: Date.now() + Math.random() + i,
        customerId: selectedCustomer.id,
        workTypeName: rotorWorkType.name,
        workName: rotorWorkType.shortCode,
        quantity: 1,
        amount: lineAmount,
        commissionAmount: 0,
        commissionWorkerId: palanisamyWorker.id,
        commissionWorkerName: palanisamyWorker.name,
        netAmount: lineAmount,
        date: jobDate,
        paymentStatus: 'Pending',
        paymentMode: undefined,
        paidAmount: 0,
        workMode,
        isSpotWork: workMode === 'Spot',
        jobCardId: generatedCardId,
        jobCardLine: 1,
        billNo: showBillNoField ? billNo.trim() : undefined,
        notes: (notes.trim() || `Auto-generated: ${requestedCount} x Rotor skimming set of 2. DC to be updated later.`),
        ...(showDcFields && {
          dcNo: undefined,
          vehicleNo: undefined,
          dcDate: undefined,
          dcApproval: true,
        }),
        rmpHandler: null,
        jobFlowType: 'slw_work',
        externalDc: false,
        agentName: undefined,
        agentCommissionAmount: 0,
        agentTdsAmount: 0,
        agentSettlementPaidAmount: 0,
      });
      jobsSnapshot.push(newJobs[newJobs.length - 1]);
    }

    setIsSubmitting(true);
    try {
      await addJobsBulk(newJobs);
      toast.success('Success', `Auto-generated ${newJobs.length} job cards for ${selectedCustomer.name}`);
      handleReset();
    } catch (error) {
      console.error('Error auto-generating job cards:', error);
      const msg = error instanceof Error ? error.message : null;
      toast.error('Error', msg || 'Failed to auto-generate job cards');
    } finally {
      setIsSubmitting(false);
    }
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
                  getSearchText={(c) => `${c.name} ${String(c.shortCode || '').trim()}`}
                  getKey={(c) => String(c.id)}
                  placeholder="Search customer..."
                  disabled={isEditMode}
                  onAddNew={isEditMode ? undefined : openQuickAddCustomer}
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
                {showBillNoField && <span className="cust-flag">Bill No required</span>}
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

            <div className="work-lines-section">
              <div className="work-lines-head">
                <span className="work-lines-title">
                  Work lines <span className="tamil work-lines-ta">வேலை வரிகள்</span>
                </span>
                {showBillNoField && (
                  <div className="bill-no-inline">
                    <label className="bill-no-label">Bill No <span className="req-star">*</span></label>
                    <input
                      type="text"
                      className="bill-no-input mono"
                      value={billNo}
                      onChange={(e) => setBillNo(e.target.value)}
                      placeholder="Bill number"
                      maxLength={40}
                      required={showBillNoField}
                    />
                  </div>
                )}
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
                    onAddNewWorkType={(searchText) => openQuickAddWorkType(line.id, searchText)}
                  />
                ))}
              </div>
            </div>

            {/* Flow type for Ramani customers */}
            {showAgentFlowFields && (
              <div className="form-group">
                <label className="form-label">Flow Type</label>
                <div className="seg-control">
                  <button
                    type="button"
                    className={`seg-btn${jobFlowType === 'slw_work' ? ' active' : ''}`}
                    onClick={() => setJobFlowType('slw_work')}
                  >
                    SLW Work (Pay Worker)
                  </button>
                  <button
                    type="button"
                    className={`seg-btn${jobFlowType === 'agent_work' ? ' active' : ''}`}
                    onClick={() => setJobFlowType('agent_work')}
                  >
                    Agent Work (Receive Commission)
                  </button>
                </div>
              </div>
            )}

            {/* RMP Handler (shown before commission block) */}
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

            {/* Agent commission flow */}
            {useAgentCommission && (
              <div className="commission-section">
                <div className="form-group">
                  <label className="dc-waived-toggle-label">
                    <ToggleSwitch
                      checked={externalDc}
                      onChange={(val) => {
                        setExternalDc(val);
                        if (isRmpCustomer(selectedCustomer)) setAgentName('');
                      }}
                      id="agent-external-dc"
                    />
                    <span>Commission DC (not worked by SLW)</span>
                  </label>
                </div>
                <div className="njc-row-2">
                  <div className="form-group">
                    <label className="form-label">Agent Name</label>
                    {isRmpCustomer(selectedCustomer) ? (
                      <select className="form-input" value={agentName} onChange={(e) => setAgentName(e.target.value)}>
                        <option value="">Select agent...</option>
                        {externalDc ? (
                          <option value="Leaf Bhai">Leaf Bhai</option>
                        ) : (
                          <>
                            <option value="Bhai">Bhai</option>
                            <option value="Raja">Raja</option>
                          </>
                        )}
                      </select>
                    ) : isRamaniCarsCustomer(selectedCustomer) ? (
                      <select className="form-input" value={agentName} onChange={(e) => setAgentName(e.target.value)}>
                        <option value="">Select agent...</option>
                        <option value="Palanisamy">Palanisamy</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder="Agent name"
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Our Commission (INR)</label>
                    <input
                      type="number"
                      className="form-input mono"
                      value={agentCommissionAmount}
                      onChange={(e) => setAgentCommissionAmount(e.target.value)}
                      placeholder="0"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="njc-row-2">
                  <div className="form-group">
                    <label className="form-label">TDS (INR)</label>
                    <input
                      type="number"
                      className="form-input mono"
                      value={agentTdsAmount}
                      onChange={(e) => setAgentTdsAmount(e.target.value)}
                      placeholder="0"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Net Payable To Agent</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={formatCurrency(summary.agentNetPayable)}
                      disabled
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Worker commission assignment */}
            {useWorkerCommission && (
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

            {/* Work mode + Payment intent */}
            <div className="njc-row-2">
              <div className="form-group">
                <label className="form-label">Work mode</label>
                <div className="seg-control">
                  <button type="button" className={`seg-btn${workMode === 'Workshop' ? ' active' : ''}`} onClick={() => setWorkMode('Workshop')}>Workshop</button>
                  <button type="button" className={`seg-btn${workMode === 'Spot' ? ' active' : ''}`} onClick={() => setWorkMode('Spot')}>Spot</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Payment</label>
                <div className="seg-control">
                  <button type="button" className={`seg-btn seg-btn--paid-now${paymentIntent === 'now' ? ' active' : ''}`} onClick={() => setPaymentIntent('now')}>Paid now</button>
                  <button type="button" className={`seg-btn seg-btn--later${paymentIntent === 'later' ? ' active' : ''}`} onClick={() => setPaymentIntent('later')}>Pay later</button>
                </div>
              </div>
            </div>

            {/* Payment mode + Paid amount — shown only when paying now */}
            {paymentIntent === 'now' && (
              <div className="njc-row-2">
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
            )}

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
              {!isEditMode && isRamaniCarsCustomer(selectedCustomer) && (
                <>
                  <input
                    type="number"
                    className="form-input mono"
                    value={autoGenerateCount}
                    onChange={(e) => setAutoGenerateCount(e.target.value)}
                    min="1"
                    step="1"
                    style={{ width: '94px' }}
                    title="No. of cards"
                    placeholder="Count"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAutoGenerateRamaniCards}
                    disabled={isSubmitting}
                  >
                    Auto-generate rotor cards
                  </button>
                </>
              )}
              <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={isSubmitting}>
                Reset
              </button>
              <button
                type="submit"
                className="btn btn-accent"
                disabled={!selectedCustomer || isSubmitting || (useWorkerCommission && sortedCommissionWorkers.length === 0)}
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
                <th
                  className={`slw-sortable-th${submittedSort.key === 'card' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSubmittedSort('card')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSubmittedSort('card');
                    }
                  }}
                >
                  CARD {submittedSortMark('card')}
                </th>
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
                <th
                  className={`numeric slw-sortable-th${submittedSort.key === 'commission' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSubmittedSort('commission')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSubmittedSort('commission');
                    }
                  }}
                >
                  COMMISSION {submittedSortMark('commission')}
                </th>
                <th
                  className={`numeric slw-sortable-th${submittedSort.key === 'paid' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSubmittedSort('paid')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSubmittedSort('paid');
                    }
                  }}
                >
                  PAID {submittedSortMark('paid')}
                </th>
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
                  const cardBillNo = group.primary.billNo || '';
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
                      <td className="mono card-no-cell">
                        <div>{cardNo}</div>
                        {cardBillNo && <div className="cust-cell-code">Bill: {cardBillNo}</div>}
                      </td>
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
                          <button type="button" className="row-act-btn row-act-btn--del" onClick={(e) => { e.stopPropagation(); void handleDeleteCard(group); }} title="Delete">
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

      {/* Quick-add Customer Modal */}
      {quickAddMode === 'customer' && (
        <div className="modal-overlay" onClick={() => setQuickAddMode(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-title">Add new customer</span>
                <p className="modal-subtitle">Will be selected automatically after creation</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setQuickAddMode(null)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form className="modal-body qa-form" onSubmit={handleQuickAddCustomerSubmit}>
              <div className="qa-row-2">
                <div className="form-group">
                  <label className="form-label">Name <span className="req-star">*</span></label>
                  <input
                    className="form-input"
                    type="text"
                    value={qaCustomerName}
                    onChange={(e) => setQaCustomerName(e.target.value)}
                    placeholder="Customer name"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Short code <span className="req-star">*</span></label>
                  <input
                    className="form-input mono"
                    type="text"
                    value={qaCustomerCode}
                    onChange={(e) => setQaCustomerCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC"
                    maxLength={6}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-input"
                  value={qaCustomerType}
                  onChange={(e) => setQaCustomerType(e.target.value as Customer['type'])}
                  aria-label="Customer type"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Party-Credit">Party-Credit</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div className="qa-checks">
                <label className="qa-check-label">
                  <input type="checkbox" checked={qaCustomerHasComm} onChange={(e) => setQaCustomerHasComm(e.target.checked)} />
                  Has commission
                </label>
                <label className="qa-check-label">
                  <input type="checkbox" checked={qaCustomerRequiresDc} onChange={(e) => setQaCustomerRequiresDc(e.target.checked)} />
                  Requires DC
                </label>
                <label className="qa-check-label">
                  <input type="checkbox" checked={qaCustomerHasBillNo} onChange={(e) => setQaCustomerHasBillNo(e.target.checked)} />
                  Has bill no
                </label>
              </div>
              <div className="qa-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setQuickAddMode(null)}>Cancel</button>
                <button type="submit" className="btn btn-accent" disabled={qaSubmitting || !qaCustomerName.trim()}>
                  {qaSubmitting ? 'Creating...' : 'Create customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick-add Work Type Modal */}
      {quickAddMode === 'worktype' && (
        <div className="modal-overlay" onClick={() => setQuickAddMode(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-title">Add new work type</span>
                <p className="modal-subtitle">Will be selected in the job line automatically</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setQuickAddMode(null)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form className="modal-body qa-form" onSubmit={handleQuickAddWorkTypeSubmit}>
              <div className="qa-row-2">
                <div className="form-group">
                  <label className="form-label">Name <span className="req-star">*</span></label>
                  <input
                    className="form-input"
                    type="text"
                    value={qaWorkTypeName}
                    onChange={(e) => setQaWorkTypeName(e.target.value)}
                    placeholder="Work type name"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Short code</label>
                  <input
                    className="form-input mono"
                    type="text"
                    value={qaWorkTypeCode}
                    onChange={(e) => setQaWorkTypeCode(e.target.value)}
                    placeholder="e.g. TURN"
                    maxLength={8}
                  />
                </div>
              </div>
              <div className="qa-row-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  {(() => {
                    const cats = [...new Set(workTypes.map((wt) => wt.category).filter(Boolean))].sort() as string[];
                    return cats.length > 0 ? (
                      <select
                        className="form-input"
                        value={qaWorkTypeCategory}
                        onChange={(e) => setQaWorkTypeCategory(e.target.value)}
                        aria-label="Category"
                      >
                        {cats.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="form-input"
                        type="text"
                        value={qaWorkTypeCategory}
                        onChange={(e) => setQaWorkTypeCategory(e.target.value)}
                        placeholder="e.g. Turning"
                      />
                    );
                  })()}
                </div>
                <div className="form-group">
                  <label className="form-label">Default rate ₹</label>
                  <input
                    className="form-input mono"
                    type="number"
                    value={qaWorkTypeRate}
                    onChange={(e) => setQaWorkTypeRate(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="qa-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setQuickAddMode(null)}>Cancel</button>
                <button type="submit" className="btn btn-accent" disabled={qaSubmitting || !qaWorkTypeName.trim()}>
                  {qaSubmitting ? 'Creating...' : 'Create work type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
