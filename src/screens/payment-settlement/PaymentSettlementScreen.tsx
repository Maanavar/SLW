import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDataStore } from '@/stores/dataStore';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { useToast } from '@/hooks/useToast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { PaymentModeGroup, type PaymentMode as PaymentModeInput } from '@/components/ui/PaymentModeGroup';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { generateMeaningfulPaymentId } from '@/lib/paymentUtils';
import {
  isMahalingamCustomerLabel,
  isRmpCustomer,
  isWwCustomer,
} from '@/constants/customers';
import {
  getJobCardPaymentSummary,
  getJobFinalBillValue,
  getJobWorkerCommissionExpense,
  groupJobsByCard,
  isAgentWorkJob,
} from '@/lib/jobUtils';
import {
  getDateRangeWithOffset,
  getOffsetPeriodLabel,
  nextSortState,
  PERIOD_TABS,
  sortMark,
  type PeriodType,
  type SortOrder,
} from '@/screens/finance/financeHelpers';
import type { Job, Payment } from '@/types';
import './PaymentSettlementScreen.css';
import '../FinanceReports.css';

type WorkFlowFilter = 'all' | 'slw_work' | 'agent_work';
type HandlerFilter = 'all' | 'bhai' | 'raja';

type SettlementSortKey =
  | 'date'
  | 'customer'
  | 'card'
  | 'billNo'
  | 'dcNo'
  | 'vehicleNo'
  | 'work'
  | 'flow'
  | 'handler'
  | 'amount'
  | 'commission'
  | 'finalBill'
  | 'paid'
  | 'pending'
  | 'status';

interface CustomerOption {
  id: number;
  name: string;
  shortCode: string;
}

interface SettlementRow {
  key: string;
  jobs: Job[];
  customerId: number;
  customerName: string;
  customerCode: string;
  date: string;
  cardId: string;
  billNo: string;
  dcNo: string;
  vehicleNo: string;
  workSummary: string;
  lineCount: number;
  flowType: 'slw_work' | 'agent_work';
  handler: string;
  handlerTokens: string[];
  amount: number;
  commission: number;
  finalBill: number;
  paid: number;
  pending: number;
  status: 'Paid' | 'Pending' | 'Partially Paid';
  agentCommissionIncome: number;
  agentSettlementPending: number;
}

const ALL_CUSTOMERS: CustomerOption = { id: 0, name: 'Select customer', shortCode: '' };

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function formatDateCell(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

function uniqueJoin(values: string[]): string {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join(' / ');
}

function rowSearchText(row: SettlementRow): string {
  return [
    row.cardId,
    row.customerName,
    row.customerCode,
    row.billNo,
    row.dcNo,
    row.vehicleNo,
    row.workSummary,
    row.handler,
    row.flowType,
  ]
    .join(' ')
    .toLowerCase();
}

const PAYMENT_MODE_MAP: Record<Exclude<PaymentModeInput, 'mixed'>, Payment['paymentMode']> = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',
  cheque: 'Cheque',
};

function toMoney(value: string): number {
  return Math.round(((parseFloat(value) || 0) + Number.EPSILON) * 100) / 100;
}

function sumMoney(values: number[]): number {
  return Math.round((values.reduce((sum, value) => sum + value, 0) + Number.EPSILON) * 100) / 100;
}

function getJobDateRange(jobs: Job[]): { from: string; to: string } {
  const dates = jobs.map((job) => job.date).filter(Boolean).sort();
  const fallback = getLocalDateString(new Date());
  return {
    from: dates[0] || fallback,
    to: dates[dates.length - 1] || fallback,
  };
}

