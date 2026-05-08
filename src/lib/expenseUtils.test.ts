import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Expense } from '@/types';
import {
  calculateBreakEvenAnalysis,
  calculateExpenseMetrics,
  calculateProfitAnalysis,
  getExpenseSummaryByPeriod,
  getMonthlyExpenseProjection,
} from './expenseUtils';

function createExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    category: 'Other',
    description: 'Expense',
    amount: 0,
    date: '2026-05-01',
    isRecurring: false,
    ...overrides,
  };
}

describe('expenseUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates expense metrics with category totals and recurring split', () => {
    const expenses: Expense[] = [
      createExpense({ id: 1, category: 'EB', amount: 100, date: '2026-05-02', isRecurring: true }),
      createExpense({ id: 2, category: 'Material', amount: 50, date: '2026-05-10' }),
      createExpense({ id: 3, category: 'Fuel', amount: 25, date: '2026-04-20' }),
    ];

    const metrics = calculateExpenseMetrics(expenses, { from: '2026-05-01', to: '2026-05-31' });

    expect(metrics.totalExpenses).toBe(150);
    expect(metrics.monthlyRecurring).toBe(100);
    expect(metrics.variableExpenses).toBe(50);
    expect(metrics.expensesByCategory.EB).toBe(100);
    expect(metrics.expensesByCategory.Material).toBe(50);
    expect(metrics.expensesByCategory.Fuel).toBe(0);
  });

  it('computes profit analysis and honors gross-profit override', () => {
    const analysis = calculateProfitAnalysis(1000, 200, 300, 900);
    expect(analysis.grossProfit).toBe(900);
    expect(analysis.netProfit).toBe(600);
    expect(analysis.profitMargin).toBe(60);
    expect(analysis.expenseRatio).toBe(30);
  });

  it('projects monthly expenses using valid recurring lines and current-month variable lines', () => {
    vi.setSystemTime(new Date('2026-05-15T09:00:00'));

    const expenses: Expense[] = [
      createExpense({ id: 1, category: 'Rent', amount: 100, isRecurring: true, recurringDay: 5 }),
      createExpense({ id: 2, category: 'EB', amount: 70, isRecurring: true, recurringDay: 30 }),
      createExpense({ id: 3, category: 'Material', amount: 60, date: '2026-05-10', isRecurring: false }),
      createExpense({ id: 4, category: 'Fuel', amount: 40, date: '2026-04-29', isRecurring: false }),
    ];

    expect(getMonthlyExpenseProjection(expenses)).toBe(160);
  });

  it('summarizes expenses by period and clamps break-even margin at zero', () => {
    const expenses: Expense[] = [
      createExpense({ id: 1, category: 'Salary', amount: 500, isRecurring: true, date: '2026-05-01' }),
      createExpense({ id: 2, category: 'Other', amount: 200, isRecurring: false, date: '2026-05-11' }),
      createExpense({ id: 3, category: 'Other', amount: 100, isRecurring: false, date: '2026-04-11' }),
    ];

    const summary = getExpenseSummaryByPeriod(expenses, '2026-05-01', '2026-05-31');
    expect(summary).toMatchObject({
      totalExpenses: 700,
      recurring: 500,
      variable: 200,
      count: 2,
    });

    const breakEven = calculateBreakEvenAnalysis(1000, 0, 800);
    expect(breakEven.jobsNeededToBreakEven).toBe(1000);
    expect(breakEven.marginOfSafety).toBe(0);
  });
});
