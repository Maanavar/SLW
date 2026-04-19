import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { JobCardEditOverlay } from '@/components/job-card/JobCardEditOverlay';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobCardPaymentSummary, getJobNetValue, getJobPaidAmount } from '@/lib/jobUtils';
import type { PaymentBreakdown } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { getLocalDateString } from '@/lib/dateUtils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import './RecordsScreen.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type PeriodMode = 'day' | 'week' | 'month' | 'quarter' | 'halfyear' | 'year' | 'all' | 'range';
type PaymentFilter = 'all' | 'paid' | 'unpaid';
type ViewMode = 'cards' | 'table';
type RecordCustomerOption = {
  id: number;
  name: string;
  shortCode?: string;
};

interface RecordRow {
  id: string;
  date: string;
  jobCardId: string;
  customerName: string;
  lineCount: number;
  workSummary: string;
  finalBill: number;
  commission: number;
  ourNet: number;
  paid: number;
  pending: number;
  paymentStatus: 'Paid' | 'Pending' | 'Partially Paid';
}

type RecordTableSortKey = 'customer' | 'lines' | 'finalBill' | 'status';

const recordStatusOrder: Record<RecordRow['paymentStatus'], number> = {
  Pending: 0,
  'Partially Paid': 1,
  Paid: 2,
};

interface ExportFields {
  cardId: boolean;
  date: boolean;
  customer: boolean;
  workType: boolean;
  quantity: boolean;
  amount: boolean;
  commission: boolean;
  paid: boolean;
  dcNo: boolean;
  dcDate: boolean;
  vehicleNo: boolean;
}

interface ExportSummaryFields {
  totalCards: boolean;
  totalBill: boolean;
  totalNet: boolean;
  totalPaid: boolean;
  totalPending: boolean;
}

const DEFAULT_EXPORT_FIELDS: ExportFields = {
  cardId: true, date: true, customer: true, workType: true,
  quantity: true, amount: true, commission: false, paid: true,
  dcNo: true, dcDate: true, vehicleNo: true,
};

const DEFAULT_EXPORT_SUMMARY_FIELDS: ExportSummaryFields = {
  totalCards: true,
  totalBill: true,
  totalNet: true,
  totalPaid: true,
  totalPending: true,
};

