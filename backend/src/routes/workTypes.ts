import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { parseId } from '../utils/ids';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';

const createWorkTypeSchema = z.object({
  category: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(120),
  shortCode: z.string().trim().min(1).max(20),
  defaultUnit: z.string().trim().min(1).max(30),
  defaultRate: z.number().min(0),
  isActive: z.boolean().default(true),
});

const updateWorkTypeSchema = createWorkTypeSchema.partial();

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const workTypes = await prisma.workType.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(workTypes);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const workTypeId = parseId(req.params.id);
    const workType = await prisma.workType.findUnique({
      where: { id: workTypeId },
    });

    if (!workType) {
      throw new HttpError(404, 'Work type not found');
    }

    res.json(workType);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createWorkTypeSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const created = await prisma.workType.create({
      data: payload,
    });

    await createActivityLog({
      actor,
      entityType: 'WORK_TYPE',
      action: 'CREATE',
      entityId: String(created.id),
      message: `Work type created: ${created.name}`,
      after: created,
    });

    res.status(201).json(created);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const workTypeId = parseId(req.params.id);
    const payload = updateWorkTypeSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const existing = await prisma.workType.findUnique({
      where: { id: workTypeId },
    });

    if (!existing) {
      throw new HttpError(404, 'Work type not found');
    }

    const updated = await prisma.workType.update({
      where: { id: workTypeId },
      data: payload,
    });

    await createActivityLog({
      actor,
      entityType: 'WORK_TYPE',
      action: 'UPDATE',
      entityId: String(updated.id),
      message: `Work type updated: ${updated.name}`,
      before: existing,
      after: updated,
    });

    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const workTypeId = parseId(req.params.id);
    const actor = getActorFromRequest(req);

    const existing = await prisma.workType.findUnique({
      where: { id: workTypeId },
    });

    if (!existing) {
      throw new HttpError(404, 'Work type not found');
    }

    await prisma.workType.delete({
      where: { id: workTypeId },
    });

    await createActivityLog({
      actor,
      entityType: 'WORK_TYPE',
      action: 'DELETE',
      entityId: String(existing.id),
      message: `Work type deleted: ${existing.name}`,
      before: existing,
    });

    res.status(204).send();
  })
);

export { router as workTypesRouter };
