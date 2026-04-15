/**
 * Payment Utility Functions
 * Utilities for generating meaningful payment IDs and formatting payment data
 */

import type { Payment, Customer } from '@/types';

/**
 * Generate a meaningful payment ID based on customer, date and sequence
 * Format: PAY-{CUSTOMER_CODE}-{YYYYMMDD}-{SEQUENCE}
 * Example: PAY-RMP-20250415-001
 */
export function generateMeaningfulPaymentId(
  customer: Customer,
  date: string,
  paymentSequence: number
): string {
  const code = (customer.shortCode || customer.name.substring(0, 3)).toUpperCase();
  const dateStr = date.replace(/-/g, '');
  const seq = String(paymentSequence).padStart(3, '0');
  return `PAY-${code}-${dateStr}-${seq}`;
}

/**
 * Get display ID for payment
 * If payment has a meaningful reference structure, use it; otherwise generate from ID
 */
export function getPaymentDisplayId(payment: Payment, customer?: Customer): string {
  // If we have a reference number, use that
  if (payment.referenceNumber) {
    return payment.referenceNumber;
  }

  // Generate from customer and date if available
  if (customer) {
    const dateStr = payment.date.replace(/-/g, '');
    const code = (customer.shortCode || customer.name.substring(0, 3)).toUpperCase();
    const seq = Math.abs(payment.id % 1000)
      .toString()
      .padStart(3, '0');
    return `PAY-${code}-${dateStr}-${seq}`;
  }

  // Fallback to formatted ID
  return `PAY-${payment.id}`;
}

/**
 * Format payment breakdown for display
 */
export function formatPaymentBreakdown(payment: Payment): string {
  if (!payment.breakdown || Object.keys(payment.breakdown).length === 0) {
    return payment.paymentMode;
  }

  const parts: string[] = [];
  if (payment.breakdown.cash) parts.push(`Cash: ₹${payment.breakdown.cash.toFixed(2)}`);
  if (payment.breakdown.upi) parts.push(`UPI: ₹${payment.breakdown.upi.toFixed(2)}`);
  if (payment.breakdown.bank) parts.push(`Bank: ₹${payment.breakdown.bank.toFixed(2)}`);
  if (payment.breakdown.cheque) parts.push(`Cheque: ₹${payment.breakdown.cheque.toFixed(2)}`);

  return parts.join(' + ');
}
