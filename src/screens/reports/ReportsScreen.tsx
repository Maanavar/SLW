import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { StatusBadge } from '@/components/ui/Badge';
import { JobCardDetailsModal } from '@/components/job-card/JobCardDetailsModal';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobsInRange, getReportRange, groupJobsByCard } from '@/lib/reportUtils';
import { getJobCardPaymentSummary, getJobNetValue, getJobPaidAmount } from '@/lib/jobUtils';
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

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsScreen() {
  const { jobs, getActiveCustomers, getCustomer } = useDataStore();
  const [period, setPeriod] = useState<PeriodType>('month');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState(getLocalDateString(new Date()));
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const today = getLocalDateString(new Date());

  const customers = getActiveCustomers();

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

  const groupedJobs = groupJobsByCard(filteredJobs);
  const selectedGroup = useMemo(
    () => groupedJobs.find((group) => group.key === selectedCardKey) || null,
    [groupedJobs, selectedCardKey]
  );

  const summary = useMemo(() => {
    let ourIncome = 0;
    let totalPaid = 0;
    let totalCommission = 0;

    groupedJobs.forEach((group) => {
      ourIncome += group.jobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
      totalPaid += group.jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
      totalCommission += group.jobs.reduce((sum, job) => sum + (job.commissionAmount || 0), 0);
    });

    return {
      totalCards: groupedJobs.length,
      ourIncome,
      netIncome: ourIncome + totalCommission,
      totalPaid,
      totalCommission,
    };
  }, [groupedJobs]);

  const reportRows = useMemo(() => {
    return groupedJobs.flatMap((group) =>
      group.jobs.map((job) => ({
        cardId: group.primary.jobCardId || `LEGACY-${group.primary.id}`,
        date: job.date,
        customer: getCustomer(job.customerId)?.name || 'Unknown',
        workType: job.workTypeName,
        quantity: job.quantity,
        amount: getJobNetValue(job),
        commission: job.commissionAmount || 0,
        paid: getJobPaidAmount(job),
        dcNo: job.dcNo || '-',
        dcDate: job.dcDate || '-',
      }))
    );
  }, [groupedJobs, getCustomer]);

  const handleExportExcel = () => {
    const lines = [
      'Card ID,Date,Customer,Work Type,Quantity,Amount,Commission,Paid,DC No,DC Date',
      ...reportRows.map((row) =>
        [
          row.cardId,
          row.date,
          row.customer,
          row.workType,
          row.quantity,
          row.amount,
          row.commission,
          row.paid,
          row.dcNo,
          row.dcDate,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];

    downloadTextFile(`slw-report-${today}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
  };

  const handleExportPdf = () => {
    const reportHtml = `
      <html>
      <head><title>SLW Report</title></head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h2>SLW Report</h2>
        <p>Period: ${range.label}</p>
        <p>Total Job Cards: ${summary.totalCards}</p>
        <p>Our Income: ${formatCurrency(summary.ourIncome)}</p>
        <p>Net Income: ${formatCurrency(summary.netIncome)}</p>
        <p>Commission: ${formatCurrency(summary.totalCommission)}</p>
        <p>Total Paid: ${formatCurrency(summary.totalPaid)}</p>
        <p>Pending: ${formatCurrency(summary.ourIncome - summary.totalPaid)}</p>
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; margin-top: 16px;">
          <thead>
            <tr>
              <th>Card ID</th><th>Date</th><th>Customer</th><th>Work Type</th><th>Qty</th><th>Amount</th><th>Commission</th><th>Paid</th><th>DC No</th><th>DC Date</th>
            </tr>
          </thead>
          <tbody>
            ${reportRows
              .map(
                (row) =>
                  `<tr><td>${row.cardId}</td><td>${row.date}</td><td>${row.customer}</td><td>${row.workType}</td><td>${row.quantity}</td><td>${row.amount}</td><td>${row.commission}</td><td>${row.paid}</td><td>${row.dcNo}</td><td>${row.dcDate}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(reportHtml);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleExportWhatsApp = () => {
    const text = [
      `SLW Report (${range.label})`,
      `Job Cards: ${summary.totalCards}`,
      `Our Income: ${formatCurrency(summary.ourIncome)}`,
      `Net Income: ${formatCurrency(summary.netIncome)}`,
      `Total Paid: ${formatCurrency(summary.totalPaid)}`,
      `Pending: ${formatCurrency(summary.ourIncome - summary.totalPaid)}`,
      `Commission: ${formatCurrency(summary.totalCommission)}`,
    ].join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="customers-screen">
      <div className="screen-header">
        <h2 className="screen-title">Reports</h2>
        <div className="screen-controls">
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
            <SearchableSelect
              items={[{ id: 0, name: 'All Clients' }, ...customers]}
              value={
                selectedCustomerId === null
                  ? { id: 0, name: 'All Clients' }
                  : customers.find((c) => c.id === selectedCustomerId) || {
                      id: 0,
                      name: 'All Clients',
                    }
              }
              onChange={(item) => setSelectedCustomerId(item.id === 0 ? null : item.id)}
              getLabel={(item) => item.name}
              getKey={(item) => String(item.id)}
              placeholder="Select customer..."
            />
          </div>
        </div>
      </div>

      <div className="screen-content">
        <div className="report-actions">
          <button type="button" className="btn btn-secondary" onClick={handleExportPdf}>
            Export PDF
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExportExcel}>
            Export Excel
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExportWhatsApp}>
            Share WhatsApp
          </button>
        </div>

        <div className="reports-summary">
          <div className="summary-card">
            <h3 className="summary-card-label">Total Job Cards</h3>
            <p className="summary-card-value">{summary.totalCards}</p>
          </div>
          <div className="summary-card">
            <h3 className="summary-card-label">Our Income</h3>
            <p className="summary-card-value">{formatCurrency(summary.ourIncome)}</p>
          </div>
          <div className="summary-card">
            <h3 className="summary-card-label">Net Income</h3>
            <p className="summary-card-value">{formatCurrency(summary.netIncome)}</p>
          </div>
          <div className="summary-card">
            <h3 className="summary-card-label">Total Paid</h3>
            <p className="summary-card-value">{formatCurrency(summary.totalPaid)}</p>
          </div>
          <div className="summary-card">
            <h3 className="summary-card-label">Pending</h3>
            <p className="summary-card-value">
              {formatCurrency(summary.ourIncome - summary.totalPaid)}
            </p>
          </div>
          <div className="summary-card">
            <h3 className="summary-card-label">Commission</h3>
            <p className="summary-card-value">{formatCurrency(summary.totalCommission)}</p>
          </div>
        </div>

        <div className="reports-details">
          <h3 className="details-title">Job Cards</h3>
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
                      <span className="footer-label">Net</span>
                      <span className="footer-value">{formatCurrency(payment.net)}</span>
                      <span className="footer-label">Paid</span>
                      <span className="footer-value">{formatCurrency(payment.paid)}</span>
                      <span className="footer-label">Pending</span>
                      <span className="footer-value">{formatCurrency(payment.pending)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">No jobs found for the selected filters</div>
            )}
          </div>
        </div>
      </div>

      <JobCardDetailsModal
        isOpen={Boolean(selectedGroup)}
        jobs={selectedGroup?.jobs || null}
        onClose={() => setSelectedCardKey(null)}
        getCustomer={getCustomer}
        onEdit={undefined}
        onDelete={undefined}
      />
    </div>
  );
}
