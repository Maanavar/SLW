/**
 * Report Utility Functions
 * Ported from src/js/utils.js
 */

import type { Job, Payment, Customer, JobGroup, PeriodRange } from '@/types';
import { getReportRange as getDateReportRange, isDateInRange, formatDate as formatDateUtil } from './dateUtils';
import { getJobNetValue, groupJobsByCard, getJobPaidAmount } from './jobUtils';

// Re-export for convenience
export function getReportRange(period: string): PeriodRange {
  return getDateReportRange(period);
}

export { groupJobsByCard };

/**
 * Filter jobs within date range
 */
export function getJobsInRange(
  jobs: Job[],
  startDate?: string,
  endDate?: string
): Job[] {
  return jobs.filter((job) => isDateInRange(job.date, startDate, endDate));
}

/**
 * Filter payments within date range
 */
export function getPaymentsInRange(
  payments: Payment[],
  startDate?: string,
  endDate?: string
): Payment[] {
  return payments.filter((payment) => isDateInRange(payment.date, startDate, endDate));
}

/**
 * Get report period range
 */
export function getReportPeriodRange(period: string): PeriodRange {
  return getDateReportRange(period);
}

/**
 * Calculate monthly balances for a customer
 */
export interface MonthBalance {
  monthKey: string;
  monthLabel: string;
  totalNet: number;
  paidFromJobs: number;
  paidFromPayments: number;
  balance: number;
  jobs: Job[];
}

export function calculateMonthlyBalances(
  customerId: number,
  jobs: Job[],
  payments: Payment[]
): MonthBalance[] {
  const customerJobs = jobs.filter((j) => j.customerId === customerId);
  const customerPayments = payments.filter((p) => p.customerId === customerId);

  const monthMap: Record<string, MonthBalance> = {};

  // Group jobs by month
  customerJobs.forEach((job) => {
    const monthKey = job.date.substring(0, 7); // YYYY-MM
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        monthKey,
        monthLabel: formatDateUtil(monthKey + '-01').substring(0, 7), // Just month-year
        totalNet: 0,
        paidFromJobs: 0,
        paidFromPayments: 0,
        balance: 0,
        jobs: [],
      };
    }
    monthMap[monthKey].totalNet += getJobNetValue(job);
    monthMap[monthKey].paidFromJobs += getJobPaidAmount(job);
    monthMap[monthKey].jobs.push(job);
  });

  // Add payments to their respective months
  customerPayments.forEach((payment) => {
    let targetMonth = '';
    if (payment.paymentForMonth) {
      targetMonth = payment.paymentForMonth;
    } else if (payment.paymentForDate) {
      targetMonth = payment.paymentForDate.substring(0, 7);
    } else if (payment.paymentForFromDate) {
      targetMonth = payment.paymentForFromDate.substring(0, 7);
    } else if (payment.date) {
      targetMonth = payment.date.substring(0, 7);
    }

    if (targetMonth && monthMap[targetMonth]) {
      monthMap[targetMonth].paidFromPayments += payment.amount;
    }
  });

  // Calculate balance for each month
  Object.values(monthMap).forEach((month) => {
    month.balance = month.totalNet - month.paidFromJobs - month.paidFromPayments;
  });

  // Sort descending by month
  return Object.values(monthMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

/**
 * Get filtered report groups based on period, mode, and customer
 */
export interface FilteredReport {
  groups: JobGroup[];
  fromDate: string;
  toDate: string;
  period: string;
  reportMode: string;
  reportCustomer?: Customer;
}

export function getFilteredReportGroups(
  period: string,
  reportMode: string,
  reportCustomerId: string,
  jobs: Job[],
  _payments: Payment[],
  customers: Customer[]
): FilteredReport {
  const reportCustomer = reportCustomerId
    ? customers.find((c) => c.id === parseInt(reportCustomerId, 10))
    : undefined;

  const range = getDateReportRange(period);
  let filteredJobs = getJobsInRange(jobs, range.from, range.to);

  if (reportCustomer) {
    filteredJobs = filteredJobs.filter((j) => j.customerId === reportCustomer.id);
  }

  const groups = groupJobsByCard(filteredJobs);

  return {
    groups,
    fromDate: range.from,
    toDate: range.to,
    period,
    reportMode,
    reportCustomer,
  };
}
