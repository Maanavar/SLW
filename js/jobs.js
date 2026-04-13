// ===== JOB ENTRY =====
const DC_CUSTOMER_IDS = new Set([1, 2, 4]);
let selectedCustomer = null;
let selectedJobPaymentMode = 'Cash';
let jobLineCounter = 0;
let editingJobGroupKey = null;
let editingJobCardId = null;
let editingCustomerId = null;
let editingWorkTypeId = null;

function customerNeedsDc(customer) {
  return !!customer && (DC_CUSTOMER_IDS.has(customer.id) || ['Ramani Motors', 'Ramani Cars', 'N Mahalingam'].includes(customer.name) || customer.requiresDc === true);
}

function getJobGroupKey(job) {
  if (job.jobCardId) {
    return `card:${job.jobCardId}`;
  }
  return `legacy:${job.id}`;
}

function getJobCardJobs(groupKey) {
  return getJobs()
    .filter(job => getJobGroupKey(job) === groupKey)
    .sort((a, b) => (a.jobCardLine || a.id) - (b.jobCardLine || b.id));
}

function jobHasDcDetails(job) {
  return Boolean((job.dcNo || '').trim() || (job.vehicleNo || '').trim() || (job.dcDate || '').trim());
}

function getJobDcStatus(job) {
  if (job.dcStatus) return job.dcStatus;
  if (!customerNeedsDc({ id: job.customerId, name: job.customerName })) {
    return 'Not Required';
  }
  return jobHasDcDetails(job) ? 'Completed' : 'Pending DC';
}

function updateDcApprovalRequirement() {
  const approvalField = document.getElementById('dcApprovalField');
  const vehicleNo = document.getElementById('vehicleNo');
  const dcNo = document.getElementById('dcNo');
  const dcDate = document.getElementById('dcDate');

  if (!approvalField || !vehicleNo || !dcNo || !dcDate) return;

  const hasDcDetails = !!(vehicleNo.value.trim() || dcNo.value.trim() || dcDate.value.trim());
  const dcFieldsVisible = approvalField.parentElement && approvalField.parentElement.style.display !== 'none';

  if (dcFieldsVisible && !hasDcDetails) {
    approvalField.classList.add('dc-approval-required');
  } else {
    approvalField.classList.remove('dc-approval-required');
  }
}

function setDcApprovalVisibility(visible) {
  const approvalField = document.getElementById('dcApprovalField');
  const approvalToggle = document.getElementById('dcApproval');
  if (!approvalField || !approvalToggle) return;

  approvalField.style.display = visible ? 'block' : 'none';
  if (!visible) {
    approvalToggle.checked = false;
    approvalField.classList.remove('dc-approval-required');
  } else {
    updateDcApprovalRequirement();
  }
}

function setDcFieldVisibility(visible) {
  const dcFields = document.getElementById('dcFields');
  if (!dcFields) return;
  dcFields.classList.toggle('visible', visible);
  if (!visible) {
    document.getElementById('vehicleNo').value = '';
    document.getElementById('dcNo').value = '';
    document.getElementById('dcDate').value = '';
    updateDcApprovalRequirement();
  } else if (!document.getElementById('dcDate').value) {
    document.getElementById('dcDate').value = getLocalDateString();
    updateDcApprovalRequirement();
  }
}

function setJobFormEditState(active, groupKey = null, jobCardId = null, lineCount = 0) {
  editingJobGroupKey = active ? groupKey : null;
  editingJobCardId = active ? jobCardId : null;

  const status = document.getElementById('jobFormStatus');
  const title = document.getElementById('jobFormStatusTitle');
  const subtitle = document.getElementById('jobFormStatusSub');
  const saveBtn = document.getElementById('jobSaveBtn');

  if (status) {
    status.style.display = active ? 'flex' : 'none';
  }

  if (title) {
    title.textContent = active ? `Editing ${jobCardId || 'Job'}` : 'Editing Job';
  }

  if (subtitle) {
    subtitle.textContent = active
      ? `Updating ${lineCount || 1} job line${(lineCount || 1) !== 1 ? 's' : ''}. Save will replace the existing jobcard.`
      : 'Changes will update the existing jobcard.';
  }

  if (saveBtn) {
    saveBtn.innerHTML = active
      ? `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        Update Job
      `
      : `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Save Job
      `;
  }
}

