// ===== DATA STORE (Browser LocalStorage) =====
const STORAGE_KEYS = {
  CUSTOMERS: 'siva_customers',
  WORK_TYPES: 'siva_work_types',
  JOBS: 'siva_jobs',
  PAYMENTS: 'siva_payments',
  RATE_CARDS: 'siva_rate_cards'
};

const THEME_KEY = 'siva_theme';

function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (e) {
    return null;
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  updateThemeToggle(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {}
}

function updateThemeToggle(theme) {
  const button = document.getElementById('themeToggle');
  const label = document.getElementById('themeToggleLabel');
  const icon = document.getElementById('themeToggleIcon');
  if (!button || !label) return;
  const isDark = theme === 'dark';
  label.textContent = isDark ? 'Light' : 'Dark';
  button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  button.setAttribute('aria-label', button.title);
  if (icon) {
    icon.innerHTML = isDark
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
}

function initTheme() {
  const saved = getSavedTheme();
  applyTheme(saved || getSystemTheme());
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Initialize default data
function initializeData() {
  // Initialize customers if not exists
  if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
    const defaultCustomers = [
      // Fixed Monthly Clients
      { id: 1, name: 'Ramani Motors', shortCode: 'RMP', type: 'Monthly', hasCommission: true, requiresDc: true, notes: 'Mahindra vehicles', isActive: true },
      { id: 2, name: 'Ramani Cars', shortCode: 'WW', type: 'Monthly', hasCommission: true, requiresDc: true, notes: 'Volkswagen vehicles', isActive: true },
      { id: 3, name: 'Wagen Autos', shortCode: 'WP', type: 'Monthly', hasCommission: false, requiresDc: true, notes: 'Multi-brand', isActive: true },
      { id: 4, name: 'N Mahalingam', shortCode: 'NM', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 5, name: 'Friends Motors', shortCode: 'FDS', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 6, name: 'Vails Pradeep', shortCode: 'Vails', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 7, name: 'Sree Cars (P)', shortCode: '', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 8, name: 'Sree Cars (U)', shortCode: '', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 9, name: 'Ford Arun', shortCode: '', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 10, name: 'A. Siva', shortCode: '', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 11, name: 'TMJ Mayil', shortCode: 'TMJ', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 12, name: 'Alfa', shortCode: '', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 13, name: 'Karunamoorthi', shortCode: 'KM', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 14, name: 'Anandaraman', shortCode: '', type: 'Monthly', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      // Invoice-Based Clients
      { id: 15, name: 'Ayangaran', shortCode: '', type: 'Invoice', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 16, name: 'MyTVS (Poo)', shortCode: '', type: 'Invoice', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 17, name: 'AKR', shortCode: '', type: 'Invoice', hasCommission: true, requiresDc: false, notes: 'High risk - can delay', isActive: true },
      { id: 18, name: 'AVP', shortCode: '', type: 'Invoice', hasCommission: true, requiresDc: false, notes: 'High risk - can delay', isActive: true },
      // Party-Credit (Known individuals)
      { id: 19, name: 'Ooty Raj', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 20, name: 'SK Sathish', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 21, name: 'Sreenivasan', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 22, name: 'Ford Diamond', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 23, name: 'Kunnathoor', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 24, name: 'New Busstand', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 25, name: 'Ajmeerbhai', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 26, name: 'SK Saravanan', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 27, name: 'SRT Vinoth', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 28, name: 'Dravid', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 29, name: 'Akhila Hari', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 30, name: 'Akhila Senthil', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 31, name: 'Diamond (M)', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 32, name: 'Kumar (P)', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 33, name: 'KGV', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 34, name: 'Cuttubai', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 35, name: 'Prabhu', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 36, name: 'Ajith', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 37, name: 'Guhan', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 38, name: 'Velusamy', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 39, name: 'City Cars', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 40, name: 'D2C', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 41, name: 'Ooty Hindi', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 42, name: 'Rahul', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 43, name: 'Meenakshi', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 44, name: 'Sabari', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 45, name: 'Gnanaprakash', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 46, name: 'Ayyan Spares', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 47, name: 'Jeeva', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 48, name: 'Sivakumar', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 49, name: 'Kathir', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 50, name: 'PS Auto', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 51, name: 'Palanisamy', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 52, name: 'Prabhakaran', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 53, name: 'Karuppu', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      { id: 54, name: 'Elite', shortCode: '', type: 'Party-Credit', hasCommission: false, requiresDc: false, notes: '', isActive: true },
      // Anonymous Party (Walk-in)
      { id: 100, name: 'Party', shortCode: '', type: 'Cash', hasCommission: false, requiresDc: false, notes: 'Walk-in customer', isActive: true }
    ];
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(defaultCustomers));
  }

  // Initialize work types if not exists
  if (!localStorage.getItem(STORAGE_KEYS.WORK_TYPES)) {
    const defaultWorkTypes = [
      // Skimming Services
      { id: 1, category: 'Skimming', name: 'Rotor Skimming', shortCode: '', defaultUnit: 'Per set of 2', defaultRate: 500 },
      { id: 2, category: 'Skimming', name: 'Drum Skimming', shortCode: '', defaultUnit: 'Per set of 2', defaultRate: 300 },
      { id: 3, category: 'Skimming', name: 'Flywheel Skimming', shortCode: '', defaultUnit: 'Per piece', defaultRate: 500 },
      { id: 4, category: 'Skimming', name: 'Flywheel Preplate Throwing', shortCode: '', defaultUnit: 'Per piece', defaultRate: 0 },
      { id: 5, category: 'Skimming', name: 'Flywheel Ring', shortCode: '', defaultUnit: 'Per piece', defaultRate: 200 },
      // Pressing — Bearings
      { id: 6, category: 'Bearing', name: 'Drum Bearing', shortCode: 'DB', defaultUnit: 'Per bearing', defaultRate: 100 },
      { id: 7, category: 'Bearing', name: 'Disc Bearing', shortCode: '', defaultUnit: 'Per bearing', defaultRate: 100 },
      { id: 8, category: 'Bearing', name: 'Hub Bearing', shortCode: '', defaultUnit: 'Per bearing', defaultRate: 100 },
      { id: 9, category: 'Bearing', name: 'Axle Bearing', shortCode: 'AB', defaultUnit: 'Per bearing', defaultRate: 150 },
      { id: 10, category: 'Bearing', name: 'Crown Bearing', shortCode: '', defaultUnit: 'Per bearing', defaultRate: 100 },
      { id: 11, category: 'Bearing', name: 'End Bearing', shortCode: '', defaultUnit: 'Per bearing', defaultRate: 100 },
      { id: 12, category: 'Bearing', name: 'Outer Bearing', shortCode: 'OB', defaultUnit: 'Per bearing', defaultRate: 150 },
      { id: 13, category: 'Bearing', name: 'Wheel Bearing', shortCode: '', defaultUnit: 'Per bearing', defaultRate: 300 },
      // Pressing — Bushes
      { id: 14, category: 'Bush', name: 'Lower Arm Bush', shortCode: 'LA', defaultUnit: 'Per set', defaultRate: 300 },
      { id: 15, category: 'Bush', name: 'Upper Arm Bush', shortCode: 'UA', defaultUnit: 'Per set', defaultRate: 400 },
      { id: 16, category: 'Bush', name: 'Collar Bush', shortCode: '', defaultUnit: 'Per bush', defaultRate: 150 },
      { id: 17, category: 'Bush', name: 'Chase Bush', shortCode: '', defaultUnit: 'Per bush', defaultRate: 100 },
      { id: 18, category: 'Bush', name: 'Center Bed Bush', shortCode: 'C-Bed', defaultUnit: 'Per bush', defaultRate: 200 },
      { id: 19, category: 'Bush', name: 'General Bush', shortCode: '', defaultUnit: 'Per bush', defaultRate: 100 },
      { id: 20, category: 'Bush', name: 'End Bush', shortCode: '', defaultUnit: 'Per bush', defaultRate: 100 },
      { id: 21, category: 'Bush', name: 'Gearbox Bush', shortCode: '', defaultUnit: 'Per bush', defaultRate: 100 },
      { id: 22, category: 'Bush', name: 'Spring Cut Bush', shortCode: '', defaultUnit: 'Per bush', defaultRate: 100 },
      { id: 23, category: 'Bush', name: 'Subframe Bush', shortCode: '', defaultUnit: 'Per bush', defaultRate: 100 },
      { id: 24, category: 'Bush', name: 'Bed Bush', shortCode: '', defaultUnit: 'Per bush', defaultRate: 150 },
      { id: 25, category: 'Bush', name: 'Aluminum Bed Bush', shortCode: '', defaultUnit: 'Per bush', defaultRate: 100 },
      // Driveshaft & Steering
      { id: 26, category: 'Driveshaft', name: 'Driveshaft Removing', shortCode: '', defaultUnit: 'Per piece', defaultRate: 100 },
      { id: 27, category: 'Driveshaft', name: 'Driveshaft Threading', shortCode: '', defaultUnit: 'Per piece', defaultRate: 100 },
      { id: 28, category: 'Driveshaft', name: 'Driveshaft Cleaning', shortCode: '', defaultUnit: 'Per piece', defaultRate: 100 },
      { id: 29, category: 'Driveshaft', name: 'Driveshaft Combo', shortCode: '', defaultUnit: 'Per piece', defaultRate: 300 },
      { id: 30, category: 'Driveshaft', name: 'Steering Box Bracket', shortCode: '', defaultUnit: 'Per job', defaultRate: 200 },
      { id: 31, category: 'Driveshaft', name: 'Kingpin — Normal', shortCode: '', defaultUnit: 'Per job', defaultRate: 1200 },
      { id: 32, category: 'Driveshaft', name: 'Kingpin — Traveler', shortCode: '', defaultUnit: 'Per job', defaultRate: 1600 },
      { id: 33, category: 'Driveshaft', name: 'Kingpin — Dhosthbada', shortCode: '', defaultUnit: 'Per job', defaultRate: 1600 },
      // Bolts & Threading
      { id: 34, category: 'Bolt', name: 'Silencer Bolt', shortCode: '', defaultUnit: 'Per bolt', defaultRate: 150 },
      { id: 35, category: 'Bolt', name: 'Sensor Bolt', shortCode: '', defaultUnit: 'Per bolt', defaultRate: 100 },
      { id: 36, category: 'Bolt', name: 'Bed Bolt', shortCode: '', defaultUnit: 'Per bolt', defaultRate: 100 },
      { id: 37, category: 'Bolt', name: 'Bracket Bolt', shortCode: '', defaultUnit: 'Per bolt', defaultRate: 100 },
      { id: 38, category: 'Bolt', name: 'Sump Bolt', shortCode: '', defaultUnit: 'Per bolt', defaultRate: 100 },
      { id: 39, category: 'Bolt', name: 'Center Bolt', shortCode: '', defaultUnit: 'Per bolt', defaultRate: 100 },
      { id: 40, category: 'Bolt', name: 'Gear Box Bolt', shortCode: '', defaultUnit: 'Per bolt', defaultRate: 100 },
      { id: 41, category: 'Bolt', name: 'Oil Nut', shortCode: '', defaultUnit: 'Per piece', defaultRate: 100 },
      { id: 42, category: 'Bolt', name: 'Engine Bolt', shortCode: '', defaultUnit: 'Per bolt', defaultRate: 100 },
      { id: 43, category: 'Bolt', name: 'Turbo Bolt', shortCode: '', defaultUnit: 'Per bolt', defaultRate: 150 },
      { id: 44, category: 'Bolt', name: 'Wheel Bolt', shortCode: '', defaultUnit: 'Per bolt', defaultRate: 400 },
      { id: 45, category: 'Bolt', name: 'Stud', shortCode: '', defaultUnit: 'Per stud', defaultRate: 100 },
      { id: 46, category: 'Bolt', name: 'Thread Sleeve M6', shortCode: 'M6', defaultUnit: 'Per sleeve', defaultRate: 150 },
      { id: 47, category: 'Bolt', name: 'Thread Sleeve M8', shortCode: 'M8', defaultUnit: 'Per sleeve', defaultRate: 200 },
      { id: 48, category: 'Bolt', name: 'Thread Sleeve M10', shortCode: 'M10', defaultUnit: 'Per sleeve', defaultRate: 250 },
      { id: 49, category: 'Bolt', name: 'Thread Sleeve M12', shortCode: 'M12', defaultUnit: 'Per sleeve', defaultRate: 500 },
      { id: 50, category: 'Bolt', name: 'Thread Sleeve M14', shortCode: 'M14', defaultUnit: 'Per sleeve', defaultRate: 350 },
      // Welding
      { id: 51, category: 'Welding', name: 'Welding Works', shortCode: '', defaultUnit: 'Per job', defaultRate: 200 },
      { id: 52, category: 'Welding', name: 'S-Welding', shortCode: '', defaultUnit: 'Per job', defaultRate: 200 },
      { id: 53, category: 'Welding', name: 'Silencer Welding', shortCode: '', defaultUnit: 'Per job', defaultRate: 150 },
      // Other Services
      { id: 54, category: 'Other', name: 'Clutch Pedal', shortCode: '', defaultUnit: 'Per job', defaultRate: 200 },
      { id: 55, category: 'Other', name: 'Joint Star', shortCode: '', defaultUnit: 'Per piece', defaultRate: 300 },
      { id: 56, category: 'Other', name: 'Caliper Nipple', shortCode: '', defaultUnit: 'Per piece', defaultRate: 100 },
      { id: 57, category: 'Other', name: 'Spindle Threading', shortCode: '', defaultUnit: 'Per piece', defaultRate: 100 },
      { id: 58, category: 'Other', name: 'Compressor Switch', shortCode: '', defaultUnit: 'Per piece', defaultRate: 400 },
      { id: 59, category: 'Other', name: 'Sensor Remove', shortCode: '', defaultUnit: 'Per job', defaultRate: 300 },
      { id: 60, category: 'Other', name: 'Hub Remove', shortCode: '', defaultUnit: 'Per hub', defaultRate: 200 },
      { id: 61, category: 'Other', name: 'Gearbox Setting', shortCode: '', defaultUnit: 'Per job', defaultRate: 500 },
      { id: 62, category: 'Other', name: 'Sump Thread and Bolt', shortCode: '', defaultUnit: 'Per job', defaultRate: 600 },
      { id: 63, category: 'Other', name: 'Other / Miscellaneous', shortCode: '', defaultUnit: 'Per job', defaultRate: 0 }
    ];
    localStorage.setItem(STORAGE_KEYS.WORK_TYPES, JSON.stringify(defaultWorkTypes));
  }

  // Initialize jobs if not exists
  if (!localStorage.getItem(STORAGE_KEYS.JOBS)) {
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify([]));
  }
  if (!localStorage.getItem('siva_jobs_reset_v3')) {
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify([]));
    localStorage.setItem('siva_jobs_reset_v3', '1');
  }

  // Initialize payments if not exists
  if (!localStorage.getItem(STORAGE_KEYS.PAYMENTS)) {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
  }
}

// Data access functions
function getCustomers() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]');
}

