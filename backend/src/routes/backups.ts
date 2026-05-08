import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { getAuthUser } from '../middleware/auth';
import {
  createBackup,
  listBackups,
  restoreBackup,
} from '../services/backupService';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';

const restoreSchema = z.object({
  fileName: z.string().trim().min(1),
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
    const backups = await listBackups();
    res.json(backups);
  })
);

router.post(
  '/create',
  asyncHandler(async (req, res) => {
    assertAdmin(req);
    const actor = getActorFromRequest(req);
    const created = await createBackup({
      mode: 'manual',
      triggeredBy: actor.actorName,
    });

    await createActivityLog({
      actor,
      entityType: 'BACKUP',
      action: 'CREATE',
      entityId: created.fileName,
      message: `Backup created: ${created.fileName}`,
      metadata: created,
    });

    res.status(201).json(created);
  })
);

router.post(
  '/restore',
  asyncHandler(async (req, res) => {
    assertAdmin(req);
    const actor = getActorFromRequest(req);
    const payload = restoreSchema.parse(req.body);

    await restoreBackup(payload.fileName);

    await createActivityLog({
      actor,
      entityType: 'BACKUP',
      action: 'RESTORE',
      entityId: payload.fileName,
      message: `Backup restored: ${payload.fileName}`,
    });

    res.json({
      ok: true,
      restoredFile: payload.fileName,
    });
  })
);

export { router as backupsRouter };
