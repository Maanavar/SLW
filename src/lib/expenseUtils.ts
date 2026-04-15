/**
 * Expense Tracking Utilities
 * Tracks business expenses: EB, Rent, Salary, Material, Fuel, Union, Other
 */

import type { Expense } from '@/types';

// Standard expense categories with icons and descriptions
export const EXPENSE_CATEGORIES = {
  EB: { label: '⚡ EB (Electricity)', description: 'Electricity bill' },
  Rent: { label: '🏢 Rent', description: 'Workshop rent' },
  Salary: { label: '👤 Salary', description: 'Employee salary' },
  Material: { label: '📦 Material', description: 'Raw materials & supplies' },
  Fuel: { label: '⛽ Fuel', description: 'Vehicle fuel & travel' },
  Union: { label: '🏭 Union', description: 'Sangam workshop union payment' },
  Other: { label: '📌 Other', description: 'Other expenses' },
};

export interface ExpenseMetrics {
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  monthlyRecurring: number;
  variableExpenses: number;
}

export interface ProfitAnalysis {
  grossRevenue: number;
  commissionExpense: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number; // %
  expenseRatio: number; // % of revenue
}

// ============================================================================
// EXPENSE CALCULATIONS
// ============================================================================

export function calculateExpenseMetrics(
  expenses: Expense[],
  filterByDate?: { from: string; to: string }
): ExpenseMetrics {
  const filtered = filterByDate
    ? expenses.filter((e) => e.date >= filterByDate.from && e.date <= filterByDate.to)
    : expenses;

  const totalExpenses = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);
  const expensesByCategory: Record<string, number> = {};

  // Initialize all categories
  Object.keys(EXPENSE_CATEGORIES).forEach((cat) => {
    expensesByCategory[cat] = 0;
  });

  // Sum by category
  filtered.forEach((expense) => {
    expensesByCategory[expense.category] =
      (expensesByCategory[expense.category] || 0) + (expense.amount || 0);
  });

  // Calculate recurring vs variable
  const monthlyRecurring = filtered
    .filter((e) => e.isRecurring)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const variableExpenses = totalExpenses - monthlyRecurring;

  return {
    totalExpenses,
    expensesByCategory,
    monthlyRecurring,
    variableExpenses,
  };
}

// ============================================================================
// PROFIT ANALYSIS (REAL PROFIT)
// ============================================================================

export function calculateProfitAnalysis(
  grossRevenue: number,
  commissionExpense: number,
  totalExpenses: number
): ProfitAnalysis {
  const grossProfit = grossRevenue - commissionExpense;
  const netProfit = grossProfit - totalExpenses;
  const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
  const expenseRatio = grossRevenue > 0 ? (totalExpenses / grossRevenue) * 100 : 0;

  return {
    grossRevenue,
    commissionExpense,
    grossProfit,
    totalExpenses,
    netProfit,
    profitMargin,
    expenseRatio,
  };
}

// ============================================================================
// MONTHLY EXPENSE PROJECTIONS
// ============================================================================

export function getMonthlyExpenseProjection(expenses: Expense[]): number {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Get all recurring expenses
  const recurringExpenses = expenses.filter(
    (e) =>
      e.isRecurring &&
      e.recurringDay !== undefined &&
      e.recurringDay >= 1 &&
      e.recurringDay <= 28
  );

  // Sum recurring (they happen every month)
  const recurringTotal = recurringExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Get variable expenses from this month
  const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
  const monthEnd = today.toISOString().split('T')[0];

  const variableThisMonth = expenses
    .filter(
      (e) => !e.isRecurring && e.date >= monthStart && e.date <= monthEnd
    )
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  return recurringTotal + variableThisMonth;
}

// ============================================================================
// EXPENSE SUMMARY BY PERIOD
// ============================================================================

export interface ExpenseSummary {
  period: string;
  totalExpenses: number;
  byCategory: Record<string, number>;
  recurring: number;
  variable: number;
  count: number;
}

export function getExpenseSummaryByPeriod(
  expenses: Expense[],
  from: string,
  to: string
): ExpenseSummary {
  const filtered = expenses.filter((e) => e.date >= from && e.date <= to);

  const byCategory: Record<string, number> = {};
  Object.keys(EXPENSE_CATEGORIES).forEach((cat) => {
    byCategory[cat] = 0;
  });

  let totalExpenses = 0;
  let recurring = 0;
  let variable = 0;

  filtered.forEach((expense) => {
    const amount = expense.amount || 0;
    totalExpenses += amount;
    byCategory[expense.category] = (byCategory[expense.category] || 0) + amount;

    if (expense.isRecurring) {
      recurring += amount;
    } else {
      variable += amount;
    }
  });

  return {
    period: `${from} to ${to}`,
    totalExpenses,
    byCategory,
    recurring,
    variable,
    count: filtered.length,
  };
}

// ============================================================================
// BREAK-EVEN ANALYSIS
// ============================================================================

export interface BreakEvenAnalysis {
  monthlyFixedCosts: number;
  profitPerJob: number;
  jobsNeededToBreakEven: number;
  marginOfSafety: number; // % above break-even
}

export function calculateBreakEvenAnalysis(
  monthlyExpenses: number,
  averageProfitPerJob: number,
  currentMonthJobs: number
): BreakEvenAnalysis {
  const jobsNeeded = Math.ceil(monthlyExpenses / Math.max(averageProfitPerJob, 1));
  const marginOfSafety =
    jobsNeeded > 0 ? ((currentMonthJobs - jobsNeeded) / jobsNeeded) * 100 : 0;

  return {
    monthlyFixedCosts: monthlyExpenses,
    profitPerJob: averageProfitPerJob,
    jobsNeededToBreakEven: jobsNeeded,
    marginOfSafety: Math.max(marginOfSafety, 0),
  };
}

// ============================================================================
// SAMPLE DATA FOR DEMO
// ============================================================================

export const SAMPLE_EXPENSES: Expense[] = [
  {
    id: 1,
    category: 'EB',
    description: 'Electricity bill - April 2026',
    amount: 3500,
    date: '2026-04-10',
    isRecurring: true,
    recurringDay: 10,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    category: 'Rent',
    description: 'Workshop rent - April 2026',
    amount: 15000,
    date: '2026-04-01',
    isRecurring: true,
    recurringDay: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    category: 'Salary',
    description: 'Employee salary - April 2026',
    amount: 12000,
    date: '2026-04-05',
    isRecurring: true,
    recurringDay: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 4,
    category: 'Material',
    description: 'Steel sheets and supplies',
    amount: 5400,
    date: '2026-04-12',
    isRecurring: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 5,
    category: 'Fuel',
    description: 'Diesel for vehicle',
    amount: 2500,
    date: '2026-04-08',
    isRecurring: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 6,
    category: 'Union',
    description: 'Sangam workshop union - April 2026',
    amount: 1500,
    date: '2026-04-15',
    isRecurring: true,
    recurringDay: 15,
    createdAt: new Date().toISOString(),
  },
];
