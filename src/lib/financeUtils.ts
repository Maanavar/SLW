/**
 * Finance Reporting Utilities
 * Accounting-standard calculations for financial analysis
 */

import type { Job, Payment, Customer, CommissionPayment, CommissionWorker, Expense } from '@/types';
import { getJobFinalBillValue, getJobNetValue, getJobPaidAmount, getJobWorkerCommissionExpense, groupJobsByCard, isAgentWorkJob, getJobAgentSettlementPending, getJobAgentCommissionIncome, getJobAgentTdsAmount } from './jobUtils';
import { getLocalDateString } from './dateUtils';

// ============================================================================
// ACCOUNTING STANDARD TYPES
// ============================================================================

export interface RevenueMetrics {
  totalRevenue: number;      // Sum of all final bill values (amount + commission)
  commissionExpense: number; // Sum of all job.commissionAmount
  grossProfit: number;       // Our net income after commission (before expenses)
  totalExpenses: number;     // Sum of operational expenses in period
  netProfit: number;         // grossProfit - totalExpenses
  jobCount: number;          // Number of unique jobs/cards
}

export function sumExpenses(expenses: Expense[], filterByDate?: { from: string; to: string }): number {
  const filtered = filterByDate
    ? expenses.filter((e) => e.date >= filterByDate.from && e.date <= filterByDate.to)
    : expenses;
  return filtered.reduce((sum, e) => sum + (e.amount || 0), 0);
}

export interface PaymentMetrics {
  totalReceived: number;           // Total cash collected
  totalOutstanding: number;        // Total still to be collected
  collectionRate: number;          // % of revenue collected
  averagePaymentDays: number;      // Days from job creation to payment
}

export interface CommissionMetrics {
  commissionDue: number;      // Total commission from completed jobs
  commissionPaid: number;     // Total commission already paid
  commissionOutstanding: number; // Commission - Paid
}

export interface WorkerCommissionSummary {
  workerId: number;
  workerName: string;
  customerId: number;
  totalDue: number;           // Sum of tagged commission amounts for this worker
  totalPaid: number;          // Sum of commission payments to this worker
  outstanding: number;        // totalDue - totalPaid
}

export interface CustomerFinancials {
  customerId: number;
  customerName: string;
  totalRevenue: number;
  commissionExpense: number;
  grossProfit: number;
  totalReceived: number;
  totalOutstanding: number;
  jobCount: number;
  paymentRate: number; // % collected
  daysOutstanding: number; // Avg days to collect
}

export interface PaymentMethodBreakdown {
  method: 'Cash' | 'UPI' | 'Bank' | 'Cheque';
  amount: number;
  percentage: number;
  count: number;
}

export interface AgeingBucket {
  range: string; // "0-7 days", "7-14 days", etc.
  amount: number;
  percentage: number;
  jobCount: number;
  customerCount: number;
}

export interface CustomerAgeingRow {
  customerId: number;
  customerName: string;
  current: number;
  band1: number;
  band2: number;
  band3: number;
  band4: number;
  total: number;
  oldestInvoiceDays: number;
}

// ============================================================================
// REVENUE & PROFIT CALCULATIONS
// ============================================================================

export function calculateRevenueMetrics(
  jobs: Job[],
  expenses: Expense[],
  filterByDate?: { from: string; to: string }
): RevenueMetrics {
  const filtered = filterByDate
    ? jobs.filter((j) => j.date >= filterByDate.from && j.date <= filterByDate.to)
    : jobs;

  const totalRevenue = filtered.reduce((sum, job) => sum + getJobFinalBillValue(job), 0);
  const commissionExpense = filtered.reduce(
    (sum, job) => sum + getJobWorkerCommissionExpense(job),
    0
  );
  // Gross profit = SLW net income + agent commission only (TDS excluded — it's a pass-through tax)
  const grossProfit = filtered.reduce((sum, job) => {
    if (isAgentWorkJob(job)) return sum + getJobAgentCommissionIncome(job);
    return sum + (Number(job.amount) || 0);
  }, 0);
  const totalExpenses = sumExpenses(expenses, filterByDate);

  return {
    totalRevenue,
    commissionExpense,
    grossProfit,
    totalExpenses,
    netProfit: grossProfit - totalExpenses,
    jobCount: groupJobsByCard(filtered).length,
  };
}