function clearJobFormEditState() {
  setJobFormEditState(false);
}

function saveJobCardJobs(jobRecords, groupKey = null) {
  const jobs = getJobs();
  const remainingJobs = groupKey
    ? jobs.filter(job => getJobGroupKey(job) !== groupKey)
    : jobs;
  const nextId = remainingJobs.length > 0 ? Math.max(...remainingJobs.map(j => j.id)) + 1 : 1;
  const createdAt = new Date().toISOString();
  const savedJobs = jobRecords.map((job, index) => ({
    ...job,
    id: nextId + index,
    createdAt
  }));

  localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify([...remainingJobs, ...savedJobs]));
  return savedJobs;
}

function createJobLineMarkup(lineId) {
  return `
    <div class="job-line" data-line-id="${lineId}">
      <div class="job-line-header">
        <div class="job-line-title">Job ${lineId}</div>
        <button type="button" class="job-line-remove" data-remove-line="${lineId}">Remove</button>
      </div>
      <div class="job-line-grid">
        <div class="form-group job-line-work-group">
          <label class="form-label">Work Name <span class="required">*</span></label>
          <div class="searchable-select">
            <div class="search-input-wrapper">
              <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input type="text" class="form-input job-line-work-search" id="jobLineWorkSearch-${lineId}" placeholder="Search work name or code..." autocomplete="off">
            </div>
            <div class="dropdown-menu job-line-dropdown" id="jobLineDropdown-${lineId}"></div>
          </div>
          <input type="hidden" id="jobLineWorkTypeId-${lineId}">
        </div>
        <div class="form-group">
          <label class="form-label">Quantity</label>
          <div class="quantity-stepper job-line-stepper">
            <button type="button" class="qty-btn" data-qty-minus="${lineId}">-</button>
            <span class="qty-value" id="jobLineQtyValue-${lineId}">1</span>
            <button type="button" class="qty-btn" data-qty-plus="${lineId}">+</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Amount <span class="required">*</span></label>
          <div class="input-with-prefix">
            <span class="input-prefix">₹</span>
            <input type="number" class="form-input job-line-amount" id="jobLineAmount-${lineId}" placeholder="0" min="0">
          </div>
          <div class="suggestion-chip job-line-suggestion" id="jobLineSuggestion-${lineId}" style="display: none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span>Suggested: ₹<span id="jobLineSuggestedRate-${lineId}">0</span></span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Commission</label>
          <div class="input-with-prefix">
            <span class="input-prefix">₹</span>
            <input type="number" class="form-input job-line-commission" id="jobLineCommission-${lineId}" placeholder="0 or 0.10 for 10%" min="0" step="0.01">
          </div>
        </div>
      </div>
    </div>
  `;
}

function addJobLine() {
  jobLineCounter += 1;
  const container = document.getElementById('jobLinesContainer');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', createJobLineMarkup(jobLineCounter));
  setupJobLine(jobLineCounter);
  renumberJobLines();
  updateJobReview();
}

