import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Customer, Expense, Job, Payment, WorkType, CommissionWorker, CommissionPayment } from '@/types';
import { defaultCustomers, defaultWorkTypes, defaultCommissionWorkers } from '@/lib/seedData';
import { getLocalDateString } from '@/lib/dateUtils';
import { apiClient } from '@/lib/apiClient';
import ENV from '@/lib/envConfig';

const LEGACY_KEYS = {
  customers: 'siva_customers',
  jobs: 'siva_jobs',
  payments: 'siva_payments',
  workTypes: 'siva_work_types',
  expenses: 'siva_expenses',
  categories: 'siva_categories',
  commissionWorkers: 'siva_commission_workers',
  commissionPayments: 'siva_commission_payments',
  importedFlag: 'siva_backend_imported',
};

interface DataStore {
  customers: Customer[];
  jobs: Job[];
  payments: Payment[];
  workTypes: WorkType[];
  expenses: Expense[];
  categories: string[];
  commissionWorkers: CommissionWorker[];
  commissionPayments: CommissionPayment[];
  isLoading: boolean;
  backendConnected: boolean;
  lastSyncAt: string | null;
  syncError: string | null;

  initializeData: () => Promise<void>;
  refreshData: () => Promise<void>;

  addCustomer: (customer: Omit<Customer, 'id'>) => Promise<Customer>;
  updateCustomer: (id: number, updates: Partial<Customer>) => Promise<Customer>;
  deleteCustomer: (id: number) => Promise<void>;
  getCustomer: (id: number) => Customer | undefined;
  getActiveCustomers: () => Customer[];

  addWorkType: (workType: Omit<WorkType, 'id'>) => Promise<WorkType>;
  updateWorkType: (id: number, updates: Partial<WorkType>) => Promise<WorkType>;
  deleteWorkType: (id: number) => Promise<void>;
  getWorkType: (id: number) => WorkType | undefined;
  getActiveWorkTypes: () => WorkType[];

  addCategory: (category: string) => void;
  updateCategory: (oldName: string, newName: string) => void;
  deleteCategory: (category: string) => void;
  getCategories: () => string[];

  addJob: (job: Omit<Job, 'id' | 'createdAt'>) => Promise<Job>;
  addJobsBulk: (jobs: Omit<Job, 'id' | 'createdAt'>[]) => Promise<Job[]>;
  updateJob: (id: number, updates: Partial<Job>) => Promise<Job>;
  deleteJob: (id: number) => Promise<void>;
  getJob: (id: number) => Job | undefined;
  getCustomerJobs: (customerId: number) => Job[];
  clearAllJobs: () => Promise<void>;

  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => Promise<Payment>;
  updatePayment: (id: number, updates: Partial<Payment>) => Promise<Payment>;
  deletePayment: (id: number) => Promise<void>;
  getPayment: (id: number) => Payment | undefined;
  getCustomerPayments: (customerId: number) => Payment[];

  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<Expense>;
  updateExpense: (id: number, updates: Partial<Expense>) => Promise<Expense>;
  deleteExpense: (id: number) => Promise<void>;
  getExpense: (id: number) => Expense | undefined;

  addCommissionWorker: (worker: Omit<CommissionWorker, 'id' | 'createdAt'>) => Promise<CommissionWorker>;
  updateCommissionWorker: (id: number, updates: Partial<CommissionWorker>) => Promise<CommissionWorker>;
  deleteCommissionWorker: (id: number) => Promise<void>;
  getCommissionWorkersForCustomer: (customerId: number) => CommissionWorker[];

  addCommissionPayment: (payment: Omit<CommissionPayment, 'id' | 'createdAt'>) => Promise<CommissionPayment>;
  updateCommissionPayment: (id: number, updates: Partial<CommissionPayment>) => Promise<CommissionPayment>;
  deleteCommissionPayment: (id: number) => Promise<void>;
  getCommissionPaymentsForWorker: (workerId: number) => CommissionPayment[];
  getCommissionPaymentsForCustomer: (customerId: number) => CommissionPayment[];
}

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

type LegacyJobLike = Job & {
  commissionDistribution?: Array<{ workerId?: number; workerName?: string }>;
};

