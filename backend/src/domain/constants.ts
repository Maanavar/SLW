export const CUSTOMER_TYPES = ['Monthly', 'Invoice', 'Party-Credit', 'Cash'] as const;
export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank', 'Cheque', 'Mixed'] as const;
export const PAYMENT_STATUSES = ['Paid', 'Pending', 'Partially Paid'] as const;
export const WORK_MODES = ['Workshop', 'Spot'] as const;
export const EXPENSE_CATEGORIES = [
  'EB',
  'Rent',
  'Salary',
  'Material',
  'Fuel',
  'Union',
  'Other',
] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type WorkMode = (typeof WORK_MODES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const LOG_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'BULK_DELETE',
  'PURGE',
  'SYSTEM',
] as const;

export const LOG_ENTITIES = [
  'CUSTOMER',
  'WORK_TYPE',
  'JOB',
  'PAYMENT',
  'EXPENSE',
  'COMMISSION_WORKER',
  'COMMISSION_PAYMENT',
  'SYSTEM',
] as const;

export type LogAction = (typeof LOG_ACTIONS)[number];
export type LogEntity = (typeof LOG_ENTITIES)[number];