const PERIOD_TABS: { mode: PeriodMode; label: string }[] = [
  { mode: 'day',      label: 'Day' },
  { mode: 'week',     label: 'Week' },
  { mode: 'month',    label: 'Month' },
  { mode: 'quarter',  label: 'Quarter' },
  { mode: 'halfyear', label: 'Half-Year' },
  { mode: 'year',     label: 'Year' },
  { mode: 'all',      label: 'All' },
  { mode: 'range',    label: 'Range' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

function formatDayLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatCardDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function computeOffsetPeriod(
  mode: Exclude<PeriodMode, 'day' | 'all' | 'range'>,
  offset: number
): { from: string; to: string; label: string } {
  const now = new Date();
  const todayStr = getLocalDateString(now);

  if (mode === 'week') {
    const dow = now.getDay();
    const daysToMon = (dow + 6) % 7;
    const wStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMon + offset * 7);
    const wEnd   = new Date(wStart.getFullYear(), wStart.getMonth(), wStart.getDate() + 6);
    const from   = getLocalDateString(wStart);
    const to     = getLocalDateString(wEnd) > todayStr ? todayStr : getLocalDateString(wEnd);
    const label  = `${formatShortDate(from)} – ${formatShortDate(to)}`;
    return { from, to, label };
  }

  if (mode === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const from   = getLocalDateString(mStart);
    const to     = getLocalDateString(mEnd) > todayStr ? todayStr : getLocalDateString(mEnd);
    const label  = mStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return { from, to, label };
  }

  if (mode === 'quarter') {
    const curQ = Math.floor(now.getMonth() / 3);
    const totalQ = curQ + offset;
    const yearOff = totalQ < 0 ? Math.floor(totalQ / 4) : Math.floor(totalQ / 4);
    const q = ((totalQ % 4) + 4) % 4;
    const yr = now.getFullYear() + yearOff;
    const qStart = new Date(yr, q * 3, 1);
    const qEnd   = new Date(yr, q * 3 + 3, 0);
    const from   = getLocalDateString(qStart);
    const to     = getLocalDateString(qEnd) > todayStr ? todayStr : getLocalDateString(qEnd);
    const label  = `Q${q + 1} ${yr}`;
    return { from, to, label };
  }

  if (mode === 'halfyear') {
    const curH = Math.floor(now.getMonth() / 6);
    const totalH = curH + offset;
    const yearOff = totalH < 0 ? Math.floor(totalH / 2) : Math.floor(totalH / 2);
    const h = ((totalH % 2) + 2) % 2;
    const yr = now.getFullYear() + yearOff;
    const hStart = new Date(yr, h * 6, 1);
    const hEnd   = new Date(yr, h * 6 + 6, 0);
    const from   = getLocalDateString(hStart);
    const to     = getLocalDateString(hEnd) > todayStr ? todayStr : getLocalDateString(hEnd);
    const label  = `H${h + 1} ${yr}`;
    return { from, to, label };
  }

  // year
  const yr = now.getFullYear() + offset;
  const yStart = new Date(yr, 0, 1);
  const yEnd   = new Date(yr, 11, 31);
  const from   = getLocalDateString(yStart);
  const to     = getLocalDateString(yEnd) > todayStr ? todayStr : getLocalDateString(yEnd);
  return { from, to, label: String(yr) };
}

function computeDateRange(
  mode: PeriodMode, selectedDate: string, rangeFrom: string, rangeTo: string, offset: number
): { from?: string; to?: string } {
  if (mode === 'day')   return { from: selectedDate, to: selectedDate };
  if (mode === 'all')   return { from: undefined, to: undefined };
  if (mode === 'range') return { from: rangeFrom || undefined, to: rangeTo || undefined };
  const { from, to } = computeOffsetPeriod(mode, offset);
  return { from, to };
}

function downloadText(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function getCardStatusClass(status: RecordRow['paymentStatus']): string {
  if (status === 'Paid')           return 'records-card--paid';
  if (status === 'Partially Paid') return 'records-card--partial';
  return 'records-card--pending';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RecordsScreen() {
  const navigate  = useNavigate();
  const { jobs, customers, getCustomer, deleteJob } = useDataStore();
  const toast     = useToast();
  const today     = getLocalDateString(new Date());

  // — Period / date state
  const [periodMode, setPeriodMode]   = useState<PeriodMode>('day');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [rangeFrom, setRangeFrom]     = useState('');
  const [rangeTo, setRangeTo]         = useState(today);

  const handleSetPeriodMode = (mode: PeriodMode) => {
    setPeriodMode(mode);
    setPeriodOffset(0);
  };

  // — Filter state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [paymentFilter, setPaymentFilter]           = useState<PaymentFilter>('all');
  const [rmpHandlerFilter, setRmpHandlerFilter]     = useState<'Bhai' | 'Raja' | null>(null);
  const [viewMode, setViewMode]                     = useState<ViewMode>('table');
  const [tableSort, setTableSort]                   = useState<{ key: RecordTableSortKey; order: 'asc' | 'desc' } | null>(null);

  // — Modal state
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [editingCardKey, setEditingCardKey]   = useState<string | null>(null);

  // — Summary hover
  const [showReceivedBreakdown, setShowReceivedBreakdown] = useState(false);
  const [showBillBreakdown, setShowBillBreakdown] = useState(false);

  // — Export state
  const [showExportMenu, setShowExportMenu]     = useState(false);
  const [showExportFields, setShowExportFields] = useState(false);
  const [exportFields, setExportFields]         = useState<ExportFields>(DEFAULT_EXPORT_FIELDS);
  const [exportSummaryFields, setExportSummaryFields] = useState<ExportSummaryFields>(
    DEFAULT_EXPORT_SUMMARY_FIELDS
  );
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  // ─── Date range ────────────────────────────────────────────────────────────

  const { from: rangeStart, to: rangeEnd } = useMemo(
    () => computeDateRange(periodMode, selectedDate, rangeFrom, rangeTo, periodOffset),
    [periodMode, selectedDate, rangeFrom, rangeTo, periodOffset]
  );

  const periodSubtitle = useMemo(() => {
    if (periodMode === 'day')   return null;
    if (periodMode === 'all')   return 'All records';
    if (periodMode === 'range') return rangeFrom && rangeTo ? `${rangeFrom} → ${rangeTo}` : 'Pick a date range below';
    return computeOffsetPeriod(periodMode, periodOffset).label;
  }, [periodMode, periodOffset, rangeFrom, rangeTo]);

  const isToday = periodMode === 'day' && selectedDate === today;

  // ─── Data ──────────────────────────────────────────────────────────────────

  const customerOptions = useMemo<RecordCustomerOption[]>(() => {
    const usageMap = new Map<number, { count: number; latestDate: string }>();

    jobs.forEach((job) => {
      const usage = usageMap.get(job.customerId) || { count: 0, latestDate: '' };
      usage.count += 1;
      if (job.date > usage.latestDate) {
        usage.latestDate = job.date;
      }
      usageMap.set(job.customerId, usage);
    });

    const sortedCustomers = customers
      .filter((customer) => customer.isActive !== false)
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        shortCode: customer.shortCode,
      }))
      .sort((a, b) => {
        const aUsage = usageMap.get(a.id);
        const bUsage = usageMap.get(b.id);
        const countDiff = (bUsage?.count || 0) - (aUsage?.count || 0);
        if (countDiff !== 0) return countDiff;

        const latestDateDiff = (bUsage?.latestDate || '').localeCompare(aUsage?.latestDate || '');
        if (latestDateDiff !== 0) return latestDateDiff;

        return a.name.localeCompare(b.name);
      });

    return [{ id: 0, name: 'All Clients' }, ...sortedCustomers];
  }, [customers, jobs]);

  const selectedCustomerOption = useMemo<RecordCustomerOption>(() => {
    const targetId = selectedCustomerId ?? 0;
    return (
      customerOptions.find((customer) => customer.id === targetId) || {
        id: 0,
        name: 'All Clients',
      }
    );
  }, [customerOptions, selectedCustomerId]);

  const isRmpSelected = useMemo(() => {
    if (!selectedCustomerId) return false;
    const c = customers.find(x => x.id === selectedCustomerId);
    if (!c) return false;
    return (c.shortCode || '').toLowerCase() === 'rmp' ||
           (c.name || '').toLowerCase().includes('ramani motors');
  }, [selectedCustomerId, customers]);

  const jobsInRange = useMemo(
    () => getJobsInRange(jobs, rangeStart, rangeEnd),
    [jobs, rangeStart, rangeEnd]
  );

  const jobsForCustomer = useMemo(() => {
    let filtered = selectedCustomerId
      ? jobsInRange.filter(j => j.customerId === selectedCustomerId)
      : jobsInRange;
    if (isRmpSelected && rmpHandlerFilter) {
      filtered = filtered.filter(j => j.rmpHandler === rmpHandlerFilter);
    }
    return filtered;
  }, [jobsInRange, selectedCustomerId, isRmpSelected, rmpHandlerFilter]);

  const groupedJobs = useMemo(() =>
    groupJobsByCard(jobsForCustomer)
      .filter(group => {
        if (paymentFilter === 'all') return true;
        const s = getJobCardPaymentSummary(group.jobs).status;
        return paymentFilter === 'paid' ? s === 'Paid' : s !== 'Paid';
      })
      .sort((a, b) => {
        if (a.primary.date !== b.primary.date) return b.primary.date.localeCompare(a.primary.date);
        const at = a.primary.createdAt ? new Date(a.primary.createdAt).getTime() : 0;
        const bt = b.primary.createdAt ? new Date(b.primary.createdAt).getTime() : 0;
        return bt - at;
      }),
    [jobsForCustomer, paymentFilter]
  );

  const rows: RecordRow[] = useMemo(() =>
    groupedJobs.map(group => {
      const customerName = getCustomer(group.primary.customerId)?.name || 'Unknown';
      const payment = getJobCardPaymentSummary(group.jobs);
      const commission = group.jobs.reduce((s, j) => s + (Number(j.commissionAmount) || 0), 0);
      const workSummary = [...new Set(group.jobs.map(j => j.workTypeName))].join(', ');
      return {
        id: group.key,
        date: group.primary.date,
        jobCardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
        customerName, lineCount: group.lineCount, workSummary,
        finalBill: payment.finalBill, commission,
        ourNet: payment.net, paid: payment.paid, pending: payment.pending,
        paymentStatus: payment.status,
      };
    }),
    [groupedJobs, getCustomer]
  );

  const summary = useMemo(() => {
    const totalCards      = rows.length;
    const totalBill       = rows.reduce((s, r) => s + r.finalBill,  0);
    const totalNet        = rows.reduce((s, r) => s + r.ourNet,     0);
    const totalPaid       = rows.reduce((s, r) => s + r.paid,       0);
    const totalPending    = rows.reduce((s, r) => s + r.pending,    0);
    const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
    const uniqueDates = new Set(groupedJobs.flatMap(g => g.jobs.map(j => j.date)));
    const workDays = uniqueDates.size;
    const avgPerDay = workDays > 0 ? totalNet / workDays : 0;
    return { totalCards, totalBill, totalNet, totalPaid, totalPending, totalCommission, workDays, avgPerDay };
  }, [rows, groupedJobs]);
  const sortedTableRows = useMemo(() => {
    if (!tableSort) return rows;
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base' });
    const direction = tableSort.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (tableSort.key === 'customer') return collator.compare(a.customerName, b.customerName) * direction;
      if (tableSort.key === 'lines') return (a.lineCount - b.lineCount) * direction;
      if (tableSort.key === 'finalBill') return (a.finalBill - b.finalBill) * direction;
      return (recordStatusOrder[a.paymentStatus] - recordStatusOrder[b.paymentStatus]) * direction;
    });
  }, [rows, tableSort]);
  const toggleTableSort = (key: RecordTableSortKey) => {
    setTableSort((prev) =>
      prev && prev.key === key
        ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key === 'finalBill' ? 'desc' : 'asc' }
    );
  };
  const tableSortMark = (key: RecordTableSortKey) => {
    if (!tableSort || tableSort.key !== key) return '↕';
    return tableSort.order === 'asc' ? '↑' : '↓';
  };

  const receivedBreakdown = useMemo<PaymentBreakdown>(() => {
    const bd: PaymentBreakdown = { cash: 0, upi: 0, bank: 0, cheque: 0 };
    groupedJobs.forEach(group => group.jobs.forEach(job => {
      const paid = getJobPaidAmount(job);
      if (paid > 0 && job.paymentMode) {
        if      (job.paymentMode === 'Cash')   bd.cash   = (bd.cash   || 0) + paid;
        else if (job.paymentMode === 'UPI')    bd.upi    = (bd.upi    || 0) + paid;
        else if (job.paymentMode === 'Bank')   bd.bank   = (bd.bank   || 0) + paid;
        else if (job.paymentMode === 'Cheque') bd.cheque = (bd.cheque || 0) + paid;
      }
    }));
    return bd;
  }, [groupedJobs]);

  const hasReceivedBreakdown = Boolean(
    receivedBreakdown.cash || receivedBreakdown.upi || receivedBreakdown.bank || receivedBreakdown.cheque
  );

  const exportSummaryMetrics = useMemo(
    () => [
      {
        key: 'totalCards' as const,
        label: 'Job Cards',
        value: String(summary.totalCards),
        cssClass: 'n',
      },
      {
        key: 'totalBill' as const,
        label: 'Final Bill',
        value: formatCurrency(summary.totalBill),
        cssClass: '',
      },
      {
        key: 'totalNet' as const,
        label: 'Net Income',
        value: formatCurrency(summary.totalNet),
        cssClass: '',
      },
      {
        key: 'totalPaid' as const,
        label: 'Received',
        value: formatCurrency(summary.totalPaid),
        cssClass: 'g',
      },
      {
        key: 'totalPending' as const,
        label: 'Outstanding',
        value: formatCurrency(summary.totalPending),
        cssClass: summary.totalPending > 0 ? 'r' : 'g',
      },
    ],
    [summary.totalCards, summary.totalBill, summary.totalNet, summary.totalPaid, summary.totalPending]
  );

  const selectedExportSummaryMetrics = useMemo(
    () => exportSummaryMetrics.filter(metric => exportSummaryFields[metric.key]),
    [exportSummaryMetrics, exportSummaryFields]
  );

  // ─── Modals ────────────────────────────────────────────────────────────────

  const selectedGroup = useMemo(
    () => groupedJobs.find(g => g.key === selectedCardKey) || null,
    [groupedJobs, selectedCardKey]
  );
  const editingGroup = useMemo(
    () => groupedJobs.find(g => g.key === editingCardKey) || null,
    [groupedJobs, editingCardKey]
  );

  const handleEditCard  = () => { if (selectedGroup) setEditingCardKey(selectedGroup.key); };
  const handleDeleteCard = async () => {
    if (!selectedGroup) return;
    const cardId = selectedGroup.primary.jobCardId || `LEGACY-${selectedGroup.primary.id}`;
    if (!window.confirm(`Delete JobCard ${cardId}?\n\nThis removes ${selectedGroup.jobs.length} line(s) and cannot be undone.`)) return;
    try {
      await Promise.all(selectedGroup.jobs.map(job => deleteJob(job.id)));
      toast.success('Deleted', `JobCard ${cardId} removed`);
      setSelectedCardKey(null);
    } catch {
      toast.error('Error', 'Failed to delete job card');
    }
  };

  // columns defined inline in JSX

  // ─── Export ────────────────────────────────────────────────────────────────

  const reportRows = useMemo(() =>
    groupedJobs.flatMap(group =>
      group.jobs.map(job => {
        const cust = getCustomer(job.customerId);
        return {
          cardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
          date: job.date, customer: cust?.name || 'Unknown',
          workType: job.workTypeName, quantity: job.quantity,
          amount: getJobNetValue(job), commission: job.commissionAmount || 0,
          paid: getJobPaidAmount(job), dcNo: job.dcNo || '-', dcDate: job.dcDate || '-',
          vehicleNo: job.vehicleNo || '-',
        };
      })
    ),
    [groupedJobs, getCustomer]
  );

  function buildHeadersAndIndices() {
    const headers: string[] = ['S.No'];
    const keys: (keyof typeof reportRows[0])[] = [];
    if (exportFields.cardId)    { headers.push('Card ID');    keys.push('cardId'); }
    if (exportFields.date)      { headers.push('Date');       keys.push('date'); }
    if (exportFields.customer)  { headers.push('Customer');   keys.push('customer'); }
    if (exportFields.workType)  { headers.push('Work Type');  keys.push('workType'); }
    if (exportFields.quantity)  { headers.push('Qty');        keys.push('quantity'); }
    if (exportFields.amount)    { headers.push('Net Amount'); keys.push('amount'); }
    if (exportFields.commission){ headers.push('Commission'); keys.push('commission'); }
    if (exportFields.paid)      { headers.push('Paid');       keys.push('paid'); }
    if (exportFields.dcNo)      { headers.push('DC No');      keys.push('dcNo'); }
    if (exportFields.dcDate)    { headers.push('DC Date');    keys.push('dcDate'); }
    if (exportFields.vehicleNo) { headers.push('Vehicle No'); keys.push('vehicleNo'); }
    return { headers, keys };
  }

  const handleExportCsv = () => {
    const { headers, keys } = buildHeadersAndIndices();
    const summaryLines =
      selectedExportSummaryMetrics.length > 0
        ? [
            '"Summary Metric","Value"',
            ...selectedExportSummaryMetrics.map(
              metric => `"${metric.label.replace(/"/g, '""')}","${metric.value.replace(/"/g, '""')}"`
            ),
            '',
          ]
        : [];

    const lines = [
      ...summaryLines,
      headers.join(','),
      ...reportRows.map((row, i) =>
        [`"${i + 1}"`, ...keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(',')].join(',')
      ),
    ];
    downloadText(`slw-records-${today}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const { headers, keys } = buildHeadersAndIndices();
    const headerRow = headers.map(h => `<th>${h}</th>`).join('');
    const bodyRows  = reportRows.map((row, i) =>
      `<tr><td>${i + 1}</td>${keys.map(k => `<td>${row[k] ?? '-'}</td>`).join('')}</tr>`
    ).join('');
    const summaryGridHtml =
      selectedExportSummaryMetrics.length > 0
        ? `<div class="stats">${selectedExportSummaryMetrics
            .map(
              metric =>
                `<div class="sc ${metric.cssClass}"><span>${metric.label}</span><strong>${metric.value}</strong></div>`
            )
            .join('')}</div>`
        : '';
    const periodStr = periodSubtitle ?? (periodMode === 'day' ? formatDayLabel(selectedDate) : '');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Siva Lathe Works – Job Records</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:40px;color:#1d1d1f}
  .wrap{background:#fff;border-radius:12px;padding:40px;max-width:1200px;margin:0 auto;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .hdr{margin-bottom:32px;border-bottom:1px solid #e5e5e7;padding-bottom:20px}
  h1{font-size:28px;font-weight:600;margin-bottom:6px}
  .sub{font-size:13px;color:#86868b}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px}
  .sc{background:#f5f5f7;border-radius:8px;padding:14px;border-left:3px solid #0071e3}
  .sc.g{border-left-color:#34c759}.sc.r{border-left-color:#ff3b30}.sc.n{border-left-color:#a2a2a7}
  .sc span{display:block;font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:4px}
  .sc strong{font-size:18px;font-weight:600;color:#1d1d1f;font-family:'Courier New',monospace}
  table{width:100%;border-collapse:collapse}
  thead{background:#f5f5f7;border-bottom:2px solid #e5e5e7}
  th{padding:11px;text-align:left;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
  td{padding:11px;border-bottom:1px solid #e5e5e7;font-size:13px}
  tbody tr:last-child td{border-bottom:none}
  .foot{margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e7;font-size:11px;color:#86868b;text-align:center}
  @media print{body{background:#fff;padding:0}.wrap{box-shadow:none;padding:0}}
</style></head><body><div class="wrap">
<div class="hdr"><h1>Siva Lathe Works</h1><p class="sub">Job Records · ${periodStr} · Generated ${new Date().toLocaleDateString('en-IN',{year:'numeric',month:'long',day:'numeric'})}</p></div>
${summaryGridHtml}
<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
<div class="foot">Generated ${new Date().toLocaleString('en-IN')} · Siva Lathe Works</div>
</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `slw-records-${today}.html`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportWhatsApp = () => {
    const lines = [`SLW Records (${periodSubtitle ?? formatDayLabel(selectedDate)})`];
    selectedExportSummaryMetrics.forEach(metric => {
      lines.push(`${metric.label}: ${metric.value}`);
    });
    const text = lines.join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setShowExportMenu(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const ChevL = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const ChevR = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div className="records-screen">

      {/* ── Page header ── */}
      <div className="records-pg-header">
        <div>
          <h1 className="records-pg-title">Records <span className="records-pg-title-ta tamil">பதிவுகள்</span></h1>
          <p className="records-pg-desc">All job cards, filterable and exportable</p>
        </div>
        <div className="records-header-actions">
          <div className="records-export-wrap" ref={exportMenuRef}>
            <button type="button" className="btn btn-secondary records-export-btn" onClick={() => setShowExportMenu(v => !v)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
            {showExportMenu && (
              <div className="records-export-menu">
                <button type="button" className="records-export-item" onClick={handleExportCsv}>Export CSV</button>
                <button type="button" className="records-export-item" onClick={handleExportPdf}>Export PDF</button>
                <button type="button" className="records-export-item" onClick={handleExportWhatsApp}>Share WhatsApp</button>
                <div className="records-export-divider" />
                <button type="button" className="records-export-item records-export-item--muted"
                  onClick={() => { setShowExportFields(v => !v); setShowExportMenu(false); }}>
                  Configure Fields
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn btn-accent" onClick={() => navigate('/')}>
            + New job card
          </button>
        </div>
      </div>

      {/* ── Unified toolbar ── */}
      <div className="records-toolbar">
        {/* Period tabs */}
        <div className="records-period-tabs">
          {PERIOD_TABS.map(({ mode, label }) => (
            <button key={mode} type="button"
              className={`records-period-tab${periodMode === mode ? ' active' : ''}`}
              onClick={() => handleSetPeriodMode(mode)}>
              {label}
            </button>
          ))}
        </div>

        {/* Day navigator (inline) */}
        {periodMode === 'day' && (
          <>
            <div className="records-day-nav-shell">
              <button type="button" className="records-nav-btn" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} aria-label="Previous day"><ChevL /></button>
              <input id="records-date-input" type="date" className="records-date-input" value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)} max={today} aria-label="Select date" title="Select date" />
              <button type="button" className="records-nav-btn" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                disabled={selectedDate >= today} aria-label="Next day"><ChevR /></button>
            </div>
            {!isToday && <button type="button" className="records-today-btn" onClick={() => setSelectedDate(today)}>Today</button>}
          </>
        )}

        {/* Period navigator (inline) */}
        {periodMode !== 'day' && periodMode !== 'range' && periodMode !== 'all' && (
          <>
            <div className="records-day-nav-shell">
              <button type="button" className="records-nav-btn" onClick={() => setPeriodOffset(o => o - 1)} aria-label="Previous period"><ChevL /></button>
              <span className="records-period-label">{periodSubtitle}</span>
              <button type="button" className="records-nav-btn" onClick={() => setPeriodOffset(o => o + 1)}
                disabled={periodOffset >= 0} aria-label="Next period"><ChevR /></button>
            </div>
            {periodOffset < 0 && <button type="button" className="records-today-btn" onClick={() => setPeriodOffset(0)}>Current</button>}
          </>
        )}

        <div className="records-toolbar-sep" />

        {/* Customer select */}
        <div className="records-customer-select">
          <SearchableSelect<RecordCustomerOption>
            items={customerOptions}
            value={selectedCustomerOption}
            onChange={item => { setSelectedCustomerId(item.id === 0 ? null : item.id); setRmpHandlerFilter(null); }}
            getLabel={item => item.name}
            getKey={item => String(item.id)}
            getSearchText={item => `${item.name} ${item.shortCode || ''}`}
            placeholder="Search customer..."
          />
        </div>

        {/* Payment filter */}
        <div className="records-payment-filter">
          {(['all', 'paid', 'unpaid'] as PaymentFilter[]).map(f => (
            <button key={f} type="button"
              className={`records-pf-btn${paymentFilter === f ? ' active' : ''}`}
              onClick={() => setPaymentFilter(f)}>
              {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : 'Unpaid'}
            </button>
          ))}
        </div>

        {isRmpSelected && (
          <div className="records-payment-filter">
            {(['all', 'Bhai', 'Raja'] as const).map(h => (
              <button key={h} type="button"
                className={`records-pf-btn${(h === 'all' ? rmpHandlerFilter === null : rmpHandlerFilter === h) ? ' active' : ''}`}
                onClick={() => setRmpHandlerFilter(h === 'all' ? null : h)}>
                {h === 'all' ? 'All' : h}
              </button>
            ))}
          </div>
        )}

        {/* Right side: count + view toggle */}
        <div className="records-toolbar-end">
          {rows.length > 0 && <span className="records-count">{rows.length} card{rows.length !== 1 ? 's' : ''}</span>}
          <div className="records-view-toggle">
            <button type="button" className={`records-view-btn${viewMode === 'cards' ? ' active' : ''}`}
              onClick={() => setViewMode('cards')} title="Card view">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="0.5" y="0.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="8" y="0.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="0.5" y="8" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="8" y="8" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              Cards
            </button>
            <button type="button" className={`records-view-btn${viewMode === 'table' ? ' active' : ''}`}
              onClick={() => setViewMode('table')} title="Table view">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="0.5" y="0.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="0.5" y1="4.5" x2="13.5" y2="4.5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="0.5" y1="8.5" x2="13.5" y2="8.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              Table
            </button>
          </div>
        </div>
      </div>

      {/* ── Range inputs (below toolbar, only for range mode) ── */}
      {periodMode === 'range' && (
        <div className="records-range-inputs">
          <div className="records-range-field">
            <label className="records-range-label" htmlFor="rec-from">From</label>
            <input id="rec-from" type="date" className="records-range-date" value={rangeFrom}
              onChange={e => setRangeFrom(e.target.value)} max={rangeTo || today} />
          </div>
          <svg className="records-range-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="records-range-field">
            <label className="records-range-label" htmlFor="rec-to">To</label>
            <input id="rec-to" type="date" className="records-range-date" value={rangeTo}
              onChange={e => setRangeTo(e.target.value)} min={rangeFrom} max={today} />
          </div>
        </div>
      )}

      {/* ── Summary stats ── */}
      {rows.length > 0 && (
        <>
        <div className="records-summary">
          <div className="records-stat">
            <span className="records-stat-label">Cards</span>
            <span className="records-stat-value">{summary.totalCards}</span>
          </div>
          <div className={`records-stat${summary.totalCommission > 0 ? ' records-stat--hoverable' : ''}`}
            onMouseEnter={() => summary.totalCommission > 0 && setShowBillBreakdown(true)}
            onMouseLeave={() => setShowBillBreakdown(false)}>
            <span className="records-stat-label">Total bill</span>
            <span className="records-stat-value">{formatCurrency(summary.totalBill)}</span>
            {summary.totalCommission > 0 && showBillBreakdown && (
              <div className="records-breakdown">
                <div className="breakdown-header">Bill breakdown</div>
                <div className="breakdown-items">
                  <div className="breakdown-item"><span className="breakdown-label">Net Income</span><span className="breakdown-value">{formatCurrency(summary.totalNet)}</span></div>
                  <div className="breakdown-item"><span className="breakdown-label">Commission</span><span className="breakdown-value">{formatCurrency(summary.totalCommission)}</span></div>
                </div>
              </div>
            )}
          </div>
          <div className="records-stat records-stat--green">
            <span className="records-stat-label">Net income</span>
            <span className="records-stat-value">{formatCurrency(summary.totalNet)}</span>
          </div>
          <div className={`records-stat${hasReceivedBreakdown ? ' records-stat--hoverable' : ''}`}
            onMouseEnter={() => hasReceivedBreakdown && setShowReceivedBreakdown(true)}
            onMouseLeave={() => setShowReceivedBreakdown(false)}>
            <span className="records-stat-label">Paid</span>
            <span className="records-stat-value">{formatCurrency(summary.totalPaid)}</span>
            {hasReceivedBreakdown && showReceivedBreakdown && (
              <div className="records-breakdown">
                <div className="breakdown-header">Payment breakdown</div>
                <div className="breakdown-items">
                  {(receivedBreakdown.cash   || 0) > 0 && <div className="breakdown-item"><span className="breakdown-label">Cash</span>  <span className="breakdown-value">{formatCurrency(receivedBreakdown.cash!)}</span></div>}
                  {(receivedBreakdown.upi    || 0) > 0 && <div className="breakdown-item"><span className="breakdown-label">UPI</span>   <span className="breakdown-value">{formatCurrency(receivedBreakdown.upi!)}</span></div>}
                  {(receivedBreakdown.bank   || 0) > 0 && <div className="breakdown-item"><span className="breakdown-label">Bank</span>  <span className="breakdown-value">{formatCurrency(receivedBreakdown.bank!)}</span></div>}
                  {(receivedBreakdown.cheque || 0) > 0 && <div className="breakdown-item"><span className="breakdown-label">Cheque</span><span className="breakdown-value">{formatCurrency(receivedBreakdown.cheque!)}</span></div>}
                </div>
              </div>
            )}
          </div>
          <div className="records-stat records-stat--red">
            <span className="records-stat-label">Pending</span>
            <span className="records-stat-value">{formatCurrency(summary.totalPending)}</span>
          </div>
        </div>
        {summary.workDays > 1 && (
          <p className="records-avg-caption">
            Avg {formatCurrency(summary.avgPerDay)}/day · {summary.workDays} working days
          </p>
        )}
        </>
      )}

      {/* ── Export field selector ── */}
      {showExportFields && (
        <div className="records-export-fields">
          <div className="records-export-fields-header">
            <span>Configure export fields</span>
            <button type="button" className="btn-text" onClick={() => setShowExportFields(false)}>Done</button>
          </div>
          <div className="records-export-fields-section">
            <p className="records-export-fields-title">Row Columns</p>
            <div className="records-export-fields-grid">
              {(Object.keys(exportFields) as (keyof ExportFields)[]).map(key => (
                <label key={key} className="records-field-check">
                  <input type="checkbox" checked={exportFields[key]}
                    onChange={e => setExportFields(prev => ({ ...prev, [key]: e.target.checked }))} />
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                </label>
              ))}
            </div>
          </div>
          <div className="records-export-fields-section">
            <p className="records-export-fields-title">Summary Metrics</p>
            <div className="records-export-fields-grid">
              {([
                ['totalCards',   'Job Cards'],
                ['totalBill',    'Final Bill'],
                ['totalNet',     'Net Income'],
                ['totalPaid',    'Received'],
                ['totalPending', 'Outstanding'],
              ] as [keyof ExportSummaryFields, string][]).map(([key, label]) => (
                <label key={key} className="records-field-check">
                  <input type="checkbox" checked={exportSummaryFields[key]}
                    onChange={e => setExportSummaryFields(prev => ({ ...prev, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {viewMode === 'cards' ? (
        rows.length > 0 ? (
          <div className="records-cards-grid">
            {rows.map(row => (
              <div key={row.id} className={`records-card ${getCardStatusClass(row.paymentStatus)}`}
                onClick={() => setSelectedCardKey(row.id)} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCardKey(row.id); } }}>
                {/* ID row + badge */}
                <div className="rc-top">
                  <span className="rc-id">{row.jobCardId}</span>
                  <StatusBadge status={row.paymentStatus} />
                </div>
                {/* Customer + meta */}
                <div className="rc-body">
                  <div className="rc-customer">{row.customerName}</div>
                  <div className="rc-meta">
                    {formatCardDate(row.date)}
                    {row.workSummary && (() => {
                      const wt = row.workSummary.split(', ').filter(Boolean);
                      return <> · {wt.length > 1 ? `${wt[0]} +${wt.length - 1}` : wt[0]}</>;
                    })()}
                  </div>
                </div>
                {/* Financial rows */}
                <div className="rc-financials">
                  <div className="rc-fin-row">
                    <span className="rc-fin-label">Final bill</span>
                    <span className="rc-fin-val">{formatCurrency(row.finalBill)}</span>
                  </div>
                  <div className="rc-fin-row">
                    <span className="rc-fin-label">Paid</span>
                    <span className="rc-fin-val rc-fin-paid">{formatCurrency(row.paid)}</span>
                  </div>
                  {row.pending > 0 && (
                    <div className="rc-fin-row">
                      <span className="rc-fin-label">Pending</span>
                      <span className="rc-fin-val rc-fin-pending">{formatCurrency(row.pending)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="records-empty">
            <svg className="records-empty-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2"/>
              <line x1="15" y1="16" x2="33" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="15" y1="23" x2="33" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="15" y1="30" x2="24" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="records-empty-title">No job cards found</p>
            <p className="records-empty-sub">{periodMode === 'day' ? 'No cards for this date.' : 'Nothing matches your filters.'} Try adjusting the period or filters.</p>
            <button type="button" className="btn btn-accent" onClick={() => navigate('/')}>+ New job card</button>
          </div>
        )
      ) : (
        <div className="records-table-wrap">
          <table className="records-table">
            <thead>
              <tr>
                <th>CARD</th>
                <th>DATE</th>
                <th
                  className={`slw-sortable-th${tableSort?.key === 'customer' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('customer')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('customer'); } }}
                >
                  CUSTOMER {tableSortMark('customer')}
                </th>
                <th
                  className={`slw-sortable-th${tableSort?.key === 'lines' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('lines')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('lines'); } }}
                >
                  LINES {tableSortMark('lines')}
                </th>
                <th
                  className={`numeric slw-sortable-th${tableSort?.key === 'finalBill' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('finalBill')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('finalBill'); } }}
                >
                  FINAL BILL {tableSortMark('finalBill')}
                </th>
                <th className="numeric">COMMISSION</th>
                <th className="numeric">PAID</th>
                <th className="numeric">PENDING</th>
                <th
                  className={`slw-sortable-th${tableSort?.key === 'status' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('status')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('status'); } }}
                >
                  STATUS {tableSortMark('status')}
                </th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sortedTableRows.length === 0 ? (
                <tr className="rec-table-empty"><td colSpan={10}>No job cards found for the selected filters.</td></tr>
              ) : sortedTableRows.map(row => {
                const cust = getCustomer(groupedJobs.find(g => g.key === row.id)?.primary.customerId ?? 0);
                const extra = row.lineCount - 1;
                const firstWork = row.workSummary.split(', ')[0] || '';
                const linesDesc = extra > 0 ? `${firstWork} +${extra}` : firstWork;
                return (
                  <tr key={row.id} className="rec-row" onClick={() => setSelectedCardKey(row.id)}
                    tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCardKey(row.id); } }}>
                    <td><span className="rec-card-id">{row.jobCardId}</span></td>
                    <td><span className="rec-date-cell">{row.date}</span></td>
                    <td>
                      <div className="rec-cust-name">{row.customerName}</div>
                      {cust?.shortCode && <div className="rec-cust-code">{cust.shortCode}</div>}
                    </td>
                    <td>
                      <div className="rec-lines-count">{row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'}</div>
                      {linesDesc && <div className="rec-lines-desc">{linesDesc}</div>}
                    </td>
                    <td className="numeric">{formatCurrency(row.finalBill)}</td>
                    <td className="numeric">{row.commission > 0 ? formatCurrency(row.commission) : <span className="rec-zero">—</span>}</td>
                    <td className={`numeric ${row.paymentStatus === 'Paid' ? 'rec-paid' : row.paymentStatus === 'Partially Paid' ? 'rec-partial' : 'rec-zero'}`}>
                      {formatCurrency(row.paid)}
                    </td>
                    <td className={`numeric ${row.pending > 0 ? 'rec-pending-val' : 'rec-zero'}`}>
                      {row.pending > 0 ? formatCurrency(row.pending) : '—'}
                    </td>
                    <td><StatusBadge status={row.paymentStatus} /></td>
                    <td>
                      <div className="rec-row-actions">
                        <button type="button" className="rec-act-btn"
                          onClick={e => { e.stopPropagation(); setSelectedCardKey(row.id); }} title="View">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      <JobCardDetailsModal
        isOpen={Boolean(selectedGroup)}
        jobs={selectedGroup?.jobs || null}
        onClose={() => setSelectedCardKey(null)}
        getCustomer={getCustomer}
        onEdit={handleEditCard}
        onDelete={handleDeleteCard}
      />
      <JobCardEditOverlay
        isOpen={Boolean(editingGroup)}
        jobs={editingGroup?.jobs || null}
        onClose={() => setEditingCardKey(null)}
        onSave={() => setEditingCardKey(null)}
      />
    </div>
  );
}
