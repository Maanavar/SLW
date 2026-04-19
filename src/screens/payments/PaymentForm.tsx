import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { DataTable } from '@/components/ui/DataTable';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatCurrency } from '@/lib/currencyUtils';
import { getReportRange, getPaymentsInRange, getJobsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobPaidAmount } from '@/lib/jobUtils';

import type { Payment } from '@/types';
import { RecordPaymentModal } from './RecordPaymentModal';
import { PaymentEditModal } from './PaymentEditModal';
import { JobCardEditOverlay } from '@/components/job-card/JobCardEditOverlay';
import './PaymentForm.css';

type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'halfyear' | 'all';

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
  { mode: 'month',     label: 'Month' },
  { mode: 'quarter',   label: 'Quarter' },
  { mode: 'halfyear',  label: 'Half' },
  { mode: 'all',       label: 'All' },
];

function getPaymentDisplayId(row: PaymentDisplay): string {
  if (typeof row.id === 'string') return row.id;
  if (typeof row.id === 'number') return row.id < 0 ? '(auto)' : String(row.id);
  return String(row.id ?? '');
}

function formatPaymentBreakdown(row: PaymentDisplay): string {
  if (row.paymentMode !== 'Mixed') return row.paymentMode;
  const parts = [];
  if ((row as any).cashAmount)   parts.push(`Cash: ₹${(row as any).cashAmount}`);
  if ((row as any).upiAmount)    parts.push(`UPI: ₹${(row as any).upiAmount}`);
  if ((row as any).bankAmount)   parts.push(`Bank: ₹${(row as any).bankAmount}`);
  if ((row as any).chequeAmount) parts.push(`Cheque: ₹${(row as any).chequeAmount}`);
  return parts.join(', ');
}

export function PaymentForm() {
  const { payments, jobs, customers, getCustomer, deletePayment, updateJob } = useDataStore();
  const toast = useToast();

  const [reportPeriod, setReportPeriod] = useState<PeriodType>('today');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [editingCardKey, setEditingCardKey] = useState<string | null>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDisplay | null>(null);

  // ── Period range ──────────────────────────────────────────────────────────

  const reportRange = useMemo(() => {
    if (reportPeriod === 'all') return { from: undefined, to: undefined };
    return getReportRange(reportPeriod);
  }, [reportPeriod]);

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

  const filteredReportPayments = useMemo(
    () => getPaymentsInRange(payments, reportRange.from, reportRange.to),
    [payments, reportRange.from, reportRange.to]
  );

  const getCardIdFromNotes = (notes?: string) => notes?.match(/From JobCard\s+([A-Za-z0-9-]+)/i)?.[1];

  const fallbackJobPayments = useMemo(() => {
    const groups = groupJobsByCard(jobsInRange.filter(j => getJobPaidAmount(j) > 0));
    return groups.map<PaymentDisplay>(group => {
      const cardId = group.primary.jobCardId || `LEGACY-${group.primary.id}`;
      return {
        id: -Math.abs(group.primary.id),
        customerId: group.primary.customerId,
        amount: group.jobs.reduce((s, j) => s + getJobPaidAmount(j), 0),
        date: group.primary.date,
        paymentMode: (group.primary.paymentMode as Payment['paymentMode']) || 'Cash',
        notes: `From JobCard ${cardId}`,
        customerName: getCustomer(group.primary.customerId)?.name || 'Unknown',
        source: 'Job Paid Entry',
        jobCardId: cardId,
        jobCardKey: cardKeyById.get(cardId),
      };
    });
  }, [jobsInRange, getCustomer, cardKeyById]);

  const reportPayments: PaymentDisplay[] = useMemo(() => {
    const customersWithVouchers = new Set(filteredReportPayments.map(p => p.customerId));
    const vouchers = filteredReportPayments.map(p => {
      const linkedCardId = getCardIdFromNotes(p.notes);
      return {
        ...p,
        customerName: getCustomer(p.customerId)?.name || 'Unknown',
        source: 'Payment Voucher' as const,
        jobCardId: linkedCardId || '-',
        jobCardKey: linkedCardId ? cardKeyById.get(linkedCardId) : undefined,
      };
    });
    const fallbacks = fallbackJobPayments.filter(p => !customersWithVouchers.has(p.customerId));
    return [...vouchers, ...fallbacks];
  }, [filteredReportPayments, getCustomer, fallbackJobPayments, cardKeyById]);

  const filteredPayments = useMemo(() =>
    selectedCustomerId
      ? reportPayments.filter(p => p.customerId === selectedCustomerId)
      : reportPayments,
    [reportPayments, selectedCustomerId]
  );

  // ── Summary stats ─────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const total     = reportPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const count     = reportPayments.length;
    const avg       = count > 0 ? total / count : 0;
    const byCash    = reportPayments.filter(p => p.paymentMode === 'Cash').reduce((s, p) => s + p.amount, 0);
    const byUPI     = reportPayments.filter(p => p.paymentMode === 'UPI').reduce((s, p) => s + p.amount, 0);
    const byBank    = reportPayments.filter(p => p.paymentMode === 'Bank').reduce((s, p) => s + p.amount, 0);
    const byCheque  = reportPayments.filter(p => p.paymentMode === 'Cheque').reduce((s, p) => s + p.amount, 0);
    return { total, count, avg, byCash, byUPI, byBank, byCheque };
  }, [reportPayments]);

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
              onClick={() => setReportPeriod(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="pay-toolbar-sep" />

        <div className="pay-customer-select">
          <SearchableSelect<CustomerOption>
            items={customerOptions}
            value={selectedCustomerOption}
            onChange={item => setSelectedCustomerId(item.id === 0 ? null : item.id)}
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
          {
            key: 'jobCardId',
            label: 'Job Card',
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
          { key: 'customerName', label: 'Customer', sortable: true },
          { key: 'amount', label: 'Amount', render: value => formatCurrency(value as number) },
          { key: 'paymentMode', label: 'Mode', render: (_, row) => formatPaymentBreakdown(row), sortable: true },
          { key: 'source', label: 'Source', sortable: true },
          { key: 'notes', label: 'Notes' },
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
                    onClick={e => { e.stopPropagation(); handleDeletePayment(row); }}
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
