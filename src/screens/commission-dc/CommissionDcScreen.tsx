import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { useCommissionWorkersQuery } from '@/hooks/useCommissionWorkersQuery';
import { useCommissionPaymentsQuery } from '@/hooks/useCommissionPaymentsQuery';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { calculateWorkerCommissionSummary } from '@/lib/financeUtils';
import {
  getJobAgentCommissionIncome,
  getJobAgentNetPayable,
  getJobAgentSettlementPaid,
  getJobAgentSettlementPending,
  getJobAgentTdsAmount,
  getJobFinalBillValue,
  getJobWorkerCommissionExpense,
  isAgentWorkJob,
} from '@/lib/jobUtils';
import type { CommissionWorker, Job } from '@/types';
import './CommissionDcScreen.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionTab   = 'workers' | 'history' | 'agents';
type PeriodType   = 'month' | 'quarter' | 'half' | 'all';
type ExtDcFilter  = 'all' | 'external' | 'internal';
type CustomerFilter = 'all' | 'ww' | 'rmp';
type WorkerSortKey     = 'customer' | 'outstanding' | 'status';
type WorkerCardSortKey = 'date' | 'billNo' | 'dcNo' | 'workerName' | 'invoice' | 'commission' | 'pending';
type WorkerDetailSortKey = 'jobCardDate' | 'billNo' | 'dcNo' | 'dcDate' | 'commission';
type AgentDetailSortKey = 'jobCardDate' | 'billNo' | 'dcNo' | 'dcDate' | 'commission';
type WorkerRowStatus   = 'Pending' | 'Settled';
type AgentSortKey =
  | 'date'
  | 'card'
  | 'dcNo'
  | 'billNo'
  | 'agentName'
  | 'customer'
  | 'type'
  | 'invoice'
  | 'commission'
  | 'netPayable'
  | 'settled'
  | 'pending';

interface WorkerRow {
  workerId: number;
  workerName: string;
  customerId: number;
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  customerName: string;
  status: WorkerRowStatus;
}

interface AgentCardRow {
  key: string;
  jobId: number;
  date: string;
  dcDate: string;
  customerName: string;
  jobCardId: string;
  agentName: string;
  dcNo: string;
  billNo: string;
  externalDc: boolean;
  invoice: number;
  commission: number;
  tds: number;
  netPayable: number;
  settled: number;
  pending: number;
}

interface WorkerJobCardDetail {
  key: string;
  jobCardDate: string;
  billNo: string;
  dcNo: string;
  dcDate: string;
  commission: number;
}

interface WorkerCardRow {
  key: string;
  workerId: number;
  workerName: string;
  customerId: number;
  customerName: string;
  date: string;
  jobCardId: string;
  workTypeName: string;
  dcNo: string;
  dcDate: string;
  billNo: string;
  invoice: number;
  commission: number;
  workerOutstanding: number;
}

