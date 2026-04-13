// ===== PAYMENT ENTRY =====
let paymentSelectedCustomer = null;

function updatePaymentCoverageFields() {
  const coverageType = document.getElementById('paymentCoverageType');
  const fields = document.querySelectorAll('.payment-coverage-group');
  if (!coverageType) {
return;
}

  fields.forEach((field) => {
    field.classList.toggle('visible', field.dataset.coverage === coverageType.value);
  });

  // Update month-wise balance display when coverage type changes
  if (paymentSelectedCustomer && coverageType.value === 'month') {
    const monthInput = document.getElementById('paymentForMonth');
    const selectedMonth = monthInput?.value;
    if (selectedMonth) {
      const monthlyBalances = calculateMonthlyBalances(paymentSelectedCustomer.id);
      const selectedMonthData = monthlyBalances.find((m) => m.monthKey === selectedMonth);
      updateMonthBalanceForPayment(selectedMonthData);
    }
  } else {
    document.getElementById('markMonthPaidField').style.display = 'none';
    document.getElementById('markMonthAsPaid').checked = false;
  }
}

function updateMonthBalanceForPayment(monthData) {
  const markMonthField = document.getElementById('markMonthPaidField');
  if (!monthData) {
    if (markMonthField) {
markMonthField.style.display = 'none';
}
    return;
  }

  const balance = monthData.balance;
  if (markMonthField) {
    if (balance > 0) {
      markMonthField.style.display = 'block';
    } else {
      markMonthField.style.display = 'none';
      document.getElementById('markMonthAsPaid').checked = false;
    }
  }
}

function updateMonthBalanceDisplay(customerId) {
  if (!customerId) {
    document.getElementById('monthBalanceSection').style.display = 'none';
    return;
  }

  const monthlyBalances = calculateMonthlyBalances(customerId);
  const section = document.getElementById('monthBalanceSection');
  const table = document.getElementById('monthBalanceTable');

  if (!table) {
return;
}

  if (monthlyBalances.length === 0) {
    table.innerHTML =
      '<div style="color: var(--text-muted);">No transactions for this customer yet.</div>';
    section.style.display = 'block';
    return;
  }

  section.style.display = 'block';
  table.innerHTML = `
    <div style="display: grid; grid-template-columns: 120px 1fr 1fr 1fr; gap: var(--space-sm); font-weight: 600; margin-bottom: var(--space-md); padding-bottom: var(--space-sm); border-bottom: 1px solid var(--border-light);">
      <div>Month</div>
      <div style="text-align: right;">Billed</div>
      <div style="text-align: right;">Paid</div>
      <div style="text-align: right;">Balance</div>
    </div>
    ${monthlyBalances
      .map(
        (month) => `
      <div style="display: grid; grid-template-columns: 120px 1fr 1fr 1fr; gap: var(--space-sm); padding: 8px 0; border-bottom: 1px solid var(--border-light);">
        <div>${month.monthLabel}</div>
        <div style="text-align: right; color: var(--text-secondary);">${formatCurrency(month.totalNet)}</div>
        <div style="text-align: right; color: var(--text-secondary);">${formatCurrency(month.paidFromJobs + month.paidFromPayments)}</div>
        <div style="text-align: right; font-weight: 600; color: ${month.balance > 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">${formatCurrency(month.balance)}</div>
      </div>
    `
      )
      .join('')}
  `;

  // Show mark-as-paid option if coverage is month type
  if (document.getElementById('paymentCoverageType').value === 'month') {
    const monthInput = document.getElementById('paymentForMonth');
    const selectedMonth = monthInput?.value;
    if (selectedMonth) {
      const selectedMonthData = monthlyBalances.find((m) => m.monthKey === selectedMonth);
      updateMonthBalanceForPayment(selectedMonthData);
    }
  }
}

