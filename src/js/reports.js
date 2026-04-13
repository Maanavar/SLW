// ===== REPORTS =====
function getReportRange(period) {
  const today = new Date();
  if (period === 'today') {
    const day = getLocalDateString(today);
    return { from: day, to: day };
  }
  if (period === 'week') {
    return { from: getWeekStartDate(today), to: getLocalDateString(today) };
  }
  if (period === 'month') {
    return { from: getMonthStartDate(today), to: getLocalDateString(today) };
  }
  if (period === 'quarter') {
    return { from: getQuarterStartDate(today), to: getLocalDateString(today) };
  }
  if (period === 'halfyear') {
    return { from: getHalfYearStartDate(today), to: getLocalDateString(today) };
  }
  if (period === 'year') {
    return { from: getYearStartDate(today), to: getLocalDateString(today) };
  }
  return {
    from: getMonthStartDate(today),
    to: getLocalDateString(today)
  };
}

function setReportPeriod(period) {
  const range = getReportRange(period);
  document.getElementById('reportPeriod').value = period;
  document.getElementById('reportFromDate').value = range.from;
  document.getElementById('reportToDate').value = range.to;
}

function populateReportCustomers() {
  const select = document.getElementById('reportCustomer');
  if (!select) return;

  const customers = getCustomers();
  select.innerHTML = '<option value="">All Clients</option>' +
    customers.map(customer => `<option value="${customer.id}">${customer.name}${customer.isActive === false ? ' (Inactive)' : ''}</option>`).join('');
}

function updateReportModeState() {
  const mode = document.getElementById('reportMode').value;
  const customerSelect = document.getElementById('reportCustomer');
  if (!customerSelect) return;
  customerSelect.disabled = mode !== 'client';
  customerSelect.style.opacity = mode === 'client' ? '1' : '0.6';
}

function getReportCustomer() {
  const customerId = document.getElementById('reportCustomer').value;
  if (!customerId) return null;
  return getCustomers().find(customer => customer.id === parseInt(customerId, 10)) || null;
}

function getFilteredReportGroups() {
  const period = document.getElementById('reportPeriod').value;
  const fromDateInput = document.getElementById('reportFromDate').value;
  const toDateInput = document.getElementById('reportToDate').value;
  const reportMode = document.getElementById('reportMode').value;
  const reportCustomer = getReportCustomer();
  const fallbackRange = getReportRange(period);
  const fromDate = fromDateInput || fallbackRange.from;
  const toDate = toDateInput || fallbackRange.to;
  let filteredJobs = getJobs().filter(job => isDateInRange(job.date, fromDate, toDate));

  if (reportMode === 'client' && reportCustomer) {
    filteredJobs = filteredJobs.filter(job => job.customerId === reportCustomer.id);
  }

  const groups = groupJobsByCard(filteredJobs);
  return { groups, fromDate, toDate, period, reportMode, reportCustomer };
}