function setupJobLine(lineId) {
  const workSearchId = `jobLineWorkSearch-${lineId}`;
  const workDropdownId = `jobLineDropdown-${lineId}`;
  const amountId = `jobLineAmount-${lineId}`;
  const commissionId = `jobLineCommission-${lineId}`;
  const qtyValueId = `jobLineQtyValue-${lineId}`;
  const suggestionId = `jobLineSuggestion-${lineId}`;
  const suggestedRateId = `jobLineSuggestedRate-${lineId}`;
  const row = document.querySelector(`.job-line[data-line-id="${lineId}"]`);

  setupSearchableDropdown(
    workSearchId,
    workDropdownId,
    () => [...getActiveWorkTypes()].sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return a.name.localeCompare(b.name);
    }),
    (workType) => {
      if (!row) return;
      row._selectedWorkType = workType;
      document.getElementById(`jobLineWorkTypeId-${lineId}`).value = workType.id;
      document.getElementById(workSearchId).value = workType.name;
      updateJobLineSuggestion(lineId);
      updateJobReview();
    },
    (workType) => `
      <div class="dropdown-item" data-id="${workType.id}">
        <div>
          <div class="dropdown-item-main">${workType.name}</div>
          <div class="dropdown-item-sub">${workType.defaultUnit}</div>
        </div>
        ${workType.shortCode ? `<span class="dropdown-item-code">${workType.shortCode}</span>` : ''}
      </div>
    `,
    (workType) => [workType.name, workType.shortCode || '', workType.category]
  );

  document.getElementById(`jobLineAmount-${lineId}`).addEventListener('input', updateJobReview);
  document.getElementById(`jobLineCommission-${lineId}`).addEventListener('input', updateJobReview);

  document.querySelector(`[data-qty-minus="${lineId}"]`).addEventListener('click', () => {
    if (!row) return;
    const qtyValue = document.getElementById(qtyValueId);
    const nextValue = Math.max(1, (parseInt(qtyValue.textContent, 10) || 1) - 1);
    qtyValue.textContent = String(nextValue);
    updateJobLineSuggestion(lineId);
    updateJobReview();
  });

  document.querySelector(`[data-qty-plus="${lineId}"]`).addEventListener('click', () => {
    if (!row) return;
    const qtyValue = document.getElementById(qtyValueId);
    const nextValue = (parseInt(qtyValue.textContent, 10) || 1) + 1;
    qtyValue.textContent = String(nextValue);
    updateJobLineSuggestion(lineId);
    updateJobReview();
  });

  document.getElementById(suggestionId).addEventListener('click', () => {
    const suggested = document.getElementById(suggestedRateId).textContent;
    document.getElementById(amountId).value = suggested;
    updateJobReview();
  });

  document.querySelector(`[data-remove-line="${lineId}"]`).addEventListener('click', () => {
    const totalLines = document.querySelectorAll('.job-line').length;
    if (totalLines <= 1) return;
    row.remove();
    renumberJobLines();
    updateJobReview();
  });
}

function renumberJobLines() {
  const lines = document.querySelectorAll('.job-line');
  lines.forEach((line, index) => {
    const title = line.querySelector('.job-line-title');
    const removeBtn = line.querySelector('.job-line-remove');
    if (title) title.textContent = `Job ${index + 1}`;
    if (removeBtn) removeBtn.disabled = lines.length === 1;
    if (removeBtn) removeBtn.classList.toggle('is-disabled', lines.length === 1);
  });
}

function updateJobLineSuggestion(lineId) {
  const row = document.querySelector(`.job-line[data-line-id="${lineId}"]`);
  if (!row) return;
  const workType = row._selectedWorkType;
  const qty = parseInt(document.getElementById(`jobLineQtyValue-${lineId}`).textContent, 10) || 1;
  const suggestion = document.getElementById(`jobLineSuggestion-${lineId}`);
  const suggestedRate = document.getElementById(`jobLineSuggestedRate-${lineId}`);
  if (!workType || !workType.defaultRate) {
    suggestion.style.display = 'none';
    return;
  }
  const suggested = workType.defaultRate * qty;
  if (suggested > 0) {
    suggestedRate.textContent = suggested;
    suggestion.style.display = 'inline-flex';
  } else {
    suggestion.style.display = 'none';
  }
}

function getJobLineData() {
  return [...document.querySelectorAll('.job-line')].map(row => {
    const lineId = row.dataset.lineId;
    return {
      row,
      lineId,
      workType: row._selectedWorkType || null,
      quantity: parseInt(document.getElementById(`jobLineQtyValue-${lineId}`).textContent, 10) || 1,
      amount: parseFloat(document.getElementById(`jobLineAmount-${lineId}`).value) || 0,
      commissionInput: parseFloat(document.getElementById(`jobLineCommission-${lineId}`).value) || 0
    };
  });
}

function loadJobLinesFromRecords(jobRecords) {
  const container = document.getElementById('jobLinesContainer');
  if (!container) return;

  const records = jobRecords.length > 0 ? jobRecords : [{}];
  container.innerHTML = '';
  jobLineCounter = 0;

  records.forEach(() => addJobLine());

  records.forEach((record, index) => {
    const lineId = index + 1;
    const row = document.querySelector(`.job-line[data-line-id="${lineId}"]`);
    const workType = getWorkTypes().find(wt => wt.id === record.workTypeId) || getWorkTypes().find(wt => wt.name === record.workTypeName);
    const workSearch = document.getElementById(`jobLineWorkSearch-${lineId}`);
    const workTypeHidden = document.getElementById(`jobLineWorkTypeId-${lineId}`);

    if (row && workType) {
      row._selectedWorkType = workType;
      if (workSearch) workSearch.value = workType.name;
      if (workTypeHidden) workTypeHidden.value = workType.id;
    }

    const qtyValue = document.getElementById(`jobLineQtyValue-${lineId}`);
    const amountInput = document.getElementById(`jobLineAmount-${lineId}`);
    const commissionInput = document.getElementById(`jobLineCommission-${lineId}`);

    if (qtyValue) qtyValue.textContent = String(record.quantity || 1);
    if (amountInput) amountInput.value = record.amount ?? '';
    if (commissionInput) commissionInput.value = record.commissionInput ?? '';
    updateJobLineSuggestion(lineId);
  });

  renumberJobLines();
}