function initPaymentEntry() {
  const today = getLocalDateString();
  const currentMonth = getMonthInputString();
  document.getElementById('paymentDateInput').value = today;
  document.getElementById('paymentDateInput').max = today;
  document.getElementById('paymentForDate').value = today;
  document.getElementById('paymentForDate').max = today;
  document.getElementById('paymentForFromDate').value = today;
  document.getElementById('paymentForFromDate').max = today;
  document.getElementById('paymentForToDate').value = today;
  document.getElementById('paymentForToDate').max = today;
  document.getElementById('paymentForMonth').value = currentMonth;
  document.getElementById('paymentForMonth').max = currentMonth;
  updatePaymentCoverageFields();

  setupSearchableDropdown(
    'paymentCustomerSearch',
    'paymentCustomerDropdown',
    () => getActiveCustomers().filter((c) => c.type !== 'Cash'),
    (customer) => {
      paymentSelectedCustomer = customer;
      document.getElementById('paymentSelectedCustomerId').value = customer.id;

      // Show pending amount
      const balance = calculateCustomerBalance(customer.id);
      const display = document.getElementById('customerPendingDisplay');
      if (balance > 0) {
        display.innerHTML = `<span class="badge badge-red">Pending: ${formatCurrency(balance)}</span>`;
      } else if (balance < 0) {
        display.innerHTML = `<span class="badge badge-green">Credit: ${formatCurrency(Math.abs(balance))}</span>`;
      } else {
        display.innerHTML = '<span class="badge badge-green">No pending balance</span>';
      }

      // Show month-wise balance breakdown
      updateMonthBalanceDisplay(customer.id);
    },
    (customer) => {
      const balance = calculateCustomerBalance(customer.id);
      const balanceHtml =
        balance !== 0
          ? `<span class="customer-pending ${balance > 0 ? 'has-pending' : 'clear'}">${balance > 0 ? formatCurrency(balance) : 'Clear'}</span>`
          : '';
      return `
        <div class="dropdown-item" data-id="${customer.id}">
          <div>
            <div class="dropdown-item-main">${customer.name}</div>
            <div class="dropdown-item-sub">${customer.type}</div>
          </div>
          ${balanceHtml}
        </div>
      `;
    },
    (customer) => [customer.name, customer.shortCode || '', customer.type]
  );

  // Payment mode buttons
  document.querySelectorAll('.payment-mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.payment-mode').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const paymentCoverageType = document.getElementById('paymentCoverageType');
  if (paymentCoverageType) {
    paymentCoverageType.addEventListener('change', updatePaymentCoverageFields);
  }

  // Update month balance when month input changes
  const paymentForMonth = document.getElementById('paymentForMonth');
  if (paymentForMonth) {
    paymentForMonth.addEventListener('change', () => {
      if (
        paymentSelectedCustomer &&
        document.getElementById('paymentCoverageType').value === 'month'
      ) {
        const selectedMonth = paymentForMonth.value;
        const monthlyBalances = calculateMonthlyBalances(paymentSelectedCustomer.id);
        const selectedMonthData = monthlyBalances.find((m) => m.monthKey === selectedMonth);
        updateMonthBalanceForPayment(selectedMonthData);
      }
    });
  }

  // Form submission
  document.getElementById('paymentForm').addEventListener('submit', handlePaymentSubmit);

  // Initialize recent payments list
  refreshRecentPayments();
}