function normalizeLegacyJob(job: LegacyJobLike): Job {
  let commissionWorkerId = job.commissionWorkerId;
  let commissionWorkerName = job.commissionWorkerName;

  if (
    typeof commissionWorkerId !== 'number' &&
    Array.isArray(job.commissionDistribution) &&
    job.commissionDistribution.length > 0
  ) {
    const firstDistribution = job.commissionDistribution[0];
    if (typeof firstDistribution.workerId === 'number') {
      commissionWorkerId = firstDistribution.workerId;
    }
    if (!commissionWorkerName && typeof firstDistribution.workerName === 'string') {
      commissionWorkerName = firstDistribution.workerName;
    }
  }

  const normalized: Job = {
    ...job,
    commissionWorkerId,
    commissionWorkerName,
  };
  delete (normalized as LegacyJobLike).commissionDistribution;
  return normalized;
}

function patchCommissionDcCustomers(customers: Customer[]): Customer[] {
  return customers.map((customer) => {
    const isCommissionDcCustomer = [1, 2, 17, 18].includes(customer.id);
    if (customer.id === 17 && !customer.shortCode) {
      return {
        ...customer,
        shortCode: 'AKR',
        hasCommission: true,
        requiresDc: true,
      };
    }
    if (customer.id === 18 && !customer.shortCode) {
      return {
        ...customer,
        shortCode: 'AVP',
        hasCommission: true,
        requiresDc: true,
      };
    }
    if (isCommissionDcCustomer) {
      return {
        ...customer,
        hasCommission: true,
        requiresDc: true,
      };
    }
    return customer;
  });
}

function loadLegacySnapshot() {
  const customers = parseJsonArray<Customer>(localStorage.getItem(LEGACY_KEYS.customers));
  const workTypes = parseJsonArray<WorkType>(localStorage.getItem(LEGACY_KEYS.workTypes));
  const jobs = parseJsonArray<LegacyJobLike>(localStorage.getItem(LEGACY_KEYS.jobs)).map(normalizeLegacyJob);
  const payments = parseJsonArray<Payment>(localStorage.getItem(LEGACY_KEYS.payments));
  const expenses = parseJsonArray<Expense>(localStorage.getItem(LEGACY_KEYS.expenses));
  const categoriesJson = localStorage.getItem(LEGACY_KEYS.categories);
  const categories = parseJsonArray<string>(categoriesJson);
  const commissionWorkers = parseJsonArray<CommissionWorker>(localStorage.getItem(LEGACY_KEYS.commissionWorkers));
  const commissionPayments = parseJsonArray<CommissionPayment>(localStorage.getItem(LEGACY_KEYS.commissionPayments));

  return {
    customers: patchCommissionDcCustomers(customers.length > 0 ? customers : defaultCustomers),
    workTypes: workTypes.length > 0 ? workTypes : defaultWorkTypes,
    jobs,
    payments,
    expenses,
    categories: categories.length > 0 ? categories : ['Skimming', 'Bearing', 'Bush', 'Driveshaft', 'Bolt', 'Welding', 'Other'],
    commissionWorkers: commissionWorkers.length > 0 ? commissionWorkers : defaultCommissionWorkers,
    commissionPayments,
  };
}

