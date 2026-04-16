/**
 * Expense Manager Screen
 * Manage all business expenses: EB, Rent, Salary, Material, Fuel, Union
 */

import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/currencyUtils';
import { useToast } from '@/hooks/useToast';
import { useDataStore } from '@/stores/dataStore';
import { getJobFinalBillValue, getJobNetValue, groupJobsByCard } from '@/lib/jobUtils';
import type { Expense } from '@/types';
import {
  EXPENSE_CATEGORIES,
  calculateExpenseMetrics,
  calculateProfitAnalysis,
  getMonthlyExpenseProjection,
  getExpenseSummaryByPeriod,
  calculateBreakEvenAnalysis,
  type BreakEvenAnalysis,
  type ExpenseMetrics,
  type ExpenseSummary,
  type ProfitAnalysis,
} from '@/lib/expenseUtils';
import './ExpenseManager.css';

type ExpenseTab = 'overview' | 'monthly' | 'breakdown' | 'history' | 'breakeven';

interface DateRange {
  from: string;
  to: string;
}

interface ExpenseFormState {
  category: Expense['category'];
  description: string;
  amount: string;
  date: string;
  isRecurring: boolean;
  recurringDay: number;
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getCurrentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthRangeForStr(yearMonth: string): DateRange {
  const [year, month] = yearMonth.split('-').map(Number);
  const from = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const lastDay = new Date(year, month, 0).getDate();
  const rawTo = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  const today = getTodayString();
  return { from, to: rawTo > today ? today : rawTo };
}

function shiftMonthStr(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function clampRecurringDay(day: number): number {
  if (!Number.isFinite(day)) {
    return 1;
  }
  return Math.min(28, Math.max(1, day));
}

function getDayFromDateString(date: string): number {
  const day = Number.parseInt(date.split('-')[2] || '1', 10);
  return clampRecurringDay(day);
}

function getDefaultFormData(today: string): ExpenseFormState {
  return {
    category: 'Material',
    description: '',
    amount: '',
    date: today,
    isRecurring: false,
    recurringDay: getDayFromDateString(today),
  };
}

export function ExpenseManager() {
  const { expenses, jobs, addExpense, deleteExpense } = useDataStore();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ExpenseTab>('overview');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<ExpenseFormState>(() => getDefaultFormData(getTodayString()));

  const currentMonthStr = useMemo(() => getCurrentMonthStr(), []);
  const [selectedMonthStr, setSelectedMonthStr] = useState(currentMonthStr);
  const monthRange = useMemo(() => getMonthRangeForStr(selectedMonthStr), [selectedMonthStr]);
  const monthMetrics = useMemo(() => calculateExpenseMetrics(expenses, monthRange), [expenses, monthRange]);
  const monthlyProjection = useMemo(() => getMonthlyExpenseProjection(expenses), [expenses]);
  const monthSummary = useMemo(
    () => getExpenseSummaryByPeriod(expenses, monthRange.from, monthRange.to),
    [expenses, monthRange]
  );

  const monthJobs = useMemo(
    () => jobs.filter((job) => job.date >= monthRange.from && job.date <= monthRange.to),
    [jobs, monthRange]
  );

  const monthRevenue = useMemo(
    () => monthJobs.reduce((sum, job) => sum + getJobFinalBillValue(job), 0),
    [monthJobs]
  );

  const monthCommission = useMemo(
    () => monthJobs.reduce((sum, job) => sum + (Number(job.commissionAmount) || 0), 0),
    [monthJobs]
  );

  const monthJobCards = useMemo(() => groupJobsByCard(monthJobs).length, [monthJobs]);

  const profitAnalysis = useMemo(
    () => calculateProfitAnalysis(monthRevenue, monthCommission, monthMetrics.totalExpenses),
    [monthRevenue, monthCommission, monthMetrics]
  );

  const avgProfitPerJob = useMemo(() => {
    const totalCards = groupJobsByCard(jobs).length;
    if (totalCards === 0) {
      return 0;
    }

    const totalNet = jobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
    return totalNet / totalCards;
  }, [jobs]);

  const breakEven = useMemo(
    () => calculateBreakEvenAnalysis(monthlyProjection, avgProfitPerJob, monthJobCards),
    [monthlyProjection, avgProfitPerJob, monthJobCards]
  );

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const description = formData.description.trim();
    const amount = Number.parseFloat(formData.amount);

    if (!description || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Validation', 'Please enter a valid description and amount');
      return;
    }

    try {
      await addExpense({
        category: formData.category,
        description,
        amount,
        date: formData.date,
        isRecurring: formData.isRecurring,
        recurringDay: formData.isRecurring ? clampRecurringDay(formData.recurringDay) : undefined,
      });

      toast.success('Success', 'Expense added');
      setShowAddForm(false);
      setFormData(getDefaultFormData(getTodayString()));
    } catch (error) {
      console.error('Failed to add expense', error);
      toast.error('Error', 'Failed to add expense');
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('Delete this expense? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteExpense(id);
      toast.success('Success', 'Expense deleted');
    } catch (error) {
      console.error('Failed to delete expense', error);
      toast.error('Error', 'Failed to delete expense');
    }
  };

  return (
    <div className="expense-manager">
      <div className="expense-header">
        <h1>Expense Manager</h1>
        <p className="expense-subtitle">
          Track all business expenses to calculate real profit from live records
        </p>
        <button className="add-expense-btn" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </div>

      {showAddForm && (
        <form className="expense-form" onSubmit={handleAddExpense}>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    category: e.target.value as Expense['category'],
                  }))
                }
              >
                {Object.entries(EXPENSE_CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                placeholder="e.g., Electricity bill - April 2026"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label>Amount</label>
              <input
                type="number"
                placeholder="0"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    date: nextDate,
                    recurringDay: prev.isRecurring ? getDayFromDateString(nextDate) : prev.recurringDay,
                  }));
                }}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isRecurring: e.target.checked,
                      recurringDay: e.target.checked
                        ? getDayFromDateString(prev.date)
                        : prev.recurringDay,
                    }))
                  }
                />
                <span>Recurring Monthly</span>
              </label>
            </div>

            {formData.isRecurring && (
              <div className="form-group">
                <label>
                  Recurring Day
                  <span
                    className="field-hint-icon"
                    title="Capped at 28 so it works in February. Day 29, 30, 31 don't exist in all months."
                    aria-label="Why capped at 28"
                  >
                    ?
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={formData.recurringDay}
                  onChange={(e) => {
                    const nextDay = Number.parseInt(e.target.value, 10);
                    setFormData((prev) => ({
                      ...prev,
                      recurringDay: Number.isFinite(nextDay)
                        ? clampRecurringDay(nextDay)
                        : prev.recurringDay,
                    }));
                  }}
                />
                <small>Day of month this expense repeats (1–28, capped for February compatibility).</small>
              </div>
            )}

            <button type="submit" className="submit-btn">
              Add Expense
            </button>
          </div>
        </form>
      )}

      <div className="expense-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          Month
        </button>
        <button
          className={`tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
          onClick={() => setActiveTab('breakdown')}
        >
          Breakdown
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button
          className={`tab-btn ${activeTab === 'breakeven' ? 'active' : ''}`}
          onClick={() => setActiveTab('breakeven')}
        >
          Break-Even
        </button>
      </div>

      <div className="expense-content">
        {activeTab === 'overview' && <OverviewTab profitAnalysis={profitAnalysis} />}
        {activeTab === 'monthly' && (
          <div>
            <div className="expense-month-nav">
              <button
                type="button"
                className="expense-month-nav-btn"
                onClick={() => setSelectedMonthStr(shiftMonthStr(selectedMonthStr, -1))}
                aria-label="Previous month"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <span className="expense-month-label">{formatMonthLabel(selectedMonthStr)}</span>
              <button
                type="button"
                className="expense-month-nav-btn"
                onClick={() => setSelectedMonthStr(shiftMonthStr(selectedMonthStr, 1))}
                disabled={selectedMonthStr >= currentMonthStr}
                aria-label="Next month"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <MonthlyTab summary={monthSummary} projection={monthlyProjection} />
          </div>
        )}
        {activeTab === 'breakdown' && <BreakdownTab metrics={monthMetrics} />}
        {activeTab === 'history' && <HistoryTab expenses={expenses} onDelete={handleDeleteExpense} />}
        {activeTab === 'breakeven' && <BreakEvenTab analysis={breakEven} />}
      </div>
    </div>
  );
}

function OverviewTab({ profitAnalysis }: { profitAnalysis: ProfitAnalysis }) {
  return (
    <div className="tab-section">
      <h2>Real Profit Analysis</h2>

      <div className="profit-waterfall">
        <div className="waterfall-item positive">
          <div className="waterfall-label">Gross Revenue</div>
          <div className="waterfall-value">{formatCurrency(profitAnalysis.grossRevenue)}</div>
        </div>

        <div className="waterfall-arrow">v</div>

        <div className="waterfall-item negative">
          <div className="waterfall-label">Commission Expense</div>
          <div className="waterfall-value">-{formatCurrency(profitAnalysis.commissionExpense)}</div>
        </div>

        <div className="waterfall-arrow">v</div>

        <div className="waterfall-item highlight">
          <div className="waterfall-label">Gross Profit</div>
          <div className="waterfall-value">{formatCurrency(profitAnalysis.grossProfit)}</div>
        </div>

        <div className="waterfall-arrow">v</div>

        <div className="waterfall-item negative">
          <div className="waterfall-label">Total Expenses</div>
          <div className="waterfall-value">-{formatCurrency(profitAnalysis.totalExpenses)}</div>
          <div className="breakdown-hint">EB, Rent, Salary, Material, Fuel, Union, Other</div>
        </div>

        <div className="waterfall-arrow">v</div>

        <div className={`waterfall-item ${profitAnalysis.netProfit >= 0 ? 'success' : 'danger'}`}>
          <div className="waterfall-label">NET PROFIT (REAL INCOME)</div>
          <div className="waterfall-value large">{formatCurrency(profitAnalysis.netProfit)}</div>
          <div className="waterfall-details">
            <span>Margin: {profitAnalysis.profitMargin.toFixed(1)}%</span>
            <span>Expenses: {profitAnalysis.expenseRatio.toFixed(1)}% of revenue</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthlyTab({ summary, projection }: { summary: ExpenseSummary; projection: number }) {
  return (
    <div className="tab-section">
      <h2>This Month&apos;s Expenses</h2>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Expenses</div>
          <div className="metric-value">{formatCurrency(summary.totalExpenses)}</div>
          <div className="metric-subtitle">{summary.count} transactions</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Recurring Expenses</div>
          <div className="metric-value">{formatCurrency(summary.recurring)}</div>
          <div className="metric-subtitle">Monthly fixed costs</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Variable Expenses</div>
          <div className="metric-value">{formatCurrency(summary.variable)}</div>
          <div className="metric-subtitle">Materials and supplies</div>
        </div>

        <div className="metric-card highlight">
          <div className="metric-label">Monthly Projection</div>
          <div className="metric-value">{formatCurrency(projection)}</div>
          <div className="metric-subtitle">Recurring + current month</div>
        </div>
      </div>

      <div className="expense-list">
        <h3>Month&apos;s Details</h3>
        {Object.entries(summary.byCategory).map(([cat, amount]) =>
          amount > 0 ? (
            <div key={cat} className="expense-item">
              <span className="expense-category">{EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES]?.label || cat}</span>
              <span className="expense-amount">{formatCurrency(amount)}</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

function BreakdownTab({ metrics }: { metrics: ExpenseMetrics }) {
  const total = metrics.totalExpenses || 1;

  return (
    <div className="tab-section">
      <h2>Expense Breakdown</h2>

      <div className="breakdown-cards">
        {Object.entries(metrics.expensesByCategory).map(([cat, amount]) => {
          if (amount === 0) {
            return null;
          }

          const percentage = (amount / total) * 100;

          return (
            <div key={cat} className="breakdown-card">
              <div className="breakdown-header">
                <span>{EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES]?.label || cat}</span>
                <span className="breakdown-amount">{formatCurrency(amount)}</span>
              </div>
              <div className="breakdown-bar">
                <div className="breakdown-fill" style={{ width: `${percentage}%` }}></div>
              </div>
              <div className="breakdown-percentage">{percentage.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryTab({ expenses, onDelete }: { expenses: Expense[]; onDelete: (id: number) => Promise<void> }) {
  const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="tab-section">
      <h2>Expense History</h2>

      <div className="table-wrapper">
        <table className="expense-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th className="text-right">Amount</th>
              <th className="text-center">Type</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center">
                  No expenses recorded yet
                </td>
              </tr>
            )}
            {sorted.map((expense) => (
              <tr key={expense.id}>
                <td>{new Date(expense.date).toLocaleDateString('en-IN')}</td>
                <td>{EXPENSE_CATEGORIES[expense.category]?.label || expense.category}</td>
                <td>{expense.description}</td>
                <td className="text-right">{formatCurrency(expense.amount)}</td>
                <td className="text-center">
                  <span className={`badge ${expense.isRecurring ? 'recurring' : 'variable'}`}>
                    {expense.isRecurring ? 'Recurring' : 'Variable'}
                  </span>
                </td>
                <td className="text-center">
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => void onDelete(expense.id)}
                    title="Delete expense"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BreakEvenTab({ analysis }: { analysis: BreakEvenAnalysis }) {
  return (
    <div className="tab-section">
      <h2>Break-Even Analysis</h2>

      <div className="breakeven-analysis">
        <div className="analysis-card">
          <div className="analysis-label">Monthly Fixed Costs</div>
          <div className="analysis-value">{formatCurrency(analysis.monthlyFixedCosts)}</div>
          <div className="analysis-subtitle">Salary, Rent, EB, Union</div>
        </div>

        <div className="analysis-card">
          <div className="analysis-label">Avg Profit per Job</div>
          <div className="analysis-value">{formatCurrency(analysis.profitPerJob)}</div>
          <div className="analysis-subtitle">After commission</div>
        </div>

        <div className="analysis-card highlight">
          <div className="analysis-label">Jobs Needed to Break-Even</div>
          <div className="analysis-value">{analysis.jobsNeededToBreakEven}</div>
          <div className="analysis-subtitle">Minimum monthly jobs</div>
        </div>

        <div className={`analysis-card ${analysis.marginOfSafety >= 20 ? 'success' : 'warning'}`}>
          <div className="analysis-label">Margin of Safety</div>
          <div className="analysis-value">{analysis.marginOfSafety.toFixed(1)}%</div>
          <div className="analysis-subtitle">
            {analysis.marginOfSafety >= 20
              ? 'Healthy buffer above break-even'
              : 'Close to break-even point'}
          </div>
        </div>
      </div>

      <div className="breakeven-explanation">
        <h3>What This Means</h3>
        <p>
          You need to complete at least <strong>{analysis.jobsNeededToBreakEven} jobs per month</strong> to
          cover all your fixed expenses (salary, rent, EB, union).
        </p>
        <p>
          Any profit beyond these jobs is your actual net profit. Currently at{' '}
          <strong>{analysis.marginOfSafety.toFixed(1)}% safety margin</strong> and{' '}
          {analysis.marginOfSafety >= 20 ? 'in a healthy position.' : 'close to break-even.'}
        </p>
      </div>
    </div>
  );
}
