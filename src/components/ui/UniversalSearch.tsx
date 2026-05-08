import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { groupJobsByCard } from '@/lib/reportUtils';
import { getJobCardPaymentSummary, getJobFinalBillValue } from '@/lib/jobUtils';
import { Icon } from '@/components/ui/Icon';
import './UniversalSearch.css';

interface JobLine {
  id: number;
  workTypeName: string;
  workName: string;
  quantity: number | string;
  amount: number;
  commissionAmount: number;
  dcNo: string;
  vehicleNo: string;
}

interface CardResult {
  type: 'card';
  key: string;
  cardId: string;
  customerName: string;
  date: string;
  finalBill: number;
  net: number;
  paid: number;
  pending: number;
  status: 'Paid' | 'Pending' | 'Partially Paid';
  dcNos: string[];
  vehicleNos: string[];
  lines: JobLine[];
}

interface CustomerResult {
  type: 'customer';
  id: number;
  name: string;
  shortCode: string;
  customerType: string;
}

type SearchResult = CardResult | CustomerResult;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text: string, query: string): string {
  const safeText = escapeHtml(text || '');
  const trimmedQuery = query.trim();
  if (!trimmedQuery || !safeText) return safeText;
  const regex = new RegExp(`(${escapeRegExp(trimmedQuery)})`, 'ig');
  return safeText.replace(regex, '<mark>$1</mark>');
}

function StatusPill({ status }: { status: CardResult['status'] }) {
  const cls =
    status === 'Paid'
      ? 'usearch-pill--paid'
      : status === 'Partially Paid'
        ? 'usearch-pill--partial'
        : 'usearch-pill--pending';
  return <span className={`usearch-pill ${cls}`}>{status}</span>;
}

