// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  // Initialize data
  initializeData();

  // Initialize theme
  initTheme();

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Navigation handlers
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const screen = item.dataset.screen;
      if (screen) switchScreen(screen);
    });
  });

  // Mobile menu toggle
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('active');
  });

  document.getElementById('overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
  });

  // Dashboard filter
  document.getElementById('dashFilterType').addEventListener('change', () => {
    refreshCustomerBalances(
      getActiveCustomers(),
      getJobs(),
      getPayments()
    );
  });

  // History filter
  document.getElementById('filterHistory').addEventListener('click', () => {
    renderJobHistory(getJobs());
  });

  // Initialize screens
  initJobEntry();
  initPaymentEntry();
  updateTodayStats();
  updatePendingBadge();
});

function getQuarterStartDate(date = new Date()) {
  const quarter = Math.floor(date.getMonth() / 3);
  return getLocalDateString(new Date(date.getFullYear(), quarter * 3, 1));
}