function getWorkTypes() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.WORK_TYPES) || '[]');
}

function getJobs() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS) || '[]');
}

function getPayments() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]');
}

function saveJob(job) {
  const jobs = getJobs();
  job.id = jobs.length > 0 ? Math.max(...jobs.map(j => j.id)) + 1 : 1;
  job.createdAt = new Date().toISOString();
  jobs.push(job);
  localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
  return job;
}

function savePayment(payment) {
  const payments = getPayments();
  payment.id = payments.length > 0 ? Math.max(...payments.map(p => p.id)) + 1 : 1;
  payment.createdAt = new Date().toISOString();
  payments.push(payment);
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  return payment;
}

function getNextMasterId(items) {
  return items.length > 0 ? Math.max(...items.map(item => Number(item.id) || 0)) + 1 : 1;
}

function isMasterActive(item) {
  return item && item.isActive !== false;
}

function getActiveCustomers() {
  return getCustomers().filter(isMasterActive);
}

function getActiveWorkTypes() {
  return getWorkTypes().filter(isMasterActive);
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateStart(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function getWeekStartDate(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  return getLocalDateString(start);
}

function getMonthStartDate(date = new Date()) {
  return getLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1));
}

function getYearStartDate(date = new Date()) {
  return getLocalDateString(new Date(date.getFullYear(), 0, 1));
}

