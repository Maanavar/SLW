import type { Workbook } from 'exceljs';
import type { Customer, Expense, Job, Payment } from '@/types';
import { getJobFinalBillValue } from '@/lib/jobUtils';

type ExcelRow = Record<string, string | number>;

async function loadExcelJs() {
  return import('exceljs');
}

function toColumnWidth(header: string): number {
  return Math.max(12, Math.min(40, header.length + 4));
}

function addSheet(workbook: Workbook, name: string, rows: ExcelRow[]) {
  const sheet = workbook.addWorksheet(name);
  if (rows.length === 0) {
    sheet.addRow(['No data']);
    return;
  }

  const headers = Object.keys(rows[0]);
  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: toColumnWidth(header),
  }));

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
}

function downloadBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function saveWorkbook(workbook: Workbook, fileName: string) {
  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  downloadBuffer(buffer, fileName);
}

export async function exportJobsToExcel(
  jobs: Job[],
  customers: Customer[],
  fileName = 'slw-jobs.xlsx'
) {
  const { Workbook } = await loadExcelJs();
  const workbook = new Workbook();
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  const rows: ExcelRow[] = jobs.map((job) => ({
    Date: job.date,
    'Card ID': job.jobCardId ?? '',
    Customer: customerMap.get(job.customerId) ?? String(job.customerId),
    'Work Type': job.workTypeName,
    Quantity: Number(job.quantity ?? 0),
    Amount: Number(getJobFinalBillValue(job)),
    Commission: Number(job.commissionAmount ?? 0),
    'Payment Status': job.paymentStatus ?? 'Pending',
    'Paid Amount': Number(job.paidAmount ?? 0),
    'Payment Mode': job.paymentMode ?? '',
    'Bill No': job.billNo ?? '',
    'DC No': job.dcNo ?? '',
  }));

  addSheet(workbook, 'Jobs', rows);
  await saveWorkbook(workbook, fileName);
}

export async function exportPaymentsToExcel(
  payments: Payment[],
  customers: Customer[],
  fileName = 'slw-payments.xlsx'
) {
  const { Workbook } = await loadExcelJs();
  const workbook = new Workbook();
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  const rows: ExcelRow[] = payments.map((payment) => ({
    Date: payment.date,
    Customer: customerMap.get(payment.customerId) ?? String(payment.customerId),
    Amount: Number(payment.amount),
    Mode: payment.paymentMode,
    Cash: Number(payment.breakdown?.cash ?? 0),
    UPI: Number(payment.breakdown?.upi ?? 0),
    Bank: Number(payment.breakdown?.bank ?? 0),
    Cheque: Number(payment.breakdown?.cheque ?? 0),
    Notes: payment.notes ?? '',
  }));

  addSheet(workbook, 'Payments', rows);
  await saveWorkbook(workbook, fileName);
}

export async function exportExpensesToExcel(expenses: Expense[], fileName = 'slw-expenses.xlsx') {
  const { Workbook } = await loadExcelJs();
  const workbook = new Workbook();

  const rows: ExcelRow[] = expenses.map((expense) => ({
    Date: expense.date,
    Category: expense.category,
    Description: expense.description,
    Amount: Number(expense.amount),
    Recurring: expense.isRecurring ? 'Yes' : 'No',
    Notes: expense.notes ?? '',
  }));

  addSheet(workbook, 'Expenses', rows);
  await saveWorkbook(workbook, fileName);
}

export async function exportFinanceSummaryToExcel(
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
  const { Workbook } = await loadExcelJs();
  const workbook = new Workbook();
  const customerMap = new Map(params.customers.map((c) => [c.id, c.name]));

  addSheet(workbook, 'Summary', [
    { Metric: 'Period', Value: params.periodLabel },
    { Metric: 'Revenue', Value: Number(params.revenue) },
    { Metric: 'Gross Profit', Value: Number(params.grossProfit) },
    { Metric: 'Total Expenses', Value: Number(params.totalExpenses) },
    { Metric: 'Net Profit', Value: Number(params.netProfit) },
    { Metric: 'Payments Received', Value: Number(params.totalReceived) },
    { Metric: 'Outstanding', Value: Number(params.outstanding) },
    { Metric: 'Collection Rate %', Value: `${params.collectionRate.toFixed(1)}%` },
  ]);

  addSheet(
    workbook,
    'Jobs',
    params.jobs.map((job) => ({
      Date: job.date,
      'Card ID': job.jobCardId ?? '',
      Customer: customerMap.get(job.customerId) ?? String(job.customerId),
      'Work Type': job.workTypeName,
      Qty: Number(job.quantity ?? 0),
      Amount: Number(getJobFinalBillValue(job)),
      Commission: Number(job.commissionAmount ?? 0),
      Status: job.paymentStatus ?? 'Pending',
    }))
  );

  addSheet(
    workbook,
    'Payments',
    params.payments.map((payment) => ({
      Date: payment.date,
      Customer: customerMap.get(payment.customerId) ?? String(payment.customerId),
      Amount: Number(payment.amount),
      Mode: payment.paymentMode,
    }))
  );

  addSheet(
    workbook,
    'Expenses',
    params.expenses.map((expense) => ({
      Date: expense.date,
      Category: expense.category,
      Description: expense.description,
      Amount: Number(expense.amount),
    }))
  );

  await saveWorkbook(workbook, fileName);
}