function getNextId(items: Array<{ id: number }>) {
  return items.length > 0 ? Math.max(...items.map((item) => item.id), 0) + 1 : 1;
}

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      customers: [],
      jobs: [],
      payments: [],
      workTypes: [],
      expenses: [],
      categories: ['Skimming', 'Bearing', 'Bush', 'Driveshaft', 'Bolt', 'Welding', 'Other'],
      commissionWorkers: [],
      commissionPayments: [],
      isLoading: false,
      backendConnected: false,
      lastSyncAt: null,
      syncError: null,

      initializeData: async () => {
        if (get().isLoading) {
          return;
        }

        set({ isLoading: true, syncError: null });
        try {
          const legacy = loadLegacySnapshot();

          if (!ENV.enableBackendSync) {
            const persistedExpenses =
              legacy.expenses.length > 0 ? legacy.expenses : get().expenses;
            set({
              ...legacy,
              expenses: persistedExpenses,
              backendConnected: false,
              lastSyncAt: new Date().toISOString(),
              isLoading: false,
            });
            return;
          }

          const hydrateFromApi = async () => {
            const [customers, workTypes, jobs, payments, expenses] = await Promise.all([
              apiClient.getCustomers(),
              apiClient.getWorkTypes(),
              apiClient.getJobs(),
              apiClient.getPayments(),
              apiClient.getExpenses(),
            ]);
            return { customers, workTypes, jobs, payments, expenses };
          };

          let data = await hydrateFromApi();
          data.jobs = data.jobs.map((job) => normalizeLegacyJob(job as LegacyJobLike));
          const isBackendEmpty =
            data.customers.length === 0 &&
            data.workTypes.length === 0 &&
            data.jobs.length === 0 &&
            data.payments.length === 0 &&
            data.expenses.length === 0;

          if (isBackendEmpty && localStorage.getItem(LEGACY_KEYS.importedFlag) !== 'true') {
            const persistedExpenses =
              legacy.expenses.length > 0 ? legacy.expenses : get().expenses;
            await apiClient.importLegacyData({
              overwrite: false,
              customers: legacy.customers,
              workTypes: legacy.workTypes,
              jobs: legacy.jobs,
              payments: legacy.payments,
              expenses: persistedExpenses,
            });
            localStorage.setItem(LEGACY_KEYS.importedFlag, 'true');
            data = await hydrateFromApi();
          }

          data.customers = patchCommissionDcCustomers(data.customers);

          set({
            ...data,
            commissionWorkers: legacy.commissionWorkers,
            commissionPayments: legacy.commissionPayments,
            backendConnected: true,
            lastSyncAt: new Date().toISOString(),
            syncError: null,
            isLoading: false,
          });
        } catch (error) {
          console.error('Backend sync failed. Falling back to local data:', error);
          const fallback = loadLegacySnapshot();
          const persistedExpenses =
            fallback.expenses.length > 0 ? fallback.expenses : get().expenses;
          set({
            ...fallback,
            expenses: persistedExpenses,
            backendConnected: false,
            lastSyncAt: new Date().toISOString(),
            syncError: error instanceof Error ? error.message : 'Sync failed',
            isLoading: false,
          });
        }
      },

      refreshData: async () => {
        if (!get().backendConnected) {
          return;
        }

        const [customers, workTypes, jobs, payments, expenses] = await Promise.all([
          apiClient.getCustomers(),
          apiClient.getWorkTypes(),
          apiClient.getJobs(),
          apiClient.getPayments(),
          apiClient.getExpenses(),
        ]);

        set({
          customers: patchCommissionDcCustomers(customers),
          workTypes,
          jobs: jobs.map((job) => normalizeLegacyJob(job as LegacyJobLike)),
          payments,
          expenses,
          lastSyncAt: new Date().toISOString(),
          syncError: null,
        });
      },

      addCustomer: async (customer) => {
        if (!get().backendConnected) {
          const newCustomer: Customer = {
            ...customer,
            id: getNextId(get().customers),
            isActive: customer.isActive ?? true,
          };
          set((state) => ({ customers: [...state.customers, newCustomer] }));
          return newCustomer;
        }

        const created = await apiClient.createCustomer(customer);
        set((state) => ({ customers: [...state.customers, created] }));
        return created;
      },

      updateCustomer: async (id, updates) => {
        if (!get().backendConnected) {
          const existing = get().customers.find((c) => c.id === id);
          if (!existing) throw new Error('Customer not found');
          const updated = { ...existing, ...updates };
          set((state) => ({
            customers: state.customers.map((c) => (c.id === id ? updated : c)),
          }));
          return updated;
        }

        const updated = await apiClient.updateCustomer(id, updates);
        set((state) => ({
          customers: state.customers.map((c) => (c.id === id ? updated : c)),
        }));
        return updated;
      },

      deleteCustomer: async (id) => {
        if (!get().backendConnected) {
          set((state) => ({
            customers: state.customers.filter((c) => c.id !== id),
          }));
          return;
        }

        await apiClient.deleteCustomer(id);
        set((state) => ({
          customers: state.customers.filter((c) => c.id !== id),
        }));
      },

      getCustomer: (id) => get().customers.find((c) => c.id === id),
      getActiveCustomers: () => get().customers.filter((c) => c.isActive !== false),

      addWorkType: async (workType) => {
        if (!get().backendConnected) {
          const newWorkType: WorkType = {
            ...workType,
            id: getNextId(get().workTypes),
            isActive: workType.isActive ?? true,
          };
          set((state) => ({ workTypes: [...state.workTypes, newWorkType] }));
          return newWorkType;
        }

        const created = await apiClient.createWorkType(workType);
        set((state) => ({ workTypes: [...state.workTypes, created] }));
        return created;
      },

      updateWorkType: async (id, updates) => {
        if (!get().backendConnected) {
          const existing = get().workTypes.find((wt) => wt.id === id);
          if (!existing) throw new Error('Work type not found');
          const updated = { ...existing, ...updates };
          set((state) => ({
            workTypes: state.workTypes.map((wt) => (wt.id === id ? updated : wt)),
          }));
          return updated;
        }

        const updated = await apiClient.updateWorkType(id, updates);
        set((state) => ({
          workTypes: state.workTypes.map((wt) => (wt.id === id ? updated : wt)),
        }));
        return updated;
      },

      deleteWorkType: async (id) => {
        if (!get().backendConnected) {
          set((state) => ({
            workTypes: state.workTypes.filter((wt) => wt.id !== id),
          }));
          return;
        }

        await apiClient.deleteWorkType(id);
        set((state) => ({
          workTypes: state.workTypes.filter((wt) => wt.id !== id),
        }));
      },

      getWorkType: (id) => get().workTypes.find((wt) => wt.id === id),
      getActiveWorkTypes: () => get().workTypes.filter((wt) => wt.isActive !== false),

      addJob: async (job) => {
        if (!get().backendConnected) {
          const newJob: Job = {
            ...job,
            id: getNextId(get().jobs),
            date: job.date || getLocalDateString(),
            createdAt: new Date().toISOString(),
          };
          set((state) => ({ jobs: [...state.jobs, newJob] }));
          return newJob;
        }

        const created = await apiClient.createJob(job);
        set((state) => ({ jobs: [...state.jobs, created] }));
        return created;
      },

      addJobsBulk: async (jobs) => {
        if (jobs.length === 0) {
          return [];
        }

        if (!get().backendConnected) {
          let nextId = getNextId(get().jobs);
          const created = jobs.map((job) => {
            const mapped: Job = {
              ...job,
              id: nextId++,
              date: job.date || getLocalDateString(),
              createdAt: new Date().toISOString(),
            };
            return mapped;
          });

          set((state) => ({ jobs: [...state.jobs, ...created] }));
          return created;
        }

        const created = await apiClient.createJobsBulk(jobs);
        set((state) => ({ jobs: [...state.jobs, ...created] }));
        return created;
      },

      updateJob: async (id, updates) => {
        if (!get().backendConnected) {
          const existing = get().jobs.find((j) => j.id === id);
          if (!existing) throw new Error('Job not found');
          const updated = { ...existing, ...updates };
          set((state) => ({
            jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
          }));
          return updated;
        }

        const updated = await apiClient.updateJob(id, updates);
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
        }));
        return updated;
      },

      deleteJob: async (id) => {
        if (!get().backendConnected) {
          set((state) => ({
            jobs: state.jobs.filter((j) => j.id !== id),
          }));
          return;
        }

        await apiClient.deleteJob(id);
        set((state) => ({
          jobs: state.jobs.filter((j) => j.id !== id),
        }));
      },

      getJob: (id) => get().jobs.find((j) => j.id === id),
      getCustomerJobs: (customerId) => get().jobs.filter((j) => j.customerId === customerId),

      clearAllJobs: async () => {
        if (!get().backendConnected) {
          set({ jobs: [] });
          return;
        }

        await apiClient.deleteAllJobs();
        set({ jobs: [] });
      },

      addPayment: async (payment) => {
        if (!get().backendConnected) {
          const newPayment: Payment = {
            ...payment,
            id: getNextId(get().payments),
            date: payment.date || getLocalDateString(),
            createdAt: new Date().toISOString(),
          };
          set((state) => ({ payments: [...state.payments, newPayment] }));
          return newPayment;
        }

        const created = await apiClient.createPayment(payment);
        set((state) => ({ payments: [...state.payments, created] }));
        return created;
      },

      updatePayment: async (id, updates) => {
        if (!get().backendConnected) {
          const existing = get().payments.find((p) => p.id === id);
          if (!existing) throw new Error('Payment not found');
          const updated = { ...existing, ...updates };
          set((state) => ({
            payments: state.payments.map((p) => (p.id === id ? updated : p)),
          }));
          return updated;
        }

        const updated = await apiClient.updatePayment(id, updates);
        set((state) => ({
          payments: state.payments.map((p) => (p.id === id ? updated : p)),
        }));
        return updated;
      },

      deletePayment: async (id) => {
        if (!get().backendConnected) {
          set((state) => ({
            payments: state.payments.filter((p) => p.id !== id),
          }));
          return;
        }

        await apiClient.deletePayment(id);
        set((state) => ({
          payments: state.payments.filter((p) => p.id !== id),
        }));
      },

      getPayment: (id) => get().payments.find((p) => p.id === id),
      getCustomerPayments: (customerId) =>
        get().payments.filter((p) => p.customerId === customerId),

      addExpense: async (expense) => {
        if (!get().backendConnected) {
          const newExpense: Expense = {
            ...expense,
            id: getNextId(get().expenses),
            createdAt: new Date().toISOString(),
          };
          set((state) => ({ expenses: [...state.expenses, newExpense] }));
          return newExpense;
        }

        const created = await apiClient.createExpense(expense);
        set((state) => ({ expenses: [...state.expenses, created] }));
        return created;
      },

      updateExpense: async (id, updates) => {
        if (!get().backendConnected) {
          const existing = get().expenses.find((e) => e.id === id);
          if (!existing) throw new Error('Expense not found');
          const updated = { ...existing, ...updates };
          set((state) => ({
            expenses: state.expenses.map((e) => (e.id === id ? updated : e)),
          }));
          return updated;
        }

        const updated = await apiClient.updateExpense(id, updates);
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === id ? updated : e)),
        }));
        return updated;
      },

      deleteExpense: async (id) => {
        if (!get().backendConnected) {
          set((state) => ({
            expenses: state.expenses.filter((e) => e.id !== id),
          }));
          return;
        }

        await apiClient.deleteExpense(id);
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        }));
      },

      getExpense: (id) => get().expenses.find((e) => e.id === id),

      addCategory: (category) => {
        const trimmed = category.trim();
        if (!trimmed || get().categories.includes(trimmed)) {
          return;
        }
        set((state) => ({
          categories: [...state.categories, trimmed],
        }));
      },

      updateCategory: (oldName, newName) => {
        const oldTrimmed = oldName.trim();
        const newTrimmed = newName.trim();
        const state = get();

        if (!newTrimmed || oldTrimmed === newTrimmed) {
          return;
        }

        // Check if new name already exists
        if (state.categories.includes(newTrimmed)) {
          return;
        }

        const categoryIndex = state.categories.indexOf(oldTrimmed);
        if (categoryIndex === -1) {
          return;
        }

        // Update categories array
        const newCategories = [...state.categories];
        newCategories[categoryIndex] = newTrimmed;

        // Update all work types with the old category name
        const updatedWorkTypes = state.workTypes.map((wt) =>
          wt.category === oldTrimmed ? { ...wt, category: newTrimmed } : wt
        );

        set({
          categories: newCategories,
          workTypes: updatedWorkTypes,
        });
      },

      deleteCategory: (category) => {
        const trimmed = category.trim();
        const state = get();

        // Check if any work types use this category
        const hasWorkTypes = state.workTypes.some((wt) => wt.category === trimmed);
        if (hasWorkTypes) {
          return; // Cannot delete a category that has work types
        }

        set((state) => ({
          categories: state.categories.filter((c) => c !== trimmed),
        }));
      },

      getCategories: () => get().categories,

      addCommissionWorker: async (worker) => {
        if (!get().backendConnected) {
          const newWorker: CommissionWorker = {
            ...worker,
            id: getNextId(get().commissionWorkers),
            createdAt: new Date().toISOString(),
          };
          set((state) => ({ commissionWorkers: [...state.commissionWorkers, newWorker] }));
          return newWorker;
        }

        // TODO: Add backend sync for commission workers
        const newWorker: CommissionWorker = {
          ...worker,
          id: getNextId(get().commissionWorkers),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ commissionWorkers: [...state.commissionWorkers, newWorker] }));
        return newWorker;
      },

      updateCommissionWorker: async (id, updates) => {
        if (!get().backendConnected) {
          const existing = get().commissionWorkers.find((w) => w.id === id);
          if (!existing) throw new Error('Commission worker not found');
          const updated = { ...existing, ...updates };
          set((state) => ({
            commissionWorkers: state.commissionWorkers.map((w) => (w.id === id ? updated : w)),
          }));
          return updated;
        }

        // TODO: Add backend sync for commission workers
        const existing = get().commissionWorkers.find((w) => w.id === id);
        if (!existing) throw new Error('Commission worker not found');
        const updated = { ...existing, ...updates };
        set((state) => ({
          commissionWorkers: state.commissionWorkers.map((w) => (w.id === id ? updated : w)),
        }));
        return updated;
      },

      deleteCommissionWorker: async (id) => {
        if (!get().backendConnected) {
          set((state) => ({
            commissionWorkers: state.commissionWorkers.filter((w) => w.id !== id),
          }));
          return;
        }

        // TODO: Add backend sync for commission workers
        set((state) => ({
          commissionWorkers: state.commissionWorkers.filter((w) => w.id !== id),
        }));
      },

      getCommissionWorkersForCustomer: (customerId) =>
        get().commissionWorkers.filter((w) => w.customerId === customerId),

      addCommissionPayment: async (payment) => {
        if (!get().backendConnected) {
          const newPayment: CommissionPayment = {
            ...payment,
            id: getNextId(get().commissionPayments),
            createdAt: new Date().toISOString(),
          };
          set((state) => ({ commissionPayments: [...state.commissionPayments, newPayment] }));
          return newPayment;
        }

        // TODO: Add backend sync for commission payments
        const newPayment: CommissionPayment = {
          ...payment,
          id: getNextId(get().commissionPayments),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ commissionPayments: [...state.commissionPayments, newPayment] }));
        return newPayment;
      },

      updateCommissionPayment: async (id, updates) => {
        if (!get().backendConnected) {
          const existing = get().commissionPayments.find((p) => p.id === id);
          if (!existing) throw new Error('Commission payment not found');
          const updated = { ...existing, ...updates };
          set((state) => ({
            commissionPayments: state.commissionPayments.map((p) => (p.id === id ? updated : p)),
          }));
          return updated;
        }

        // TODO: Add backend sync for commission payments
        const existing = get().commissionPayments.find((p) => p.id === id);
        if (!existing) throw new Error('Commission payment not found');
        const updated = { ...existing, ...updates };
        set((state) => ({
          commissionPayments: state.commissionPayments.map((p) => (p.id === id ? updated : p)),
        }));
        return updated;
      },

      deleteCommissionPayment: async (id) => {
        if (!get().backendConnected) {
          set((state) => ({
            commissionPayments: state.commissionPayments.filter((p) => p.id !== id),
          }));
          return;
        }

        // TODO: Add backend sync for commission payments
        set((state) => ({
          commissionPayments: state.commissionPayments.filter((p) => p.id !== id),
        }));
      },

      getCommissionPaymentsForWorker: (workerId) =>
        get().commissionPayments.filter((p) => p.workerId === workerId),

      getCommissionPaymentsForCustomer: (customerId) =>
        get().commissionPayments.filter((p) => p.customerId === customerId),
    }),
    {
      name: 'siva_data',
      partialize: (state) => ({
        customers: state.customers,
        jobs: state.jobs,
        payments: state.payments,
        workTypes: state.workTypes,
        expenses: state.expenses,
        categories: state.categories,
        commissionWorkers: state.commissionWorkers,
        commissionPayments: state.commissionPayments,
      }),
    }
  )
);

useDataStore.subscribe((state) => {
  try {
    localStorage.setItem(LEGACY_KEYS.customers, JSON.stringify(state.customers));
    localStorage.setItem(LEGACY_KEYS.jobs, JSON.stringify(state.jobs));
    localStorage.setItem(LEGACY_KEYS.payments, JSON.stringify(state.payments));
    localStorage.setItem(LEGACY_KEYS.workTypes, JSON.stringify(state.workTypes));
    localStorage.setItem(LEGACY_KEYS.expenses, JSON.stringify(state.expenses));
    localStorage.setItem(LEGACY_KEYS.categories, JSON.stringify(state.categories));
    localStorage.setItem(LEGACY_KEYS.commissionWorkers, JSON.stringify(state.commissionWorkers));
    localStorage.setItem(LEGACY_KEYS.commissionPayments, JSON.stringify(state.commissionPayments));
  } catch (error) {
    console.error('Failed to sync compatibility localStorage keys:', error);
  }
});
