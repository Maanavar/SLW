/**
 * TypeScript Type Definitions for Siva Lathe Works
 */

export interface Customer {
  id: number;
  name: string;
  shortCode: string;
  type: 'Monthly' | 'Invoice' | 'Party-Credit' | 'Cash';
  hasCommission: boolean;
  requiresDc: boolean;
  advanceBalance?: number;
  notes: string;
  isActive: boolean;
}

export interface WorkType {
  id: number;
  category: string;
  name: string;
  shortCode: string;
  defaultUnit: string;
  defaultRate: number;
  isActive?: boolean;
}

export interface Job {
  id: number;
  customerId: number;
  workTypeName: string;
  workName?: string;
  quantity: number;
  amount: number;
  commissionAmount: number;
  netAmount?: number;
  date: string;
  paymentStatus?: 'Paid' | 'Pending' | 'Partially Paid';
  paymentMode?: string;
  paidAmount?: number;
  workMode?: 'Workshop' | 'Spot';
  isSpotWork?: boolean;
  jobCardId?: string;
  jobCardLine?: number;
  notes?: string;
  // DC Fields
  dcNo?: string;
  vehicleNo?: string;
  dcDate?: string;
  dcApproval?: boolean;
  // RMP handler tag (Bhai = people vehicles, Raja = commercial vehicles)
  rmpHandler?: 'Bhai' | 'Raja' | null;
  // Commission Worker Tagging
  commissionWorkerId?: number;
  commissionWorkerName?: string;
  createdAt?: string;
}

export interface PaymentBreakdown {
  cash?: number;
  upi?: number;
  bank?: number;
  cheque?: number;
}

export interface Payment {
  id: number;
  customerId: number;
  amount: number;
  date: string;
  paymentMode: 'Cash' | 'UPI' | 'Bank' | 'Cheque' | 'Mixed';
  breakdown?: PaymentBreakdown;
  referenceNumber?: string;
  paymentForMonth?: string;
  paymentForDate?: string;
  paymentForFromDate?: string;
  notes?: string;
  createdAt?: string;
}

export interface Expense {
  id: number;
  category: 'EB' | 'Rent' | 'Salary' | 'Material' | 'Fuel' | 'Union' | 'Other';
  description: string;
  amount: number;
  date: string;
  isRecurring: boolean;
  recurringDay?: number; // Day of month (1-28) when recurring expense happens. E.g. 5 = 5th of each month
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: number;
  actorUserId?: number | null;
  actorName?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  message?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  createdAt: string;
}

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface Modal {
  isOpen: boolean;
  type: 'customer' | 'worktype' | 'category' | null;
  id?: number;
}

export interface MonthlyBalance {
  monthKey: string;
  monthLabel: string;
  totalNet: number;
  paidFromJobs: number;
  paidFromPayments: number;
  balance: number;
  jobs: Job[];
}

export interface JobGroup {
  key: string;
  jobs: Job[];
  primary: Job;
  totalAmount: number;
  totalNet: number;
  totalCommission: number;
  totalQuantity: number;
  lineCount: number;
}

export interface JobSummary {
  jobs: number;
  billed: number;
  commission: number;
  net: number;
  received: number;
  pending: number;
}

export interface PeriodRange {
  from: string;
  to: string;
}

export interface CommissionWorker {
  id: number;
  customerId: number;
  name: string;
  shareType: 'percentage' | 'fixed';
  shareValue: number; // if percentage: 0-100, if fixed: fixed rupee amount
  isActive: boolean;
  createdAt?: string;
}

export interface CommissionPayment {
  id: number;
  workerId: number;
  workerName: string;
  customerId: number;
  jobIds: number[];
  amount: number;
  date: string;
  notes?: string;
  createdAt?: string;
}

export interface AuthUser {
  id: number | null;
  name: string;
  role: 'admin';
}
