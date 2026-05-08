import { prisma } from '../db/prisma';

interface OutstandingComputation {
  outstanding: number;
  oldestOutstandingDays: number;
  oldestOutstandingDate: string | null;
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

function toAmount(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric;
}

function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAgeingBucket(days: number): FollowUpCustomerRow['ageingBucket'] {
  if (days <= 7) {
    return 'Current';
  }
  if (days <= 30) {
    return '8-30';
  }
  if (days <= 60) {
    return '31-60';
  }
  if (days <= 90) {
    return '61-90';
  }
  return '90+';
}

function computeOutstandingAndAgeing(params: {
  openingBalance: number;
  jobs: Array<{ date: string; amount: unknown; commissionAmount: unknown; paidAmount: unknown; paymentStatus: string | null }>;
  payments: Array<{ amount: unknown }>;
  todayMs: number;
}): OutstandingComputation {
  const { openingBalance, jobs, payments, todayMs } = params;

  const totalDueFromJobs = jobs.reduce(
    (sum, job) => sum + toAmount(job.amount) + toAmount(job.commissionAmount),
    0
  );

  const totalPaidFromJobs = jobs.reduce((sum, job) => {
    const explicitPaid = toAmount(job.paidAmount);
    if (explicitPaid > 0) {
      return sum + explicitPaid;
    }
    if ((job.paymentStatus || '').toLowerCase() === 'paid') {
      return sum + toAmount(job.amount) + toAmount(job.commissionAmount);
    }
    return sum;
  }, 0);

  const totalPaidFromPayments = payments.reduce(
    (sum, payment) => sum + toAmount(payment.amount),
    0
  );

  const totalDue = Math.max(0, openingBalance) + totalDueFromJobs;
  const totalPaid = Math.max(totalPaidFromJobs, totalPaidFromPayments);
  const totalOutstanding = Math.max(0, totalDue - totalPaid);

  if (totalOutstanding <= 0) {
    return {
      outstanding: 0,
      oldestOutstandingDays: 0,
      oldestOutstandingDate: null,
    };
  }

  const receivableItems: Array<{ date: string | null; amount: number }> = [];
  if (openingBalance > 0) {
    receivableItems.push({ date: null, amount: openingBalance });
  }
  const sortedJobs = [...jobs].sort((a, b) => a.date.localeCompare(b.date));
  sortedJobs.forEach((job) => {
    receivableItems.push({
      date: job.date,
      amount: toAmount(job.amount) + toAmount(job.commissionAmount),
    });
  });

  let remainingReceived = totalPaid;
  const outstandingItems: Array<{ date: string | null; amount: number }> = [];

  receivableItems.forEach((item) => {
    const paidForItem = Math.min(item.amount, remainingReceived);
    remainingReceived = Math.max(0, remainingReceived - paidForItem);
    const pending = item.amount - paidForItem;
    if (pending > 0) {
      outstandingItems.push({ date: item.date, amount: pending });
    }
  });

  const hasOpeningOutstanding = outstandingItems.some(
    (item) => item.date === null && item.amount > 0
  );
  const oldestDatedOutstanding = outstandingItems
    .filter((item): item is { date: string; amount: number } => typeof item.date === 'string')
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  let oldestOutstandingDays = 0;
  let oldestOutstandingDate: string | null = oldestDatedOutstanding?.date ?? null;
  if (oldestDatedOutstanding) {
    const dateMs = new Date(`${oldestDatedOutstanding.date}T00:00:00`).getTime();
    oldestOutstandingDays = Math.max(0, Math.floor((todayMs - dateMs) / 86400000));
  }
  if (hasOpeningOutstanding) {
    // Opening-balance outstanding has no reliable date; treat as long-overdue for collection priority.
    oldestOutstandingDays = Math.max(oldestOutstandingDays, 120);
    if (!oldestOutstandingDate) {
      oldestOutstandingDate = null;
    }
  }

  return {
    outstanding: totalOutstanding,
    oldestOutstandingDays,
    oldestOutstandingDate,
  };
}

export async function getFollowUpOverview(): Promise<FollowUpOverview> {
  const [
    customers,
    jobs,
    payments,
    followUps,
  ] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        shortCode: true,
        type: true,
        openingBalance: true,
      },
    }),
    prisma.job.findMany({
      select: {
        customerId: true,
        date: true,
        amount: true,
        commissionAmount: true,
        paidAmount: true,
        paymentStatus: true,
      },
    }),
    prisma.payment.findMany({
      select: {
        customerId: true,
        date: true,
        amount: true,
      },
    }),
    prisma.customerFollowUp.findMany({
      select: {
        customerId: true,
        nextFollowUpDate: true,
        notes: true,
      },
    }),
  ]);

  const jobsByCustomer = new Map<number, typeof jobs>();
  jobs.forEach((job) => {
    const list = jobsByCustomer.get(job.customerId) ?? [];
    list.push(job);
    jobsByCustomer.set(job.customerId, list);
  });

  const paymentsByCustomer = new Map<number, typeof payments>();
  payments.forEach((payment) => {
    const list = paymentsByCustomer.get(payment.customerId) ?? [];
    list.push(payment);
    paymentsByCustomer.set(payment.customerId, list);
  });

  const followUpByCustomer = new Map(
    followUps.map((item) => [item.customerId, item] as const)
  );

  const today = getTodayLocalDateString();
  const todayMs = new Date(`${today}T00:00:00`).getTime();

  const rows: FollowUpCustomerRow[] = customers
    .map((customer) => {
      const customerJobs = jobsByCustomer.get(customer.id) ?? [];
      const customerPayments = paymentsByCustomer.get(customer.id) ?? [];
      const outstandingData = computeOutstandingAndAgeing({
        openingBalance: toAmount(customer.openingBalance),
        jobs: customerJobs,
        payments: customerPayments,
        todayMs,
      });

      const lastJobDate = customerJobs
        .map((job) => job.date)
        .sort((a, b) => b.localeCompare(a))[0] ?? null;
      const lastPaymentDate = customerPayments
        .map((payment) => payment.date)
        .sort((a, b) => b.localeCompare(a))[0] ?? null;

      const followUp = followUpByCustomer.get(customer.id);
      return {
        customerId: customer.id,
        customerName: customer.name,
        shortCode: customer.shortCode,
        customerType: customer.type,
        outstanding: outstandingData.outstanding,
        oldestOutstandingDays: outstandingData.oldestOutstandingDays,
        ageingBucket: getAgeingBucket(outstandingData.oldestOutstandingDays),
        nextFollowUpDate: followUp?.nextFollowUpDate ?? null,
        followUpNotes: followUp?.notes ?? null,
        lastJobDate,
        lastPaymentDate,
      };
    })
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  const bucketOrder: FollowUpCustomerRow['ageingBucket'][] = [
    'Current',
    '8-30',
    '31-60',
    '61-90',
    '90+',
  ];
  const ageingSummary = bucketOrder.map((bucket) => {
    const bucketRows = rows.filter((row) => row.ageingBucket === bucket);
    return {
      bucket,
      customerCount: bucketRows.length,
      outstandingAmount: bucketRows.reduce(
        (sum, row) => sum + row.outstanding,
        0
      ),
    };
  });

  const callList = rows
    .filter(
      (row) =>
        row.nextFollowUpDate !== null &&
        row.nextFollowUpDate <= today
    )
    .sort((a, b) => {
      const aDate = a.nextFollowUpDate ?? '9999-99-99';
      const bDate = b.nextFollowUpDate ?? '9999-99-99';
      if (aDate !== bDate) {
        return aDate.localeCompare(bDate);
      }
      return b.outstanding - a.outstanding;
    });

  return {
    asOfDate: today,
    rows,
    ageingSummary,
    callList,
  };
}

export async function upsertCustomerFollowUp(params: {
  customerId: number;
  nextFollowUpDate: string;
  notes?: string | null;
}) {
  return prisma.customerFollowUp.upsert({
    where: { customerId: params.customerId },
    create: {
      customerId: params.customerId,
      nextFollowUpDate: params.nextFollowUpDate,
      notes: params.notes?.trim() || null,
    },
    update: {
      nextFollowUpDate: params.nextFollowUpDate,
      notes: params.notes?.trim() || null,
    },
  });
}

export async function clearCustomerFollowUp(customerId: number) {
  await prisma.customerFollowUp.deleteMany({
    where: { customerId },
  });
}

