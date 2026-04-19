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

interface DateRange { from: string; to: string; }
interface ExpenseFormState {
  category: Expense['category'];
  description: string;
  amount: string;
  date: string;
  isRecurring: boolean;
  recurringDay: number;
}

function getTodayString(): string { return new Date().toISOString().split('T')[0]; }
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
  if (!Number.isFinite(day)) return 1;
  return Math.min(28, Math.max(1, day));
}
function getDayFromDateString(date: string): number {
  return clampRecurringDay(Number.parseInt(date.split('-')[2] || '1', 10));
}
function getDefaultFormData(today: string): ExpenseFormState {
  return { category: 'Material', description: '', amount: '', date: today, isRecurring: false, recurringDay: getDayFromDateString(today) };
}

export function ExpenseManager() {
  const { expenses, jobs, addExpense, deleteExpense } = useDataStore();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ExpenseTab>('overview');
  const [formData, setFormData] = useState<ExpenseFormState>(() => getDefaultFormData(getTodayString()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentMonthStr = useMemo(() => getCurrentMonthStr(), []);
  const [selectedMonthStr, setSelectedMonthStr] = useState(currentMonthStr);
  const monthRange = useMemo(() => getMonthRangeForStr(selectedMonthStr), [selectedMonthStr]);
  const monthMetrics = useMemo(() => calculateExpenseMetrics(expenses, monthRange), [expenses, monthRange]);
  const monthlyProjection = useMemo(() => getMonthlyExpenseProjection(expenses), [expenses]);
  const monthSummary = useMemo(() => getExpenseSummaryByPeriod(expenses, monthRange.from, monthRange.to), [expenses, monthRange]);

  const monthJobs = useMemo(() => jobs.filter((j) => j.date >= monthRange.from && j.date <= monthRange.to), [jobs, monthRange]);
  const monthRevenue = useMemo(() => monthJobs.reduce((s, j) => s + getJobFinalBillValue(j), 0), [monthJobs]);
  const monthCommission = useMemo(() => monthJobs.reduce((s, j) => s + (Number(j.commissionAmount) || 0), 0), [monthJobs]);
  const monthJobCards = useMemo(() => groupJobsByCard(monthJobs).length, [monthJobs]);

  const profitAnalysis = useMemo(
    () => calculateProfitAnalysis(monthRevenue, monthCommission, monthMetrics.totalExpenses),
    [monthRevenue, monthCommission, monthMetrics]
  );

  const avgProfitPerJob = useMemo(() => {
    const totalCards = groupJobsByCard(jobs).length;
    if (totalCards === 0) return 0;
    return jobs.reduce((s, j) => s + getJobNetValue(j), 0) / totalCards;
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
    setIsSubmitting(true);
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
      setFormData(getDefaultFormData(getTodayString()));
    } catch (error) {
      console.error('Failed to add expense', error);
      toast.error('Error', 'Failed to add expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('Delete this expense? This action cannot be undone.')) return;
    try {
      await deleteExpense(id);
      toast.success('Success', 'Expense deleted');
    } catch (error) {
      console.error('Failed to delete expense', error);
      toast.error('Error', 'Failed to delete expense');
    }
  };

  return (
    <div className="exp-screen">

      {/* Row 1 – Header */}
      <div className="exp-pg-header">
        <div>
          <h1 className="exp-pg-title">Expenses</h1>
          <p className="exp-pg-desc">Track business expenses and calculate real profit</p>
        </div>
      </div>

      {/* Row 2 – Nav tabs */}
      <div className="exp-nav-tabs">
        {(['overview', 'monthly', 'breakdown', 'history', 'breakeven'] as ExpenseTab[]).map(tab => (
          <button key={tab} type="button"
            className={`exp-nav-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {tab === 'overview' ? 'Overview' : tab === 'monthly' ? 'Monthly' : tab === 'breakdown' ? 'Breakdown' : tab === 'history' ? 'History' : 'Break-Even'}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="exp-tab-content">
          {/* 5 stat tiles */}
          <div className="exp-stats">
            <div className="exp-stat exp-stat--red">
              <span className="exp-stat-label">Monthly Expenses</span>
              <span className="exp-stat-value">{formatCurrency(profitAnalysis.totalExpenses)}</span>
              <span className="exp-stat-sub">This month</span>
            </div>
            <div className="exp-stat">
              <span className="exp-stat-label">Revenue</span>
              <span className="exp-stat-value">{formatCurrency(profitAnalysis.grossRevenue)}</span>
              <span className="exp-stat-sub">Gross billed</span>
            </div>
            <div className="exp-stat">
              <span className="exp-stat-label">Commission</span>
              <span className="exp-stat-value">{formatCurrency(profitAnalysis.commissionExpense)}</span>
              <span className="exp-stat-sub">Workers</span>
            </div>
            <div className="exp-stat exp-stat--green">
              <span className="exp-stat-label">Gross Profit</span>
              <span className="exp-stat-value">{formatCurrency(profitAnalysis.grossProfit)}</span>
              <span className="exp-stat-sub">After commission</span>
            </div>
            <div className={`exp-stat${profitAnalysis.netProfit >= 0 ? ' exp-stat--green' : ' exp-stat--red'}`}>
              <span className="exp-stat-label">Net Profit</span>
              <span className="exp-stat-value">{formatCurrency(profitAnalysis.netProfit)}</span>
              <span className="exp-stat-sub">{profitAnalysis.profitMargin.toFixed(1)}% margin</span>
            </div>
          </div>

          {/* 2 content tiles */}
          <div className="exp-tiles-row">
            {/* Add expense form tile */}
            <div className="exp-tile">
              <div className="exp-tile-title">Add Expense</div>
              <form className="exp-form" onSubmit={handleAddExpense}>
                <div className="exp-form-row2">
                  <div className="exp-field">
                    <label className="exp-label" htmlFor="exp-cat">Category</label>
                    <select id="exp-cat" className="exp-select"
                      value={formData.category}
                      onChange={(e) => setFormData(p => ({ ...p, category: e.target.value as Expense['category'] }))}>
                      {Object.entries(EXPENSE_CATEGORIES).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="exp-field">
                    <label className="exp-label" htmlFor="exp-date">Date</label>
                    <input id="exp-date" type="date" className="exp-input"
                      value={formData.date}
                      onChange={(e) => {
                        const d = e.target.value;
                        setFormData(p => ({ ...p, date: d, recurringDay: p.isRecurring ? getDayFromDateString(d) : p.recurringDay }));
                      }}
                      required />
                  </div>
                </div>
                <div className="exp-field">
                  <label className="exp-label" htmlFor="exp-desc">Description</label>
                  <input id="exp-desc" type="text" className="exp-input"
                    placeholder="e.g., Electricity bill – April 2026"
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    required />
                </div>
                <div className="exp-form-row2">
                  <div className="exp-field">
                    <label className="exp-label" htmlFor="exp-amount">Amount (₹)</label>
                    <input id="exp-amount" type="number" className="exp-input"
                      placeholder="0"
                      value={formData.amount}
                      onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))}
                      required />
                  </div>
                  <div className="exp-field exp-field--checkbox">
                    <label className="exp-checkbox-label">
                      <input type="checkbox" checked={formData.isRecurring}
                        onChange={(e) => setFormData(p => ({ ...p, isRecurring: e.target.checked, recurringDay: e.target.checked ? getDayFromDateString(p.date) : p.recurringDay }))} />
                      <span>Recurring Monthly</span>
                    </label>
                    {formData.isRecurring && (
                      <input type="number" className="exp-input exp-input--small" min="1" max="28"
                        value={formData.recurringDay}
                        title="Day of month (capped at 28 for February compatibility)"
                        onChange={(e) => {
                          const d = Number.parseInt(e.target.value, 10);
                          setFormData(p => ({ ...p, recurringDay: Number.isFinite(d) ? clampRecurringDay(d) : p.recurringDay }));
                        }} />
                    )}
                  </div>
                </div>
                <div className="exp-form-footer">
                  <button type="submit" className="exp-submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : '+ Add Expense'}
                  </button>
                </div>
              </form>
            </div>

            {/* Category breakdown tile */}
            <div className="exp-tile">
              <div className="exp-tile-title">Category Breakdown — This Month</div>
              {monthMetrics.totalExpenses > 0 ? (
                <div className="exp-cat-list">
                  {Object.entries(monthMetrics.expensesByCategory)
                    .filter(([, amount]) => amount > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, amount]) => {
                      const pct = (amount / monthMetrics.totalExpenses) * 100;
                      const catBarStyle = { '--cat-bar-width': `${pct}%` } as React.CSSProperties;
                      return (
                        <div key={cat} className="exp-cat-row">
                          <span className="exp-cat-name">{EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES]?.label || cat}</span>
                          <div className="exp-cat-bar-track">
                            <div className="exp-cat-bar-fill" style={catBarStyle} />
                          </div>
                          <span className="exp-cat-amount">{formatCurrency(amount)}</span>
                          <span className="exp-cat-pct">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="exp-empty">No expenses recorded for this month</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monthly */}
      {activeTab === 'monthly' && (
        <div className="exp-tab-content">
          <div className="exp-month-nav">
            <button type="button" className="exp-month-btn" onClick={() => setSelectedMonthStr(shiftMonthStr(selectedMonthStr, -1))} aria-label="Previous month">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="exp-month-label">{formatMonthLabel(selectedMonthStr)}</span>
            <button type="button" className="exp-month-btn" onClick={() => setSelectedMonthStr(shiftMonthStr(selectedMonthStr, 1))} disabled={selectedMonthStr >= currentMonthStr} aria-label="Next month">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <MonthlyTab summary={monthSummary} projection={monthlyProjection} />
        </div>
      )}

      {/* Breakdown */}
      {activeTab === 'breakdown' && (
        <div className="exp-tab-content">
          <BreakdownTab metrics={monthMetrics} />
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div className="exp-tab-content">
          <HistoryTab expenses={expenses} onDelete={handleDeleteExpense} />
        </div>
      )}

      {/* Break-Even */}
      {activeTab === 'breakeven' && (
        <div className="exp-tab-content">
          <BreakEvenTab analysis={breakEven} />
        </div>
      )}
    </div>
  );
}

function MonthlyTab({ summary, projection }: { summary: ExpenseSummary; projection: number }) {
  return (
    <div className="exp-section">
      <div className="exp-section-title">This Month&apos;s Expenses</div>
      <div className="exp-monthly-stats">
        <div className="exp-stat">
          <span className="exp-stat-label">Total Expenses</span>
          <span className="exp-stat-value">{formatCurrency(summary.totalExpenses)}</span>
          <span className="exp-stat-sub">{summary.count} transactions</span>
        </div>
        <div className="exp-stat">
          <span className="exp-stat-label">Recurring</span>
          <span className="exp-stat-value">{formatCurrency(summary.recurring)}</span>
          <span className="exp-stat-sub">Monthly fixed costs</span>
        </div>
        <div className="exp-stat">
          <span className="exp-stat-label">Variable</span>
          <span className="exp-stat-value">{formatCurrency(summary.variable)}</span>
          <span className="exp-stat-sub">Materials and supplies</span>
        </div>
        <div className="exp-stat">
          <span className="exp-stat-label">Monthly Projection</span>
          <span className="exp-stat-value">{formatCurrency(projection)}</span>
          <span className="exp-stat-sub">Recurring + current</span>
        </div>
      </div>
      <div className="exp-section-subtitle">Category details</div>
      <div className="exp-month-cats">
        {Object.entries(summary.byCategory).filter(([, v]) => v > 0).map(([cat, amount]) => (
          <div key={cat} className="exp-month-cat-row">
            <span className="exp-month-cat-name">{EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES]?.label || cat}</span>
            <span className="exp-month-cat-val">{formatCurrency(amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownTab({ metrics }: { metrics: ExpenseMetrics }) {
  const total = metrics.totalExpenses || 1;
  return (
    <div className="exp-section">
      <div className="exp-section-title">Expense Breakdown</div>
      <div className="exp-breakdown-grid">
        {Object.entries(metrics.expensesByCategory)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, amount]) => {
            const pct = (amount / total) * 100;
            const breakdownBarStyle = { '--cat-bar-width': `${pct}%` } as React.CSSProperties;
            return (
              <div key={cat} className="exp-breakdown-card">
                <div className="exp-breakdown-header">
                  <span className="exp-breakdown-name">{EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES]?.label || cat}</span>
                  <span className="exp-breakdown-amount">{formatCurrency(amount)}</span>
                </div>
                <div className="exp-breakdown-track">
                  <div className="exp-breakdown-fill" style={breakdownBarStyle} />
                </div>
                <div className="exp-breakdown-pct">{pct.toFixed(1)}%</div>
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
    <div className="exp-section">
      <div className="exp-section-title">Expense History</div>
      <div className="exp-table-wrap">
        <table className="exp-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th className="ta-r">Amount</th>
              <th className="ta-c">Type</th>
              <th className="ta-c">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="ta-c exp-td-muted">No expenses recorded yet</td></tr>
            )}
            {sorted.map((expense) => (
              <tr key={expense.id}>
                <td>{new Date(expense.date).toLocaleDateString('en-IN')}</td>
                <td>{EXPENSE_CATEGORIES[expense.category]?.label || expense.category}</td>
                <td>{expense.description}</td>
                <td className="ta-r fw-600">{formatCurrency(expense.amount)}</td>
                <td className="ta-c">
                  <span className={`exp-badge${expense.isRecurring ? ' exp-badge--recurring' : ' exp-badge--variable'}`}>
                    {expense.isRecurring ? 'Recurring' : 'Variable'}
                  </span>
                </td>
                <td className="ta-c">
                  <button type="button" className="exp-delete-btn" onClick={() => void onDelete(expense.id)} title="Delete expense">Delete</button>
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
    <div className="exp-section">
      <div className="exp-section-title">Break-Even Analysis</div>
      <div className="exp-breakeven-stats">
        <div className="exp-stat">
          <span className="exp-stat-label">Monthly Fixed Costs</span>
          <span className="exp-stat-value">{formatCurrency(analysis.monthlyFixedCosts)}</span>
          <span className="exp-stat-sub">Salary, Rent, EB, Union</span>
        </div>
        <div className="exp-stat">
          <span className="exp-stat-label">Avg Profit / Job</span>
          <span className="exp-stat-value">{formatCurrency(analysis.profitPerJob)}</span>
          <span className="exp-stat-sub">After commission</span>
        </div>
        <div className="exp-stat exp-stat--accent">
          <span className="exp-stat-label">Jobs to Break-Even</span>
          <span className="exp-stat-value">{analysis.jobsNeededToBreakEven}</span>
          <span className="exp-stat-sub">Minimum monthly</span>
        </div>
        <div className={`exp-stat${analysis.marginOfSafety >= 20 ? ' exp-stat--green' : ' exp-stat--amber'}`}>
          <span className="exp-stat-label">Margin of Safety</span>
          <span className="exp-stat-value">{analysis.marginOfSafety.toFixed(1)}%</span>
          <span className="exp-stat-sub">{analysis.marginOfSafety >= 20 ? 'Healthy buffer' : 'Close to break-even'}</span>
        </div>
      </div>
      <div className="exp-breakeven-note">
        <p>You need at least <strong>{analysis.jobsNeededToBreakEven} jobs per month</strong> to cover all fixed expenses. Currently at <strong>{analysis.marginOfSafety.toFixed(1)}% safety margin</strong> — {analysis.marginOfSafety >= 20 ? 'in a healthy position.' : 'close to break-even.'}</p>
      </div>
    </div>
  );
}
