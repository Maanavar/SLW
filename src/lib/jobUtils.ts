/**
 * Job Utility Functions
 * Ported from src/js/data.js and src/js/dashboard.js
 */

import type { Job, Customer, JobGroup, JobSummary } from '@/types';

export type PaymentStatus = 'Paid' | 'Pending' | 'Partially Paid';

function normalizeCustomerToken(value?: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

export function isMahalingamCustomer(customer?: Customer | null): boolean {
  if (!customer) return false;

  const normalizedShortCode = normalizeCustomerToken(customer.shortCode);
  const normalizedName = normalizeCustomerToken(customer.name);
  return (
    normalizedShortCode === 'nm' ||
    normalizedName.includes('mahaling') ||
    normalizedName.includes('mahalingam') ||
    normalizedName.includes('mahalingham') ||
    normalizedName.includes('mahalinham')
  );
}

/**
 * Check if a customer requires DC (Delivery Challan) fields
 */
export function isDcApplicableCustomer(customer?: Customer | null): boolean {
  return customer?.requiresDc === true || isMahalingamCustomer(customer);
}

/**
 * Check if a customer has commission to pay workers
 */
export function isCommissionApplicableCustomer(customer?: Customer | null): boolean {
  return customer?.hasCommission === true;
}

/**
 * Get work mode for job (Workshop or Spot)
 */
export function getJobWorkMode(job: Job): string {
  return job.workMode || (job.isSpotWork ? 'Spot' : 'Workshop');
}

/**
 * Get unique group key for job (card-based or legacy)
 */
export function getJobGroupKey(job: Job): string {
  if (job.jobCardId) {
    return `card:${job.jobCardId}`;
  }
  return `legacy:${job.id}`;
}

/**
 * Get work name for job
 */
export function getJobWorkName(job: Job): string {
  return job.workName || job.workTypeName || '';
}

/**
 * Get final bill value for a job line.
 * Business rule: Final Bill = Amount + Commission.
 */
export function getJobFinalBillValue(job: Job): number {
  return (Number(job.amount) || 0) + (Number(job.commissionAmount) || 0);
}

export function isAgentWorkJob(job: Job): boolean {
  return job.jobFlowType === 'agent_work';
}

export function getJobWorkerCommissionExpense(job: Job): number {
  if (isAgentWorkJob(job)) return 0;
  return Number(job.commissionAmount) || 0;
}

export function getJobAgentCommissionIncome(job: Job): number {
  if (!isAgentWorkJob(job)) return 0;
  return Number(job.agentCommissionAmount) || 0;
}

export function getJobAgentTdsAmount(job: Job): number {
  if (!isAgentWorkJob(job)) return 0;
  return Number(job.agentTdsAmount) || 0;
}

export function getJobAgentNetPayable(job: Job): number {
  if (!isAgentWorkJob(job)) return 0;
  return Math.max(0, (Number(job.amount) || 0) - getJobAgentCommissionIncome(job) - getJobAgentTdsAmount(job));
}

export function getJobAgentSettlementPaid(job: Job): number {
  if (!isAgentWorkJob(job)) return 0;
  return Number(job.agentSettlementPaidAmount) || 0;
}

export function getJobAgentSettlementPending(job: Job): number {
  if (!isAgentWorkJob(job)) return 0;
  return Math.max(0, getJobAgentNetPayable(job) - getJobAgentSettlementPaid(job));
}

/**
 * Get payment status for job
 */
export function getJobPaymentStatus(job: Job): string {
  return getPaymentStatusFromAmounts(getJobPaidAmount(job), getJobFinalBillValue(job));
}

/**
 * Get payment mode for job
 */
export function getJobPaymentMode(job: Job): string {
  return job.paymentMode || '-';
}

/**
 * Get paid amount for job
 */
export function getJobPaidAmount(job: Job): number {
  if (typeof job.paidAmount === 'number') {
    return job.paidAmount;
  }

  if ((job.paymentStatus || '').toLowerCase() === 'paid') {
    return getJobFinalBillValue(job);
  }

  return 0;
}

/**
 * Derive payment status from paid and due values
 */
export function getPaymentStatusFromAmounts(paid: number, due: number): PaymentStatus {
  const normalizedPaid = Number(paid) || 0;
  const normalizedDue = Number(due) || 0;

  if (normalizedPaid <= 0 || normalizedDue <= 0) {
    return 'Pending';
  }

  if (normalizedPaid >= normalizedDue) {
    return 'Paid';
  }

  return 'Partially Paid';
}

/**
 * Get our net income for a job line.
 * Business rule: `job.amount` already stores our net income.
 */
export function getJobNetValue(job: Job): number {
  if (!isAgentWorkJob(job)) {
    return Number(job.amount) || 0;
  }
  // In agent flow, SLW income is retained commission + TDS.
  return getJobAgentCommissionIncome(job) + getJobAgentTdsAmount(job);
}

/**
 * Get DC (Delivery Challan) status for job
 */
export function getJobDcStatus(job: Job, customer?: Customer): string {
  if (!isDcApplicableCustomer(customer)) {
    return 'Not Required';
  }

  const hasDcDetails = job.dcNo || job.vehicleNo || job.dcDate;
  if (hasDcDetails) {
    return 'DC Received';
  }
  if (job.dcApproval === true) {
    return 'DC Pending (Waived)';
  }
  return 'DC Missing';
}

/**
 * Calculate customer balance
 * Balance = Total Final Bill - Amount Paid from Jobs - Direct Payments
 */
export function calculateCustomerBalance(
  jobs: Job[],
  payments: Array<{ customerId: number; amount: number }>,
  customerId: number
): number {
  const customerJobs = jobs.filter((j) => j.customerId === customerId);
  const customerPayments = payments.filter((p) => p.customerId === customerId);

  const totalDue = customerJobs.reduce((sum, j) => sum + getJobFinalBillValue(j), 0);
  const totalPaidFromJobs = customerJobs.reduce((sum, j) => sum + getJobPaidAmount(j), 0);
  const totalPaidFromPayments = customerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Payments are usually reflected in both `payments` and `job.paidAmount`.
  // Using the larger source prevents double-counting while staying backward-compatible with legacy rows.
  const totalPaid = Math.max(totalPaidFromJobs, totalPaidFromPayments);
  return Math.max(0, totalDue - totalPaid);
}

/**
 * Group jobs by card/job group
 */
export function groupJobsByCard(jobs: Job[]): JobGroup[] {
  const groups = new Map<string, Job[]>();

  jobs.forEach((job) => {
    const key = getJobGroupKey(job);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(job);
  });

  return [...groups.entries()].map(([key, groupJobs]) => {
    const sortedJobs = [...groupJobs].sort(
      (a, b) => (a.jobCardLine || a.id) - (b.jobCardLine || b.id)
    );
    return {
      key,
      jobs: sortedJobs,
      primary: sortedJobs[0],
      totalAmount: sortedJobs.reduce((sum, job) => sum + (Number(job.amount) || 0), 0),
      totalNet: sortedJobs.reduce((sum, job) => sum + getJobNetValue(job), 0),
      totalCommission: sortedJobs.reduce(
        (sum, job) => sum + getJobWorkerCommissionExpense(job),
        0
      ),
      totalQuantity: sortedJobs.reduce((sum, job) => sum + (Number(job.quantity) || 0), 0),
      lineCount: sortedJobs.length,
    };
  });
}

/**
 * Get summary statistics for jobs
 */
export function getJobSummary(jobs: Job[]): JobSummary {
  const billed = jobs.reduce((sum, job) => sum + getJobFinalBillValue(job), 0);
  const commission = jobs.reduce((sum, job) => sum + getJobWorkerCommissionExpense(job), 0);
  const net = jobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
  const received = jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
  const pending = billed - received;
  const jobCards = groupJobsByCard(jobs).length;

  return {
    jobs: jobCards,
    billed,
    commission,
    net,
    received,
    pending,
  };
}

/**
 * Compute payment summary for a grouped JobCard
 */
export function getJobCardPaymentSummary(jobs: Job[]) {
  const finalBill = jobs.reduce((sum, job) => sum + getJobFinalBillValue(job), 0);
  const net = jobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
  const workerCommissionExpense = jobs.reduce((sum, job) => sum + getJobWorkerCommissionExpense(job), 0);
  const agentCommissionIncome = jobs.reduce((sum, job) => sum + getJobAgentCommissionIncome(job), 0);
  const agentTdsIncome = jobs.reduce((sum, job) => sum + getJobAgentTdsAmount(job), 0);
  const agentNetPayable = jobs.reduce((sum, job) => sum + getJobAgentNetPayable(job), 0);
  const agentSettlementPaid = jobs.reduce((sum, job) => sum + getJobAgentSettlementPaid(job), 0);
  const agentSettlementPending = Math.max(0, agentNetPayable - agentSettlementPaid);
  const paid = jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
  const pending = Math.max(0, finalBill - paid);

  return {
    finalBill,
    net,
    workerCommissionExpense,
    agentCommissionIncome,
    agentTdsIncome,
    agentNetPayable,
    agentSettlementPaid,
    agentSettlementPending,
    paid,
    pending,
    status: getPaymentStatusFromAmounts(paid, finalBill),
  };
}
