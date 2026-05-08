import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { HttpError } from '../middleware/httpError';

const BACKUP_FILE_PREFIX = 'slw-backup-';
const BACKUP_FILE_SUFFIX = '.json';
const BACKUP_SCHEMA_VERSION = 1;

export interface BackupListItem {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  mode: 'manual' | 'scheduled';
  triggeredBy: string | null;
}

interface BackupPayload {
  meta: {
    schemaVersion: number;
    createdAt: string;
    mode: 'manual' | 'scheduled';
    triggeredBy: string | null;
  };
  data: {
    customers: unknown[];
    workTypes: unknown[];
    jobs: unknown[];
    payments: unknown[];
    expenses: unknown[];
    commissionWorkers: unknown[];
    commissionPayments: unknown[];
    activityLogs: unknown[];
    monthLocks: unknown[];
    customerFollowUps: unknown[];
    systemSettings: unknown[];
  };
}

export function getBackupDirectoryPath(): string {
  return path.resolve(process.cwd(), env.backupDirectory);
}

async function ensureBackupDirectory() {
  const dir = getBackupDirectoryPath();
  await mkdir(dir, { recursive: true });
  return dir;
}

function buildBackupFileName(mode: 'manual' | 'scheduled', createdAt: string): string {
  const stamp = createdAt
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .replace('T', 'T');
  return `${BACKUP_FILE_PREFIX}${stamp}-${mode}${BACKUP_FILE_SUFFIX}`;
}

function extractCreatedAtFromFileName(fileName: string): string | null {
  if (!fileName.startsWith(BACKUP_FILE_PREFIX) || !fileName.endsWith(BACKUP_FILE_SUFFIX)) {
    return null;
  }
  const tail = fileName
    .slice(BACKUP_FILE_PREFIX.length, -BACKUP_FILE_SUFFIX.length)
    .split('-')[0];
  const match = /^(\d{8})T(\d{6})Z$/.exec(tail);
  if (!match) {
    return null;
  }
  const y = match[1].slice(0, 4);
  const m = match[1].slice(4, 6);
  const d = match[1].slice(6, 8);
  const hh = match[2].slice(0, 2);
  const mm = match[2].slice(2, 4);
  const ss = match[2].slice(4, 6);
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
}

function extractModeFromFileName(fileName: string): 'manual' | 'scheduled' {
  return fileName.includes('-scheduled') ? 'scheduled' : 'manual';
}

export async function listBackups(): Promise<BackupListItem[]> {
  const dir = await ensureBackupDirectory();
  const fileNames = await readdir(dir);

  const items = await Promise.all(
    fileNames
      .filter(
        (fileName) =>
          fileName.startsWith(BACKUP_FILE_PREFIX) &&
          fileName.endsWith(BACKUP_FILE_SUFFIX)
      )
      .map(async (fileName) => {
        const fullPath = path.join(dir, fileName);
        const fileStat = await stat(fullPath);
        let triggeredBy: string | null = null;

        // best-effort metadata parse for UI; fall back to null when parse fails.
        try {
          const text = await readFile(fullPath, 'utf8');
          const payload = JSON.parse(text) as BackupPayload;
          const fromMeta = payload?.meta?.triggeredBy;
          if (typeof fromMeta === 'string') {
            triggeredBy = fromMeta;
          }
        } catch {
          triggeredBy = null;
        }

        return {
          fileName,
          sizeBytes: fileStat.size,
          createdAt:
            extractCreatedAtFromFileName(fileName) ??
            fileStat.mtime.toISOString(),
          mode: extractModeFromFileName(fileName),
          triggeredBy,
        } as BackupListItem;
      })
  );

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function pruneExpiredBackups() {
  if (env.backupRetentionDays <= 0) {
    return;
  }

  const thresholdMs = Date.now() - env.backupRetentionDays * 24 * 60 * 60 * 1000;
  const dir = await ensureBackupDirectory();
  const files = await readdir(dir);

  await Promise.all(
    files
      .filter(
        (fileName) =>
          fileName.startsWith(BACKUP_FILE_PREFIX) &&
          fileName.endsWith(BACKUP_FILE_SUFFIX)
      )
      .map(async (fileName) => {
        const fullPath = path.join(dir, fileName);
        try {
          const fileStat = await stat(fullPath);
          if (fileStat.mtime.getTime() < thresholdMs) {
            await rm(fullPath, { force: true });
          }
        } catch {
          // ignore stale race conditions
        }
      })
  );
}

export async function createBackup(options: {
  mode: 'manual' | 'scheduled';
  triggeredBy?: string | null;
}): Promise<BackupListItem> {
  const createdAt = new Date().toISOString();
  const dir = await ensureBackupDirectory();
  const fileName = buildBackupFileName(options.mode, createdAt);
  const fullPath = path.join(dir, fileName);

  const [
    customers,
    workTypes,
    jobs,
    payments,
    expenses,
    commissionWorkers,
    commissionPayments,
    activityLogs,
    monthLocks,
    customerFollowUps,
    systemSettings,
  ] = await Promise.all([
    prisma.customer.findMany({ orderBy: { id: 'asc' } }),
    prisma.workType.findMany({ orderBy: { id: 'asc' } }),
    prisma.job.findMany({ orderBy: { id: 'asc' } }),
    prisma.payment.findMany({ orderBy: { id: 'asc' } }),
    prisma.expense.findMany({ orderBy: { id: 'asc' } }),
    prisma.commissionWorker.findMany({ orderBy: { id: 'asc' } }),
    prisma.commissionPayment.findMany({ orderBy: { id: 'asc' } }),
    prisma.activityLog.findMany({ orderBy: { id: 'asc' } }),
    prisma.monthLock.findMany({ orderBy: { monthKey: 'asc' } }),
    prisma.customerFollowUp.findMany({ orderBy: { customerId: 'asc' } }),
    prisma.systemSetting.findMany({ orderBy: { key: 'asc' } }),
  ]);

  const payload: BackupPayload = {
    meta: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt,
      mode: options.mode,
      triggeredBy: options.triggeredBy ?? null,
    },
    data: {
      customers,
      workTypes,
      jobs,
      payments,
      expenses,
      commissionWorkers,
      commissionPayments,
      activityLogs,
      monthLocks,
      customerFollowUps,
      systemSettings,
    },
  };

  await writeFile(fullPath, JSON.stringify(payload, null, 2), 'utf8');
  await pruneExpiredBackups();

  const fileStat = await stat(fullPath);
  return {
    fileName,
    sizeBytes: fileStat.size,
    createdAt,
    mode: options.mode,
    triggeredBy: options.triggeredBy ?? null,
  };
}