function loadJobCardIntoForm(groupKey) {
  const cardJobs = getJobCardJobs(groupKey);
  if (cardJobs.length === 0) {
    showToast('Error', 'That job is no longer available', 'error');
    return;
  }

  const primaryJob = cardJobs[0];
  const customer = getCustomers().find(c => c.id === primaryJob.customerId) || {
    id: primaryJob.customerId,
    name: primaryJob.customerName,
    type: ''
  };

  selectedCustomer = customer;
  document.getElementById('customerSearch').value = customer.name || primaryJob.customerName || '';
  document.getElementById('selectedCustomerId').value = customer.id || primaryJob.customerId || '';

  document.getElementById('jobDateInput').value = primaryJob.date || getLocalDateString();
  document.getElementById('jobDate').textContent = formatDate(document.getElementById('jobDateInput').value);
  document.getElementById('spotWork').checked = getJobWorkMode(primaryJob) === 'Spot';
  document.getElementById('cashPaid').checked = getJobPaymentStatus(primaryJob) === 'Paid' || getJobPaidAmount(primaryJob) > 0;
  selectedJobPaymentMode = getJobPaymentMode(primaryJob) !== '-' ? getJobPaymentMode(primaryJob) : 'Cash';

  document.querySelectorAll('.job-payment-mode').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === selectedJobPaymentMode);
  });

  const dcVisible = customerNeedsDc(customer);
  setDcFieldVisibility(dcVisible);
  setDcApprovalVisibility(dcVisible);
  document.getElementById('dcApproval').checked = dcVisible && !!primaryJob.dcApproval && !jobHasDcDetails(primaryJob);
  document.getElementById('vehicleNo').value = primaryJob.vehicleNo || '';
  document.getElementById('dcNo').value = primaryJob.dcNo || '';
  document.getElementById('dcDate').value = primaryJob.dcDate || '';
  document.getElementById('jobNotes').value = primaryJob.notes || '';

  loadJobLinesFromRecords(cardJobs);
  setJobFormEditState(true, groupKey, primaryJob.jobCardId || `JC-${primaryJob.id}`, cardJobs.length);
  updateJobReview();
}

function editJobCard(groupKey) {
  switchScreen('jobs');
  loadJobCardIntoForm(groupKey);
}

function initJobEntry() {
  const today = getLocalDateString();
  document.getElementById('jobDateInput').value = today;
  document.getElementById('jobDateInput').max = today;
  document.getElementById('dcDate').value = today;
  document.getElementById('dcDate').max = today;
  document.getElementById('jobDate').textContent = formatDate(today);

  document.getElementById('addJobLine').addEventListener('click', () => addJobLine());

  setupSearchableDropdown(
    'customerSearch',
    'customerDropdown',
    () => getActiveCustomers(),
    (customer) => {
      selectedCustomer = customer;
      document.getElementById('selectedCustomerId').value = customer.id;
      setDcFieldVisibility(customerNeedsDc(customer));
      setDcApprovalVisibility(customerNeedsDc(customer));
      updateJobReview();
    },
    (customer) => {
      const typeClass = `type-${customer.type.toLowerCase().replace('-', '')}`;
      const balance = calculateCustomerBalance(customer.id);
      const balanceHtml = balance !== 0
        ? `<span class="customer-pending ${balance > 0 ? 'has-pending' : 'clear'}">${balance > 0 ? '₹' + balance.toLocaleString() : 'Clear'}</span>`
        : '';
      return `
        <div class="dropdown-item" data-id="${customer.id}">
          <div>
            <div class="dropdown-item-main">${customer.name}</div>
            <div class="dropdown-item-sub">${customer.type}</div>
          </div>
          ${customer.shortCode ? `<span class="dropdown-item-code">${customer.shortCode}</span>` : ''}
          ${balanceHtml}
        </div>
      `;
    },
    (customer) => [customer.name, customer.shortCode || '', customer.type]
  );

  document.getElementById('cashPaid').addEventListener('change', () => {
    updateJobReview();
  });

  document.getElementById('dcApproval').addEventListener('change', () => {
    updateJobReview();
  });

  document.getElementById('spotWork').addEventListener('change', () => {
    updateJobReview();
  });

  document.querySelectorAll('.job-payment-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.job-payment-mode').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedJobPaymentMode = btn.dataset.mode;
      document.getElementById('cashPaid').checked = true;
      updateJobReview();
    });
  });

  ['jobDateInput', 'dcNo', 'vehicleNo', 'dcDate', 'jobNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateJobReview);
      el.addEventListener('change', updateJobReview);
      // Also update DC approval requirement when DC fields change
      if (['dcNo', 'vehicleNo', 'dcDate'].includes(id)) {
        el.addEventListener('input', updateDcApprovalRequirement);
        el.addEventListener('change', updateDcApprovalRequirement);
      }
    }
  });

  document.getElementById('jobForm').addEventListener('submit', handleJobSubmit);
  document.getElementById('cancelJobEdit').addEventListener('click', () => {
    resetJobForm();
    refreshTodaysJobs();
  });

  setDcFieldVisibility(false);
  setDcApprovalVisibility(false);
  addJobLine();
  refreshTodaysJobs();
  updateJobReview();
}

