// ===== JOB HISTORY =====
function refreshJobHistory() {
  const jobs = getJobs();
  const customers = getCustomers();

  // Populate customer filter
  const customerFilter = document.getElementById('historyCustomer');
  customerFilter.innerHTML =
    '<option value="">All Customers</option>' +
    customers
      .map(
        (c) =>
          `<option value="${c.id}">${c.name}${c.isActive === false ? ' (Inactive)' : ''}</option>`
      )
      .join('');

  // Set default dates (last 30 days) only if inputs are empty
  const fromDateInput = document.getElementById('historyFromDate');
  const toDateInput = document.getElementById('historyToDate');
  const fromMonthInput = document.getElementById('historyFromMonth');
  const toMonthInput = document.getElementById('historyToMonth');

  if (!fromDateInput.value && !toDateInput.value) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    fromDateInput.value = getLocalDateString(thirtyDaysAgo);
    toDateInput.value = getLocalDateString(today);
  }

  // Set max constraints
  const today = getLocalDateString();
  const currentMonth = getMonthInputString();
  fromDateInput.max = today;
  toDateInput.max = today;
  if (fromMonthInput) {
fromMonthInput.max = currentMonth;
}
  if (toMonthInput) {
toMonthInput.max = currentMonth;
}

  renderJobHistory(jobs);
}

function renderJobHistory(jobs) {
  const fromDate = document.getElementById('historyFromDate').value;
  const toDate = document.getElementById('historyToDate').value;
  const customerId = document.getElementById('historyCustomer').value;

  let filtered = jobs;

  if (fromDate) {
    filtered = filtered.filter((j) => j.date >= fromDate);
  }
  if (toDate) {
    filtered = filtered.filter((j) => j.date <= toDate);
  }
  if (customerId) {
    filtered = filtered.filter((j) => j.customerId === parseInt(customerId));
  }

  filtered = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('jobHistoryTable');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
          No jobs found for the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (j) => `
    <tr>
      <td class="amount">#${j.id}</td>
      <td>${formatDate(j.date)}</td>
      <td><strong>${j.customerName}</strong></td>
      <td><span class="spot-badge">${getJobWorkMode(j)}</span></td>
      <td>${getJobWorkName(j)}</td>
      <td style="text-align: center;">${j.quantity}</td>
      <td style="text-align: right;" class="amount">${formatCurrency(j.amount)}</td>
      <td style="text-align: right;" class="amount positive">${formatCurrency(getJobNetValue(j))}</td>
      <td>
        <span class="badge ${getJobPaymentStatus(j) === 'Paid' ? 'badge-green' : 'badge-red'}">${getJobPaymentStatus(j)}</span>
        <div class="table-subtext">${getJobPaymentMode(j)}</div>
      </td>
      <td>
        <div>${j.dcNo || '-'}</div>
        <div class="table-subtext">${j.vehicleNo || '-'}</div>
        <div class="table-subtext">${j.dcDate ? formatDate(j.dcDate) : '-'}</div>
      </td>
    </tr>
  `
    )
    .join('');
}
