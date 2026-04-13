// ===== UI HELPERS =====
function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function formatDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function showToast(title, message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="${type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}" stroke-width="2">
      ${
        type === 'success'
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
          : '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/>'
      }
    </svg>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===== UTILITY FUNCTIONS =====
function getQuarterStartDate(date = new Date()) {
  const quarter = Math.floor(date.getMonth() / 3);
  return getLocalDateString(new Date(date.getFullYear(), quarter * 3, 1));
}

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
    to: getLocalDateString(today),
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
  if (!select) {
return;
}

  const customers = getActiveCustomers();
  select.innerHTML =
    '<option value="">All Clients</option>' +
    customers.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
}

function getFilteredReportGroups() {
  const period = document.getElementById('reportPeriod').value;
  const reportMode = document.getElementById('reportMode').value;
  const reportCustomer = document.getElementById('reportCustomer').value
    ? getCustomers().find(
        (c) => c.id === parseInt(document.getElementById('reportCustomer').value, 10)
      )
    : null;

  const range =
    period === 'custom'
      ? {
          from: document.getElementById('reportFromDate').value,
          to: document.getElementById('reportToDate').value,
        }
      : getReportRange(period);

  let jobs = getJobsInRange(getJobs(), range.from, range.to);

  if (reportCustomer) {
    jobs = jobs.filter((j) => j.customerId === reportCustomer.id);
  }

  const groups = groupJobsByCard(jobs);

  return { groups, fromDate: range.from, toDate: range.to, period, reportMode, reportCustomer };
}

function getJobDcStatus(job) {
  const customer = getCustomers().find((c) => c.id === job.customerId);
  if (!customer || !customer.requiresDc) {
return 'Not Required';
}

  const hasDcDetails = job.dcNo || job.vehicleNo || job.dcDate;
  if (hasDcDetails) {
return 'Completed';
}
  if (job.dcApproval === false) {
return 'Approved without DC';
}
  return 'Pending DC';
}

function customerNeedsDc(customer) {
  return customer && customer.requiresDc;
}
