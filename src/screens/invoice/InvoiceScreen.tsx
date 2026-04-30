import { useMemo, useRef, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { getJobFinalBillValue, isMahalingamCustomer } from '@/lib/jobUtils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useToast } from '@/hooks/useToast';
import { toBlob } from 'html-to-image';
import type { Customer, WorkType } from '@/types';
import './InvoiceScreen.css';

// ─── Customer group detection ─────────────────────────────────────────────────

type CustomerGroup = 'rmp' | 'ww' | 'nm' | 'default';

function getCustomerGroup(customer: Customer): CustomerGroup {
  const code = customer.shortCode.toUpperCase().trim();
  if (code === 'RMP') return 'rmp';
  if (code === 'WW') return 'ww';
  if (isMahalingamCustomer(customer)) return 'nm';
  return 'default';
}

// ─── Work type full name lookup ───────────────────────────────────────────────
// job.workTypeName = full name (what we want to display)
// job.workName     = shortCode (never use as display text)
//
// resolveWorkTypeName cross-checks against the live workTypes store so that
// any shortCode or legacy abbreviated value is expanded to the current full name.

function resolveWorkTypeName(rawName: string, workTypes: WorkType[]): string {
  if (!rawName) return '—';
  const lower = rawName.toLowerCase().trim();

  // 1. Exact match on full name (most common path)
  const byName = workTypes.find((wt) => wt.name.toLowerCase() === lower);
  if (byName) return byName.name;

  // 2. Exact match on shortCode (handles legacy entries stored as code)
  const byCode = workTypes.find((wt) => wt.shortCode.toLowerCase() === lower);
  if (byCode) return byCode.name;

  // 3. Partial prefix match — handles cases where only the first word(s) were
  //    stored (e.g. "Surface" expanding to "Surface Grinding")
  const byPrefix = workTypes.find((wt) => wt.name.toLowerCase().startsWith(lower + ' '));
  if (byPrefix) return byPrefix.name;

  // 4. Return the raw value as-is (best effort for truly unknown entries)
  return rawName;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMonthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split('-').map(Number);
  const start = `${year}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(year, m, 0).getDate();
  const end = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function getMonthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function isWpCustomer(customer: Customer | null): boolean {
  if (!customer) return false;
  const code = (customer.shortCode || '').trim().toUpperCase();
  const name = (customer.name || '').trim().toUpperCase();
  return code === 'WP' || name === 'WP' || name.startsWith('WP ');
}

function isWagenAutosCustomer(customer: Customer | null): boolean {
  if (!customer) return false;
  return (customer.name || '').trim().toLowerCase().includes('wagen autos');
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function InvoiceScreen() {
  const { customers, jobs, payments, workTypes } = useDataStore();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const today = getLocalDateString();
  const currentMonth = today.substring(0, 7);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState(today);
  const [rmpHandlerFilter, setRmpHandlerFilter] = useState<'all' | 'bhai' | 'raja'>('all');

  // Compute per-customer outstanding balance (all-time) for sort order
  const customerBalanceMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of customers) {
      const billed = jobs
        .filter((j) => j.customerId === c.id)
        .reduce((s, j) => s + getJobFinalBillValue(j), 0);
      const paid = payments
        .filter((p) => p.customerId === c.id)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      map.set(c.id, Math.max(0, billed - paid));
    }
    return map;
  }, [customers, jobs, payments]);

  // Monthly + Invoice are always shown; Party-Credit only when unpaid balance exists.
  const eligibleCustomers = useMemo(
    () =>
      customers
        .filter((c) => {
          if (!c.isActive) return false;
          if (c.type === 'Monthly' || c.type === 'Invoice') return true;
          if (c.type === 'Party-Credit') return (customerBalanceMap.get(c.id) ?? 0) > 0;
          return false;
        })
        .sort((a, b) => (customerBalanceMap.get(b.id) ?? 0) - (customerBalanceMap.get(a.id) ?? 0)),
    [customers, customerBalanceMap]
  );

  const isMonthly = selectedCustomer?.type === 'Monthly';
  const customerGroup = selectedCustomer ? getCustomerGroup(selectedCustomer) : 'default';
  const isDcGroup = customerGroup === 'rmp' || customerGroup === 'ww' || customerGroup === 'nm';
  const hidePreviousBalance = isWpCustomer(selectedCustomer) || isWagenAutosCustomer(selectedCustomer);

  const { periodStart, periodEnd } = useMemo(() => {
    if (!selectedCustomer) return { periodStart: '', periodEnd: '' };
    if (isMonthly) {
      const r = getMonthRange(selectedMonth);
      return { periodStart: r.start, periodEnd: r.end };
    }
    return { periodStart: rangeFrom, periodEnd: rangeTo };
  }, [selectedCustomer, isMonthly, selectedMonth, rangeFrom, rangeTo]);

  const customerJobs = useMemo(
    () => jobs.filter((j) => j.customerId === selectedCustomer?.id),
    [jobs, selectedCustomer]
  );

  const customerPayments = useMemo(
    () => payments.filter((p) => p.customerId === selectedCustomer?.id),
    [payments, selectedCustomer]
  );

  const periodJobs = useMemo(
    () =>
      [...customerJobs.filter((j) => {
        if (!periodStart || j.date < periodStart || j.date > periodEnd) return false;
        if (customerGroup === 'rmp' && rmpHandlerFilter !== 'all') {
          const handler = (j.rmpHandler ?? '').toLowerCase();
          if (rmpHandlerFilter === 'bhai' && handler !== 'bhai') return false;
          if (rmpHandlerFilter === 'raja' && handler !== 'raja') return false;
        }
        return true;
      })].sort(
        (a, b) => {
          const d = a.date.localeCompare(b.date);
          if (d !== 0) return d;
          return (a.billNo ?? '').localeCompare(b.billNo ?? '');
        }
      ),
    [customerJobs, periodStart, periodEnd, customerGroup, rmpHandlerFilter]
  );

  const periodPayments = useMemo(
    () => customerPayments.filter((p) => periodStart && p.date >= periodStart && p.date <= periodEnd),
    [customerPayments, periodStart, periodEnd]
  );

  // Old balance: total billed before period start minus total paid before period start
  const oldBalance = useMemo(() => {
    if (!periodStart) return 0;
    const billedBefore = customerJobs
      .filter((j) => j.date < periodStart)
      .reduce((s, j) => s + getJobFinalBillValue(j), 0);
    const paidBefore = customerPayments
      .filter((p) => p.date < periodStart)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return billedBefore - paidBefore;
  }, [customerJobs, customerPayments, periodStart]);

  const periodTotal = useMemo(
    () => periodJobs.reduce((s, j) => s + getJobFinalBillValue(j), 0),
    [periodJobs]
  );

  const paymentsReceived = useMemo(
    () => periodPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [periodPayments]
  );

  // For DC group customers, old balance isn't aggregated (invoice is per-period)
  const grossTotal = isDcGroup || hidePreviousBalance ? periodTotal : oldBalance + periodTotal;
  const balanceDue = grossTotal - paymentsReceived;

  const periodLabel = useMemo(() => {
    if (!selectedCustomer) return '';
    if (isMonthly) return getMonthLabel(selectedMonth);
    if (rangeFrom && rangeTo) return `${formatDate(rangeFrom)} – ${formatDate(rangeTo)}`;
    return '';
  }, [selectedCustomer, isMonthly, selectedMonth, rangeFrom, rangeTo]);

  const invoiceNumber = selectedCustomer
    ? `INV-${today.replace(/-/g, '')}-${String(selectedCustomer.id).padStart(3, '0')}`
    : '';

  const canGenerate = !!(selectedCustomer && periodStart && periodEnd);

  const handlePrint = () => window.print();

  const buildShareFileNameBase = () => {
    const cust = (selectedCustomer?.shortCode || selectedCustomer?.name || 'customer')
      .replace(/\s+/g, '-')
      .toLowerCase();
    return `invoice-${cust}-${selectedMonth || today.substring(0, 7)}`;
  };

  const handleShareWhatsAppPng = async () => {
    if (!invoiceRef.current || !canGenerate) return;
    try {
      const blob = await toBlob(invoiceRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      if (!blob) throw new Error('Unable to generate PNG');
      const file = new File([blob], `${buildShareFileNameBase()}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'SLW Invoice',
          text: `${selectedCustomer?.name || 'Customer'} invoice (${periodLabel})`,
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`Invoice ready: ${selectedCustomer?.name || ''} (${periodLabel}). PNG downloaded, please attach it in WhatsApp.`)}`,
        '_blank'
      );
      toast.info('WhatsApp', 'PNG downloaded. Attach it in WhatsApp.');
    } catch {
      toast.error('Error', 'Failed to prepare PNG for WhatsApp');
    }
  };

  const handleShareWhatsAppPdf = () => {
    if (!canGenerate) return;
    window.print();
    window.setTimeout(() => {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`Invoice ready: ${selectedCustomer?.name || ''} (${periodLabel}). Save as PDF from print and attach in WhatsApp.`)}`,
        '_blank'
      );
    }, 300);
    toast.info('PDF Share', 'Use Print -> Save as PDF, then attach in WhatsApp.');
  };

  return (
    <div className="inv-screen">
      {/* ── Control panel ──────────────────────────────────────────────────── */}
      <aside className="inv-sidebar no-print">
        <div className="inv-sidebar-header">
          <h1 className="inv-sidebar-title">Invoice</h1>
          <p className="inv-sidebar-sub">Generate customer invoices</p>
        </div>

        <div className="inv-field">
          <label className="inv-label">Customer</label>
          <SearchableSelect<Customer>
            items={eligibleCustomers}
            value={selectedCustomer}
            onChange={setSelectedCustomer}
            getKey={(c) => String(c.id)}
            getLabel={(c) => `${c.name} (${c.type})`}
            getSearchText={(c) => `${c.name} ${c.shortCode} ${c.type}`}
            placeholder="Select customer…"
            groupBy={(c) => c.type}
          />
          {selectedCustomer && (
            <div className="inv-customer-badge">
              <span className="inv-badge-code">{selectedCustomer.shortCode}</span>
              <span className="inv-badge-type">{selectedCustomer.type}</span>
              {(customerBalanceMap.get(selectedCustomer.id) ?? 0) > 0 && (
                <span className="inv-badge-bal">
                  {formatCurrency(customerBalanceMap.get(selectedCustomer.id) ?? 0)} due
                </span>
              )}
            </div>
          )}
        </div>

        {selectedCustomer && isMonthly && (
          <div className="inv-field">
            <label className="inv-label">Billing Month</label>
            <div className={`inv-month-highlight${selectedMonth === currentMonth ? ' is-current' : ''}`}>
              {selectedMonth === currentMonth ? 'Current billing month' : `Selected: ${getMonthLabel(selectedMonth)}`}
            </div>
            <div className="inv-month-row">
              <select
                className="inv-select inv-month-sel"
                aria-label="Billing month"
                value={selectedMonth.split('-')[1] ?? '01'}
                onChange={(e) =>
                  setSelectedMonth(`${selectedMonth.split('-')[0]}-${e.target.value}`)
                }
              >
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(
                  (m, i) => (
                    <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                  )
                )}
              </select>
              <select
                className="inv-select inv-year-sel"
                aria-label="Billing year"
                value={selectedMonth.split('-')[0]}
                onChange={(e) =>
                  setSelectedMonth(`${e.target.value}-${selectedMonth.split('-')[1] ?? '01'}`)
                }
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedCustomer && customerGroup === 'rmp' && (
          <div className="inv-field">
            <label className="inv-label">RMP Handler</label>
            <div className="inv-handler-filter">
              {(['all', 'bhai', 'raja'] as const).map(h => (
                <button key={h} type="button"
                  className={`inv-handler-btn${rmpHandlerFilter === h ? ' active' : ''}`}
                  onClick={() => setRmpHandlerFilter(h)}>
                  {h === 'all' ? 'All' : h === 'bhai' ? 'Bhai' : 'Raja'}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedCustomer && !isMonthly && (
          <>
            <div className="inv-field">
              <label className="inv-label">From</label>
              <input
                type="date"
                className="inv-input"
                value={rangeFrom}
                max={rangeTo || today}
                aria-label="Start date"
                title="Start date"
                onChange={(e) => setRangeFrom(e.target.value)}
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">To</label>
              <input
                type="date"
                className="inv-input"
                value={rangeTo}
                min={rangeFrom}
                max={today}
                aria-label="End date"
                title="End date"
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </div>
          </>
        )}

        {canGenerate && (
          <div className="inv-actions">
            <div className="inv-summary-grid">
              <div className="inv-summary-item">
                <span className="inv-summary-label">Entries</span>
                <span className="inv-summary-value">{periodJobs.length}</span>
              </div>
              <div className="inv-summary-item">
                <span className="inv-summary-label">Period</span>
                <span className="inv-summary-value numeric">{formatCurrency(periodTotal)}</span>
              </div>
              {!isDcGroup && !hidePreviousBalance && oldBalance > 0 && (
                <div className="inv-summary-item inv-summary-alert">
                  <span className="inv-summary-label">Old Balance</span>
                  <span className="inv-summary-value numeric">{formatCurrency(oldBalance)}</span>
                </div>
              )}
              <div className="inv-summary-item inv-summary-total">
                <span className="inv-summary-label">Balance Due</span>
                <span className="inv-summary-value numeric">{formatCurrency(balanceDue)}</span>
              </div>
            </div>
            <button type="button" className="inv-print-btn" onClick={handlePrint}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Export / Print
            </button>
            <button type="button" className="inv-print-btn inv-share-btn" onClick={handleShareWhatsAppPng}>
              Share WhatsApp (PNG)
            </button>
            <button type="button" className="inv-print-btn inv-share-btn" onClick={handleShareWhatsAppPdf}>
              Share WhatsApp (PDF)
            </button>
          </div>
        )}
      </aside>

      {/* ── Invoice canvas ─────────────────────────────────────────────────── */}
      <div className="inv-canvas">
        {canGenerate ? (
          <div className="inv-doc" ref={invoiceRef}>
            {/* ── Header ───────────────────────────────────────────────────── */}
            <header className="inv-doc-header">
              <div className="inv-brand">
                <div className="inv-brand-mark" aria-hidden="true">SLW</div>
                <div className="inv-brand-info">
                  <p className="inv-company-name">SIVA LATHE WORKS</p>
                  <p className="inv-company-sub">Precision Machining &amp; Fabrication</p>
                </div>
              </div>
              <div className="inv-doc-meta">
                <p className="inv-doc-title">INVOICE</p>
                <p className="inv-doc-number">{invoiceNumber}</p>
              </div>
            </header>
            <div className="inv-customer-date-row">
              <p className="inv-header-customer">
                CUSTOMER: {selectedCustomer.name}
                {periodLabel && <span className="inv-customer-period"> &nbsp;·&nbsp; {periodLabel}</span>}
              </p>
              <div className={`inv-bal-badge${balanceDue <= 0 ? ' inv-bal-settled' : ''}`}>
                <span className="inv-bal-tag">Balance Due</span>
                <span className="inv-bal-amt">
                  {balanceDue < 0
                    ? `Cr · ${formatCurrency(Math.abs(balanceDue))}`
                    : formatCurrency(balanceDue)}
                </span>
              </div>
            </div>

            <div className="inv-rule" />

            {/* ── Default table (not RMP / WW / NM) ────────────────────────── */}
            {!isDcGroup && (
              <>
                {!hidePreviousBalance && (
                  <div className={`inv-carry-row ${oldBalance < 0 ? 'inv-carry-credit' : oldBalance === 0 ? 'inv-carry-zero' : 'inv-carry-debit'}`}>
                    <div className="inv-carry-left">
                      <span className="inv-carry-tag">
                        {oldBalance < 0 ? 'ADVANCE / CREDIT' : 'PREVIOUS BALANCE'}
                      </span>
                      <span className="inv-carry-desc"></span>
                    </div>
                    <span className="inv-carry-value">
                      {oldBalance < 0
                        ? `(${formatCurrency(Math.abs(oldBalance))})`
                        : formatCurrency(oldBalance)}
                    </span>
                  </div>
                )}

                <table className="inv-table">
                  <thead>
                    <tr>
                      <th className="inv-th inv-col-date">Date</th>
                      <th className="inv-th inv-col-work">Work Description</th>
                      <th className="inv-th inv-col-qty inv-align-right">Qty</th>
                      <th className="inv-th inv-col-amt inv-align-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodJobs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="inv-empty-cell">
                          No work entries for this period
                        </td>
                      </tr>
                    ) : (
                      periodJobs.map((job) => (
                        <tr key={job.id} className="inv-tr">
                          <td className="inv-td inv-col-date">{formatDateShort(job.date)}</td>
                          <td className="inv-td inv-col-work">
                            {resolveWorkTypeName(job.workTypeName, workTypes)}
                          </td>
                          <td className="inv-td inv-col-qty inv-align-right numeric">
                            {job.quantity ?? '—'}
                          </td>
                          <td className="inv-td inv-col-amt inv-align-right numeric">
                            {formatCurrency(getJobFinalBillValue(job))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            )}

            {/* ── DC-group table (RMP / WW / NM) ───────────────────────────── */}
            {isDcGroup && (
              <table className="inv-table">
                <thead>
                  <tr>
                    <th className="inv-th inv-col-billno">Bill No</th>
                    <th className="inv-th inv-col-date">Date</th>
                    <th className="inv-th inv-col-dcno">DC No</th>
                    <th className="inv-th inv-col-vehicle">Vehicle No</th>
                    <th className="inv-th inv-col-wtype">Work Type</th>
                    <th className="inv-th inv-col-amt inv-align-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {periodJobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="inv-empty-cell">
                        No work entries for this period
                      </td>
                    </tr>
                  ) : (
                    periodJobs.map((job) => (
                      <tr key={job.id} className="inv-tr">
                        <td className="inv-td inv-col-billno">{job.billNo || '—'}</td>
                        <td className="inv-td inv-col-date">{formatDateShort(job.date)}</td>
                        <td className="inv-td inv-col-dcno">{job.dcNo || '—'}</td>
                        <td className="inv-td inv-col-vehicle">{job.vehicleNo || '—'}</td>
                        <td className="inv-td inv-col-wtype">
                          {resolveWorkTypeName(job.workTypeName, workTypes)}
                        </td>
                        <td className="inv-td inv-col-amt inv-align-right numeric">
                          {formatCurrency(getJobFinalBillValue(job))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* ── Totals ───────────────────────────────────────────────────── */}
            <div className="inv-totals">
              {/* Old balance line — default customers only */}
              {!isDcGroup && !hidePreviousBalance && oldBalance !== 0 && (
                <div className={`inv-total-row ${oldBalance < 0 ? 'inv-total-credit' : ''}`}>
                  <span className="inv-total-label">Previous Balance</span>
                  <span className="inv-total-value numeric">
                    {oldBalance < 0
                      ? `(${formatCurrency(Math.abs(oldBalance))})`
                      : formatCurrency(oldBalance)}
                  </span>
                </div>
              )}

              <div className="inv-total-row">
                <span className="inv-total-label">
                  {isMonthly ? 'This Month' : 'This Period'} Total
                </span>
                <span className="inv-total-value numeric">{formatCurrency(periodTotal)}</span>
              </div>

              {paymentsReceived > 0 && (
                <div className="inv-total-row inv-total-credit">
                  <span className="inv-total-label">Payments Received</span>
                  <span className="inv-total-value numeric">
                    ({formatCurrency(paymentsReceived)})
                  </span>
                </div>
              )}

              <div className="inv-total-row inv-total-grand">
                <span className="inv-total-label">Balance Due</span>
                <span className="inv-total-value numeric">{formatCurrency(balanceDue)}</span>
              </div>
            </div>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <footer className="inv-doc-footer">
              <p className="inv-footer-note">Thank you for your continued business.</p>
              <p className="inv-footer-generated">
                Invoice Date: {formatDate(today)} · Siva Lathe Works
              </p>
            </footer>
          </div>
        ) : (
          <div className="inv-empty-state no-print">
            <svg
              className="inv-empty-icon"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p className="inv-empty-title">No invoice generated</p>
            <p className="inv-empty-sub">
              {selectedCustomer
                ? 'Set a billing period to generate the invoice'
                : 'Select a customer and billing period to get started'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
