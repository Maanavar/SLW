function refreshWorkTypeList() {
  const showInactive = document.getElementById('showInactiveWorkTypes')?.checked;
  const workTypes = getWorkTypes()
    .filter((wt) => (showInactive ? true : wt.isActive !== false))
    .sort((a, b) => {
      if (a.category < b.category) {
return -1;
}
      if (a.category > b.category) {
return 1;
}
      return a.name.localeCompare(b.name);
    });

  const tbody = document.getElementById('workTypeListTable');

  tbody.innerHTML = workTypes
    .map((wt) => {
      const isInactive = wt.isActive === false;
      return `
    <tr class="${isInactive ? 'table-row-inactive' : ''}">
      <td><span class="badge badge-blue">${wt.category}</span></td>
      <td><strong>${wt.name}</strong></td>
      <td>${wt.shortCode ? `<span class="dropdown-item-code">${wt.shortCode}</span>` : '-'}</td>
      <td>${wt.defaultUnit}</td>
      <td>${isInactive ? '<span class="badge badge-red">Inactive</span>' : '<span class="badge badge-green">Active</span>'}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="btn btn-secondary btn-small" data-edit-worktype="${wt.id}">Edit</button>
          <button type="button" class="btn btn-danger btn-small" ${isInactive ? 'data-restore-worktype' : 'data-delete-worktype'}="${wt.id}">
            ${isInactive ? 'Restore' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  `;
    })
    .join('');
}
