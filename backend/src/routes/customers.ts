import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { CUSTOMER_TYPES } from '../domain/constants';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { parseId } from '../utils/ids';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';

const customerTypeSchema = z.enum(CUSTOMER_TYPES);

const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  shortCode: z.string().trim().min(1).max(20),
  type: customerTypeSchema,
  hasCommission: z.boolean().default(false),
  requiresDc: z.boolean().default(false),
  notes: z.string().max(1000).default(''),
  isActive: z.boolean().default(true),
});

const updateCustomerSchema = createCustomerSchema.partial();

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const customers = await prisma.customer.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(customers);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id);
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new HttpError(404, 'Customer not found');
    }

    res.json(customer);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createCustomerSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const created = await prisma.customer.create({
      data: payload,
    });

    await createActivityLog({
      actor,
      entityType: 'CUSTOMER',
      action: 'CREATE',
      entityId: String(created.id),
      message: `Customer created: ${created.name}`,
      after: created,
    });

    res.status(201).json(created);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id);
    const payload = updateCustomerSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const existing = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!existing) {
      throw new HttpError(404, 'Customer not found');
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: payload,
    });

    await createActivityLog({
      actor,
      entityType: 'CUSTOMER',
      action: 'UPDATE',
      entityId: String(updated.id),
      message: `Customer updated: ${updated.name}`,
      before: existing,
      after: updated,
    });

    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.id);
    const actor = getActorFromRequest(req);

    const existing = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!existing) {
      throw new HttpError(404, 'Customer not found');
    }

    try {
      await prisma.customer.delete({
        where: { id: customerId },
      });
    } catch (error) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: string }).code
          : null;

      if (code === 'P2003') {
        throw new HttpError(
          409,
          'Customer cannot be deleted because related jobs or payments exist.'
        );
      }
      throw error;
    }

    await createActivityLog({
      actor,
      entityType: 'CUSTOMER',
      action: 'DELETE',
      entityId: String(existing.id),
      message: `Customer deleted: ${existing.name}`,
      before: existing,
    });

    res.status(204).send();
  })
);

export { router as customersRouter };
