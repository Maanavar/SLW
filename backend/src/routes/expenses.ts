import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { EXPENSE_CATEGORIES } from '../domain/constants';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../middleware/httpError';
import { parseId } from '../utils/ids';
import { isLocalDateString } from '../utils/date';
import { createActivityLog, getActorFromRequest } from '../services/activityLogService';

const localDateSchema = z.string().refine(isLocalDateString, {
  message: 'Date must be in YYYY-MM-DD format.',
});

const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const createExpenseSchema = z.object({
  category: expenseCategorySchema,
  description: z.string().trim().min(1).max(255),
  amount: z.number().positive(),
  date: localDateSchema,
  isRecurring: z.boolean().default(false),
  recurringDay: z.number().int().min(1).max(28).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const updateExpenseSchema = createExpenseSchema.partial();

function getRecurringDayFromDate(date: string): number {
  const day = Number.parseInt(date.split('-')[2] || '1', 10);
  if (!Number.isFinite(day)) {
    return 1;
  }
  return Math.min(28, Math.max(1, day));
}

function normalizeExpensePayload(payload: z.infer<typeof createExpenseSchema>) {
  return {
    category: payload.category,
    description: payload.description,
    amount: payload.amount,
    date: payload.date,
    isRecurring: payload.isRecurring,
    recurringDay: payload.isRecurring
      ? (payload.recurringDay ?? getRecurringDayFromDate(payload.date))
      : null,
    notes:
      payload.notes && payload.notes.trim().length > 0 ? payload.notes.trim() : null,
  };
}

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const categoryRaw =
      typeof req.query.category === 'string' ? req.query.category : undefined;
    const isRecurringRaw =
      typeof req.query.isRecurring === 'string' ? req.query.isRecurring : undefined;

    const category =
      categoryRaw &&
      EXPENSE_CATEGORIES.includes(categoryRaw as ExpenseCategory)
        ? (categoryRaw as ExpenseCategory)
        : undefined;
    const isRecurring =
      isRecurringRaw === 'true' ? true : isRecurringRaw === 'false' ? false : undefined;

    const where = {
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(category ? { category } : {}),
      ...(typeof isRecurring === 'boolean' ? { isRecurring } : {}),
    };

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(expenses);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const expenseId = parseId(req.params.id);
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      throw new HttpError(404, 'Expense not found');
    }

    res.json(expense);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createExpenseSchema.parse(req.body);
    const actor = getActorFromRequest(req);
    const normalized = normalizeExpensePayload(payload);

    const created = await prisma.expense.create({
      data: normalized,
    });

    await createActivityLog({
      actor,
      entityType: 'EXPENSE',
      action: 'CREATE',
      entityId: String(created.id),
      message: `Expense created: ${created.category}`,
      after: created,
    });

    res.status(201).json(created);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const expenseId = parseId(req.params.id);
    const patch = updateExpenseSchema.parse(req.body);
    const actor = getActorFromRequest(req);

    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      throw new HttpError(404, 'Expense not found');
    }

    const merged = createExpenseSchema.parse({
      category: patch.category ?? existing.category,
      description: patch.description ?? existing.description,
      amount: patch.amount ?? existing.amount,
      date: patch.date ?? existing.date,
      isRecurring: patch.isRecurring ?? existing.isRecurring,
      recurringDay:
        patch.recurringDay !== undefined
          ? patch.recurringDay
          : existing.recurringDay ?? undefined,
      notes: patch.notes !== undefined ? patch.notes : existing.notes ?? undefined,
    });

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: normalizeExpensePayload(merged),
    });

    await createActivityLog({
      actor,
      entityType: 'EXPENSE',
      action: 'UPDATE',
      entityId: String(updated.id),
      message: `Expense updated: ${updated.category}`,
      before: existing,
      after: updated,
    });

    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const expenseId = parseId(req.params.id);
    const actor = getActorFromRequest(req);

    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      throw new HttpError(404, 'Expense not found');
    }

    await prisma.expense.delete({
      where: { id: expenseId },
    });

    await createActivityLog({
      actor,
      entityType: 'EXPENSE',
      action: 'DELETE',
      entityId: String(existing.id),
      message: `Expense deleted: ${existing.category}`,
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
        'To delete all expenses use query parameter: ?all=true'
      );
    }

    const actor = getActorFromRequest(req);
    const deleted = await prisma.expense.deleteMany({});

    await createActivityLog({
      actor,
      entityType: 'EXPENSE',
      action: 'BULK_DELETE',
      message: `Deleted all expenses: ${deleted.count}`,
      metadata: { count: deleted.count },
    });

    res.json({
      deleted: deleted.count,
    });
  })
);

export { router as expensesRouter };
