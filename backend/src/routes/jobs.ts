import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import {
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  WORK_MODES,
} from '../domain/constants';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { parseId } from '../utils/ids';
import { isLocalDateString } from '../utils/date';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';

const localDateSchema = z.string().refine(isLocalDateString, {
  message: 'Date must be in YYYY-MM-DD format.',
});

const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
const paymentModeSchema = z.enum(PAYMENT_MODES);
const workModeSchema = z.enum(WORK_MODES);

const createJobSchema = z.object({
  customerId: z.number().int().positive(),
  workTypeName: z.string().trim().min(1).max(120),
  workName: z.string().trim().max(60).nullable().optional(),
  quantity: z.number().positive(),
  amount: z.number().min(0),
  commissionAmount: z.number().min(0).default(0),
  netAmount: z.number().min(0).nullable().optional(),
  date: localDateSchema,
  paymentStatus: paymentStatusSchema.nullable().optional(),
  paymentMode: paymentModeSchema.nullable().optional(),
  paidAmount: z.number().min(0).nullable().optional(),
  workMode: workModeSchema.nullable().optional(),
  isSpotWork: z.boolean().default(false),
  jobCardId: z.string().trim().max(30).nullable().optional(),
  jobCardLine: z.number().int().positive().nullable().optional(),
  dcNo: z.string().trim().max(40).nullable().optional(),
  vehicleNo: z.string().trim().max(40).nullable().optional(),
  dcDate: localDateSchema.nullable().optional(),
  dcApproval: z.boolean().nullable().optional(),
});

const updateJobSchema = createJobSchema.partial();

const createBulkJobsSchema = z.object({
  jobs: z.array(createJobSchema).min(1),
});

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

    const jobs = await prisma.job.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(jobs);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const jobId = parseId(req.params.id);
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new HttpError(404, 'Job not found');
    }

    res.json(job);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createJobSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const created = await prisma.job.create({
      data: payload,
    });

    await createActivityLog({
      actor,
      entityType: 'JOB',
      action: 'CREATE',
      entityId: String(created.id),
      message: `Job created under card ${created.jobCardId ?? 'N/A'}`,
      after: created,
    });

    res.status(201).json(created);
  })
);

router.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const payload = createBulkJobsSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const created = await prisma.$transaction(
      payload.jobs.map((jobData) =>
        prisma.job.create({
          data: jobData,
        })
      )
    );

    const cardId = created[0]?.jobCardId ?? null;
    await createActivityLog({
      actor,
      entityType: 'JOB',
      action: 'CREATE',
      entityId: cardId ?? null,
      message: `Bulk jobs created: ${created.length} line(s)`,
      metadata: {
        count: created.length,
        jobCardId: cardId,
      },
    });

    res.status(201).json(created);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const jobId = parseId(req.params.id);
    const payload = updateJobSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const existing = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!existing) {
      throw new HttpError(404, 'Job not found');
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: payload,
    });

    await createActivityLog({
      actor,
      entityType: 'JOB',
      action: 'UPDATE',
      entityId: String(updated.id),
      message: `Job updated under card ${updated.jobCardId ?? 'N/A'}`,
      before: existing,
      after: updated,
    });

    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const jobId = parseId(req.params.id);
    const actor = getActorFromRequest(req);

    const existing = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!existing) {
      throw new HttpError(404, 'Job not found');
    }

    await prisma.job.delete({
      where: { id: jobId },
    });

    await createActivityLog({
      actor,
      entityType: 'JOB',
      action: 'DELETE',
      entityId: String(existing.id),
      message: `Job deleted under card ${existing.jobCardId ?? 'N/A'}`,
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
        'To delete all jobs use query parameter: ?all=true'
      );
    }

    const actor = getActorFromRequest(req);
    const deleted = await prisma.job.deleteMany({});

    await createActivityLog({
      actor,
      entityType: 'JOB',
      action: 'BULK_DELETE',
      message: `Deleted all jobs: ${deleted.count}`,
      metadata: { count: deleted.count },
    });

    res.json({
      deleted: deleted.count,
    });
  })
);

export { router as jobsRouter };
