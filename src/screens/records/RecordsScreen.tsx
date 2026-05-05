import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { JobCardEditOverlay } from '@/components/job-card/JobCardEditOverlay';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, groupJobsByCard } from '@/lib/reportUtils';
import {
  getJobAgentCommissionIncome,
  getJobCardPaymentSummary,
  getJobFinalBillValue,
  getJobNetValue,
  getJobPaidAmount,
  getJobWorkerCommissionExpense,
  isAgentWorkJob,
} from '@/lib/jobUtils';
import type { PaymentBreakdown } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { getLocalDateString, getTenDayRange } from '@/lib/dateUtils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { toBlob } from 'html-to-image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './RecordsScreen.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type PeriodMode = 'day' | 'week' | 'tenday' | 'month' | 'quarter' | 'halfyear' | 'year' | 'all' | 'range';
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
  billNo?: string;
  dcNo?: string;
  customerName: string;
  customerType: string;
  lineCount: number;
  workSummary: string;
  finalBill: number;
  commission: number;
  ourNet: number;
  paid: number;
  pending: number;
  paymentStatus: 'Paid' | 'Pending' | 'Partially Paid';
}

type RecordTableSortKey =
  | 'date'
  | 'card'
  | 'billNo'
  | 'dcNo'
  | 'customer'
  | 'customerType'
  | 'lines'
  | 'finalBill'
  | 'commission'
  | 'ourNet'
  | 'paid'
  | 'pending'
  | 'status';

function getRecordTrend(
  current: number,
  prev: number,
  higherIsBetter: boolean
): { arrow: string; pct: string; cls: string } | null {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return { arrow: '↑', pct: 'new', cls: higherIsBetter ? 'rec-trend-pos' : 'rec-trend-neg' };
  const pct = ((current - prev) / prev) * 100;
  if (Math.abs(pct) < 3) return { arrow: '→', pct: `${Math.abs(pct).toFixed(0)}%`, cls: 'rec-trend-neu' };
  const isUp = pct > 0;
  return {
    arrow: isUp ? '↑' : '↓',
    pct: `${Math.abs(pct).toFixed(0)}%`,
    cls: isUp === higherIsBetter ? 'rec-trend-pos' : 'rec-trend-neg',
  };
}

function RecTrendBadge({ current, prev, higher }: { current: number; prev: number; higher: boolean }) {
  const t = getRecordTrend(current, prev, higher);
  if (!t) return null;
  return <span className={`rec-trend ${t.cls}`}>{t.arrow} {t.pct}</span>;
}

const recordStatusOrder: Record<RecordRow['paymentStatus'], number> = {
  Pending: 0,
  'Partially Paid': 1,
  Paid: 2,
};

type ExportColumnKey = 'sno' | 'cardId' | 'date' | 'customer' | 'billNo' | 'workType' | 'workLines' | 'quantity' | 'amount' | 'finalBill' | 'commission' | 'netIncome' | 'paid' | 'dcNo' | 'dcDate' | 'vehicleNo';

interface ExportColumn { key: ExportColumnKey; enabled: boolean; }

const EXPORT_COLUMN_LABELS: Record<ExportColumnKey, string> = {
  sno: 'S.No',
  cardId: 'Card ID',
  date: 'Date',
  customer: 'Customer Name',
  billNo: 'Bill No',
  workType: 'Work Type',
  workLines: 'Work Done Lines',
  quantity: 'Qty',
  amount: 'Net Amount',
  finalBill: 'Final Bill',
  commission: 'Commission',
  netIncome: 'Net Income',
  paid: 'Paid',
  dcNo: 'DC No',
  dcDate: 'DC Date',
  vehicleNo: 'Vehicle No',
};

interface ExportSummaryFields {
  totalCards: boolean;
  totalBill: boolean;
  totalNet: boolean;
  totalPaid: boolean;
  totalPending: boolean;
  totalCommission: boolean;
}

const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'sno',        enabled: true  },
  { key: 'billNo',     enabled: false },
  { key: 'date',       enabled: true  },
  { key: 'dcNo',       enabled: true  },
  { key: 'dcDate',     enabled: true  },
  { key: 'vehicleNo',  enabled: true  },
  { key: 'cardId',     enabled: true  },
  { key: 'customer',   enabled: true  },
  { key: 'workType',   enabled: true  },
  { key: 'workLines',  enabled: false },
  { key: 'quantity',   enabled: true  },
  { key: 'amount',     enabled: true  },
  { key: 'finalBill',  enabled: false },
  { key: 'commission', enabled: false },
  { key: 'netIncome',  enabled: false },
  { key: 'paid',       enabled: true  },
];

const RMP_DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'sno',        enabled: true  },
  { key: 'billNo',     enabled: true  },
  { key: 'date',       enabled: true  },
  { key: 'dcNo',       enabled: true  },
  { key: 'dcDate',     enabled: false },
  { key: 'vehicleNo',  enabled: true  },
  { key: 'cardId',     enabled: false },
  { key: 'customer',   enabled: false },
  { key: 'workType',   enabled: false },
  { key: 'workLines',  enabled: false },
  { key: 'quantity',   enabled: false },
  { key: 'amount',     enabled: false },
  { key: 'finalBill',  enabled: true  },
  { key: 'commission', enabled: true  },
  { key: 'netIncome',  enabled: true  },
  { key: 'paid',       enabled: false },
];

const DEFAULT_EXPORT_SUMMARY_FIELDS: ExportSummaryFields = {
  totalCards: true,
  totalBill: true,
  totalNet: true,
  totalPaid: true,
  totalPending: true,
  totalCommission: false,
};

const RMP_DEFAULT_EXPORT_SUMMARY_FIELDS: ExportSummaryFields = {
  totalCards: true,
  totalBill: true,
  totalCommission: true,
  totalNet: true,
  totalPaid: false,
  totalPending: false,
  
};

const PERIOD_TABS: { mode: PeriodMode; label: string }[] = [
  { mode: 'day',      label: 'Day' },
  { mode: 'week',     label: 'Week' },
  { mode: 'tenday',   label: '10-Day' },
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

function formatExportDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
}