export function PaymentSettlementScreen() {
  const { jobs, payments, getCustomer, addPayment, updateJob, ensureRangeLoaded } = useDataStore();
  const { data: customers = [] } = useCustomersQuery();
  const toast = useToast();
  const today = getLocalDateString(new Date());
  const [searchParams] = useSearchParams();

  const [period, setPeriod] = useState<PeriodType>('month');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(() => {
    const raw = Number(searchParams.get('customerId') || '0');
    return Number.isFinite(raw) ? raw : 0;
  });
  const [flowFilter, setFlowFilter] = useState<WorkFlowFilter>('all');
  const [handlerFilter, setHandlerFilter] = useState<HandlerFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [tableSort, setTableSort] = useState<{ key: SettlementSortKey; order: SortOrder } | null>({
    key: 'date',
    order: 'desc',
  });
  const [settlingCardKey, setSettlingCardKey] = useState<string | null>(null);
  const [settlementPreviewKey, setSettlementPreviewKey] = useState<string | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [settlementPaymentMode, setSettlementPaymentMode] = useState<PaymentModeInput>('cash');
  const [settlementPaymentDate, setSettlementPaymentDate] = useState(today);
  const [settlementCash, setSettlementCash] = useState('');
  const [settlementUPI, setSettlementUPI] = useState('');
  const [settlementBank, setSettlementBank] = useState('');
  const [settlementCheque, setSettlementCheque] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');

  const dateRange = useMemo(() => {
    if (period === 'all') return undefined;
    if (period === 'range') {
      if (!rangeFrom || !rangeTo) return undefined;
      return rangeFrom <= rangeTo
        ? { from: rangeFrom, to: rangeTo }
        : { from: rangeTo, to: rangeFrom };
    }
    return getDateRangeWithOffset(period, periodOffset);
  }, [period, periodOffset, rangeFrom, rangeTo]);

  useEffect(() => {
    if (!dateRange) return;
    void ensureRangeLoaded(dateRange);
  }, [dateRange, ensureRangeLoaded]);

  const customerOptions = useMemo<CustomerOption[]>(() => {
    const activeCustomers = customers
      .filter((customer) => customer.isActive !== false)
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        shortCode: customer.shortCode || '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en-IN'));
    return [ALL_CUSTOMERS, ...activeCustomers];
  }, [customers]);

  const selectedCustomer = useMemo(
    () => customerOptions.find((customer) => customer.id === selectedCustomerId) || ALL_CUSTOMERS,
    [customerOptions, selectedCustomerId]
  );
  const hasCustomerSelection = selectedCustomerId !== 0;
  const showExtendedColumns = useMemo(() => {
    if (!hasCustomerSelection) return false;
    return (
      isRmpCustomer(selectedCustomer.shortCode, selectedCustomer.name) ||
      isWwCustomer(selectedCustomer.shortCode, selectedCustomer.name) ||
      isMahalingamCustomerLabel(selectedCustomer.shortCode, selectedCustomer.name)
    );
  }, [hasCustomerSelection, selectedCustomer]);
  const tableColumnCount = showExtendedColumns ? 10 : 7;
  const summaryColSpan = showExtendedColumns ? 5 : 2;
  const showFlowFilter = hasCustomerSelection && (isRmpCustomer(selectedCustomer.shortCode, selectedCustomer.name) || isWwCustomer(selectedCustomer.shortCode, selectedCustomer.name));
  const showHandlerFilter = hasCustomerSelection && isRmpCustomer(selectedCustomer.shortCode, selectedCustomer.name);
  const rows = useMemo<SettlementRow[]>(() => {
    const scopedJobs = dateRange
      ? jobs.filter((job) => job.date >= dateRange.from && job.date <= dateRange.to)
      : jobs;

    return groupJobsByCard(scopedJobs).map((group) => {
      const customer = getCustomer(group.primary.customerId);
      const summary = getJobCardPaymentSummary(group.jobs);
      const amount = group.jobs.reduce((sum, job) => sum + (Number(job.amount) || 0), 0);
      const commission = group.jobs.reduce((sum, job) => sum + getJobWorkerCommissionExpense(job), 0);
      const flowType = group.jobs.every((job) => isAgentWorkJob(job)) ? 'agent_work' : 'slw_work';
      const handlerTokens = [
        ...new Set(
          group.jobs
            .map((job) => normalizeText(job.rmpHandler || ''))
            .filter(Boolean)
        ),
      ];
      const handler = handlerTokens
        .map((token) => (token === 'bhai' ? 'Bhai' : token === 'raja' ? 'Raja' : token))
        .join(' / ') || '-';
      const billNo = uniqueJoin(group.jobs.map((job) => job.billNo || ''));
      const dcNo = uniqueJoin(group.jobs.map((job) => job.dcNo || ''));
      const vehicleNo = uniqueJoin(group.jobs.map((job) => job.vehicleNo || ''));
      const workSummary = group.jobs
        .map((job) => `${job.workTypeName}${job.workName ? ` - ${job.workName}` : ''}`)
        .slice(0, 2)
        .join(', ');
      const agentCommissionIncome = group.jobs.reduce(
        (sum, job) => sum + (isAgentWorkJob(job) ? (Number(job.agentCommissionAmount) || 0) : 0),
        0
      );
      const agentSettlementPending = group.jobs.reduce((sum, job) => {
        if (!isAgentWorkJob(job)) return sum;
        return (
          sum +
          Math.max(
            0,
            (Number(job.amount) || 0) -
              (Number(job.agentCommissionAmount) || 0) -
              (Number(job.agentTdsAmount) || 0) -
              (Number(job.agentSettlementPaidAmount) || 0)
          )
        );
      }, 0);

      return {
        key: group.key,
        jobs: group.jobs,
        customerId: group.primary.customerId,
        customerName: customer?.name || 'Unknown',
        customerCode: customer?.shortCode || '',
        date: group.primary.date,
        cardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
        billNo,
        dcNo,
        vehicleNo,
        workSummary,
        lineCount: group.lineCount,
        flowType,
        handler,
        handlerTokens,
        amount,
        commission,
        finalBill: summary.finalBill,
        paid: summary.paid,
        pending: summary.pending,
        status: summary.status,
        agentCommissionIncome,
        agentSettlementPending,
      };
    });
  }, [dateRange, jobs, getCustomer]);

  const visibleRows = useMemo(() => {
    if (!hasCustomerSelection) return [];

    const q = searchText.trim().toLowerCase();
    return rows
      .filter((row) => row.customerId === selectedCustomerId)
      .filter((row) => {
        if (!showFlowFilter || flowFilter === 'all') return true;
        return row.flowType === flowFilter;
      })
      .filter((row) => {
        if (!showHandlerFilter || handlerFilter === 'all') return true;
        return row.handlerTokens.includes(handlerFilter);
      })
      .filter((row) => {
        if (!q) return true;
        return rowSearchText(row).includes(q);
      });
  }, [
    rows,
    selectedCustomerId,
    hasCustomerSelection,
    flowFilter,
    handlerFilter,
    searchText,
    showFlowFilter,
    showHandlerFilter,
  ]);

  const sortedRows = useMemo(() => {
    if (!tableSort) return visibleRows;
    const collator = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
    const direction = tableSort.order === 'asc' ? 1 : -1;
    return [...visibleRows].sort((a, b) => {
      switch (tableSort.key) {
        case 'date':
          return a.date.localeCompare(b.date) * direction;
        case 'customer':
          return collator.compare(a.customerName, b.customerName) * direction;
        case 'card':
          return collator.compare(a.cardId, b.cardId) * direction;
        case 'billNo':
          return collator.compare(a.billNo, b.billNo) * direction;
        case 'dcNo':
          return collator.compare(a.dcNo, b.dcNo) * direction;
        case 'vehicleNo':
          return collator.compare(a.vehicleNo, b.vehicleNo) * direction;
        case 'work':
          return collator.compare(a.workSummary, b.workSummary) * direction;
        case 'flow':
          return collator.compare(a.flowType, b.flowType) * direction;
        case 'handler':
          return collator.compare(a.handler, b.handler) * direction;
        case 'amount':
          return (a.amount - b.amount) * direction;
        case 'commission':
          return (a.commission - b.commission) * direction;
        case 'finalBill':
          return (a.finalBill - b.finalBill) * direction;
        case 'paid':
          return (a.paid - b.paid) * direction;
        case 'pending':
          return (a.pending - b.pending) * direction;
        case 'status': {
          const rank: Record<SettlementRow['status'], number> = { Pending: 0, 'Partially Paid': 1, Paid: 2 };
          return (rank[a.status] - rank[b.status]) * direction;
        }
        default:
          return 0;
      }
    });
  }, [visibleRows, tableSort]);

  const totals = useMemo(() => {
    return sortedRows.reduce(
      (acc, row) => {
        acc.cards += 1;
        acc.amount += row.amount;
        acc.commission += row.commission;
        acc.finalBill += row.finalBill;
        acc.paid += row.paid;
        acc.pending += row.pending;
        acc.agentCommissionIncome += row.agentCommissionIncome;
        acc.agentSettlementPending += row.agentSettlementPending;
        return acc;
      },
      {
        cards: 0,
        amount: 0,
        commission: 0,
        finalBill: 0,
        paid: 0,
        pending: 0,
        agentCommissionIncome: 0,
        agentSettlementPending: 0,
      }
    );
  }, [sortedRows]);

  const periodLabel = useMemo(() => {
    if (period === 'all') return 'All time';
    if (period === 'range') {
      if (!dateRange) return 'Custom range';
      return `${formatDateCell(dateRange.from)} - ${formatDateCell(dateRange.to)}`;
    }
    return getOffsetPeriodLabel(period, periodOffset);
  }, [period, periodOffset, dateRange]);

  const resetSettlementEntry = () => {
    setSettlementPaymentMode('cash');
    setSettlementPaymentDate(today);
    setSettlementCash('');
    setSettlementUPI('');
    setSettlementBank('');
    setSettlementCheque('');
    setSettlementNotes('');
  };

  const closeSettlementPreview = () => {
    setSettlementPreviewKey(null);
    resetSettlementEntry();
  };

  const settlementBreakdownTotal = useMemo(
    () =>
      sumMoney([
        toMoney(settlementCash),
        toMoney(settlementUPI),
        toMoney(settlementBank),
        toMoney(settlementCheque),
      ]),
    [settlementCash, settlementUPI, settlementBank, settlementCheque]
  );

  const performSettlement = async (row: SettlementRow) => {
    if (row.pending <= 0.009) {
      toast.info('Nothing due', `${row.cardId} is already settled.`);
      return;
    }

    if (settlementPaymentDate > today) {
      toast.error('Error', 'Future payment date not allowed');
      return;
    }

    const amountToSettle = Math.round((row.pending + Number.EPSILON) * 100) / 100;
    let finalMode: Payment['paymentMode'] =
      settlementPaymentMode === 'mixed'
        ? 'Mixed'
        : PAYMENT_MODE_MAP[settlementPaymentMode];
    let breakdown: Payment['breakdown'] | undefined;

    if (settlementPaymentMode === 'mixed') {
      const cash = toMoney(settlementCash);
      const upi = toMoney(settlementUPI);
      const bank = toMoney(settlementBank);
      const cheque = toMoney(settlementCheque);

      if (Math.abs(settlementBreakdownTotal - amountToSettle) > 0.01) {
        toast.error(
          'Error',
          `Mixed payment split must total ${formatCurrency(amountToSettle)}`
        );
        return;
      }

      breakdown = {
        ...(cash > 0 && { cash }),
        ...(upi > 0 && { upi }),
        ...(bank > 0 && { bank }),
        ...(cheque > 0 && { cheque }),
      };

      const usedModes = [
        cash > 0 ? 'Cash' : null,
        upi > 0 ? 'UPI' : null,
        bank > 0 ? 'Bank' : null,
        cheque > 0 ? 'Cheque' : null,
      ].filter(Boolean) as Payment['paymentMode'][];

      if (usedModes.length === 1) {
        finalMode = usedModes[0];
      }
    }

    setSettlingCardKey(row.key);
    try {
      const customer = getCustomer(row.customerId);
      const paymentCount = payments.filter(
        (payment) => payment.date === settlementPaymentDate && payment.customerId === row.customerId
      ).length;
      const jobDateRange = getJobDateRange(row.jobs);
      const sameMonth = jobDateRange.from.substring(0, 7) === jobDateRange.to.substring(0, 7);
      const customNotes = settlementNotes.trim();
      const notes = `From JobCard ${row.cardId}${customNotes ? ` - ${customNotes}` : ''}`;

      const newPayment: Omit<Payment, 'id' | 'createdAt'> = {
        customerId: row.customerId,
        amount: amountToSettle,
        paymentMode: finalMode,
        breakdown,
        date: settlementPaymentDate,
        referenceNumber: customer
          ? generateMeaningfulPaymentId(customer, settlementPaymentDate, paymentCount + 1)
          : undefined,
        paymentForMonth: sameMonth ? jobDateRange.from.substring(0, 7) : undefined,
        paymentForFromDate: sameMonth ? undefined : jobDateRange.from,
        paymentForDate: sameMonth ? undefined : jobDateRange.to,
        notes,
      };

      await addPayment(newPayment);

      await Promise.all(
        row.jobs.map((job) =>
          updateJob(job.id, {
            paidAmount: getJobFinalBillValue(job),
            paymentStatus: 'Paid',
            paymentMode: finalMode,
          })
        )
      );
      toast.success('Settled', `${row.cardId} payment posted and marked paid.`);
      closeSettlementPreview();
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Failed to settle this job card');
    } finally {
      setSettlingCardKey(null);
    }
  };

  const flowFilterOptions: Array<{ value: WorkFlowFilter; label: string }> = [
    { value: 'all', label: 'All Work' },
    { value: 'slw_work', label: 'SLW Work' },
    { value: 'agent_work', label: 'Agent Work' },
  ];
  const handlerFilterOptions: Array<{ value: HandlerFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'bhai', label: 'Bhai' },
    { value: 'raja', label: 'Raja' },
  ];

  const selectedRow = useMemo(
    () => sortedRows.find((row) => row.key === selectedRowKey) || null,
    [selectedRowKey, sortedRows]
  );
  const settlementPreviewRow = useMemo(
    () => sortedRows.find((row) => row.key === settlementPreviewKey) || null,
    [settlementPreviewKey, sortedRows]
  );

  useEffect(() => {
    if (settlementPreviewKey && !settlementPreviewRow) {
      setSettlementPreviewKey(null);
    }
  }, [settlementPreviewKey, settlementPreviewRow]);

  return (
    <div className="fin-screen settle-screen">
      <div className="fin-pg-header settle-header">
        <div className="settle-header-copy">
          <div className="fin-pg-title-row">
            <h1 className="fin-pg-title">Payment Settlement</h1>
          </div>
          <p className="fin-pg-desc">
            Pick a customer, narrow the job cards, and settle the row that drives the report totals.
          </p>
        </div>
      </div>

      <div className="settle-control-bar">
        <div className="fin-period-tabs settle-period-tabs">
          {PERIOD_TABS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              className={`fin-period-tab${period === mode ? ' active' : ''}`}
              onClick={() => {
                setPeriod(mode);
                setPeriodOffset(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {period !== 'all' && period !== 'range' ? (
          <div className="fin-period-nav settle-period-nav">
            <button
              type="button"
              className="fin-period-nav-btn"
              onClick={() => setPeriodOffset((value) => value - 1)}
              aria-label="Previous period"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M10 3L5 8L10 13"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span className="fin-period-nav-label">{getOffsetPeriodLabel(period, periodOffset)}</span>
            <button
              type="button"
              className="fin-period-nav-btn"
              onClick={() => setPeriodOffset((value) => value + 1)}
              disabled={periodOffset >= 0}
              aria-label="Next period"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M6 3L11 8L6 13"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {periodOffset !== 0 ? (
              <button
                type="button"
                className="fin-period-nav-reset"
                onClick={() => setPeriodOffset(0)}
              >
                Current
              </button>
            ) : null}
          </div>
        ) : null}

        {period === 'range' ? (
          <div className="fin-range-row settle-range-row">
            <div className="fin-range-field">
              <label className="fin-range-label" htmlFor="settle-from">
                From
              </label>
              <input
                id="settle-from"
                type="date"
                className="fin-range-input"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                max={rangeTo || today}
              />
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="fin-range-arrow"
              aria-hidden="true"
            >
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="fin-range-field">
              <label className="fin-range-label" htmlFor="settle-to">
                To
              </label>
              <input
                id="settle-to"
                type="date"
                className="fin-range-input"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                min={rangeFrom}
                max={today}
              />
            </div>
          </div>
        ) : null}

        <div className="settle-toolbar-sep" />

        <SearchableSelect
          items={customerOptions}
          value={selectedCustomer}
          onChange={(customer) => setSelectedCustomerId(customer.id)}
          getLabel={(customer) =>
            customer.id === 0
              ? customer.name
              : customer.shortCode
                ? `${customer.name} - ${customer.shortCode}`
                : customer.name
          }
          getKey={(customer) => String(customer.id)}
          getSearchText={(customer) => `${customer.name} ${customer.shortCode || ''}`}
          placeholder="Customer"
          className="settle-customer-select"
        />

        {showFlowFilter ? (
          <div className="settle-payment-filter" role="group" aria-label="Flow filter">
            {flowFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`settle-pf-btn${flowFilter === option.value ? ' active' : ''}`}
                onClick={() => setFlowFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        {showHandlerFilter ? (
          <div className="settle-payment-filter" role="group" aria-label="Handler filter">
            {handlerFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`settle-pf-btn${handlerFilter === option.value ? ' active' : ''}`}
                onClick={() => setHandlerFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="settle-toolbar-end">
          <span className="settle-count">
            {sortedRows.length} card{sortedRows.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            className="settle-reset-btn"
            onClick={() => {
              setSelectedCustomerId(0);
              setFlowFilter('all');
              setHandlerFilter('all');
              setSearchText('');
              setTableSort({ key: 'date', order: 'desc' });
            }}
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="fin-stats fin-stats-4 settle-stats">
        <div className="fin-stat">
          <span className="fin-stat-label">Job Cards</span>
          <span className="fin-stat-value">{totals.cards}</span>
          <span className="fin-stat-sub">In filtered view</span>
        </div>
        <div className="fin-stat">
          <span className="fin-stat-label">Final Bill</span>
          <span className="fin-stat-value">{formatCurrency(totals.finalBill)}</span>
          <span className="fin-stat-sub">Total billed amount</span>
        </div>
        <div className="fin-stat fin-stat--green">
          <span className="fin-stat-label">Paid</span>
          <span className="fin-stat-value">{formatCurrency(totals.paid)}</span>
          <span className="fin-stat-sub">Collected so far</span>
        </div>
        <div className={`fin-stat${totals.pending > 0 ? ' fin-stat--red' : ' fin-stat--green'}`}>
          <span className="fin-stat-label">Pending</span>
          <span className="fin-stat-value">{formatCurrency(totals.pending)}</span>
          <span className="fin-stat-sub">Still to settle</span>
        </div>
      </div>

      <div className="fin-table-tile settle-table-tile">
        <div className="settle-table-head">
          <div>
            <div className="fin-chart-title">Job Card Settlement</div>
            <p className="settle-table-subtitle">
              {periodLabel} -{' '}
              {hasCustomerSelection
                ? `${selectedCustomer.name}${selectedCustomer.shortCode ? ` - ${selectedCustomer.shortCode}` : ''}`
                : 'Select customer'}{' '}
              - {sortedRows.length} card{sortedRows.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="settle-legend">
            <input
              type="text"
              className="settle-search-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search cards..."
            />
            <StatusBadge status="Pending" />
            <StatusBadge status="Partially Paid" />
            <StatusBadge status="Paid" />
          </div>
        </div>

        <div className="fin-table-wrap settle-table-wrap">
          <table className="fin-table settle-table">
            <thead>
              <tr>
                <th
                  className={`slw-sortable-th${tableSort?.key === 'date' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTableSort((current) => nextSortState(current, 'date', 'desc'))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTableSort((current) => nextSortState(current, 'date', 'desc'));
                    }
                  }}
                >
                  Date {sortMark(tableSort, 'date')}
                </th>
                {showExtendedColumns ? (
                  <>
                    <th
                      className={`slw-sortable-th${tableSort?.key === 'billNo' ? ' is-active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setTableSort((current) => nextSortState(current, 'billNo'))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setTableSort((current) => nextSortState(current, 'billNo'));
                        }
                      }}
                    >
                      Bill No {sortMark(tableSort, 'billNo')}
                    </th>
                    <th
                      className={`slw-sortable-th${tableSort?.key === 'dcNo' ? ' is-active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setTableSort((current) => nextSortState(current, 'dcNo'))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setTableSort((current) => nextSortState(current, 'dcNo'));
                        }
                      }}
                    >
                      DC No {sortMark(tableSort, 'dcNo')}
                    </th>
                    <th
                      className={`slw-sortable-th${tableSort?.key === 'vehicleNo' ? ' is-active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setTableSort((current) => nextSortState(current, 'vehicleNo'))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setTableSort((current) => nextSortState(current, 'vehicleNo'));
                        }
                      }}
                    >
                      Vehicle {sortMark(tableSort, 'vehicleNo')}
                    </th>
                  </>
                ) : null}
                <th
                  className={`slw-sortable-th${tableSort?.key === 'work' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTableSort((current) => nextSortState(current, 'work'))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTableSort((current) => nextSortState(current, 'work'));
                    }
                  }}
                >
                  Work {sortMark(tableSort, 'work')}
                </th>
                <th
                  className={`numeric slw-sortable-th${tableSort?.key === 'amount' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTableSort((current) => nextSortState(current, 'amount', 'desc'))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTableSort((current) => nextSortState(current, 'amount', 'desc'));
                    }
                  }}
                >
                  Amount {sortMark(tableSort, 'amount')}
                </th>
                <th
                  className={`numeric slw-sortable-th${tableSort?.key === 'commission' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTableSort((current) => nextSortState(current, 'commission', 'desc'))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTableSort((current) => nextSortState(current, 'commission', 'desc'));
                    }
                  }}
                >
                  Commission {sortMark(tableSort, 'commission')}
                </th>
                <th
                  className={`numeric slw-sortable-th${tableSort?.key === 'finalBill' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTableSort((current) => nextSortState(current, 'finalBill', 'desc'))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTableSort((current) => nextSortState(current, 'finalBill', 'desc'));
                    }
                  }}
                >
                  Final Bill {sortMark(tableSort, 'finalBill')}
                </th>
                <th
                  className={`slw-sortable-th${tableSort?.key === 'status' ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTableSort((current) => nextSortState(current, 'status'))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTableSort((current) => nextSortState(current, 'status'));
                    }
                  }}
                >
                  Status {sortMark(tableSort, 'status')}
                </th>
                <th className="ta-c">Action</th>
                </tr>
              </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="settle-empty-cell">
                    {hasCustomerSelection
                      ? 'No job cards match the selected settlement filters.'
                      : 'Choose a customer to load settlement rows.'}
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr
                    key={row.key}
                    className="settle-row"
                    onClick={() => setSelectedRowKey(row.key)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedRowKey(row.key);
                      }
                    }}
                  >
                    <td>
                      <span className="settle-date">{formatDateCell(row.date)}</span>
                    </td>
                    {showExtendedColumns ? (
                      <>
                        <td>
                          <span className="settle-mono">{row.billNo || '-'}</span>
                        </td>
                        <td>
                          <span className="settle-mono">{row.dcNo || '-'}</span>
                        </td>
                        <td>
                          <span className="settle-mono">{row.vehicleNo || '-'}</span>
                        </td>
                      </>
                    ) : null}
                    <td>
                      <div className="settle-work-summary">{row.workSummary || '-'}</div>
                    </td>
                    <td className="numeric settle-num">{formatCurrency(row.amount)}</td>
                    <td className="numeric settle-num">{formatCurrency(row.commission)}</td>
                    <td className="numeric settle-num">{formatCurrency(row.finalBill)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="ta-c">
                  <button
                        type="button"
                      className="settle-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetSettlementEntry();
                          setSettlementPreviewKey(row.key);
                        }}
                        disabled={settlingCardKey === row.key || row.pending <= 0.009}
                        title={row.pending <= 0.009 ? 'Already settled' : 'Settle job card'}
                      >
                        {settlingCardKey === row.key ? 'Settling...' : row.pending <= 0.009 ? 'Settled' : 'Settle'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {sortedRows.length > 0 ? (
              <tfoot>
                <tr className="settle-total-row">
                  <td colSpan={summaryColSpan}>{sortedRows.length} cards</td>
                  <td className="numeric">{formatCurrency(totals.amount)}</td>
                  <td className="numeric">{formatCurrency(totals.commission)}</td>
                  <td className="numeric">{formatCurrency(totals.finalBill)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {selectedRow ? (
        <JobCardDetailsModal
          isOpen={Boolean(selectedRow)}
          jobs={selectedRow.jobs}
          onClose={() => setSelectedRowKey(null)}
          getCustomer={getCustomer}
        />
      ) : null}

      {settlementPreviewRow ? (
        <Modal
          isOpen={Boolean(settlementPreviewRow)}
          onClose={closeSettlementPreview}
          title="Confirm settlement"
          subtitle="Review the card before posting the payment voucher."
          size="md"
          className="settle-preview-modal"
        >
          <div className="settle-preview">
            <div className="settle-preview-hero">
              <div>
                <div className="settle-preview-kicker">Settle job card</div>
                <div className="settle-preview-card">{settlementPreviewRow.cardId}</div>
                <div className="settle-preview-customer">
                  {settlementPreviewRow.customerName}
                  {settlementPreviewRow.customerCode ? ` - ${settlementPreviewRow.customerCode}` : ''}
                </div>
              </div>
              <div className="settle-preview-amount-wrap">
                <div className="settle-preview-amount">
                  {formatCurrency(settlementPreviewRow.pending)}
                </div>
                <div className="settle-preview-amount-label">Amount to settle</div>
              </div>
            </div>

            <div className="settle-preview-grid">
              <div className="settle-preview-item">
                <span className="settle-preview-label">Final bill</span>
                <strong>{formatCurrency(settlementPreviewRow.finalBill)}</strong>
              </div>
              <div className="settle-preview-item">
                <span className="settle-preview-label">Paid so far</span>
                <strong className="settle-paid">{formatCurrency(settlementPreviewRow.paid)}</strong>
              </div>
              <div className="settle-preview-item">
                <span className="settle-preview-label">Pending</span>
                <strong className="settle-pending">
                  {formatCurrency(settlementPreviewRow.pending)}
                </strong>
              </div>
              <div className="settle-preview-item">
                <span className="settle-preview-label">Job lines</span>
                <strong>{settlementPreviewRow.lineCount}</strong>
              </div>
            </div>

            <div className="settle-preview-note">
              Settling this card posts a payment voucher and updates every job line, so payment
              history, card status, and balance reports stay in sync.
            </div>

            <div className="settle-payment-entry">
              <div className="settle-payment-field">
                <label className="settle-payment-label">Payment mode</label>
                <PaymentModeGroup
                  value={settlementPaymentMode}
                  onChange={setSettlementPaymentMode}
                />
              </div>

              {settlementPaymentMode === 'mixed' ? (
                <div className="settle-payment-mixed">
                  {[
                    { id: 'settle-cash', label: 'Cash', value: settlementCash, set: setSettlementCash },
                    { id: 'settle-upi', label: 'UPI', value: settlementUPI, set: setSettlementUPI },
                    { id: 'settle-bank', label: 'Bank', value: settlementBank, set: setSettlementBank },
                    { id: 'settle-cheque', label: 'Cheque', value: settlementCheque, set: setSettlementCheque },
                  ].map(({ id, label, value, set }) => (
                    <div key={id} className="settle-payment-field">
                      <label className="settle-payment-label" htmlFor={id}>{label}</label>
                      <input
                        id={id}
                        type="number"
                        className="settle-payment-input"
                        value={value}
                        onChange={(event) => set(event.target.value)}
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                  <div
                    className={`settle-breakdown-total${
                      Math.abs(settlementBreakdownTotal - settlementPreviewRow.pending) <= 0.01
                        ? ' is-balanced'
                        : ''
                    }`}
                  >
                    Split total {formatCurrency(settlementBreakdownTotal)} /{' '}
                    {formatCurrency(settlementPreviewRow.pending)}
                  </div>
                </div>
              ) : null}

              <div className="settle-payment-grid">
                <div className="settle-payment-field">
                  <label className="settle-payment-label" htmlFor="settle-payment-date">Payment date</label>
                  <input
                    id="settle-payment-date"
                    type="date"
                    className="settle-payment-input"
                    value={settlementPaymentDate}
                    onChange={(event) => setSettlementPaymentDate(event.target.value)}
                    max={today}
                    required
                  />
                </div>
                <div className="settle-payment-field">
                  <label className="settle-payment-label" htmlFor="settle-notes">Notes</label>
                  <input
                    id="settle-notes"
                    type="text"
                    className="settle-payment-input"
                    value={settlementNotes}
                    onChange={(event) => setSettlementNotes(event.target.value)}
                    maxLength={500}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div className="settle-preview-actions">
              <button
                type="button"
                className="settle-reset-btn"
                onClick={closeSettlementPreview}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settle-action-btn settle-action-btn--primary"
                onClick={() => void performSettlement(settlementPreviewRow)}
                disabled={settlingCardKey === settlementPreviewRow.key}
              >
                {settlingCardKey === settlementPreviewRow.key ? 'Settling...' : 'Settle now'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
