/**
 * Finance Reporting Utilities
 * Accounting-standard calculations for financial analysis
 */

import type { Job, Payment, Customer, CommissionPayment, CommissionWorker } from '@/types';
import { getJobNetValue, getJobPaidAmount, groupJobsByCard } from './jobUtils';

// ============================================================================
// ACCOUNTING STANDARD TYPES
// ============================================================================

export interface RevenueMetrics {
  totalRevenue: number;      // Sum of all job.amount
  commissionExpense: number; // Sum of all job.commissionAmount
  grossProfit: number;       // totalRevenue - commissionExpense
  jobCount: number;          // Number of unique jobs/cards
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
  totalDue: number;           // Sum of commission distribution amounts for this worker
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

// ============================================================================
// REVENUE & PROFIT CALCULATIONS
// ============================================================================

export function calculateRevenueMetrics(
  jobs: Job[],
  filterByDate?: { from: string; to: string }
): RevenueMetrics {
  const filtered = filterByDate
    ? jobs.filter((j) => j.date >= filterByDate.from && j.date <= filterByDate.to)
    : jobs;

  const totalRevenue = filtered.reduce((sum, job) => sum + (Number(job.amount) || 0), 0);
  const commissionExpense = filtered.reduce(
    (sum, job) => sum + (Number(job.commissionAmount) || 0),
    0
  );

  return {
    totalRevenue,
    commissionExpense,
    grossProfit: totalRevenue - commissionExpense,
    jobCount: groupJobsByCard(filtered).length,
  };
}

// ============================================================================
// PAYMENT & COLLECTION CALCULATIONS
// ============================================================================

export function calculatePaymentMetrics(
  jobs: Job[],
  payments: Payment[],
  filterByDate?: { from: string; to: string }
): PaymentMetrics {
  const filtered = filterByDate
    ? jobs.filter((j) => j.date >= filterByDate.from && j.date <= filterByDate.to)
    : jobs;

  const totalRevenue = filtered.reduce((sum, job) => sum + (Number(job.amount) || 0), 0);

  const paymentsInRange = filterByDate
    ? payments.filter((p) => p.date >= filterByDate.from && p.date <= filterByDate.to)
    : payments;

  const paymentsFromJobs = filtered.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
  const paymentsFromVouchers = paymentsInRange.reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalReceived = Math.max(paymentsFromVouchers, paymentsFromJobs);
  const totalOutstanding = totalRevenue - totalReceived;

  // Calculate average days to payment
  let totalDays = 0;
  let paidJobsCount = 0;
  filtered.forEach((job) => {
    if (getJobPaidAmount(job) > 0) {
      const jobDate = new Date(job.date);
      const today = new Date();
      const days = Math.floor((today.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24));
      totalDays += Math.max(0, days);
      paidJobsCount++;
    }
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

  const commissionDue = filtered.reduce((sum, job) => sum + (Number(job.commissionAmount) || 0), 0);

  const paymentsInRange = filterByDate
    ? commissionPayments.filter((p) => p.date >= filterByDate.from && p.date <= filterByDate.to)
    : commissionPayments;

  const commissionPaid = paymentsInRange.reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    commissionDue,
    commissionPaid,
    commissionOutstanding: commissionDue - commissionPaid,
  };
}

export function calculateWorkerCommissionSummary(
  jobs: Job[],
  commissionPayments: CommissionPayment[],
  workers: CommissionWorker[]
): WorkerCommissionSummary[] {
  const summaryMap = new Map<number, WorkerCommissionSummary>();

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

  // Calculate total due from commission distributions
  jobs.forEach((job) => {
    if (job.commissionDistribution && Array.isArray(job.commissionDistribution)) {
      job.commissionDistribution.forEach((dist) => {
        const summary = summaryMap.get(dist.workerId);
        if (summary) {
          summary.totalDue += dist.amount || 0;
        }
      });
    }
  });

  // Calculate total paid from commission payments
  commissionPayments.forEach((payment) => {
    const summary = summaryMap.get(payment.workerId);
    if (summary) {
      summary.totalPaid += payment.amount || 0;
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
  customers: Customer[]
): CustomerFinancials[] {
  const customerMap = new Map<number, CustomerFinancials>();

  // Process jobs
  jobs.forEach((job) => {
    const existing = customerMap.get(job.customerId) || {
      customerId: job.customerId,
      customerName: customers.find((c) => c.id === job.customerId)?.name || 'Unknown',
      totalRevenue: 0,
      commissionExpense: 0,
      grossProfit: 0,
      totalReceived: 0,
      totalOutstanding: 0,
      jobCount: 0,
      paymentRate: 0,
      daysOutstanding: 0,
    };

    const amount = Number(job.amount) || 0;
    const commission = Number(job.commissionAmount) || 0;

    existing.totalRevenue += amount;
    existing.commissionExpense += commission;
    existing.grossProfit = existing.totalRevenue - existing.commissionExpense;
    existing.totalReceived += getJobPaidAmount(job);
    existing.jobCount += 1;

    customerMap.set(job.customerId, existing);
  });

  // Process additional payments (vouchers)
  payments.forEach((payment) => {
    const existing = customerMap.get(payment.customerId);
    if (existing) {
      existing.totalReceived += payment.amount || 0;
    }
  });

  // Calculate derived metrics
  const results: CustomerFinancials[] = [];
  customerMap.forEach((customer) => {
    customer.totalOutstanding = customer.totalRevenue - customer.totalReceived;
    customer.paymentRate =
      customer.totalRevenue > 0 ? (customer.totalReceived / customer.totalRevenue) * 100 : 0;
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
      if (payment.breakdown.cash) breakdown.get('Cash')!.amount += payment.breakdown.cash;
      if (payment.breakdown.upi) breakdown.get('UPI')!.amount += payment.breakdown.upi;
      if (payment.breakdown.bank) breakdown.get('Bank')!.amount += payment.breakdown.bank;
      if (payment.breakdown.cheque) breakdown.get('Cheque')!.amount += payment.breakdown.cheque;
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

// ============================================================================
// OUTSTANDING BALANCE AGEING
// ============================================================================

export function calculateOutstandingAgeing(
  jobs: Job[],
  payments: Payment[]
): AgeingBucket[] {
  const today = new Date();
  const buckets: AgeingBucket[] = [
    { range: '0-7 days', amount: 0, percentage: 0, jobCount: 0, customerCount: 0 },
    { range: '7-14 days', amount: 0, percentage: 0, jobCount: 0, customerCount: 0 },
    { range: '14-30 days', amount: 0, percentage: 0, jobCount: 0, customerCount: 0 },
    { range: '30-60 days', amount: 0, percentage: 0, jobCount: 0, customerCount: 0 },
    { range: '60+ days', amount: 0, percentage: 0, jobCount: 0, customerCount: 0 },
  ];

  const customerAges = new Map<number, number[]>();

  jobs.forEach((job) => {
    const outstanding = Number(job.amount) || 0 - (getJobPaidAmount(job) || 0);
    if (outstanding > 0) {
      const jobDate = new Date(job.date);
      const days = Math.floor((today.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24));

      let bucketIndex = 0;
      if (days <= 7) bucketIndex = 0;
      else if (days <= 14) bucketIndex = 1;
      else if (days <= 30) bucketIndex = 2;
      else if (days <= 60) bucketIndex = 3;
      else bucketIndex = 4;

      buckets[bucketIndex].amount += outstanding;
      buckets[bucketIndex].jobCount += 1;

      if (!customerAges.has(job.customerId)) {
        customerAges.set(job.customerId, []);
      }
      if (!customerAges.get(job.customerId)!.includes(bucketIndex)) {
        customerAges.get(job.customerId)!.push(bucketIndex);
      }
    }
  });

  const totalOutstanding = buckets.reduce((sum, b) => sum + b.amount, 0);

  buckets.forEach((bucket) => {
    bucket.percentage = totalOutstanding > 0 ? (bucket.amount / totalOutstanding) * 100 : 0;
    // Count unique customers in this bucket (rough estimate)
    bucket.customerCount = Array.from(customerAges.values()).filter((ages) =>
      ages.includes(buckets.indexOf(bucket))
    ).length;
  });

  return buckets.filter((b) => b.amount > 0);
}

// ============================================================================
// CASH FLOW ANALYSIS
// ============================================================================

export interface DailyCashFlow {
  date: string;
  revenue: number;
  commission: number;
  netIncome: number;
  received: number;
  outstanding: number;
}

export function calculateDailyCashFlow(
  jobs: Job[],
  payments: Payment[],
  days: number = 30
): DailyCashFlow[] {
  const today = new Date();
  const cashFlows: Map<string, DailyCashFlow> = new Map();

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    cashFlows.set(dateStr, {
      date: dateStr,
      revenue: 0,
      commission: 0,
      netIncome: 0,
      received: 0,
      outstanding: 0,
    });
  }

  // Add job revenues and commissions
  jobs.forEach((job) => {
    const flow = cashFlows.get(job.date);
    if (flow) {
      flow.revenue += Number(job.amount) || 0;
      flow.commission += Number(job.commissionAmount) || 0;
      flow.netIncome = flow.revenue - flow.commission;
      flow.outstanding = flow.revenue - (getJobPaidAmount(job) || 0);
    }
  });

  // Add payment receipts
  payments.forEach((payment) => {
    const flow = cashFlows.get(payment.date);
    if (flow) {
      flow.received += payment.amount || 0;
    }
  });

  return Array.from(cashFlows.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days);
}
