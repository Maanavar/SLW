// ===== DASHBOARD =====
function calculateCustomerBalance(customerId) {
  const jobs = getJobs().filter((j) => j.customerId === customerId);
  const payments = getPayments().filter((p) => p.customerId === customerId);

  const totalNet = jobs.reduce((sum, j) => sum + getJobNetValue(j), 0);
  const totalPaidFromJobs = jobs.reduce((sum, j) => sum + getJobPaidAmount(j), 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return totalNet - totalPaidFromJobs - totalPaid;
}

function calculateMonthlyBalances(customerId) {
  const jobs = getJobs().filter((j) => j.customerId === customerId);
  const payments = getPayments().filter((p) => p.customerId === customerId);

  const monthMap = {};

  // Group jobs by month
  jobs.forEach((job) => {
    const monthKey = job.date.substring(0, 7); // YYYY-MM
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        monthKey,
        monthLabel: formatDate(monthKey + '-01').substring(0, 7), // Just month-year
        totalNet: 0,
        paidFromJobs: 0,
        paidFromPayments: 0,
        balance: 0,
        jobs: [],
      };
    }
    monthMap[monthKey].totalNet += getJobNetValue(job);
    monthMap[monthKey].paidFromJobs += getJobPaidAmount(job);
    monthMap[monthKey].jobs.push(job);
  });

  // Add payments to their respective months
  payments.forEach((payment) => {
    let targetMonth = '';
    if (payment.paymentForMonth) {
      targetMonth = payment.paymentForMonth;
    } else if (payment.paymentForDate) {
      targetMonth = payment.paymentForDate.substring(0, 7);
    } else if (payment.paymentForFromDate) {
      targetMonth = payment.paymentForFromDate.substring(0, 7);
    } else if (payment.date) {
      targetMonth = payment.date.substring(0, 7);
    }

    if (targetMonth && monthMap[targetMonth]) {
      monthMap[targetMonth].paidFromPayments += payment.amount;
    }
  });

  // Calculate balance for each month
  Object.values(monthMap).forEach((month) => {
    month.balance = month.totalNet - month.paidFromJobs - month.paidFromPayments;
  });

  // Sort descending by month
  return Object.values(monthMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

function refreshDashboard() {
  const jobs = getJobs();
  const payments = getPayments();
  const customers = getActiveCustomers();

  const today = getLocalDateString();
  const weekStart = getWeekStartDate();
  const monthStart = getMonthStartDate();

  function summarizePeriod(startDate, endDate) {
    const periodJobs = getJobsInRange(jobs, startDate, endDate);
    const periodPayments = getPaymentsInRange(payments, startDate, endDate);
    const summary = getJobSummary(periodJobs);
    const paymentTotal = periodPayments.reduce((sum, payment) => sum + payment.amount, 0);
    summary.received += paymentTotal;
    summary.pending = summary.net - summary.received;
    return summary;
  }

  const dailySummary = summarizePeriod(today, today);
  const weeklySummary = summarizePeriod(weekStart, today);
  const monthlySummary = summarizePeriod(monthStart, today);
  const totalSummary = getJobSummary(jobs);
  totalSummary.received += payments.reduce((sum, p) => sum + p.amount, 0);
  totalSummary.pending = totalSummary.net - totalSummary.received;

  document.getElementById('dailyNet').textContent = formatCurrency(dailySummary.net);
  document.getElementById('dailyMeta').textContent =
    `${dailySummary.jobs} jobs · Received ${formatCurrency(dailySummary.received)} · Pending ${formatCurrency(dailySummary.pending)}`;
  document.getElementById('weeklyNet').textContent = formatCurrency(weeklySummary.net);
  document.getElementById('weeklyMeta').textContent =
    `${weeklySummary.jobs} jobs · Received ${formatCurrency(weeklySummary.received)} · Pending ${formatCurrency(weeklySummary.pending)}`;
  document.getElementById('monthlyNet').textContent = formatCurrency(monthlySummary.net);
  document.getElementById('monthlyMeta').textContent =
    `${monthlySummary.jobs} jobs · Received ${formatCurrency(monthlySummary.received)} · Pending ${formatCurrency(monthlySummary.pending)}`;

  document.getElementById('dashTotalBilled').textContent = formatCurrency(totalSummary.billed);
  document.getElementById('dashTotalCommission').textContent = formatCurrency(
    totalSummary.commission
  );
  document.getElementById('dashNetEarned').textContent = formatCurrency(totalSummary.net);
  document.getElementById('dashTotalReceived').textContent = formatCurrency(totalSummary.received);
  document.getElementById('dashTotalPending').textContent = formatCurrency(totalSummary.pending);
  document.getElementById('dashJobCount').textContent = `${monthlySummary.jobs} jobs this month`;

  updateTypeBalanceSummary(customers, jobs, payments);

  // Update customer table
  refreshCustomerBalances(customers, jobs, payments);
}

function updateTypeBalanceSummary(customers, jobs, payments) {
  const typeConfigs = [
    { type: 'Monthly', valueId: 'typePendingMonthly', metaId: 'typePendingMonthlyMeta' },
    { type: 'Invoice', valueId: 'typePendingInvoice', metaId: 'typePendingInvoiceMeta' },
    {
      type: 'Party-Credit',
      valueId: 'typePendingPartyCredit',
      metaId: 'typePendingPartyCreditMeta',
    },
  ];

  typeConfigs.forEach(({ type, valueId, metaId }) => {
    const activeCustomers = customers.filter((customer) => customer.type === type);
    const customerIds = new Set(activeCustomers.map((customer) => customer.id));
    const typeJobs = jobs.filter((job) => customerIds.has(job.customerId));
    const typePayments = payments.filter((payment) => customerIds.has(payment.customerId));

    const billed = typeJobs.reduce((sum, job) => sum + (Number(job.amount) || 0), 0);
    const net = typeJobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
    const paidFromJobs = typeJobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
    const paidFromPayments = typePayments.reduce((sum, payment) => sum + payment.amount, 0);
    const pending = net - paidFromJobs - paidFromPayments;

    const valueEl = document.getElementById(valueId);
    const metaEl = document.getElementById(metaId);
    if (valueEl) {
      valueEl.textContent = formatCurrency(Math.max(0, pending));
    }
    if (metaEl) {
      metaEl.textContent = `${activeCustomers.length} active customers · ${typeJobs.length} jobs · ${formatCurrency(billed)} billed · ${formatCurrency(net)} net`;
    }
  });
}

function refreshCustomerBalances(customers, jobs, payments) {
  const filterType = document.getElementById('dashFilterType').value;

  // Calculate per-customer data
  const customerData = customers
    .filter((c) => c.type !== 'Cash')
    .filter((c) => filterType === 'all' || c.type === filterType)
    .map((customer) => {
      const custJobs = jobs.filter((j) => j.customerId === customer.id);
      const custPayments = payments.filter((p) => p.customerId === customer.id);

      const billed = custJobs.reduce((sum, j) => sum + (Number(j.amount) || 0), 0);
      const commission = custJobs.reduce((sum, j) => sum + (Number(j.commissionAmount) || 0), 0);
      const net = custJobs.reduce((sum, j) => sum + getJobNetValue(j), 0);
      const paidFromJobs = custJobs.reduce((sum, j) => sum + getJobPaidAmount(j), 0);
      const paid = paidFromJobs + custPayments.reduce((sum, p) => sum + p.amount, 0);
      const pending = net - paid;

      return {
        ...customer,
        billed,
        commission,
        net,
        paid,
        pending,
      };
    })
    .filter((c) => c.billed > 0 || c.paid > 0) // Only show customers with activity
    .sort((a, b) => b.pending - a.pending); // Sort by pending descending

  const tbody = document.getElementById('customerBalancesTable');

  if (customerData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
          No customer data yet. Start entering jobs to see balances here.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = customerData
    .map((c) => {
      const typeClass = `type-${c.type.toLowerCase().replace('-', '')}`;
      let status = 'CLEAR';
      let statusClass = 'badge-green';

      if (c.pending > 0) {
        status = 'PENDING';
        statusClass = 'badge-red';
      } else if (c.pending < 0) {
        status = 'CREDIT';
        statusClass = 'badge-blue';
      }

      // Commission paid status - assuming commissions are paid as part of job payment
      const commissionPaid = c.commission > 0 ? (c.paid >= c.net ? 'Paid' : 'Pending') : 'N/A';
      const commissionPaidClass =
        commissionPaid === 'Paid'
          ? 'badge-green'
          : commissionPaid === 'Pending'
            ? 'badge-orange'
            : 'badge-blue';

      return `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td><span class="type-badge ${typeClass}">${c.type}</span></td>
        <td style="text-align: right;" class="amount">${formatCurrency(c.billed)}</td>
        <td style="text-align: right;" class="amount">${formatCurrency(c.commission)}</td>
        <td style="text-align: center;"><span class="badge ${commissionPaidClass}">${commissionPaid}</span></td>
        <td style="text-align: right;" class="amount positive">${formatCurrency(c.net)}</td>
        <td style="text-align: right;" class="amount">${formatCurrency(c.paid)}</td>
        <td style="text-align: right;" class="amount ${c.pending > 0 ? 'negative' : 'positive'}">${formatCurrency(c.pending)}</td>
        <td><span class="badge ${statusClass}">${status}</span></td>
      </tr>
    `;
    })
    .join('');
}

function updatePendingBadge() {
  const jobs = getJobs();
  const payments = getPayments();

  const totalNet = jobs.reduce((sum, j) => sum + getJobNetValue(j), 0);
  const totalPaid =
    jobs.reduce((sum, j) => sum + getJobPaidAmount(j), 0) +
    payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPending = totalNet - totalPaid;

  document.getElementById('pending-badge').textContent = formatCurrency(totalPending);
}
