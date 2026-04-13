// ===== CUSTOMER & WORK TYPE LISTS =====
function refreshCustomerList() {
  const showInactive = document.getElementById('showInactiveCustomers')?.checked;
  const customers = getCustomers().filter(c => showInactive ? true : c.isActive !== false);
  const tbody = document.getElementById('customerListTable');

  tbody.innerHTML = customers.map(c => {
    const typeClass = `type-${c.type.toLowerCase().replace('-', '')}`;
    const balance = calculateCustomerBalance(c.id);
    const isInactive = c.isActive === false;

    return `
      <tr class="${isInactive ? 'table-row-inactive' : ''}">
        <td><strong>${c.name}</strong></td>
        <td>${c.shortCode || '-'}</td>
        <td><span class="type-badge ${typeClass}">${c.type}</span></td>
        <td>${c.hasCommission ? '<span class="badge badge-orange">Yes</span>' : '-'}</td>
        <td>${c.requiresDc ? '<span class="badge badge-blue">Yes</span>' : '-'}</td>
        <td>${isInactive ? '<span class="badge badge-red">Inactive</span>' : '<span class="badge badge-green">Active</span>'}</td>
        <td style="text-align: right;" class="amount ${balance > 0 ? 'negative' : balance < 0 ? 'positive' : ''}">${formatCurrency(balance)}</td>
        <td>
          <div class="table-actions">
            <button type="button" class="btn btn-secondary btn-small" data-edit-customer="${c.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-small" ${isInactive ? 'data-restore-customer' : 'data-delete-customer'}="${c.id}">
              ${isInactive ? 'Restore' : 'Delete'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  populateReportCustomers();
}