interface AgentJobCardDetail {
  key: string;
  jobCardDate: string;
  billNo: string;
  dcNo: string;
  dcDate: string;
  commission: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeToken(value?: string) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function resolveCommissionWorkerId(job: Job, workers: CommissionWorker[]): number | null {
  if (typeof job.commissionWorkerId === 'number') return job.commissionWorkerId;
  const name = job.commissionWorkerName?.trim();
  if (!name) return null;
  const norm = name.toLowerCase();
  return workers.find(w => w.customerId === job.customerId && w.name.toLowerCase() === norm)?.id ?? null;
}

function getPeriodRange(period: PeriodType, offset: number): { start: string | null; end: string | null; label: string } {
  if (period === 'all') return { start: null, end: null, label: 'All Time' };
  const now = new Date();
  if (period === 'month') {
    let m = now.getMonth() + offset;
    const y = now.getFullYear() + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    const from = new Date(y, m, 1);
    const to   = new Date(y, m + 1, 0);
    return { start: getLocalDateString(from), end: getLocalDateString(to), label: from.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
  }
  if (period === 'quarter') {
    let q = Math.floor(now.getMonth() / 3) + offset;
    const y = now.getFullYear() + Math.floor(q / 4);
    q = ((q % 4) + 4) % 4;
    const from = new Date(y, q * 3, 1);
    const to   = new Date(y, q * 3 + 3, 0);
    return { start: getLocalDateString(from), end: getLocalDateString(to), label: `Q${q + 1} ${y}` };
  }
  let h = (now.getMonth() < 6 ? 0 : 1) + offset;
  const y = now.getFullYear() + Math.floor(h / 2);
  h = ((h % 2) + 2) % 2;
  const from = new Date(y, h * 6, 1);
  const to   = new Date(y, h * 6 + 6, 0);
  return { start: getLocalDateString(from), end: getLocalDateString(to), label: `H${h + 1} ${y}` };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommissionDcScreen() {
  const {
    jobs,
    addCommissionPayment, deleteCommissionPayment, getCustomer, updateJob,
  } = useDataStore();
  const { data: customers = [] } = useCustomersQuery();
  const { data: commissionWorkers = [] } = useCommissionWorkersQuery();
  const { data: commissionPayments = [] } = useCommissionPaymentsQuery();
  const toast = useToast();
  const today = getLocalDateString(new Date());

  // ── Section ──────────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<SectionTab>('workers');

  // ── Workers tab ──────────────────────────────────────────────────────────────
  const [showPaymentForm, setShowPaymentForm]   = useState(false);
  const [selectedWorker, setSelectedWorker]     = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount]       = useState('');
  const [paymentDate, setPaymentDate]           = useState(today);
  const [paymentNotes, setPaymentNotes]         = useState('');
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [confirmDeleteId, setConfirmDeleteId]   = useState<number | null>(null);
  const [workerForDetails, setWorkerForDetails] = useState<number | null>(null);
  const [workerSort] = useState<{ key: WorkerSortKey; order: 'asc' | 'desc' } | null>(null);
  const [workerCardSort, setWorkerCardSort] = useState<{ key: WorkerCardSortKey; order: 'asc' | 'desc' } | null>(null);
  const [workerDetailSort, setWorkerDetailSort] = useState<{ key: WorkerDetailSortKey; order: 'asc' | 'desc' } | null>(null);
  const [workerOnlyPending, setWorkerOnlyPending] = useState(false);
  const [workerFilter, setWorkerFilter] = useState<string>('all');
  const [workerCustomerFilter, setWorkerCustomerFilter] = useState<CustomerFilter>('all');
  const [workerPeriod, setWorkerPeriod] = useState<PeriodType>('month');
  const [workerOffset, setWorkerOffset] = useState(0);

  // ── Agent work tab ────────────────────────────────────────────────────────────
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all');
  const [extDcFilter, setExtDcFilter]       = useState<ExtDcFilter>('all');
  const [period, setPeriod]                 = useState<PeriodType>('month');
  const [offset, setOffset]                 = useState(0);
  const [agentFilter, setAgentFilter]       = useState<string>('all');
  const [onlyPending, setOnlyPending]       = useState(false);
  const [agentSort, setAgentSort] = useState<{ key: AgentSortKey; order: 'asc' | 'desc' } | null>(null);
  const [agentForDetails, setAgentForDetails] = useState<string | null>(null);
  const [agentDetailSort, setAgentDetailSort] = useState<{ key: AgentDetailSortKey; order: 'asc' | 'desc' } | null>(null);

  // ── Agent payment form ────────────────────────────────────────────────────────
  const [showAgentPayForm, setShowAgentPayForm]   = useState(false);
  const [apAgent, setApAgent]                     = useState('');
  const [apAmount, setApAmount]                   = useState('');
  const [apDate, setApDate]                       = useState(today);
  const [apNotes, setApNotes]                     = useState('');
  const [isApSubmitting, setIsApSubmitting]       = useState(false);
  const [apConfirmDeleteId, setApConfirmDeleteId] = useState<number | null>(null);

  // ── Customer lookups ─────────────────────────────────────────────────────────
  const wwCustomer = useMemo(
    () => customers.find(c => normalizeToken(c.shortCode) === 'ww' || normalizeToken(c.name).includes('ramanicars')),
    [customers],
  );
  const rmpCustomer = useMemo(
    () => customers.find(c => normalizeToken(c.shortCode) === 'rmp' || normalizeToken(c.name).includes('ramanimotors')),
    [customers],
  );

  // ── Worker data ───────────────────────────────────────────────────────────────
  const workerSummary = useMemo(
    () => calculateWorkerCommissionSummary(jobs, commissionPayments, commissionWorkers),
    [jobs, commissionPayments, commissionWorkers],
  );

  const workerRows = useMemo<WorkerRow[]>(
    () => workerSummary.map(w => ({
      ...w,
      customerName: getCustomer(w.customerId)?.name || '—',
      status: w.outstanding > 0 ? 'Pending' : 'Settled',
    })),
    [workerSummary, getCustomer],
  );

  const sortedWorkerRows = useMemo(() => {
    if (!workerSort) return workerRows;
    const col = new Intl.Collator('en-IN', { sensitivity: 'base' });
    const dir = workerSort.order === 'asc' ? 1 : -1;
    return [...workerRows].sort((a, b) => {
      if (workerSort.key === 'customer')    return col.compare(a.customerName, b.customerName) * dir;
      if (workerSort.key === 'outstanding') return (a.outstanding - b.outstanding) * dir;
      const rank: Record<WorkerRowStatus, number> = { Pending: 0, Settled: 1 };
      return (rank[a.status] - rank[b.status]) * dir;
    });
  }, [workerRows, workerSort]);

  const workerPeriodRange = useMemo(() => getPeriodRange(workerPeriod, workerOffset), [workerPeriod, workerOffset]);

  const workerCardRows = useMemo<WorkerCardRow[]>(() => {
    const grouped = new Map<string, Job[]>();
    jobs.forEach((job) => {
      const commission = getJobWorkerCommissionExpense(job);
      if (commission <= 0) return;
      const workerId = resolveCommissionWorkerId(job, commissionWorkers);
      if (workerId === null) return;
      const cardKey = job.jobCardId ? `card:${job.jobCardId}` : `legacy:${job.id}`;
      const key = `${workerId}:${cardKey}`;
      const list = grouped.get(key) ?? [];
      list.push(job);
      grouped.set(key, list);
    });

    const workerOutstandingMap = new Map<number, number>();
    workerRows.forEach((row) => workerOutstandingMap.set(row.workerId, row.outstanding));

    return Array.from(grouped.entries()).map(([key, groupJobs]) => {
      const sorted = [...groupJobs].sort((a, b) => (a.jobCardLine || a.id) - (b.jobCardLine || b.id));
      const primary = sorted[0];
      const workerId = resolveCommissionWorkerId(primary, commissionWorkers) ?? -1;
      const workerName =
        commissionWorkers.find((w) => w.id === workerId)?.name ||
        primary.commissionWorkerName ||
        'Worker';
      return {
        key,
        workerId,
        workerName,
        customerId: primary.customerId,
        customerName: getCustomer(primary.customerId)?.name || '—',
        date: primary.date,
        jobCardId: primary.jobCardId || `LEGACY-${primary.id}`,
        workTypeName: primary.workTypeName || '—',
        dcNo: primary.dcNo || '',
        dcDate: primary.dcDate || '',
        billNo: primary.billNo || '',
        invoice: sorted.reduce((sum, j) => sum + getJobFinalBillValue(j), 0),
        commission: sorted.reduce((sum, j) => sum + getJobWorkerCommissionExpense(j), 0),
        workerOutstanding: workerOutstandingMap.get(workerId) ?? 0,
      };
    });
  }, [jobs, commissionWorkers, workerRows, getCustomer]);

  const filteredWorkerCardRows = useMemo(() => {
    let rows = [...workerCardRows].sort((a, b) => b.date.localeCompare(a.date));
    if (workerCustomerFilter === 'ww') rows = rows.filter((r) => wwCustomer && r.customerId === wwCustomer.id);
    if (workerCustomerFilter === 'rmp') rows = rows.filter((r) => rmpCustomer && r.customerId === rmpCustomer.id);
    if (workerPeriodRange.start) rows = rows.filter((r) => r.date >= workerPeriodRange.start!);
    if (workerPeriodRange.end) rows = rows.filter((r) => r.date <= workerPeriodRange.end!);
    if (workerFilter === 'bhai') rows = rows.filter((r) => r.workerName.toLowerCase().includes('bhai'));
    if (workerFilter === 'raja') rows = rows.filter((r) => r.workerName.toLowerCase().includes('raja'));
    if (workerFilter === 'palanisamy') rows = rows.filter((r) => r.workerName.toLowerCase().includes('palanisamy'));
    if (workerOnlyPending) rows = rows.filter((r) => r.workerOutstanding > 0);
    return rows;
  }, [
    workerCardRows,
    workerCustomerFilter,
    wwCustomer,
    rmpCustomer,
    workerPeriodRange,
    workerFilter,
    workerOnlyPending,
  ]);

  const visibleWorkerCardRows = useMemo(() => {
    const col = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
    const base = [...filteredWorkerCardRows];
    if (!workerCardSort) return base;
    const dir = workerCardSort.order === 'asc' ? 1 : -1;
    return base.sort((a, b) => {
      if (workerCardSort.key === 'date')       return a.date.localeCompare(b.date) * dir;
      if (workerCardSort.key === 'billNo')     return col.compare(a.billNo, b.billNo) * dir;
      if (workerCardSort.key === 'dcNo')       return col.compare(a.dcNo, b.dcNo) * dir;
      if (workerCardSort.key === 'workerName') return col.compare(a.workerName, b.workerName) * dir;
      if (workerCardSort.key === 'invoice')    return (a.invoice - b.invoice) * dir;
      if (workerCardSort.key === 'commission') return (a.commission - b.commission) * dir;
      return (a.workerOutstanding - b.workerOutstanding) * dir;
    });
  }, [filteredWorkerCardRows, workerCardSort]);

  const filteredWorkerRows = useMemo(() => {
    const ids = new Set(filteredWorkerCardRows.map((r) => r.workerId));
    return sortedWorkerRows.filter((r) => ids.has(r.workerId));
  }, [filteredWorkerCardRows, sortedWorkerRows]);

  const workerTotals = useMemo(
    () => filteredWorkerRows.reduce(
      (acc, row) => {
        acc.totalDue += row.totalDue;
        acc.totalPaid += row.totalPaid;
        acc.outstanding += row.outstanding;
        return acc;
      },
      { totalDue: 0, totalPaid: 0, outstanding: 0 },
    ),
    [filteredWorkerRows],
  );

  const workerBreakdown = useMemo(() => {
    const cardsByWorker = new Map<number, number>();
    filteredWorkerCardRows.forEach((r) => cardsByWorker.set(r.workerId, (cardsByWorker.get(r.workerId) ?? 0) + 1));
    return filteredWorkerRows
      .map((row) => ({
        workerId: row.workerId,
        workerName: row.workerName,
        cards: cardsByWorker.get(row.workerId) ?? 0,
        commission: row.totalDue,
        settled: row.totalPaid,
        pending: row.outstanding,
      }))
      .sort((a, b) => b.pending - a.pending || b.commission - a.commission);
  }, [filteredWorkerRows, filteredWorkerCardRows]);

  const detailWorkerSummary = useMemo(() => {
    if (workerForDetails === null) return null;
    const filtered = workerBreakdown.find((row) => row.workerId === workerForDetails);
    if (filtered) {
      return {
        workerId: filtered.workerId,
        workerName: filtered.workerName,
        customerId: 0,
        totalDue: filtered.commission,
        totalPaid: filtered.settled,
        outstanding: filtered.pending,
      };
    }
    return workerSummary.find((worker) => worker.workerId === workerForDetails) ?? null;
  }, [workerForDetails, workerBreakdown, workerSummary]);

  const detailWorkerCards = useMemo<WorkerJobCardDetail[]>(() => {
    if (workerForDetails === null) return [];
    return filteredWorkerCardRows
      .filter((row) => row.workerId === workerForDetails)
      .map((row) => ({
        key: row.key,
        jobCardDate: row.date,
        billNo: row.billNo,
        dcNo: row.dcNo,
        dcDate: row.dcDate,
        commission: row.commission,
      }))
      .sort((a, b) => b.jobCardDate.localeCompare(a.jobCardDate) || b.commission - a.commission);
  }, [filteredWorkerCardRows, workerForDetails]);

  const visibleDetailWorkerCards = useMemo(() => {
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
    const base = [...detailWorkerCards];
    if (!workerDetailSort) return base;
    const dir = workerDetailSort.order === 'asc' ? 1 : -1;
    return base.sort((a, b) => {
      if (workerDetailSort.key === 'jobCardDate') return a.jobCardDate.localeCompare(b.jobCardDate) * dir;
      if (workerDetailSort.key === 'billNo') return collator.compare(a.billNo || '', b.billNo || '') * dir;
      if (workerDetailSort.key === 'dcNo') return collator.compare(a.dcNo || '', b.dcNo || '') * dir;
      if (workerDetailSort.key === 'dcDate') return (a.dcDate || '').localeCompare(b.dcDate || '') * dir;
      return (a.commission - b.commission) * dir;
    });
  }, [detailWorkerCards, workerDetailSort]);

  // ── Agent work data ───────────────────────────────────────────────────────────
  const periodRange = useMemo(() => getPeriodRange(period, offset), [period, offset]);

  const agentJobs = useMemo(() => jobs.filter(job => {
    if (!isAgentWorkJob(job)) return false;
    if (customerFilter === 'ww'  && (!wwCustomer  || job.customerId !== wwCustomer.id))  return false;
    if (customerFilter === 'rmp' && (!rmpCustomer || job.customerId !== rmpCustomer.id)) return false;
    if (extDcFilter === 'external' && !job.externalDc)  return false;
    if (extDcFilter === 'internal' &&  job.externalDc)  return false;
    if (periodRange.start && job.date < periodRange.start) return false;
    if (periodRange.end   && job.date > periodRange.end)   return false;
    return true;
  }), [jobs, customerFilter, extDcFilter, periodRange, wwCustomer, rmpCustomer]);

  const agentCardRows = useMemo<AgentCardRow[]>(() => {
    const groups = new Map<string, Job[]>();
    agentJobs.forEach(job => {
      const key = job.jobCardId ? `card:${job.jobCardId}` : `legacy:${job.id}`;
      const list = groups.get(key) ?? [];
      list.push(job);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).map(([key, groupJobs]) => {
      const sorted = [...groupJobs].sort((a, b) => (a.jobCardLine || a.id) - (b.jobCardLine || b.id));
      const primary = sorted[0];
      return {
        key,
        jobId:        primary.id,
        date:         primary.date,
        dcDate:       primary.dcDate || '',
        customerName: getCustomer(primary.customerId)?.name || '—',
        jobCardId:    primary.jobCardId || `LEGACY-${primary.id}`,
        agentName:    primary.agentName || primary.rmpHandler || 'Agent',
        dcNo:         primary.dcNo  || '',
        billNo:       primary.billNo || '',
        externalDc:   Boolean(primary.externalDc),
        invoice:    sorted.reduce((s, j) => s + getJobFinalBillValue(j), 0),
        commission: sorted.reduce((s, j) => s + getJobAgentCommissionIncome(j), 0),
        tds:        sorted.reduce((s, j) => s + getJobAgentTdsAmount(j), 0),
        netPayable: sorted.reduce((s, j) => s + getJobAgentNetPayable(j), 0),
        settled:    sorted.reduce((s, j) => s + getJobAgentSettlementPaid(j), 0),
        pending:    Math.max(0, sorted.reduce((s, j) => s + getJobAgentSettlementPending(j), 0)),
      };
    });
  }, [agentJobs, getCustomer]);

  const uniqueAgentNames = useMemo(() => {
    const s = new Set<string>();
    agentCardRows.forEach(r => s.add(r.agentName));
    return Array.from(s).sort();
  }, [agentCardRows]);

  // All unique agent names from entire job list (for payment form dropdown)
  const allAgentNames = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach(j => { if (isAgentWorkJob(j) && (j.agentName || j.rmpHandler)) s.add(j.agentName || j.rmpHandler || ''); });
    return Array.from(s).filter(Boolean).sort();
  }, [jobs]);

  // Agent payment records (from commissionPayments with paymentType === 'agent')
  const agentPaymentRecords = useMemo(
    () => commissionPayments.filter(p => p.paymentType === 'agent').sort((a, b) => b.date.localeCompare(a.date)),
    [commissionPayments],
  );

  // Per-agent total paid from payment records (for breakdown context)
  const agentPaidMap = useMemo(() => {
    const map = new Map<string, number>();
    agentPaymentRecords.forEach(p => {
      const name = p.agentName || p.workerName;
      map.set(name, (map.get(name) ?? 0) + p.amount);
    });
    return map;
  }, [agentPaymentRecords]);

  // All-time per-agent balance from job cards (no period/customer filter) — used in payment form
  const allAgentBalanceMap = useMemo(() => {
    const map = new Map<string, { netPayable: number; settled: number; pending: number }>();
    jobs.forEach(job => {
      if (!isAgentWorkJob(job)) return;
      const name = job.agentName || job.rmpHandler || '';
      if (!name) return;
      const e = map.get(name) ?? { netPayable: 0, settled: 0, pending: 0 };
      e.netPayable += getJobAgentNetPayable(job);
      e.settled    += getJobAgentSettlementPaid(job);
      map.set(name, e);
    });
    map.forEach(v => { v.pending = Math.max(0, v.netPayable - v.settled); });
    return map;
  }, [jobs]);

  const filteredAgentRows = useMemo(() => {
    let rows = agentCardRows;
    if (agentFilter !== 'all') rows = rows.filter(r => r.agentName === agentFilter);
    if (onlyPending)           rows = rows.filter(r => r.pending > 0);
    return rows;
  }, [agentCardRows, agentFilter, onlyPending]);

  const visibleAgentRows = useMemo(() => {
    const col = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
    const base = [...filteredAgentRows].sort((a, b) => b.date.localeCompare(a.date));
    if (!agentSort) return base;
    const dir = agentSort.order === 'asc' ? 1 : -1;
    return base.sort((a, b) => {
      if (agentSort.key === 'date')      return a.date.localeCompare(b.date) * dir;
      if (agentSort.key === 'card')      return col.compare(a.jobCardId, b.jobCardId) * dir;
      if (agentSort.key === 'dcNo')      return col.compare(a.dcNo, b.dcNo) * dir;
      if (agentSort.key === 'billNo')    return col.compare(a.billNo, b.billNo) * dir;
      if (agentSort.key === 'agentName') return col.compare(a.agentName, b.agentName) * dir;
      if (agentSort.key === 'customer')  return col.compare(a.customerName, b.customerName) * dir;
      if (agentSort.key === 'type')      return (Number(a.externalDc) - Number(b.externalDc)) * dir;
      if (agentSort.key === 'invoice')   return (a.invoice - b.invoice) * dir;
      if (agentSort.key === 'commission') return (a.commission - b.commission) * dir;
      if (agentSort.key === 'netPayable') return (a.netPayable - b.netPayable) * dir;
      if (agentSort.key === 'settled')    return (a.settled - b.settled) * dir;
      return (a.pending - b.pending) * dir;
    });
  }, [filteredAgentRows, agentSort]);

  const agentBreakdown = useMemo(() => {
    const map = new Map<string, { cards: number; commission: number; tds: number; netPayable: number; settled: number; pending: number }>();
    filteredAgentRows.forEach(r => {
      const e = map.get(r.agentName) ?? { cards: 0, commission: 0, tds: 0, netPayable: 0, settled: 0, pending: 0 };
      e.cards += 1; e.commission += r.commission; e.tds += r.tds;
      e.netPayable += r.netPayable; e.settled += r.settled; e.pending += r.pending;
      map.set(r.agentName, e);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d, totalIncome: d.commission + d.tds }))
      .sort((a, b) => b.totalIncome - a.totalIncome);
  }, [filteredAgentRows]);