function CardDetail({ card }: { card: CardResult }) {
  return (
    <div className="usearch-card-detail">
      <div className="usearch-detail-lines">
        {card.lines.map((line) => (
          <div key={line.id} className="usearch-detail-line">
            <span className="usearch-detail-work">
              {line.workTypeName}
              {line.workName ? ` - ${line.workName}` : ''}
            </span>
            {line.quantity !== undefined && line.quantity !== '' && (
              <span className="usearch-detail-qty">x{line.quantity}</span>
            )}
            <span className="usearch-detail-amt">{formatCurrency(line.amount)}</span>
            {line.commissionAmount > 0 && (
              <span className="usearch-detail-comm">
                comm {formatCurrency(line.commissionAmount)}
              </span>
            )}
            {line.dcNo && <span className="usearch-detail-dc">DC: {line.dcNo}</span>}
            {line.vehicleNo && <span className="usearch-detail-dc">{line.vehicleNo}</span>}
          </div>
        ))}
      </div>
      <div className="usearch-detail-summary">
        <span>
          Bill <strong>{formatCurrency(card.finalBill)}</strong>
        </span>
        <span>
          Net <strong>{formatCurrency(card.net)}</strong>
        </span>
        <span className="usearch-detail-paid">
          Paid <strong>{formatCurrency(card.paid)}</strong>
        </span>
        {card.pending > 0 && (
          <span className="usearch-detail-pending">
            Due <strong>{formatCurrency(card.pending)}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

export function UniversalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { jobs, customers, getCustomer } = useDataStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setExpandedKey(null);
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setExpandedKey(null);
  }, [query]);

  const results = useMemo((): SearchResult[] => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const out: SearchResult[] = [];
    const cards = groupJobsByCard(jobs);

    for (const group of cards) {
      const cardId = (group.primary.jobCardId || '').toLowerCase();
      const dcNos = [...new Set(group.jobs.map((j) => j.dcNo || '').filter(Boolean))];
      const vehicleNos = [...new Set(group.jobs.map((j) => j.vehicleNo || '').filter(Boolean))];
      const customerName = getCustomer(group.primary.customerId)?.name || '';

      const matchesCard = cardId.includes(q);
      const matchesDc = dcNos.some((dc) => dc.toLowerCase().includes(q));
      const matchesCustomer = customerName.toLowerCase().includes(q);
      const matchesVehicle = vehicleNos.some((vehicleNo) => vehicleNo.toLowerCase().includes(q));

      if (matchesCard || matchesDc || matchesCustomer || matchesVehicle) {
        const payment = getJobCardPaymentSummary(group.jobs);
        out.push({
          type: 'card',
          key: group.key,
          cardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
          customerName,
          date: group.primary.date,
          finalBill: payment.finalBill,
          net: payment.net,
          paid: payment.paid,
          pending: payment.pending,
          status: payment.status,
          dcNos,
          vehicleNos,
          lines: group.jobs.map((j) => ({
            id: j.id,
            workTypeName: j.workTypeName || '',
            workName: j.workName || '',
            quantity: j.quantity ?? '',
            amount: getJobFinalBillValue(j),
            commissionAmount: Number(j.commissionAmount) || 0,
            dcNo: j.dcNo || '',
            vehicleNo: j.vehicleNo || '',
          })),
        });
      }
      if (out.filter((r) => r.type === 'card').length >= 8) break;
    }

    for (const c of customers) {
      if (!c.isActive) continue;
      if (c.name.toLowerCase().includes(q) || (c.shortCode || '').toLowerCase().includes(q)) {
        out.push({
          type: 'customer',
          id: c.id,
          name: c.name,
          shortCode: c.shortCode || '',
          customerType: c.type || '',
        });
      }
      if (out.filter((r) => r.type === 'customer').length >= 5) break;
    }

    return out;
  }, [query, jobs, customers, getCustomer]);

  const cardResults = results.filter((r): r is CardResult => r.type === 'card');
  const customerResults = results.filter((r): r is CustomerResult => r.type === 'customer');

  const selectableResults = useMemo(
    () => [
      ...cardResults.map((r) => ({ type: 'card' as const, result: r })),
      ...customerResults.map((r) => ({ type: 'customer' as const, result: r })),
    ],
    [cardResults, customerResults]
  );

  // Reset active index whenever query changes so arrow keys start fresh
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const openCard = (card: CardResult) => {
    navigate(
      `/history?cardKey=${encodeURIComponent(card.key)}&date=${encodeURIComponent(card.date)}`
    );
    setOpen(false);
  };

  const openCustomer = (customer: CustomerResult) => {
    const searchValue = customer.name || query.trim();
    navigate(`/customers?customerId=${customer.id}&search=${encodeURIComponent(searchValue)}`);
    setOpen(false);
  };

  const openActiveResult = () => {
    if (activeIndex < 0 || activeIndex >= selectableResults.length) return;
    const selected = selectableResults[activeIndex];
    if (selected.type === 'card') {
      openCard(selected.result);
      return;
    }
    openCustomer(selected.result);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="top-icon-btn"
        onClick={() => setOpen(true)}
        title="Search (Ctrl+K)"
      >
        <Icon name="search" width={15} height={15} />
      </button>
    );
  }

  return (
    <>
      <div className="usearch-backdrop" onClick={() => setOpen(false)} />
      <div className="usearch-modal" role="dialog" aria-modal="true" aria-label="Universal search">
        <div className="usearch-input-row">
          <Icon name="search" width={15} height={15} className="usearch-icon" />
          <input
            ref={inputRef}
            type="text"
            className="usearch-input"
            placeholder="Search card ID, DC, vehicle no, customer..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (selectableResults.length === 0) return;
                setActiveIndex((prev) => (prev < 0 ? 0 : (prev + 1) % selectableResults.length));
                return;
              }

              if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selectableResults.length === 0) return;
                setActiveIndex((prev) => (prev <= 0 ? selectableResults.length - 1 : prev - 1));
                return;
              }

              if (e.key === 'Enter') {
                e.preventDefault();
                openActiveResult();
              }
            }}
          />
          <button type="button" className="usearch-esc" onClick={() => setOpen(false)}>
            Esc
          </button>
        </div>

        {query.trim().length >= 2 && (
          <div className="usearch-results">
            {cardResults.length === 0 && customerResults.length === 0 && (
              <p className="usearch-empty">No results for "{query}"</p>
            )}

            {cardResults.length > 0 && (
              <section className="usearch-group">
                <p className="usearch-group-label">
                  Job Cards - Enter/click opens card, chevron previews lines
                </p>
                {cardResults.map((r, idx) => (
                  <div key={r.key}>
                    <div className="usearch-card-row-wrap">
                      <button
                        type="button"
                        className={`usearch-result-row${activeIndex === idx ? ' usearch-result-row--active' : ''}`}
                        onClick={() => openCard(r)}
                      >
                        <span
                          className="usearch-card-id"
                          dangerouslySetInnerHTML={{ __html: highlight(r.cardId, query) }}
                        />
                        <span
                          className="usearch-customer"
                          dangerouslySetInnerHTML={{ __html: highlight(r.customerName, query) }}
                        />
                        <span className="usearch-date">
                          {new Date(`${r.date}T00:00:00`).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit',
                          })}
                        </span>
                        {r.dcNos.length > 0 && (
                          <span
                            className="usearch-dc"
                            dangerouslySetInnerHTML={{
                              __html: `DC: ${highlight(r.dcNos.join(', '), query)}`,
                            }}
                          />
                        )}
                        {r.vehicleNos.length > 0 && (
                          <span
                            className="usearch-dc"
                            dangerouslySetInnerHTML={{
                              __html: `VH: ${highlight(r.vehicleNos.join(', '), query)}`,
                            }}
                          />
                        )}
                        <span className="usearch-amount">{formatCurrency(r.finalBill)}</span>
                        <StatusPill status={r.status} />
                      </button>
                      <button
                        type="button"
                        className={`usearch-expand-btn${expandedKey === r.key ? ' active' : ''}`}
                        aria-label={
                          expandedKey === r.key
                            ? `Hide details for ${r.cardId}`
                            : `Show details for ${r.cardId}`
                        }
                        title={expandedKey === r.key ? 'Hide details' : 'Show details'}
                        onClick={() => setExpandedKey(expandedKey === r.key ? null : r.key)}
                      >
                        {expandedKey === r.key ? '^' : 'v'}
                      </button>
                    </div>
                    {expandedKey === r.key && <CardDetail card={r} />}
                  </div>
                ))}
              </section>
            )}

            {customerResults.length > 0 && (
              <section className="usearch-group">
                <p className="usearch-group-label">Customers</p>
                {customerResults.map((r, idx) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`usearch-result-row${
                      activeIndex === cardResults.length + idx ? ' usearch-result-row--active' : ''
                    }`}
                    onClick={() => openCustomer(r)}
                  >
                    <span
                      className="usearch-customer"
                      dangerouslySetInnerHTML={{ __html: highlight(r.name, query) }}
                    />
                    {r.shortCode && (
                      <span
                        className="usearch-code"
                        dangerouslySetInnerHTML={{ __html: highlight(r.shortCode, query) }}
                      />
                    )}
                    {r.customerType && <span className="usearch-type">{r.customerType}</span>}
                  </button>
                ))}
              </section>
            )}
          </div>
        )}

        {query.trim().length < 2 && (
          <p className="usearch-hint">
            Type at least 2 characters &middot; Ctrl+K to toggle &middot; &uarr;&darr; navigate
            &middot; &crarr; open
          </p>
        )}
      </div>
    </>
  );
}
