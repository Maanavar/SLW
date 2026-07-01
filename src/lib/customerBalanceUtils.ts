import type { Customer, Job, Payment, PeriodRange } from '@/types';
import { getJobFinalBillValue, getJobNetValue, getJobPaidAmount, getJobWorkerCommissionExpense } from './jobUtils';

export interface CustomerBalanceAmounts {
  customerId: number;
  ourIncome: number;
  commission: number;
  finalBill: number;
  paidAmount: number;
  openingBalanceAmt: number;
  advance: number;
  balance: number;
}

export interface JobOutstandingAmount {
  job: Job;
  paidAmount: number;
  dueAmount: number;
}

function getMonthEndDate(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthKey}-${String(lastDay).padStart(2, '0')}`;
}

export function getPaymentAccountingRange(
  payment: Pick<Payment, 'date' | 'paymentForMonth' | 'paymentForDate' | 'paymentForFromDate'>
): PeriodRange {
  if (payment.paymentForMonth) {
    return {
      from: `${payment.paymentForMonth}-01`,
      to: getMonthEndDate(payment.paymentForMonth),
    };
  }

  const from = payment.paymentForFromDate || payment.paymentForDate || payment.date;
  const to = payment.paymentForDate || payment.paymentForFromDate || payment.date;
  return from <= to ? { from, to } : { from: to, to: from };
}

function getPaymentJobAllocationRange(
  payment: Pick<Payment, 'date' | 'paymentForMonth' | 'paymentForDate' | 'paymentForFromDate'>
): PeriodRange {
  if (payment.paymentForMonth || payment.paymentForDate || payment.paymentForFromDate) {
    return getPaymentAccountingRange(payment);
  }
  return { from: '0001-01-01', to: payment.date };
}

function rangesOverlap(left: PeriodRange, right: PeriodRange): boolean {
  return left.from <= right.to && left.to >= right.from;
}

export function getAccountingPaymentsInRange(payments: Payment[], range?: PeriodRange): Payment[] {
  if (!range) return payments;
  return payments.filter((payment) => rangesOverlap(getPaymentAccountingRange(payment), range));
}

export function getAccountingPaymentsBefore(payments: Payment[], beforeDate: string): Payment[] {
  return payments.filter((payment) => getPaymentAccountingRange(payment).to < beforeDate);
}

export function buildAccountingCollectionTotals(
  jobsForResidual: Job[],
  paymentsInScope: Payment[],
  _allPaymentsForVoucherSource: Payment[]
): Map<number, number> {
  const voucherTotals = new Map<number, number>();
  const jobPaidTotals = new Map<number, number>();

  paymentsInScope.forEach((payment) => {
    voucherTotals.set(
      payment.customerId,
      (voucherTotals.get(payment.customerId) || 0) + (Number(payment.amount) || 0)
    );
  });

  jobsForResidual.forEach((job) => {
    jobPaidTotals.set(
      job.customerId,
      (jobPaidTotals.get(job.customerId) || 0) + getJobPaidAmount(job)
    );
  });

  const totals = new Map<number, number>();
  new Set([...voucherTotals.keys(), ...jobPaidTotals.keys()]).forEach((customerId) => {
    totals.set(customerId, Math.max(voucherTotals.get(customerId) || 0, jobPaidTotals.get(customerId) || 0));
  });

  return totals;
}

export function calculateVoucherAwareJobOutstanding(
  jobs: Job[],
  payments: Payment[],
  customerId?: number
): JobOutstandingAmount[] {
  const scopedJobs = customerId
    ? jobs.filter((job) => job.customerId === customerId)
    : jobs;
  const scopedPayments = customerId
    ? payments.filter((payment) => payment.customerId === customerId)
    : payments;
  const paidByJobId = new Map<number, number>();

  scopedJobs.forEach((job) => {
    paidByJobId.set(job.id, Math.min(getJobFinalBillForAllocation(job), getJobPaidAmount(job)));
  });

  const groups = new Map<
    string,
    { customerId: number; range: PeriodRange; amount: number }
  >();

  scopedPayments.forEach((payment) => {
    const range = getPaymentJobAllocationRange(payment);
    const key = `${payment.customerId}|${range.from}|${range.to}`;
    const existing = groups.get(key);
    if (existing) {
      existing.amount += Number(payment.amount) || 0;
    } else {
      groups.set(key, {
        customerId: payment.customerId,
        range,
        amount: Number(payment.amount) || 0,
      });
    }
  });

  groups.forEach((group) => {
    const candidateJobs = scopedJobs
      .filter(
        (job) =>
          job.customerId === group.customerId &&
          job.date >= group.range.from &&
          job.date <= group.range.to
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

    const jobPaidTotal = candidateJobs.reduce(
      (sum, job) => sum + Math.min(getJobFinalBillForAllocation(job), getJobPaidAmount(job)),
      0
    );
    const billTotal = candidateJobs.reduce((sum, job) => sum + getJobFinalBillForAllocation(job), 0);
    const targetPaidTotal = Math.min(billTotal, Math.max(jobPaidTotal, group.amount));
    let additionalPaid = Math.max(0, targetPaidTotal - jobPaidTotal);

    for (const job of candidateJobs) {
      if (additionalPaid <= 0) break;
      const bill = getJobFinalBillForAllocation(job);
      const currentPaid = paidByJobId.get(job.id) || 0;
      const due = Math.max(0, bill - currentPaid);
      if (due <= 0) continue;
      const allocated = Math.min(due, additionalPaid);
      paidByJobId.set(job.id, currentPaid + allocated);
      additionalPaid -= allocated;
    }
  });

  return scopedJobs.map((job) => {
    const finalBill = getJobFinalBillForAllocation(job);
    const paidAmount = Math.min(finalBill, paidByJobId.get(job.id) || 0);
    return {
      job,
      paidAmount,
      dueAmount: Math.max(0, finalBill - paidAmount),
    };
  });
}

function getJobFinalBillForAllocation(job: Job): number {
  return getJobFinalBillValue(job);
}

export function calculateCustomerBalanceAmounts(
  customers: Customer[],
  jobs: Job[],
  payments: Payment[],
  dateRange?: PeriodRange
): Map<number, CustomerBalanceAmounts> {
  const scopedJobs = dateRange
    ? jobs.filter((job) => job.date >= dateRange.from && job.date <= dateRange.to)
    : jobs;
  const scopedPayments = getAccountingPaymentsInRange(payments, dateRange);
  const scopedCollections = buildAccountingCollectionTotals(scopedJobs, scopedPayments, payments);

  const carriedOpening = new Map<number, number>();
  customers.forEach((customer) => {
    carriedOpening.set(customer.id, Number(customer.openingBalance) || 0);
  });

  if (dateRange) {
    const priorJobs = jobs.filter((job) => job.date < dateRange.from);
    priorJobs.forEach((job) => {
      const current = carriedOpening.get(job.customerId) || 0;
      carriedOpening.set(
        job.customerId,
        current + getJobNetValue(job) + getJobWorkerCommissionExpense(job)
      );
    });

    const priorPayments = getAccountingPaymentsBefore(payments, dateRange.from);
    buildAccountingCollectionTotals(priorJobs, priorPayments, payments).forEach((amount, customerId) => {
      carriedOpening.set(customerId, (carriedOpening.get(customerId) || 0) - amount);
    });

    customers.forEach((customer) => {
      carriedOpening.set(customer.id, Math.max(0, carriedOpening.get(customer.id) || 0));
    });
  }

  const rows = new Map<number, CustomerBalanceAmounts>();
  customers.forEach((customer) => {
    const customerJobs = scopedJobs.filter((job) => job.customerId === customer.id);
    const ourIncome = customerJobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
    const commission = customerJobs.reduce((sum, job) => sum + getJobWorkerCommissionExpense(job), 0);
    const finalBill = ourIncome + commission;
    const paidAmount = scopedCollections.get(customer.id) || 0;
    const openingBalanceAmt = carriedOpening.get(customer.id) || 0;
    const advance = Number(customer.advanceBalance) || 0;
    const balance = Math.max(0, openingBalanceAmt + finalBill - paidAmount - advance);

    rows.set(customer.id, {
      customerId: customer.id,
      ourIncome,
      commission,
      finalBill,
      paidAmount,
      openingBalanceAmt,
      advance,
      balance,
    });
  });

  return rows;
}
