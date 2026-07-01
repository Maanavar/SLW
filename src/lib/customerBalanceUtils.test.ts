import { describe, expect, it } from 'vitest';
import type { Customer, Job, Payment } from '@/types';
import {
  calculateCustomerBalanceAmounts,
  calculateVoucherAwareJobOutstanding,
  getPaymentAccountingRange,
} from './customerBalanceUtils';

function createCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    name: 'WP Customer',
    shortCode: 'WP',
    type: 'Monthly',
    hasCommission: false,
    requiresDc: false,
    notes: '',
    isActive: true,
    ...overrides,
  };
}

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
    date: '2026-06-19',
    paymentMode: 'Cash',
    ...overrides,
  };
}

describe('customerBalanceUtils', () => {
  it('uses the full paymentForMonth as the accounting range', () => {
    expect(getPaymentAccountingRange(createPayment({ paymentForMonth: '2026-05' }))).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    });
  });

  it('carries a later-entered May payment before June balance calculation', () => {
    const customers = [createCustomer()];
    const jobs = [
      createJob({ id: 1, date: '2026-05-02', amount: 10000, paidAmount: 10000 }),
      createJob({ id: 2, date: '2026-06-10', amount: 8000, paidAmount: 0 }),
    ];
    const payments = [
      createPayment({
        id: 10,
        date: '2026-06-19',
        amount: 10000,
        paymentForMonth: '2026-05',
      }),
    ];

    const rows = calculateCustomerBalanceAmounts(customers, jobs, payments, {
      from: '2026-06-01',
      to: '2026-06-18',
    });
    const wp = rows.get(1);

    expect(wp?.openingBalanceAmt).toBe(0);
    expect(wp?.finalBill).toBe(8000);
    expect(wp?.paidAmount).toBe(0);
    expect(wp?.balance).toBe(8000);
  });

  it('matches job-card unpaid total when vouchers are lower than paid job cards', () => {
    const customers = [createCustomer()];
    const jobs = [
      createJob({ id: 1, date: '2026-05-02', amount: 24250, paidAmount: 24250 }),
      createJob({ id: 2, date: '2026-06-18', amount: 9550, paidAmount: 0 }),
      createJob({ id: 3, date: '2026-06-19', amount: 150, paidAmount: 0 }),
    ];
    const payments = [
      createPayment({
        id: 10,
        date: '2026-06-02',
        amount: 14250,
        paymentForMonth: '2026-05',
      }),
    ];

    const rows = calculateCustomerBalanceAmounts(customers, jobs, payments, {
      from: '2026-06-19',
      to: '2026-06-19',
    });
    const wp = rows.get(1);

    expect(wp?.openingBalanceAmt).toBe(9550);
    expect(wp?.finalBill).toBe(150);
    expect(wp?.balance).toBe(9700);
  });

  it('uses monthly payment vouchers to hide settled month jobs from unpaid job list', () => {
    const jobs = [
      createJob({ id: 1, date: '2026-05-02', amount: 10000, paidAmount: 0 }),
      createJob({ id: 2, date: '2026-05-18', amount: 4250, paidAmount: 0 }),
      createJob({ id: 3, date: '2026-06-19', amount: 9700, paidAmount: 0 }),
    ];
    const payments = [
      createPayment({
        id: 10,
        date: '2026-06-02',
        amount: 14250,
        paymentForMonth: '2026-05',
      }),
    ];

    const outstanding = calculateVoucherAwareJobOutstanding(jobs, payments, 1).filter(
      (row) => row.dueAmount > 0.009
    );

    expect(outstanding).toHaveLength(1);
    expect(outstanding[0].job.id).toBe(3);
    expect(outstanding[0].dueAmount).toBe(9700);
  });

  it('does not double-count monthly vouchers when job rows already show paid', () => {
    const jobs = [
      createJob({ id: 1, date: '2026-05-02', amount: 10000, paidAmount: 10000 }),
      createJob({ id: 2, date: '2026-05-18', amount: 4250, paidAmount: 4250 }),
      createJob({ id: 3, date: '2026-06-19', amount: 9700, paidAmount: 0 }),
    ];
    const payments = [
      createPayment({
        id: 10,
        date: '2026-06-02',
        amount: 14250,
        paymentForMonth: '2026-05',
      }),
    ];

    const outstanding = calculateVoucherAwareJobOutstanding(jobs, payments, 1).filter(
      (row) => row.dueAmount > 0.009
    );

    expect(outstanding).toHaveLength(1);
    expect(outstanding[0].job.id).toBe(3);
    expect(outstanding[0].dueAmount).toBe(9700);
  });

  it('counts partially linked settlement vouchers plus residual job-paid amount once', () => {
    const customers = [createCustomer()];
    const jobs = [
      createJob({
        id: 1,
        date: '2026-05-02',
        jobCardId: 'JC-1',
        amount: 10000,
        paidAmount: 10000,
      }),
    ];
    const payments = [
      createPayment({
        id: 10,
        amount: 7000,
        paymentForMonth: '2026-05',
        notes: 'From JobCard JC-1',
      }),
    ];

    const rows = calculateCustomerBalanceAmounts(customers, jobs, payments, {
      from: '2026-05-01',
      to: '2026-05-31',
    });

    expect(rows.get(1)?.paidAmount).toBe(10000);
    expect(rows.get(1)?.balance).toBe(0);
  });
});
