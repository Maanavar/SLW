import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../db/prisma';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({
      status: 'ok',
      service: 'slw-backend',
      timestamp: new Date().toISOString(),
    });
  })
);

router.get(
  '/db',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  })
);

export { router as healthRouter };
