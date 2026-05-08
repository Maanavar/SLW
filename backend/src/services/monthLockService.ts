import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { getAuthUser } from '../middleware/auth';
import { HttpError } from '../middleware/httpError';
import { isLocalDateString } from '../utils/date';

const OVERRIDE_SETTING_KEY = 'monthLockOverride';
const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

interface MonthLockOverridePayload {
  until: string;
  reason?: string;
  setByUserId?: number | null;
  setByName?: string;
}

export function normalizeMonthKey(monthKeyRaw: string): string {
  const monthKey = monthKeyRaw.trim();
  if (!MONTH_KEY_REGEX.test(monthKey)) {
    throw new HttpError(400, 'Month key must be in YYYY-MM format.');
  }
  return monthKey;
}

export function monthKeyFromDate(localDate: string): string {
  if (!isLocalDateString(localDate)) {
    throw new HttpError(400, `Invalid local date: ${localDate}`);
  }
  return localDate.slice(0, 7);
}

function normalizeOverridePayload(value: unknown): MonthLockOverridePayload | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const payload = value as {
    until?: unknown;
    reason?: unknown;
    setByUserId?: unknown;
    setByName?: unknown;
  };
  if (typeof payload.until !== 'string') {
    return null;
  }
  const untilMs = Date.parse(payload.until);
  if (!Number.isFinite(untilMs)) {
    return null;
  }
  return {
    until: new Date(untilMs).toISOString(),
    reason: typeof payload.reason === 'string' ? payload.reason : undefined,
    setByUserId:
      typeof payload.setByUserId === 'number' ? payload.setByUserId : undefined,
    setByName: typeof payload.setByName === 'string' ? payload.setByName : undefined,
  };
}

export async function getMonthLockOverrideStatus() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: OVERRIDE_SETTING_KEY },
  });
  const normalized = normalizeOverridePayload(setting?.value);
  if (!normalized) {
    return {
      active: false,
      until: null as string | null,
      reason: null as string | null,
      setByName: null as string | null,
      remainingMinutes: 0,
    };
  }

  const untilMs = Date.parse(normalized.until);
  const nowMs = Date.now();
  const active = untilMs > nowMs;
  const remainingMinutes = active
    ? Math.max(1, Math.ceil((untilMs - nowMs) / 60000))
    : 0;

  return {
    active,
    until: normalized.until,
    reason: normalized.reason ?? null,
    setByName: normalized.setByName ?? null,
    remainingMinutes,
  };
}

export async function isMonthLockOverrideActive(): Promise<boolean> {
  const status = await getMonthLockOverrideStatus();
  return status.active;
}

export async function setMonthLockOverride(
  req: Request,
  minutes: number,
  reason?: string
) {
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
    throw new HttpError(400, 'Override minutes must be between 1 and 240.');
  }
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    throw new HttpError(403, 'Admin access required');
  }

  const until = new Date(Date.now() + minutes * 60000).toISOString();
  const value: Prisma.InputJsonValue = {
    until,
    reason: reason?.trim() || undefined,
    setByUserId: authUser.id,
    setByName: authUser.name,
  } as unknown as Prisma.InputJsonValue;

  await prisma.systemSetting.upsert({
    where: { key: OVERRIDE_SETTING_KEY },
    create: {
      key: OVERRIDE_SETTING_KEY,
      value,
    },
    update: {
      value,
    },
  });

  return getMonthLockOverrideStatus();
}

export async function clearMonthLockOverride() {
  await prisma.systemSetting.deleteMany({
    where: { key: OVERRIDE_SETTING_KEY },
  });
}

export async function listMonthLocks() {
  return prisma.monthLock.findMany({
    orderBy: { monthKey: 'desc' },
  });
}

export async function lockMonth(req: Request, monthKeyRaw: string, notes?: string) {
  const monthKey = normalizeMonthKey(monthKeyRaw);
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    throw new HttpError(403, 'Admin access required');
  }
  return prisma.monthLock.upsert({
    where: { monthKey },
    create: {
      monthKey,
      notes: notes?.trim() || null,
      lockedByUserId: authUser.id,
      lockedByName: authUser.name,
    },
    update: {
      notes: notes?.trim() || null,
      lockedByUserId: authUser.id,
      lockedByName: authUser.name,
    },
  });
}

export async function unlockMonth(monthKeyRaw: string) {
  const monthKey = normalizeMonthKey(monthKeyRaw);
  await prisma.monthLock.deleteMany({
    where: { monthKey },
  });
}

async function getLockedMonthsIn(monthKeys: string[]) {
  if (monthKeys.length === 0) {
    return [];
  }
  return prisma.monthLock.findMany({
    where: {
      monthKey: {
        in: monthKeys,
      },
    },
    select: { monthKey: true },
  });
}

async function assertUnlockedMonths(monthKeys: string[], contextLabel: string) {
  const locks = await getLockedMonthsIn(monthKeys);
  if (locks.length === 0) {
    return;
  }

  if (await isMonthLockOverrideActive()) {
    return;
  }

  const lockList = locks.map((lock) => lock.monthKey).sort().join(', ');
  throw new HttpError(
    423,
    `${contextLabel} is blocked because month ${lockList} is locked. Enable admin override to continue.`
  );
}

export async function assertDateMutationAllowed(
  localDate: string,
  contextLabel: string
) {
  const monthKey = monthKeyFromDate(localDate);
  await assertUnlockedMonths([monthKey], contextLabel);
}

export async function assertDatesMutationAllowed(
  localDates: string[],
  contextLabel: string
) {
  const monthKeys = [...new Set(localDates.map((date) => monthKeyFromDate(date)))];
  await assertUnlockedMonths(monthKeys, contextLabel);
}

async function hasLockedMonthRows(
  entity: 'jobs' | 'payments' | 'expenses'
): Promise<{ lockedMonthKeys: string[]; affectedRowCount: number }> {
  const locks = await prisma.monthLock.findMany({
    select: { monthKey: true },
  });
  if (locks.length === 0) {
    return { lockedMonthKeys: [], affectedRowCount: 0 };
  }

  const predicates = locks.map((lock) => ({
    date: {
      startsWith: `${lock.monthKey}-`,
    },
  }));

  const affectedRowCount =
    entity === 'jobs'
      ? await prisma.job.count({ where: { OR: predicates } })
      : entity === 'payments'
        ? await prisma.payment.count({ where: { OR: predicates } })
        : await prisma.expense.count({ where: { OR: predicates } });

  return {
    lockedMonthKeys: locks.map((lock) => lock.monthKey).sort(),
    affectedRowCount,
  };
}

export async function assertBulkMutationAllowed(
  entity: 'jobs' | 'payments' | 'expenses',
  contextLabel: string
) {
  if (await isMonthLockOverrideActive()) {
    return;
  }

  const { lockedMonthKeys, affectedRowCount } = await hasLockedMonthRows(entity);
  if (affectedRowCount <= 0) {
    return;
  }

  throw new HttpError(
    423,
    `${contextLabel} is blocked because locked month data exists (${lockedMonthKeys.join(', ')}). Enable admin override to continue.`
  );
}
