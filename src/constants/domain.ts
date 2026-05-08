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

export const JOB_FLOW_TYPES = ['slw_work', 'agent_work'] as const;
export const RMP_HANDLERS = ['Bhai', 'Raja'] as const;
export const INVOICE_GROUPS = ['rmp', 'ww', 'nm'] as const;
export const SHARE_TYPES = ['percentage', 'fixed'] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type WorkMode = (typeof WORK_MODES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type JobFlowType = (typeof JOB_FLOW_TYPES)[number];
export type RmpHandler = (typeof RMP_HANDLERS)[number];
export type InvoiceGroup = (typeof INVOICE_GROUPS)[number];
export type ShareType = (typeof SHARE_TYPES)[number];
