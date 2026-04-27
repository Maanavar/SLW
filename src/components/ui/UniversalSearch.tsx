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

function highlight(text: string, query: string): string {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    text.slice(0, idx) +
    `<mark>${text.slice(idx, idx + query.length)}</mark>` +
    text.slice(idx + query.length)
  );
}

function StatusPill({ status }: { status: CardResult['status'] }) {
  const cls =
    status === 'Paid' ? 'usearch-pill--paid'
    : status === 'Partially Paid' ? 'usearch-pill--partial'
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
              {line.workName ? ` — ${line.workName}` : ''}
            </span>
            {(line.quantity !== undefined && line.quantity !== '') && (
              <span className="usearch-detail-qty">×{line.quantity}</span>
            )}
            <span className="usearch-detail-amt">{formatCurrency(line.amount)}</span>
            {line.commissionAmount > 0 && (
              <span className="usearch-detail-comm">comm {formatCurrency(line.commissionAmount)}</span>
            )}
            {line.dcNo && (
              <span className="usearch-detail-dc">DC: {line.dcNo}</span>
            )}
            {line.vehicleNo && (
              <span className="usearch-detail-dc">{line.vehicleNo}</span>
            )}
          </div>
        ))}
      </div>
      <div className="usearch-detail-summary">
        <span>Bill <strong>{formatCurrency(card.finalBill)}</strong></span>
        <span>Net <strong>{formatCurrency(card.net)}</strong></span>
        <span className="usearch-detail-paid">Paid <strong>{formatCurrency(card.paid)}</strong></span>
        {card.pending > 0 && (
          <span className="usearch-detail-pending">Due <strong>{formatCurrency(card.pending)}</strong></span>
        )}
      </div>
    </div>
  );
}

export function UniversalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { jobs, customers, getCustomer } = useDataStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setExpandedKey(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset expansion when query changes
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
      const customerName = getCustomer(group.primary.customerId)?.name || '';

      const matchesCard = cardId.includes(q);
      const matchesDc = dcNos.some((dc) => dc.toLowerCase().includes(q));
      const matchesCustomer = customerName.toLowerCase().includes(q);

      if (matchesCard || matchesDc || matchesCustomer) {
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
      if (
        c.name.toLowerCase().includes(q) ||
        (c.shortCode || '').toLowerCase().includes(q)
      ) {
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
            placeholder="Search job card ID, DC number, customer name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="usearch-esc" onClick={() => setOpen(false)}>Esc</kbd>
        </div>

        {query.trim().length >= 2 && (
          <div className="usearch-results">
            {cardResults.length === 0 && customerResults.length === 0 && (
              <p className="usearch-empty">No results for "{query}"</p>
            )}

            {cardResults.length > 0 && (
              <section className="usearch-group">
                <p className="usearch-group-label">Job Cards — click to expand details</p>
                {cardResults.map((r) => (
                  <div key={r.key}>
                    <button
                      type="button"
                      className={`usearch-result-row${expandedKey === r.key ? ' usearch-result-row--active' : ''}`}
                      onClick={() => setExpandedKey(expandedKey === r.key ? null : r.key)}
                    >
                      <span className="usearch-card-id"
                        dangerouslySetInnerHTML={{ __html: highlight(r.cardId, query) }}
                      />
                      <span className="usearch-customer"
                        dangerouslySetInnerHTML={{ __html: highlight(r.customerName, query) }}
                      />
                      <span className="usearch-date">
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                      {r.dcNos.length > 0 && (
                        <span className="usearch-dc"
                          dangerouslySetInnerHTML={{ __html: `DC: ${highlight(r.dcNos.join(', '), query)}` }}
                        />
                      )}
                      <span className="usearch-amount">{formatCurrency(r.finalBill)}</span>
                      <StatusPill status={r.status} />
                      <span className="usearch-chevron">{expandedKey === r.key ? '⌃' : '⌄'}</span>
                    </button>
                    {expandedKey === r.key && <CardDetail card={r} />}
                  </div>
                ))}
              </section>
            )}

            {customerResults.length > 0 && (
              <section className="usearch-group">
                <p className="usearch-group-label">Customers</p>
                {customerResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="usearch-result-row"
                    onClick={() => { navigate('/customers'); setOpen(false); }}
                  >
                    <span className="usearch-customer"
                      dangerouslySetInnerHTML={{ __html: highlight(r.name, query) }}
                    />
                    {r.shortCode && (
                      <span className="usearch-code"
                        dangerouslySetInnerHTML={{ __html: highlight(r.shortCode, query) }}
                      />
                    )}
                    {r.customerType && (
                      <span className="usearch-type">{r.customerType}</span>
                    )}
                  </button>
                ))}
              </section>
            )}
          </div>
        )}

        {query.trim().length < 2 && (
          <p className="usearch-hint">Type at least 2 characters · Ctrl+K to toggle</p>
        )}
      </div>
    </>
  );
}