// ============================================================================
// PAYMENT & COLLECTION CALCULATIONS
// ============================================================================

type CollectionEvent = {
  customerId: number;
  date: string;
  amount: number;
  paymentMode: Payment['paymentMode'];
  breakdown?: Payment['breakdown'];
  notes?: string;
  source: 'Payment Voucher' | 'Job Paid Entry';
  jobCardId?: string;
};

function getCardIdFromNotes(notes?: string) {
  return notes?.match(/From JobCard\s+([A-Za-z0-9-]+)/i)?.[1];
}

export function buildCollectionEvents(
  jobs: Job[],
  payments: Payment[],
  filterByDate?: { from: string; to: string }
): CollectionEvent[] {
  const paymentsInRange = filterByDate
    ? payments.filter((p) => p.date >= filterByDate.from && p.date <= filterByDate.to)
    : payments;
  const jobsInRange = filterByDate
    ? jobs.filter((j) => j.date >= filterByDate.from && j.date <= filterByDate.to)
    : jobs;

  const voucherEvents: CollectionEvent[] = paymentsInRange.map((p) => ({
    customerId: p.customerId,
    date: p.date,
    amount: Number(p.amount) || 0,
    paymentMode: p.paymentMode,
    breakdown: p.breakdown,
    notes: p.notes,
    source: 'Payment Voucher',
    jobCardId: getCardIdFromNotes(p.notes),
  }));

  const vouchersByCustomerDate = new Map<string, CollectionEvent[]>();
  voucherEvents.forEach((v) => {
    const key = `${v.customerId}|${v.date}`;
    const list = vouchersByCustomerDate.get(key) || [];
    list.push(v);
    vouchersByCustomerDate.set(key, list);
  });

  const paidGroups = groupJobsByCard(jobsInRange.filter((j) => getJobPaidAmount(j) > 0));
  const jobPaidEvents: CollectionEvent[] = paidGroups.map((group) => {
    const cardId = group.primary.jobCardId || `LEGACY-${group.primary.id}`;
    const amount = group.jobs.reduce((s, j) => s + getJobPaidAmount(j), 0);
    return {
      customerId: group.primary.customerId,
      date: group.primary.date,
      amount,
      paymentMode: (group.primary.paymentMode as Payment['paymentMode']) || 'Cash',
      source: 'Job Paid Entry',
      jobCardId: cardId,
      notes: `From JobCard ${cardId}`,
    };
  });

  const dedupedJobPaidEvents = jobPaidEvents.filter((jobEvent) => {
    const key = `${jobEvent.customerId}|${jobEvent.date}`;
    const sameDayVouchers = vouchersByCustomerDate.get(key) || [];
    if (sameDayVouchers.length === 0) return true;

    const cardId = jobEvent.jobCardId || '';
    const hasExplicitLink = cardId
      ? sameDayVouchers.some((v) => (v.notes || '').toLowerCase().includes(cardId.toLowerCase()))
      : false;
    if (hasExplicitLink) return false;

    const hasExactAmountMatch = sameDayVouchers.some((v) => Math.abs((v.amount || 0) - jobEvent.amount) < 0.01);
    if (hasExactAmountMatch) return false;

    return true;
  });

  return [...voucherEvents, ...dedupedJobPaidEvents].filter((e) => (e.amount || 0) > 0);
}

