import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { env } from '../config/env';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';
import {
  CUSTOMER_TYPES,
  EXPENSE_CATEGORIES,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  WORK_MODES,
} from '../domain/constants';
import { isLocalDateString } from '../utils/date';

const CONFIRM_TEXT = 'DELETE ALL DATA';

const localDateSchema = z.string().refine(isLocalDateString, {
  message: 'Date must be in YYYY-MM-DD format.',
});

const purgeSchema = z.object({
  confirmText: z.string().trim(),
  scope: z
    .object({
      allData: z.boolean().optional(),
      jobs: z.boolean().optional(),
      payments: z.boolean().optional(),
      expenses: z.boolean().optional(),
      customers: z.boolean().optional(),
      workTypes: z.boolean().optional(),
      logs: z.boolean().optional(),
    })
    .default({}),
});

const importLegacySchema = z.object({
  overwrite: z.boolean().default(false),
  customers: z
    .array(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(120),
        shortCode: z.string().trim().max(20).default(''),
        type: z.enum(CUSTOMER_TYPES),
        hasCommission: z.boolean(),
        requiresDc: z.boolean(),
        notes: z.string().max(1000).default(''),
        isActive: z.boolean(),
      })
    )
    .default([]),
  workTypes: z
    .array(
      z.object({
        id: z.number().int().positive(),
        category: z.string().trim().min(1).max(60),
        name: z.string().trim().min(1).max(120),
        shortCode: z.string().trim().max(20).default(''),
        defaultUnit: z.string().trim().min(1).max(30),
        defaultRate: z.number().min(0),
        isActive: z.boolean().optional().default(true),
      })
    )
    .default([]),
  jobs: z
    .array(
      z.object({
        id: z.number().int().positive(),
        customerId: z.number().int().positive(),
        workTypeName: z.string().trim().min(1).max(120),
        workName: z.string().trim().max(60).optional(),
        quantity: z.number().positive(),
        amount: z.number().min(0),
        commissionAmount: z.number().min(0).default(0),
        commissionWorkerId: z.number().int().positive().optional(),
        commissionWorkerName: z.string().trim().max(120).optional(),
        netAmount: z.number().min(0).optional(),
        date: localDateSchema,
        paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
        paymentMode: z.enum(PAYMENT_MODES).optional(),
        paidAmount: z.number().min(0).optional(),
        workMode: z.enum(WORK_MODES).optional(),
        isSpotWork: z.boolean().optional(),
        jobCardId: z.string().trim().max(30).optional(),
        jobCardLine: z.number().int().positive().optional(),
        dcNo: z.string().trim().max(40).optional(),
        vehicleNo: z.string().trim().max(40).optional(),
        dcDate: localDateSchema.optional(),
        dcApproval: z.boolean().optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .default([]),
  payments: z
    .array(
      z.object({
        id: z.number().int().positive(),
        customerId: z.number().int().positive(),
        amount: z.number().positive(),
        date: localDateSchema,
        paymentMode: z.enum(PAYMENT_MODES),
        referenceNumber: z.string().trim().max(60).optional(),
        paymentForMonth: z.string().trim().max(20).optional(),
        paymentForDate: localDateSchema.optional(),
        paymentForFromDate: localDateSchema.optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .default([]),
  expenses: z
    .array(
      z.object({
        id: z.number().int().positive(),
        category: z.enum(EXPENSE_CATEGORIES),
        description: z.string().trim().min(1).max(255),
        amount: z.number().positive(),
        date: localDateSchema,
        isRecurring: z.boolean().optional().default(false),
        recurringDay: z.number().int().min(1).max(28).optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .default([]),
});

const router = Router();

function assertAdminKey(req: Request) {
  if (!env.adminApiKey) {
    return;
  }
  const providedKey = req.header('x-admin-key');
  if (providedKey !== env.adminApiKey) {
    throw new HttpError(401, 'Invalid or missing x-admin-key');
  }
}

router.post(
  '/import-legacy',
  asyncHandler(async (req, res) => {
    const payload = importLegacySchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const currentCounts = await Promise.all([
      prisma.customer.count(),
      prisma.workType.count(),
      prisma.job.count(),
      prisma.payment.count(),
      prisma.expense.count(),
    ]);

    const hasExistingData = currentCounts.some((count) => count > 0);
    if (hasExistingData && !payload.overwrite) {
      throw new HttpError(
        409,
        'Database already has data. Set overwrite=true to replace existing records.'
      );
    }

    const summary = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (payload.overwrite) {
        await tx.payment.deleteMany({});
        await tx.job.deleteMany({});
        await tx.expense.deleteMany({});
        await tx.customer.deleteMany({});
        await tx.workType.deleteMany({});
      }

      if (payload.customers.length > 0) {
        await tx.customer.createMany({
          data: payload.customers,
          skipDuplicates: true,
        });
      }

      if (payload.workTypes.length > 0) {
        await tx.workType.createMany({
          data: payload.workTypes.map((wt) => ({
            ...wt,
            isActive: wt.isActive ?? true,
          })),
          skipDuplicates: true,
        });
      }

      if (payload.jobs.length > 0) {
        await tx.job.createMany({
          data: payload.jobs.map((job) => ({
            ...job,
            workName: job.workName ?? null,
            commissionWorkerId: job.commissionWorkerId ?? null,
            commissionWorkerName: job.commissionWorkerName ?? null,
            netAmount: job.netAmount ?? null,
            paymentStatus: job.paymentStatus ?? null,
            paymentMode: job.paymentMode ?? null,
            paidAmount: job.paidAmount ?? null,
            workMode: job.workMode ?? null,
            isSpotWork: job.isSpotWork ?? false,
            jobCardId: job.jobCardId ?? null,
            jobCardLine: job.jobCardLine ?? null,
            dcNo: job.dcNo ?? null,
            vehicleNo: job.vehicleNo ?? null,
            dcDate: job.dcDate ?? null,
            dcApproval: job.dcApproval ?? null,
            notes: job.notes ?? null,
          })),
          skipDuplicates: true,
        });
      }

      if (payload.payments.length > 0) {
        await tx.payment.createMany({
          data: payload.payments.map((payment) => ({
            ...payment,
            referenceNumber: payment.referenceNumber ?? null,
            paymentForMonth: payment.paymentForMonth ?? null,
            paymentForDate: payment.paymentForDate ?? null,
            paymentForFromDate: payment.paymentForFromDate ?? null,
            notes: payment.notes ?? null,
          })),
          skipDuplicates: true,
        });
      }

      if (payload.expenses.length > 0) {
        await tx.expense.createMany({
          data: payload.expenses.map((expense) => ({
            ...expense,
            isRecurring: expense.isRecurring ?? false,
            recurringDay: expense.isRecurring
              ? expense.recurringDay ?? null
              : null,
            notes: expense.notes ?? null,
          })),
          skipDuplicates: true,
        });
      }

      // Keep serial IDs aligned after explicit-ID imports.
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"customers"', 'id'), COALESCE((SELECT MAX(id) FROM "customers"), 1), true);`
      );
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"work_types"', 'id'), COALESCE((SELECT MAX(id) FROM "work_types"), 1), true);`
      );
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"jobs"', 'id'), COALESCE((SELECT MAX(id) FROM "jobs"), 1), true);`
      );
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"payments"', 'id'), COALESCE((SELECT MAX(id) FROM "payments"), 1), true);`
      );
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"expenses"', 'id'), COALESCE((SELECT MAX(id) FROM "expenses"), 1), true);`
      );

      return {
        customers: payload.customers.length,
        workTypes: payload.workTypes.length,
        jobs: payload.jobs.length,
        payments: payload.payments.length,
        expenses: payload.expenses.length,
      };
    });

    await createActivityLog({
      actor,
      entityType: 'SYSTEM',
      action: 'SYSTEM',
      message: 'Legacy data import completed',
      metadata: {
        overwrite: payload.overwrite,
        imported: summary,
      },
    });

    res.json({
      ok: true,
      imported: summary,
    });
  })
);

