// ===== DROPDOWN FUNCTIONALITY =====
function setupSearchableDropdown(inputId, dropdownId, items, onSelect, renderItem, getSearchTerms) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const getItems = typeof items === 'function' ? items : () => items;

  function resolveItems() {
    return getItems() || [];
  }
  
  function renderDropdown(filteredItems) {
    if (filteredItems.length === 0) {
      dropdown.innerHTML = '<div style="padding: var(--space-lg); text-align: center; color: var(--text-muted);">No results found</div>';
      return;
    }
    
    let html = '';
    let currentCategory = null;
    
    filteredItems.forEach(item => {
      if (item.category && item.category !== currentCategory) {
        currentCategory = item.category;
        html += `<div class="dropdown-category">${currentCategory}</div>`;
      }
      html += renderItem(item);
    });
    
    dropdown.innerHTML = html;
    
    // Add click handlers
    dropdown.querySelectorAll('.dropdown-item').forEach(el => {
      el.addEventListener('click', () => {
        const itemId = parseInt(el.dataset.id);
        const item = resolveItems().find(i => i.id === itemId);
        if (item) {
          onSelect(item);
          input.value = item.name;
          dropdown.classList.remove('open');
        }
      });
    });
  }
  
  input.addEventListener('focus', () => {
    renderDropdown(resolveItems());
    dropdown.classList.add('open');
  });
  
  input.addEventListener('input', () => {
    const query = input.value.toLowerCase();
    const filtered = resolveItems().filter(item => {
      const terms = getSearchTerms(item);
      return terms.some(term => term.toLowerCase().includes(query));
    });
    renderDropdown(filtered);
    dropdown.classList.add('open');
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest(`#${inputId}`) && !e.target.closest(`#${dropdownId}`)) {
      dropdown.classList.remove('open');
    }
  });
}