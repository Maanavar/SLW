import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { DataTable, Column } from '@/components/ui/DataTable';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { JobCardEditOverlay } from '@/components/job-card/JobCardEditOverlay';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, getReportRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobCardPaymentSummary, getJobNetValue, getJobPaidAmount } from '@/lib/jobUtils';
import type { PaymentBreakdown } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { getLocalDateString } from '@/lib/dateUtils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import '../customers/CustomersScreen.css';
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
}

const DEFAULT_EXPORT_FIELDS: ExportFields = {
  cardId: true, date: true, customer: true, workType: true,
  quantity: true, amount: true, commission: false, paid: true,
  dcNo: true, dcDate: true,
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

function computeDateRange(
  mode: PeriodMode, selectedDate: string, rangeFrom: string, rangeTo: string
): { from?: string; to?: string } {
  if (mode === 'day')   return { from: selectedDate, to: selectedDate };
  if (mode === 'all')   return { from: undefined, to: undefined };
  if (mode === 'range') return { from: rangeFrom || undefined, to: rangeTo || undefined };
  const r = getReportRange(mode as Parameters<typeof getReportRange>[0]);
  return { from: r.from, to: r.to };
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
  const [selectedDate, setSelectedDate] = useState(today);
  const [rangeFrom, setRangeFrom]     = useState('');
  const [rangeTo, setRangeTo]         = useState(today);

  // — Filter state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [paymentFilter, setPaymentFilter]           = useState<PaymentFilter>('all');
  const [viewMode, setViewMode]                     = useState<ViewMode>('table');

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
    () => computeDateRange(periodMode, selectedDate, rangeFrom, rangeTo),
    [periodMode, selectedDate, rangeFrom, rangeTo]
  );

  const periodSubtitle = useMemo(() => {
    if (periodMode === 'day')   return null;
    if (periodMode === 'all')   return 'All records';
    if (periodMode === 'range') return rangeFrom && rangeTo ? `${rangeFrom} → ${rangeTo}` : 'Pick a date range below';
    if (!rangeStart || !rangeEnd) return null;
    const year = new Date(`${rangeEnd}T00:00:00`).getFullYear();
    return `${formatShortDate(rangeStart)} – ${formatShortDate(rangeEnd)}, ${year}`;
  }, [periodMode, rangeStart, rangeEnd, rangeFrom, rangeTo]);

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

  const jobsInRange = useMemo(
    () => getJobsInRange(jobs, rangeStart, rangeEnd),
    [jobs, rangeStart, rangeEnd]
  );

  const jobsForCustomer = useMemo(
    () => selectedCustomerId ? jobsInRange.filter(j => j.customerId === selectedCustomerId) : jobsInRange,
    [jobsInRange, selectedCustomerId]
  );

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

  const summary = useMemo(() => ({
    totalCards:      rows.length,
    totalBill:       rows.reduce((s, r) => s + r.finalBill,  0),
    totalNet:        rows.reduce((s, r) => s + r.ourNet,     0),
    totalPaid:       rows.reduce((s, r) => s + r.paid,       0),
    totalPending:    rows.reduce((s, r) => s + r.pending,    0),
    totalCommission: rows.reduce((s, r) => s + r.commission, 0),
  }), [rows]);

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

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columns: Column<RecordRow>[] = [
    { key: 'date',          label: 'Date',       sortable: true },
    { key: 'jobCardId',     label: 'JobCard',    sortable: true },
    { key: 'customerName',  label: 'Customer',   sortable: true },
    { key: 'workSummary',   label: 'Works',      render: v => String(v) },
    { key: 'finalBill',     label: 'Final Bill', render: v => formatCurrency(v as number) },
    { key: 'commission',    label: 'Commission', render: v => formatCurrency(v as number) },
    { key: 'ourNet',        label: 'Our Net',    render: v => formatCurrency(v as number) },
    { key: 'paid',          label: 'Paid',       render: v => formatCurrency(v as number) },
    { key: 'pending',       label: 'Pending',    render: v => formatCurrency(v as number) },
    { key: 'paymentStatus', label: 'Status',     render: v => <StatusBadge status={v as string} /> },
  ];

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
        };
      })
    ),
    [groupedJobs, getCustomer]
  );

  function buildHeadersAndIndices() {
    const headers: string[] = [];
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
    return { headers, keys };
  }

  const handleExportCsv = () => {
    const { headers, keys } = buildHeadersAndIndices();
    const lines = [
      headers.join(','),
      ...reportRows.map(row =>
        keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(',')
      ),
    ];
    downloadText(`slw-records-${today}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const { headers, keys } = buildHeadersAndIndices();
    const headerRow = headers.map(h => `<th>${h}</th>`).join('');
    const bodyRows  = reportRows.map(row =>
      `<tr>${keys.map(k => `<td>${row[k] ?? '-'}</td>`).join('')}</tr>`
    ).join('');
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
<div class="stats">
  <div class="sc n"><span>Job Cards</span><strong>${summary.totalCards}</strong></div>
  <div class="sc"><span>Final Bill</span><strong>${formatCurrency(summary.totalBill)}</strong></div>
  <div class="sc"><span>Net Income</span><strong>${formatCurrency(summary.totalNet)}</strong></div>
  <div class="sc g"><span>Received</span><strong>${formatCurrency(summary.totalPaid)}</strong></div>
  <div class="sc r"><span>Outstanding</span><strong>${formatCurrency(summary.totalPending)}</strong></div>
</div>
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
    const text = [
      `SLW Records (${periodSubtitle ?? formatDayLabel(selectedDate)})`,
      `Job Cards: ${summary.totalCards}`,
      `Final Bill: ${formatCurrency(summary.totalBill)}`,
      `Net Income: ${formatCurrency(summary.totalNet)}`,
      `Received: ${formatCurrency(summary.totalPaid)}`,
      `Outstanding: ${formatCurrency(summary.totalPending)}`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setShowExportMenu(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="customers-screen records-screen">

      {/* ── Sticky Header ── */}
      <div className="records-header">

        {/* Row 1: Title + Actions */}
        <div className="records-header-top">
          <h2 className="screen-title">Job Records</h2>
          <div className="records-header-actions">
            {/* Export dropdown */}
            <div className="records-export-wrap" ref={exportMenuRef}>
              <button
                type="button"
                className="btn btn-secondary records-export-btn"
                onClick={() => setShowExportMenu(v => !v)}
              >
                Export
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {showExportMenu && (
                <div className="records-export-menu">
                  <button type="button" className="records-export-item" onClick={handleExportCsv}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 5h6M4 7.5h6M4 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    Export CSV
                  </button>
                  <button type="button" className="records-export-item" onClick={handleExportPdf}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 4.5h3M4 7h6M4 9.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    Export PDF
                  </button>
                  <button type="button" className="records-export-item" onClick={handleExportWhatsApp}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 7c.5 2 4 2.5 4 .5 0-1-1-1.5-2-1.5s-2-.5-2-1.5c0-2 3.5-1.5 4 .5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    Share WhatsApp
                  </button>
                  <div className="records-export-divider" />
                  <button
                    type="button"
                    className="records-export-item records-export-item--muted"
                    onClick={() => { setShowExportFields(v => !v); setShowExportMenu(false); }}
                  >
                    Configure Fields
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
              + New JobCard
            </button>
          </div>
        </div>

        {/* Row 2: Period Tabs */}
        <div className="records-period-row">
          <div className="records-period-tabs">
            {PERIOD_TABS.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                className={`records-period-tab ${periodMode === mode ? 'active' : ''}`}
                onClick={() => setPeriodMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Date context — day nav | range inputs | period subtitle */}
        {periodMode === 'day' && (
          <div className="records-day-nav">
            <div className="records-day-nav-shell">
              <button
                type="button"
                className="records-nav-btn"
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                aria-label="Previous day"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <input
                id="records-date-input"
                type="date"
                className="records-date-input"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                max={today}
                aria-label="Select date"
              />

              <button
                type="button"
                className="records-nav-btn"
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                disabled={selectedDate >= today}
                aria-label="Next day"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {!isToday && (
              <button type="button" className="records-today-btn" onClick={() => setSelectedDate(today)}>
                Today
              </button>
            )}
          </div>
        )}

        {periodMode === 'range' && (
          <div className="records-range-inputs">
            <div className="records-range-field">
              <label className="records-range-label" htmlFor="rec-from">From</label>
              <input
                id="rec-from"
                type="date"
                className="records-range-date"
                value={rangeFrom}
                onChange={e => setRangeFrom(e.target.value)}
                max={rangeTo || today}
              />
            </div>
            <svg className="records-range-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="records-range-field">
              <label className="records-range-label" htmlFor="rec-to">To</label>
              <input
                id="rec-to"
                type="date"
                className="records-range-date"
                value={rangeTo}
                onChange={e => setRangeTo(e.target.value)}
                min={rangeFrom}
                max={today}
              />
            </div>
          </div>
        )}

        {periodMode !== 'day' && periodMode !== 'range' && periodSubtitle && (
          <p className="records-period-subtitle">{periodSubtitle}</p>
        )}
      </div>

      {/* ── Filter Bar ── */}
      <div className="records-filter-bar">
        <div className="records-filter-left">
          <SearchableSelect<RecordCustomerOption>
            items={customerOptions}
            value={selectedCustomerOption}
            onChange={item => setSelectedCustomerId(item.id === 0 ? null : item.id)}
            getLabel={item => item.name}
            getKey={item => String(item.id)}
            getSearchText={item => `${item.name} ${item.shortCode || ''}`}
            placeholder="All Clients"
          />

          <div className="records-payment-filter">
            {(['all', 'paid', 'unpaid'] as PaymentFilter[]).map(f => (
              <button
                key={f}
                type="button"
                className={`records-pf-btn ${paymentFilter === f ? 'active' : ''}`}
                onClick={() => setPaymentFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : 'Unpaid'}
              </button>
            ))}
          </div>
        </div>

        <div className="records-filter-right">
          {rows.length > 0 && (
            <span className="records-count">{rows.length} card{rows.length !== 1 ? 's' : ''}</span>
          )}
          <div className="records-view-toggle">
            <button
              type="button"
              className={`records-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Card view"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="0.5" y="0.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
                <rect x="8"   y="0.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
                <rect x="0.5" y="8"   width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
                <rect x="8"   y="8"   width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
              </svg>
              Cards
            </button>
            <button
              type="button"
              className={`records-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="0.5" y="0.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
                <line x1="0.5" y1="4.5" x2="13.5" y2="4.5" stroke="currentColor" strokeWidth="1.25"/>
                <line x1="0.5" y1="8.5" x2="13.5" y2="8.5" stroke="currentColor" strokeWidth="1.25"/>
              </svg>
              Table
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Strip ── */}
      {rows.length > 0 && (
        <div className="records-summary">
          <div className="records-stat records-stat--blue">
            <span className="records-stat-label">Job Cards</span>
            <span className="records-stat-value">{summary.totalCards}</span>
          </div>
          <div
            className={`records-stat records-stat--slate${summary.totalCommission > 0 ? ' records-stat--hoverable' : ''}`}
            onMouseEnter={() => summary.totalCommission > 0 && setShowBillBreakdown(true)}
            onMouseLeave={() => setShowBillBreakdown(false)}
          >
            <span className="records-stat-label">Final Bill</span>
            <span className="records-stat-value">{formatCurrency(summary.totalBill)}</span>
            {summary.totalCommission > 0 && showBillBreakdown && (
              <div className="records-breakdown">
                <div className="breakdown-header">Bill Breakdown</div>
                <div className="breakdown-items">
                  <div className="breakdown-item">
                    <span className="breakdown-label">Net Income</span>
                    <span className="breakdown-value">{formatCurrency(summary.totalNet)}</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Commission</span>
                    <span className="breakdown-value">{formatCurrency(summary.totalCommission)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="records-stat records-stat--indigo">
            <span className="records-stat-label">Net Income</span>
            <span className="records-stat-value">{formatCurrency(summary.totalNet)}</span>
          </div>
          <div
            className={`records-stat records-stat--green${hasReceivedBreakdown ? ' records-stat--hoverable' : ''}`}
            onMouseEnter={() => hasReceivedBreakdown && setShowReceivedBreakdown(true)}
            onMouseLeave={() => setShowReceivedBreakdown(false)}
          >
            <span className="records-stat-label">Received</span>
            <span className="records-stat-value">{formatCurrency(summary.totalPaid)}</span>
            {hasReceivedBreakdown && showReceivedBreakdown && (
              <div className="records-breakdown">
                <div className="breakdown-header">Payment Breakdown</div>
                <div className="breakdown-items">
                  {(receivedBreakdown.cash    || 0) > 0 && <div className="breakdown-item"><span className="breakdown-label">Cash</span>   <span className="breakdown-value">₹{receivedBreakdown.cash!.toLocaleString('en-IN')}</span></div>}
                  {(receivedBreakdown.upi     || 0) > 0 && <div className="breakdown-item"><span className="breakdown-label">UPI</span>    <span className="breakdown-value">₹{receivedBreakdown.upi!.toLocaleString('en-IN')}</span></div>}
                  {(receivedBreakdown.bank    || 0) > 0 && <div className="breakdown-item"><span className="breakdown-label">Bank</span>   <span className="breakdown-value">₹{receivedBreakdown.bank!.toLocaleString('en-IN')}</span></div>}
                  {(receivedBreakdown.cheque  || 0) > 0 && <div className="breakdown-item"><span className="breakdown-label">Cheque</span> <span className="breakdown-value">₹{receivedBreakdown.cheque!.toLocaleString('en-IN')}</span></div>}
                </div>
              </div>
            )}
          </div>
          <div className="records-stat records-stat--red">
            <span className="records-stat-label">Outstanding</span>
            <span className="records-stat-value">{formatCurrency(summary.totalPending)}</span>
          </div>
        </div>
      )}

      {/* ── Export field selector ── */}
      {showExportFields && (
        <div className="records-export-fields">
          <div className="records-export-fields-header">
            <span>Select Export Fields</span>
            <button type="button" className="btn-text" onClick={() => setShowExportFields(false)}>Done</button>
          </div>
          <div className="records-export-fields-grid">
            {(Object.keys(exportFields) as (keyof ExportFields)[]).map(key => (
              <label key={key} className="records-field-check">
                <input
                  type="checkbox"
                  checked={exportFields[key]}
                  onChange={e => setExportFields(prev => ({ ...prev, [key]: e.target.checked }))}
                />
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="screen-content">
        {viewMode === 'cards' ? (
          rows.length > 0 ? (
            <div className="records-cards-grid">
              {rows.map(row => (
                <div
                  key={row.id}
                  className={`records-card ${getCardStatusClass(row.paymentStatus)}`}
                  onClick={() => setSelectedCardKey(row.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCardKey(row.id); } }}
                >
                  <div className="records-card-header">
                    <div className="records-card-title-group">
                      <h3 className="records-card-title">{row.customerName}</h3>
                      <div className="records-card-meta">
                        <span className="records-card-id">{row.jobCardId}</span>
                        <span className="records-card-dot" />
                        <span className="records-card-date">{row.date}</span>
                        <span className="records-card-dot" />
                        <span className="records-card-lines">{row.lineCount} line{row.lineCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <StatusBadge status={row.paymentStatus} />
                  </div>

                  {row.workSummary && (
                    <div className="records-card-tags">
                      {row.workSummary.split(', ').map(tag => (
                        <span key={tag} className="records-card-tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="records-card-financials">
                    <div className="records-card-fin">
                      <span className="records-card-fin-label">Final Bill</span>
                      <span className="records-card-fin-value">{formatCurrency(row.finalBill)}</span>
                    </div>
                    <div className="records-card-fin">
                      <span className="records-card-fin-label">Our Net</span>
                      <span className="records-card-fin-value records-card-fin-value--net">{formatCurrency(row.ourNet)}</span>
                    </div>
                    <div className="records-card-fin">
                      <span className="records-card-fin-label">Paid</span>
                      <span className="records-card-fin-value records-card-fin-value--paid">{formatCurrency(row.paid)}</span>
                    </div>
                    <div className="records-card-fin">
                      <span className="records-card-fin-label">Pending</span>
                      <span className="records-card-fin-value records-card-fin-value--pending">{formatCurrency(row.pending)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="records-empty">
              <svg className="records-empty-icon" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2"/>
                <line x1="15" y1="16" x2="33" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="15" y1="23" x2="33" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="15" y1="30" x2="24" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="records-empty-title">No job cards found</p>
              <p className="records-empty-sub">
                {periodMode === 'day' ? 'No cards for this date.' : 'Nothing matches your filters.'} Try adjusting the period or filters.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
                + New JobCard
              </button>
            </div>
          )
        ) : (
          <DataTable<RecordRow>
            columns={columns}
            data={rows}
            keyFn={item => item.id}
            sortBy="date"
            sortOrder="desc"
            onRowClick={row => setSelectedCardKey(row.id)}
            emptyMessage="No job cards found for the selected filters"
          />
        )}
      </div>

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
