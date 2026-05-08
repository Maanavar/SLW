import { describe, expect, it } from 'vitest';
import type { Customer, Payment } from '@/types';
import {
  formatPaymentBreakdown,
  generateMeaningfulPaymentId,
  getPaymentDisplayId,
} from './paymentUtils';

const customer: Customer = {
  id: 1,
  name: 'Ramani Motors',
  shortCode: 'RMP',
  type: 'Monthly',
  hasCommission: false,
  requiresDc: false,
  notes: '',
  isActive: true,
};

function createPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 42,
    customerId: customer.id,
    amount: 1000,
    date: '2026-05-05',
    paymentMode: 'Cash',
    ...overrides,
  };
}

describe('paymentUtils', () => {
  it('generates meaningful payment IDs', () => {
    const id = generateMeaningfulPaymentId(customer, '2026-05-05', 7);
    expect(id).toBe('PAY-RMP-20260505-007');
  });

  it('prefers explicit reference numbers for display ID', () => {
    const payment = createPayment({ referenceNumber: 'PAY-RMP-20260505-001' });
    expect(getPaymentDisplayId(payment, customer)).toBe('PAY-RMP-20260505-001');
  });

  it('formats mixed payment breakdown values', () => {
    const payment = createPayment({
      paymentMode: 'Mixed',
      breakdown: {
        cash: 250,
        upi: 750,
      },
    });

    expect(formatPaymentBreakdown(payment)).toBe('Cash: INR 250.00 + UPI: INR 750.00');
  });
});
