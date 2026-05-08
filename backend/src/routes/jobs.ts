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
import { getPagination } from '../utils/pagination';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';
import {
  assertBulkMutationAllowed,
  assertDateMutationAllowed,
  assertDatesMutationAllowed,
} from '../services/monthLockService';

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
  commissionWorkerId: z.number().int().positive().nullable().optional(),
  commissionWorkerName: z.string().trim().max(120).nullable().optional(),
  netAmount: z.number().min(0).nullable().optional(),
  date: localDateSchema,
  paymentStatus: paymentStatusSchema.nullable().optional(),
  paymentMode: paymentModeSchema.nullable().optional(),
  paidAmount: z.number().min(0).nullable().optional(),
  workMode: workModeSchema.nullable().optional(),
  isSpotWork: z.boolean().default(false),
  jobCardId: z.string().trim().max(30).nullable().optional(),
  jobCardLine: z.number().int().positive().nullable().optional(),
  billNo: z.string().trim().max(40).nullable().optional(),
  dcNo: z.string().trim().max(40).nullable().optional(),
  vehicleNo: z.string().trim().max(40).nullable().optional(),
  dcDate: localDateSchema.nullable().optional(),
  dcApproval: z.boolean().nullable().optional(),
  rmpHandler: z.enum(['Bhai', 'Raja']).nullable().optional(),
  jobFlowType: z.enum(['slw_work', 'agent_work']).nullable().optional(),
  externalDc: z.boolean().nullable().optional(),
  agentName: z.string().trim().max(120).nullable().optional(),
  agentCommissionAmount: z.number().min(0).nullable().optional(),
  agentTdsAmount: z.number().min(0).nullable().optional(),
  agentSettlementPaidAmount: z.number().min(0).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const updateJobSchema = createJobSchema.partial();

const createBulkJobsSchema = z.object({
  jobs: z.array(createJobSchema).min(1),
});

const router = Router();

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function assertBillNoConstraints(params: {
  customerId: number;
  billNo: string | null;
  jobCardId: string | null;
  excludeJobId?: number;
}) {
  const { customerId, billNo, jobCardId, excludeJobId } = params;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, hasBillNo: true },
  });

  if (!customer) {
    throw new HttpError(404, 'Customer not found');
  }

  if (customer.hasBillNo && !billNo) {
    throw new HttpError(400, 'Bill number is required for this customer.');
  }

  if (!billNo) {
    return;
  }

  const duplicate = await prisma.job.findFirst({
    where: {
      billNo,
      ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
      ...(jobCardId
        ? {
            OR: [{ jobCardId: { not: jobCardId } }, { jobCardId: null }],
          }
        : {}),
    },
    select: {
      id: true,
      jobCardId: true,
    },
  });

  if (duplicate) {
    throw new HttpError(
      409,
      `Bill number "${billNo}" is already used in job card ${duplicate.jobCardId ?? `LEGACY-${duplicate.id}`}.`
    );
  }
}

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
      prisma.job.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.job.count({ where }),
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
    await assertDateMutationAllowed(payload.date, 'Job creation');
    const billNo = normalizeOptionalText(payload.billNo);
    const jobCardId = normalizeOptionalText(payload.jobCardId);

    await assertBillNoConstraints({
      customerId: payload.customerId,
      billNo,
      jobCardId,
    });

    const created = await prisma.job.create({
      data: {
        ...payload,
        billNo,
        jobCardId,
      },
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
    await assertDatesMutationAllowed(
      payload.jobs.map((job) => job.date),
      'Bulk job creation'
    );
    const preparedJobs = payload.jobs.map((job) => ({
      ...job,
      billNo: normalizeOptionalText(job.billNo),
      jobCardId: normalizeOptionalText(job.jobCardId),
    }));

    const customerIds = [...new Set(preparedJobs.map((job) => job.customerId))];
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, hasBillNo: true },
    });
    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));

    preparedJobs.forEach((job, index) => {
      const customer = customerMap.get(job.customerId);
      if (!customer) {
        throw new HttpError(404, `Customer not found for line ${index + 1}.`);
      }
      if (customer.hasBillNo && !job.billNo) {
        throw new HttpError(
          400,
          `Bill number is required for line ${index + 1} (customer with bill-number workflow).`
        );
      }
    });

    const uniqueBillNos = [...new Set(preparedJobs.map((job) => job.billNo).filter((value): value is string => Boolean(value)))];
    for (const billNo of uniqueBillNos) {
      const billRows = preparedJobs.filter((job) => job.billNo === billNo);
      const cardIds = [...new Set(billRows.map((job) => job.jobCardId || ''))];
      const customerIdsForBill = [...new Set(billRows.map((job) => job.customerId))];

      if (cardIds.length > 1) {
        throw new HttpError(
          400,
          `Bill number "${billNo}" is used for multiple job cards in this request.`
        );
      }
      if (customerIdsForBill.length > 1) {
        throw new HttpError(
          400,
          `Bill number "${billNo}" is used for multiple customers in this request.`
        );
      }

      const cardId = cardIds[0] || null;
      await assertBillNoConstraints({
        customerId: billRows[0].customerId,
        billNo,
        jobCardId: cardId,
      });
    }

    const created = await prisma.$transaction(
      preparedJobs.map((jobData) =>
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

    await assertDateMutationAllowed(existing.date, 'Job update');
    if (payload.date !== undefined) {
      await assertDateMutationAllowed(payload.date, 'Job date update');
    }

    const effectiveCustomerId = payload.customerId ?? existing.customerId;
    const effectiveBillNo =
      payload.billNo !== undefined
        ? normalizeOptionalText(payload.billNo)
        : normalizeOptionalText(existing.billNo);
    const effectiveJobCardId =
      payload.jobCardId !== undefined
        ? normalizeOptionalText(payload.jobCardId)
        : normalizeOptionalText(existing.jobCardId);

    await assertBillNoConstraints({
      customerId: effectiveCustomerId,
      billNo: effectiveBillNo,
      jobCardId: effectiveJobCardId,
      excludeJobId: existing.id,
    });

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        ...payload,
        ...(payload.billNo !== undefined ? { billNo: effectiveBillNo } : {}),
        ...(payload.jobCardId !== undefined ? { jobCardId: effectiveJobCardId } : {}),
      },
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

    await assertDateMutationAllowed(existing.date, 'Job delete');

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
    await assertBulkMutationAllowed('jobs', 'Bulk delete of jobs');
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