export function calculatePaymentMetrics(
  jobs: Job[],
  payments: Payment[],
  filterByDate?: { from: string; to: string }
): PaymentMetrics {
  const filtered = filterByDate
    ? jobs.filter((j) => j.date >= filterByDate.from && j.date <= filterByDate.to)
    : jobs;

  const totalRevenue = filtered.reduce((sum, job) => sum + getJobFinalBillValue(job), 0);
  const events = buildCollectionEvents(jobs, payments, filterByDate);
  const totalReceived = events.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalOutstanding = Math.max(0, totalRevenue - totalReceived);

  // Calculate average days to payment (job date → actual payment date)
  const cardPaymentDate = new Map<string, string>();
  events.forEach((e) => {
    if (!e.jobCardId) return;
    const existing = cardPaymentDate.get(e.jobCardId);
    if (!existing || e.date < existing) cardPaymentDate.set(e.jobCardId, e.date);
  });

  let totalDays = 0;
  let paidJobsCount = 0;
  const processedCards = new Set<string>();
  filtered.forEach((job) => {
    if (getJobPaidAmount(job) <= 0) return;
    const cardId = job.jobCardId || `LEGACY-${job.id}`;
    if (processedCards.has(cardId)) return;
    processedCards.add(cardId);
    const paymentDate = cardPaymentDate.get(cardId);
    if (!paymentDate) return;
    const days = Math.floor(
      (new Date(paymentDate).getTime() - new Date(job.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    totalDays += Math.max(0, days);
    paidJobsCount++;
  });

  return {
    totalReceived,
    totalOutstanding,
    collectionRate: totalRevenue > 0 ? (totalReceived / totalRevenue) * 100 : 0,
    averagePaymentDays: paidJobsCount > 0 ? Math.round(totalDays / paidJobsCount) : 0,
  };
}

// ============================================================================
// COMMISSION CALCULATIONS
// ============================================================================

export function calculateCommissionMetrics(
  jobs: Job[],
  commissionPayments: CommissionPayment[],
  filterByDate?: { from: string; to: string }
): CommissionMetrics {
  const filtered = filterByDate
    ? jobs.filter((j) => j.date >= filterByDate.from && j.date <= filterByDate.to)
    : jobs;

  const commissionDue = filtered.reduce((sum, job) => sum + getJobWorkerCommissionExpense(job), 0);

  const paymentsInRange = filterByDate
    ? commissionPayments.filter((p) => p.date >= filterByDate.from && p.date <= filterByDate.to)
    : commissionPayments;

  const commissionPaid = paymentsInRange.reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    commissionDue,
    commissionPaid,
    commissionOutstanding: Math.max(0, commissionDue - commissionPaid),
  };
}

export function calculateWorkerCommissionSummary(
  jobs: Job[],
  commissionPayments: CommissionPayment[],
  workers: CommissionWorker[],
  filterByDate?: { from: string; to: string }
): WorkerCommissionSummary[] {
  const filteredJobs = filterByDate
    ? jobs.filter((j) => j.date >= filterByDate.from && j.date <= filterByDate.to)
    : jobs;
  const filteredPayments = filterByDate
    ? commissionPayments.filter((p) => p.date >= filterByDate.from && p.date <= filterByDate.to)
    : commissionPayments;

  const summaryMap = new Map<number, WorkerCommissionSummary>();
  const workerById = new Map<number, CommissionWorker>();
  workers.forEach((worker) => workerById.set(worker.id, worker));

  // Initialize summaries for all workers
  workers.forEach((worker) => {
    summaryMap.set(worker.id, {
      workerId: worker.id,
      workerName: worker.name,
      customerId: worker.customerId,
      totalDue: 0,
      totalPaid: 0,
      outstanding: 0,
    });
  });

  // Calculate total due from tagged commission worker on each job line
  filteredJobs.forEach((job) => {
    const commission = getJobWorkerCommissionExpense(job);
    if (commission <= 0) {
      return;
    }

    let workerId = job.commissionWorkerId;
    let workerName = job.commissionWorkerName?.trim() || '';

    if (typeof workerId !== 'number' && workerName) {
      const match = workers.find(
        (worker) =>
          worker.customerId === job.customerId &&
          worker.name.toLowerCase() === workerName.toLowerCase()
      );
      if (match) {
        workerId = match.id;
      }
    }

    if (typeof workerId !== 'number') {
      return;
    }

    if (!summaryMap.has(workerId)) {
      const knownWorker = workerById.get(workerId);
      summaryMap.set(workerId, {
        workerId,
        workerName: knownWorker?.name || workerName || `Worker #${workerId}`,
        customerId: knownWorker?.customerId || job.customerId,
        totalDue: 0,
        totalPaid: 0,
        outstanding: 0,
      });
    }

    const summary = summaryMap.get(workerId);
    if (summary) {
      summary.totalDue += commission;
    }
  });

  // Calculate total paid from commission payments (skip agent payment records)
  filteredPayments.filter(p => !p.paymentType || p.paymentType === 'worker').forEach((payment) => {
    if (!summaryMap.has(payment.workerId)) {
      const knownWorker = workerById.get(payment.workerId);
      summaryMap.set(payment.workerId, {
        workerId: payment.workerId,
        workerName: knownWorker?.name || payment.workerName,
        customerId: knownWorker?.customerId || payment.customerId,
        totalDue: 0,
        totalPaid: 0,
        outstanding: 0,
      });
    }

    const paymentSummary = summaryMap.get(payment.workerId);
    if (paymentSummary) {
      paymentSummary.totalPaid += payment.amount || 0;
    }
  });

  // Calculate outstanding for each worker
  summaryMap.forEach((summary) => {
    summary.outstanding = summary.totalDue - summary.totalPaid;
  });

  return Array.from(summaryMap.values()).sort((a, b) => b.outstanding - a.outstanding);
}

// ============================================================================
// CUSTOMER-WISE ANALYSIS
// ============================================================================

export function calculateCustomerFinancials(
  jobs: Job[],
  payments: Payment[],
  customers: Customer[],
  filterByDate?: { from: string; to: string }
): CustomerFinancials[] {
  const filteredJobs = filterByDate
    ? jobs.filter((j) => j.date >= filterByDate.from && j.date <= filterByDate.to)
    : jobs;

  const customerMap = new Map<number, CustomerFinancials>();
  const customerCardSets = new Map<number, Set<string>>();

  // Process jobs
  filteredJobs.forEach((job) => {
    const existing = customerMap.get(job.customerId) || {
      customerId: job.customerId,
      customerName: customers.find((c) => c.id === job.customerId)?.name || 'Unknown',
      totalRevenue: 0,
      commissionExpense: 0,
      grossProfit: 0,
      totalReceived: 0, // resolved after comparing jobs vs vouchers to avoid double counting
      totalOutstanding: 0,
      jobCount: 0,
      paymentRate: 0,
      daysOutstanding: 0,
    };

    const finalBill = getJobFinalBillValue(job);
    const commission = getJobWorkerCommissionExpense(job);

    existing.totalRevenue += finalBill;
    existing.commissionExpense += commission;
    existing.grossProfit += getJobNetValue(job);

    const cardId = job.jobCardId || `LEGACY-${job.id}`;
    const cardSet = customerCardSets.get(job.customerId) || new Set<string>();
    cardSet.add(cardId);
    customerCardSets.set(job.customerId, cardSet);

    customerMap.set(job.customerId, existing);
  });

  const receivedByCustomer = new Map<number, number>();
  buildCollectionEvents(jobs, payments, filterByDate).forEach((e) => {
    receivedByCustomer.set(e.customerId, (receivedByCustomer.get(e.customerId) || 0) + (e.amount || 0));
  });

  // Calculate derived metrics
  const results: CustomerFinancials[] = [];
  customerMap.forEach((customer) => {
    customer.totalReceived = receivedByCustomer.get(customer.customerId) || 0;
    customer.totalOutstanding = Math.max(0, customer.totalRevenue - customer.totalReceived);
    customer.paymentRate =
      customer.totalRevenue > 0 ? (customer.totalReceived / customer.totalRevenue) * 100 : 0;
    customer.jobCount = customerCardSets.get(customer.customerId)?.size || 0;
    results.push(customer);
  });

  return results.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

// ============================================================================
// PAYMENT METHOD ANALYSIS
// ============================================================================

export function calculatePaymentMethodBreakdown(
  payments: Payment[],
  filterByDate?: { from: string; to: string }
): PaymentMethodBreakdown[] {
  const filtered = filterByDate
    ? payments.filter((p) => p.date >= filterByDate.from && p.date <= filterByDate.to)
    : payments;

  const breakdown = new Map<string, { amount: number; count: number }>();
  const methods: Array<'Cash' | 'UPI' | 'Bank' | 'Cheque'> = ['Cash', 'UPI', 'Bank', 'Cheque'];

  methods.forEach((method) => {
    breakdown.set(method, { amount: 0, count: 0 });
  });

  filtered.forEach((payment) => {
    if (payment.paymentMode === 'Mixed' && payment.breakdown) {
      // Handle mixed payments
      if (payment.breakdown.cash) {
        const method = breakdown.get('Cash')!;
        method.amount += payment.breakdown.cash;
        method.count += 1;
      }
      if (payment.breakdown.upi) {
        const method = breakdown.get('UPI')!;
        method.amount += payment.breakdown.upi;
        method.count += 1;
      }
      if (payment.breakdown.bank) {
        const method = breakdown.get('Bank')!;
        method.amount += payment.breakdown.bank;
        method.count += 1;
      }
      if (payment.breakdown.cheque) {
        const method = breakdown.get('Cheque')!;
        method.amount += payment.breakdown.cheque;
        method.count += 1;
      }
    } else if (payment.paymentMode && methods.includes(payment.paymentMode as any)) {
      const existing = breakdown.get(payment.paymentMode)!;
      existing.amount += payment.amount || 0;
      existing.count += 1;
    }
  });

  const totalAmount = Array.from(breakdown.values()).reduce((sum, v) => sum + v.amount, 0);

  return methods
    .map((method) => {
      const data = breakdown.get(method)!;
      return {
        method,
        amount: data.amount,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
        count: data.count,
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function calculateCollectionMethodBreakdown(
  jobs: Job[],
  payments: Payment[],
  filterByDate?: { from: string; to: string }
): PaymentMethodBreakdown[] {
  const events = buildCollectionEvents(jobs, payments, filterByDate);

  const breakdown = new Map<string, { amount: number; count: number }>();
  const methods: Array<'Cash' | 'UPI' | 'Bank' | 'Cheque'> = ['Cash', 'UPI', 'Bank', 'Cheque'];

  methods.forEach((method) => {
    breakdown.set(method, { amount: 0, count: 0 });
  });

  events.forEach((entry) => {
    if (entry.paymentMode === 'Mixed' && entry.breakdown) {
      if (entry.breakdown.cash) {
        const method = breakdown.get('Cash')!;
        method.amount += entry.breakdown.cash;
        method.count += 1;
      }
      if (entry.breakdown.upi) {
        const method = breakdown.get('UPI')!;
        method.amount += entry.breakdown.upi;
        method.count += 1;
      }
      if (entry.breakdown.bank) {
        const method = breakdown.get('Bank')!;
        method.amount += entry.breakdown.bank;
        method.count += 1;
      }
      if (entry.breakdown.cheque) {
        const method = breakdown.get('Cheque')!;
        method.amount += entry.breakdown.cheque;
        method.count += 1;
      }
      return;
    }

    if (entry.paymentMode && methods.includes(entry.paymentMode as any)) {
      const existing = breakdown.get(entry.paymentMode)!;
      existing.amount += entry.amount || 0;
      existing.count += 1;
    }
  });

  const totalAmount = Array.from(breakdown.values()).reduce((sum, v) => sum + v.amount, 0);

  return methods
    .map((method) => {
      const data = breakdown.get(method)!;
      return {
        method,
        amount: data.amount,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
        count: data.count,
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

// ============================================================================
// OUTSTANDING BALANCE AGEING
// ============================================================================

export function calculateOutstandingAgeing(
  jobs: Job[],
  payments: Payment[]
): AgeingBucket[] {
  const today = new Date();
  const buckets: AgeingBucket[] = [
    { range: '0-7 days',   amount: 0, percentage: 0, jobCount: 0, customerCount: 0 },
    { range: '8-30 days',  amount: 0, percentage: 0, jobCount: 0, customerCount: 0 },
    { range: '31-60 days', amount: 0, percentage: 0, jobCount: 0, customerCount: 0 },
    { range: '61-90 days', amount: 0, percentage: 0, jobCount: 0, customerCount: 0 },
    { range: '90+ days',   amount: 0, percentage: 0, jobCount: 0, customerCount: 0 },
  ];

  // Total received per customer including payment vouchers (proper deduplication)
  const receivedByCustomer = new Map<number, number>();
  buildCollectionEvents(jobs, payments).forEach((e) => {
    receivedByCustomer.set(e.customerId, (receivedByCustomer.get(e.customerId) || 0) + (e.amount || 0));
  });

  const jobsByCustomer = new Map<number, Job[]>();
  jobs.forEach((job) => {
    if (!jobsByCustomer.has(job.customerId)) jobsByCustomer.set(job.customerId, []);
    jobsByCustomer.get(job.customerId)!.push(job);
  });

  const customerBuckets = new Map<number, number[]>();

  jobsByCustomer.forEach((customerJobs, customerId) => {
    // FIFO: oldest bills are assumed paid first
    const sortedJobs = [...customerJobs].sort((a, b) => a.date.localeCompare(b.date));
    let remainingReceived = receivedByCustomer.get(customerId) || 0;

    sortedJobs.forEach((job) => {
      const jobBill = getJobFinalBillValue(job);
      const paid = Math.min(jobBill, remainingReceived);
      remainingReceived = Math.max(0, remainingReceived - paid);
      const outstanding = jobBill - paid;
      if (outstanding <= 0) return;

      const days = Math.floor(
        (today.getTime() - new Date(`${job.date}T00:00:00`).getTime()) / 86400000
      );

      let bucketIndex: number;
      if (days <= 7) bucketIndex = 0;
      else if (days <= 30) bucketIndex = 1;
      else if (days <= 60) bucketIndex = 2;
      else if (days <= 90) bucketIndex = 3;
      else bucketIndex = 4;

      buckets[bucketIndex].amount += outstanding;
      buckets[bucketIndex].jobCount += 1;

      if (!customerBuckets.has(customerId)) customerBuckets.set(customerId, []);
      if (!customerBuckets.get(customerId)!.includes(bucketIndex)) {
        customerBuckets.get(customerId)!.push(bucketIndex);
      }
    });
  });

  const totalOutstanding = buckets.reduce((sum, b) => sum + b.amount, 0);
  buckets.forEach((bucket, index) => {
    bucket.percentage = totalOutstanding > 0 ? (bucket.amount / totalOutstanding) * 100 : 0;
    bucket.customerCount = Array.from(customerBuckets.values()).filter((bktList) =>
      bktList.includes(index)
    ).length;
  });

  return buckets.filter((b) => b.amount > 0);
}

export function calculateCustomerAgeing(
  jobs: Job[],
  payments: Payment[],
  customers: Customer[]
): CustomerAgeingRow[] {
  const today = new Date();
  const rows = new Map<number, CustomerAgeingRow>();

  // Total received per customer including payment vouchers (proper deduplication)
  const receivedByCustomer = new Map<number, number>();
  buildCollectionEvents(jobs, payments).forEach((e) => {
    receivedByCustomer.set(e.customerId, (receivedByCustomer.get(e.customerId) || 0) + (e.amount || 0));
  });

  const jobsByCustomer = new Map<number, Job[]>();
  jobs.forEach((job) => {
    if (!jobsByCustomer.has(job.customerId)) jobsByCustomer.set(job.customerId, []);
    jobsByCustomer.get(job.customerId)!.push(job);
  });

  jobsByCustomer.forEach((customerJobs, customerId) => {
    // FIFO: oldest bills are assumed paid first
    const sortedJobs = [...customerJobs].sort((a, b) => a.date.localeCompare(b.date));
    let remainingReceived = receivedByCustomer.get(customerId) || 0;

    const row: CustomerAgeingRow = {
      customerId,
      customerName: customers.find((c) => c.id === customerId)?.name || 'Unknown',
      current: 0,
      band1: 0,
      band2: 0,
      band3: 0,
      band4: 0,
      total: 0,
      oldestInvoiceDays: 0,
    };

    sortedJobs.forEach((job) => {
      const jobBill = getJobFinalBillValue(job);
      const paid = Math.min(jobBill, remainingReceived);
      remainingReceived = Math.max(0, remainingReceived - paid);
      const outstanding = jobBill - paid;
      if (outstanding <= 0) return;

      const days = Math.max(
        0,
        Math.floor((today.getTime() - new Date(`${job.date}T00:00:00`).getTime()) / 86400000)
      );

      if (days <= 7) row.current += outstanding;
      else if (days <= 30) row.band1 += outstanding;
      else if (days <= 60) row.band2 += outstanding;
      else if (days <= 90) row.band3 += outstanding;
      else row.band4 += outstanding;

      row.total += outstanding;
      row.oldestInvoiceDays = Math.max(row.oldestInvoiceDays, days);
    });

    if (row.total > 0) rows.set(customerId, row);
  });

  return Array.from(rows.values()).sort((a, b) => b.total - a.total);
}

// ============================================================================
// TEN-DAY PERIOD ANALYSIS
// ============================================================================

export interface TenDayDayData {
  date: string;
  dayNum: number;
  revenue: number;
  commission: number;
  slwNetProfit: number;
  agentNetProfit: number;   // agent commission income only (TDS excluded)
  agentTds: number;         // TDS collected — pass-through, not SLW income
  agentSettlementPending: number;
  expenses: number;
  netProfit: number;        // slwNetProfit + agentNetProfit - expenses
  cards: number;
}

export interface TenDaySet {
  setNumber: 1 | 2 | 3;
  label: string;
  fromDate: string;
  toDate: string;
  days: TenDayDayData[];
  totalRevenue: number;
  totalCommission: number;
  totalSlwNetProfit: number;
  totalAgentNetProfit: number;  // commission only
  totalAgentTds: number;
  totalAgentSettlementPending: number;
  totalExpenses: number;
  totalNetProfit: number;       // totalSlwNetProfit + totalAgentNetProfit - totalExpenses
  totalCards: number;
}

function toCanonicalLocalDate(dateValue: string | null | undefined): string | null {
  const raw = String(dateValue || '').trim();
  if (!raw) return null;

  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (ymd) {
    const year = ymd[1];
    const month = String(Number(ymd[2])).padStart(2, '0');
    const day = String(Number(ymd[3])).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(raw);
  if (dmy) {
    const day = String(Number(dmy[1])).padStart(2, '0');
    const month = String(Number(dmy[2])).padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function calculateTenDayBreakdown(
  jobs: Job[],
  expenses: Expense[],
  year: number,
  month: number  // 1-indexed: 1=Jan, 12=Dec
): TenDaySet[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthName = MONTH_NAMES[month - 1];
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const jobsByDate = new Map<string, Job[]>();
  const expensesByDate = new Map<string, number>();

  jobs.forEach((job) => {
    const normalized = toCanonicalLocalDate(job.date);
    if (!normalized || !normalized.startsWith(monthStr)) return;
    if (!jobsByDate.has(normalized)) jobsByDate.set(normalized, []);
    jobsByDate.get(normalized)!.push(job);
  });

  expenses.forEach((expense) => {
    const normalized = toCanonicalLocalDate(expense.date);
    if (!normalized || !normalized.startsWith(monthStr)) return;
    expensesByDate.set(normalized, (expensesByDate.get(normalized) || 0) + (expense.amount || 0));
  });

  const sets: Array<{ setNumber: 1 | 2 | 3; from: number; to: number }> = [
    { setNumber: 1, from: 1,  to: 10 },
    { setNumber: 2, from: 11, to: 20 },
    { setNumber: 3, from: 21, to: daysInMonth },
  ];

  return sets.map(({ setNumber, from, to }) => {
    const fromDate = `${monthStr}-${String(from).padStart(2, '0')}`;
    const toDate   = `${monthStr}-${String(to).padStart(2, '0')}`;
    const label    = `Set ${setNumber} - ${monthName} ${from}-${to}`;

    const days: TenDayDayData[] = [];
    for (let d = from; d <= to; d++) {
      const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      const dayJobs = jobsByDate.get(dateStr) || [];
      const slwNetProfit   = dayJobs.filter(j => !isAgentWorkJob(j)).reduce((s, j) => s + getJobNetValue(j), 0);
      const agentNetProfit = dayJobs.filter(j =>  isAgentWorkJob(j)).reduce((s, j) => s + getJobAgentCommissionIncome(j), 0);
      const agentTds       = dayJobs.filter(j =>  isAgentWorkJob(j)).reduce((s, j) => s + getJobAgentTdsAmount(j), 0);
      const agentSettlementPending = dayJobs.reduce((s, j) => s + getJobAgentSettlementPending(j), 0);
      const dayExpenses    = expensesByDate.get(dateStr) || 0;
      days.push({
        date: dateStr,
        dayNum: d,
        revenue:    dayJobs.reduce((s, j) => s + getJobFinalBillValue(j), 0),
        commission: dayJobs.reduce((s, j) => s + getJobWorkerCommissionExpense(j), 0),
        slwNetProfit,
        agentNetProfit,
        agentTds,
        agentSettlementPending,
        expenses:   dayExpenses,
        netProfit:  slwNetProfit + agentNetProfit - dayExpenses,
        cards:      groupJobsByCard(dayJobs).length,
      });
    }

    return {
      setNumber,
      label,
      fromDate,
      toDate,
      days,
      totalRevenue:              days.reduce((s, d) => s + d.revenue, 0),
      totalCommission:           days.reduce((s, d) => s + d.commission, 0),
      totalSlwNetProfit:         days.reduce((s, d) => s + d.slwNetProfit, 0),
      totalAgentNetProfit:       days.reduce((s, d) => s + d.agentNetProfit, 0),
      totalAgentTds:             days.reduce((s, d) => s + d.agentTds, 0),
      totalAgentSettlementPending: days.reduce((s, d) => s + d.agentSettlementPending, 0),
      totalExpenses:             days.reduce((s, d) => s + d.expenses, 0),
      totalNetProfit:            days.reduce((s, d) => s + d.netProfit, 0),
      totalCards:                days.reduce((s, d) => s + d.cards, 0),
    };
  });
}

// ============================================================================
// CASH FLOW ANALYSIS
// ============================================================================

export interface DailyCashFlow {
  date: string;
  revenue: number;
  commission: number;
  netIncome: number;
  expenses: number;
  netProfit: number;
  received: number;
  outstanding: number;
}

export function calculateDailyCashFlow(
  jobs: Job[],
  payments: Payment[],
  expenses: Expense[],
  days: number = 30
): DailyCashFlow[] {
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const cashFlows: Map<string, DailyCashFlow> = new Map();

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = getLocalDateString(date);

    cashFlows.set(dateStr, {
      date: dateStr,
      revenue: 0,
      commission: 0,
      netIncome: 0,
      expenses: 0,
      netProfit: 0,
      received: 0,
      outstanding: 0,
    });
  }

  // Add job revenues and commissions
  jobs.forEach((job) => {
    const flow = cashFlows.get(job.date);
    if (flow) {
      flow.revenue += getJobFinalBillValue(job);
      flow.commission += getJobWorkerCommissionExpense(job);
      flow.netIncome += getJobNetValue(job);
      flow.outstanding += Math.max(0, getJobFinalBillValue(job) - (getJobPaidAmount(job) || 0));
    }
  });

  // Add expenses per day
  expenses.forEach((expense) => {
    const flow = cashFlows.get(expense.date);
    if (flow) {
      flow.expenses += expense.amount || 0;
    }
  });

  // Compute net profit = net income - expenses for each day
  cashFlows.forEach((flow) => {
    flow.netProfit = flow.netIncome - flow.expenses;
  });

  // Add receipts (vouchers + job-paid entries) for the window
  const fromStr = Array.from(cashFlows.keys()).sort()[0] || todayStr;
  const events = buildCollectionEvents(jobs, payments, { from: fromStr, to: todayStr });
  events.forEach((entry) => {
    const flow = cashFlows.get(entry.date);
    if (flow) {
      flow.received += entry.amount || 0;
    }
  });

  return Array.from(cashFlows.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days);
}