  const agentTotals = useMemo(() => visibleAgentRows.reduce(
    (acc, r) => {
      acc.invoice    += r.invoice;    acc.commission += r.commission;
      acc.tds        += r.tds;        acc.netPayable += r.netPayable;
      acc.settled    += r.settled;    acc.pending    += r.pending;
      return acc;
    },
    { invoice: 0, commission: 0, tds: 0, netPayable: 0, settled: 0, pending: 0 },
  ), [visibleAgentRows]);

  const detailAgentSummary = useMemo(() => {
    if (!agentForDetails) return null;
    return agentBreakdown.find((row) => row.name === agentForDetails) ?? null;
  }, [agentBreakdown, agentForDetails]);

  const detailAgentCards = useMemo<AgentJobCardDetail[]>(() => {
    if (!agentForDetails) return [];
    return filteredAgentRows
      .filter((row) => row.agentName === agentForDetails)
      .map((row) => ({
        key: row.key,
        jobCardDate: row.date,
        billNo: row.billNo,
        dcNo: row.dcNo,
        dcDate: row.dcDate,
        commission: row.commission,
      }))
      .sort((a, b) => b.jobCardDate.localeCompare(a.jobCardDate) || b.commission - a.commission);
  }, [filteredAgentRows, agentForDetails]);

  const visibleDetailAgentCards = useMemo(() => {
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
    const base = [...detailAgentCards];
    if (!agentDetailSort) return base;
    const dir = agentDetailSort.order === 'asc' ? 1 : -1;
    return base.sort((a, b) => {
      if (agentDetailSort.key === 'jobCardDate') return a.jobCardDate.localeCompare(b.jobCardDate) * dir;
      if (agentDetailSort.key === 'billNo') return collator.compare(a.billNo || '', b.billNo || '') * dir;
      if (agentDetailSort.key === 'dcNo') return collator.compare(a.dcNo || '', b.dcNo || '') * dir;
      if (agentDetailSort.key === 'dcDate') return (a.dcDate || '').localeCompare(b.dcDate || '') * dir;
      return (a.commission - b.commission) * dir;
    });
  }, [detailAgentCards, agentDetailSort]);


  // ── Sort helpers ──────────────────────────────────────────────────────────────
  const toggleAgentSort = (key: AgentSortKey) =>
    setAgentSort(prev => prev?.key === key
      ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
      : { key, order: key === 'date' ? 'desc' : 'asc' });
  const agentSortMark = (key: AgentSortKey) =>
    !agentSort || agentSort.key !== key ? ' \u2195' : agentSort.order === 'asc' ? ' \u2191' : ' \u2193';

