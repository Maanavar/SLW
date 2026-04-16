import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { parseId } from '../utils/ids';
import { isLocalDateString } from '../utils/date';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';

const localDateSchema = z.string().refine(isLocalDateString, {
  message: 'Date must be in YYYY-MM-DD format.',
});

const createPaymentSchema = z.object({
  workerId: z.number().int().positive(),
  workerName: z.string().trim().min(1).max(120),
  customerId: z.number().int().positive(),
  jobIds: z.array(z.number().int().positive()),
  amount: z.number().min(0),
  date: localDateSchema,
  notes: z.string().nullable().optional(),
});

const updatePaymentSchema = createPaymentSchema.partial();

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const workerIdRaw = typeof req.query.workerId === 'string' ? req.query.workerId : undefined;
    const customerIdRaw = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;

    const workerId =
      workerIdRaw && Number.isInteger(Number(workerIdRaw)) ? Number(workerIdRaw) : undefined;
    const customerId =
      customerIdRaw && Number.isInteger(Number(customerIdRaw)) ? Number(customerIdRaw) : undefined;

    const payments = await prisma.commissionPayment.findMany({
      where: {
        ...(workerId ? { workerId } : {}),
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { date: 'desc' },
    });

    res.json(payments);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createPaymentSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const created = await prisma.commissionPayment.create({ data: payload });

    await createActivityLog({
      actor,
      entityType: 'COMMISSION_PAYMENT',
      action: 'CREATE',
      entityId: String(created.id),
      message: `Commission payment of ${created.amount} recorded for worker ${created.workerName}`,
      after: created,
    });

    res.status(201).json(created);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const paymentId = parseId(req.params.id);
    const payload = updatePaymentSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const existing = await prisma.commissionPayment.findUnique({ where: { id: paymentId } });
    if (!existing) throw new HttpError(404, 'Commission payment not found');

    const updated = await prisma.commissionPayment.update({
      where: { id: paymentId },
      data: payload,
    });

    await createActivityLog({
      actor,
      entityType: 'COMMISSION_PAYMENT',
      action: 'UPDATE',
      entityId: String(updated.id),
      message: `Commission payment updated for worker ${updated.workerName}`,
      before: existing,
      after: updated,
    });

    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const paymentId = parseId(req.params.id);
    const actor = getActorFromRequest(req);

    const existing = await prisma.commissionPayment.findUnique({ where: { id: paymentId } });
    if (!existing) throw new HttpError(404, 'Commission payment not found');

    await prisma.commissionPayment.delete({ where: { id: paymentId } });

    await createActivityLog({
      actor,
      entityType: 'COMMISSION_PAYMENT',
      action: 'DELETE',
      entityId: String(existing.id),
      message: `Commission payment deleted for worker ${existing.workerName}`,
      before: existing,
    });

    res.status(204).send();
  })
);

export { router as commissionPaymentsRouter };