function ensureSafeBackupFileName(fileNameRaw: string): string {
  const fileName = path.basename(fileNameRaw.trim());
  if (
    !fileName.startsWith(BACKUP_FILE_PREFIX) ||
    !fileName.endsWith(BACKUP_FILE_SUFFIX)
  ) {
    throw new HttpError(400, 'Invalid backup file name.');
  }
  return fileName;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function resetSequences() {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"customers"', 'id'), COALESCE((SELECT MAX(id) FROM "customers"), 1), true);`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"work_types"', 'id'), COALESCE((SELECT MAX(id) FROM "work_types"), 1), true);`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"jobs"', 'id'), COALESCE((SELECT MAX(id) FROM "jobs"), 1), true);`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"payments"', 'id'), COALESCE((SELECT MAX(id) FROM "payments"), 1), true);`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"expenses"', 'id'), COALESCE((SELECT MAX(id) FROM "expenses"), 1), true);`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"commission_workers"', 'id'), COALESCE((SELECT MAX(id) FROM "commission_workers"), 1), true);`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"commission_payments"', 'id'), COALESCE((SELECT MAX(id) FROM "commission_payments"), 1), true);`
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"activity_logs"', 'id'), COALESCE((SELECT MAX(id) FROM "activity_logs"), 1), true);`
  );
}

export async function restoreBackup(fileNameRaw: string) {
  const fileName = ensureSafeBackupFileName(fileNameRaw);
  const dir = await ensureBackupDirectory();
  const fullPath = path.join(dir, fileName);

  let payload: BackupPayload;
  try {
    const text = await readFile(fullPath, 'utf8');
    payload = JSON.parse(text) as BackupPayload;
  } catch {
    throw new HttpError(400, 'Unable to read backup file.');
  }

  const data = payload?.data;
  if (!data || typeof data !== 'object') {
    throw new HttpError(400, 'Backup file format is invalid.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.job.deleteMany({});
    await tx.expense.deleteMany({});
    await tx.commissionPayment.deleteMany({});
    await tx.commissionWorker.deleteMany({});
    await tx.customerFollowUp.deleteMany({});
    await tx.customer.deleteMany({});
    await tx.workType.deleteMany({});
    await tx.monthLock.deleteMany({});
    await tx.systemSetting.deleteMany({});

    const customers = asArray(data.customers);
    if (customers.length > 0) {
      await tx.customer.createMany({ data: customers as never[] });
    }
    const workTypes = asArray(data.workTypes);
    if (workTypes.length > 0) {
      await tx.workType.createMany({ data: workTypes as never[] });
    }
    const jobs = asArray(data.jobs);
    if (jobs.length > 0) {
      await tx.job.createMany({ data: jobs as never[] });
    }
    const payments = asArray(data.payments);
    if (payments.length > 0) {
      await tx.payment.createMany({ data: payments as never[] });
    }
    const expenses = asArray(data.expenses);
    if (expenses.length > 0) {
      await tx.expense.createMany({ data: expenses as never[] });
    }
    const commissionWorkers = asArray(data.commissionWorkers);
    if (commissionWorkers.length > 0) {
      await tx.commissionWorker.createMany({ data: commissionWorkers as never[] });
    }
    const commissionPayments = asArray(data.commissionPayments);
    if (commissionPayments.length > 0) {
      await tx.commissionPayment.createMany({ data: commissionPayments as never[] });
    }
    const activityLogs = asArray(data.activityLogs);
    if (activityLogs.length > 0) {
      await tx.activityLog.createMany({ data: activityLogs as never[] });
    }
    const monthLocks = asArray(data.monthLocks);
    if (monthLocks.length > 0) {
      await tx.monthLock.createMany({ data: monthLocks as never[] });
    }
    const customerFollowUps = asArray(data.customerFollowUps);
    if (customerFollowUps.length > 0) {
      await tx.customerFollowUp.createMany({ data: customerFollowUps as never[] });
    }
    const systemSettings = asArray(data.systemSettings);
    if (systemSettings.length > 0) {
      await tx.systemSetting.createMany({ data: systemSettings as never[] });
    }
  });

  await resetSequences();
}

let backupScheduler: NodeJS.Timeout | null = null;

export function startBackupScheduler() {
  if (backupScheduler || env.backupScheduleHours <= 0) {
    return;
  }

  const intervalMs = env.backupScheduleHours * 60 * 60 * 1000;
  backupScheduler = setInterval(() => {
    void createBackup({
      mode: 'scheduled',
      triggeredBy: 'backup-scheduler',
    }).catch((error) => {
      console.error('Scheduled backup failed:', error);
    });
  }, intervalMs);
}

export function stopBackupScheduler() {
  if (!backupScheduler) {
    return;
  }
  clearInterval(backupScheduler);
  backupScheduler = null;
}

