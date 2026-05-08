import { describe, expect, it } from 'vitest';
import type { Customer, Job } from '@/types';
import {
  calculateCustomerBalance,
  getJobFinalBillValue,
  getJobNetValue,
  getPaymentStatusFromAmounts,
  isDcApplicableCustomer,
} from './jobUtils';

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

describe('jobUtils', () => {
  it('calculates final bill as amount plus commission', () => {
    const job = createJob({ amount: 500, commissionAmount: 50 });
    expect(getJobFinalBillValue(job)).toBe(550);
  });

  it('derives payment status from paid and due amounts', () => {
    expect(getPaymentStatusFromAmounts(0, 100)).toBe('Pending');
    expect(getPaymentStatusFromAmounts(40, 100)).toBe('Partially Paid');
    expect(getPaymentStatusFromAmounts(100, 100)).toBe('Paid');
    expect(getPaymentStatusFromAmounts(120, 100)).toBe('Paid');
  });

  it('computes SLW and agent net values correctly', () => {
    const slwJob = createJob({ amount: 800, jobFlowType: 'slw_work' });
    const agentJob = createJob({
      id: 2,
      amount: 1000,
      jobFlowType: 'agent_work',
      agentCommissionAmount: 180,
      agentTdsAmount: 20,
    });

    expect(getJobNetValue(slwJob)).toBe(800);
    expect(getJobNetValue(agentJob)).toBe(200);
  });

  it('prevents double-counting when both job-paid and payment vouchers exist', () => {
    const jobs: Job[] = [
      createJob({ id: 1, customerId: 1, amount: 1000, commissionAmount: 100, paidAmount: 900 }),
    ];

    const payments = [{ customerId: 1, amount: 900 }];

    expect(calculateCustomerBalance(jobs, payments, 1, 0)).toBe(200);
  });

  it('identifies DC-applicable customers from flag or name heuristic', () => {
    const customerByFlag: Customer = {
      id: 1,
      name: 'Any Customer',
      shortCode: 'ANY',
      type: 'Monthly',
      hasCommission: false,
      requiresDc: true,
      notes: '',
      isActive: true,
    };

    const customerByName: Customer = {
      ...customerByFlag,
      id: 2,
      requiresDc: false,
      name: 'Mahalingam Traders',
      shortCode: 'MHL',
    };

    expect(isDcApplicableCustomer(customerByFlag)).toBe(true);
    expect(isDcApplicableCustomer(customerByName)).toBe(true);
  });
});
