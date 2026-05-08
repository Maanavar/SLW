import type {
  CustomerType,
  ExpenseCategory,
  InvoiceGroup,
  JobFlowType,
  PaymentMode,
  PaymentStatus,
  RmpHandler,
  ShareType,
  WorkMode,
} from '@/constants/domain';

export type {
  CustomerType,
  ExpenseCategory,
  InvoiceGroup,
  JobFlowType,
  PaymentMode,
  PaymentStatus,
  RmpHandler,
  ShareType,
  WorkMode,
};

export interface Customer {
  id: number;
  name: string;
  shortCode: string;
  type: CustomerType;
  hasCommission: boolean;
  requiresDc: boolean;
  hasBillNo?: boolean;
  advanceBalance?: number;
  openingBalance?: number;
  notes: string;
  isActive: boolean;
  /** Explicit invoice billing group. Overrides shortCode-based detection when set. */
  invoiceGroup?: InvoiceGroup | null;
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
  paymentStatus?: PaymentStatus;
  paymentMode?: string;
  paidAmount?: number;
  workMode?: WorkMode;
  isSpotWork?: boolean;
  jobCardId?: string;
  jobCardLine?: number;
  billNo?: string;
  notes?: string;
  // DC Fields
  dcNo?: string;
  vehicleNo?: string;
  dcDate?: string;
  dcApproval?: boolean;
  // RMP handler tag (Bhai = people vehicles, Raja = commercial vehicles)
  rmpHandler?: RmpHandler | null;
  // Job ownership and commission direction:
  // - slw_work: SLW did the work, worker commission is payable (expense)
  // - agent_work: external agent job routed via SLW, agent commission is receivable (income)
  jobFlowType?: JobFlowType;
  externalDc?: boolean;
  agentName?: string;
  agentCommissionAmount?: number;
  agentTdsAmount?: number;
  agentSettlementPaidAmount?: number;
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
  paymentMode: PaymentMode;
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
  category: ExpenseCategory;
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
  shareType: ShareType;
  shareValue: number; // if percentage: 0-100, if fixed: fixed rupee amount
  isActive: boolean;
  isAgent?: boolean; // true = external agent (commission is income), false/undefined = worker (commission is expense)
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
  paymentType?: 'worker' | 'agent';
  agentName?: string;
}

export interface AuthUser {
  id: number | null;
  name: string;
  role: 'admin';
}

export interface FollowUpCustomerRow {
  customerId: number;
  customerName: string;
  shortCode: string;
  customerType: string;
  outstanding: number;
  oldestOutstandingDays: number;
  ageingBucket: 'Current' | '8-30' | '31-60' | '61-90' | '90+';
  nextFollowUpDate: string | null;
  followUpNotes: string | null;
  lastJobDate: string | null;
  lastPaymentDate: string | null;
}

export interface FollowUpOverview {
  asOfDate: string;
  rows: FollowUpCustomerRow[];
  ageingSummary: Array<{
    bucket: FollowUpCustomerRow['ageingBucket'];
    customerCount: number;
    outstandingAmount: number;
  }>;
  callList: FollowUpCustomerRow[];
}

export interface MonthLockRecord {
  monthKey: string;
  notes: string | null;
  lockedByUserId: number | null;
  lockedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthLockOverrideStatus {
  active: boolean;
  until: string | null;
  reason: string | null;
  setByName: string | null;
  remainingMinutes: number;
}

export interface MonthLockStateResponse {
  locks: MonthLockRecord[];
  override: MonthLockOverrideStatus;
}

export interface BackupListItem {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  mode: 'manual' | 'scheduled';
  triggeredBy: string | null;
}