function getHalfYearStartDate(date = new Date()) {
  const month = date.getMonth();
  const startMonth = month < 6 ? 0 : 6;
  return getLocalDateString(new Date(date.getFullYear(), startMonth, 1));
}

function getMonthInputString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getJobWorkMode(job) {
  return job.workMode || (job.isSpotWork ? 'Spot' : 'Workshop');
}

function getJobGroupKey(job) {
  if (job.jobCardId) {
    return `card:${job.jobCardId}`;
  }
  return `legacy:${job.id}`;
}

function groupJobsByCard(jobs) {
  const groups = new Map();

  jobs.forEach(job => {
    const key = getJobGroupKey(job);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(job);
  });

  return [...groups.entries()].map(([key, groupJobs]) => {
    const sortedJobs = [...groupJobs].sort((a, b) => (a.jobCardLine || a.id) - (b.jobCardLine || b.id));
    return {
      key,
      jobs: sortedJobs,
      primary: sortedJobs[0],
      totalAmount: sortedJobs.reduce((sum, job) => sum + (Number(job.amount) || 0), 0),
      totalNet: sortedJobs.reduce((sum, job) => sum + getJobNetValue(job), 0),
      totalCommission: sortedJobs.reduce((sum, job) => sum + (Number(job.commissionAmount) || 0), 0),
      totalQuantity: sortedJobs.reduce((sum, job) => sum + (Number(job.quantity) || 0), 0),
      lineCount: sortedJobs.length
    };
  });
}

