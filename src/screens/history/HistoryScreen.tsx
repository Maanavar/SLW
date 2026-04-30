import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { JobCardEditOverlay } from '@/components/job-card/JobCardEditOverlay';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobCardPaymentSummary, getJobPaidAmount, getJobWorkerCommissionExpense } from '@/lib/jobUtils';
import { StatusBadge } from '@/components/ui/Badge';
import { getLocalDateString } from '@/lib/dateUtils';
import './HistoryScreen.css';

interface CardHistoryRow {
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

type HistoryViewMode = 'cards' | 'table';
type PaymentFilter = 'all' | 'paid' | 'unpaid';

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function getCardStatusClass(status: 'Paid' | 'Pending' | 'Partially Paid'): string {
  if (status === 'Paid')           return 'hist-card--paid';
  if (status === 'Partially Paid') return 'hist-card--partial';
  return 'hist-card--pending';
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

export function HistoryScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { jobs, getCustomer, deleteJob } = useDataStore();
  const toast = useToast();
  const today = getLocalDateString(new Date());

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<HistoryViewMode>('table');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [dcSearch, setDcSearch] = useState('');
  const appliedDateParamRef = useRef<string | null>(null);
  const openedCardParamRef = useRef<string | null>(null);

  const deepLinkDate = (searchParams.get('date') || '').trim();
  const deepLinkCardKey = (searchParams.get('cardKey') || '').trim();

  const isDcMode = dcSearch.trim().length > 0;
  const isToday = selectedDate === today;

  // When DC search is active, search across ALL jobs, not just the selected date
  const jobsInRange = isDcMode ? jobs : getJobsInRange(jobs, selectedDate, selectedDate);
  const groups = groupJobsByCard(jobsInRange);

  useEffect(() => {
    if (!deepLinkDate || appliedDateParamRef.current === deepLinkDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deepLinkDate)) return;
    if (deepLinkDate > today) return;
    setSelectedDate(deepLinkDate);
    appliedDateParamRef.current = deepLinkDate;
  }, [deepLinkDate, today]);

  useEffect(() => {
    if (!deepLinkCardKey) {
      openedCardParamRef.current = null;
      return;
    }
    if (openedCardParamRef.current === deepLinkCardKey) return;
    const target = groups.find((g) => g.key === deepLinkCardKey);
    if (!target) return;
    setSelectedCardId(target.key);
    openedCardParamRef.current = deepLinkCardKey;
  }, [deepLinkCardKey, groups]);

  const filteredGroups = useMemo(
    () =>
      groups.filter(group => {
        // DC number filter — any job in the card must have a matching dcNo
        if (isDcMode) {
          const q = dcSearch.trim().toLowerCase();
          if (!group.jobs.some(j => j.dcNo && j.dcNo.toLowerCase().includes(q))) return false;
        }
        if (paymentFilter === 'all') return true;
        const status = getJobCardPaymentSummary(group.jobs).status;
        return paymentFilter === 'paid' ? status === 'Paid' : status !== 'Paid';
      }),
    [groups, paymentFilter, isDcMode, dcSearch]
  );