function formatReportDateCell(dateValue: unknown): string {
  if (typeof dateValue !== 'string') return '-';
  const trimmed = dateValue.trim();
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (!match) return trimmed || '-';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' });
}

function computeOffsetPeriod(
  mode: Exclude<PeriodMode, 'day' | 'all' | 'range'>,
  offset: number
): { from: string; to: string; label: string } {
  const now = new Date();
  const todayStr = getLocalDateString(now);

  if (mode === 'tenday') {
    const range = getTenDayRange(now, offset, true);
    const label = `${formatShortDate(range.from)} - ${formatShortDate(range.to)}`;
    return { from: range.from, to: range.to, label };
  }

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

const RECORDS_EXPORT_WIDTH = 1100;
const EXPORT_CANVAS_MAX_SIDE = 16384;
const EXPORT_CANVAS_MAX_AREA = 16_000_000;
const EXPORT_TARGET_PIXEL_RATIO = 1.5;

function getSafeExportPixelRatio(width: number, height: number): number {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const sideRatioLimit = Math.min(
    EXPORT_CANVAS_MAX_SIDE / safeWidth,
    EXPORT_CANVAS_MAX_SIDE / safeHeight
  );
  const areaRatioLimit = Math.sqrt(EXPORT_CANVAS_MAX_AREA / (safeWidth * safeHeight));
  const ratio = Math.min(EXPORT_TARGET_PIXEL_RATIO, sideRatioLimit, areaRatioLimit);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RecordsScreen() {
  const navigate  = useNavigate();
  const { jobs, customers, getCustomer, deleteJob } = useDataStore();
  const toast     = useToast();
  const today     = getLocalDateString(new Date());

  // — URL params (must come first so they seed other state initialisers)
  const [searchParams] = useSearchParams();

  // — Period / date state
  const [periodMode, setPeriodMode]   = useState<PeriodMode>(() =>
    searchParams.get('card') || searchParams.get('customer') ? 'all' : 'day'
  );
  const [periodOffset, setPeriodOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [rangeFrom, setRangeFrom]     = useState('');
  const [rangeTo, setRangeTo]         = useState(today);

  const handleSetPeriodMode = (mode: PeriodMode) => {
    setPeriodMode(mode);
    setPeriodOffset(0);
  };

  // — Filter state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(() => {
    const cid = searchParams.get('customer');
    return cid ? parseInt(cid, 10) || null : null;
  });
  const [paymentFilter, setPaymentFilter]           = useState<PaymentFilter>(() =>
    searchParams.get('status') === 'unpaid' ? 'unpaid' : 'all'
  );
  const [dcSearch, setDcSearch]                     = useState('');
  const [rmpHandlerFilter, setRmpHandlerFilter]     = useState<'Bhai' | 'Raja' | null>(null);
  const [viewMode, setViewMode]                     = useState<ViewMode>('table');
  const [tableSort, setTableSort]                   = useState<{ key: RecordTableSortKey; order: 'asc' | 'desc' } | null>(null);

  // — Modal state
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [editingCardKey, setEditingCardKey]   = useState<string | null>(() => {
    const card = searchParams.get('card');
    return card || null;
  });

  useEffect(() => {
    const card = searchParams.get('card');
    if (!card) return;
    setPeriodMode('all');
    setPeriodOffset(0);
    setSelectedCardKey(null);
    setEditingCardKey(card);
  }, [searchParams]);

  // — Export state
  const [showExportMenu, setShowExportMenu]     = useState(false);
  const [showExportFields, setShowExportFields] = useState(false);
  const [exportColumns, setExportColumns]       = useState<ExportColumn[]>(DEFAULT_EXPORT_COLUMNS);
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

  const [jobFlowFilter, setJobFlowFilter] = useState<'all' | 'slw_work' | 'agent_work'>('all');

  const isRmpSelected = useMemo(() => {
    if (!selectedCustomerId) return false;
    const c = customers.find(x => x.id === selectedCustomerId);
    if (!c) return false;
    return (c.shortCode || '').toLowerCase() === 'rmp' ||
           (c.name || '').toLowerCase().includes('ramani motors');
  }, [selectedCustomerId, customers]);

  const isWwSelected = useMemo(() => {
    if (!selectedCustomerId) return false;
    const c = customers.find(x => x.id === selectedCustomerId);
    if (!c) return false;
    return (c.shortCode || '').toLowerCase() === 'ww' ||
           (c.name || '').toLowerCase().includes('ramani cars');
  }, [selectedCustomerId, customers]);

  const showFlowFilter = isRmpSelected || isWwSelected;
  const useRamaniRevenueCommissionView = isRmpSelected || isWwSelected;

  const showBillNoColumn = useMemo(() => {
    if (!selectedCustomerId) return false;
    const c = customers.find((x) => x.id === selectedCustomerId);
    return Boolean(c?.hasBillNo);
  }, [selectedCustomerId, customers]);

  const showDcNoColumn = useMemo(() => {
    if (!selectedCustomerId) return false;
    const c = customers.find((x) => x.id === selectedCustomerId);
    if (!c) return false;
    const code = (c.shortCode || '').trim().toLowerCase();
    const name = (c.name || '').trim().toLowerCase();
    return code === 'rmp' || code === 'ww' || code === 'nm' || name.includes('ramani motors') || name.includes('ramani cars');
  }, [selectedCustomerId, customers]);

  useEffect(() => {
    if (isRmpSelected) {
      setExportColumns(RMP_DEFAULT_EXPORT_COLUMNS);
      setExportSummaryFields(RMP_DEFAULT_EXPORT_SUMMARY_FIELDS);
    }
  }, [isRmpSelected, selectedCustomerId]);

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
    if (showFlowFilter && jobFlowFilter !== 'all') {
      filtered = filtered.filter(j => (j.jobFlowType || 'slw_work') === jobFlowFilter);
    }
    return filtered;
  }, [jobsInRange, selectedCustomerId, isRmpSelected, rmpHandlerFilter, showFlowFilter, jobFlowFilter]);

  const groupedJobs = useMemo(() =>
    groupJobsByCard(jobsForCustomer)
      .filter(group => {
        const dcQuery = dcSearch.trim().toLowerCase();
        if (dcQuery && !group.jobs.some(job => (job.dcNo || '').toLowerCase().includes(dcQuery))) {
          return false;
        }
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
    [jobsForCustomer, paymentFilter, dcSearch]
  );

  const rows: RecordRow[] = useMemo(() =>
    groupedJobs.map(group => {
      const customer = getCustomer(group.primary.customerId);
      const customerName = customer?.name || 'Unknown';
      const customerType = customer?.type || '';
      const payment = getJobCardPaymentSummary(group.jobs);
      const commission = group.jobs.reduce((s, j) => s + getJobWorkerCommissionExpense(j), 0);
      const workSummary = [...new Set(group.jobs.map(j => j.workTypeName))].join(', ');
      const dcNumbers = [...new Set(group.jobs.map((j) => (j.dcNo || '').trim()).filter(Boolean))];
      return {
        id: group.key,
        date: group.primary.date,
        jobCardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
        billNo: group.primary.billNo || undefined,
        dcNo: dcNumbers.join(', ') || undefined,
        customerName,
        customerType,
        lineCount: group.lineCount,
        workSummary,
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
    const grossProfit     = totalNet;
    const uniqueDates = new Set(groupedJobs.flatMap(g => g.jobs.map(j => j.date)));
    const workDays = uniqueDates.size;
    const avgPerDay = workDays > 0 ? totalNet / workDays : 0;
    // Count paid job cards (cards with at least partial payment)
    const paidCards = rows.filter(r => r.paymentStatus === 'Paid' || r.paymentStatus === 'Partially Paid').length;
    return { totalCards, totalBill, totalNet, totalPaid, totalPending, totalCommission, grossProfit, workDays, avgPerDay, paidCards };
  }, [rows, groupedJobs]);
  const totalReceived = summary.totalPaid;

  const ramaniRevenueCommission = useMemo(
    () =>
      groupedJobs.reduce(
        (acc, group) => {
          group.jobs.forEach((job) => {
            if (isAgentWorkJob(job)) {
              acc.agentCommissionReceivable += getJobAgentCommissionIncome(job);
              return;
            }
            acc.slwWorkRevenue += getJobFinalBillValue(job);
          });
          return acc;
        },
        { slwWorkRevenue: 0, agentCommissionReceivable: 0 }
      ),
    [groupedJobs]
  );

  const prevSummary = useMemo(() => {
    if (periodMode === 'all' || periodMode === 'range') return null;
    let prevFrom: string | undefined;
    let prevTo: string | undefined;
    if (periodMode === 'day') {
      const d = shiftDate(selectedDate, -1);
      prevFrom = d; prevTo = d;
    } else {
      const prev = computeOffsetPeriod(periodMode, periodOffset - 1);
      prevFrom = prev.from; prevTo = prev.to;
    }
    const prevJobs = getJobsInRange(jobs, prevFrom, prevTo);
    let prevFilteredJobs = selectedCustomerId
      ? prevJobs.filter((job) => job.customerId === selectedCustomerId)
      : prevJobs;
    if (isRmpSelected && rmpHandlerFilter) {
      prevFilteredJobs = prevFilteredJobs.filter((job) => job.rmpHandler === rmpHandlerFilter);
    }
    if (showFlowFilter && jobFlowFilter !== 'all') {
      prevFilteredJobs = prevFilteredJobs.filter((job) => (job.jobFlowType || 'slw_work') === jobFlowFilter);
    }

    const prevGroups = groupJobsByCard(prevFilteredJobs)
      .filter((group) => {
        if (paymentFilter === 'all') return true;
        const status = getJobCardPaymentSummary(group.jobs).status;
        return paymentFilter === 'paid' ? status === 'Paid' : status !== 'Paid';
      });

    const prevRows = prevGroups.map((group) => {
      const payment = getJobCardPaymentSummary(group.jobs);
      const commission = group.jobs.reduce((s, j) => s + getJobWorkerCommissionExpense(j), 0);
      return { finalBill: payment.finalBill, commission, net: payment.net, paid: payment.paid };
    });
    const totalBill = prevRows.reduce((s, r) => s + r.finalBill, 0);
    const totalNet = prevRows.reduce((s, r) => s + r.net, 0);
    const prevReceived = prevRows.reduce((s, r) => s + r.paid, 0);
    const prevRamaniTotals = prevGroups.reduce(
      (acc, group) => {
        group.jobs.forEach((job) => {
          if (isAgentWorkJob(job)) {
            acc.agentCommissionReceivable += getJobAgentCommissionIncome(job);
            return;
          }
          acc.slwWorkRevenue += getJobFinalBillValue(job);
        });
        return acc;
      },
      { slwWorkRevenue: 0, agentCommissionReceivable: 0 }
    );
    return {
      totalBill,
      grossProfit: totalNet,
      totalReceived: prevReceived,
      outstanding: Math.max(0, totalBill - prevReceived),
      slwWorkRevenue: prevRamaniTotals.slwWorkRevenue,
      agentCommissionReceivable: prevRamaniTotals.agentCommissionReceivable,
    };
  }, [periodMode, periodOffset, selectedDate, jobs, selectedCustomerId, isRmpSelected, rmpHandlerFilter, showFlowFilter, jobFlowFilter, paymentFilter]);

  const sortedTableRows = useMemo(() => {
    if (!tableSort) return rows;
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base' });
    const direction = tableSort.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (tableSort.key === 'date') return a.date.localeCompare(b.date) * direction;
      if (tableSort.key === 'card') return a.jobCardId.localeCompare(b.jobCardId) * direction;
      if (tableSort.key === 'billNo') return (a.billNo || '').localeCompare(b.billNo || '') * direction;
      if (tableSort.key === 'dcNo') return (a.dcNo || '').localeCompare(b.dcNo || '') * direction;
      if (tableSort.key === 'customer') return collator.compare(a.customerName, b.customerName) * direction;
      if (tableSort.key === 'customerType') return collator.compare(a.customerType, b.customerType) * direction;
      if (tableSort.key === 'lines') return (a.lineCount - b.lineCount) * direction;
      if (tableSort.key === 'finalBill') return (a.finalBill - b.finalBill) * direction;
      if (tableSort.key === 'commission') return (a.commission - b.commission) * direction;
      if (tableSort.key === 'ourNet') return (a.ourNet - b.ourNet) * direction;
      if (tableSort.key === 'paid') return (a.paid - b.paid) * direction;
      if (tableSort.key === 'pending') return (a.pending - b.pending) * direction;
      return (recordStatusOrder[a.paymentStatus] - recordStatusOrder[b.paymentStatus]) * direction;
    });
  }, [rows, tableSort]);
  const toggleTableSort = (key: RecordTableSortKey) => {
    setTableSort((prev) =>
      prev && prev.key === key
        ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : {
            key,
            order:
              key === 'finalBill' ||
              key === 'commission' ||
              key === 'ourNet' ||
              key === 'paid' ||
              key === 'pending'
                ? 'desc'
                : 'asc',
          }
    );
  };
  const tableSortMark = (key: RecordTableSortKey) => {
    if (!tableSort || tableSort.key !== key) return '↕';
    return tableSort.order === 'asc' ? '↑' : '↓';
  };

  const receivedBreakdown = useMemo<PaymentBreakdown>(() => {
    const bd: PaymentBreakdown = { cash: 0, upi: 0, bank: 0, cheque: 0 };
    groupedJobs.forEach((group) => {
      group.jobs.forEach((job) => {
        const paid = getJobPaidAmount(job);
        if (paid <= 0) return;
        if (job.paymentMode === 'Cash') bd.cash = (bd.cash || 0) + paid;
        else if (job.paymentMode === 'UPI') bd.upi = (bd.upi || 0) + paid;
        else if (job.paymentMode === 'Bank') bd.bank = (bd.bank || 0) + paid;
        else if (job.paymentMode === 'Cheque') bd.cheque = (bd.cheque || 0) + paid;
      });
    });
    return bd;
  }, [groupedJobs]);

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
        key: 'totalCommission' as const,
        label: 'Commission',
        value: formatCurrency(summary.totalCommission),
        cssClass: summary.totalCommission > 0 ? 'r' : '',
      },
      {
        key: 'totalNet' as const,
        label: 'Our Net',
        value: formatCurrency(summary.totalNet),
        cssClass: '',
      },
      {
        key: 'totalPaid' as const,
        label: 'Received',
        value: formatCurrency(totalReceived),
        cssClass: 'g',
      },
      {
        key: 'totalPending' as const,
        label: 'Outstanding',
        value: formatCurrency(Math.max(0, summary.totalBill - totalReceived)),
        cssClass: Math.max(0, summary.totalBill - totalReceived) > 0 ? 'r' : 'g',
      },
    ],
    [summary.totalCards, summary.totalBill, summary.totalNet, summary.totalPaid, summary.totalPending, summary.totalCommission, totalReceived]
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
    groupedJobs.map(group => {
      const cust = getCustomer(group.primary.customerId);
      const payment = getJobCardPaymentSummary(group.jobs);
      const commission = group.jobs.reduce((s, j) => s + getJobWorkerCommissionExpense(j), 0);
      const workTypes = [...new Set(group.jobs.map(j => j.workTypeName))].join(', ');
      const totalQty = group.jobs.reduce((s, j) => s + (Number(j.quantity) || 0), 0);
      const totalAmount = group.jobs.reduce((s, j) => s + (Number(j.amount) || 0), 0);
      const dcNos = [...new Set(group.jobs.map(j => (j.dcNo || '').trim()).filter(Boolean))].join(', ') || '-';
      const dcDates = [...new Set(group.jobs.map(j => j.dcDate ? formatExportDate(j.dcDate) : '').filter(Boolean))].join(', ') || '-';
      const vehicleNos = [...new Set(group.jobs.map(j => (j.vehicleNo || '').trim()).filter(Boolean))].join(', ') || '-';
      const workLines = group.jobs.map(j => {
        const isSpot = j.isSpotWork || j.workMode === 'Spot';
        const dc = (j.dcNo || '').trim();
        const base = `${j.workTypeName} x${j.quantity || 1}`;
        return isSpot && dc ? `${base} (DC: ${dc})` : base;
      }).join('\n');
      return {
        cardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
        date: formatExportDate(group.primary.date),
        customer: cust?.name || 'Unknown',
        billNo: group.primary.billNo || '-',
        workType: workTypes,
        workLines,
        quantity: totalQty,
        amount: totalAmount,
        finalBill: payment.finalBill,
        commission,
        netIncome: payment.net,
        paid: payment.paid,
        dcNo: dcNos,
        dcDate: dcDates,
        vehicleNo: vehicleNos,
      };
    }),
    [groupedJobs, getCustomer]
  );

  const sortedReportRows = useMemo(() => {
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
    return [...reportRows].sort((a, b) => collator.compare(a.billNo || '', b.billNo || ''));
  }, [reportRows]);

  function buildHeadersAndIndices() {
    const headers: string[] = [];
    const keys: (keyof typeof reportRows[0])[] = [];
    let showSno = false;
    for (const col of exportColumns) {
      if (!col.enabled) continue;
      if (col.key === 'sno') { headers.push('S.No'); showSno = true; continue; }
      headers.push(EXPORT_COLUMN_LABELS[col.key]);
      keys.push(col.key as keyof typeof reportRows[0]);
    }
    return { headers, keys, showSno };
  }

  // ─── Shared report HTML builder ───────────────────────────────────────────

  const buildReportHtml = (): string => {
    const { headers, keys, showSno } = buildHeadersAndIndices();
    const rightAlign = new Set(["quantity", "amount", "finalBill", "commission", "netIncome", "paid"]);
    const periodStr = periodSubtitle ?? (periodMode === "day" ? formatDayLabel(selectedDate) : "");
    const customerLabel = selectedCustomerId && selectedCustomerOption.id !== 0
      ? selectedCustomerOption.name
      : "All Customers";
    const handlerBadge = (isRmpSelected && rmpHandlerFilter)
      ? `<span class="hdr-handler-pill">Handler: ${rmpHandlerFilter}</span>`
      : "";
    const generatedStr = new Date().toLocaleDateString("en-IN", {
      year: "numeric", month: "long", day: "numeric",
    });

    const headerCells = headers.map((h, i) => {
      const key = keys[i - (showSno ? 1 : 0)] as string | undefined;
      const isRight = key && rightAlign.has(key);
      return `<th${isRight ? " class=\"r\"" : ""}>${h}</th>`;
    }).join("");

    const bodyRows = sortedReportRows.map((row, i) =>
      `<tr>${showSno ? `<td>${i + 1}</td>` : ""}${keys.map(k => {
        let value: string;
        if (k === "date") {
          value = formatReportDateCell(row[k]);
        } else if (k === "workLines") {
          value = String(row[k] ?? "-").replace(/\n/g, "<br>");
        } else {
          value = String(row[k] ?? "-");
        }
        return `<td${rightAlign.has(k) ? " class=\"r\"" : ""}>${value}</td>`;
      }).join("")}</tr>`
    ).join("");

    const summaryHtml = selectedExportSummaryMetrics.length > 0
      ? `<div class="stats">${selectedExportSummaryMetrics
          .map(m => `<div class="sc ${m.cssClass}"><span>${m.label}</span><strong>${m.value}</strong></div>`)
          .join("")}</div>`
      : "";

    return `<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#eef0f8;padding:40px;color:#181a2c}
.wrap{background:#fff;border-radius:16px;padding:44px;max-width:1100px;margin:0 auto;box-shadow:0 2px 12px rgba(16,18,42,.09),0 0 0 1px rgba(16,18,42,.04)}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:28px;padding-bottom:20px;border-bottom:1.5px solid #c8cde2}
.hdr-brand{display:flex;align-items:center;gap:12px}
.brand-mark{width:44px;height:44px;background:#181a2c;color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;letter-spacing:.02em;flex-shrink:0}
.brand-name{font-size:15px;font-weight:700;letter-spacing:-.02em;margin:0 0 2px}
.brand-sub{font-size:11px;color:#8489a6;margin:0}
.hdr-meta{text-align:right;flex-shrink:0}
.hdr-period{font-size:20px;font-weight:750;letter-spacing:-.025em;color:#181a2c;margin:0 0 2px}
.hdr-meta-line{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin:4px 0 0}
.hdr-customer-pill{display:inline-flex;align-items:center;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:#eef7ff;border:1px solid #bfdbfe;color:#1d4ed8}
.hdr-handler-pill{display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;background:#fffbeb;border:1px solid #fcd34d;color:#b45309}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:10px;margin-bottom:20px}
.sc{background:#eef0f8;border:1px solid #d8deef;border-radius:10px;padding:10px 12px}
.sc.g{border-color:#b7e8c8}.sc.r{border-color:#f3c2c2}.sc.n{border-color:#d8deef}
.sc span{display:block;font-size:10px;color:#8489a6;text-transform:uppercase;letter-spacing:.06em;font-weight:650;margin-bottom:5px}
.sc strong{font-size:17px;font-weight:750;color:#181a2c;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
table{width:100%;border-collapse:collapse;font-size:13px}
thead{background:#eef0f8}
th{padding:9px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#535870;border-bottom:1.5px solid #c8cde2;white-space:nowrap}
th.r,td.r{text-align:right}
td{padding:9px 12px;border-bottom:1px solid #eef0f8;color:#181a2c}
tbody tr:nth-child(even) td{background:#f8f9fd}
tbody tr:last-child td{border-bottom:none}
.foot{margin-top:28px;padding-top:14px;border-top:1px solid #c8cde2;font-size:10.5px;color:#8489a6;text-align:center}
@media print{body{background:#fff;padding:0}.wrap{box-shadow:none;border-radius:0;padding:16mm 18mm;max-width:100%}}
</style>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-brand">
      <div class="brand-mark">SLW</div>
      <div>
        <p class="brand-name">SIVA LATHE WORKS</p>
        <p class="brand-sub">Job Records Report</p>
      </div>
    </div>
    <div class="hdr-meta">
      <p class="hdr-period">${periodStr}</p>
      <p class="hdr-meta-line"><span class="hdr-customer-pill">${customerLabel}</span>${handlerBadge}</p>
    </div>
  </div>
  ${summaryHtml}
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="foot">Siva Lathe Works - Job Records - ${periodStr} - Generated on ${generatedStr}</div>
</div>`;
  };

  // ─── Export PNG ────────────────────────────────────────────────────────────

  const handleExportPng = async () => {
    setShowExportMenu(false);
    try {
      const content = buildReportHtml();
      const host = document.createElement('div');
      host.style.cssText =
        `position:fixed;left:-100000px;top:0;z-index:-1;pointer-events:none;width:${RECORDS_EXPORT_WIDTH}px;background:#eef0f8;padding:40px;box-sizing:border-box;`;
      host.innerHTML = content;
      document.body.appendChild(host);

      try {
        const reportRoot = host.querySelector('.wrap');
        const exportNode =
          reportRoot instanceof HTMLElement
            ? reportRoot
            : host.firstElementChild instanceof HTMLElement
              ? host.firstElementChild
              : host;

        // Let layout and fonts settle before capture.
        await new Promise<void>((res) => requestAnimationFrame(() => res()));
        await new Promise<void>((res) => requestAnimationFrame(() => res()));

        const width = Math.ceil(exportNode.scrollWidth || exportNode.clientWidth || RECORDS_EXPORT_WIDTH);
        const height = Math.ceil(exportNode.scrollHeight || exportNode.clientHeight || 1);
        const pixelRatio = getSafeExportPixelRatio(width, height);

        const blob = await toBlob(exportNode, {
          backgroundColor: '#eef0f8',
          cacheBust: true,
          width,
          height,
          canvasWidth: width,
          canvasHeight: height,
          pixelRatio,
        });
        if (!blob) throw new Error('PNG generation failed');

        const fileName = `slw-records-${today}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.canShare?.({ files: [file] })) {
          const label = periodSubtitle ?? formatDayLabel(selectedDate);
          await navigator.share({ files: [file], title: 'SLW Records', text: `Records (${label})` });
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`Records ready — PNG downloaded, attach in WhatsApp.`)}`,
          '_blank'
        );
        toast.info('PNG Downloaded', 'Attach the image in WhatsApp.');
      } finally {
        document.body.removeChild(host);
      }
    } catch {
      toast.error('Error', 'Failed to generate PNG');
    }
  };

  const handleExportCsv = () => {
    const { headers, keys, showSno } = buildHeadersAndIndices();
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
      ...sortedReportRows.map((row, i) =>
        [...(showSno ? [`"${i + 1}"`] : []), ...keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`)]
          .join(',')
      ),
    ];
    downloadText(`slw-records-${today}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    try {
      const { headers, keys, showSno } = buildHeadersAndIndices();
      const rightAlign = new Set(['quantity', 'amount', 'finalBill', 'commission', 'netIncome', 'paid']);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 10;
      const toPdfText = (value: string) => value.replace(/\u20B9/g, 'Rs ');

      let startY = 10;
      const handlerName = rmpHandlerFilter ?? 'All';
      const preferredSummaryOrder = ['Job Cards', 'Final Bill', 'Commission', 'Our Net', 'Paid', 'Pending'];
      const selectedSummaryByLabel = new Map(
        selectedExportSummaryMetrics.map((metric) => [metric.label, metric.value] as const)
      );
      const metricRowItems = preferredSummaryOrder
        .map((label) => {
          const value = selectedSummaryByLabel.get(label);
          if (!value) return null;
          return { label, value: toPdfText(value), highlighted: false };
        })
        .filter((item): item is { label: string; value: string; highlighted: boolean } => Boolean(item));
      metricRowItems.push({ label: 'Handler', value: handlerName, highlighted: true });
      const cardGap = 2.5;
      const cardHeight = 10;
      const cardWidth = (pageW - margin * 2 - cardGap * (metricRowItems.length - 1)) / metricRowItems.length;
      const cardY = startY;

      metricRowItems.forEach((item, idx) => {
        const x = margin + idx * (cardWidth + cardGap);
        if (item.highlighted) {
          doc.setDrawColor(245, 200, 90);
          doc.setFillColor(255, 247, 208);
        } else {
          doc.setDrawColor(210, 218, 235);
          doc.setFillColor(238, 242, 251);
        }
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.8, 1.8, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.4);
        doc.setTextColor(item.highlighted ? 146 : 24, item.highlighted ? 98 : 26, item.highlighted ? 20 : 44);
        doc.text(`${item.label}: ${item.value}`, x + cardWidth / 2, cardY + 6.3, { align: 'center' });
      });

      startY = cardY + cardHeight + 4;

      const tableHeaders = headers;
      const tableBody = sortedReportRows.map((row, i) => {
        const values = keys.map((k) => {
          if (k === 'date') return formatReportDateCell(row[k]);
          const value = row[k];
          return value === null || value === undefined || value === '' ? '-' : String(value);
        });
        return showSno ? [String(i + 1), ...values] : values;
      });

      const columnStyles: Record<number, { halign: 'left' | 'right' | 'center' }> = {};
      const numericColumnIndexes = new Set<number>();
      keys.forEach((k, idx) => {
        const colIndex = showSno ? idx + 1 : idx;
        if (rightAlign.has(k)) {
          columnStyles[colIndex] = { halign: 'right' };
          numericColumnIndexes.add(colIndex);
        }
      });

      autoTable(doc, {
        startY,
        margin: { left: margin, right: margin },
        tableWidth: pageW - margin * 2,
        head: [tableHeaders],
        body: tableBody,
        styles: { fontSize: 7.8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [237, 240, 248], textColor: [24, 26, 44], fontStyle: 'bold' },
        columnStyles,
        didParseCell: (hookData) => {
          if (hookData.section === 'head' && numericColumnIndexes.has(hookData.column.index)) {
            hookData.cell.styles.halign = 'right';
          }
        },
      });

      doc.save(`slw-records-${today}.pdf`);
      toast.success('PDF Downloaded', `slw-records-${today}.pdf`);
      setShowExportMenu(false);
    } catch {
      toast.error('Error', 'Failed to generate PDF');
    }
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

  const handleSharePdfWhatsApp = async () => {
    setShowExportMenu(false);
    const content = buildReportHtml();
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SLW Records</title></head><body style="margin:0;background:#eef0f8;">${content}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const file = new File([blob], `slw-records-${today}.html`, { type: 'text/html' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'SLW Records' });
        return;
      } catch { /* fall through to download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    const lines = [`SLW Records (${periodSubtitle ?? formatDayLabel(selectedDate)})`];
    selectedExportSummaryMetrics.forEach(m => lines.push(`${m.label}: ${m.value}`));
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
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
          <div className="records-header-filters">
            <label className="records-dc-search" aria-label="Search by DC number">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="4" />
                <path d="M10 10l2.5 2.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                className="records-dc-input"
                placeholder="DC No..."
                value={dcSearch}
                onChange={e => setDcSearch(e.target.value)}
                aria-label="Search by DC number"
              />
              {dcSearch && (
                <button type="button" className="records-dc-clear" onClick={() => setDcSearch('')} aria-label="Clear DC search">
                  &times;
                </button>
              )}
            </label>

            <div className="records-customer-select">
              <SearchableSelect<RecordCustomerOption>
                items={customerOptions}
                value={selectedCustomerOption}
                onChange={item => { setSelectedCustomerId(item.id === 0 ? null : item.id); setRmpHandlerFilter(null); setJobFlowFilter('all'); }}
                getLabel={item => item.name}
                getKey={item => String(item.id)}
                getSearchText={item => `${item.name} ${item.shortCode || ''}`}
                placeholder="Search customer..."
              />
            </div>
          </div>

          <div className="records-export-wrap" ref={exportMenuRef}>
            <button type="button" className="btn btn-secondary records-export-btn" onClick={() => setShowExportMenu(v => !v)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            {showExportMenu && (
              <div className="records-export-menu">
                <div className="records-export-group-label">Download</div>
                <button type="button" className="records-export-item" onClick={handleExportCsv}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Export CSV
                </button>
                <button type="button" className="records-export-item" onClick={handleExportPdf}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  Export PDF
                </button>
                <div className="records-export-divider" />
                <div className="records-export-group-label">Share via WhatsApp</div>
                <button type="button" className="records-export-item records-export-item--green" onClick={() => void handleExportPng()}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Share as Image (PNG)
                </button>
                <button type="button" className="records-export-item" onClick={() => void handleSharePdfWhatsApp()}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.38 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  Share Report (HTML)
                </button>
                <button type="button" className="records-export-item" onClick={handleExportWhatsApp}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Send Summary (text)
                </button>
                <div className="records-export-divider" />
                <button type="button" className="records-export-item records-export-item--muted"
                  onClick={() => { setShowExportFields(v => !v); setShowExportMenu(false); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/></svg>
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

        {showFlowFilter && (
          <div className="records-payment-filter">
            {(['all', 'slw_work', 'agent_work'] as const).map(f => (
              <button key={f} type="button"
                className={`records-pf-btn${jobFlowFilter === f ? ' active' : ''}`}
                onClick={() => setJobFlowFilter(f)}>
                {f === 'all' ? 'All Work' : f === 'slw_work' ? 'SLW Work' : 'Agent Work'}
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
          <div className="records-stat records-stat--hoverable">
            <div className="records-stat-row records-stat-row--split">
              <div className="records-stat-cell">
                <span className="records-stat-label">Revenue</span>
                <span className="records-stat-value">
                  {formatCurrency(useRamaniRevenueCommissionView ? ramaniRevenueCommission.slwWorkRevenue : summary.totalBill)}
                </span>
                <span className="records-stat-sub">
                  {useRamaniRevenueCommissionView ? 'SLW work billed amount' : 'Gross billed amount'}
                  <RecTrendBadge
                    current={useRamaniRevenueCommissionView ? ramaniRevenueCommission.slwWorkRevenue : summary.totalBill}
                    prev={useRamaniRevenueCommissionView ? (prevSummary?.slwWorkRevenue ?? 0) : (prevSummary?.totalBill ?? 0)}
                    higher
                  />
                </span>
              </div>
              <div className="records-stat-cell">
                <span className="records-stat-label">
                  {useRamaniRevenueCommissionView ? 'Commission (Receive)' : 'Commission'}
                </span>
                <span className="records-stat-value">
                  {formatCurrency(useRamaniRevenueCommissionView ? ramaniRevenueCommission.agentCommissionReceivable : summary.totalCommission)}
                </span>
                <span className="records-stat-sub">
                  {useRamaniRevenueCommissionView ? 'From agent work' : 'Worker expenses'}
                </span>
              </div>
            </div>
            <div className="records-breakdown" role="tooltip">
              <div className="breakdown-header">Revenue &amp; Commission</div>
              <div className="breakdown-items">
                {useRamaniRevenueCommissionView ? (
                  <>
                    <div className="breakdown-item"><span>Revenue (SLW Work)</span><span>{formatCurrency(ramaniRevenueCommission.slwWorkRevenue)}</span></div>
                    <div className="breakdown-item"><span>Commission (We Receive)</span><span>{formatCurrency(ramaniRevenueCommission.agentCommissionReceivable)}</span></div>
                  </>
                ) : (
                  <>
                    <div className="breakdown-item"><span>Revenue (Final Bill)</span><span>{formatCurrency(summary.totalBill)}</span></div>
                    <div className="breakdown-item"><span>Commission (Workers)</span><span>−{formatCurrency(summary.totalCommission)}</span></div>
                    <div className="breakdown-item"><span>Gross Profit</span><strong>{formatCurrency(summary.grossProfit)}</strong></div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="records-stat records-stat--green records-stat--hoverable">
            <span className="records-stat-label">Gross Profit</span>
            <span className="records-stat-value">{formatCurrency(summary.grossProfit)}</span>
            <span className="records-stat-sub">
              Revenue − commission
              <RecTrendBadge current={summary.grossProfit} prev={prevSummary?.grossProfit ?? 0} higher />
            </span>
            <div className="records-breakdown" role="tooltip">
              <div className="breakdown-header">Gross Profit</div>
              <div className="breakdown-items">
                <div className="breakdown-item"><span>Revenue</span><span>{formatCurrency(summary.totalBill)}</span></div>
                <div className="breakdown-item"><span>− Commission</span><span>−{formatCurrency(summary.totalCommission)}</span></div>
                <div className="breakdown-item"><span>= Gross Profit</span><strong>{formatCurrency(summary.grossProfit)}</strong></div>
              </div>
            </div>
          </div>
          <div className="records-stat records-stat--green records-stat--hoverable">
            <span className="records-stat-label">Received</span>
            <span className="records-stat-value">{formatCurrency(totalReceived)}</span>
            <span className="records-stat-sub">
              {summary.paidCards}/{summary.totalCards} cards paid
              <RecTrendBadge current={totalReceived} prev={prevSummary?.totalReceived ?? 0} higher />
            </span>
            <div className="records-breakdown" role="tooltip">
              <div className="breakdown-header">Amount Received</div>
              <div className="breakdown-items">
                <div className="breakdown-item"><span>Cash</span><span>{formatCurrency(receivedBreakdown.cash || 0)}</span></div>
                <div className="breakdown-item"><span>UPI</span><span>{formatCurrency(receivedBreakdown.upi || 0)}</span></div>
                <div className="breakdown-item"><span>Bank</span><span>{formatCurrency(receivedBreakdown.bank || 0)}</span></div>
                <div className="breakdown-item"><span>Cheque</span><span>{formatCurrency(receivedBreakdown.cheque || 0)}</span></div>
              </div>
            </div>
          </div>
          <div className={`records-stat records-stat--hoverable${Math.max(0, summary.totalBill - totalReceived) > 0 ? ' records-stat--red' : ' records-stat--green'}`}>
            <span className="records-stat-label">Outstanding</span>
            <span className="records-stat-value">{formatCurrency(Math.max(0, summary.totalBill - totalReceived))}</span>
            <span className="records-stat-sub">
              Billed but not collected
              <RecTrendBadge current={Math.max(0, summary.totalBill - totalReceived)} prev={prevSummary?.outstanding ?? 0} higher={false} />
            </span>
            <div className="records-breakdown" role="tooltip">
              <div className="breakdown-header">Outstanding</div>
              <div className="breakdown-items">
                <div className="breakdown-item"><span>Revenue</span><span>{formatCurrency(summary.totalBill)}</span></div>
                <div className="breakdown-item"><span>− Received</span><span>−{formatCurrency(totalReceived)}</span></div>
                <div className="breakdown-item"><span>= Outstanding</span><strong>{formatCurrency(Math.max(0, summary.totalBill - totalReceived))}</strong></div>
              </div>
            </div>
          </div>
          <div className="records-stat records-stat--mode">
            <span className="records-stat-label">By mode</span>
            <div className="records-mode-grid">
              <span className="records-mode-name">Cash</span>
              <span className="records-mode-val">{formatCurrency(receivedBreakdown.cash || 0)}</span>
              <span className="records-mode-name">UPI</span>
              <span className="records-mode-val">{formatCurrency(receivedBreakdown.upi || 0)}</span>
              <span className="records-mode-name">Bank</span>
              <span className="records-mode-val">{formatCurrency(receivedBreakdown.bank || 0)}</span>
              <span className="records-mode-name">Cheque</span>
              <span className="records-mode-val">{formatCurrency(receivedBreakdown.cheque || 0)}</span>
            </div>
          </div>
        </div>
        {summary.workDays >= 1 && (
          <p className="records-avg-caption">
            Avg {formatCurrency(summary.avgPerDay)}/day · {summary.workDays} working day{summary.workDays !== 1 ? 's' : ''}
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
            <div className="records-export-col-list">
              {exportColumns.map((col, i) => (
                <div key={col.key} className="records-export-col-row">
                  <label className="records-field-check">
                    <input type="checkbox" checked={col.enabled}
                      onChange={e => setExportColumns(prev =>
                        prev.map((c, j) => j === i ? { ...c, enabled: e.target.checked } : c)
                      )} />
                    {EXPORT_COLUMN_LABELS[col.key]}
                  </label>
                  <div className="records-export-col-moves">
                    <button type="button" disabled={i === 0}
                      onClick={() => setExportColumns(prev => {
                        const next = [...prev];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        return next;
                      })}>↑</button>
                    <button type="button" disabled={i === exportColumns.length - 1}
                      onClick={() => setExportColumns(prev => {
                        const next = [...prev];
                        [next[i], next[i + 1]] = [next[i + 1], next[i]];
                        return next;
                      })}>↓</button>
                  </div>
                </div>
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
                ['totalCommission', 'Total Commission'],
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
                <th
                  className={`slw-sortable-th${tableSort?.key === 'date' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('date')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('date'); } }}
                >
                  DATE {tableSortMark('date')}
                </th>
                <th
                  className={`slw-sortable-th${tableSort?.key === 'card' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('card')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('card'); } }}
                >
                  CARD {tableSortMark('card')}
                </th>
                {showBillNoColumn && (
                  <th
                    className={`slw-sortable-th${tableSort?.key === 'billNo' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleTableSort('billNo')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('billNo'); } }}
                  >
                    BILL NO {tableSortMark('billNo')}
                  </th>
                )}
                {showDcNoColumn && (
                  <th
                    className={`slw-sortable-th${tableSort?.key === 'dcNo' ? ' is-active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleTableSort('dcNo')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('dcNo'); } }}
                  >
                    DC NO {tableSortMark('dcNo')}
                  </th>
                )}
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
                  className={`slw-sortable-th${tableSort?.key === 'customerType' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('customerType')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('customerType'); } }}
                >
                  CUSTOMER TYPE {tableSortMark('customerType')}
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
                <th
                  className={`numeric slw-sortable-th${tableSort?.key === 'commission' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('commission')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('commission'); } }}
                >
                  WORKER COMMISSION {tableSortMark('commission')}
                </th>
                <th
                  className={`numeric slw-sortable-th${tableSort?.key === 'ourNet' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('ourNet')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('ourNet'); } }}
                >
                  OUR NET {tableSortMark('ourNet')}
                </th>
                <th
                  className={`numeric slw-sortable-th${tableSort?.key === 'paid' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('paid')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('paid'); } }}
                >
                  PAID {tableSortMark('paid')}
                </th>
                <th
                  className={`numeric slw-sortable-th${tableSort?.key === 'pending' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleTableSort('pending')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTableSort('pending'); } }}
                >
                  PENDING {tableSortMark('pending')}
                </th>
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
                <tr className="rec-table-empty"><td colSpan={12 + (showBillNoColumn ? 1 : 0) + (showDcNoColumn ? 1 : 0)}>No job cards found for the selected filters.</td></tr>
              ) : sortedTableRows.map(row => {
                const cust = getCustomer(groupedJobs.find(g => g.key === row.id)?.primary.customerId ?? 0);
                const extra = row.lineCount - 1;
                const firstWork = row.workSummary.split(', ')[0] || '';
                const linesDesc = extra > 0 ? `${firstWork} +${extra}` : firstWork;
                return (
                  <tr key={row.id} className="rec-row" onClick={() => setSelectedCardKey(row.id)}
                    tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCardKey(row.id); } }}>
                    <td><span className="rec-date-cell">{formatExportDate(row.date)}</span></td>
                    <td><span className="rec-card-id">{row.jobCardId}</span></td>
                    {showBillNoColumn && <td><span className="mono">{row.billNo || '—'}</span></td>}
                    {showDcNoColumn && <td><span className="mono">{row.dcNo || '—'}</span></td>}
                    <td>
                      <div className="rec-cust-name">{row.customerName}</div>
                      {cust?.shortCode && <div className="rec-cust-code">{cust.shortCode}</div>}
                    </td>
                    <td>{row.customerType || '—'}</td>
                    <td>
                      <div className="rec-lines-count">{row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'}</div>
                      {linesDesc && <div className="rec-lines-desc">{linesDesc}</div>}
                    </td>
                    <td className="numeric">{formatCurrency(row.finalBill)}</td>
                    <td className="numeric">{row.commission > 0 ? formatCurrency(row.commission) : <span className="rec-zero">—</span>}</td>
                    <td className="numeric">{formatCurrency(row.ourNet)}</td>
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