function getJobWorkName(job) {
  return job.workName || job.workTypeName || '';
}

function getJobPaymentStatus(job) {
  if (job.paymentStatus) return job.paymentStatus;
  return getJobPaidAmount(job) > 0 ? 'Paid' : 'Pending';
}

function getJobPaymentMode(job) {
  return job.paymentMode || '-';
}

function getJobPaidAmount(job) {
  if (typeof job.paidAmount === 'number') {
    return job.paidAmount;
  }

  if ((job.paymentStatus || '').toLowerCase() === 'paid') {
    const netAmount = typeof job.netAmount === 'number'
      ? job.netAmount
      : (Number(job.amount) || 0) - (Number(job.commissionAmount) || 0);
    return netAmount;
  }

  return 0;
}

function getJobDateValue(job) {
  return job.date || getLocalDateString();
}

function isDateInRange(dateStr, startDate, endDate) {
  return (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);
}

function getJobNetValue(job) {
  if (typeof job.netAmount === 'number') {
    return job.netAmount;
  }
  return (Number(job.amount) || 0) - (Number(job.commissionAmount) || 0);
}

function getJobSummary(jobs) {
  const billed = jobs.reduce((sum, job) => sum + (Number(job.amount) || 0), 0);
  const commission = jobs.reduce((sum, job) => sum + (Number(job.commissionAmount) || 0), 0);
  const net = jobs.reduce((sum, job) => sum + getJobNetValue(job), 0);
  const received = jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
  const pending = net - received;
  const jobCards = groupJobsByCard(jobs).length;

  return {
    jobs: jobCards,
    billed,
    commission,
    net,
    received,
    pending
  };
}

function getPaymentsInRange(payments, startDate, endDate) {
  return payments.filter(payment => isDateInRange(payment.date, startDate, endDate));
}

function getJobsInRange(jobs, startDate, endDate) {
  return jobs.filter(job => isDateInRange(getJobDateValue(job), startDate, endDate));
}