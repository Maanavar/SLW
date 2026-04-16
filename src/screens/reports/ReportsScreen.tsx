import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { StatusBadge } from '@/components/ui/Badge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { JobCardEditOverlay } from '@/components/job-card/JobCardEditOverlay';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, getReportRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobCardPaymentSummary, getJobNetValue, getJobPaidAmount } from '@/lib/jobUtils';
import type { PaymentBreakdown } from '@/components/ui/StatCard';
import { getLocalDateString } from '@/lib/dateUtils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import '../customers/CustomersScreen.css';
import './ReportsScreen.css';

type PeriodType =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'halfyear'
  | 'year'
  | 'all'
  | 'range';

type PaymentFilter = 'all' | 'paid' | 'unpaid';
type ReportViewMode = 'cards' | 'table';
type ReportCustomerOption = {
  id: number;
  name: string;
  shortCode?: string;
};

interface ReportCardRow {
  id: string;
  date: string;
  cardId: string;
  customer: string;
  lineCount: number;
  works: string;
  net: number;
  finalBill: number;
  paid: number;
  pending: number;
  status: 'Paid' | 'Pending' | 'Partially Paid';
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

interface ExportFieldSelection {
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
  notes?: boolean;
}

const DEFAULT_EXPORT_FIELDS: ExportFieldSelection = {
  cardId: true,
  date: true,
  customer: true,
  workType: true,
  quantity: true,
  amount: true,
  commission: false,
  paid: true,
  dcNo: true,
  dcDate: true,
  notes: false,
};

export function ReportsScreen() {
  const { jobs, getActiveCustomers, getCustomer, deleteJob } = useDataStore();
  const [period, setPeriod] = useState<PeriodType>('month');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [viewMode, setViewMode] = useState<ReportViewMode>('table');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState(getLocalDateString(new Date()));
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [editingCardKey, setEditingCardKey] = useState<string | null>(null);
  const [showExportFields, setShowExportFields] = useState(false);
  const [exportFields, setExportFields] = useState<ExportFieldSelection>(DEFAULT_EXPORT_FIELDS);
  const [showReceivedBreakdown, setShowReceivedBreakdown] = useState(false);
  const today = getLocalDateString(new Date());

  const handleDeleteCard = async () => {
    if (!selectedGroup) return;

    const cardId = selectedGroup.primary.jobCardId || `LEGACY-${selectedGroup.primary.id}`;
    const confirmed = window.confirm(
      `Are you sure you want to delete JobCard ${cardId}?\n\nThis will remove ${selectedGroup.jobs.length} job line(s) and cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(selectedGroup.jobs.map((job) => deleteJob(job.id)));
      setSelectedCardKey(null);
    } catch (error) {
      console.error('Error deleting job card:', error);
    }
  };

  const handleEditCard = () => {
    if (!selectedGroup) return;
    setEditingCardKey(selectedGroup.key);
  };

  const customers = getActiveCustomers().sort((a, b) => a.name.localeCompare(b.name));
  const customerOptions = useMemo<ReportCustomerOption[]>(
    () => [{ id: 0, name: 'All Clients' }, ...customers],
    [customers]
  );

  const range = useMemo(() => {
    if (period === 'all') {
      return { from: undefined, to: undefined, label: 'All Time' };
    }
    if (period === 'range') {
      return { from: rangeFrom || undefined, to: rangeTo || undefined, label: 'Custom Range' };
    }

    const mapped = getReportRange(period);
    return { from: mapped.from, to: mapped.to, label: period };
  }, [period, rangeFrom, rangeTo]);

  const jobsInRange = getJobsInRange(jobs, range.from, range.to);
  const filteredJobs = selectedCustomerId
    ? jobsInRange.filter((job) => job.customerId === selectedCustomerId)
    : jobsInRange;

  const groupedJobs = useMemo(
    () =>
      groupJobsByCard(filteredJobs)
        .filter((group) => {
          if (paymentFilter === 'all') {
            return true;
          }

          const status = getJobCardPaymentSummary(group.jobs).status;
          return paymentFilter === 'paid' ? status === 'Paid' : status !== 'Paid';
        })
        .sort((a, b) => {
          if (a.primary.date !== b.primary.date) {
            return b.primary.date.localeCompare(a.primary.date);
          }

          const aCreated = a.primary.createdAt ? new Date(a.primary.createdAt).getTime() : 0;
          const bCreated = b.primary.createdAt ? new Date(b.primary.createdAt).getTime() : 0;
          return bCreated - aCreated;
        }),
    [filteredJobs, paymentFilter]
  );
  const selectedGroup = useMemo(
    () => groupedJobs.find((group) => group.key === selectedCardKey) || null,
    [groupedJobs, selectedCardKey]
  );

  const editingGroup = useMemo(
    () => groupedJobs.find((group) => group.key === editingCardKey) || null,
    [groupedJobs, editingCardKey]
  );

  const summary = useMemo(() => {
    let ourIncome = 0;
    let totalFinalBill = 0;
    let totalPaid = 0;

    groupedJobs.forEach((group) => {
      const payment = getJobCardPaymentSummary(group.jobs);
      ourIncome += payment.net;
      totalFinalBill += payment.finalBill;
      totalPaid += group.jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
    });

    return {
      totalCards: groupedJobs.length,
      ourIncome,
      totalFinalBill,
      totalPaid,
    };
  }, [groupedJobs]);

  const pendingAmount = summary.totalFinalBill - summary.totalPaid;
  const emptyStateMessage =
    paymentFilter === 'all'
      ? 'No jobs found for the selected filters'
      : paymentFilter === 'paid'
        ? 'No paid jobs found for the selected filters'
        : 'No unpaid jobs found for the selected filters';

  const receivedBreakdown = useMemo<PaymentBreakdown>(() => {
    const bd: PaymentBreakdown = { cash: 0, upi: 0, bank: 0, cheque: 0 };
    groupedJobs.forEach((group) => {
      group.jobs.forEach((job) => {
        const paid = getJobPaidAmount(job);
        if (paid > 0 && job.paymentMode) {
          if (job.paymentMode === 'Cash') bd.cash = (bd.cash || 0) + paid;
          else if (job.paymentMode === 'UPI') bd.upi = (bd.upi || 0) + paid;
          else if (job.paymentMode === 'Bank') bd.bank = (bd.bank || 0) + paid;
          else if (job.paymentMode === 'Cheque') bd.cheque = (bd.cheque || 0) + paid;
        }
      });
    });
    return bd;
  }, [groupedJobs]);

  const hasReceivedBreakdown = Boolean(
    receivedBreakdown.cash || receivedBreakdown.upi || receivedBreakdown.bank || receivedBreakdown.cheque
  );

  const reportRows = useMemo(() => {
    return groupedJobs.flatMap((group) =>
      group.jobs.map((job) => {
        const customer = getCustomer(job.customerId);

        return {
          cardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
          date: job.date,
          customer: customer?.name || 'Unknown',
          workType: job.workTypeName,
          quantity: job.quantity,
          amount: getJobNetValue(job),
          commission: job.commissionAmount || 0,
          paid: getJobPaidAmount(job),
          dcNo: job.dcNo || '-',
          dcDate: job.dcDate || '-',
        };
      })
    );
  }, [groupedJobs, getCustomer]);

  const reportCardRows = useMemo<ReportCardRow[]>(
    () =>
      groupedJobs.map((group) => {
        const payment = getJobCardPaymentSummary(group.jobs);
        const customerName = getCustomer(group.primary.customerId)?.name || 'Unknown';
        const works = group.jobs
          .map((job) => job.workTypeName)
          .filter((value, index, arr) => arr.indexOf(value) === index)
          .join(', ');

        return {
          id: group.key,
          date: group.primary.date,
          cardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
          customer: customerName,
          lineCount: group.lineCount,
          works,
          net: payment.net,
          finalBill: payment.finalBill,
          paid: payment.paid,
          pending: payment.pending,
          status: payment.status,
        };
      }),
    [groupedJobs, getCustomer]
  );

  const reportTableColumns: Column<ReportCardRow>[] = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'cardId', label: 'JobCard', sortable: true },
    { key: 'customer', label: 'Customer', sortable: true },
    { key: 'lineCount', label: 'Lines', sortable: true },
    { key: 'works', label: 'Works' },
    { key: 'net', label: 'Net', render: (value) => formatCurrency(value as number) },
    { key: 'finalBill', label: 'Final Bill', render: (value) => formatCurrency(value as number) },
    { key: 'paid', label: 'Paid', render: (value) => formatCurrency(value as number) },
    { key: 'pending', label: 'Pending', render: (value) => formatCurrency(value as number) },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value as string} /> },
  ];

  const handleExportExcel = () => {
    const headers: string[] = [];
    const dataIndices: (keyof typeof reportRows[0])[] = [];

    if (exportFields.cardId) { headers.push('Card ID'); dataIndices.push('cardId'); }
    if (exportFields.date) { headers.push('Date'); dataIndices.push('date'); }
    if (exportFields.customer) { headers.push('Customer'); dataIndices.push('customer'); }
    if (exportFields.workType) { headers.push('Work Type'); dataIndices.push('workType'); }
    if (exportFields.quantity) { headers.push('Qty'); dataIndices.push('quantity'); }
    if (exportFields.amount) { headers.push('Net Amount'); dataIndices.push('amount'); }
    if (exportFields.commission) { headers.push('Commission'); dataIndices.push('commission'); }
    if (exportFields.paid) { headers.push('Paid'); dataIndices.push('paid'); }
    if (exportFields.dcNo) { headers.push('DC No'); dataIndices.push('dcNo'); }
    if (exportFields.dcDate) { headers.push('DC Date'); dataIndices.push('dcDate'); }

    const lines = [
      headers.join(','),
      ...reportRows.map((row) =>
        dataIndices
          .map((key) => {
            const value = String(row[key] || '');
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ];

    downloadTextFile(`slw-report-${today}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
  };

  const handleExportPdf = () => {
    const headers: string[] = [];
    const dataIndices: (keyof typeof reportRows[0])[] = [];

    if (exportFields.cardId) { headers.push('Card ID'); dataIndices.push('cardId'); }
    if (exportFields.date) { headers.push('Date'); dataIndices.push('date'); }
    if (exportFields.customer) { headers.push('Customer'); dataIndices.push('customer'); }
    if (exportFields.workType) { headers.push('Work Type'); dataIndices.push('workType'); }
    if (exportFields.quantity) { headers.push('Qty'); dataIndices.push('quantity'); }
    if (exportFields.amount) { headers.push('Net Amount'); dataIndices.push('amount'); }
    if (exportFields.commission) { headers.push('Commission'); dataIndices.push('commission'); }
    if (exportFields.paid) { headers.push('Paid'); dataIndices.push('paid'); }
    if (exportFields.dcNo) { headers.push('DC No'); dataIndices.push('dcNo'); }
    if (exportFields.dcDate) { headers.push('DC Date'); dataIndices.push('dcDate'); }

    const headerRow = headers.map((h) => `<th>${h}</th>`).join('');
    const bodyRows = reportRows
      .map((row) => {
        const cells = dataIndices.map((key) => `<td>${row[key] || '-'}</td>`).join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Siva Lathe Works Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
            background: #f5f5f7;
            padding: 40px;
            color: #1d1d1f;
          }

          .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 1200px;
            margin: 0 auto;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .header {
            margin-bottom: 32px;
            border-bottom: 1px solid #e5e5e7;
            padding-bottom: 20px;
          }

          h1 {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #1d1d1f;
          }

          .report-period {
            font-size: 14px;
            color: #86868b;
            font-weight: 500;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }

          .summary-card {
            background: #f5f5f7;
            border-radius: 8px;
            padding: 16px;
            border-left: 3px solid #0071e3;
          }

          .summary-card.positive { border-left-color: #34c759; }
          .summary-card.negative { border-left-color: #ff3b30; }
          .summary-card.neutral { border-left-color: #a2a2a7; }

          .summary-label {
            font-size: 12px;
            color: #86868b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
            margin-bottom: 6px;
            display: block;
          }

          .summary-value {
            font-size: 18px;
            font-weight: 600;
            color: #1d1d1f;
            font-family: 'Courier New', monospace;
          }

          .summary-card.positive .summary-value { color: #34c759; }
          .summary-card.negative .summary-value { color: #ff3b30; }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }

          thead {
            background: #f5f5f7;
            border-bottom: 2px solid #e5e5e7;
          }

          th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            color: #1d1d1f;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          td {
            padding: 12px;
            border-bottom: 1px solid #e5e5e7;
            font-size: 13px;
            color: #1d1d1f;
          }

          tbody tr:hover {
            background: #f5f5f7;
          }

          tbody tr:last-child td {
            border-bottom: none;
          }

          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e7;
            font-size: 12px;
            color: #86868b;
            text-align: center;
          }

          @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; padding: 0; }
            tbody tr:hover { background: white; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Siva Lathe Works</h1>
            <div class="report-period">Report Period: ${range.label} | Generated: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>

          <div class="summary-grid">
            <div class="summary-card neutral">
              <span class="summary-label">Job Cards</span>
              <div class="summary-value">${summary.totalCards}</div>
            </div>
            <div class="summary-card">
              <span class="summary-label">Our Net Income</span>
              <div class="summary-value">${formatCurrency(summary.ourIncome)}</div>
            </div>
            <div class="summary-card">
              <span class="summary-label">Final Bill</span>
              <div class="summary-value">${formatCurrency(summary.totalFinalBill)}</div>
            </div>
            <div class="summary-card positive">
              <span class="summary-label">Total Received</span>
              <div class="summary-value">${formatCurrency(summary.totalPaid)}</div>
            </div>
            <div class="summary-card ${summary.totalFinalBill - summary.totalPaid > 0 ? 'negative' : 'positive'}">
              <span class="summary-label">Pending</span>
              <div class="summary-value">${formatCurrency(summary.totalFinalBill - summary.totalPaid)}</div>
            </div>
          </div>

          <table>
            <thead><tr>${headerRow}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>

          <div class="footer">
            Generated on ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • Siva Lathe Works Management System
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([reportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slw-report-${today}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportWhatsApp = () => {
    const baseText = [
      `SLW Report (${range.label})`,
      `Job Cards: ${summary.totalCards}`,
      `Our Net Income: ${formatCurrency(summary.ourIncome)}`,
      `Final Bill: ${formatCurrency(summary.totalFinalBill)}`,
      `Total Received: ${formatCurrency(summary.totalPaid)}`,
      `Pending: ${formatCurrency(summary.totalFinalBill - summary.totalPaid)}`,
    ];

    const text = baseText.join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="customers-screen">
      <div className="screen-header reports-header">
        <div className="reports-title-block">
          <h2 className="screen-title">Reports</h2>
          <p className="reports-subtitle">Track cards, revenue, and collections with flexible filters.</p>
        </div>
        <div className="reports-filters-panel">
          <div className="screen-controls reports-filters">
            <div className="period-select">
              <label className="filter-label" htmlFor="period-select">
                Period
              </label>
              <select
                id="period-select"
                className="search-input"
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodType)}
                title="Select reporting period"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="halfyear">This Half-Year</option>
                <option value="year">This Year</option>
                <option value="range">Custom Date Range</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {period === 'range' ? (
              <div className="range-controls">
                <div className="period-select">
                  <label className="filter-label" htmlFor="range-from">
                    From
                  </label>
                  <input
                    id="range-from"
                    type="date"
                    className="search-input"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    max={today}
                  />
                </div>
                <div className="period-select">
                  <label className="filter-label" htmlFor="range-to">
                    To
                  </label>
                  <input
                    id="range-to"
                    type="date"
                    className="search-input"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    max={today}
                  />
                </div>
              </div>
            ) : null}

            <div className="customer-select">
              <label className="filter-label">Customer</label>
              <SearchableSelect<ReportCustomerOption>
                items={customerOptions}
                value={
                  selectedCustomerId === null
                    ? { id: 0, name: 'All Clients' }
                    : customerOptions.find((c) => c.id === selectedCustomerId) || {
                        id: 0,
                        name: 'All Clients',
                      }
                }
                onChange={(item) => setSelectedCustomerId(item.id === 0 ? null : item.id)}
                getLabel={(item) => item.name}
                getKey={(item) => String(item.id)}
                getSearchText={(item) => `${item.name} ${item.shortCode || ''}`}
                placeholder="Select customer..."
              />
            </div>

            <div className="payment-filter-select">
              <label className="filter-label">Payment</label>
              <div className="payment-filter-toggle">
                <button
                  type="button"
                  className={`payment-filter-btn ${paymentFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setPaymentFilter('all')}
                  aria-pressed={paymentFilter === 'all'}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`payment-filter-btn ${paymentFilter === 'paid' ? 'active' : ''}`}
                  onClick={() => setPaymentFilter('paid')}
                  aria-pressed={paymentFilter === 'paid'}
                >
                  Paid
                </button>
                <button
                  type="button"
                  className={`payment-filter-btn ${paymentFilter === 'unpaid' ? 'active' : ''}`}
                  onClick={() => setPaymentFilter('unpaid')}
                  aria-pressed={paymentFilter === 'unpaid'}
                >
                  Unpaid
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="screen-content">
        <div className="reports-toolbar">
          <div className="reports-toolbar-left">
            <div className="reports-view-toggle">
              <button
                type="button"
                className={`reports-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
                aria-pressed={viewMode === 'cards'}
              >
                Card View
              </button>
              <button
                type="button"
                className={`reports-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
              >
                Table View
              </button>
            </div>
            <span className="reports-results-count">{groupedJobs.length} cards</span>
          </div>

          <div className="report-actions reports-toolbar-right">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowExportFields(!showExportFields)}
              title="Select which fields to include in export"
            >
              {showExportFields ? 'Hide Fields' : 'Select Fields'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExportExcel}>
              Export Excel
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExportPdf}>
              Export PDF
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExportWhatsApp}>
              Share WhatsApp
            </button>
          </div>
        </div>

        {showExportFields && (
          <div className="export-fields-selector">
            <h3 className="fields-selector-title">Select Fields to Export</h3>
            <div className="fields-groups">
              <div className="field-group">
                <h4 className="field-group-title">Basic Information</h4>
                <div className="field-group-items">
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={exportFields.cardId}
                      onChange={(e) => setExportFields({ ...exportFields, cardId: e.target.checked })}
                    />
                    Card ID
                  </label>
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={exportFields.date}
                      onChange={(e) => setExportFields({ ...exportFields, date: e.target.checked })}
                    />
                    Date
                  </label>
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={exportFields.customer}
                      onChange={(e) => setExportFields({ ...exportFields, customer: e.target.checked })}
                    />
                    Customer
                  </label>
                </div>
              </div>

              <div className="field-group">
                <h4 className="field-group-title">Work Details</h4>
                <div className="field-group-items">
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={exportFields.workType}
                      onChange={(e) => setExportFields({ ...exportFields, workType: e.target.checked })}
                    />
                    Work Type
                  </label>
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={exportFields.quantity}
                      onChange={(e) => setExportFields({ ...exportFields, quantity: e.target.checked })}
                    />
                    Quantity
                  </label>
                </div>
              </div>

              <div className="field-group">
                <h4 className="field-group-title">Financial</h4>
                <div className="field-group-items">
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={exportFields.amount}
                      onChange={(e) => setExportFields({ ...exportFields, amount: e.target.checked })}
                    />
                    Net Amount
                  </label>
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={exportFields.commission}
                      onChange={(e) => setExportFields({ ...exportFields, commission: e.target.checked })}
                    />
                    Commission
                  </label>
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={exportFields.paid}
                      onChange={(e) => setExportFields({ ...exportFields, paid: e.target.checked })}
                    />
                    Paid
                  </label>
                </div>
              </div>

              <div className="field-group">
                <h4 className="field-group-title">Delivery Challan</h4>
                <div className="field-group-items">
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={exportFields.dcNo}
                      onChange={(e) => setExportFields({ ...exportFields, dcNo: e.target.checked })}
                    />
                    DC No
                  </label>
                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={exportFields.dcDate}
                      onChange={(e) => setExportFields({ ...exportFields, dcDate: e.target.checked })}
                    />
                    DC Date
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="reports-summary">
          <div className="summary-card">
            <h3 className="summary-card-label">Total Job Cards</h3>
            <p className="summary-card-value">{summary.totalCards}</p>
          </div>
          <div className="summary-card">
            <h3 className="summary-card-label">Our Net Income</h3>
            <p className="summary-card-value">{formatCurrency(summary.ourIncome)}</p>
          </div>
          <div className="summary-card">
            <h3 className="summary-card-label">Final Bill</h3>
            <p className="summary-card-value">{formatCurrency(summary.totalFinalBill)}</p>
          </div>
          <div
            className={`summary-card${hasReceivedBreakdown ? ' summary-card--hoverable' : ''}`}
            onMouseEnter={() => hasReceivedBreakdown && setShowReceivedBreakdown(true)}
            onMouseLeave={() => setShowReceivedBreakdown(false)}
          >
            <h3 className="summary-card-label">Total Received</h3>
            <p className="summary-card-value">{formatCurrency(summary.totalPaid)}</p>
            {hasReceivedBreakdown && showReceivedBreakdown && (
              <div className="reports-breakdown-tooltip">
                <div className="breakdown-header">Payment Breakdown</div>
                <div className="breakdown-items">
                  {(receivedBreakdown.cash || 0) > 0 && (
                    <div className="breakdown-item">
                      <span className="breakdown-label">Cash</span>
                      <span className="breakdown-value">₹{receivedBreakdown.cash!.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {(receivedBreakdown.upi || 0) > 0 && (
                    <div className="breakdown-item">
                      <span className="breakdown-label">UPI</span>
                      <span className="breakdown-value">₹{receivedBreakdown.upi!.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {(receivedBreakdown.bank || 0) > 0 && (
                    <div className="breakdown-item">
                      <span className="breakdown-label">Bank</span>
                      <span className="breakdown-value">₹{receivedBreakdown.bank!.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {(receivedBreakdown.cheque || 0) > 0 && (
                    <div className="breakdown-item">
                      <span className="breakdown-label">Cheque</span>
                      <span className="breakdown-value">₹{receivedBreakdown.cheque!.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="summary-card">
            <h3 className="summary-card-label">Pending</h3>
            <p className="summary-card-value">
              {formatCurrency(pendingAmount)}
            </p>
          </div>
        </div>

        <div className="reports-details">
          <div className="reports-details-header">
            <h3 className="details-title">Job Cards</h3>
            <span className="details-hint">
              {viewMode === 'table' ? 'Click a row to open job card details.' : 'Click a card to open details.'}
            </span>
          </div>
          {viewMode === 'cards' ? (
            <div className="job-cards-grid">
              {groupedJobs.length > 0 ? (
                groupedJobs.map((group) => {
                  const payment = getJobCardPaymentSummary(group.jobs);
                  const customerName = getCustomer(group.primary.customerId)?.name || 'Unknown';
                  return (
                    <div
                      key={group.key}
                      className="job-card job-card-clickable"
                      onClick={() => setSelectedCardKey(group.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCardKey(group.key);
                        }
                      }}
                    >
                      <div className="card-header">
                        <div>
                          <h4 className="card-title">{customerName}</h4>
                          <span className="card-subtitle">{group.primary.date}</span>
                        </div>
                        <div className="card-header-status">
                          <StatusBadge status={payment.status} />
                        </div>
                      </div>
                      <div className="card-body">
                        {group.jobs.map((job) => (
                          <div key={job.id} className="job-line">
                            <span className="job-work">{job.workTypeName}</span>
                            <span className="job-amount">{formatCurrency(getJobNetValue(job))}</span>
                          </div>
                        ))}
                      </div>
                      <div className="card-footer">
                        <span className="footer-label">Our Net</span>
                        <span className="footer-value">{formatCurrency(payment.net)}</span>
                        <span className="footer-label">Final Bill</span>
                        <span className="footer-value">{formatCurrency(payment.finalBill)}</span>
                        <span className="footer-label">Paid</span>
                        <span className="footer-value">{formatCurrency(payment.paid)}</span>
                        <span className="footer-label">Pending</span>
                        <span className="footer-value">{formatCurrency(payment.pending)}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">{emptyStateMessage}</div>
              )}
            </div>
          ) : (
            <DataTable<ReportCardRow>
              columns={reportTableColumns}
              data={reportCardRows}
              keyFn={(item) => item.id}
              className="reports-data-table"
              sortBy="date"
              sortOrder="desc"
              onRowClick={(row) => setSelectedCardKey(row.id)}
              emptyMessage={emptyStateMessage}
            />
          )}
        </div>
      </div>

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
        onSave={() => {
          setEditingCardKey(null);
        }}
      />
    </div>
  );
}
