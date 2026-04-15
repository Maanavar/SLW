/**
 * Job Utility Functions
 * Ported from src/js/data.js and src/js/dashboard.js
 */

import type { Job, Customer, JobGroup, JobSummary, CommissionWorker, CommissionDistribution } from '@/types';

export type PaymentStatus = 'Paid' | 'Pending' | 'Partially Paid';

/**
 * Check if a customer requires DC (Delivery Challan) fields
 */
export function isDcApplicableCustomer(customer?: Customer | null): boolean {
  return customer?.requiresDc === true;
}

/**
 * Check if a customer has commission to pay workers
 */
export function isCommissionApplicableCustomer(customer?: Customer | null): boolean {
  return customer?.hasCommission === true;
}

/**
 * Compute default commission distribution based on workers and total commission
 * For percentage-based workers: amount = (shareValue / 100) * totalCommission
 * For fixed-amount workers: amount = shareValue
 * Last worker absorbs rounding differences
 */
export function computeDefaultDistribution(
  workers: CommissionWorker[],
  totalCommission: number
): CommissionDistribution[] {
  if (!workers.length || totalCommission <= 0) {
    return [];
  }

  const activeWorkers = workers.filter((w) => w.isActive);
  if (!activeWorkers.length) {
    return [];
  }

  const distribution: CommissionDistribution[] = [];
  let allocatedAmount = 0;

  activeWorkers.forEach((worker, index) => {
    let amount = 0;

    if (worker.shareType === 'percentage') {
      amount = (worker.shareValue / 100) * totalCommission;
    } else {
      // fixed amount
      amount = worker.shareValue;
    }

    // Last worker absorbs rounding differences
    if (index === activeWorkers.length - 1) {
      amount = Math.max(0, totalCommission - allocatedAmount);
    } else {
      allocatedAmount += amount;
    }

    distribution.push({
      workerId: worker.id,
      workerName: worker.name,
      amount: Number(amount.toFixed(2)),
    });
  });

  return distribution;
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
 * Get payment status for job
 */
export function getJobPaymentStatus(job: Job): string {
  return getPaymentStatusFromAmounts(getJobPaidAmount(job), getJobNetValue(job));
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
    return getJobNetValue(job);
  }

  return 0;
}

/**
 * Derive payment status from paid and net values
 */
export function getPaymentStatusFromAmounts(paid: number, net: number): PaymentStatus {
  const normalizedPaid = Number(paid) || 0;
  const normalizedNet = Number(net) || 0;

  if (normalizedPaid <= 0 || normalizedNet <= 0) {
    return 'Pending';
  }

  if (normalizedPaid >= normalizedNet) {
    return 'Paid';
  }

  return 'Partially Paid';
}

/**
 * Get net value for job (Our actual profit)
 * Business rule: Net Value = Revenue - Commission Expense
 *
 * Example:
 *   Company pays us: ₹1,200 (job.amount)
 *   Commission to manager: ₹200 (job.commissionAmount)
 *   Our Net Income: ₹1,000 (₹1,200 - ₹200)
 */
export function getJobNetValue(job: Job): number {
  const amount = Number(job.amount) || 0;
  const commission = Number(job.commissionAmount) || 0;
  return amount - commission;
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
    return 'Completed';
  }
  if (job.dcApproval === false) {
    return 'Approved without DC';
  }
  return 'Pending DC';
}

/**
 * Calculate customer balance
 * Balance = Total Net Amount - Amount Paid from Jobs - Direct Payments
 */
export function calculateCustomerBalance(
  jobs: Job[],
  payments: Array<{ customerId: number; amount: number }>,
  customerId: number
): number {
  const customerJobs = jobs.filter((j) => j.customerId === customerId);
  const customerPayments = payments.filter((p) => p.customerId === customerId);

  const totalNet = customerJobs.reduce((sum, j) => sum + getJobNetValue(j), 0);
  const totalPaidFromJobs = customerJobs.reduce((sum, j) => sum + getJobPaidAmount(j), 0);
  const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);

  return totalNet - totalPaidFromJobs - totalPaid;
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
        (sum, job) => sum + (Number(job.commissionAmount) || 0),
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
  const billed = jobs.reduce((sum, job) => sum + (Number(job.amount) || 0), 0);
  const commission = jobs.reduce((sum, job) => sum + (Number(job.commissionAmount) || 0), 0);
  const net = jobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
  const received = jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
  const pending = net - received;
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
  const net = jobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
  const paid = jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
  const pending = Math.max(0, net - paid);

  return {
    net,
    paid,
    pending,
    status: getPaymentStatusFromAmounts(paid, net),
  };
}