function updateJobReview() {
  const reviewGrid = document.getElementById('jobReviewGrid');
  if (!reviewGrid) return;

  const lines = getJobLineData();
  const cashPaid = document.getElementById('cashPaid').checked;
  const paymentMode = cashPaid ? (selectedJobPaymentMode || 'Cash') : '-';
  const workMode = document.getElementById('spotWork').checked ? 'Spot' : 'Workshop';
  const dcVisible = selectedCustomer ? customerNeedsDc(selectedCustomer) : false;
  const dcApproval = dcVisible ? document.getElementById('dcApproval').checked : false;
  const dcDetailsPresent = dcVisible
    ? Boolean(document.getElementById('dcNo').value.trim() || document.getElementById('vehicleNo').value.trim() || document.getElementById('dcDate').value.trim())
    : false;
  const dcStatus = dcVisible
    ? (dcDetailsPresent ? 'Completed' : (dcApproval ? 'Approved without DC' : 'Waiting for DC'))
    : 'Not Required';

  const lineTotals = lines.map(line => {
    const commissionAmount = line.commissionInput > 0
      ? (line.commissionInput > 1 ? line.commissionInput : Math.round(line.amount * line.commissionInput))
      : 0;
    return {
      ...line,
      workName: line.workType ? line.workType.name : 'Select work name',
      commissionAmount,
      netAmount: Math.max(0, line.amount - commissionAmount)
    };
  });

  const totalAmount = lineTotals.reduce((sum, line) => sum + line.amount, 0);
  const totalCommission = lineTotals.reduce((sum, line) => sum + line.commissionAmount, 0);
  const totalNet = lineTotals.reduce((sum, line) => sum + line.netAmount, 0);
  const totalQuantity = lineTotals.reduce((sum, line) => sum + line.quantity, 0);

  const paymentStatusBadge = `<span class="badge ${cashPaid ? 'badge-green' : 'badge-red'}">${cashPaid ? 'Paid' : 'Pending'}</span>`;
  const dcStatusBadgeClass = dcStatus === 'Completed' ? 'badge-green' : dcStatus === 'Approved without DC' ? 'badge-orange' : dcStatus === 'Not Required' ? 'badge-blue' : 'badge-orange';
  const dcStatusBadge = `<span class="badge ${dcStatusBadgeClass}">${dcStatus}</span>`;

  const lineHtml = lineTotals.length
    ? lineTotals.map((line, index) => `
        <div class="review-line-item">
          <span>${index + 1}</span>
          <span>${line.workName}</span>
          <span>${line.quantity}</span>
          <span class="review-amount-warning">${formatCurrency(line.amount)}</span>
        </div>
      `).join('')
    : '<div class="review-item review-wide"><span>Job Details</span><strong>Add at least one job line</strong></div>';

  reviewGrid.innerHTML = `
    <div class="review-section-header">Job Info</div>
    <div class="review-item"><span>Date</span><strong>${document.getElementById('jobDateInput').value || '-'}</strong></div>
    <div class="review-item"><span>Customer</span><strong>${selectedCustomer ? selectedCustomer.name : 'Select customer'}</strong></div>
    <div class="review-item"><span>Work Mode</span><strong>${workMode}</strong></div>

    <div class="review-section-header">Job Lines</div>
    <div class="review-line-item" style="font-weight: 600; background: var(--bg-secondary);">
      <span>#</span>
      <span>Work Type</span>
      <span>Qty</span>
      <span>Amount</span>
    </div>
    ${lineHtml}

    <div class="review-section-header">Amounts & Summary</div>
    <div class="review-item"><span>Total Billed</span><strong class="review-amount-warning">${formatCurrency(totalAmount)}</strong></div>

    ${dcVisible ? `<div class="review-section-header">DC Information</div>` : ''}
    ${dcVisible ? `<div class="review-item"><span>DC Status</span>${dcStatusBadge}</div>` : ''}
    ${dcVisible && dcApproval && !dcDetailsPresent ? `<div class="review-item"><span>DC Notes</span><strong>⚠ Approved without DC details</strong></div>` : ''}
    ${dcVisible ? `<div class="review-item"><span>DC No</span><strong>${document.getElementById('dcNo').value || '-'}</strong></div>` : ''}
    ${dcVisible ? `<div class="review-item"><span>Vehicle No</span><strong>${document.getElementById('vehicleNo').value || '-'}</strong></div>` : ''}
    ${dcVisible ? `<div class="review-item"><span>DC Date</span><strong>${document.getElementById('dcDate').value || '-'}</strong></div>` : ''}

    ${document.getElementById('jobNotes').value ? `<div class="review-item review-wide"><span>Notes</span><strong>${document.getElementById('jobNotes').value}</strong></div>` : ''}
  `;
}

