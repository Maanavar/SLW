import type { Job, Payment } from '@/types';
import { getJobPaidAmount, groupJobsByCard } from './jobUtils';

export interface JobPaidResidualEvent {
  customerId: number;
  date: string;
  amount: number;
  paymentMode: Payment['paymentMode'];
  notes: string;
  jobCardId: string;
}

export function getCardIdFromPaymentNotes(notes?: string) {
  return notes?.match(/From JobCard\s+([A-Za-z0-9-]+)/i)?.[1];
}

export function buildJobPaidResidualEvents(
  jobs: Job[],
  payments: Array<Pick<Payment, 'customerId' | 'amount' | 'notes'>>,
  options: {
    customersWithVouchersFrom?: Array<Pick<Payment, 'customerId'>>;
  } = {}
): JobPaidResidualEvent[] {
  const voucherSource = options.customersWithVouchersFrom ?? payments;
  const customersWithVouchers = new Set(voucherSource.map((payment) => payment.customerId));
  const linkedVoucherTotals = new Map<string, number>();
  const voucherTotalsByCustomer = new Map<number, number>();

  payments.forEach((payment) => {
    voucherTotalsByCustomer.set(
      payment.customerId,
      (voucherTotalsByCustomer.get(payment.customerId) || 0) + (Number(payment.amount) || 0)
    );

    const cardId = getCardIdFromPaymentNotes(payment.notes);
    if (!cardId) return;
    linkedVoucherTotals.set(
      cardId,
      (linkedVoucherTotals.get(cardId) || 0) + (Number(payment.amount) || 0)
    );
  });

  const groups = groupJobsByCard(jobs.filter((job) => getJobPaidAmount(job) > 0));
  const jobPaidTotalsByCustomer = new Map<number, number>();

  groups.forEach((group) => {
    const paidFromJobs = group.jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
    jobPaidTotalsByCustomer.set(
      group.primary.customerId,
      (jobPaidTotalsByCustomer.get(group.primary.customerId) || 0) + paidFromJobs
    );
  });

  const residualRemainingByCustomer = new Map<number, number>();
  jobPaidTotalsByCustomer.forEach((paidFromJobs, customerId) => {
    if (!customersWithVouchers.has(customerId)) {
      residualRemainingByCustomer.set(customerId, paidFromJobs);
      return;
    }
    residualRemainingByCustomer.set(
      customerId,
      Math.max(0, paidFromJobs - (voucherTotalsByCustomer.get(customerId) || 0))
    );
  });

  return groups
    .map((group) => {
      const cardId = group.primary.jobCardId || `LEGACY-${group.primary.id}`;
      const paidFromJobs = group.jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
      const linkedVoucherTotal = linkedVoucherTotals.get(cardId) || 0;
      const cardResidual = customersWithVouchers.has(group.primary.customerId)
        ? Math.max(0, paidFromJobs - linkedVoucherTotal)
        : paidFromJobs;
      const remaining = residualRemainingByCustomer.get(group.primary.customerId) || 0;
      const amount = Math.min(cardResidual, remaining);
      residualRemainingByCustomer.set(group.primary.customerId, Math.max(0, remaining - amount));

      return {
        customerId: group.primary.customerId,
        date: group.primary.date,
        amount,
        paymentMode: (group.primary.paymentMode as Payment['paymentMode']) || 'Cash',
        notes: `From JobCard ${cardId}`,
        jobCardId: cardId,
      };
    })
    .filter((event) => event.amount > 0);
}
