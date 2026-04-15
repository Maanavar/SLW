import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { PAYMENT_MODES } from '../domain/constants';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { parseId } from '../utils/ids';
import { isLocalDateString } from '../utils/date';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';

const localDateSchema = z.string().refine(isLocalDateString, {
  message: 'Date must be in YYYY-MM-DD format.',
});

const paymentModeSchema = z.enum(PAYMENT_MODES);

const createPaymentSchema = z.object({
  customerId: z.number().int().positive(),
  amount: z.number().positive(),
  date: localDateSchema,
  paymentMode: paymentModeSchema,
  referenceNumber: z.string().trim().max(60).nullable().optional(),
  paymentForMonth: z.string().trim().max(20).nullable().optional(),
  paymentForDate: localDateSchema.nullable().optional(),
  paymentForFromDate: localDateSchema.nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const updatePaymentSchema = createPaymentSchema.partial();

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const customerIdRaw =
      typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    const customerId =
      customerIdRaw && Number.isInteger(Number(customerIdRaw))
        ? Number(customerIdRaw)
        : undefined;

    const where = {
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(customerId ? { customerId } : {}),
    };

    const payments = await prisma.payment.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(payments);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const paymentId = parseId(req.params.id);
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new HttpError(404, 'Payment not found');
    }

    res.json(payment);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createPaymentSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const created = await prisma.payment.create({
      data: payload,
    });

    await createActivityLog({
      actor,
      entityType: 'PAYMENT',
      action: 'CREATE',
      entityId: String(created.id),
      message: 'Payment created',
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

    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existing) {
      throw new HttpError(404, 'Payment not found');
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: payload,
    });

    await createActivityLog({
      actor,
      entityType: 'PAYMENT',
      action: 'UPDATE',
      entityId: String(updated.id),
      message: 'Payment updated',
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

    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existing) {
      throw new HttpError(404, 'Payment not found');
    }

    await prisma.payment.delete({
      where: { id: paymentId },
    });

    await createActivityLog({
      actor,
      entityType: 'PAYMENT',
      action: 'DELETE',
      entityId: String(existing.id),
      message: 'Payment deleted',
      before: existing,
    });

    res.status(204).send();
  })
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    if (req.query.all !== 'true') {
      throw new HttpError(
        400,
        'To delete all payments use query parameter: ?all=true'
      );
    }

    const actor = getActorFromRequest(req);
    const outcome = await prisma.$transaction(async (tx) => {
      const deletedPayments = await tx.payment.deleteMany({});
      const resetJobs = await tx.job.updateMany({
        where: {
          OR: [
            { paidAmount: { gt: 0 } },
            { paymentStatus: { in: ['Paid', 'Partially Paid'] } },
            { paymentMode: { not: null } },
          ],
        },
        data: {
          paidAmount: 0,
          paymentStatus: 'Pending',
          paymentMode: null,
        },
      });

      return {
        deletedPayments: deletedPayments.count,
        resetJobs: resetJobs.count,
      };
    });

    await createActivityLog({
      actor,
      entityType: 'PAYMENT',
      action: 'BULK_DELETE',
      message: `Deleted all payments: ${outcome.deletedPayments}`,
      metadata: {
        deletedPayments: outcome.deletedPayments,
        resetJobs: outcome.resetJobs,
      },
    });

    res.json({
      deleted: outcome.deletedPayments,
      resetJobs: outcome.resetJobs,
    });
  })
);

export { router as paymentsRouter };