function handleJobSubmit(e) {
  e.preventDefault();

  if (!selectedCustomer) {
    showToast('Error', 'Please select a customer', 'error');
    return;
  }

  const currentCustomer = getCustomers().find(customer => customer.id === selectedCustomer.id);
  if (!currentCustomer || (currentCustomer.isActive === false && !editingJobGroupKey)) {
    showToast('Error', 'Selected customer is inactive. Please choose an active customer.', 'error');
    return;
  }
  selectedCustomer = currentCustomer;

  const lines = getJobLineData();
  if (lines.length === 0) {
    showToast('Error', 'Please add at least one job line', 'error');
    return;
  }

  const invalidLine = lines.find(line => {
    const currentWorkType = line.workType ? getWorkTypes().find(workType => workType.id === line.workType.id) : null;
    return !currentWorkType || !line.amount || line.amount <= 0 || (currentWorkType.isActive === false && !editingJobGroupKey);
  });
  if (invalidLine) {
    showToast('Error', 'Please complete every job line with a work name and amount', 'error');
    return;
  }

  const dcRequired = customerNeedsDc(selectedCustomer);
  const vehicleNo = document.getElementById('vehicleNo').value.trim();
  const dcNo = document.getElementById('dcNo').value.trim();
  const dcDate = document.getElementById('dcDate').value.trim();
  const dcApproval = dcRequired ? document.getElementById('dcApproval').checked : false;
  const hasDcDetails = Boolean(vehicleNo || dcNo || dcDate);
  if (dcRequired && !hasDcDetails && !dcApproval) {
    showToast('Error', 'Please add DC details or approve without DC for now', 'error');
    return;
  }

  const cashPaid = document.getElementById('cashPaid').checked;
  const activePaymentMode = document.querySelector('#screen-jobs .job-payment-mode.active');
  const paymentMode = cashPaid ? (activePaymentMode ? activePaymentMode.dataset.mode : selectedJobPaymentMode) : '';
  const workMode = document.getElementById('spotWork').checked ? 'Spot' : 'Workshop';
  const jobCardId = editingJobCardId || `JC-${Date.now()}`;
  const notes = document.getElementById('jobNotes').value || '';
  const dcStatus = dcRequired ? (hasDcDetails ? 'Completed' : 'Pending DC') : 'Not Required';

  const jobRecords = lines.map((line, index) => {
    const currentWorkType = getWorkTypes().find(workType => workType.id === line.workType.id) || line.workType;
    const commissionAmount = line.commissionInput > 0
      ? (line.commissionInput > 1 ? line.commissionInput : Math.round(line.amount * line.commissionInput))
      : 0;
    const netAmount = Math.max(0, line.amount - commissionAmount);
    return {
      date: document.getElementById('jobDateInput').value,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      workTypeId: currentWorkType.id,
      workTypeName: currentWorkType.name,
      workMode: workMode,
      workName: currentWorkType.name,
      quantity: line.quantity,
      amount: line.amount,
      commissionInput: line.commissionInput,
      commissionAmount: commissionAmount,
      netAmount: netAmount,
      paymentStatus: cashPaid ? 'Paid' : 'Pending',
      paymentMode: paymentMode,
      paidAmount: cashPaid ? netAmount : 0,
      isSpotWork: workMode === 'Spot',
      vehicleNo: vehicleNo,
      dcNo: dcNo,
      dcDate: dcDate,
      dcApproval: dcRequired ? (!hasDcDetails && dcApproval) : false,
      dcRequired: dcRequired,
      dcStatus: dcStatus,
      notes: notes,
      jobCardId: jobCardId,
      jobCardLine: index + 1,
      jobCardCount: lines.length
    };
  });

  const savedJobs = saveJobCardJobs(jobRecords, editingJobGroupKey);
  const totalNet = savedJobs.reduce((sum, job) => sum + job.netAmount, 0);
  showToast(editingJobGroupKey ? 'Job Updated' : 'Job Saved', `${savedJobs.length} job${savedJobs.length !== 1 ? 's' : ''} saved for ${selectedCustomer.name} - ${formatCurrency(totalNet)}`);

  resetJobForm();
  refreshTodaysJobs();
  updateTodayStats();
  refreshJobHistory();
  refreshDashboard();
  updatePendingBadge();
}