function handlePaymentSubmit(e) {
  e.preventDefault();

  if (!paymentSelectedCustomer) {
    showToast('Error', 'Please select a customer', 'error');
    return;
  }

  const currentCustomer = getCustomers().find(
    (customer) => customer.id === paymentSelectedCustomer.id
  );
  if (!currentCustomer || currentCustomer.isActive === false) {
    showToast('Error', 'Selected customer is inactive. Please choose an active customer.', 'error');
    return;
  }
  paymentSelectedCustomer = currentCustomer;

  const amount = parseFloat(document.getElementById('paymentAmount').value);
  if (!amount || amount <= 0) {
    showToast('Error', 'Please enter a valid amount', 'error');
    return;
  }

  const activeMode = document.querySelector('.payment-mode.active');
  const coverageType = document.getElementById('paymentCoverageType').value;
  const paymentForDate = document.getElementById('paymentForDate').value;
  const paymentForFromDate = document.getElementById('paymentForFromDate').value;
  const paymentForToDate = document.getElementById('paymentForToDate').value;
  const paymentForMonth = document.getElementById('paymentForMonth').value;

  if (coverageType === 'single' && !paymentForDate) {
    showToast('Error', 'Please select the work date for this payment', 'error');
    return;
  }
  if (coverageType === 'range' && (!paymentForFromDate || !paymentForToDate)) {
    showToast('Error', 'Please select both from and to dates', 'error');
    return;
  }
  if (coverageType === 'month' && !paymentForMonth) {
    showToast('Error', 'Please select a month for this payment', 'error');
    return;
  }

  const payment = {
    date: document.getElementById('paymentDateInput').value,
    customerId: paymentSelectedCustomer.id,
    customerName: paymentSelectedCustomer.name,
    amount: amount,
    paymentMode: activeMode ? activeMode.dataset.mode : 'Cash',
    paymentCoverageType: coverageType,
    paymentForDate: coverageType === 'single' ? paymentForDate : '',
    paymentForFromDate: coverageType === 'range' ? paymentForFromDate : '',
    paymentForToDate: coverageType === 'range' ? paymentForToDate : '',
    paymentForMonth: coverageType === 'month' ? paymentForMonth : '',
    notes: document.getElementById('paymentNotes').value || '',
  };

  const savedPayment = savePayment(payment);

  // Handle marking entire month as paid if checkbox is checked
  const markMonthAsPaid = document.getElementById('markMonthAsPaid');
  if (coverageType === 'month' && markMonthAsPaid && markMonthAsPaid.checked) {
    const jobs = getJobs().filter(
      (j) => j.customerId === paymentSelectedCustomer.id && j.date.startsWith(paymentForMonth)
    );
    if (jobs.length > 0) {
      jobs.forEach((job) => {
        job.paymentStatus = 'Paid';
        job.paidAmount = job.netAmount;
        job.paymentMode = activeMode ? activeMode.dataset.mode : 'Cash';
      });
      const allJobs = getJobs();
      // Update only the jobs that were modified
      jobs.forEach((modifiedJob) => {
        const index = allJobs.findIndex((j) => j.id === modifiedJob.id);
        if (index >= 0) {
          allJobs[index] = modifiedJob;
        }
      });
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(allJobs));
    }
  }

  const newBalance = calculateCustomerBalance(paymentSelectedCustomer.id);
  const coverageLabel =
    coverageType === 'single'
      ? `for ${formatDate(paymentForDate)}`
      : coverageType === 'range'
        ? `for ${formatDate(paymentForFromDate)} to ${formatDate(paymentForToDate)}`
        : `for ${paymentForMonth || '-'}`;
  showToast(
    'Payment Recorded',
    `${paymentSelectedCustomer.name} ${coverageLabel} — Pending: ${formatCurrency(newBalance)}`
  );

  // Reset form
  resetPaymentForm();
  updatePendingBadge();
  refreshRecentPayments();
  refreshTodaysJobs();
  refreshJobHistory();
  refreshJobReports();
  refreshDashboard();
}

function resetPaymentForm() {
  paymentSelectedCustomer = null;
  document.getElementById('paymentCustomerSearch').value = '';
  document.getElementById('paymentSelectedCustomerId').value = '';
  document.getElementById('paymentAmount').value = '';
  document.getElementById('paymentDateInput').value = getLocalDateString();
  document.getElementById('paymentForDate').value = getLocalDateString();
  document.getElementById('paymentForFromDate').value = getLocalDateString();
  document.getElementById('paymentForToDate').value = getLocalDateString();
  document.getElementById('paymentForMonth').value = getMonthInputString();
  document.getElementById('paymentCoverageType').value = 'single';
  document.getElementById('paymentNotes').value = '';
  document.getElementById('customerPendingDisplay').innerHTML = '';
  document.querySelectorAll('.payment-mode').forEach((b) => b.classList.remove('active'));
  document.querySelector('.payment-mode[data-mode="Cash"]').classList.add('active');
  updatePaymentCoverageFields();
}
