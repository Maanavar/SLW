import { describe, expect, it } from 'vitest';
import type { Job, Payment } from '@/types';
import { calculateMonthlyBalances, getPaymentEffectivePeriodKey, getPaymentEventsInRange } from './reportUtils';

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

describe('getPaymentEffectivePeriodKey', () => {
  it('uses paymentForMonth when set, regardless of physical date', () => {
    const p = createPayment({ date: '2026-06-01', paymentForMonth: '2026-05' });
    expect(getPaymentEffectivePeriodKey(p)).toBe('2026-05');
  });

  it('extracts month from paymentForDate when no paymentForMonth', () => {
    const p = createPayment({ date: '2026-06-01', paymentForDate: '2026-05-31' });
    expect(getPaymentEffectivePeriodKey(p)).toBe('2026-05');
  });

  it('extracts month from paymentForFromDate when no other scope', () => {
    const p = createPayment({ date: '2026-06-01', paymentForFromDate: '2026-05-16' });
    expect(getPaymentEffectivePeriodKey(p)).toBe('2026-05');
  });

  it('falls back to physical date month when no scope fields set', () => {
    const p = createPayment({ date: '2026-06-01' });
    expect(getPaymentEffectivePeriodKey(p)).toBe('2026-06');
  });

  it('paymentForMonth takes priority over paymentForDate', () => {
    const p = createPayment({ date: '2026-06-01', paymentForMonth: '2026-04', paymentForDate: '2026-05-15' });
    expect(getPaymentEffectivePeriodKey(p)).toBe('2026-04');
  });
});

// Simulate the invoice screen's periodPayments / oldBalance logic
// so we can assert cross-month payment attribution without mounting React.
function invoicePeriodPayments(
  payments: Payment[],
  periodMonthKey: string
): Payment[] {
  return payments.filter((p) => getPaymentEffectivePeriodKey(p) === periodMonthKey);
}

function invoicePaidBefore(payments: Payment[], periodMonthKey: string): number {
  return payments
    .filter((p) => getPaymentEffectivePeriodKey(p) < periodMonthKey)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

describe('invoice payment attribution (monthly customers)', () => {
  it('payment recorded on June 1 FOR May is excluded from June periodPayments', () => {
    const payments = [
      createPayment({ id: 1, date: '2026-06-01', amount: 12500, paymentForMonth: '2026-05' }),
    ];
    const junePeriod = invoicePeriodPayments(payments, '2026-06');
    expect(junePeriod).toHaveLength(0);
  });

  it('payment recorded on June 1 FOR May reduces May old balance (paidBefore)', () => {
    const payments = [
      createPayment({ id: 1, date: '2026-06-01', amount: 12500, paymentForMonth: '2026-05' }),
    ];
    const paidBefore = invoicePaidBefore(payments, '2026-06');
    expect(paidBefore).toBe(12500);
  });

  it('payment with no scope in June is included in June periodPayments', () => {
    const payments = [
      createPayment({ id: 1, date: '2026-06-10', amount: 5000 }),
    ];
    const junePeriod = invoicePeriodPayments(payments, '2026-06');
    expect(junePeriod).toHaveLength(1);
    expect(junePeriod[0].amount).toBe(5000);
  });

  it('WP scenario: June invoice balance is just June work when May payment is scoped correctly', () => {
    const mayWork = 12500;
    const juneWork = 15000;
    const payments = [
      // Customer paid May's bill on June 1, correctly scoped
      createPayment({ id: 1, date: '2026-06-01', amount: mayWork, paymentForMonth: '2026-05' }),
    ];

    const paidBefore = invoicePaidBefore(payments, '2026-06');
    const oldBalance = mayWork - paidBefore; // openingBalance=0, billedBefore=mayWork
    const periodPaymentsTotal = invoicePeriodPayments(payments, '2026-06')
      .reduce((s, p) => s + p.amount, 0);

    // hidePreviousBalance=true for WP, so grossTotal = juneWork only
    const balanceDue = juneWork - periodPaymentsTotal;
    expect(oldBalance).toBe(0);
    expect(balanceDue).toBe(15000);
  });

  it('unscoped June 1 payment is counted as June payment (user discipline required)', () => {
    const juneWork = 15000;
    const payments = [
      // No scope set — falls back to physical date month = June
      createPayment({ id: 1, date: '2026-06-01', amount: 12500 }),
    ];
    const periodPaymentsTotal = invoicePeriodPayments(payments, '2026-06')
      .reduce((s, p) => s + p.amount, 0);
    const balanceDue = juneWork - periodPaymentsTotal;
    // Unscoped: deducts from June, leaving 2500 — this is the known behaviour
    expect(balanceDue).toBe(2500);
  });
});

describe('reportUtils', () => {
  it('keeps only residual job-paid entries beyond customer vouchers', () => {
    const jobs: Job[] = [
      createJob({ id: 1, customerId: 1, date: '2026-05-05', jobCardId: 'JC-1', paidAmount: 300 }),
      createJob({ id: 2, customerId: 1, date: '2026-05-06', jobCardId: 'JC-2', paidAmount: 200 }),
      createJob({ id: 3, customerId: 2, date: '2026-05-06', jobCardId: 'JC-3', paidAmount: 400 }),
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

    // Vouchers always included
    expect(events.map((e) => e.id)).toContain('payment:10');
    expect(events.map((e) => e.id)).toContain('payment:11');
    // Customer 1 has vouchers totaling 450 and job-card paid totaling 500.
    // Keep only the 50 residual so payment + job-paid events do not double-count.
    expect(events.map((e) => e.id)).not.toContain('job:JC-1');
    expect(events.find((event) => event.id === 'job:JC-2')?.amount).toBe(50);
    // Customer 2 has no vouchers — job-paid entry included as fallback
    expect(events.map((e) => e.id)).toContain('job:JC-3');
    expect(events.reduce((sum, event) => sum + event.amount, 0)).toBe(900);
  });

  it('keeps residual job-paid amount when a settlement voucher links to the same card', () => {
    const jobs: Job[] = [
      createJob({
        id: 1,
        customerId: 1,
        date: '2026-05-05',
        jobCardId: 'JC-1',
        amount: 1000,
        paidAmount: 1000,
      }),
    ];
    const payments: Payment[] = [
      createPayment({
        id: 20,
        customerId: 1,
        date: '2026-05-06',
        amount: 700,
        notes: 'From JobCard JC-1',
      }),
    ];

    const events = getPaymentEventsInRange(jobs, payments, '2026-05-01', '2026-05-31');

    expect(events.find((event) => event.id === 'payment:20')?.amount).toBe(700);
    expect(events.find((event) => event.id === 'job:JC-1')?.amount).toBe(300);
    expect(events.reduce((sum, event) => sum + event.amount, 0)).toBe(1000);
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
