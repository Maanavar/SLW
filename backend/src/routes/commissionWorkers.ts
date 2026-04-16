import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { parseId } from '../utils/ids';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';

const shareTypeSchema = z.enum(['percentage', 'fixed']);

const createWorkerSchema = z.object({
  customerId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  shareType: shareTypeSchema,
  shareValue: z.number().min(0),
  isActive: z.boolean().default(true),
});

const updateWorkerSchema = createWorkerSchema.partial();

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const customerIdRaw = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    const customerId =
      customerIdRaw && Number.isInteger(Number(customerIdRaw))
        ? Number(customerIdRaw)
        : undefined;

    const workers = await prisma.commissionWorker.findMany({
      where: customerId ? { customerId } : undefined,
      orderBy: [{ customerId: 'asc' }, { name: 'asc' }],
    });

    res.json(workers);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createWorkerSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const created = await prisma.commissionWorker.create({ data: payload });

    await createActivityLog({
      actor,
      entityType: 'COMMISSION_WORKER',
      action: 'CREATE',
      entityId: String(created.id),
      message: `Commission worker created: ${created.name}`,
      after: created,
    });

    res.status(201).json(created);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const workerId = parseId(req.params.id);
    const payload = updateWorkerSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const existing = await prisma.commissionWorker.findUnique({ where: { id: workerId } });
    if (!existing) throw new HttpError(404, 'Commission worker not found');

    const updated = await prisma.commissionWorker.update({
      where: { id: workerId },
      data: payload,
    });

    await createActivityLog({
      actor,
      entityType: 'COMMISSION_WORKER',
      action: 'UPDATE',
      entityId: String(updated.id),
      message: `Commission worker updated: ${updated.name}`,
      before: existing,
      after: updated,
    });

    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const workerId = parseId(req.params.id);
    const actor = getActorFromRequest(req);

    const existing = await prisma.commissionWorker.findUnique({ where: { id: workerId } });
    if (!existing) throw new HttpError(404, 'Commission worker not found');

    await prisma.commissionWorker.delete({ where: { id: workerId } });

    await createActivityLog({
      actor,
      entityType: 'COMMISSION_WORKER',
      action: 'DELETE',
      entityId: String(existing.id),
      message: `Commission worker deleted: ${existing.name}`,
      before: existing,
    });

    res.status(204).send();
  })
);

export { router as commissionWorkersRouter };