  const rows: CardHistoryRow[] = useMemo(
    () =>
      filteredGroups.map(group => {
        const customerName = getCustomer(group.primary.customerId)?.name || 'Unknown';
        const payment = getJobCardPaymentSummary(group.jobs);
        const commission = group.jobs.reduce((s, j) => s + getJobWorkerCommissionExpense(j), 0);
        const workSummary = [...new Set(group.jobs.map(j => j.workTypeName))].join(', ');
        return {
          id: group.key,
          date: group.primary.date,
          jobCardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
          customerName,
          lineCount: group.lineCount,
          workSummary,
          finalBill: payment.finalBill,
          commission,
          ourNet: payment.net,
          paid: payment.paid,
          pending: payment.pending,
          paymentStatus: payment.status,
        };
      }),
    [filteredGroups, getCustomer]
  );

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.jobCardId.localeCompare(a.jobCardId)),
    [rows]
  );

  const summary = useMemo(() => {
    const totalCards   = rows.length;
    const totalBill    = rows.reduce((s, r) => s + r.finalBill, 0);
    const totalNet     = rows.reduce((s, r) => s + r.ourNet, 0);
    const totalPaid    = rows.reduce((s, r) => s + r.paid, 0);
    const totalPending = rows.reduce((s, r) => s + r.pending, 0);
    const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
    const grossProfit = totalNet;
    // Count paid job cards (cards with at least partial payment)
    const paidCards = rows.filter(r => r.paymentStatus === 'Paid' || r.paymentStatus === 'Partially Paid').length;
    return { totalCards, totalBill, totalNet, totalPaid, totalPending, totalCommission, grossProfit, paidCards };
  }, [rows]);

  const paymentModeBreakdown = useMemo(() => {
    const bd = { cash: 0, upi: 0, bank: 0, cheque: 0 };
    filteredGroups.forEach(g => g.jobs.forEach(j => {
      const paid = getJobPaidAmount(j);
      if (paid > 0 && j.paymentMode) {
        if (j.paymentMode === 'Cash') bd.cash += paid;
        else if (j.paymentMode === 'UPI') bd.upi += paid;
        else if (j.paymentMode === 'Bank') bd.bank += paid;
        else if (j.paymentMode === 'Cheque') bd.cheque += paid;
      }
    }));
    return bd;
  }, [filteredGroups]);

  // Removed: hasBreakdown, showBreakdown, setShowBreakdown (were for Received breakdown tooltip)

  const selectedGroup = useMemo(
    () => groups.find(g => g.key === selectedCardId) || null,
    [groups, selectedCardId]
  );
  const editingGroup = useMemo(
    () => groups.find(g => g.key === editingCardId) || null,
    [groups, editingCardId]
  );

  const handleDeleteCard = async () => {
    if (!selectedGroup) return;
    const cardId = selectedGroup.primary.jobCardId || `LEGACY-${selectedGroup.primary.id}`;
    if (!window.confirm(`Delete JobCard ${cardId}?\n\nThis removes ${selectedGroup.jobs.length} line(s) and cannot be undone.`)) return;
    try {
      await Promise.all(selectedGroup.jobs.map(j => deleteJob(j.id)));
      toast.success('Deleted', `JobCard ${cardId} removed`);
      setSelectedCardId(null);
    } catch {
      toast.error('Error', 'Failed to delete job card');
    }
  };

  return (
    <div className="history-screen">

      {/* Row 1 – Page header */}
      <div className="hist-pg-header">
        <div>
          <h1 className="hist-pg-title">History <span className="hist-pg-title-ta tamil">வரலாறு</span></h1>
          <p className="hist-pg-desc">Daily job cards — browse by date</p>
        </div>
        <button type="button" className="btn btn-accent" onClick={() => navigate('/')}>
          + New job card
        </button>
      </div>

      {/* Row 2 – Toolbar */}
      <div className="hist-toolbar">
        {/* Date navigator */}
        <div className="hist-day-nav">
          <button type="button" className="hist-nav-btn" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} aria-label="Previous day">
            <ChevL />
          </button>
          <input
            id="history-date-input"
            type="date"
            className="hist-date-input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            max={today}
            aria-label="Select date"
          />
          <button type="button" className="hist-nav-btn" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            disabled={selectedDate >= today} aria-label="Next day">
            <ChevR />
          </button>
        </div>
        {!isToday && (
          <button type="button" className="hist-today-btn" onClick={() => setSelectedDate(today)}>Today</button>
        )}

        <div className="hist-toolbar-sep" />

        {/* DC number search */}
        <label className="hist-dc-search" aria-label="Search by DC number">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4"/><path d="M10 10l2.5 2.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            className="hist-dc-input"
            placeholder="DC No..."
            value={dcSearch}
            onChange={e => setDcSearch(e.target.value)}
            aria-label="Search by DC number"
          />
          {dcSearch && (
            <button type="button" className="hist-dc-clear" onClick={() => setDcSearch('')} aria-label="Clear DC search">×</button>
          )}
        </label>

        <div className="hist-toolbar-sep" />

        {/* Payment filter */}
        <div className="hist-pf-tabs">
          {(['all', 'paid', 'unpaid'] as PaymentFilter[]).map(f => (
            <button key={f} type="button"
              className={`hist-pf-btn${paymentFilter === f ? ' active' : ''}`}
              onClick={() => setPaymentFilter(f)}>
              {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : 'Unpaid'}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="hist-toolbar-end">
          {rows.length > 0 && (
            <span className="hist-count">{rows.length} card{rows.length !== 1 ? 's' : ''}</span>
          )}
          <div className="hist-view-toggle">
            <button type="button" className={`hist-view-btn${viewMode === 'cards' ? ' active' : ''}`}
              onClick={() => setViewMode('cards')} title="Card view">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="0.5" y="0.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="8" y="0.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="0.5" y="8" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="8" y="8" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              Cards
            </button>
            <button type="button" className={`hist-view-btn${viewMode === 'table' ? ' active' : ''}`}
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

      {/* DC search mode banner */}
      {isDcMode && (
        <div className="hist-dc-banner">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4"/><path d="M10 10l2.5 2.5" strokeLinecap="round"/>
          </svg>
          Searching all dates for DC No. <strong>"{dcSearch.trim()}"</strong> — {filteredGroups.length} result{filteredGroups.length !== 1 ? 's' : ''}
          <button type="button" className="hist-dc-banner-clear" onClick={() => setDcSearch('')}>Clear</button>
        </div>
      )}

      {/* Row 3 – Summary stats */}
      {rows.length > 0 && (
        <div className="hist-stats">
          <div className="hist-stat">
            <div className="hist-stat-row hist-stat-row--split">
              <div className="hist-stat-cell">
                <span className="hist-stat-label">Revenue</span>
                <span className="hist-stat-value">{formatCurrency(summary.totalBill)}</span>
                <span className="hist-stat-sub">Final bill value</span>
              </div>
              <div className="hist-stat-cell">
                <span className="hist-stat-label">Commission</span>
                <span className="hist-stat-value">{formatCurrency(summary.totalCommission)}</span>
                <span className="hist-stat-sub">Payable to workers</span>
              </div>
            </div>
          </div>
          <div className="hist-stat hist-stat--green">
            <span className="hist-stat-label">Gross profit</span>
            <span className="hist-stat-value">{formatCurrency(summary.grossProfit)}</span>
            <span className="hist-stat-sub">Net income after flow adjustments</span>
          </div>
          <div className="hist-stat hist-stat--green">
            <span className="hist-stat-label">Received</span>
            <span className="hist-stat-value">{formatCurrency(summary.totalPaid)}</span>
            <span className="hist-stat-sub">{summary.paidCards}/{summary.totalCards} payments</span>
          </div>
          <div className={`hist-stat${summary.totalPending > 0 ? ' hist-stat--red' : ' hist-stat--green'}`}>
            <span className="hist-stat-label">Outstanding</span>
            <span className="hist-stat-value">{formatCurrency(summary.totalPending)}</span>
            <span className="hist-stat-sub">Final bill - received</span>
          </div>
          <div className="hist-stat hist-stat--mode">
            <span className="hist-stat-label">By mode</span>
            <div className="hist-mode-grid">
              <span className="hist-mode-name">Cash</span>
              <span className="hist-mode-val">{formatCurrency(paymentModeBreakdown.cash)}</span>
              <span className="hist-mode-name">UPI</span>
              <span className="hist-mode-val">{formatCurrency(paymentModeBreakdown.upi)}</span>
              <span className="hist-mode-name">Bank</span>
              <span className="hist-mode-val">{formatCurrency(paymentModeBreakdown.bank)}</span>
              <span className="hist-mode-name">Cheque</span>
              <span className="hist-mode-val">{formatCurrency(paymentModeBreakdown.cheque)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Row 4 – Content */}
      {viewMode === 'cards' ? (
        sortedRows.length > 0 ? (
          <div className="hist-cards-grid">
            {sortedRows.map(row => (
              <div
                key={row.id}
                className={`hist-card ${getCardStatusClass(row.paymentStatus)}`}
                onClick={() => setSelectedCardId(row.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCardId(row.id); } }}
              >
                <div className="hist-card-header">
                  <div className="hist-card-title-group">
                    <h3 className="hist-card-title">{row.customerName}</h3>
                    <div className="hist-card-meta">
                      <span className="hist-card-id">{row.jobCardId}</span>
                      <span className="hist-card-dot" />
                      <span className="hist-card-lines">{row.lineCount} line{row.lineCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <StatusBadge status={row.paymentStatus} />
                </div>

                {row.workSummary && (
                  <div className="hist-card-tags">
                    {row.workSummary.split(', ').map(tag => (
                      <span key={tag} className="hist-card-tag">{tag}</span>
                    ))}
                  </div>
                )}

                <div className="hist-card-fins">
                  <div className="hist-card-fin">
                    <span className="hist-card-fin-label">Final Bill</span>
                    <span className="hist-card-fin-val">{formatCurrency(row.finalBill)}</span>
                  </div>
                  <div className="hist-card-fin">
                    <span className="hist-card-fin-label">Our Net</span>
                    <span className="hist-card-fin-val hist-card-fin-val--net">{formatCurrency(row.ourNet)}</span>
                  </div>
                  <div className="hist-card-fin">
                    <span className="hist-card-fin-label">Paid</span>
                    <span className="hist-card-fin-val hist-card-fin-val--green">{formatCurrency(row.paid)}</span>
                  </div>
                  <div className="hist-card-fin">
                    <span className="hist-card-fin-label">Pending</span>
                    <span className={`hist-card-fin-val${row.pending > 0 ? ' hist-card-fin-val--red' : ' hist-card-fin-val--green'}`}>
                      {formatCurrency(row.pending)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="hist-empty">
            <svg className="hist-empty-icon" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2"/>
              <line x1="15" y1="16" x2="33" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="15" y1="23" x2="33" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="15" y1="30" x2="24" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="hist-empty-title">
              {isDcMode ? `No cards found for DC No. "${dcSearch.trim()}"` :
                paymentFilter === 'all' ? 'No job cards for this date'
                : paymentFilter === 'paid' ? 'No paid job cards for this date'
                : 'No unpaid job cards for this date'}
            </p>
            <p className="hist-empty-sub">{isDcMode ? 'Try a different DC number' : 'Try a different date or filter'}</p>
            <button type="button" className="btn btn-accent" onClick={() => navigate('/')}>+ New job card</button>
          </div>
        )
      ) : (
        <div className="hist-table-wrap">
          <table className="hist-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>CARD</th>
                <th>CUSTOMER</th>
                <th>WORKS</th>
                <th className="numeric">FINAL BILL</th>
                <th className="numeric">COMMISSION</th>
                <th className="numeric">OUR NET</th>
                <th className="numeric">PAID</th>
                <th className="numeric">PENDING</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length > 0 ? (
                sortedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hist-row"
                    onClick={() => setSelectedCardId(row.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCardId(row.id); } }}
                  >
                    <td><span className="hist-date-cell">{row.date}</span></td>
                    <td><span className="hist-card-id-cell">{row.jobCardId}</span></td>
                    <td><span className="hist-cust-name">{row.customerName}</span></td>
                    <td><span className="hist-works-cell">{row.workSummary || '—'}</span></td>
                    <td className="numeric">{formatCurrency(row.finalBill)}</td>
                    <td className="numeric">{row.commission > 0 ? formatCurrency(row.commission) : <span className="hist-zero">—</span>}</td>
                    <td className="numeric">{formatCurrency(row.ourNet)}</td>
                    <td className="numeric hist-paid">{formatCurrency(row.paid)}</td>
                    <td className="numeric">
                      <span className={row.pending > 0 ? 'hist-pending-val' : ''}>
                        {formatCurrency(row.pending)}
                      </span>
                    </td>
                    <td><StatusBadge status={row.paymentStatus} /></td>
                  </tr>
                ))
              ) : (
                <tr className="hist-table-empty">
                  <td colSpan={10}>
                    {isDcMode ? `No cards found for DC No. "${dcSearch.trim()}"` :
                      paymentFilter === 'all' ? 'No job cards for this date'
                      : paymentFilter === 'paid' ? 'No paid job cards'
                      : 'No unpaid job cards'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <JobCardDetailsModal
        isOpen={Boolean(selectedGroup)}
        jobs={selectedGroup?.jobs || null}
        onClose={() => setSelectedCardId(null)}
        getCustomer={getCustomer}
        onEdit={() => { if (selectedGroup) { setEditingCardId(selectedGroup.key); setSelectedCardId(null); } }}
        onDelete={handleDeleteCard}
      />

      <JobCardEditOverlay
        isOpen={Boolean(editingGroup)}
        jobs={editingGroup?.jobs || null}
        onClose={() => setEditingCardId(null)}
        onSave={() => setEditingCardId(null)}
      />
    </div>
  );
}
