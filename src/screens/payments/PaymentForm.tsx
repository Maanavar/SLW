import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { useToast } from '@/hooks/useToast';
import { DataTable } from '@/components/ui/DataTable';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatCurrency } from '@/lib/currencyUtils';
import { getReportRange, getJobsInRange, groupJobsByCard, getPaymentEventsInRange } from '@/lib/reportUtils';
import { getLocalDateString } from '@/lib/dateUtils';

import type { Payment } from '@/types';
import { RecordPaymentModal } from './RecordPaymentModal';
import { PaymentEditModal } from './PaymentEditModal';
import { JobCardEditOverlay } from '@/components/job-card/JobCardEditOverlay';
import './PaymentForm.css';

type PeriodType = 'today' | 'week' | 'tenday' | 'month' | 'quarter' | 'halfyear' | 'all';

interface PaymentDisplay extends Payment {
  customerName: string;
  source: 'Payment Voucher' | 'Job Paid Entry';
  jobCardId: string;
  jobCardKey?: string;
}

type CustomerOption = { id: number; name: string };

const PERIOD_TABS: { mode: PeriodType; label: string }[] = [
  { mode: 'today',     label: 'Today' },
  { mode: 'week',      label: 'Week' },
  { mode: 'tenday',    label: '10-Day' },
  { mode: 'month',     label: 'Month' },
  { mode: 'quarter',   label: 'Quarter' },
  { mode: 'halfyear',  label: 'Half' },
  { mode: 'all',       label: 'All' },
];