function refreshJobReports() {
  const summaryGrid = document.getElementById('reportSummaryGrid');
  const tableBody = document.getElementById('reportTableBody');
  if (!summaryGrid || !tableBody) return;

  const { groups, fromDate, toDate, period, reportMode, reportCustomer } = getFilteredReportGroups();
  const jobs = groups.flatMap(group => group.jobs);
  const totalAmount = groups.reduce((sum, group) => sum + group.totalAmount, 0);
  const totalNet = groups.reduce((sum, group) => sum + group.totalNet, 0);
  const totalCommission = groups.reduce((sum, group) => sum + group.totalCommission, 0);
  const paid = jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
  const pending = totalNet - paid;
  const clientLabel = reportMode === 'client'
    ? (reportCustomer ? reportCustomer.name : 'Select client')
    : 'All Clients';

  summaryGrid.innerHTML = `
    <div class="report-summary-card">
      <span class="report-summary-label">Period</span>
      <strong class="report-summary-value">${period.toUpperCase()}</strong>
      <span class="report-summary-meta">${formatDate(fromDate)} to ${formatDate(toDate)}</span>
    </div>
    <div class="report-summary-card">
      <span class="report-summary-label">Scope</span>
      <strong class="report-summary-value">${clientLabel}</strong>
      <span class="report-summary-meta">${reportMode === 'client' ? 'Client-wise report' : 'All jobcards'}</span>
    </div>
    <div class="report-summary-card">
      <span class="report-summary-label">Jobcards</span>
      <strong class="report-summary-value">${groups.length}</strong>
      <span class="report-summary-meta">${jobs.length} job lines</span>
    </div>
    <div class="report-summary-card">
      <span class="report-summary-label">Billed</span>
      <strong class="report-summary-value">${formatCurrency(totalAmount)}</strong>
      <span class="report-summary-meta">Commission ${formatCurrency(totalCommission)}</span>
    </div>
    <div class="report-summary-card">
      <span class="report-summary-label">Net / Pending</span>
      <strong class="report-summary-value">${formatCurrency(totalNet)}</strong>
      <span class="report-summary-meta">Pending ${formatCurrency(pending)}</span>
    </div>
  `;

  if (reportMode === 'client' && !reportCustomer) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding: var(--space-xl); color: var(--text-muted);">Select a client to generate the report.</td>
      </tr>
    `;
    return;
  }

  if (groups.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding: var(--space-xl); color: var(--text-muted);">No jobcards found for this range.</td>
      </tr>
    `;
    return;
  }

  const sortedGroups = groups.sort((a, b) => new Date(b.primary.date) - new Date(a.primary.date));
  tableBody.innerHTML = sortedGroups.map(group => {
    const job = group.primary;
    const dcStatus = getJobDcStatus(job);
    const lineNames = group.jobs.map(line => line.workTypeName || line.workName || 'Job').join(', ');
    const payment = `${getJobPaymentStatus(job)}${getJobPaidAmount(job) > 0 ? ` / ${getJobPaymentMode(job)}` : ''}`;
    const groupKey = `group-${group.key}`.replace(/[^a-z0-9\-]/gi, '_');

    const mainRow = `
      <tr class="report-main-row" data-group-key="${groupKey}">
        <td><strong>${job.jobCardId || group.key}</strong></td>
        <td>${formatDate(job.date)}</td>
        <td>${job.customerName}</td>
        <td style="text-align:center;">${group.lineCount}</td>
        <td>
          <button type="button" class="btn btn-text btn-small expand-group-btn" data-group-key="${groupKey}" title="Expand/collapse job details" style="padding: 2px 0; margin-right: 4px; font-weight: 600;">▸</button>
          ${lineNames}
        </td>
        <td style="text-align:right;" class="amount">${formatCurrency(group.totalAmount)}</td>
        <td style="text-align:right;" class="amount positive">${formatCurrency(group.totalNet)}</td>
        <td>${payment}</td>
        <td><span class="badge ${dcStatus === 'Completed' ? 'badge-green' : dcStatus === 'Pending DC' ? 'badge-orange' : 'badge-blue'}">${dcStatus}</span></td>
      </tr>
    `;

    const subRows = group.jobs.map((line, idx) => {
      const lineCommission = line.commissionInput > 0
        ? (line.commissionInput > 1 ? line.commissionInput : Math.round(line.amount * line.commissionInput))
        : 0;
      const lineNet = Math.max(0, line.amount - lineCommission);

      return `
        <tr class="report-sub-row" data-group-key="${groupKey}" style="display: none; background: var(--bg-tertiary);">
          <td style="color: var(--text-muted); font-size: 12px;">└─ Line ${idx + 1}</td>
          <td colspan="2">${line.workTypeName || line.workName || 'Job'}</td>
          <td style="text-align: center; font-size: 13px;">${line.quantity}</td>
          <td style="text-align: right;" class="amount" title="Qty × Rate">${formatCurrency(line.amount)}</td>
          <td style="text-align: right;" class="amount" title="Commission"><span style="font-size: 12px;">${formatCurrency(lineCommission)}</span></td>
          <td style="text-align: right;" class="amount positive">${formatCurrency(lineNet)}</td>
          <td colspan="2"></td>
        </tr>
      `;
    }).join('');

    return mainRow + subRows;
  }).join('');

  // Wire up expand buttons
  tableBody.querySelectorAll('.expand-group-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const groupKey = btn.dataset.groupKey;
      const subRows = tableBody.querySelectorAll(`.report-sub-row[data-group-key="${groupKey}"]`);
      const isExpanded = subRows[0]?.style.display !== 'none';

      subRows.forEach(row => {
        row.style.display = isExpanded ? 'none' : 'table-row';
      });

      btn.textContent = isExpanded ? '▸' : '▾';
    });
  });
}

