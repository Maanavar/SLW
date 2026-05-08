import { describe, expect, it } from 'vitest';
import type { Job, Payment } from '@/types';
import { calculateMonthlyBalances, getPaymentEventsInRange } from './reportUtils';

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

describe('reportUtils', () => {
  it('combines payment vouchers and job-paid entries while de-duping linked cards', () => {
    const jobs: Job[] = [
      createJob({ id: 1, customerId: 1, date: '2026-05-05', jobCardId: 'JC-1', paidAmount: 300 }),
      createJob({ id: 2, customerId: 1, date: '2026-05-06', jobCardId: 'JC-2', paidAmount: 200 }),
    ];

    const payments: Payment[] = [
      createPayment({
        id: 10,
        customerId: 1,
        date: '2026-05-05',
        amount: 300,
        notes: 'From JobCard JC-1',
      }),
      createPayment({
        id: 11,
        customerId: 1,
        date: '2026-05-07',
        amount: 150,
      }),
    ];

    const events = getPaymentEventsInRange(jobs, payments, '2026-05-01', '2026-05-31');

    expect(events.map((e) => e.id)).toContain('payment:10');
    expect(events.map((e) => e.id)).toContain('payment:11');
    expect(events.map((e) => e.id)).toContain('job:JC-2');
    expect(events.map((e) => e.id)).not.toContain('job:JC-1');
  });

  it('calculates monthly balances using max(job-paid, payment-paid) and payment period fields', () => {
    const jobs: Job[] = [
      createJob({
        id: 1,
        customerId: 1,
        date: '2026-05-10',
        amount: 1000,
        commissionAmount: 100,
        paidAmount: 400,
      }),
      createJob({
        id: 2,
        customerId: 1,
        date: '2026-06-10',
        amount: 500,
        commissionAmount: 50,
        paidAmount: 0,
      }),
      createJob({
        id: 3,
        customerId: 2,
        date: '2026-05-12',
        amount: 900,
        commissionAmount: 90,
      }),
    ];

    const payments: Payment[] = [
      createPayment({ id: 1, customerId: 1, amount: 300, paymentForMonth: '2026-05' }),
      createPayment({ id: 2, customerId: 1, amount: 600, paymentForDate: '2026-06-15' }),
      createPayment({ id: 3, customerId: 1, amount: 700, paymentForFromDate: '2026-07-01' }),
      createPayment({ id: 4, customerId: 1, amount: 200, date: '2026-04-05' }),
      createPayment({ id: 5, customerId: 2, amount: 999, paymentForMonth: '2026-05' }),
    ];

    const balances = calculateMonthlyBalances(1, jobs, payments);

    expect(balances.map((m) => m.monthKey)).toEqual(['2026-07', '2026-06', '2026-05', '2026-04']);

    const may = balances.find((m) => m.monthKey === '2026-05');
    const jun = balances.find((m) => m.monthKey === '2026-06');
    const jul = balances.find((m) => m.monthKey === '2026-07');
    const apr = balances.find((m) => m.monthKey === '2026-04');

    expect(may).toMatchObject({
      totalNet: 1100,
      paidFromJobs: 400,
      paidFromPayments: 300,
      balance: 700,
    });
    expect(jun).toMatchObject({
      totalNet: 550,
      paidFromJobs: 0,
      paidFromPayments: 600,
      balance: 0,
    });
    expect(jul).toMatchObject({
      totalNet: 0,
      paidFromJobs: 0,
      paidFromPayments: 700,
      balance: 0,
    });
    expect(apr).toMatchObject({
      totalNet: 0,
      paidFromJobs: 0,
      paidFromPayments: 200,
      balance: 0,
    });
  });
});