function getOffsetRange(period: PeriodType, offset: number): { from?: string; to?: string; label: string } {
  const now = new Date();
  const todayStr = getLocalDateString(now);

  if (period === 'all') return { from: undefined, to: undefined, label: 'All Time' };
  if (period === 'tenday') { const r = getReportRange(period); return { from: r.from, to: r.to, label: '10-Day' }; }

  if (period === 'today') {
    const d = new Date(now); d.setDate(d.getDate() + offset);
    const s = getLocalDateString(d);
    return { from: s, to: s, label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) };
  }
  if (period === 'week') {
    const dow = now.getDay();
    const wStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dow + 6) % 7 + offset * 7);
    const wEnd = new Date(wStart.getFullYear(), wStart.getMonth(), wStart.getDate() + 6);
    const from = getLocalDateString(wStart);
    const to = getLocalDateString(wEnd) > todayStr ? todayStr : getLocalDateString(wEnd);
    const s = wStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const e = new Date(`${to}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return { from, to, label: `${s} – ${e}` };
  }
  if (period === 'month') {
    let m = now.getMonth() + offset;
    const y = now.getFullYear() + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    const mStart = new Date(y, m, 1); const mEnd = new Date(y, m + 1, 0);
    const to = getLocalDateString(mEnd) > todayStr ? todayStr : getLocalDateString(mEnd);
    return { from: getLocalDateString(mStart), to, label: mStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
  }
  if (period === 'quarter') {
    let q = Math.floor(now.getMonth() / 3) + offset;
    const y = now.getFullYear() + Math.floor(q / 4);
    q = ((q % 4) + 4) % 4;
    const qStart = new Date(y, q * 3, 1); const qEnd = new Date(y, q * 3 + 3, 0);
    const to = getLocalDateString(qEnd) > todayStr ? todayStr : getLocalDateString(qEnd);
    return { from: getLocalDateString(qStart), to, label: `Q${q + 1} ${y}` };
  }
  // halfyear
  let h = Math.floor(now.getMonth() / 6) + offset;
  const y = now.getFullYear() + Math.floor(h / 2);
  h = ((h % 2) + 2) % 2;
  const hStart = new Date(y, h * 6, 1); const hEnd = new Date(y, h * 6 + 6, 0);
  const to = getLocalDateString(hEnd) > todayStr ? todayStr : getLocalDateString(hEnd);
  return { from: getLocalDateString(hStart), to, label: `H${h + 1} ${y}` };
}

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

function getPaymentDisplayId(row: PaymentDisplay): string {
  if (typeof row.id === 'string') return row.id;
  if (typeof row.id === 'number') return row.id < 0 ? '(auto)' : String(row.id);
  return String(row.id ?? '');
}

function formatPaymentBreakdown(row: PaymentDisplay): string {
  if (row.paymentMode !== 'Mixed') return row.paymentMode;
  const parts: string[] = [];
  if (row.breakdown?.cash)   parts.push(`Cash: ₹${row.breakdown.cash}`);
  if (row.breakdown?.upi)    parts.push(`UPI: ₹${row.breakdown.upi}`);
  if (row.breakdown?.bank)   parts.push(`Bank: ₹${row.breakdown.bank}`);
  if (row.breakdown?.cheque) parts.push(`Cheque: ₹${row.breakdown.cheque}`);
  return parts.length > 0 ? parts.join(', ') : 'Mixed';
}

export function PaymentForm() {
  const { payments, jobs, getCustomer, deletePayment, updateJob } = useDataStore();
  const { data: customers = [] } = useCustomersQuery();
  const toast = useToast();

  const [reportPeriod, setReportPeriod] = useState<PeriodType>('today');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [editingCardKey, setEditingCardKey] = useState<string | null>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDisplay | null>(null);

  // ── Period range ──────────────────────────────────────────────────────────

  const { from: rangeFrom, to: rangeTo, label: periodLabel } = useMemo(
    () => getOffsetRange(reportPeriod, periodOffset),
    [reportPeriod, periodOffset]
  );
  const reportRange = useMemo(() => ({ from: rangeFrom, to: rangeTo }), [rangeFrom, rangeTo]);

  const canNavigate = reportPeriod !== 'all' && reportPeriod !== 'tenday';

  // ── Customer options ──────────────────────────────────────────────────────

  const customerOptions = useMemo<CustomerOption[]>(() => {
    const usageMap = new Map<number, number>();
    jobs.forEach(j => usageMap.set(j.customerId, (usageMap.get(j.customerId) || 0) + 1));
    const sorted = customers
      .filter(c => c.isActive !== false)
      .map(c => ({ id: c.id, name: c.name }))
      .sort((a, b) => (usageMap.get(b.id) || 0) - (usageMap.get(a.id) || 0) || a.name.localeCompare(b.name));
    return [{ id: 0, name: 'All Customers' }, ...sorted];
  }, [customers, jobs]);

  const selectedCustomerOption = useMemo<CustomerOption>(
    () => customerOptions.find(c => c.id === (selectedCustomerId ?? 0)) || { id: 0, name: 'All Customers' },
    [customerOptions, selectedCustomerId]
  );

  // ── Job cards in range ────────────────────────────────────────────────────

  const jobsInRange = useMemo(
    () => getJobsInRange(jobs, reportRange.from, reportRange.to),
    [jobs, reportRange.from, reportRange.to]
  );

  const groupedJobCards = useMemo(() =>
    groupJobsByCard(jobsInRange).sort((a, b) => {
      const at = new Date(a.primary.createdAt || a.primary.date).getTime();
      const bt = new Date(b.primary.createdAt || b.primary.date).getTime();
      return bt - at;
    }),
    [jobsInRange]
  );

  const cardKeyById = useMemo(
    () => new Map(groupedJobCards.map(g => [g.primary.jobCardId || `LEGACY-${g.primary.id}`, g.key])),
    [groupedJobCards]
  );

  // ── Payments in range ─────────────────────────────────────────────────────

  const reportPayments: PaymentDisplay[] = useMemo(() => {
    const events = getPaymentEventsInRange(jobs, payments, reportRange.from, reportRange.to);
    return events.map((event, index) => ({
      id:
        event.source === 'Payment Voucher'
          ? Number.parseInt(event.id.replace(/^payment:/, ''), 10) || -(index + 1)
          : -(index + 1),
      customerId: event.customerId,
      amount: event.amount,
      date: event.date,
      paymentMode: event.paymentMode,
      breakdown: event.breakdown,
      notes: event.notes,
      customerName: getCustomer(event.customerId)?.name || 'Unknown',
      source: event.source,
      jobCardId: event.jobCardId || '-',
      jobCardKey: event.jobCardId ? cardKeyById.get(event.jobCardId) : undefined,
    }));
  }, [jobs, payments, reportRange.from, reportRange.to, getCustomer, cardKeyById]);

  const filteredPayments = useMemo(() => {
    const hasCustomerFilter = selectedCustomerId !== null && Number.isFinite(selectedCustomerId);
    if (!hasCustomerFilter) return reportPayments;
    return reportPayments.filter((p) => p.customerId === Number(selectedCustomerId));
  }, [reportPayments, selectedCustomerId]);

  // ── Summary stats ─────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const total    = filteredPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const count    = filteredPayments.length;
    const avg      = count > 0 ? total / count : 0;
    const byCash   = filteredPayments.reduce((s, p) => {
      if (p.paymentMode === 'Cash')  return s + p.amount;
      if (p.paymentMode === 'Mixed') return s + (p.breakdown?.cash || 0);
      return s;
    }, 0);
    const byUPI    = filteredPayments.reduce((s, p) => {
      if (p.paymentMode === 'UPI')   return s + p.amount;
      if (p.paymentMode === 'Mixed') return s + (p.breakdown?.upi || 0);
      return s;
    }, 0);
    const byBank   = filteredPayments.reduce((s, p) => {
      if (p.paymentMode === 'Bank')  return s + p.amount;
      if (p.paymentMode === 'Mixed') return s + (p.breakdown?.bank || 0);
      return s;
    }, 0);
    const byCheque = filteredPayments.reduce((s, p) => {
      if (p.paymentMode === 'Cheque') return s + p.amount;
      if (p.paymentMode === 'Mixed')  return s + (p.breakdown?.cheque || 0);
      return s;
    }, 0);
    return { total, count, avg, byCash, byUPI, byBank, byCheque };
  }, [filteredPayments]);

  // ── Modal state helpers ───────────────────────────────────────────────────

  const selectedGroup = useMemo(
    () => groupedJobCards.find(g => g.key === selectedCardKey) || null,
    [groupedJobCards, selectedCardKey]
  );
  const editingGroup = useMemo(
    () => groupedJobCards.find(g => g.key === editingCardKey) || null,
    [groupedJobCards, editingCardKey]
  );

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeletePayment = async (payment: PaymentDisplay) => {
    if (payment.source === 'Job Paid Entry') {
      const confirmed = window.confirm(
        `Clear payment of ${formatCurrency(payment.amount)} from job card ${payment.jobCardId}?\n\nThis will reset all lines on this card to unpaid. Cannot be undone.`
      );
      if (!confirmed) return;
      try {
        const group = groupedJobCards.find(g => g.key === payment.jobCardKey);
        const jobsToReset = group
          ? group.jobs
          : jobs.filter(j => (j.jobCardId || `LEGACY-${j.id}`) === payment.jobCardId);
        await Promise.all(jobsToReset.map(j => updateJob(j.id, { paidAmount: 0, paymentStatus: 'Pending', paymentMode: undefined })));
        toast.success('Success', 'Job card payment cleared');
      } catch {
        toast.error('Error', 'Failed to clear job payment');
      }
      return;
    }
    if (!window.confirm(`Delete payment of ${formatCurrency(payment.amount)}?\n\nThis cannot be undone.`)) return;
    try {
      await deletePayment(payment.id);
      toast.success('Success', 'Payment deleted');
    } catch {
      toast.error('Error', 'Failed to delete payment');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pay-screen">

      {/* Row 1 – Page header */}
      <div className="pay-pg-header">
        <div>
          <h1 className="records-pg-title">Payments <span className="records-pg-title-ta tamil">வரவுகள்</span></h1>
          <p className="pay-pg-desc">Collection history and payment tracking</p>
        </div>
        <button type="button" className="btn btn-accent" onClick={() => setIsRecordPaymentOpen(true)}>
          + Record Payment
        </button>
      </div>

      {/* Row 2 – Toolbar: period tabs + customer search */}
      <div className="pay-toolbar">
        <div className="pay-period-tabs">
          {PERIOD_TABS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              className={`pay-period-tab${reportPeriod === mode ? ' active' : ''}`}
              onClick={() => { setReportPeriod(mode); setPeriodOffset(0); }}
            >
              {label}
            </button>
          ))}
        </div>

        {canNavigate && (
          <>
            <div className="pay-nav-shell">
              <button type="button" className="pay-nav-btn" onClick={() => setPeriodOffset(o => o - 1)} aria-label="Previous period"><ChevL /></button>
              <span className="pay-nav-label">{periodLabel}</span>
              <button type="button" className="pay-nav-btn" onClick={() => setPeriodOffset(o => o + 1)} disabled={periodOffset >= 0} aria-label="Next period"><ChevR /></button>
            </div>
            {periodOffset < 0 && (
              <button type="button" className="pay-today-btn" onClick={() => setPeriodOffset(0)}>Current</button>
            )}
          </>
        )}

        <div className="pay-toolbar-sep" />

        <div className="pay-customer-select">
          <SearchableSelect<CustomerOption>
            items={customerOptions}
            value={selectedCustomerOption}
            onChange={(item) => {
              const id = Number(item.id);
              setSelectedCustomerId(Number.isFinite(id) && id > 0 ? id : null);
            }}
            getLabel={item => item.name}
            getKey={item => String(item.id)}
            getSearchText={item => item.name}
            placeholder="Search customer..."
          />
        </div>

        {filteredPayments.length > 0 && (
          <span className="pay-count">{filteredPayments.length} txn{filteredPayments.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Row 3 – Stat tiles */}
      <div className="pay-stats">
        <div className="pay-stat">
          <span className="pay-stat-label">Transactions</span>
          <span className="pay-stat-value">{summary.count}</span>
        </div>

        <div className="pay-stat pay-stat--green">
          <span className="pay-stat-label">Total Received</span>
          <span className="pay-stat-value">{formatCurrency(summary.total)}</span>
        </div>

        <div className="pay-stat">
          <span className="pay-stat-label">Avg / Payment</span>
          <span className="pay-stat-value">{formatCurrency(summary.avg)}</span>
        </div>

        <div className="pay-stat pay-stat--mode">
          <span className="pay-stat-label">By Mode</span>
          <div className="pay-mode-grid">
            <span className="pay-mode-name">Cash</span>
            <span className="pay-mode-name">UPI</span>
            <span className="pay-mode-name">Bank</span>
            <span className="pay-mode-name">Cheque</span>
            <span className="pay-mode-val">{formatCurrency(summary.byCash)}</span>
            <span className="pay-mode-val">{formatCurrency(summary.byUPI)}</span>
            <span className="pay-mode-val">{formatCurrency(summary.byBank)}</span>
            <span className="pay-mode-val">{formatCurrency(summary.byCheque)}</span>
          </div>
        </div>
      </div>

      {/* Row 4 – Table */}
      <DataTable<PaymentDisplay>
        columns={[
          { key: 'date', label: 'Date', sortable: true },
          { key: 'id', label: 'Payment ID', render: (_, row) => getPaymentDisplayId(row) },
          { key: 'customerName', label: 'Customer', sortable: true },
          { key: 'source', label: 'Source', sortable: true },
          {
            key: 'jobCardId',
            label: 'Job Card',
            sortable: true,
            render: (value, row) =>
              row.jobCardKey ? (
                <button
                  type="button"
                  className="pay-card-link"
                  onClick={e => { e.stopPropagation(); setSelectedCardKey(row.jobCardKey || null); }}
                >
                  {String(value)}
                </button>
              ) : String(value),
          },
          { key: 'amount', label: 'Amount', sortable: true, render: value => formatCurrency(value as number) },
          { key: 'paymentMode', label: 'Mode', render: (_, row) => formatPaymentBreakdown(row), sortable: true },
          { key: 'notes', label: 'Notes', sortable: true },
          {
            key: 'id',
            label: 'Actions',
            render: (_, row) => {
              const isJobPayment = row.source !== 'Payment Voucher';
              return (
                <div className="pay-actions">
                  <button
                    type="button"
                    className="icon-btn icon-edit"
                    title={isJobPayment ? 'Edit via job card' : 'Edit payment'}
                    aria-label="Edit"
                    onClick={e => {
                      e.stopPropagation();
                      if (isJobPayment) { if (row.jobCardKey) setSelectedCardKey(row.jobCardKey); }
                      else setSelectedPayment(row);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-delete"
                    title={isJobPayment ? 'Clear job payment' : 'Delete payment'}
                    aria-label="Delete"
                    onClick={e => { e.stopPropagation(); void handleDeletePayment(row); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              );
            },
          },
        ]}
        data={filteredPayments}
        keyFn={item => item.id}
        sortBy="date"
        sortOrder="desc"
        emptyMessage="No payments found for this period"
      />

      {/* Modals */}
      <RecordPaymentModal isOpen={isRecordPaymentOpen} onClose={() => setIsRecordPaymentOpen(false)} />

      <PaymentEditModal
        isOpen={selectedPayment !== null}
        payment={selectedPayment}
        customerName={selectedPayment?.customerName || ''}
        onClose={() => setSelectedPayment(null)}
      />

      <JobCardDetailsModal
        isOpen={Boolean(selectedGroup)}
        jobs={selectedGroup?.jobs || null}
        onClose={() => setSelectedCardKey(null)}
        getCustomer={getCustomer}
        onEdit={() => { if (selectedGroup) { setEditingCardKey(selectedGroup.key); setSelectedCardKey(null); } }}
        onDelete={undefined}
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
