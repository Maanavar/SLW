import { describe, expect, it } from 'vitest';
import type { CommissionPayment, CommissionWorker, Expense, Job, Payment } from '@/types';
import {
  calculateCommissionMetrics,
  calculatePaymentMetrics,
  calculateRevenueMetrics,
  calculateWorkerCommissionSummary,
} from './financeUtils';

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 1,
    customerId: 1,
    workTypeName: 'Turning',
    quantity: 1,
    amount: 0,
    commissionAmount: 0,
    date: '2026-05-01',
    ...overrides,
  };
}

function createExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    category: 'Other',
    description: 'General expense',
    amount: 0,
    date: '2026-05-01',
    isRecurring: false,
    ...overrides,
  };
}

function createPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    customerId: 1,
    amount: 0,
    date: '2026-05-01',
    paymentMode: 'Cash',
    ...overrides,
  };
}

describe('financeUtils', () => {
  it('calculates revenue metrics for mixed job flow correctly', () => {
    const jobs: Job[] = [
      createJob({ id: 1, amount: 1000, commissionAmount: 100, jobFlowType: 'slw_work' }),
      createJob({
        id: 2,
        customerId: 2,
        amount: 800,
        commissionAmount: 0,
        jobFlowType: 'agent_work',
        agentCommissionAmount: 200,
        agentTdsAmount: 50,
      }),
    ];

    const expenses: Expense[] = [createExpense({ amount: 300 })];
    const metrics = calculateRevenueMetrics(jobs, expenses);

    expect(metrics.totalRevenue).toBe(1900);
    expect(metrics.commissionExpense).toBe(100);
    expect(metrics.grossProfit).toBe(1200);
    expect(metrics.totalExpenses).toBe(300);
    expect(metrics.netProfit).toBe(900);
    expect(metrics.jobCount).toBe(2);
  });

  it('calculates payment metrics from voucher collections', () => {
    const jobs: Job[] = [createJob({ amount: 1000, commissionAmount: 100 })];
    const payments: Payment[] = [
      createPayment({ id: 1, amount: 400, date: '2026-05-02', paymentMode: 'UPI' }),
    ];

    const metrics = calculatePaymentMetrics(jobs, payments);
    expect(metrics.totalReceived).toBe(400);
    expect(metrics.totalOutstanding).toBe(700);
    expect(metrics.collectionRate).toBeCloseTo(36.36, 2);
    expect(metrics.averagePaymentDays).toBe(0);
  });

  it('calculates commission due/paid/outstanding values', () => {
    const jobs: Job[] = [
      createJob({ id: 1, amount: 1000, commissionAmount: 120, commissionWorkerId: 10 }),
      createJob({
        id: 2,
        amount: 600,
        commissionAmount: 70,
        jobFlowType: 'agent_work',
      }),
    ];
    const commissionPayments: CommissionPayment[] = [
      {
        id: 1,
        workerId: 10,
        workerName: 'Ravi',
        customerId: 1,
        jobIds: [1],
        amount: 80,
        date: '2026-05-03',
        paymentType: 'worker',
      },
    ];

    const metrics = calculateCommissionMetrics(jobs, commissionPayments);
    expect(metrics.commissionDue).toBe(120);
    expect(metrics.commissionPaid).toBe(80);
    expect(metrics.commissionOutstanding).toBe(40);
  });

  it('summarizes worker commissions from jobs and payments', () => {
    const jobs: Job[] = [
      createJob({ id: 1, commissionAmount: 100, commissionWorkerId: 10, customerId: 1 }),
      createJob({ id: 2, commissionAmount: 50, commissionWorkerId: 11, customerId: 2 }),
    ];

    const workers: CommissionWorker[] = [
      { id: 10, customerId: 1, name: 'Ravi', shareType: 'fixed', shareValue: 100, isActive: true },
      { id: 11, customerId: 2, name: 'Mani', shareType: 'fixed', shareValue: 50, isActive: true },
    ];

    const payments: CommissionPayment[] = [
      {
        id: 1,
        workerId: 10,
        workerName: 'Ravi',
        customerId: 1,
        jobIds: [1],
        amount: 60,
        date: '2026-05-04',
        paymentType: 'worker',
      },
    ];

    const summary = calculateWorkerCommissionSummary(jobs, payments, workers);
    const ravi = summary.find((item) => item.workerId === 10);
    const mani = summary.find((item) => item.workerId === 11);

    expect(ravi).toMatchObject({ totalDue: 100, totalPaid: 60, outstanding: 40 });
    expect(mani).toMatchObject({ totalDue: 50, totalPaid: 0, outstanding: 50 });
  });
});
