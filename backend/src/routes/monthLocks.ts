import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { getAuthUser } from '../middleware/auth';
import {
  clearMonthLockOverride,
  getMonthLockOverrideStatus,
  listMonthLocks,
  lockMonth,
  normalizeMonthKey,
  setMonthLockOverride,
  unlockMonth,
} from '../services/monthLockService';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';

const lockSchema = z.object({
  monthKey: z.string().trim(),
  notes: z.string().trim().max(500).nullable().optional(),
});

const overrideSchema = z.object({
  minutes: z.number().int().min(1).max(240),
  reason: z.string().trim().max(300).nullable().optional(),
});

function assertAdmin(req: Parameters<typeof getAuthUser>[0]) {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    throw new HttpError(403, 'Admin access required');
  }
}

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    assertAdmin(req);
    const [locks, override] = await Promise.all([
      listMonthLocks(),
      getMonthLockOverrideStatus(),
    ]);
    res.json({ locks, override });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    assertAdmin(req);
    const payload = lockSchema.parse(req.body);
    const actor = getActorFromRequest(req);
    const locked = await lockMonth(req, payload.monthKey, payload.notes ?? undefined);

    await createActivityLog({
      actor,
      entityType: 'MONTH_LOCK',
      action: 'LOCK',
      entityId: normalizeMonthKey(payload.monthKey),
      message: `Locked month ${normalizeMonthKey(payload.monthKey)}`,
      after: locked,
    });

    res.status(201).json(locked);
  })
);

router.delete(
  '/:monthKey',
  asyncHandler(async (req, res) => {
    assertAdmin(req);
    const actor = getActorFromRequest(req);
    const monthKey = normalizeMonthKey(req.params.monthKey);
    await unlockMonth(monthKey);

    await createActivityLog({
      actor,
      entityType: 'MONTH_LOCK',
      action: 'UNLOCK',
      entityId: monthKey,
      message: `Unlocked month ${monthKey}`,
    });

    res.status(204).send();
  })
);

router.post(
  '/override',
  asyncHandler(async (req, res) => {
    assertAdmin(req);
    const payload = overrideSchema.parse(req.body);
    const actor = getActorFromRequest(req);
    const override = await setMonthLockOverride(req, payload.minutes, payload.reason ?? undefined);

    await createActivityLog({
      actor,
      entityType: 'MONTH_LOCK',
      action: 'OVERRIDE_ON',
      message: `Month-lock override enabled for ${payload.minutes} minute(s)`,
      metadata: {
        minutes: payload.minutes,
        reason: payload.reason ?? null,
        until: override.until,
      },
    });

    res.json(override);
  })
);

router.delete(
  '/override',
  asyncHandler(async (req, res) => {
    assertAdmin(req);
    const actor = getActorFromRequest(req);
    await clearMonthLockOverride();

    await createActivityLog({
      actor,
      entityType: 'MONTH_LOCK',
      action: 'OVERRIDE_OFF',
      message: 'Month-lock override cleared',
    });

    res.status(204).send();
  })
);

export { router as monthLocksRouter };