  const toggleWorkerCardSort = (key: WorkerCardSortKey) =>
    setWorkerCardSort(prev => prev?.key === key
      ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
      : { key, order: key === 'date' ? 'desc' : 'asc' });
  const wcSortMark = (key: WorkerCardSortKey) =>
    !workerCardSort || workerCardSort.key !== key ? ' \u2195' : workerCardSort.order === 'asc' ? ' \u2191' : ' \u2193';

  const toggleWorkerDetailSort = (key: WorkerDetailSortKey) =>
    setWorkerDetailSort((prev) =>
      prev?.key === key
        ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key === 'jobCardDate' || key === 'dcDate' || key === 'commission' ? 'desc' : 'asc' },
    );
  const workerDetailSortMark = (key: WorkerDetailSortKey) =>
    !workerDetailSort || workerDetailSort.key !== key ? ' \u2195' : workerDetailSort.order === 'asc' ? ' \u2191' : ' \u2193';

  const toggleAgentDetailSort = (key: AgentDetailSortKey) =>
    setAgentDetailSort((prev) =>
      prev?.key === key
        ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key === 'jobCardDate' || key === 'dcDate' || key === 'commission' ? 'desc' : 'asc' },
    );
  const agentDetailSortMark = (key: AgentDetailSortKey) =>
    !agentDetailSort || agentDetailSort.key !== key ? ' \u2195' : agentDetailSort.order === 'asc' ? ' \u2191' : ' \u2193';

  // ── Payment handlers ──────────────────────────────────────────────────────────
  const handleRecordPayment = async () => {
    if (!selectedWorker) { toast.error('Error', 'Please select a worker'); return; }
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) { toast.error('Error', 'Amount must be greater than 0'); return; }
    const worker = commissionWorkers.find(w => w.id === selectedWorker);
    if (!worker) { toast.error('Error', 'Worker not found'); return; }
    setIsSubmitting(true);
    try {
      await addCommissionPayment({
        workerId: selectedWorker, workerName: worker.name, customerId: worker.customerId,
        jobIds: [], amount: parseFloat(paymentAmount), date: paymentDate, notes: paymentNotes || undefined,
      });
      toast.success('Success', 'Payment recorded');
      setSelectedWorker(null); setPaymentAmount(''); setPaymentDate(today); setPaymentNotes(''); setShowPaymentForm(false);
    } catch { toast.error('Error', 'Failed to record payment'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeletePayment = async (id: number) => {
    try { await deleteCommissionPayment(id); toast.success('Deleted', 'Payment removed'); }
    catch { toast.error('Error', 'Failed to delete payment'); }
    finally { setConfirmDeleteId(null); }
  };

  const handleRecordAgentPayment = async () => {
    if (!apAgent) { toast.error('Error', 'Please select an agent'); return; }
    if (!apAmount || parseFloat(apAmount) <= 0) { toast.error('Error', 'Amount must be greater than 0'); return; }
    setIsApSubmitting(true);
    try {
      await addCommissionPayment({
        workerId: -1,
        workerName: apAgent,
        customerId: 0,
        jobIds: [],
        amount: parseFloat(apAmount),
        date: apDate,
        notes: apNotes || undefined,
        paymentType: 'agent',
        agentName: apAgent,
      });
      toast.success('Success', `Payment to ${apAgent} recorded`);
      setApAgent(''); setApAmount(''); setApDate(today); setApNotes(''); setShowAgentPayForm(false);
    } catch { toast.error('Error', 'Failed to record agent payment'); }
    finally { setIsApSubmitting(false); }
  };

  const handleDeleteAgentPayment = async (id: number) => {
    try { await deleteCommissionPayment(id); toast.success('Deleted', 'Agent payment removed'); }
    catch { toast.error('Error', 'Failed to delete payment'); }
    finally { setApConfirmDeleteId(null); }
  };

  const handleSettle = async (row: AgentCardRow) => {
    const input = window.prompt(
      `Set settled amount for ${row.agentName} — ${row.jobCardId}\nNet payable: ${formatCurrency(row.netPayable)}`,
      String(row.netPayable),
    );
    if (input === null) return;
    const val = Number(input);
    if (!Number.isFinite(val) || val < 0) { toast.error('Error', 'Enter a valid amount'); return; }
    try { await updateJob(row.jobId, { agentSettlementPaidAmount: val }); toast.success('Updated', `Settlement saved for ${row.agentName}`); }
    catch { toast.error('Error', 'Failed to update settlement'); }
  };

  // ── Chevron icons ─────────────────────────────────────────────────────────────
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

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="cd-screen">

      {/* ── Header ── */}
      <div className="cd-pg-header">
        <div>
          <h1 className="cd-pg-title">Commission DC</h1>
          <p className="cd-pg-desc">Commission workers, payments and agent work tracking</p>
        </div>
      </div>


      {/* ── Section nav ── */}
      <div className="cd-section-nav">
        {(['workers', 'agents', 'history'] as SectionTab[]).map(s => (
          <button key={s} type="button"
            className={`cd-section-tab${activeSection === s ? ' active' : ''}`}
            onClick={() => setActiveSection(s)}>
            {s === 'workers' ? 'Worker' : s === 'agents' ? 'Agent Work' : 'Payment History'}
          </button>
        ))}
      </div>

      {/* ══════════════════ WORKERS ══════════════════ */}
      {activeSection === 'workers' && (
        <>
          <div className="records-toolbar cd-toolbar">
            <div>
              <select
                className="cd-agent-select"
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value)}
                title="Filter by worker"
              >
                <option value="all">All</option>
                <option value="bhai">Bhai</option>
                <option value="raja">Raja</option>
                <option value="palanisamy">Palanisamy</option>
              </select>
            </div>

            <div className="records-period-tabs">
              {(['month', 'quarter', 'half', 'all'] as PeriodType[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`records-period-tab${workerPeriod === p ? ' active' : ''}`}
                  onClick={() => { setWorkerPeriod(p); setWorkerOffset(0); }}
                >
                  {p === 'month' ? 'Month' : p === 'quarter' ? 'Quarter' : p === 'half' ? 'Half-Year' : 'All'}
                </button>
              ))}
            </div>

            {workerPeriod !== 'all' && (
              <>
                <div className="records-day-nav-shell">
                  <button type="button" className="records-nav-btn" onClick={() => setWorkerOffset((o) => o - 1)} aria-label="Previous period"><ChevL /></button>
                  <span className="records-period-label">{workerPeriodRange.label}</span>
                  <button type="button" className="records-nav-btn" onClick={() => setWorkerOffset((o) => o + 1)} disabled={workerOffset >= 0} aria-label="Next period"><ChevR /></button>
                </div>
                {workerOffset < 0 && <button type="button" className="records-today-btn" onClick={() => setWorkerOffset(0)}>Current</button>}
              </>
            )}

            <div className="records-payment-filter">
              <button type="button" className={`records-pf-btn${workerOnlyPending ? ' active' : ''}`} onClick={() => setWorkerOnlyPending((v) => !v)}>
                Pending Only
              </button>
            </div>

            <div className="records-toolbar-end">
              {filteredWorkerCardRows.length > 0 && (
                <span className="records-count">{filteredWorkerCardRows.length} card{filteredWorkerCardRows.length !== 1 ? 's' : ''}</span>
              )}
              <select
                className="cd-agent-select"
                value={workerCustomerFilter}
                onChange={(e) => setWorkerCustomerFilter(e.target.value as CustomerFilter)}
                title="Filter by customer"
              >
                <option value="all">All Customers</option>
                <option value="ww">WW</option>
                <option value="rmp">RMP</option>
              </select>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentForm((v) => !v)}>
                {showPaymentForm ? 'Cancel' : '+ Record Payment'}
              </button>
            </div>
          </div>

          {showPaymentForm && (
            <div className="cd-form-box">
              <div className="cd-form-title">Record Commission Payment</div>
              <div className="cd-form-grid">
                <div className="cd-field">
                  <label className="cd-label" htmlFor="cd-worker">Worker</label>
                  <select id="cd-worker" className="cd-select"
                    value={selectedWorker ? String(selectedWorker) : ''}
                    onChange={e => setSelectedWorker(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Select a worker…</option>
                    {[...workerSummary].sort((a, b) => a.workerName.localeCompare(b.workerName)).map(w => (
                      <option key={w.workerId} value={String(w.workerId)}>
                        {w.workerName} ({getCustomer(w.customerId)?.shortCode || w.customerId})
                      </option>
                    ))}
                  </select>
                  {selectedWorker && (() => {
                    const w = workerSummary.find(ws => ws.workerId === selectedWorker);
                    return w ? (
                      <p className="cd-hint">
                        Outstanding: <strong>{formatCurrency(w.outstanding)}</strong>
                        {w.outstanding <= 0 && <span className="cd-hint-settled"> · fully settled</span>}
                      </p>
                    ) : null;
                  })()}
                </div>
                <div className="cd-field">
                  <label className="cd-label" htmlFor="cd-amount">Amount (₹)</label>
                  <input id="cd-amount" type="number" className="cd-input"
                    value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="0.00" step="0.01" min="0" />
                </div>
                <div className="cd-field">
                  <label className="cd-label" htmlFor="cd-date">Date</label>
                  <input id="cd-date" type="date" className="cd-input"
                    value={paymentDate} onChange={e => setPaymentDate(e.target.value)} max={today} />
                </div>
                <div className="cd-field cd-field--full">
                  <label className="cd-label" htmlFor="cd-notes">Notes (optional)</label>
                  <textarea id="cd-notes" className="cd-textarea" rows={2}
                    value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)}
                    placeholder="Add any notes…" />
                </div>
              </div>
              <div className="cd-form-footer">
                <button type="button" className="btn btn-accent" onClick={() => void handleRecordPayment()} disabled={isSubmitting}>
                  {isSubmitting ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
            </div>
          )}

          <div className="cd-agent-tiles">
            <div className="records-stat">
              <span className="records-stat-label">Cards</span>
              <span className="records-stat-value">{filteredWorkerCardRows.length}</span>
              <span className="records-stat-sub">Job cards with commission</span>
            </div>
            <div className="records-stat records-stat--hoverable">
              <span className="records-stat-label">Total Due</span>
              <span className="records-stat-value">{formatCurrency(workerTotals.totalDue)}</span>
              <span className="records-stat-sub">Commission earned by workers</span>
              <div className="records-breakdown" role="tooltip">
                <div className="breakdown-header">Total Due</div>
                <div className="breakdown-items">
                  <div className="breakdown-item"><span>Sum of commission across all filtered job cards</span></div>
                  <div className="breakdown-item"><span>Paid</span><span>{formatCurrency(workerTotals.totalPaid)}</span></div>
                  <div className="breakdown-item"><span>Outstanding</span><span>{formatCurrency(workerTotals.outstanding)}</span></div>
                </div>
              </div>
            </div>
            <div className="records-stat records-stat--green records-stat--hoverable">
              <span className="records-stat-label">Total Paid</span>
              <span className="records-stat-value">{formatCurrency(workerTotals.totalPaid)}</span>
              <span className="records-stat-sub">Already distributed</span>
              <div className="records-breakdown" role="tooltip">
                <div className="breakdown-header">Total Paid</div>
                <div className="breakdown-items">
                  <div className="breakdown-item"><span>Commission payments recorded for filtered workers</span></div>
                </div>
              </div>
            </div>
            <div className={`records-stat records-stat--hoverable${workerTotals.outstanding > 0 ? ' records-stat--red' : ' records-stat--green'}`}>
              <span className="records-stat-label">Outstanding</span>
              <span className="records-stat-value">{formatCurrency(workerTotals.outstanding)}</span>
              <span className="records-stat-sub">Still owed to workers</span>
              <div className="records-breakdown" role="tooltip">
                <div className="breakdown-header">Outstanding</div>
                <div className="breakdown-items">
                  <div className="breakdown-item"><span>Total Due</span><span>{formatCurrency(workerTotals.totalDue)}</span></div>
                  <div className="breakdown-item"><span>− Paid</span><span>−{formatCurrency(workerTotals.totalPaid)}</span></div>
                  <div className="breakdown-item"><span>= Outstanding</span><strong>{formatCurrency(workerTotals.outstanding)}</strong></div>
                </div>
              </div>
            </div>
            <div className="records-stat">
              <span className="records-stat-label">Workers</span>
              <span className="records-stat-value">{filteredWorkerRows.length}</span>
              <span className="records-stat-sub">In current view</span>
            </div>
            <div className="records-stat">
              <span className="records-stat-label">Customers</span>
              <span className="records-stat-value">{new Set(filteredWorkerCardRows.map((r) => r.customerId)).size}</span>
              <span className="records-stat-sub">Across filtered cards</span>
            </div>
          </div>

          {workerBreakdown.length > 0 && (
            <div className="cd-subsection">
              <p className="cd-subsection-label">Worker Commission — by Worker</p>
              <div className="records-table-wrap">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th className="numeric">Cards</th>
                      <th className="numeric">Total Due</th>
                      <th className="numeric">Total Paid</th>
                      <th className="numeric">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerBreakdown.map((row) => (
                      <tr key={row.workerId}>
                        <td>
                          <button
                            type="button"
                            className="cd-worker-link"
                            onClick={() => setWorkerForDetails(row.workerId)}
                            title={`View ${row.workerName} commission details`}
                          >
                            {row.workerName}
                          </button>
                        </td>
                        <td className="numeric">{row.cards}</td>
                        <td className="numeric">{formatCurrency(row.commission)}</td>
                        <td className="numeric rec-paid">{formatCurrency(row.settled)}</td>
                        <td className={`numeric${row.pending > 0 ? ' rec-pending-val' : ' rec-paid'}`}>{formatCurrency(row.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="cd-tfoot-row">
                      <td>Total</td>
                      <td className="numeric">{workerBreakdown.reduce((s, r) => s + r.cards, 0)}</td>
                      <td className="numeric">{formatCurrency(workerBreakdown.reduce((s, r) => s + r.commission, 0))}</td>
                      <td className="numeric rec-paid">{formatCurrency(workerBreakdown.reduce((s, r) => s + r.settled, 0))}</td>
                      <td className={`numeric${workerBreakdown.reduce((s, r) => s + r.pending, 0) > 0 ? ' rec-pending-val' : ' rec-paid'}`}>
                        {formatCurrency(workerBreakdown.reduce((s, r) => s + r.pending, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {filteredWorkerCardRows.length === 0 ? (
            <div className="cd-empty">
              <p className="cd-empty-title">
                {sortedWorkerRows.length === 0 ? 'No commission workers configured' : 'No pending worker balances'}
              </p>
              <p className="cd-empty-sub">
                {sortedWorkerRows.length === 0
                  ? 'Workers are configured per customer in customer settings'
                  : 'Disable the Pending Only filter to view all workers.'}
              </p>
            </div>
          ) : (
            <div className="records-table-wrap">
              <table className="records-table">
                <thead>
                  <tr>
                    <th className={`slw-sortable-th${workerCardSort?.key === 'date' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleWorkerCardSort('date')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorkerCardSort('date'); } }}>
                      Date{wcSortMark('date')}
                    </th>
                    <th className={`slw-sortable-th${workerCardSort?.key === 'billNo' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleWorkerCardSort('billNo')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorkerCardSort('billNo'); } }}>
                      Bill No{wcSortMark('billNo')}
                    </th>
                    <th className={`slw-sortable-th${workerCardSort?.key === 'dcNo' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleWorkerCardSort('dcNo')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorkerCardSort('dcNo'); } }}>
                      DC No{wcSortMark('dcNo')}
                    </th>
                    <th className={`slw-sortable-th${workerCardSort?.key === 'workerName' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleWorkerCardSort('workerName')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorkerCardSort('workerName'); } }}>
                      Worker{wcSortMark('workerName')}
                    </th>
                    <th className={`numeric slw-sortable-th${workerCardSort?.key === 'invoice' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleWorkerCardSort('invoice')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorkerCardSort('invoice'); } }}>
                      Invoice{wcSortMark('invoice')}
                    </th>
                    <th className={`numeric slw-sortable-th${workerCardSort?.key === 'commission' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleWorkerCardSort('commission')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorkerCardSort('commission'); } }}>
                      Commission{wcSortMark('commission')}
                    </th>
                    <th className="numeric">Sent</th>
                    <th className={`numeric slw-sortable-th${workerCardSort?.key === 'pending' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleWorkerCardSort('pending')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorkerCardSort('pending'); } }}>
                      Pending{wcSortMark('pending')}
                    </th>
                    <th className="ta-c">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleWorkerCardRows.map((row) => (
                    <tr key={row.key}>
                      <td><span className="rec-date-cell">{new Date(row.date).toLocaleDateString('en-IN')}</span></td>
                      <td><span className="mono">{row.billNo || '—'}</span></td>
                      <td><span className="mono">{row.dcNo || '—'}</span></td>
                      <td>
                        <span className="fw-600">{row.workerName}</span>
                      </td>
                      <td className="numeric">{formatCurrency(row.invoice)}</td>
                      <td className="numeric">{formatCurrency(row.commission)}</td>
                      <td className="numeric color-muted">—</td>
                      <td className={`numeric${row.workerOutstanding > 0 ? ' rec-pending-val' : ' rec-paid'}`}>
                        {row.workerOutstanding > 0 ? formatCurrency(row.workerOutstanding) : '—'}
                      </td>
                      <td className="ta-c">
                        <button
                          type="button"
                          className="cd-settle-btn"
                          onClick={() => {
                            setSelectedWorker(row.workerId);
                            if (row.workerOutstanding > 0) setPaymentAmount(String(row.workerOutstanding));
                            setShowPaymentForm(true);
                          }}
                        >
                          Settle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══════════════════ HISTORY ══════════════════ */}
      {activeSection === 'history' && (
        commissionPayments.length === 0 ? (
          <div className="cd-empty">
            <p className="cd-empty-title">No commission payments recorded yet</p>
          </div>
        ) : (
          <div className="records-table-wrap">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Worker</th>
                  <th className="numeric">Amount</th>
                  <th>Notes</th>
                  <th className="ta-c">Action</th>
                </tr>
              </thead>
              <tbody>
                {[...commissionPayments]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(payment => (
                    <tr key={payment.id}>
                      <td><span className="rec-date-cell">{new Date(payment.date).toLocaleDateString('en-IN')}</span></td>
                      <td className="fw-600">{payment.workerName}</td>
                      <td className="numeric rec-paid">{formatCurrency(payment.amount)}</td>
                      <td className="rec-cust-name">{payment.notes || '—'}</td>
                      <td className="ta-c">
                        {confirmDeleteId === payment.id ? (
                          <span className="cd-confirm">
                            <span className="cd-confirm-text">Delete?</span>
                            <button type="button" className="cd-btn-yes" onClick={() => void handleDeletePayment(payment.id)}>Yes</button>
                            <button type="button" className="cd-btn-no" onClick={() => setConfirmDeleteId(null)}>No</button>
                          </span>
                        ) : (
                          <button type="button" className="rec-act-btn rec-act-btn--del"
                            onClick={() => setConfirmDeleteId(payment.id)} title="Delete payment">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ══════════════════ AGENT WORK ══════════════════ */}
      {activeSection === 'agents' && (
        <>
          {/* Toolbar */}
          <div className="records-toolbar cd-toolbar">
            {/* Customer */}
            <div className="records-payment-filter">
              {(['all', 'ww', 'rmp'] as CustomerFilter[]).map(f => (
                <button key={f} type="button"
                  className={`records-pf-btn${customerFilter === f ? ' active' : ''}`}
                  onClick={() => { setCustomerFilter(f); setAgentFilter('all'); setOffset(0); }}>
                  {f === 'all' ? 'All' : f === 'ww' ? 'WW' : 'RMP'}
                </button>
              ))}
            </div>

            {/* Period */}
            <div className="records-period-tabs">
              {(['month', 'quarter', 'half', 'all'] as PeriodType[]).map(p => (
                <button key={p} type="button"
                  className={`records-period-tab${period === p ? ' active' : ''}`}
                  onClick={() => { setPeriod(p); setOffset(0); }}>
                  {p === 'month' ? 'Month' : p === 'quarter' ? 'Quarter' : p === 'half' ? 'Half-Year' : 'All'}
                </button>
              ))}
            </div>

            {/* Period navigator */}
            {period !== 'all' && (
              <>
                <div className="records-day-nav-shell">
                  <button type="button" className="records-nav-btn" onClick={() => setOffset(o => o - 1)} aria-label="Previous period"><ChevL /></button>
                  <span className="records-period-label">{periodRange.label}</span>
                  <button type="button" className="records-nav-btn" onClick={() => setOffset(o => o + 1)} disabled={offset >= 0} aria-label="Next period"><ChevR /></button>
                </div>
                {offset < 0 && <button type="button" className="records-today-btn" onClick={() => setOffset(0)}>Current</button>}
              </>
            )}

            <div className="records-toolbar-sep" />

            {/* Ext DC */}
            <div className="records-payment-filter">
              {(['all', 'external', 'internal'] as ExtDcFilter[]).map(f => (
                <button key={f} type="button"
                  className={`records-pf-btn${extDcFilter === f ? ' active' : ''}`}
                  onClick={() => setExtDcFilter(f)}>
                  {f === 'all' ? 'All' : f === 'external' ? 'Ext DC' : 'Internal'}
                </button>
              ))}
            </div>

            {/* Pending-only toggle */}
            <div className="records-payment-filter">
              <button type="button"
                className={`records-pf-btn${onlyPending ? ' active' : ''}`}
                onClick={() => setOnlyPending(v => !v)}>
                Pending Only
              </button>
            </div>

            {/* Right side */}
            <div className="records-toolbar-end">
              {visibleAgentRows.length > 0 && (
                <span className="records-count">{visibleAgentRows.length} card{visibleAgentRows.length !== 1 ? 's' : ''}</span>
              )}
              {uniqueAgentNames.length > 1 && (
                <select className="cd-agent-select" value={agentFilter}
                  onChange={e => setAgentFilter(e.target.value)} title="Filter by agent">
                  <option value="all">All Agents</option>
                  {uniqueAgentNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
              <button type="button" className="btn btn-secondary cd-ap-btn"
                onClick={() => setShowAgentPayForm(v => !v)}>
                {showAgentPayForm ? 'Cancel' : '+ Record Agent Payment'}
              </button>
            </div>
          </div>

          {/* Agent payment form */}
          {showAgentPayForm && (
            <div className="cd-form-box">
              <div className="cd-form-title">Record Agent Payment</div>
              <div className="cd-form-grid">
                <div className="cd-field">
                  <label className="cd-label" htmlFor="ap-agent">Agent</label>
                  {allAgentNames.length > 0 ? (
                    <select id="ap-agent" className="cd-select" value={apAgent}
                      onChange={e => setApAgent(e.target.value)}>
                      <option value="">Select agent…</option>
                      {allAgentNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <input id="ap-agent" type="text" className="cd-input" value={apAgent}
                      onChange={e => setApAgent(e.target.value)} placeholder="Agent name" />
                  )}
                  {apAgent && (() => {
                    const bal  = allAgentBalanceMap.get(apAgent);
                    const paid = agentPaidMap.get(apAgent) ?? 0;
                    if (!bal) return null;
                    return (
                      <p className="cd-hint">
                        Net payable <strong>{formatCurrency(bal.netPayable)}</strong>
                        {' — '}settled <strong>{formatCurrency(bal.settled)}</strong>
                        {' = '}balance{' '}
                        <strong className={bal.pending > 0 ? 'rec-pending-val' : 'rec-paid'}>
                          {formatCurrency(bal.pending)}
                        </strong>
                        {paid > 0 && <span className="cd-hint-muted"> · {formatCurrency(paid)} paid via records</span>}
                      </p>
                    );
                  })()}
                </div>
                <div className="cd-field">
                  <label className="cd-label" htmlFor="ap-amount">Amount (₹)</label>
                  <div className="cd-input-row">
                    <input id="ap-amount" type="number" className="cd-input" value={apAmount}
                      onChange={e => setApAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" />
                    {apAgent && (() => {
                      const bal = allAgentBalanceMap.get(apAgent);
                      if (!bal || bal.pending <= 0) return null;
                      return (
                        <button type="button" className="cd-fill-btn"
                          onClick={() => setApAmount(String(bal.pending))}
                          title={`Fill pending balance: ${formatCurrency(bal.pending)}`}>
                          Fill {formatCurrency(bal.pending)}
                        </button>
                      );
                    })()}
                  </div>
                </div>
                <div className="cd-field">
                  <label className="cd-label" htmlFor="ap-date">Date</label>
                  <input id="ap-date" type="date" className="cd-input" value={apDate}
                    onChange={e => setApDate(e.target.value)} max={today} />
                </div>
                <div className="cd-field cd-field--full">
                  <label className="cd-label" htmlFor="ap-notes">Notes (optional)</label>
                  <textarea id="ap-notes" className="cd-textarea" rows={2} value={apNotes}
                    onChange={e => setApNotes(e.target.value)} placeholder="UPI ref, bank transfer, etc." />
                </div>
              </div>
              <div className="cd-form-footer">
                <button type="button" className="btn btn-accent"
                  onClick={() => void handleRecordAgentPayment()} disabled={isApSubmitting}>
                  {isApSubmitting ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
            </div>
          )}

          {/* Agent work tiles */}
          <div className="cd-agent-tiles">
            <div className="records-stat records-stat--hoverable">
              <span className="records-stat-label">Invoice Total</span>
              <span className="records-stat-value">{formatCurrency(agentTotals.invoice)}</span>
              <span className="records-stat-sub">Gross billed on agent cards</span>
              <div className="records-breakdown" role="tooltip">
                <div className="breakdown-header">Invoice Total</div>
                <div className="breakdown-items">
                  <div className="breakdown-item"><span>Cards</span><span>{visibleAgentRows.length}</span></div>
                  <div className="breakdown-item"><span>Commission</span><span>+{formatCurrency(agentTotals.commission)}</span></div>
                  <div className="breakdown-item"><span>TDS</span><span>+{formatCurrency(agentTotals.tds)}</span></div>
                  <div className="breakdown-item"><span>Net Payable</span><span>{formatCurrency(agentTotals.netPayable)}</span></div>
                </div>
              </div>
            </div>
            <div className="records-stat records-stat--green records-stat--hoverable">
              <span className="records-stat-label">SLW Commission</span>
              <span className="records-stat-value">{formatCurrency(agentTotals.commission)}</span>
              <span className="records-stat-sub">Our cut on agent work</span>
              <div className="records-breakdown" role="tooltip">
                <div className="breakdown-header">SLW Commission</div>
                <div className="breakdown-items">
                  <div className="breakdown-item"><span>Agent invoice × commission %</span></div>
                  <div className="breakdown-item"><span>This is what SLW keeps</span></div>
                </div>
              </div>
            </div>
            <div className="records-stat records-stat--green records-stat--hoverable">
              <span className="records-stat-label">TDS Retained</span>
              <span className="records-stat-value">{formatCurrency(agentTotals.tds)}</span>
              <span className="records-stat-sub">Withheld from agent payment</span>
              <div className="records-breakdown" role="tooltip">
                <div className="breakdown-header">TDS Retained</div>
                <div className="breakdown-items">
                  <div className="breakdown-item"><span>Tax deducted at source</span></div>
                  <div className="breakdown-item"><span>Withheld; not sent to agent</span></div>
                </div>
              </div>
            </div>
            <div className="records-stat records-stat--hoverable">
              <span className="records-stat-label">Net Payable</span>
              <span className="records-stat-value">{formatCurrency(agentTotals.netPayable)}</span>
              <span className="records-stat-sub">Agent's share to transfer</span>
              <div className="records-breakdown" role="tooltip">
                <div className="breakdown-header">Net Payable</div>
                <div className="breakdown-items">
                  <div className="breakdown-item"><span>Invoice</span><span>{formatCurrency(agentTotals.invoice)}</span></div>
                  <div className="breakdown-item"><span>− Commission</span><span>−{formatCurrency(agentTotals.commission)}</span></div>
                  <div className="breakdown-item"><span>− TDS</span><span>−{formatCurrency(agentTotals.tds)}</span></div>
                  <div className="breakdown-item"><span>= Net Payable</span><strong>{formatCurrency(agentTotals.netPayable)}</strong></div>
                </div>
              </div>
            </div>
            <div className="records-stat records-stat--green records-stat--hoverable">
              <span className="records-stat-label">Already Sent</span>
              <span className="records-stat-value">{formatCurrency(agentTotals.settled)}</span>
              <span className="records-stat-sub">Paid to agents</span>
              <div className="records-breakdown" role="tooltip">
                <div className="breakdown-header">Already Sent</div>
                <div className="breakdown-items">
                  <div className="breakdown-item"><span>Recorded agent payments</span></div>
                  <div className="breakdown-item"><span>Pending</span><span>{formatCurrency(agentTotals.pending)}</span></div>
                </div>
              </div>
            </div>
            <div className={`records-stat records-stat--hoverable${agentTotals.pending > 0 ? ' records-stat--red' : ' records-stat--green'}`}>
              <span className="records-stat-label">Pending</span>
              <span className="records-stat-value">{formatCurrency(agentTotals.pending)}</span>
              <span className="records-stat-sub">Still to transfer to agents</span>
              <div className="records-breakdown" role="tooltip">
                <div className="breakdown-header">Pending Balance</div>
                <div className="breakdown-items">
                  <div className="breakdown-item"><span>Net Payable</span><span>{formatCurrency(agentTotals.netPayable)}</span></div>
                  <div className="breakdown-item"><span>− Sent</span><span>−{formatCurrency(agentTotals.settled)}</span></div>
                  <div className="breakdown-item"><span>= Pending</span><strong>{formatCurrency(agentTotals.pending)}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown by agent */}
          {agentBreakdown.length > 0 && (
            <div className="cd-subsection">
              <p className="cd-subsection-label">SLW Income — by Agent</p>
              <div className="records-table-wrap">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th className="numeric">Cards</th>
                      <th className="numeric">Commission</th>
                      <th className="numeric">TDS</th>
                      <th className="numeric">Total Income</th>
                      <th className="numeric">Net Payable</th>
                      <th className="numeric">Sent</th>
                      <th className="numeric">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentBreakdown.map(row => (
                      <tr key={row.name}>
                        <td>
                          <button
                            type="button"
                            className="cd-worker-link"
                            onClick={() => setAgentForDetails(row.name)}
                            title={`View ${row.name} commission details`}
                          >
                            {row.name}
                          </button>
                        </td>
                        <td className="numeric">{row.cards}</td>
                        <td className="numeric rec-paid">{formatCurrency(row.commission)}</td>
                        <td className="numeric rec-paid">{formatCurrency(row.tds)}</td>
                        <td className="numeric fw-600 rec-paid">{formatCurrency(row.totalIncome)}</td>
                        <td className="numeric">{formatCurrency(row.netPayable)}</td>
                        <td className="numeric rec-paid">{formatCurrency(row.settled)}</td>
                        <td className={`numeric${row.pending > 0 ? ' rec-pending-val' : ' rec-paid'}`}>{formatCurrency(row.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="cd-tfoot-row">
                      <td>Total</td>
                      <td className="numeric">{agentBreakdown.reduce((s, r) => s + r.cards, 0)}</td>
                      <td className="numeric rec-paid">{formatCurrency(agentBreakdown.reduce((s, r) => s + r.commission, 0))}</td>
                      <td className="numeric rec-paid">{formatCurrency(agentBreakdown.reduce((s, r) => s + r.tds, 0))}</td>
                      <td className="numeric fw-600 rec-paid">{formatCurrency(agentBreakdown.reduce((s, r) => s + r.totalIncome, 0))}</td>
                      <td className="numeric">{formatCurrency(agentBreakdown.reduce((s, r) => s + r.netPayable, 0))}</td>
                      <td className="numeric rec-paid">{formatCurrency(agentBreakdown.reduce((s, r) => s + r.settled, 0))}</td>
                      <td className={`numeric${agentBreakdown.reduce((s, r) => s + r.pending, 0) > 0 ? ' rec-pending-val' : ' rec-paid'}`}>
                        {formatCurrency(agentBreakdown.reduce((s, r) => s + r.pending, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Main card table */}
          {visibleAgentRows.length === 0 ? (
            <div className="cd-empty">
              <p className="cd-empty-title">No agent work cards found</p>
              <p className="cd-empty-sub">Try adjusting the period, customer, or DC type filter.</p>
            </div>
          ) : (
            <div className="records-table-wrap">
              <table className="records-table">
                <thead>
                  <tr>
                    <th className={`slw-sortable-th${agentSort?.key === 'date' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('date')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('date'); } }}>
                      Date{agentSortMark('date')}
                    </th>
                    <th className={`slw-sortable-th${agentSort?.key === 'card' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('card')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('card'); } }}>
                      Card{agentSortMark('card')}
                    </th>
                    <th className={`slw-sortable-th${agentSort?.key === 'customer' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('customer')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('customer'); } }}>
                      Customer{agentSortMark('customer')}
                    </th>
                    <th className={`slw-sortable-th${agentSort?.key === 'agentName' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('agentName')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('agentName'); } }}>
                      Agent{agentSortMark('agentName')}
                    </th>
                    <th className={`slw-sortable-th${agentSort?.key === 'dcNo' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('dcNo')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('dcNo'); } }}>
                      DC No{agentSortMark('dcNo')}
                    </th>
                    <th className={`slw-sortable-th${agentSort?.key === 'billNo' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('billNo')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('billNo'); } }}>
                      Bill No{agentSortMark('billNo')}
                    </th>
                    <th className={`ta-c slw-sortable-th${agentSort?.key === 'type' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('type')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('type'); } }}>
                      Type{agentSortMark('type')}
                    </th>
                    <th className={`numeric slw-sortable-th${agentSort?.key === 'invoice' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('invoice')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('invoice'); } }}>
                      Invoice{agentSortMark('invoice')}
                    </th>
                    <th className={`numeric slw-sortable-th${agentSort?.key === 'commission' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('commission')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('commission'); } }}>
                      SLW Income{agentSortMark('commission')}
                    </th>
                    <th className={`numeric slw-sortable-th${agentSort?.key === 'netPayable' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('netPayable')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('netPayable'); } }}>
                      Net Payable{agentSortMark('netPayable')}
                    </th>
                    <th className={`numeric slw-sortable-th${agentSort?.key === 'settled' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('settled')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('settled'); } }}>
                      Sent{agentSortMark('settled')}
                    </th>
                    <th className={`numeric slw-sortable-th${agentSort?.key === 'pending' ? ' is-active' : ''}`}
                      role="button" tabIndex={0} onClick={() => toggleAgentSort('pending')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgentSort('pending'); } }}>
                      Pending{agentSortMark('pending')}
                    </th>
                    <th className="ta-c">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAgentRows.map(row => (
                    <tr key={row.key}>
                      <td><span className="rec-date-cell">{new Date(row.date).toLocaleDateString('en-IN')}</span></td>
                      <td><span className="rec-card-id">{row.jobCardId}</span></td>
                      <td className="rec-cust-name">{row.customerName}</td>
                      <td className="fw-600">{row.agentName}</td>
                      <td><span className="mono">{row.dcNo  || '—'}</span></td>
                      <td><span className="mono">{row.billNo || '—'}</span></td>
                      <td className="ta-c">
                        {row.externalDc
                          ? <span className="cd-badge cd-badge--ext">Ext</span>
                          : <span className="cd-badge cd-badge--int">Int</span>}
                      </td>
                      <td className="numeric">{formatCurrency(row.invoice)}</td>
                      <td className="numeric rec-paid">{formatCurrency(row.commission)}</td>
                      <td className="numeric">{formatCurrency(row.netPayable)}</td>
                      <td className="numeric rec-paid">{formatCurrency(row.settled)}</td>
                      <td className={`numeric${row.pending > 0 ? ' rec-pending-val' : ' rec-paid'}`}>
                        {row.pending > 0 ? formatCurrency(row.pending) : '—'}
                      </td>
                      <td className="ta-c">
                        <button type="button" className="cd-settle-btn" onClick={() => void handleSettle(row)}>
                          Settle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Agent payment history */}
          {agentPaymentRecords.length > 0 && (
            <div className="cd-subsection">
              <p className="cd-subsection-label">Agent Payment History</p>
              <div className="records-table-wrap">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Agent</th>
                      <th className="numeric">Amount</th>
                      <th>Notes</th>
                      <th className="ta-c">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPaymentRecords.map(p => (
                      <tr key={p.id}>
                        <td><span className="rec-date-cell">{new Date(p.date).toLocaleDateString('en-IN')}</span></td>
                        <td className="fw-600">{p.agentName || p.workerName}</td>
                        <td className="numeric rec-paid">{formatCurrency(p.amount)}</td>
                        <td className="rec-cust-name">{p.notes || '—'}</td>
                        <td className="ta-c">
                          {apConfirmDeleteId === p.id ? (
                            <span className="cd-confirm">
                              <span className="cd-confirm-text">Delete?</span>
                              <button type="button" className="cd-btn-yes" onClick={() => void handleDeleteAgentPayment(p.id)}>Yes</button>
                              <button type="button" className="cd-btn-no" onClick={() => setApConfirmDeleteId(null)}>No</button>
                            </span>
                          ) : (
                            <button type="button" className="rec-act-btn rec-act-btn--del"
                              onClick={() => setApConfirmDeleteId(p.id)} title="Delete payment">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Worker detail modal ── */}
      <Modal
        isOpen={workerForDetails !== null}
        onClose={() => setWorkerForDetails(null)}
        title={detailWorkerSummary ? `${detailWorkerSummary.workerName} — Commission Details` : 'Worker Details'}
        size="lg"
      >
        {detailWorkerSummary && (
          <div className="cd-detail">
            <div className="cd-detail-tiles">
              <div className="cd-detail-tile">
                <span className="cd-detail-tile-label">Total Due</span>
                <strong className="cd-detail-tile-val">{formatCurrency(detailWorkerSummary.totalDue)}</strong>
              </div>
              <div className="cd-detail-tile">
                <span className="cd-detail-tile-label">Total Paid</span>
                <strong className="cd-detail-tile-val rec-paid">{formatCurrency(detailWorkerSummary.totalPaid)}</strong>
              </div>
              <div className="cd-detail-tile">
                <span className="cd-detail-tile-label">Outstanding</span>
                <strong className={`cd-detail-tile-val${detailWorkerSummary.outstanding > 0 ? ' rec-pending-val' : ' rec-paid'}`}>
                  {formatCurrency(detailWorkerSummary.outstanding)}
                </strong>
              </div>
            </div>
            {detailWorkerCards.length === 0 ? (
              <div className="cd-empty"><p className="cd-empty-title">No job card commission entries found.</p></div>
            ) : (
              <div className="records-table-wrap">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th
                        className={`slw-sortable-th${workerDetailSort?.key === 'jobCardDate' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleWorkerDetailSort('jobCardDate')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleWorkerDetailSort('jobCardDate');
                          }
                        }}
                      >
                        Job Card Date{workerDetailSortMark('jobCardDate')}
                      </th>
                      <th
                        className={`slw-sortable-th${workerDetailSort?.key === 'billNo' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleWorkerDetailSort('billNo')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleWorkerDetailSort('billNo');
                          }
                        }}
                      >
                        Bill No{workerDetailSortMark('billNo')}
                      </th>
                      <th
                        className={`slw-sortable-th${workerDetailSort?.key === 'dcNo' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleWorkerDetailSort('dcNo')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleWorkerDetailSort('dcNo');
                          }
                        }}
                      >
                        DC No{workerDetailSortMark('dcNo')}
                      </th>
                      <th
                        className={`slw-sortable-th${workerDetailSort?.key === 'dcDate' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleWorkerDetailSort('dcDate')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleWorkerDetailSort('dcDate');
                          }
                        }}
                      >
                        DC Date{workerDetailSortMark('dcDate')}
                      </th>
                      <th
                        className={`numeric slw-sortable-th${workerDetailSort?.key === 'commission' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleWorkerDetailSort('commission')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleWorkerDetailSort('commission');
                          }
                        }}
                      >
                        Commission Amt{workerDetailSortMark('commission')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDetailWorkerCards.map(jc => (
                      <tr key={jc.key}>
                        <td><span className="rec-date-cell">{new Date(jc.jobCardDate).toLocaleDateString('en-IN')}</span></td>
                        <td><span className="mono">{jc.billNo || '—'}</span></td>
                        <td><span className="mono">{jc.dcNo || '—'}</span></td>
                        <td><span className="rec-date-cell">{jc.dcDate ? new Date(jc.dcDate).toLocaleDateString('en-IN') : '—'}</span></td>
                        <td className="numeric">{formatCurrency(jc.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Agent detail modal ── */}
      <Modal
        isOpen={agentForDetails !== null}
        onClose={() => setAgentForDetails(null)}
        title={detailAgentSummary ? `${detailAgentSummary.name} — Commission Details` : 'Agent Details'}
        size="lg"
      >
        {detailAgentSummary && (
          <div className="cd-detail">
            <div className="cd-detail-tiles">
              <div className="cd-detail-tile">
                <span className="cd-detail-tile-label">SLW Commission</span>
                <strong className="cd-detail-tile-val rec-paid">{formatCurrency(detailAgentSummary.commission)}</strong>
              </div>
              <div className="cd-detail-tile">
                <span className="cd-detail-tile-label">Sent</span>
                <strong className="cd-detail-tile-val rec-paid">{formatCurrency(detailAgentSummary.settled)}</strong>
              </div>
              <div className="cd-detail-tile">
                <span className="cd-detail-tile-label">Balance Due</span>
                <strong className={`cd-detail-tile-val${detailAgentSummary.pending > 0 ? ' rec-pending-val' : ' rec-paid'}`}>
                  {formatCurrency(detailAgentSummary.pending)}
                </strong>
              </div>
            </div>
            {detailAgentCards.length === 0 ? (
              <div className="cd-empty"><p className="cd-empty-title">No agent commission entries found.</p></div>
            ) : (
              <div className="records-table-wrap">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th
                        className={`slw-sortable-th${agentDetailSort?.key === 'jobCardDate' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleAgentDetailSort('jobCardDate')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleAgentDetailSort('jobCardDate');
                          }
                        }}
                      >
                        Job Card Date{agentDetailSortMark('jobCardDate')}
                      </th>
                      <th
                        className={`slw-sortable-th${agentDetailSort?.key === 'billNo' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleAgentDetailSort('billNo')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleAgentDetailSort('billNo');
                          }
                        }}
                      >
                        Bill No{agentDetailSortMark('billNo')}
                      </th>
                      <th
                        className={`slw-sortable-th${agentDetailSort?.key === 'dcNo' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleAgentDetailSort('dcNo')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleAgentDetailSort('dcNo');
                          }
                        }}
                      >
                        DC No{agentDetailSortMark('dcNo')}
                      </th>
                      <th
                        className={`slw-sortable-th${agentDetailSort?.key === 'dcDate' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleAgentDetailSort('dcDate')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleAgentDetailSort('dcDate');
                          }
                        }}
                      >
                        DC Date{agentDetailSortMark('dcDate')}
                      </th>
                      <th
                        className={`numeric slw-sortable-th${agentDetailSort?.key === 'commission' ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleAgentDetailSort('commission')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleAgentDetailSort('commission');
                          }
                        }}
                      >
                        Commission Amt{agentDetailSortMark('commission')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDetailAgentCards.map((jc) => (
                      <tr key={jc.key}>
                        <td><span className="rec-date-cell">{new Date(jc.jobCardDate).toLocaleDateString('en-IN')}</span></td>
                        <td><span className="mono">{jc.billNo || '—'}</span></td>
                        <td><span className="mono">{jc.dcNo || '—'}</span></td>
                        <td><span className="rec-date-cell">{jc.dcDate ? new Date(jc.dcDate).toLocaleDateString('en-IN') : '—'}</span></td>
                        <td className="numeric">{formatCurrency(jc.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

    </div>
  );
}