function exportJobReportsAsExcel() {
  const { groups, fromDate, toDate, period, reportMode, reportCustomer } = getFilteredReportGroups();
  if (reportMode === 'client' && !reportCustomer) {
    showToast('Report', 'Select a client first', 'error');
    return;
  }
  const rows = [
    ['Jobcard', 'Date', 'Customer', 'Lines', 'Jobs', 'Amount', 'Net', 'Payment', 'DC Status']
  ];

  groups.forEach(group => {
    const job = group.primary;
    rows.push([
      job.jobCardId || group.key,
      job.date,
      job.customerName,
      String(group.lineCount),
      group.jobs.map(line => line.workTypeName || line.workName || 'Job').join(' | '),
      String(group.totalAmount),
      String(group.totalNet),
      `${getJobPaymentStatus(job)}${getJobPaidAmount(job) > 0 ? ` / ${getJobPaymentMode(job)}` : ''}`,
      getJobDcStatus(job)
    ]);
  });

  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join('\t')).join('\n');
  const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const clientSlug = reportCustomer ? reportCustomer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'all-clients';
  link.download = `job-report-${period}-${clientSlug}-${fromDate}-to-${toDate}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportJobReportsAsPdf() {
  switchScreen('reports');
  setTimeout(() => window.print(), 150);
}

function shareJobReportsToWhatsApp() {
  const { groups, fromDate, toDate, period, reportMode, reportCustomer } = getFilteredReportGroups();
  if (reportMode === 'client' && !reportCustomer) {
    showToast('Report', 'Select a client first', 'error');
    return;
  }
  const totalAmount = groups.reduce((sum, group) => sum + group.totalAmount, 0);
  const totalNet = groups.reduce((sum, group) => sum + group.totalNet, 0);
  const message = [
    `Siva Lathe Works Job Report`,
    `Period: ${period.toUpperCase()} (${fromDate} to ${toDate})`,
    `Scope: ${reportMode === 'client' && reportCustomer ? reportCustomer.name : 'All Clients'}`,
    `Jobcards: ${groups.length}`,
    `Billed: ${formatCurrency(totalAmount)}`,
    `Net: ${formatCurrency(totalNet)}`
  ].join('\n');
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function clearAllJobCards() {
  const confirmed = window.confirm('Clear all saved job cards? This will remove every job entry but keep customers, work types, and payments.');
  if (!confirmed) return;

  localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify([]));
  refreshTodaysJobs();
  refreshJobHistory();
  refreshDashboard();
  refreshJobReports();
  updateTodayStats();
  updatePendingBadge();
  showToast('Jobs Cleared', 'All saved job cards have been removed');
}

function refreshPaymentReport() {
  const summaryGrid = document.getElementById('paymentSummaryGrid');
  const tableBody = document.getElementById('paymentReportTable');
  const customerSelect = document.getElementById('paymentReportCustomer');
  if (!summaryGrid || !tableBody || !customerSelect) return;

  const customers = getCustomers();
  customerSelect.innerHTML = '<option value="">All Customers</option>' +
    customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  const fromDate = document.getElementById('paymentReportFromDate').value || getLocalDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const toDate = document.getElementById('paymentReportToDate').value || getLocalDateString();
  const customerId = customerSelect.value;

  let payments = getPayments().filter(p => p.date >= fromDate && p.date <= toDate);
  if (customerId) {
    payments = payments.filter(p => p.customerId === parseInt(customerId, 10));
  }

  payments = payments.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Calculate summary
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const byMode = {};
  payments.forEach(p => {
    byMode[p.paymentMode] = (byMode[p.paymentMode] || 0) + p.amount;
  });

  summaryGrid.innerHTML = `
    <div class="report-summary-card">
      <span class="report-summary-label">Total Collected</span>
      <strong class="report-summary-value">${formatCurrency(totalAmount)}</strong>
      <span class="report-summary-meta">${payments.length} payments</span>
    </div>
    ${Object.entries(byMode).map(([mode, amount]) => `
      <div class="report-summary-card">
        <span class="report-summary-label">${mode}</span>
        <strong class="report-summary-value">${formatCurrency(amount)}</strong>
        <span class="report-summary-meta">${mode}</span>
      </div>
    `).join('')}
  `;

  if (payments.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
          No payments found for the selected period.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = payments.map(payment => {
    const coverageLabel = payment.paymentCoverageType === 'single'
      ? `${formatDate(payment.paymentForDate)}`
      : payment.paymentCoverageType === 'range'
        ? `${formatDate(payment.paymentForFromDate)} to ${formatDate(payment.paymentForToDate)}`
        : payment.paymentCoverageType === 'month'
          ? payment.paymentForMonth
          : '-';

    return `
      <tr>
        <td>${formatDate(payment.date)}</td>
        <td><strong>${payment.customerName}</strong></td>
        <td style="text-align: right;" class="amount">${formatCurrency(payment.amount)}</td>
        <td>${payment.paymentMode}</td>
        <td>${coverageLabel}</td>
        <td>${payment.notes || '-'}</td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-secondary btn-small" data-delete-payment="${payment.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  tableBody.querySelectorAll('[data-delete-payment]').forEach(btn => {
    btn.addEventListener('click', () => {
      const paymentId = parseInt(btn.dataset.deletePayment, 10);
      deletePayment(paymentId);
    });
  });
}

