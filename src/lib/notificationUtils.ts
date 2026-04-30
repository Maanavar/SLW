import type { Customer, Expense, Job, Payment, CommissionWorker, CommissionPayment } from '@/types';
import { calculateCustomerBalance, getJobGroupKey } from './jobUtils';
import { calculateMonthlyBalances } from './reportUtils';
import { calculateWorkerCommissionSummary } from './financeUtils';

export type NotificationType = 'urgent' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  dismissible: boolean;
}

export interface NotificationInput {
  customers: Customer[];
  jobs: Job[];
  payments: Payment[];
  expenses: Expense[];
  commissionWorkers: CommissionWorker[];
  commissionPayments: CommissionPayment[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function dayOfMonth(dateStr: string): number {
  return parseInt(dateStr.split('-')[2] ?? '1', 10);
}

function yearMonth(dateStr: string): string {
  return dateStr.substring(0, 7);
}

function prevYearMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthEndDate(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${ym}-${String(lastDay).padStart(2, '0')}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function daysBetween(from: string, to: string): number {
  const parse = (s: string) => {
    const [y, mo, d] = s.split('-').map(Number);
    return new Date(y, mo - 1, d).getTime();
  };
  return Math.floor((parse(to) - parse(from)) / 86_400_000);
}

function fmt(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

// ── Rule 1: Recurring expense not filed for current month (show from day 5) ──

function checkRecurringExpenses(expenses: Expense[], today: string): AppNotification[] {
  if (dayOfMonth(today) < 5) return [];

  const currentMonth = yearMonth(today);

  const templates = new Map<string, { category: string; description: string }>();
  expenses.forEach((e) => {
    if (!e.isRecurring) return;
    const key = `${e.category}::${e.description.trim().toLowerCase()}`;
    if (!templates.has(key)) templates.set(key, { category: e.category, description: e.description.trim() });
  });

  if (templates.size === 0) return [];

  const filed = new Set<string>();
  expenses
    .filter((e) => e.isRecurring && yearMonth(e.date) === currentMonth)
    .forEach((e) => filed.add(`${e.category}::${e.description.trim().toLowerCase()}`));

  const out: AppNotification[] = [];
  templates.forEach((t, key) => {
    if (filed.has(key)) return;
    const slug = key.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    out.push({
      id: `expense_missing_${slug}_${currentMonth}`,
      type: 'warning',
      title: 'Recurring expense not filed',
      body: `${t.description} (${t.category}) not entered for ${monthLabel(currentMonth)}`,
      link: '/expenses',
      dismissible: false,
    });
  });

  return out;
}

// ── Rule 2a: Cash & Party-Credit — payment expected on the spot / same day ───
//
// These customers must settle quickly. Alert from day 2 if balance is still
// outstanding. Uses total balance (accounts for any partial payments made).

function checkImmediatePaymentOverdue(
  customers: Customer[],
  jobs: Job[],
  payments: Payment[],
  today: string
): AppNotification[] {
  const out: AppNotification[] = [];

  customers
    .filter((c) => c.isActive && (c.type === 'Cash' || c.type === 'Party-Credit'))
    .forEach((c) => {
      const balance = calculateCustomerBalance(jobs, payments, c.id);
      if (balance <= 0.5) return;

      // Find the oldest job that is 2+ days old contributing to the balance
      const oldJobs = jobs
        .filter((j) => j.customerId === c.id && daysBetween(j.date, today) >= 2)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (oldJobs.length === 0) return;

      const days = daysBetween(oldJobs[0].date, today);

      out.push({
        id: `immediate_overdue_${c.id}`,
        type: days >= 7 ? 'urgent' : 'warning',
        title: `Payment pending — ${c.type} customer`,
        body: `${c.name} owes ${fmt(balance)} — ${days} day${days > 1 ? 's' : ''} since last job`,
        link: `/records?customer=${c.id}&status=unpaid`,
        dismissible: false,
      });
    });

  return out;
}

// ── Rule 2b: Invoice — raise invoice if 15+ days since job and still unpaid ──
//
// Invoice customers settle per invoice raised. If 15 days have passed since
// their oldest job and balance is still outstanding, prompt to raise invoice.

function checkInvoiceOverdue(
  customers: Customer[],
  jobs: Job[],
  payments: Payment[],
  today: string
): AppNotification[] {
  const out: AppNotification[] = [];

  customers
    .filter((c) => c.isActive && c.type === 'Invoice')
    .forEach((c) => {
      const balance = calculateCustomerBalance(jobs, payments, c.id);
      if (balance <= 0.5) return;

      // Find oldest job that is 15+ days old
      const oldJobs = jobs
        .filter((j) => j.customerId === c.id && daysBetween(j.date, today) >= 15)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (oldJobs.length === 0) return;

      const days = daysBetween(oldJobs[0].date, today);

      out.push({
        id: `invoice_overdue_${c.id}`,
        type: days >= 30 ? 'urgent' : 'warning',
        title: 'Raise invoice',
        body: `${c.name} — ${fmt(balance)} unpaid for ${days} days. Raise invoice to collect.`,
        link: `/records?customer=${c.id}&status=unpaid`,
        dismissible: false,
      });
    });

  return out;
}

// ── Rule 2c: Monthly — past month unpaid (15-day grace after month end) ───────
//
// Monthly customers pay at month end. Only flag past months, with a 15-day
// grace to give time for payment after month closes.

function checkMonthlyOverdue(
  customers: Customer[],
  jobs: Job[],
  payments: Payment[],
  today: string
): AppNotification[] {
  const currentMonth = yearMonth(today);
  const out: AppNotification[] = [];

  customers
    .filter((c) => c.isActive && c.type === 'Monthly')
    .forEach((c) => {
      const monthlyBalances = calculateMonthlyBalances(c.id, jobs, payments);

      const overdueMonths = monthlyBalances.filter(
        (m) => m.monthKey < currentMonth && m.balance > 0.5
      );

      if (overdueMonths.length === 0) return;

      const totalOverdue = overdueMonths.reduce((sum, m) => sum + m.balance, 0);
      const oldest = overdueMonths[overdueMonths.length - 1]; // sorted desc, last = oldest
      const daysSinceMonthEnd = daysBetween(monthEndDate(oldest.monthKey), today);

      if (daysSinceMonthEnd < 15) return;

      out.push({
        id: `balance_overdue_${c.id}`,
        type: daysSinceMonthEnd >= 45 ? 'urgent' : 'warning',
        title: 'Overdue balance',
        body: `${c.name} owes ${fmt(totalOverdue)} — unpaid since ${monthLabel(oldest.monthKey)}`,
        link: '/customers',
        dismissible: false,
      });
    });

  return out;
}

// ── Rule 3: Commission — alert 2 days after customer payment received ─────────
//
// Commission is payable to the worker once you have received money from the
// customer. If a customer payment was received 2+ days ago and the worker's
// commission is still unsettled, alert. Only considers payments within the
// last 60 days to avoid surfacing stale payments.

function checkPendingCommissions(
  jobs: Job[],
  commissionWorkers: CommissionWorker[],
  commissionPayments: CommissionPayment[],
  payments: Payment[],
  today: string
): AppNotification[] {
  const workerSummaries = calculateWorkerCommissionSummary(jobs, commissionPayments, commissionWorkers);
  const out: AppNotification[] = [];

  workerSummaries
    .filter((w) => w.outstanding > 0.5)
    .forEach((w) => {
      // Find the most recent payment from this worker's customer (within 60 days)
      const customerPayments = payments
        .filter(
          (p) =>
            p.customerId === w.customerId &&
            daysBetween(p.date, today) <= 60 &&
            daysBetween(p.date, today) >= 0
        )
        .sort((a, b) => b.date.localeCompare(a.date));

      if (customerPayments.length === 0) return;

      const latestPayment = customerPayments[0];
      const daysSincePayment = daysBetween(latestPayment.date, today);

      // Only alert after 2 days since receiving payment
      if (daysSincePayment < 2) return;

      out.push({
        id: `commission_pending_${w.workerId}`,
        type: 'warning',
        title: 'Commission not settled',
        body: `${fmt(w.outstanding)} pending for ${w.workerName} — payment received ${daysSincePayment} days ago`,
        link: '/commission',
        dismissible: false,
      });
    });

  return out;
}

// ── Rule 4: DC details missing for job cards (shows after 24-hour grace) ──────
//
// For customers with requiresDc=true, every job card must have a DC number.
// We give a 24-hour grace period from job creation before alerting, so the
// driver/customer has time to bring the DC. One notification per job card.
// Uses createdAt timestamp for precision; falls back to job date if absent.

function checkMissingDc(
  customers: Customer[],
  jobs: Job[],
): AppNotification[] {
  const dcCustomerIds = new Set(
    customers.filter((c) => c.isActive && c.requiresDc).map((c) => c.id)
  );

  if (dcCustomerIds.size === 0) return [];

  const now = Date.now();
  const MS_24H = 24 * 60 * 60 * 1000;

  // Group jobs by card key
  const cardMap = new Map<string, Job[]>();
  jobs.forEach((j) => {
    if (!dcCustomerIds.has(j.customerId)) return;
    const key = getJobGroupKey(j);
    if (!cardMap.has(key)) cardMap.set(key, []);
    cardMap.get(key)!.push(j);
  });

  const out: AppNotification[] = [];

  cardMap.forEach((cardJobs, groupKey) => {
    // DC is considered entered if any job line in the card has dcNo
    const hasDc = cardJobs.some((j) => j.dcNo && j.dcNo.trim() !== '');
    if (hasDc) return;

    // Use the primary job (lowest jobCardLine) to check createdAt
    const primary = [...cardJobs].sort(
      (a, b) => (a.jobCardLine ?? 0) - (b.jobCardLine ?? 0)
    )[0];

    const customer = customers.find((c) => c.id === primary.customerId);
    if (!customer) return;

    // Determine elapsed time since creation
    let elapsedMs: number;
    if (primary.createdAt) {
      elapsedMs = now - new Date(primary.createdAt).getTime();
    } else {
      // Fall back: treat as created at midnight of the job date
      const [y, mo, d] = primary.date.split('-').map(Number);
      elapsedMs = now - new Date(y, mo - 1, d).getTime();
    }

    if (elapsedMs < MS_24H) return;

    const hoursAgo = Math.floor(elapsedMs / (1000 * 60 * 60));

    const displayCardId = primary.jobCardId || `LEGACY-${primary.id}`;
    const safeGroupKey = groupKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const isWaived = cardJobs.some((j) => j.dcApproval === true);

    out.push({
      id: `dc_missing_${safeGroupKey}`,
      type: hoursAgo >= 48 ? 'urgent' : 'warning',
      title: isWaived ? 'DC number pending (waived)' : 'DC number missing',
      body: isWaived
        ? `${customer.name} — Job card ${displayCardId} DC waived but number still expected (${hoursAgo}h ago)`
        : `${customer.name} — Job card ${displayCardId} has no DC number (${hoursAgo}h ago)`,
      link: `/records?card=${encodeURIComponent(groupKey)}`,
      dismissible: false,
    });
  });

  return out;
}

// ── Rule 5: Monthly close reminder — days 1–5 of new month ───────────────────

function checkMonthlyClose(
  customers: Customer[],
  jobs: Job[],
  payments: Payment[],
  today: string
): AppNotification[] {
  const dom = dayOfMonth(today);
  if (dom < 1 || dom > 5) return [];

  const last = prevYearMonth(today);
  const relevant = new Set<Customer['type']>(['Monthly', 'Party-Credit', 'Invoice']);

  const unpaid = customers.filter((c) => {
    if (!c.isActive || !relevant.has(c.type)) return false;
    const monthlyBalances = calculateMonthlyBalances(c.id, jobs, payments);
    return monthlyBalances.some((m) => m.monthKey === last && m.balance > 0.5);
  });

  if (unpaid.length === 0) return [];

  return [
    {
      id: `monthly_close_${last}`,
      type: 'info',
      title: 'Monthly review',
      body: `${unpaid.length} customer${unpaid.length > 1 ? 's have' : ' has'} unpaid balance from ${monthLabel(last)}`,
      link: '/dashboard',
      dismissible: true,
    },
  ];
}

// ── Public API ────────────────────────────────────────────────────────────────

export function computeNotifications(
  data: NotificationInput,
  today: string
): AppNotification[] {
  const { customers, jobs, payments, expenses, commissionWorkers, commissionPayments } = data;
  return [
    ...checkRecurringExpenses(expenses, today),
    ...checkMissingDc(customers, jobs),
    ...checkImmediatePaymentOverdue(customers, jobs, payments, today),
    ...checkInvoiceOverdue(customers, jobs, payments, today),
    ...checkMonthlyOverdue(customers, jobs, payments, today),
    ...checkPendingCommissions(jobs, commissionWorkers, commissionPayments, payments, today),
    ...checkMonthlyClose(customers, jobs, payments, today),
  ];
}
