import * as XLSX from 'xlsx';
import type { Job, Payment, Expense, Customer } from '@/types';
import { getJobFinalBillValue } from '@/lib/jobUtils';

function saveWorkbook(wb: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(wb, fileName);
}

export function exportJobsToExcel(
  jobs: Job[],
  customers: Customer[],
  fileName = 'slw-jobs.xlsx'
) {
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  const rows = jobs.map((j) => ({
    Date: j.date,
    'Card ID': j.jobCardId ?? '',
    Customer: customerMap.get(j.customerId) ?? j.customerId,
    'Work Type': j.workTypeName,
    Quantity: j.quantity,
    Amount: getJobFinalBillValue(j),
    Commission: j.commissionAmount ?? 0,
    'Payment Status': j.paymentStatus ?? 'Pending',
    'Paid Amount': j.paidAmount ?? 0,
    'Payment Mode': j.paymentMode ?? '',
    'Bill No': j.billNo ?? '',
    'DC No': j.dcNo ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Jobs');
  saveWorkbook(wb, fileName);
}

export function exportPaymentsToExcel(
  payments: Payment[],
  customers: Customer[],
  fileName = 'slw-payments.xlsx'
) {
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  const rows = payments.map((p) => ({
    Date: p.date,
    Customer: customerMap.get(p.customerId) ?? p.customerId,
    Amount: p.amount,
    Mode: p.paymentMode,
    'Cash': p.breakdown?.cash ?? '',
    'UPI': p.breakdown?.upi ?? '',
    'Bank': p.breakdown?.bank ?? '',
    'Cheque': p.breakdown?.cheque ?? '',
    Notes: p.notes ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payments');
  saveWorkbook(wb, fileName);
}

export function exportExpensesToExcel(
  expenses: Expense[],
  fileName = 'slw-expenses.xlsx'
) {
  const rows = expenses.map((e) => ({
    Date: e.date,
    Category: e.category,
    Description: e.description,
    Amount: e.amount,
    Recurring: e.isRecurring ? 'Yes' : 'No',
    Notes: e.notes ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  saveWorkbook(wb, fileName);
}

export function exportFinanceSummaryToExcel(
  params: {
    periodLabel: string;
    revenue: number;
    grossProfit: number;
    netProfit: number;
    totalExpenses: number;
    totalReceived: number;
    outstanding: number;
    collectionRate: number;
    jobs: Job[];
    payments: Payment[];
    expenses: Expense[];
    customers: Customer[];
  },
  fileName = 'slw-finance-summary.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [
    { Metric: 'Period', Value: params.periodLabel },
    { Metric: 'Revenue', Value: params.revenue },
    { Metric: 'Gross Profit', Value: params.grossProfit },
    { Metric: 'Total Expenses', Value: params.totalExpenses },
    { Metric: 'Net Profit', Value: params.netProfit },
    { Metric: 'Payments Received', Value: params.totalReceived },
    { Metric: 'Outstanding', Value: params.outstanding },
    { Metric: 'Collection Rate %', Value: `${params.collectionRate.toFixed(1)}%` },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

  // Jobs detail sheet
  const customerMap = new Map(params.customers.map((c) => [c.id, c.name]));
  const jobRows = params.jobs.map((j) => ({
    Date: j.date,
    'Card ID': j.jobCardId ?? '',
    Customer: customerMap.get(j.customerId) ?? j.customerId,
    'Work Type': j.workTypeName,
    Qty: j.quantity,
    Amount: getJobFinalBillValue(j),
    Commission: j.commissionAmount ?? 0,
    Status: j.paymentStatus ?? 'Pending',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jobRows), 'Jobs');

  // Payments detail sheet
  const pmtRows = params.payments.map((p) => ({
    Date: p.date,
    Customer: customerMap.get(p.customerId) ?? p.customerId,
    Amount: p.amount,
    Mode: p.paymentMode,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pmtRows), 'Payments');

  // Expenses detail sheet
  const expRows = params.expenses.map((e) => ({
    Date: e.date,
    Category: e.category,
    Description: e.description,
    Amount: e.amount,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows), 'Expenses');

  saveWorkbook(wb, fileName);
}
