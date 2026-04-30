import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import {
  getJobAgentCommissionIncome,
  getJobAgentNetPayable,
  getJobAgentSettlementPaid,
  getJobAgentSettlementPending,
  getJobAgentTdsAmount,
  getJobFinalBillValue,
  isAgentWorkJob,
} from '@/lib/jobUtils';
import './ExternalDcScreen.css';

type CustomerTab = 'ww' | 'rmp';
type PeriodType = 'month' | 'quarter' | 'half' | 'all';
type ExtDcFilter = 'all' | 'external' | 'internal';
type SortKey = 'date' | 'dcNo' | 'billNo' | 'agentName';

const WW_AGENT_NAMES = ['Palanisamy'];
const RMP_AGENT_NAMES = ['Leaf Bhai'];

function normalizeToken(value?: string) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function getPeriodRange(period: PeriodType, offset: number): { start: string | null; end: string | null; label: string } {
  if (period === 'all') return { start: null, end: null, label: 'All Time' };
  const now = new Date();
  if (period === 'month') {
    let m = now.getMonth() + offset;
    const y = now.getFullYear() + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    const from = new Date(y, m, 1);
    const to = new Date(y, m + 1, 0);
    return { start: getLocalDateString(from), end: getLocalDateString(to), label: from.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
  }
  if (period === 'quarter') {
    let q = Math.floor(now.getMonth() / 3) + offset;
    const y = now.getFullYear() + Math.floor(q / 4);
    q = ((q % 4) + 4) % 4;
    const from = new Date(y, q * 3, 1);
    const to = new Date(y, q * 3 + 3, 0);
    return { start: getLocalDateString(from), end: getLocalDateString(to), label: `Q${q + 1} ${y}` };
  }
  let h = (now.getMonth() < 6 ? 0 : 1) + offset;
  const y = now.getFullYear() + Math.floor(h / 2);
  h = ((h % 2) + 2) % 2;
  const from = new Date(y, h * 6, 1);
  const to = new Date(y, h * 6 + 6, 0);
  return { start: getLocalDateString(from), end: getLocalDateString(to), label: `${h === 0 ? 'H1' : 'H2'} ${y}` };
}

export function ExternalDcScreen() {
  const { jobs, customers } = useDataStore();
  const [activeTab, setActiveTab] = useState<CustomerTab>('ww');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [extDcFilter, setExtDcFilter] = useState<ExtDcFilter>('all');
  const [period, setPeriod] = useState<PeriodType>('all');
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; order: 'asc' | 'desc' }>({ key: 'date', order: 'desc' });

  const wwCustomer = useMemo(
    () => customers.find(c => normalizeToken(c.shortCode) === 'ww' || normalizeToken(c.name).includes('ramanicars')),
    [customers]
  );
  const rmpCustomer = useMemo(
    () => customers.find(c => normalizeToken(c.shortCode) === 'rmp' || normalizeToken(c.name).includes('ramanimotors')),
    [customers]
  );

  const activeCustomer = activeTab === 'ww' ? wwCustomer : rmpCustomer;
  const agentNames = activeTab === 'ww' ? WW_AGENT_NAMES : RMP_AGENT_NAMES;

  const periodRange = useMemo(() => getPeriodRange(period, offset), [period, offset]);

  function switchTab(tab: CustomerTab) {
    setActiveTab(tab);
    setAgentFilter('all');
    setExtDcFilter('all');
    setOffset(0);
  }

  function toggleSort(key: SortKey) {
    setSort(prev =>
      prev.key === key
        ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key === 'date' ? 'desc' : 'asc' }
    );
  }

  function sortMark(key: SortKey) {
    if (sort.key !== key) return ' ↕';
    return sort.order === 'asc' ? ' ↑' : ' ↓';
  }

  const filteredJobs = useMemo(() => {
    if (!activeCustomer) return [];
    return jobs.filter(job => {
      if (job.customerId !== activeCustomer.id) return false;
      if (!isAgentWorkJob(job)) return false;
      if (extDcFilter === 'external' && !job.externalDc) return false;
      if (extDcFilter === 'internal' && job.externalDc) return false;
      if (periodRange.start && job.date < periodRange.start) return false;
      if (periodRange.end && job.date > periodRange.end) return false;
      return true;
    });
  }, [jobs, activeCustomer, extDcFilter, periodRange]);

  const cardRows = useMemo(() => {
    const groups = new Map<string, typeof filteredJobs>();
    filteredJobs.forEach(job => {
      const key = job.jobCardId ? `card:${job.jobCardId}` : `legacy:${job.id}`;
      const list = groups.get(key) ?? [];
      list.push(job);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).map(([key, groupJobs]) => {
      const sorted = [...groupJobs].sort((a, b) => (a.jobCardLine || a.id) - (b.jobCardLine || b.id));
      const primary = sorted[0];
      const invoice = sorted.reduce((s, j) => s + getJobFinalBillValue(j), 0);
      const commission = sorted.reduce((s, j) => s + getJobAgentCommissionIncome(j), 0);
      const tds = sorted.reduce((s, j) => s + getJobAgentTdsAmount(j), 0);
      const netPayable = sorted.reduce((s, j) => s + getJobAgentNetPayable(j), 0);
      const settled = sorted.reduce((s, j) => s + getJobAgentSettlementPaid(j), 0);
      const pending = Math.max(0, sorted.reduce((s, j) => s + getJobAgentSettlementPending(j), 0));
      return {
        key,
        date: primary.date,
        jobCardId: primary.jobCardId || `LEGACY-${primary.id}`,
        agentName: primary.agentName || primary.rmpHandler || 'Agent',
        dcNo: primary.dcNo || '',
        billNo: primary.billNo || '',
        externalDc: Boolean(primary.externalDc),
        invoice,
        commission,
        tds,
        netPayable,
        settled,
        pending,
      };
    });
  }, [filteredJobs]);

  const filteredRows = useMemo(() => {
    if (agentFilter === 'all') return cardRows;
    return cardRows.filter(r => r.agentName === agentFilter);
  }, [cardRows, agentFilter]);

  const visibleRows = useMemo(() => {
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      if (sort.key === 'date') return a.date.localeCompare(b.date) * dir;
      if (sort.key === 'dcNo') return collator.compare(a.dcNo, b.dcNo) * dir;
      if (sort.key === 'billNo') return collator.compare(a.billNo, b.billNo) * dir;
      if (sort.key === 'agentName') return collator.compare(a.agentName, b.agentName) * dir;
      return 0;
    });
  }, [filteredRows, sort]);

  const totals = useMemo(() => visibleRows.reduce(
    (acc, r) => {
      acc.invoice += r.invoice;
      acc.commission += r.commission;
      acc.tds += r.tds;
      acc.netPayable += r.netPayable;
      acc.settled += r.settled;
      acc.pending += r.pending;
      return acc;
    },
    { invoice: 0, commission: 0, tds: 0, netPayable: 0, settled: 0, pending: 0 }
  ), [visibleRows]);

  // Per-agent income breakdown (always from filteredRows, not sort-dependent)
  const agentIncomeBreakdown = useMemo(() => {
    const map = new Map<string, { cards: number; commission: number; tds: number; netPayable: number; settled: number; pending: number }>();
    filteredRows.forEach(r => {
      const existing = map.get(r.agentName) ?? { cards: 0, commission: 0, tds: 0, netPayable: 0, settled: 0, pending: 0 };
      existing.cards += 1;
      existing.commission += r.commission;
      existing.tds += r.tds;
      existing.netPayable += r.netPayable;
      existing.settled += r.settled;
      existing.pending += r.pending;
      map.set(r.agentName, existing);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, totalIncome: data.commission + data.tds }))
      .sort((a, b) => b.totalIncome - a.totalIncome);
  }, [filteredRows]);

  const thClass = (key: SortKey) =>
    `extdc-th-sort${sort.key === key ? ' is-active' : ''}`;

  return (
    <div className="extdc-screen">
      <div className="extdc-header">
        <div>
          <h1 className="extdc-title">Commission DC</h1>
          <p className="extdc-desc">Agent work jobs — WW &amp; RMP</p>
        </div>
      </div>

      {/* Customer tabs */}
      <div className="extdc-customer-tabs">
        <button type="button" className={`extdc-ctab${activeTab === 'ww' ? ' active' : ''}`} onClick={() => switchTab('ww')}>
          WW — Ramani Cars
        </button>
        <button type="button" className={`extdc-ctab${activeTab === 'rmp' ? ' active' : ''}`} onClick={() => switchTab('rmp')}>
          RMP — Ramani Motors
        </button>
      </div>

      {/* Filters */}
      <div className="extdc-filters">
        <div className="extdc-filter-group">
          <label className="extdc-filter-label">Agent</label>
          <select className="extdc-select" title="Filter by agent" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
            <option value="all">All Agents</option>
            {agentNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="extdc-filter-group">
          <label className="extdc-filter-label">Type</label>
          <select className="extdc-select" title="Filter by DC type" value={extDcFilter} onChange={e => setExtDcFilter(e.target.value as ExtDcFilter)}>
            <option value="all">All</option>
            <option value="external">External DC</option>
            <option value="internal">Internal</option>
          </select>
        </div>
        <div className="extdc-filter-group">
          <label className="extdc-filter-label">Period</label>
          <div className="extdc-period-row">
            <div className="extdc-period-tabs">
              {(['month', 'quarter', 'half', 'all'] as PeriodType[]).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`extdc-period-tab${period === p ? ' active' : ''}`}
                  onClick={() => { setPeriod(p); setOffset(0); }}
                >
                  {p === 'month' ? 'Month' : p === 'quarter' ? 'Quarter' : p === 'half' ? 'Half Year' : 'All'}
                </button>
              ))}
            </div>
            {period !== 'all' && (
              <>
                <div className="extdc-period-nav">
                  <button type="button" className="extdc-nav-btn" onClick={() => setOffset(o => o - 1)} aria-label="Previous period">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <span className="extdc-nav-label">{periodRange.label}</span>
                  <button type="button" className="extdc-nav-btn" onClick={() => setOffset(o => o + 1)} disabled={offset >= 0} aria-label="Next period">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                {offset < 0 && (
                  <button type="button" className="extdc-today-btn" onClick={() => setOffset(0)}>Current</button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="extdc-stats">
        <div className="extdc-stat">
          <span className="extdc-stat-label">Invoice Total</span>
          <span className="extdc-stat-value">{formatCurrency(totals.invoice)}</span>
          <span className="extdc-stat-sub">Total billed</span>
        </div>
        <div className="extdc-stat extdc-stat--green">
          <span className="extdc-stat-label">SLW Commission</span>
          <span className="extdc-stat-value">{formatCurrency(totals.commission)}</span>
          <span className="extdc-stat-sub">Income retained</span>
        </div>
        <div className="extdc-stat extdc-stat--green">
          <span className="extdc-stat-label">TDS Retained</span>
          <span className="extdc-stat-value">{formatCurrency(totals.tds)}</span>
          <span className="extdc-stat-sub">Tax deducted</span>
        </div>
        <div className="extdc-stat">
          <span className="extdc-stat-label">Net Payable</span>
          <span className="extdc-stat-value">{formatCurrency(totals.netPayable)}</span>
          <span className="extdc-stat-sub">To send agents</span>
        </div>
        <div className="extdc-stat extdc-stat--green">
          <span className="extdc-stat-label">Already Sent</span>
          <span className="extdc-stat-value">{formatCurrency(totals.settled)}</span>
          <span className="extdc-stat-sub">Settled</span>
        </div>
        <div className={`extdc-stat${totals.pending > 0 ? ' extdc-stat--red' : ' extdc-stat--green'}`}>
          <span className="extdc-stat-label">Pending</span>
          <span className="extdc-stat-value">{formatCurrency(totals.pending)}</span>
          <span className="extdc-stat-sub">Still to send</span>
        </div>
      </div>

      {/* SLW Income breakdown by agent */}
      {agentIncomeBreakdown.length > 0 && (
        <div className="extdc-income-section">
          <div className="extdc-section-title">SLW Commission Income — by Agent</div>
          <div className="extdc-income-table-wrap">
            <table className="extdc-income-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="ta-r">Cards</th>
                  <th className="ta-r">Commission</th>
                  <th className="ta-r">TDS</th>
                  <th className="ta-r">Total Income</th>
                  <th className="ta-r">Net Payable</th>
                  <th className="ta-r">Sent</th>
                  <th className="ta-r">Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {agentIncomeBreakdown.map(row => (
                  <tr key={row.name}>
                    <td className="extdc-agent-name">{row.name}</td>
                    <td className="ta-r extdc-td-muted">{row.cards}</td>
                    <td className="ta-r extdc-td-green">{formatCurrency(row.commission)}</td>
                    <td className="ta-r extdc-td-green">{formatCurrency(row.tds)}</td>
                    <td className="ta-r extdc-income-total">{formatCurrency(row.totalIncome)}</td>
                    <td className="ta-r">{formatCurrency(row.netPayable)}</td>
                    <td className="ta-r extdc-td-green">{formatCurrency(row.settled)}</td>
                    <td className={`ta-r${row.pending > 0 ? ' extdc-td-red' : ' extdc-td-green'}`}>{formatCurrency(row.pending)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="extdc-tfoot-label">Total</td>
                  <td className="ta-r extdc-td-muted">{agentIncomeBreakdown.reduce((s, r) => s + r.cards, 0)}</td>
                  <td className="ta-r extdc-td-green">{formatCurrency(agentIncomeBreakdown.reduce((s, r) => s + r.commission, 0))}</td>
                  <td className="ta-r extdc-td-green">{formatCurrency(agentIncomeBreakdown.reduce((s, r) => s + r.tds, 0))}</td>
                  <td className="ta-r extdc-income-total">{formatCurrency(agentIncomeBreakdown.reduce((s, r) => s + r.totalIncome, 0))}</td>
                  <td className="ta-r">{formatCurrency(agentIncomeBreakdown.reduce((s, r) => s + r.netPayable, 0))}</td>
                  <td className="ta-r extdc-td-green">{formatCurrency(agentIncomeBreakdown.reduce((s, r) => s + r.settled, 0))}</td>
                  <td className={`ta-r${agentIncomeBreakdown.reduce((s, r) => s + r.pending, 0) > 0 ? ' extdc-td-red' : ' extdc-td-green'}`}>{formatCurrency(agentIncomeBreakdown.reduce((s, r) => s + r.pending, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Main table */}
      {visibleRows.length === 0 ? (
        <div className="extdc-empty">
          <p className="extdc-empty-title">No Comission DC records found</p>
          <p className="extdc-empty-sub">
            Comission DC agent work cards for {activeTab === 'ww' ? 'WW — Ramani Cars' : 'RMP — Ramani Motors'} will appear here
          </p>
        </div>
      ) : (
        <div className="extdc-table-wrap">
          <table className="extdc-table">
            <thead>
              <tr>
                <th
                  className={thClass('date')}
                  role="button" tabIndex={0}
                  onClick={() => toggleSort('date')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('date'); } }}
                >
                  Date{sortMark('date')}
                </th>
                <th>Card ID</th>
                <th
                  className={thClass('dcNo')}
                  role="button" tabIndex={0}
                  onClick={() => toggleSort('dcNo')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('dcNo'); } }}
                >
                  DC No{sortMark('dcNo')}
                </th>
                <th
                  className={thClass('billNo')}
                  role="button" tabIndex={0}
                  onClick={() => toggleSort('billNo')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('billNo'); } }}
                >
                  Bill No{sortMark('billNo')}
                </th>
                <th
                  className={thClass('agentName')}
                  role="button" tabIndex={0}
                  onClick={() => toggleSort('agentName')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('agentName'); } }}
                >
                  Agent{sortMark('agentName')}
                </th>
                <th className="ta-c">Ext DC</th>
                <th className="ta-r">Invoice</th>
                <th className="ta-r">SLW Commission</th>
                <th className="ta-r">TDS</th>
                <th className="ta-r">Net Payable</th>
                <th className="ta-r">Sent</th>
                <th className="ta-r">Pending</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(row => (
                <tr key={row.key}>
                  <td>{new Date(row.date).toLocaleDateString('en-IN')}</td>
                  <td className="extdc-card-id">{row.jobCardId}</td>
                  <td className="extdc-ref">{row.dcNo || '—'}</td>
                  <td className="extdc-ref">{row.billNo || '—'}</td>
                  <td className="extdc-agent-name">{row.agentName}</td>
                  <td className="ta-c">
                    {row.externalDc
                      ? <span className="extdc-badge extdc-badge--ext">Ext</span>
                      : <span className="extdc-badge extdc-badge--int">Int</span>}
                  </td>
                  <td className="ta-r">{formatCurrency(row.invoice)}</td>
                  <td className="ta-r extdc-td-green">{formatCurrency(row.commission)}</td>
                  <td className="ta-r extdc-td-green">{formatCurrency(row.tds)}</td>
                  <td className="ta-r">{formatCurrency(row.netPayable)}</td>
                  <td className="ta-r extdc-td-green">{formatCurrency(row.settled)}</td>
                  <td className={`ta-r${row.pending > 0 ? ' extdc-td-red' : ' extdc-td-green'}`}>
                    {formatCurrency(row.pending)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
