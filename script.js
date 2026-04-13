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
      const nextTheme = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
      updateThemeToggle(nextTheme);
      try {
        localStorage.setItem(THEME_KEY, nextTheme);
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
          ${type === 'success' 
            ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' 
            : '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/>'}
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

    // ===== NAVIGATION =====
    const screens = {
      'jobs': 'New Job',
      'payments': 'Record Payment',
      'dashboard': 'Dashboard',
      'history': 'Job History',
      'reports': 'Job Reports',
      'payment-report': 'Payment Reports',
      'customers': 'Customers',
      'worktypes': 'Work Types'
    };

    function switchScreen(screenId) {
      // Update active states
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.screen === screenId);
      });
      document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.screen === screenId);
      });
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.toggle('active', screen.id === `screen-${screenId}`);
      });
      
      // Update page title
      document.getElementById('pageTitle').textContent = screens[screenId] || 'Siva Lathe Works';
      
      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('overlay').classList.remove('active');
      
      // Refresh data for specific screens
      if (screenId === 'dashboard') refreshDashboard();
      if (screenId === 'history') refreshJobHistory();
      if (screenId === 'reports') refreshJobReports();
      if (screenId === 'payment-report') refreshPaymentReport();
      if (screenId === 'customers') refreshCustomerList();
      if (screenId === 'worktypes') refreshWorkTypeList();
    }

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

    // ===== PAYMENT ENTRY =====
    let paymentSelectedCustomer = null;

    function updatePaymentCoverageFields() {
      const coverageType = document.getElementById('paymentCoverageType');
      const fields = document.querySelectorAll('.payment-coverage-group');
      if (!coverageType) return;

      fields.forEach(field => {
        field.classList.toggle('visible', field.dataset.coverage === coverageType.value);
      });

      // Update month-wise balance display when coverage type changes
      if (paymentSelectedCustomer && coverageType.value === 'month') {
        const monthInput = document.getElementById('paymentForMonth');
        const selectedMonth = monthInput?.value;
        if (selectedMonth) {
          const monthlyBalances = calculateMonthlyBalances(paymentSelectedCustomer.id);
          const selectedMonthData = monthlyBalances.find(m => m.monthKey === selectedMonth);
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
        if (markMonthField) markMonthField.style.display = 'none';
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

      if (!table) return;

      if (monthlyBalances.length === 0) {
        table.innerHTML = '<div style="color: var(--text-muted);">No transactions for this customer yet.</div>';
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
        ${monthlyBalances.map(month => `
          <div style="display: grid; grid-template-columns: 120px 1fr 1fr 1fr; gap: var(--space-sm); padding: 8px 0; border-bottom: 1px solid var(--border-light);">
            <div>${month.monthLabel}</div>
            <div style="text-align: right; color: var(--text-secondary);">${formatCurrency(month.totalNet)}</div>
            <div style="text-align: right; color: var(--text-secondary);">${formatCurrency(month.paidFromJobs + month.paidFromPayments)}</div>
            <div style="text-align: right; font-weight: 600; color: ${month.balance > 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">${formatCurrency(month.balance)}</div>
          </div>
        `).join('')}
      `;

      // Show mark-as-paid option if coverage is month type
      if (document.getElementById('paymentCoverageType').value === 'month') {
        const monthInput = document.getElementById('paymentForMonth');
        const selectedMonth = monthInput?.value;
        if (selectedMonth) {
          const selectedMonthData = monthlyBalances.find(m => m.monthKey === selectedMonth);
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
        () => getActiveCustomers().filter(c => c.type !== 'Cash'),
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
            display.innerHTML = `<span class="badge badge-green">No pending balance</span>`;
          }

          // Show month-wise balance breakdown
          updateMonthBalanceDisplay(customer.id);
        },
        (customer) => {
          const balance = calculateCustomerBalance(customer.id);
          const balanceHtml = balance !== 0 
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
      document.querySelectorAll('.payment-mode').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.payment-mode').forEach(b => b.classList.remove('active'));
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
          if (paymentSelectedCustomer && document.getElementById('paymentCoverageType').value === 'month') {
            const selectedMonth = paymentForMonth.value;
            const monthlyBalances = calculateMonthlyBalances(paymentSelectedCustomer.id);
            const selectedMonthData = monthlyBalances.find(m => m.monthKey === selectedMonth);
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

      const currentCustomer = getCustomers().find(customer => customer.id === paymentSelectedCustomer.id);
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
        notes: document.getElementById('paymentNotes').value || ''
      };
      
      const savedPayment = savePayment(payment);

      // Handle marking entire month as paid if checkbox is checked
      const markMonthAsPaid = document.getElementById('markMonthAsPaid');
      if (coverageType === 'month' && markMonthAsPaid && markMonthAsPaid.checked) {
        const jobs = getJobs().filter(j => j.customerId === paymentSelectedCustomer.id && j.date.startsWith(paymentForMonth));
        if (jobs.length > 0) {
          jobs.forEach(job => {
            job.paymentStatus = 'Paid';
            job.paidAmount = job.netAmount;
            job.paymentMode = activeMode ? activeMode.dataset.mode : 'Cash';
          });
          const allJobs = getJobs();
          // Update only the jobs that were modified
          jobs.forEach(modifiedJob => {
            const index = allJobs.findIndex(j => j.id === modifiedJob.id);
            if (index >= 0) {
              allJobs[index] = modifiedJob;
            }
          });
          localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(allJobs));
        }
      }

      const newBalance = calculateCustomerBalance(paymentSelectedCustomer.id);
      const coverageLabel = coverageType === 'single'
        ? `for ${formatDate(paymentForDate)}`
        : coverageType === 'range'
          ? `for ${formatDate(paymentForFromDate)} to ${formatDate(paymentForToDate)}`
          : `for ${paymentForMonth || '-'}`;
      showToast('Payment Recorded', `${paymentSelectedCustomer.name} ${coverageLabel} — Pending: ${formatCurrency(newBalance)}`);

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
      document.querySelectorAll('.payment-mode').forEach(b => b.classList.remove('active'));
      document.querySelector('.payment-mode[data-mode="Cash"]').classList.add('active');
      updatePaymentCoverageFields();
    }

    // ===== DASHBOARD =====
    function calculateCustomerBalance(customerId) {
      const jobs = getJobs().filter(j => j.customerId === customerId);
      const payments = getPayments().filter(p => p.customerId === customerId);
      
      const totalNet = jobs.reduce((sum, j) => sum + getJobNetValue(j), 0);
      const totalPaidFromJobs = jobs.reduce((sum, j) => sum + getJobPaidAmount(j), 0);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

      return totalNet - totalPaidFromJobs - totalPaid;
    }

    function calculateMonthlyBalances(customerId) {
      const jobs = getJobs().filter(j => j.customerId === customerId);
      const payments = getPayments().filter(p => p.customerId === customerId);

      const monthMap = {};

      // Group jobs by month
      jobs.forEach(job => {
        const monthKey = job.date.substring(0, 7); // YYYY-MM
        if (!monthMap[monthKey]) {
          monthMap[monthKey] = {
            monthKey,
            monthLabel: formatDate(monthKey + '-01').substring(0, 7), // Just month-year
            totalNet: 0,
            paidFromJobs: 0,
            paidFromPayments: 0,
            balance: 0,
            jobs: []
          };
        }
        monthMap[monthKey].totalNet += getJobNetValue(job);
        monthMap[monthKey].paidFromJobs += getJobPaidAmount(job);
        monthMap[monthKey].jobs.push(job);
      });

      // Add payments to their respective months
      payments.forEach(payment => {
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
      Object.values(monthMap).forEach(month => {
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
      document.getElementById('dailyMeta').textContent = `${dailySummary.jobs} jobs · Received ${formatCurrency(dailySummary.received)} · Pending ${formatCurrency(dailySummary.pending)}`;
      document.getElementById('weeklyNet').textContent = formatCurrency(weeklySummary.net);
      document.getElementById('weeklyMeta').textContent = `${weeklySummary.jobs} jobs · Received ${formatCurrency(weeklySummary.received)} · Pending ${formatCurrency(weeklySummary.pending)}`;
      document.getElementById('monthlyNet').textContent = formatCurrency(monthlySummary.net);
      document.getElementById('monthlyMeta').textContent = `${monthlySummary.jobs} jobs · Received ${formatCurrency(monthlySummary.received)} · Pending ${formatCurrency(monthlySummary.pending)}`;

      document.getElementById('dashTotalBilled').textContent = formatCurrency(totalSummary.billed);
      document.getElementById('dashTotalCommission').textContent = formatCurrency(totalSummary.commission);
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
        { type: 'Party-Credit', valueId: 'typePendingPartyCredit', metaId: 'typePendingPartyCreditMeta' }
      ];

      typeConfigs.forEach(({ type, valueId, metaId }) => {
        const activeCustomers = customers.filter(customer => customer.type === type);
        const customerIds = new Set(activeCustomers.map(customer => customer.id));
        const typeJobs = jobs.filter(job => customerIds.has(job.customerId));
        const typePayments = payments.filter(payment => customerIds.has(payment.customerId));

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
        .filter(c => c.type !== 'Cash')
        .filter(c => filterType === 'all' || c.type === filterType)
        .map(customer => {
          const custJobs = jobs.filter(j => j.customerId === customer.id);
          const custPayments = payments.filter(p => p.customerId === customer.id);
          
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
            pending
          };
        })
        .filter(c => c.billed > 0 || c.paid > 0) // Only show customers with activity
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
      
      tbody.innerHTML = customerData.map(c => {
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
        const commissionPaidClass = commissionPaid === 'Paid' ? 'badge-green' : commissionPaid === 'Pending' ? 'badge-orange' : 'badge-blue';
        
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
      }).join('');
    }

    function updatePendingBadge() {
      const jobs = getJobs();
      const payments = getPayments();
      
      const totalNet = jobs.reduce((sum, j) => sum + getJobNetValue(j), 0);
      const totalPaid = jobs.reduce((sum, j) => sum + getJobPaidAmount(j), 0) + payments.reduce((sum, p) => sum + p.amount, 0);
      const totalPending = totalNet - totalPaid;
      
      document.getElementById('pending-badge').textContent = formatCurrency(totalPending);
    }

    // ===== JOB HISTORY =====
    function refreshJobHistory() {
      const jobs = getJobs();
      const customers = getCustomers();

      // Populate customer filter
      const customerFilter = document.getElementById('historyCustomer');
      customerFilter.innerHTML = '<option value="">All Customers</option>' +
        customers
          .map(c => `<option value="${c.id}">${c.name}${c.isActive === false ? ' (Inactive)' : ''}</option>`)
          .join('');

      // Set default dates (last 30 days) only if inputs are empty
      const fromDateInput = document.getElementById('historyFromDate');
      const toDateInput = document.getElementById('historyToDate');
      const fromMonthInput = document.getElementById('historyFromMonth');
      const toMonthInput = document.getElementById('historyToMonth');

      if (!fromDateInput.value && !toDateInput.value) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        fromDateInput.value = getLocalDateString(thirtyDaysAgo);
        toDateInput.value = getLocalDateString(today);
      }

      // Set max constraints
      const today = getLocalDateString();
      const currentMonth = getMonthInputString();
      fromDateInput.max = today;
      toDateInput.max = today;
      if (fromMonthInput) fromMonthInput.max = currentMonth;
      if (toMonthInput) toMonthInput.max = currentMonth;

      renderJobHistory(jobs);
    }

    function renderJobHistory(jobs) {
      const fromDate = document.getElementById('historyFromDate').value;
      const toDate = document.getElementById('historyToDate').value;
      const customerId = document.getElementById('historyCustomer').value;
      
      let filtered = jobs;
      
      if (fromDate) {
        filtered = filtered.filter(j => j.date >= fromDate);
      }
      if (toDate) {
        filtered = filtered.filter(j => j.date <= toDate);
      }
      if (customerId) {
        filtered = filtered.filter(j => j.customerId === parseInt(customerId));
      }
      
      filtered = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      const tbody = document.getElementById('jobHistoryTable');
      
      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
              No jobs found for the selected filters.
            </td>
          </tr>
        `;
        return;
      }
      
      tbody.innerHTML = filtered.map(j => `
        <tr>
          <td class="amount">#${j.id}</td>
          <td>${formatDate(j.date)}</td>
          <td><strong>${j.customerName}</strong></td>
          <td><span class="spot-badge">${getJobWorkMode(j)}</span></td>
          <td>${getJobWorkName(j)}</td>
          <td style="text-align: center;">${j.quantity}</td>
          <td style="text-align: right;" class="amount">${formatCurrency(j.amount)}</td>
          <td style="text-align: right;" class="amount positive">${formatCurrency(getJobNetValue(j))}</td>
          <td>
            <span class="badge ${getJobPaymentStatus(j) === 'Paid' ? 'badge-green' : 'badge-red'}">${getJobPaymentStatus(j)}</span>
            <div class="table-subtext">${getJobPaymentMode(j)}</div>
          </td>
          <td>
            <div>${j.dcNo || '-'}</div>
            <div class="table-subtext">${j.vehicleNo || '-'}</div>
            <div class="table-subtext">${j.dcDate ? formatDate(j.dcDate) : '-'}</div>
          </td>
        </tr>
      `).join('');
    }

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

    function refreshWorkTypeList() {
      const showInactive = document.getElementById('showInactiveWorkTypes')?.checked;
      const workTypes = getWorkTypes()
        .filter(wt => showInactive ? true : wt.isActive !== false)
        .sort((a, b) => {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        return a.name.localeCompare(b.name);
      });
      
      const tbody = document.getElementById('workTypeListTable');
      
      tbody.innerHTML = workTypes.map(wt => {
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
      }).join('');
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

      container.innerHTML = jobs.map(job => {
        const dcStatus = getJobDcStatus(job);
        const dcBadge = dcStatus === 'Completed'
          ? '<span class="badge badge-green">DC Ready</span>'
          : dcStatus === 'Pending DC'
            ? '<span class="badge badge-orange">DC Pending</span>'
            : '';
        const actionButton = (!job.jobCardLine || job.jobCardLine === 1)
          ? `<button type="button" class="btn btn-secondary btn-small job-action-btn" data-edit-jobkey="${getJobGroupKey(job)}">Edit</button>`
          : '';

        return `
          <div class="job-item">
            <span class="job-number">#${job.id}</span>
            <div class="job-details">
              <div class="job-customer">${job.customerName}</div>
              <div class="job-work">
                <span class="spot-badge">${getJobWorkMode(job)}</span>
                ${dcBadge}
                ${getJobWorkName(job)} x ${job.quantity}
              </div>
            </div>
            <div class="job-item-actions">
              <div style="text-align: right;">
                <div class="job-amount">${formatCurrency(job.amount)}</div>
                <div class="job-net">${getJobPaymentStatus(job)}${getJobPaidAmount(job) > 0 ? ` · ${getJobPaymentMode(job)}` : ''}</div>
              </div>
              ${actionButton}
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('[data-edit-jobkey]').forEach(btn => {
        btn.addEventListener('click', () => editJobCard(btn.dataset.editJobkey));
      });
    }

    function renderJobHistory(jobs) {
      const fromDate = document.getElementById('historyFromDate').value;
      const toDate = document.getElementById('historyToDate').value;
      const customerId = document.getElementById('historyCustomer').value;

      let filtered = jobs;

      if (fromDate) {
        filtered = filtered.filter(j => j.date >= fromDate);
      }
      if (toDate) {
        filtered = filtered.filter(j => j.date <= toDate);
      }
      if (customerId) {
        filtered = filtered.filter(j => j.customerId === parseInt(customerId));
      }

      filtered = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

      const tbody = document.getElementById('jobHistoryTable');

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="11" style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
              No jobs found for the selected filters.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map(j => {
        const dcStatus = getJobDcStatus(j);
        const dcCell = jobHasDcDetails(j)
          ? `
            <div>${j.dcNo || '-'}</div>
            <div class="table-subtext">${j.vehicleNo || '-'}</div>
            <div class="table-subtext">${j.dcDate ? formatDate(j.dcDate) : '-'}</div>
          `
          : `
            <span class="badge ${dcStatus === 'Pending DC' ? 'badge-orange' : 'badge-green'}">${dcStatus}</span>
            <div class="table-subtext">${j.dcApproval ? 'Approved without DC' : 'No DC details yet'}</div>
          `;
        const actionButton = (!j.jobCardLine || j.jobCardLine === 1)
          ? `<button type="button" class="btn btn-secondary btn-small job-action-btn" data-edit-jobkey="${getJobGroupKey(j)}">Edit</button>`
          : '';

        return `
          <tr>
            <td class="amount">#${j.id}</td>
            <td>${formatDate(j.date)}</td>
            <td><strong>${j.customerName}</strong></td>
            <td><span class="spot-badge">${getJobWorkMode(j)}</span></td>
            <td>${getJobWorkName(j)}</td>
            <td style="text-align: center;">${j.quantity}</td>
            <td style="text-align: right;" class="amount">${formatCurrency(j.amount)}</td>
            <td style="text-align: right;" class="amount positive">${formatCurrency(getJobNetValue(j))}</td>
            <td>
              <span class="badge ${getJobPaymentStatus(j) === 'Paid' ? 'badge-green' : 'badge-red'}">${getJobPaymentStatus(j)}</span>
              <div class="table-subtext">${getJobPaymentMode(j)}</div>
            </td>
            <td>${dcCell}</td>
            <td class="table-action-cell">${actionButton}</td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('[data-edit-jobkey]').forEach(btn => {
        btn.addEventListener('click', () => editJobCard(btn.dataset.editJobkey));
      });
    }

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', () => {
      // Initialize data
      initializeData();
      
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
        to: getLocalDateString(today)
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
      if (!select) return;

      const customers = getCustomers();
      select.innerHTML = '<option value="">All Clients</option>' +
        customers.map(customer => `<option value="${customer.id}">${customer.name}${customer.isActive === false ? ' (Inactive)' : ''}</option>`).join('');
    }

    function updateReportModeState() {
      const mode = document.getElementById('reportMode').value;
      const customerSelect = document.getElementById('reportCustomer');
      if (!customerSelect) return;
      customerSelect.disabled = mode !== 'client';
      customerSelect.style.opacity = mode === 'client' ? '1' : '0.6';
    }

    function getReportCustomer() {
      const customerId = document.getElementById('reportCustomer').value;
      if (!customerId) return null;
      return getCustomers().find(customer => customer.id === parseInt(customerId, 10)) || null;
    }

    function getFilteredReportGroups() {
      const period = document.getElementById('reportPeriod').value;
      const fromDateInput = document.getElementById('reportFromDate').value;
      const toDateInput = document.getElementById('reportToDate').value;
      const reportMode = document.getElementById('reportMode').value;
      const reportCustomer = getReportCustomer();
      const fallbackRange = getReportRange(period);
      const fromDate = fromDateInput || fallbackRange.from;
      const toDate = toDateInput || fallbackRange.to;
      let filteredJobs = getJobs().filter(job => isDateInRange(job.date, fromDate, toDate));

      if (reportMode === 'client' && reportCustomer) {
        filteredJobs = filteredJobs.filter(job => job.customerId === reportCustomer.id);
      }

      const groups = groupJobsByCard(filteredJobs);
      return { groups, fromDate, toDate, period, reportMode, reportCustomer };
    }

    function refreshJobReports() {
      const summaryGrid = document.getElementById('reportSummaryGrid');
      const tableBody = document.getElementById('reportTableBody');
      if (!summaryGrid || !tableBody) return;

      const { groups, fromDate, toDate, period, reportMode, reportCustomer } = getFilteredReportGroups();
      const jobs = groups.flatMap(group => group.jobs);
      const totalAmount = groups.reduce((sum, group) => sum + group.totalAmount, 0);
      const totalNet = groups.reduce((sum, group) => sum + group.totalNet, 0);
      const totalCommission = groups.reduce((sum, group) => sum + group.totalCommission, 0);
      const paid = jobs.reduce((sum, job) => sum + getJobPaidAmount(job), 0);
      const pending = totalNet - paid;
      const clientLabel = reportMode === 'client'
        ? (reportCustomer ? reportCustomer.name : 'Select client')
        : 'All Clients';

      summaryGrid.innerHTML = `
        <div class="report-summary-card">
          <span class="report-summary-label">Period</span>
          <strong class="report-summary-value">${period.toUpperCase()}</strong>
          <span class="report-summary-meta">${formatDate(fromDate)} to ${formatDate(toDate)}</span>
        </div>
        <div class="report-summary-card">
          <span class="report-summary-label">Scope</span>
          <strong class="report-summary-value">${clientLabel}</strong>
          <span class="report-summary-meta">${reportMode === 'client' ? 'Client-wise report' : 'All jobcards'}</span>
        </div>
        <div class="report-summary-card">
          <span class="report-summary-label">Jobcards</span>
          <strong class="report-summary-value">${groups.length}</strong>
          <span class="report-summary-meta">${jobs.length} job lines</span>
        </div>
        <div class="report-summary-card">
          <span class="report-summary-label">Billed</span>
          <strong class="report-summary-value">${formatCurrency(totalAmount)}</strong>
          <span class="report-summary-meta">Commission ${formatCurrency(totalCommission)}</span>
        </div>
        <div class="report-summary-card">
          <span class="report-summary-label">Net / Pending</span>
          <strong class="report-summary-value">${formatCurrency(totalNet)}</strong>
          <span class="report-summary-meta">Pending ${formatCurrency(pending)}</span>
        </div>
      `;

      if (reportMode === 'client' && !reportCustomer) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align:center; padding: var(--space-xl); color: var(--text-muted);">Select a client to generate the report.</td>
          </tr>
        `;
        return;
      }

      if (groups.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align:center; padding: var(--space-xl); color: var(--text-muted);">No jobcards found for this range.</td>
          </tr>
        `;
        return;
      }

      const sortedGroups = groups.sort((a, b) => new Date(b.primary.date) - new Date(a.primary.date));
      tableBody.innerHTML = sortedGroups.map(group => {
        const job = group.primary;
        const dcStatus = getJobDcStatus(job);
        const lineNames = group.jobs.map(line => line.workTypeName || line.workName || 'Job').join(', ');
        const payment = `${getJobPaymentStatus(job)}${getJobPaidAmount(job) > 0 ? ` / ${getJobPaymentMode(job)}` : ''}`;
        const groupKey = `group-${group.key}`.replace(/[^a-z0-9\-]/gi, '_');

        const mainRow = `
          <tr class="report-main-row" data-group-key="${groupKey}">
            <td><strong>${job.jobCardId || group.key}</strong></td>
            <td>${formatDate(job.date)}</td>
            <td>${job.customerName}</td>
            <td style="text-align:center;">${group.lineCount}</td>
            <td>
              <button type="button" class="btn btn-text btn-small expand-group-btn" data-group-key="${groupKey}" title="Expand/collapse job details" style="padding: 2px 0; margin-right: 4px; font-weight: 600;">▸</button>
              ${lineNames}
            </td>
            <td style="text-align:right;" class="amount">${formatCurrency(group.totalAmount)}</td>
            <td style="text-align:right;" class="amount positive">${formatCurrency(group.totalNet)}</td>
            <td>${payment}</td>
            <td><span class="badge ${dcStatus === 'Completed' ? 'badge-green' : dcStatus === 'Pending DC' ? 'badge-orange' : 'badge-blue'}">${dcStatus}</span></td>
          </tr>
        `;

        const subRows = group.jobs.map((line, idx) => {
          const lineCommission = line.commissionInput > 0
            ? (line.commissionInput > 1 ? line.commissionInput : Math.round(line.amount * line.commissionInput))
            : 0;
          const lineNet = Math.max(0, line.amount - lineCommission);

          return `
            <tr class="report-sub-row" data-group-key="${groupKey}" style="display: none; background: var(--bg-tertiary);">
              <td style="color: var(--text-muted); font-size: 12px;">└─ Line ${idx + 1}</td>
              <td colspan="2">${line.workTypeName || line.workName || 'Job'}</td>
              <td style="text-align: center; font-size: 13px;">${line.quantity}</td>
              <td style="text-align: right;" class="amount" title="Qty × Rate">${formatCurrency(line.amount)}</td>
              <td style="text-align: right;" class="amount" title="Commission"><span style="font-size: 12px;">${formatCurrency(lineCommission)}</span></td>
              <td style="text-align: right;" class="amount positive">${formatCurrency(lineNet)}</td>
              <td colspan="2"></td>
            </tr>
          `;
        }).join('');

        return mainRow + subRows;
      }).join('');

      // Wire up expand buttons
      tableBody.querySelectorAll('.expand-group-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const groupKey = btn.dataset.groupKey;
          const subRows = tableBody.querySelectorAll(`.report-sub-row[data-group-key="${groupKey}"]`);
          const isExpanded = subRows[0]?.style.display !== 'none';

          subRows.forEach(row => {
            row.style.display = isExpanded ? 'none' : 'table-row';
          });

          btn.textContent = isExpanded ? '▸' : '▾';
        });
      });
    }

    function exportJobReportsAsExcel() {
      const { groups, fromDate, toDate, period, reportMode, reportCustomer } = getFilteredReportGroups();
      if (reportMode === 'client' && !reportCustomer) {
        showToast('Report', 'Select a client first', 'error');
        return;
      }
      const rows = [
        ['Jobcard', 'Date', 'Customer', 'Lines', 'Jobs', 'Amount', 'Net', 'Payment', 'DC Status']
      ];

      groups.forEach(group => {
        const job = group.primary;
        rows.push([
          job.jobCardId || group.key,
          job.date,
          job.customerName,
          String(group.lineCount),
          group.jobs.map(line => line.workTypeName || line.workName || 'Job').join(' | '),
          String(group.totalAmount),
          String(group.totalNet),
          `${getJobPaymentStatus(job)}${getJobPaidAmount(job) > 0 ? ` / ${getJobPaymentMode(job)}` : ''}`,
          getJobDcStatus(job)
        ]);
      });

      const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join('\t')).join('\n');
      const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const clientSlug = reportCustomer ? reportCustomer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'all-clients';
      link.download = `job-report-${period}-${clientSlug}-${fromDate}-to-${toDate}.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function exportJobReportsAsPdf() {
      switchScreen('reports');
      setTimeout(() => window.print(), 150);
    }

    function shareJobReportsToWhatsApp() {
      const { groups, fromDate, toDate, period, reportMode, reportCustomer } = getFilteredReportGroups();
      if (reportMode === 'client' && !reportCustomer) {
        showToast('Report', 'Select a client first', 'error');
        return;
      }
      const totalAmount = groups.reduce((sum, group) => sum + group.totalAmount, 0);
      const totalNet = groups.reduce((sum, group) => sum + group.totalNet, 0);
      const message = [
        `Siva Lathe Works Job Report`,
        `Period: ${period.toUpperCase()} (${fromDate} to ${toDate})`,
        `Scope: ${reportMode === 'client' && reportCustomer ? reportCustomer.name : 'All Clients'}`,
        `Jobcards: ${groups.length}`,
        `Billed: ${formatCurrency(totalAmount)}`,
        `Net: ${formatCurrency(totalNet)}`
      ].join('\n');
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    }

    function clearAllJobCards() {
      const confirmed = window.confirm('Clear all saved job cards? This will remove every job entry but keep customers, work types, and payments.');
      if (!confirmed) return;

      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify([]));
      refreshTodaysJobs();
      refreshJobHistory();
      refreshDashboard();
      refreshJobReports();
      updateTodayStats();
      updatePendingBadge();
      showToast('Jobs Cleared', 'All saved job cards have been removed');
    }

    function refreshPaymentReport() {
      const summaryGrid = document.getElementById('paymentSummaryGrid');
      const tableBody = document.getElementById('paymentReportTable');
      const customerSelect = document.getElementById('paymentReportCustomer');
      if (!summaryGrid || !tableBody || !customerSelect) return;

      const customers = getCustomers();
      customerSelect.innerHTML = '<option value="">All Customers</option>' +
        customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

      const fromDate = document.getElementById('paymentReportFromDate').value || getLocalDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      const toDate = document.getElementById('paymentReportToDate').value || getLocalDateString();
      const customerId = customerSelect.value;

      let payments = getPayments().filter(p => p.date >= fromDate && p.date <= toDate);
      if (customerId) {
        payments = payments.filter(p => p.customerId === parseInt(customerId, 10));
      }

      payments = payments.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Calculate summary
      const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
      const byMode = {};
      payments.forEach(p => {
        byMode[p.paymentMode] = (byMode[p.paymentMode] || 0) + p.amount;
      });

      summaryGrid.innerHTML = `
        <div class="report-summary-card">
          <span class="report-summary-label">Total Collected</span>
          <strong class="report-summary-value">${formatCurrency(totalAmount)}</strong>
          <span class="report-summary-meta">${payments.length} payments</span>
        </div>
        ${Object.entries(byMode).map(([mode, amount]) => `
          <div class="report-summary-card">
            <span class="report-summary-label">${mode}</span>
            <strong class="report-summary-value">${formatCurrency(amount)}</strong>
            <span class="report-summary-meta">${mode}</span>
          </div>
        `).join('')}
      `;

      if (payments.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
              No payments found for the selected period.
            </td>
          </tr>
        `;
        return;
      }

      tableBody.innerHTML = payments.map(payment => {
        const coverageLabel = payment.paymentCoverageType === 'single'
          ? `${formatDate(payment.paymentForDate)}`
          : payment.paymentCoverageType === 'range'
            ? `${formatDate(payment.paymentForFromDate)} to ${formatDate(payment.paymentForToDate)}`
            : payment.paymentCoverageType === 'month'
              ? payment.paymentForMonth
              : '-';

        return `
          <tr>
            <td>${formatDate(payment.date)}</td>
            <td><strong>${payment.customerName}</strong></td>
            <td style="text-align: right;" class="amount">${formatCurrency(payment.amount)}</td>
            <td>${payment.paymentMode}</td>
            <td>${coverageLabel}</td>
            <td>${payment.notes || '-'}</td>
            <td style="text-align: center;">
              <button type="button" class="btn btn-secondary btn-small" data-delete-payment="${payment.id}">Delete</button>
            </td>
          </tr>
        `;
      }).join('');

      tableBody.querySelectorAll('[data-delete-payment]').forEach(btn => {
        btn.addEventListener('click', () => {
          const paymentId = parseInt(btn.dataset.deletePayment, 10);
          deletePayment(paymentId);
        });
      });
    }

    function deletePayment(paymentId) {
      const confirmed = window.confirm('Delete this payment record?');
      if (!confirmed) return;

      const payments = getPayments().filter(p => p.id !== paymentId);
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
      refreshPaymentReport();
      updatePendingBadge();
      refreshDashboard();
      showToast('Payment Deleted', 'Payment record has been removed');
    }

    function refreshRecentPayments() {
      const container = document.getElementById('recentPaymentsList');
      if (!container) return;

      const payments = getPayments().slice(-10).reverse(); // Last 10 payments, newest first

      if (payments.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <path d="M2 10h20"/>
            </svg>
            <h3>No payments recorded</h3>
            <p>Payments you record will appear here</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="data-table-wrapper">
          <table class="data-table" style="margin: 0;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(payment => {
                const coverageLabel = payment.paymentCoverageType === 'single' ? formatDate(payment.paymentForDate)
                  : payment.paymentCoverageType === 'range' ? `${formatDate(payment.paymentForFromDate)} to ${formatDate(payment.paymentForToDate)}`
                  : payment.paymentCoverageType === 'month' ? payment.paymentForMonth
                  : '-';

                return `
                  <tr>
                    <td>${formatDate(payment.date)}</td>
                    <td><strong>${payment.customerName}</strong></td>
                    <td style="text-align: right;" class="amount">${formatCurrency(payment.amount)}</td>
                    <td>${payment.paymentMode}</td>
                    <td>${coverageLabel}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function openMasterModal(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) return;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
    }

    function closeMasterModal(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) return;
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }

    function syncCurrentCustomerSelection(updatedCustomer) {
      if (selectedCustomer && selectedCustomer.id === updatedCustomer.id) {
        if (updatedCustomer.isActive === false) {
          selectedCustomer = null;
          document.getElementById('customerSearch').value = '';
          document.getElementById('selectedCustomerId').value = '';
          setDcFieldVisibility(false);
          setDcApprovalVisibility(false);
          updateJobReview();
        } else {
          selectedCustomer = updatedCustomer;
          document.getElementById('customerSearch').value = updatedCustomer.name;
          document.getElementById('selectedCustomerId').value = updatedCustomer.id;
          setDcFieldVisibility(customerNeedsDc(updatedCustomer));
          setDcApprovalVisibility(customerNeedsDc(updatedCustomer));
          updateJobReview();
        }
      }

      if (paymentSelectedCustomer && paymentSelectedCustomer.id === updatedCustomer.id) {
        if (updatedCustomer.isActive === false) {
          paymentSelectedCustomer = null;
          document.getElementById('paymentCustomerSearch').value = '';
          document.getElementById('paymentSelectedCustomerId').value = '';
          document.getElementById('customerPendingDisplay').innerHTML = '';
        } else {
          paymentSelectedCustomer = updatedCustomer;
          document.getElementById('paymentCustomerSearch').value = updatedCustomer.name;
          document.getElementById('paymentSelectedCustomerId').value = updatedCustomer.id;
        }
      }
    }

    function syncCurrentWorkTypeSelection(updatedWorkType) {
      document.querySelectorAll('.job-line').forEach(row => {
        if (!row._selectedWorkType || row._selectedWorkType.id !== updatedWorkType.id) return;
        row._selectedWorkType = updatedWorkType;
        const lineId = row.dataset.lineId;
        const search = document.getElementById(`jobLineWorkSearch-${lineId}`);
        const hidden = document.getElementById(`jobLineWorkTypeId-${lineId}`);
        if (search) search.value = updatedWorkType.name;
        if (hidden) hidden.value = updatedWorkType.id;
        updateJobLineSuggestion(lineId);
      });
      updateJobReview();
    }

    function cascadeCustomerNameChange(customerId, customerName) {
      const jobs = getJobs().map(job => (
        job.customerId === customerId
          ? { ...job, customerName }
          : job
      ));
      const payments = getPayments().map(payment => (
        payment.customerId === customerId
          ? { ...payment, customerName }
          : payment
      ));

      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
    }

    function cascadeWorkTypeNameChange(workTypeId, workTypeName) {
      const jobs = getJobs().map(job => (
        job.workTypeId === workTypeId
          ? { ...job, workTypeName, workName: workTypeName }
          : job
      ));

      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    }

    function openCustomerModal(customerId = null) {
      const customers = getCustomers();
      const current = customerId ? customers.find(customer => customer.id === customerId) : null;
      editingCustomerId = current ? current.id : null;

      document.getElementById('customerModalTitle').textContent = current ? 'Edit Customer' : 'Add Customer';
      document.getElementById('customerModalSubtitle').textContent = current
        ? 'Update the master customer record.'
        : 'Create a new customer master record.';
      document.getElementById('customerFormId').value = current ? current.id : '';
      document.getElementById('customerName').value = current ? current.name || '' : '';
      document.getElementById('customerShortCode').value = current ? current.shortCode || '' : '';
      document.getElementById('customerType').value = current ? current.type || 'Monthly' : 'Monthly';
      document.getElementById('customerHasCommission').checked = current ? !!current.hasCommission : false;
      document.getElementById('customerRequiresDc').checked = current ? !!current.requiresDc : false;
      document.getElementById('customerIsActive').checked = current ? current.isActive !== false : true;
      document.getElementById('customerNotes').value = current ? current.notes || '' : '';

      const deleteBtn = document.getElementById('deleteCustomerBtn');
      if (deleteBtn) {
        deleteBtn.style.display = current ? 'inline-flex' : 'none';
        deleteBtn.textContent = current && current.isActive === false ? 'Restore' : 'Delete';
      }

      openMasterModal('customerModal');
    }

    function openWorkTypeModal(workTypeId = null) {
      const workTypes = getWorkTypes();
      const current = workTypeId ? workTypes.find(workType => workType.id === workTypeId) : null;
      editingWorkTypeId = current ? current.id : null;

      document.getElementById('workTypeModalTitle').textContent = current ? 'Edit Work Type' : 'Add Work Type';
      document.getElementById('workTypeModalSubtitle').textContent = current
        ? 'Update the master work type record.'
        : 'Create a new work type master record.';
      document.getElementById('workTypeFormId').value = current ? current.id : '';
      document.getElementById('workTypeCategory').value = current ? current.category || '' : '';
      document.getElementById('workTypeName').value = current ? current.name || '' : '';
      document.getElementById('workTypeShortCode').value = current ? current.shortCode || '' : '';
      document.getElementById('workTypeDefaultUnit').value = current ? current.defaultUnit || '' : '';
      document.getElementById('workTypeDefaultRate').value = current ? current.defaultRate || 0 : 0;
      document.getElementById('workTypeIsActive').checked = current ? current.isActive !== false : true;

      const deleteBtn = document.getElementById('deleteWorkTypeBtn');
      if (deleteBtn) {
        deleteBtn.style.display = current ? 'inline-flex' : 'none';
        deleteBtn.textContent = current && current.isActive === false ? 'Restore' : 'Delete';
      }

      openMasterModal('workTypeModal');
    }

    function saveCustomerFromModal(e) {
      e.preventDefault();

      const name = document.getElementById('customerName').value.trim();
      const shortCode = document.getElementById('customerShortCode').value.trim();
      const type = document.getElementById('customerType').value.trim();
      const notes = document.getElementById('customerNotes').value.trim();
      const hasCommission = document.getElementById('customerHasCommission').checked;
      const requiresDc = document.getElementById('customerRequiresDc').checked;
      const isActive = document.getElementById('customerIsActive').checked;
      const id = parseInt(document.getElementById('customerFormId').value, 10);

      if (!name) {
        showToast('Error', 'Please enter a customer name', 'error');
        return;
      }
      if (!type) {
        showToast('Error', 'Please select a customer type', 'error');
        return;
      }

      const customers = getCustomers();
      const currentIndex = customers.findIndex(customer => customer.id === id);
      const current = currentIndex >= 0 ? customers[currentIndex] : null;
      const record = {
        id: currentIndex >= 0 ? customers[currentIndex].id : getNextMasterId(customers),
        name,
        shortCode,
        type,
        hasCommission,
        requiresDc,
        notes,
        isActive
      };

      if (currentIndex >= 0) {
        customers[currentIndex] = record;
      } else {
        customers.push(record);
      }

      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
      if (!current || current.name !== record.name) {
        cascadeCustomerNameChange(record.id, record.name);
      }
      syncCurrentCustomerSelection(record);
      refreshTodaysJobs();
      refreshCustomerList();
      refreshDashboard();
      refreshJobHistory();
      refreshJobReports();
      updatePendingBadge();
      closeMasterModal('customerModal');
      showToast(currentIndex >= 0 ? 'Customer Updated' : 'Customer Added', `${record.name} saved`);
    }

    function saveWorkTypeFromModal(e) {
      e.preventDefault();

      const category = document.getElementById('workTypeCategory').value.trim();
      const name = document.getElementById('workTypeName').value.trim();
      const shortCode = document.getElementById('workTypeShortCode').value.trim();
      const defaultUnit = document.getElementById('workTypeDefaultUnit').value.trim();
      const defaultRate = Number(document.getElementById('workTypeDefaultRate').value) || 0;
      const isActive = document.getElementById('workTypeIsActive').checked;
      const id = parseInt(document.getElementById('workTypeFormId').value, 10);

      if (!category) {
        showToast('Error', 'Please enter a category', 'error');
        return;
      }
      if (!name) {
        showToast('Error', 'Please enter a work type name', 'error');
        return;
      }

      const workTypes = getWorkTypes();
      const currentIndex = workTypes.findIndex(workType => workType.id === id);
      const current = currentIndex >= 0 ? workTypes[currentIndex] : null;
      const record = {
        id: currentIndex >= 0 ? workTypes[currentIndex].id : getNextMasterId(workTypes),
        category,
        name,
        shortCode,
        defaultUnit,
        defaultRate,
        isActive
      };

      if (currentIndex >= 0) {
        workTypes[currentIndex] = record;
      } else {
        workTypes.push(record);
      }

      localStorage.setItem(STORAGE_KEYS.WORK_TYPES, JSON.stringify(workTypes));
      if (!current || current.name !== record.name) {
        cascadeWorkTypeNameChange(record.id, record.name);
      }
      syncCurrentWorkTypeSelection(record);
      refreshTodaysJobs();
      refreshWorkTypeList();
      refreshJobHistory();
      refreshJobReports();
      closeMasterModal('workTypeModal');
      showToast(currentIndex >= 0 ? 'Work Type Updated' : 'Work Type Added', `${record.name} saved`);
    }

    function setCustomerActiveState(customerId, active) {
      const customers = getCustomers();
      const index = customers.findIndex(customer => customer.id === customerId);
      if (index < 0) return;
      const customer = customers[index];
      customer.isActive = active;
      customers[index] = customer;
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
      syncCurrentCustomerSelection(customer);
      refreshCustomerList();
      refreshDashboard();
      refreshJobHistory();
      refreshJobReports();
      updatePendingBadge();
      showToast(active ? 'Customer Restored' : 'Customer Deleted', `${customer.name} ${active ? 'restored' : 'deactivated'}`);
    }

    function setWorkTypeActiveState(workTypeId, active) {
      const workTypes = getWorkTypes();
      const index = workTypes.findIndex(workType => workType.id === workTypeId);
      if (index < 0) return;
      const workType = workTypes[index];
      workType.isActive = active;
      workTypes[index] = workType;
      localStorage.setItem(STORAGE_KEYS.WORK_TYPES, JSON.stringify(workTypes));
      syncCurrentWorkTypeSelection(workType);
      refreshWorkTypeList();
      refreshJobReports();
      showToast(active ? 'Work Type Restored' : 'Work Type Deleted', `${workType.name} ${active ? 'restored' : 'deactivated'}`);
    }

    function editCustomer(customerId) {
      openCustomerModal(customerId);
    }

    function editWorkType(workTypeId) {
      openWorkTypeModal(workTypeId);
    }

    document.addEventListener('DOMContentLoaded', () => {
      initTheme();

      const reportPeriod = document.getElementById('reportPeriod');
      const reportMode = document.getElementById('reportMode');
      const reportCustomer = document.getElementById('reportCustomer');
      const themeToggle = document.getElementById('themeToggle');
      const applyReportFilter = document.getElementById('applyReportFilter');
      const reportExportExcel = document.getElementById('reportExportExcel');
      const reportExportPdf = document.getElementById('reportExportPdf');
      const reportWhatsapp = document.getElementById('reportWhatsapp');
      const clearJobCardsBtn = document.getElementById('clearJobCardsBtn');
      const customerListTable = document.getElementById('customerListTable');
      const workTypeListTable = document.getElementById('workTypeListTable');
      const addCustomerBtn = document.getElementById('addCustomerBtn');
      const addWorkTypeBtn = document.getElementById('addWorkTypeBtn');
      const showInactiveCustomers = document.getElementById('showInactiveCustomers');
      const showInactiveWorkTypes = document.getElementById('showInactiveWorkTypes');
      const customerForm = document.getElementById('customerForm');
      const workTypeForm = document.getElementById('workTypeForm');
      const deleteCustomerBtn = document.getElementById('deleteCustomerBtn');
      const deleteWorkTypeBtn = document.getElementById('deleteWorkTypeBtn');

      if (reportPeriod) {
        setReportPeriod('month');
        reportPeriod.addEventListener('change', () => {
          if (reportPeriod.value !== 'custom') {
            setReportPeriod(reportPeriod.value);
          }
          refreshJobReports();
        });
      }
      populateReportCustomers();
      updateReportModeState();

      // Set max date constraints to today for all date inputs
      const today = getLocalDateString();
      ['historyFromDate', 'historyToDate', 'reportFromDate', 'reportToDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.max = today;
      });

      if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
      }

      if (reportMode) {
        reportMode.addEventListener('change', () => {
          updateReportModeState();
          if (reportMode.value !== 'client') {
            if (reportCustomer) reportCustomer.value = '';
          }
          refreshJobReports();
        });
      }
      if (reportCustomer) {
        reportCustomer.addEventListener('change', refreshJobReports);
      }

      if (applyReportFilter) {
        applyReportFilter.addEventListener('click', refreshJobReports);
      }
      if (reportExportExcel) {
        reportExportExcel.addEventListener('click', exportJobReportsAsExcel);
      }
      if (reportExportPdf) {
        reportExportPdf.addEventListener('click', exportJobReportsAsPdf);
      }
      if (reportWhatsapp) {
        reportWhatsapp.addEventListener('click', shareJobReportsToWhatsApp);
      }
      if (clearJobCardsBtn) {
        clearJobCardsBtn.addEventListener('click', clearAllJobCards);
      }

      // Payment Report listeners
      const applyPaymentFilter = document.getElementById('applyPaymentFilter');
      const paymentReportCustomer = document.getElementById('paymentReportCustomer');
      const paymentReportFromDate = document.getElementById('paymentReportFromDate');
      const paymentReportToDate = document.getElementById('paymentReportToDate');
      const paymentExportExcel = document.getElementById('paymentExportExcel');

      if (applyPaymentFilter) {
        applyPaymentFilter.addEventListener('click', refreshPaymentReport);
      }
      if (paymentReportCustomer) {
        paymentReportCustomer.addEventListener('change', refreshPaymentReport);
      }
      if (paymentReportFromDate || paymentReportToDate) {
        [paymentReportFromDate, paymentReportToDate].forEach(el => {
          if (el) {
            el.addEventListener('change', refreshPaymentReport);
            el.max = getLocalDateString();
          }
        });
      }
      if (paymentExportExcel) {
        paymentExportExcel.addEventListener('click', () => {
          const payments = getPayments();
          const fromDate = document.getElementById('paymentReportFromDate').value || getLocalDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
          const toDate = document.getElementById('paymentReportToDate').value || getLocalDateString();
          const rows = [['Date', 'Customer', 'Amount', 'Mode', 'Coverage', 'Notes']];
          payments.filter(p => p.date >= fromDate && p.date <= toDate).forEach(p => {
            const coverageLabel = p.paymentCoverageType === 'single' ? p.paymentForDate
              : p.paymentCoverageType === 'range' ? `${p.paymentForFromDate} to ${p.paymentForToDate}`
              : p.paymentCoverageType === 'month' ? p.paymentForMonth : '-';
            rows.push([p.date, p.customerName, String(p.amount), p.paymentMode, coverageLabel, p.notes || '']);
          });
          const csv = rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join('\t')).join('\n');
          const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `payment-report-${fromDate}-to-${toDate}.xls`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
        });
      }

      if (addCustomerBtn) {
        addCustomerBtn.addEventListener('click', () => {
          openCustomerModal();
        });
      }
      if (addWorkTypeBtn) {
        addWorkTypeBtn.addEventListener('click', () => {
          openWorkTypeModal();
        });
      }
      if (showInactiveCustomers) {
        showInactiveCustomers.addEventListener('change', refreshCustomerList);
      }
      if (showInactiveWorkTypes) {
        showInactiveWorkTypes.addEventListener('change', refreshWorkTypeList);
      }
      if (customerForm) {
        customerForm.addEventListener('submit', saveCustomerFromModal);
      }
      if (workTypeForm) {
        workTypeForm.addEventListener('submit', saveWorkTypeFromModal);
      }
      if (deleteCustomerBtn) {
        deleteCustomerBtn.addEventListener('click', () => {
          const customerId = parseInt(document.getElementById('customerFormId').value, 10);
          const current = getCustomers().find(customer => customer.id === customerId);
          if (!current) return;
          const nextActive = current.isActive === false;
          const confirmed = window.confirm(nextActive
            ? `Restore ${current.name}?`
            : `Delete ${current.name}? This will deactivate the customer from future job entry.`);
          if (!confirmed) return;
          setCustomerActiveState(customerId, nextActive);
          closeMasterModal('customerModal');
        });
      }
      if (deleteWorkTypeBtn) {
        deleteWorkTypeBtn.addEventListener('click', () => {
          const workTypeId = parseInt(document.getElementById('workTypeFormId').value, 10);
          const current = getWorkTypes().find(workType => workType.id === workTypeId);
          if (!current) return;
          const nextActive = current.isActive === false;
          const confirmed = window.confirm(nextActive
            ? `Restore ${current.name}?`
            : `Delete ${current.name}? This will deactivate the work type from future job entry.`);
          if (!confirmed) return;
          setWorkTypeActiveState(workTypeId, nextActive);
          closeMasterModal('workTypeModal');
        });
      }

      if (customerListTable) {
        customerListTable.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-edit-customer]');
          if (btn) editCustomer(parseInt(btn.dataset.editCustomer, 10));
          const deleteBtn = e.target.closest('[data-delete-customer]');
          if (deleteBtn) {
            const customerId = parseInt(deleteBtn.dataset.deleteCustomer, 10);
            const current = getCustomers().find(customer => customer.id === customerId);
            if (!current) return;
            const confirmed = window.confirm(`Delete ${current.name}? This will deactivate the customer from future job entry.`);
            if (!confirmed) return;
            setCustomerActiveState(customerId, false);
          }
          const restoreBtn = e.target.closest('[data-restore-customer]');
          if (restoreBtn) {
            const customerId = parseInt(restoreBtn.dataset.restoreCustomer, 10);
            const current = getCustomers().find(customer => customer.id === customerId);
            if (!current) return;
            const confirmed = window.confirm(`Restore ${current.name}?`);
            if (!confirmed) return;
            setCustomerActiveState(customerId, true);
          }
        });
      }
      if (workTypeListTable) {
        workTypeListTable.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-edit-worktype]');
          if (btn) editWorkType(parseInt(btn.dataset.editWorktype, 10));
          const deleteBtn = e.target.closest('[data-delete-worktype]');
          if (deleteBtn) {
            const workTypeId = parseInt(deleteBtn.dataset.deleteWorktype, 10);
            const current = getWorkTypes().find(workType => workType.id === workTypeId);
            if (!current) return;
            const confirmed = window.confirm(`Delete ${current.name}? This will deactivate the work type from future job entry.`);
            if (!confirmed) return;
            setWorkTypeActiveState(workTypeId, false);
          }
          const restoreBtn = e.target.closest('[data-restore-worktype]');
          if (restoreBtn) {
            const workTypeId = parseInt(restoreBtn.dataset.restoreWorktype, 10);
            const current = getWorkTypes().find(workType => workType.id === workTypeId);
            if (!current) return;
            const confirmed = window.confirm(`Restore ${current.name}?`);
            if (!confirmed) return;
            setWorkTypeActiveState(workTypeId, true);
          }
        });
      }

      document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeMasterModal(btn.dataset.closeModal));
      });

      ['customerModal', 'workTypeModal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            closeMasterModal(modalId);
          }
        });
      });
    });

    function refreshTodaysJobs() {
      const today = getLocalDateString();
      const jobs = getJobs().filter(j => j.date === today).reverse();
      const container = document.getElementById('recentJobsList');
      const jobCards = groupJobsByCard(jobs);

      if (jobCards.length === 0) {
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

      container.innerHTML = jobCards.map(card => {
        const job = card.primary;
        const dcStatus = getJobDcStatus(job);
        const dcBadge = dcStatus === 'Completed'
          ? '<span class="badge badge-green">DC Ready</span>'
          : dcStatus === 'Pending DC'
            ? '<span class="badge badge-orange">DC Pending</span>'
            : '';
        const lineList = card.jobs.map(line => `${line.workTypeName || line.workName || 'Job'} x ${line.quantity}`).join(' · ');

        return `
          <div class="job-item">
            <span class="job-number">#${job.jobCardId || job.id}</span>
            <div class="job-details">
              <div class="job-customer">${job.customerName}</div>
              <div class="job-work">
                <span class="spot-badge">${getJobWorkMode(job)}</span>
                ${dcBadge}
                ${lineList}
              </div>
            </div>
            <div class="job-item-actions">
              <div style="text-align: right;">
                <div class="job-amount">${formatCurrency(card.totalAmount)}</div>
                <div class="job-net">${getJobPaymentStatus(job)}${getJobPaidAmount(job) > 0 ? ` · ${getJobPaymentMode(job)}` : ''}</div>
              </div>
              <button type="button" class="btn btn-secondary btn-small job-action-btn" data-edit-jobkey="${card.key}">Edit</button>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('[data-edit-jobkey]').forEach(btn => {
        btn.addEventListener('click', () => editJobCard(btn.dataset.editJobkey));
      });
    }

    function renderJobHistory(jobs) {
      let fromDate = document.getElementById('historyFromDate').value;
      let toDate = document.getElementById('historyToDate').value;
      const fromMonth = document.getElementById('historyFromMonth')?.value || '';
      const toMonth = document.getElementById('historyToMonth')?.value || '';
      const customerId = document.getElementById('historyCustomer').value;

      // If month range is set, convert it to date range
      if (fromMonth) {
        fromDate = fromMonth + '-01';
      }
      if (toMonth) {
        // Get the last day of the selected month
        const [year, month] = toMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        toDate = toMonth + '-' + String(lastDay).padStart(2, '0');
      }

      let filtered = jobs;
      if (fromDate) filtered = filtered.filter(j => j.date >= fromDate);
      if (toDate) filtered = filtered.filter(j => j.date <= toDate);
      if (customerId) filtered = filtered.filter(j => j.customerId === parseInt(customerId, 10));

      const grouped = groupJobsByCard(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)));
      const tbody = document.getElementById('jobHistoryTable');

      if (grouped.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="11" style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
              No jobs found for the selected filters.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = grouped.map(group => {
        const job = group.primary;
        const dcStatus = getJobDcStatus(job);
        const dcCell = jobHasDcDetails(job)
          ? `
            <div>${job.dcNo || '-'}</div>
            <div class="table-subtext">${job.vehicleNo || '-'}</div>
            <div class="table-subtext">${job.dcDate ? formatDate(job.dcDate) : '-'}</div>
          `
          : `
            <span class="badge ${dcStatus === 'Pending DC' ? 'badge-orange' : 'badge-green'}">${dcStatus}</span>
            <div class="table-subtext">${job.dcApproval ? 'Approved without DC' : 'No DC details yet'}</div>
          `;

        return `
          <tr>
            <td class="amount">#${job.jobCardId || group.key}</td>
            <td>${formatDate(job.date)}</td>
            <td><strong>${job.customerName}</strong></td>
            <td><span class="spot-badge">${getJobWorkMode(job)}</span></td>
            <td>${group.jobs.map(line => line.workTypeName || line.workName || 'Job').join(', ')}</td>
            <td style="text-align: center;">${group.lineCount}</td>
            <td style="text-align: right;" class="amount">${formatCurrency(group.totalAmount)}</td>
            <td style="text-align: right;" class="amount positive">${formatCurrency(group.totalNet)}</td>
            <td>
              <span class="badge ${getJobPaymentStatus(job) === 'Paid' ? 'badge-green' : 'badge-red'}">${getJobPaymentStatus(job)}</span>
              <div class="table-subtext">${getJobPaymentMode(job)}</div>
            </td>
            <td>${dcCell}</td>
            <td class="table-action-cell"><button type="button" class="btn btn-secondary btn-small job-action-btn" data-edit-jobkey="${group.key}">Edit</button></td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('[data-edit-jobkey]').forEach(btn => {
        btn.addEventListener('click', () => editJobCard(btn.dataset.editJobkey));
      });
    }