router.post(
  '/purge',
  asyncHandler(async (req, res) => {
    const payload = purgeSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    if (payload.confirmText !== CONFIRM_TEXT) {
      throw new HttpError(400, `Invalid confirmText. Expected: ${CONFIRM_TEXT}`);
    }

    assertAdminKey(req);

    const allData = payload.scope.allData === true;
    const requestedScope = {
      jobs: allData || payload.scope.jobs === true,
      payments: allData || payload.scope.payments === true,
      expenses: allData || payload.scope.expenses === true,
      customers: allData || payload.scope.customers === true,
      workTypes: allData || payload.scope.workTypes === true,
      logs: allData || payload.scope.logs === true,
    };

    // Customer deletion must also remove dependent records.
    const scope = {
      ...requestedScope,
      ...(requestedScope.customers
        ? {
            jobs: true,
            payments: true,
          }
        : {}),
    };

    if (
      !scope.jobs &&
      !scope.payments &&
      !scope.expenses &&
      !scope.customers &&
      !scope.workTypes &&
      !scope.logs
    ) {
      throw new HttpError(400, 'No scope selected for purge');
    }

    const summary = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = {
        jobs: 0,
        payments: 0,
        expenses: 0,
        jobPaymentMarksReset: 0,
        customers: 0,
        workTypes: 0,
        logs: 0,
      };

      if (scope.jobs) {
        result.jobs = (await tx.job.deleteMany({})).count;
      }

      if (scope.payments) {
        result.payments = (await tx.payment.deleteMany({})).count;
        if (!scope.jobs) {
          result.jobPaymentMarksReset = (
            await tx.job.updateMany({
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
            })
          ).count;
        }
      }

      if (scope.expenses) {
        result.expenses = (await tx.expense.deleteMany({})).count;
      }

      if (scope.customers) {
        result.customers = (await tx.customer.deleteMany({})).count;
      }

      if (scope.workTypes) {
        result.workTypes = (await tx.workType.deleteMany({})).count;
      }

      if (scope.logs) {
        result.logs = (await tx.activityLog.deleteMany({})).count;
      }

      return result;
    });

    await createActivityLog({
      actor,
      entityType: 'SYSTEM',
      action: 'PURGE',
      message: 'Admin purge executed',
      metadata: {
        requestedScope,
        effectiveScope: scope,
        summary,
      },
    });

    res.json({
      ok: true,
      requestedScope,
      scope,
      summary,
    });
  })
);

export { router as adminRouter };
