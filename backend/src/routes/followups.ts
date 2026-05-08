import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { parseId } from '../utils/ids';
import { isLocalDateString } from '../utils/date';
import {
  clearCustomerFollowUp,
  getFollowUpOverview,
  upsertCustomerFollowUp,
} from '../services/followUpService';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';

const localDateSchema = z.string().refine(isLocalDateString, {
  message: 'Date must be in YYYY-MM-DD format.',
});

const upsertFollowUpSchema = z.object({
  nextFollowUpDate: localDateSchema,
  notes: z.string().trim().max(1000).nullable().optional(),
});

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const overview = await getFollowUpOverview();
    res.json(overview);
  })
);

router.put(
  '/:customerId',
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.customerId);
    const payload = upsertFollowUpSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });
    if (!customer) {
      throw new HttpError(404, 'Customer not found');
    }

    const saved = await upsertCustomerFollowUp({
      customerId,
      nextFollowUpDate: payload.nextFollowUpDate,
      notes: payload.notes,
    });

    await createActivityLog({
      actor,
      entityType: 'FOLLOW_UP',
      action: 'UPSERT',
      entityId: String(customerId),
      message: `Follow-up set for ${customer.name}`,
      after: saved,
    });

    res.json(saved);
  })
);

router.delete(
  '/:customerId',
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.customerId);
    const actor = getActorFromRequest(req);

    await clearCustomerFollowUp(customerId);

    await createActivityLog({
      actor,
      entityType: 'FOLLOW_UP',
      action: 'DELETE',
      entityId: String(customerId),
      message: 'Follow-up cleared',
    });

    res.status(204).send();
  })
);

export { router as followUpsRouter };

