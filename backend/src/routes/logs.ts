import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../middleware/asyncHandler';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  entityType: z.string().trim().min(1).max(50).optional(),
  action: z.string().trim().min(1).max(50).optional(),
});

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = querySchema.parse({
      limit: req.query.limit,
      offset: req.query.offset,
      entityType: req.query.entityType,
      action: req.query.action,
    });

    const where = {
      ...(parsed.entityType ? { entityType: parsed.entityType } : {}),
      ...(parsed.action ? { action: parsed.action } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: parsed.offset,
        take: parsed.limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      total,
      limit: parsed.limit,
      offset: parsed.offset,
      items,
    });
  })
);

export { router as logsRouter };
