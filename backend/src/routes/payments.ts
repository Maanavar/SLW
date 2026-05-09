import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '../lib/cache';
import { PAYMENT_MODES } from '../domain/constants';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { parseId } from '../utils/ids';
import { isLocalDateString } from '../utils/date';
import { getPagination } from '../utils/pagination';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';
import {
  assertBulkMutationAllowed,
  assertDateMutationAllowed,
} from '../services/monthLockService';

const localDateSchema = z.string().refine(isLocalDateString, {
  message: 'Date must be in YYYY-MM-DD format.',
});

const paymentModeSchema = z.enum(PAYMENT_MODES);

const breakdownSchema = z
  .object({
    cash: z.number().min(0).optional(),
    upi: z.number().min(0).optional(),
    bank: z.number().min(0).optional(),
    cheque: z.number().min(0).optional(),
  })
  .nullable()
  .optional();

const createPaymentSchema = z.object({
  customerId: z.number().int().positive(),
  amount: z.number().positive(),
  date: localDateSchema,
  paymentMode: paymentModeSchema,
  breakdown: breakdownSchema,
  referenceNumber: z.string().trim().max(60).nullable().optional(),
  paymentForMonth: z.string().trim().max(20).nullable().optional(),
  paymentForDate: localDateSchema.nullable().optional(),
  paymentForFromDate: localDateSchema.nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const updatePaymentSchema = createPaymentSchema.partial();

function normalizeBreakdown(
  breakdown: z.infer<typeof breakdownSchema>
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (breakdown === undefined) {
    return undefined;
  }
  if (breakdown === null) {
    return Prisma.JsonNull;
  }
  return breakdown as Prisma.InputJsonValue;
}

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

    const cacheKey = `payments:${from ?? '*'}:${to ?? '*'}:${customerId ?? '*'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.json(JSON.parse(cached));
      return;
    }

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

    void cacheSet(cacheKey, JSON.stringify(payments));
    res.json(payments);
  })
);

router.get(
  '/page',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const customerIdRaw =
      typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    const customerId =
      customerIdRaw && Number.isInteger(Number(customerIdRaw))
        ? Number(customerIdRaw)
        : undefined;
    const { limit, offset } = getPagination(req);

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

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      total,
      limit,
      offset,
      items,
    });
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
    await assertDateMutationAllowed(payload.date, 'Payment creation');
    const data: Prisma.PaymentUncheckedCreateInput = {
      customerId: payload.customerId,
      amount: payload.amount,
      date: payload.date,
      paymentMode: payload.paymentMode,
      breakdown: normalizeBreakdown(payload.breakdown),
      referenceNumber: payload.referenceNumber ?? null,
      paymentForMonth: payload.paymentForMonth ?? null,
      paymentForDate: payload.paymentForDate ?? null,
      paymentForFromDate: payload.paymentForFromDate ?? null,
      notes: payload.notes ?? null,
    };

    const created = await prisma.payment.create({
      data,
    });

    await createActivityLog({
      actor,
      entityType: 'PAYMENT',
      action: 'CREATE',
      entityId: String(created.id),
      message: 'Payment created',
      after: created,
    });

    void cacheInvalidatePrefix('payments');
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

    await assertDateMutationAllowed(existing.date, 'Payment update');
    if (payload.date !== undefined) {
      await assertDateMutationAllowed(payload.date, 'Payment date update');
    }

    const data: Prisma.PaymentUncheckedUpdateInput = {};

    if (payload.customerId !== undefined) data.customerId = payload.customerId;
    if (payload.amount !== undefined) data.amount = payload.amount;
    if (payload.date !== undefined) data.date = payload.date;
    if (payload.paymentMode !== undefined) data.paymentMode = payload.paymentMode;
    if (payload.breakdown !== undefined) data.breakdown = normalizeBreakdown(payload.breakdown);
    if (payload.referenceNumber !== undefined) data.referenceNumber = payload.referenceNumber;
    if (payload.paymentForMonth !== undefined) data.paymentForMonth = payload.paymentForMonth;
    if (payload.paymentForDate !== undefined) data.paymentForDate = payload.paymentForDate;
    if (payload.paymentForFromDate !== undefined) {
      data.paymentForFromDate = payload.paymentForFromDate;
    }
    if (payload.notes !== undefined) data.notes = payload.notes;

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data,
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

    void cacheInvalidatePrefix('payments');
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

    await assertDateMutationAllowed(existing.date, 'Payment delete');

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

    void cacheInvalidatePrefix('payments');
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
    await assertBulkMutationAllowed('payments', 'Bulk delete of payments');
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

    void cacheInvalidatePrefix('payments');
    void cacheInvalidatePrefix('jobs');
    res.json({
      deleted: outcome.deletedPayments,
      resetJobs: outcome.resetJobs,
    });
  })
);

export { router as paymentsRouter };
