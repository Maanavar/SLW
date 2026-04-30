import type { Customer, Job, Payment } from '@/types';
import { calculateCustomerFinancials } from '@/lib/financeUtils';
import { isAgentWorkJob } from '@/lib/jobUtils';

export interface CustomerRank {
  customerId: number;
  customerName: string;
  rank: number;
  totalRevenue: number;
  grossProfit: number;
  slwNetProfit: number;
  totalOutstanding: number;
  jobCardCount: number;
  collectionRate: number;
  avgJobValue: number;
  lastJobDate: string | null;
  daysSinceLastJob: number;
  healthScore: number;
  healthLabel: 'Excellent' | 'Good' | 'Attention' | 'Risk';
}

function getDaysSince(date: string | null): number {
  if (!date) {
    return 9999;
  }
  const today = new Date();
  const then = new Date(`${date}T00:00:00`);
  return Math.max(0, Math.floor((today.getTime() - then.getTime()) / 86400000));
}

function toHealthLabel(score: number): CustomerRank['healthLabel'] {
  if (score >= 80) {
    return 'Excellent';
  }
  if (score >= 60) {
    return 'Good';
  }
  if (score >= 40) {
    return 'Attention';
  }
  return 'Risk';
}

export function rankCustomers(
  jobs: Job[],
  payments: Payment[],
  customers: Customer[]
): CustomerRank[] {
  const activeCustomers = customers.filter((customer) => customer.isActive !== false);
  const customerFinancials = calculateCustomerFinancials(jobs, payments, activeCustomers);

  // Per-customer SLW direct net profit (excludes agent work — ranking is based on our own work)
  const slwNetProfitByCustomer = new Map<number, number>();
  jobs.forEach((job) => {
    if (isAgentWorkJob(job)) return;
    slwNetProfitByCustomer.set(
      job.customerId,
      (slwNetProfitByCustomer.get(job.customerId) ?? 0) + (Number(job.amount) || 0)
    );
  });
  const totalSlwNetProfitAll = Array.from(slwNetProfitByCustomer.values()).reduce((s, v) => s + v, 0);

  const firstJobDateByCustomer = new Map<number, string>();
  const lastJobDateByCustomer = new Map<number, string>();
  const cardKeysByCustomer = new Map<number, Set<string>>();

  jobs.forEach((job) => {
    const key = job.customerId;
    const cardKey = job.jobCardId ? `card:${job.jobCardId}` : `legacy:${job.id}`;

    if (!cardKeysByCustomer.has(key)) {
      cardKeysByCustomer.set(key, new Set<string>());
    }
    cardKeysByCustomer.get(key)!.add(cardKey);

    const existingFirst = firstJobDateByCustomer.get(key);
    if (!existingFirst || job.date < existingFirst) {
      firstJobDateByCustomer.set(key, job.date);
    }

    const existingLast = lastJobDateByCustomer.get(key);
    if (!existingLast || job.date > existingLast) {
      lastJobDateByCustomer.set(key, job.date);
    }
  });

  const ranked = customerFinancials
    .map<CustomerRank>((row) => {
      const firstJobDate = firstJobDateByCustomer.get(row.customerId);
      const lastJobDate = lastJobDateByCustomer.get(row.customerId) || null;
      const daysSinceLastJob = getDaysSince(lastJobDate);
      const jobCardCount = cardKeysByCustomer.get(row.customerId)?.size || 0;
      const avgJobValue = jobCardCount > 0 ? row.totalRevenue / jobCardCount : 0;

      const monthsActive = firstJobDate
        ? Math.max(
            1,
            (new Date().getFullYear() - new Date(firstJobDate).getFullYear()) * 12 +
              (new Date().getMonth() - new Date(firstJobDate).getMonth()) +
              1
          )
        : 1;
      const jobsPerMonth = jobCardCount / monthsActive;

      const slwNetProfit = slwNetProfitByCustomer.get(row.customerId) ?? 0;
      const collectionPts = Math.max(0, Math.min(40, (row.paymentRate / 100) * 40));
      const frequencyPts = Math.max(0, Math.min(30, (jobsPerMonth / 3) * 30));
      const profitShare = totalSlwNetProfitAll > 0 ? slwNetProfit / totalSlwNetProfitAll : 0;
      const contributionPts = Math.max(0, Math.min(20, profitShare * 20));

      let recencyPts = 0;
      if (daysSinceLastJob <= 30) {
        recencyPts = 10;
      } else if (daysSinceLastJob <= 60) {
        recencyPts = 5;
      } else if (daysSinceLastJob <= 90) {
        recencyPts = 2;
      }

      const healthScore = Math.round(collectionPts + frequencyPts + contributionPts + recencyPts);

      return {
        customerId: row.customerId,
        customerName: row.customerName,
        rank: 0,
        totalRevenue: row.totalRevenue,
        grossProfit: row.grossProfit,
        slwNetProfit,
        totalOutstanding: row.totalOutstanding,
        jobCardCount,
        collectionRate: row.paymentRate,
        avgJobValue,
        lastJobDate,
        daysSinceLastJob,
        healthScore,
        healthLabel: toHealthLabel(healthScore),
      };
    })
    .sort((a, b) => b.slwNetProfit - a.slwNetProfit)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return ranked;
}
