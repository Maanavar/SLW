// ===== NAVIGATION =====
const screens = {
  jobs: 'New Job',
  payments: 'Record Payment',
  dashboard: 'Dashboard',
  history: 'Job History',
  reports: 'Job Reports',
  'payment-report': 'Payment Reports',
  customers: 'Customers',
  worktypes: 'Work Types',
};

function switchScreen(screenId) {
  // Update active states
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.screen === screenId);
  });
  document.querySelectorAll('.mobile-nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.screen === screenId);
  });
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === `screen-${screenId}`);
  });

  // Update page title
  document.getElementById('pageTitle').textContent = screens[screenId] || 'Siva Lathe Works';

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');

  // Refresh data for specific screens
  if (screenId === 'dashboard') {
refreshDashboard();
}
  if (screenId === 'history') {
refreshJobHistory();
}
  if (screenId === 'reports') {
refreshJobReports();
}
  if (screenId === 'payment-report') {
refreshPaymentReport();
}
  if (screenId === 'customers') {
refreshCustomerList();
}
  if (screenId === 'worktypes') {
refreshWorkTypeList();
}
}