function resetJobForm() {
  selectedCustomer = null;
  selectedJobPaymentMode = 'Cash';
  jobLineCounter = 0;
  clearJobFormEditState();

  const today = getLocalDateString();
  document.getElementById('customerSearch').value = '';
  document.getElementById('selectedCustomerId').value = '';
  document.getElementById('jobDateInput').value = today;
  document.getElementById('jobDate').textContent = formatDate(today);
  document.getElementById('cashPaid').checked = false;
  document.getElementById('spotWork').checked = false;
  document.getElementById('vehicleNo').value = '';
  document.getElementById('dcNo').value = '';
  document.getElementById('dcDate').value = today;
  document.getElementById('jobNotes').value = '';
  document.getElementById('dcApproval').checked = false;
  document.querySelectorAll('.job-payment-mode').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === 'Cash');
  });

  const container = document.getElementById('jobLinesContainer');
  if (container) {
    container.innerHTML = '';
    addJobLine();
  }

  setDcFieldVisibility(false);
  setDcApprovalVisibility(false);
  updateJobReview();
}

function refreshTodaysJobs() {
  const today = getLocalDateString();
  const jobs = getJobs().filter(j => j.date === today).reverse();
  
  const container = document.getElementById('recentJobsList');
  
  if (jobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <h3>No jobs yet today</h3>
        <p>Jobs you enter will appear here</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = jobs.map(job => `
    <div class="job-item">
      <span class="job-number">#${job.id}</span>
      <div class="job-details">
        <div class="job-customer">${job.customerName}</div>
        <div class="job-work">
          <span class="spot-badge">${getJobWorkMode(job)}</span>
          ${getJobWorkName(job)} × ${job.quantity}
        </div>
      </div>
      <div style="text-align: right;">
        <div class="job-amount">${formatCurrency(job.amount)}</div>
        <div class="job-net">${getJobPaymentStatus(job)}${getJobPaidAmount(job) > 0 ? ` · ${getJobPaymentMode(job)}` : ''}</div>
      </div>
    </div>
  `).join('');
}

function updateTodayStats() {
  const today = getLocalDateString();
  const jobs = getJobs().filter(j => j.date === today);
  const jobCards = groupJobsByCard(jobs);
  
  const totalJobs = jobCards.length;
  const totalAmount = jobs.reduce((sum, j) => sum + j.netAmount, 0);
  
  document.getElementById('todayJobs').textContent = `${totalJobs} jobcard${totalJobs !== 1 ? 's' : ''}`;
  document.getElementById('todayAmount').textContent = formatCurrency(totalAmount);
}