function deletePayment(paymentId) {
  const confirmed = window.confirm('Delete this payment record?');
  if (!confirmed) return;

  const payments = getPayments().filter(p => p.id !== paymentId);
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  refreshPaymentReport();
  updatePendingBadge();
  refreshDashboard();
  showToast('Payment Deleted', 'Payment record has been removed');
}

function refreshRecentPayments() {
  const container = document.getElementById('recentPaymentsList');
  if (!container) return;

  const payments = getPayments().slice(-10).reverse(); // Last 10 payments, newest first

  if (payments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <path d="M2 10h20"/>
        </svg>
        <h3>No payments recorded</h3>
        <p>Payments you record will appear here</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="data-table-wrapper">
      <table class="data-table" style="margin: 0;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Mode</th>
            <th>Coverage</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(payment => {
            const coverageLabel = payment.paymentCoverageType === 'single' ? formatDate(payment.paymentForDate)
              : payment.paymentCoverageType === 'range' ? `${formatDate(payment.paymentForFromDate)} to ${formatDate(payment.paymentForToDate)}`
              : payment.paymentCoverageType === 'month' ? payment.paymentForMonth
              : '-';

            return `
              <tr>
                <td>${formatDate(payment.date)}</td>
                <td><strong>${payment.customerName}</strong></td>
                <td style="text-align: right;" class="amount">${formatCurrency(payment.amount)}</td>
                <td>${payment.paymentMode}</td>
                <td>${coverageLabel}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}