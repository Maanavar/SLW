import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Customer, Expense, Job, Payment, WorkType, CommissionWorker, CommissionPayment } from '@/types';
import { defaultCustomers, defaultWorkTypes, defaultCommissionWorkers } from '@/lib/seedData';
import { getLocalDateString } from '@/lib/dateUtils';
import { apiClient } from '@/lib/apiClient';
import {
  CUSTOMER_SHORT_CODES,
  isMahalingamCustomerLabel,
  isRmpCustomer,
  isWagenAutosCustomerLabel,
  normalizeCustomerCode,
} from '@/constants/customers';
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
  loadedDataFrom: string | null;
  loadedDataTo: string | null;

  initializeData: () => Promise<void>;
  refreshData: () => Promise<void>;
  ensureRangeLoaded: (range: { from: string; to: string }) => Promise<void>;
  loadJobsBefore: (beforeDate: string, limit?: number) => Promise<number>;

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
    const parsed: unknown = JSON.parse(raw);
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
    const normalizedShortCode = normalizeCustomerCode(customer.shortCode);
    const isRmp = isRmpCustomer(customer.shortCode, customer.name);
    const isNm = isMahalingamCustomerLabel(customer.shortCode, customer.name);
    const hasBillNo = customer.hasBillNo === true || isRmp || isNm;

    if (isWagenAutosCustomerLabel(customer.name, customer.shortCode)) {
      return {
        ...customer,
        hasBillNo,
        requiresDc: false,
      };
    }

    if (isNm) {
      return {
        ...customer,
        hasBillNo,
        requiresDc: true,
      };
    }

    if (isRmp) {
      return {
        ...customer,
        hasBillNo: true,
      };
    }

    // AKR has commission but does NOT require DC
    if (normalizedShortCode === CUSTOMER_SHORT_CODES.AKR) {
      return {
        ...customer,
        hasBillNo,
        hasCommission: true,
        requiresDc: false,
      };
    }

    const isCommissionDcCustomer = [1, 2, 17, 18].includes(customer.id);
    if (customer.id === 17 && !customer.shortCode) {
      return {
        ...customer,
        shortCode: 'AKR',
        hasBillNo,
        hasCommission: true,
        requiresDc: false,
      };
    }
    if (customer.id === 18 && !customer.shortCode) {
      return {
        ...customer,
        shortCode: 'AVP',
        hasBillNo,
        hasCommission: true,
        requiresDc: true,
      };
    }
    if (isCommissionDcCustomer) {
      return {
        ...customer,
        hasBillNo,
        hasCommission: true,
        requiresDc: true,
      };
    }

    return {
      ...customer,
      hasBillNo,
    };
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

const INITIAL_HISTORY_MONTHS = 3;

function getInitialDataWindow(): { from: string; to: string } {
  const today = new Date();
  const fromDate = new Date(today.getFullYear(), today.getMonth() - INITIAL_HISTORY_MONTHS, 1);
  return {
    from: getLocalDateString(fromDate),
    to: getLocalDateString(today),
  };
}

function shiftLocalDate(dateStr: string, deltaDays: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + deltaDays);
  return getLocalDateString(date);
}

function mergeById<T extends { id: number }>(existing: T[], incoming: T[]): T[] {
  if (incoming.length === 0) {
    return existing;
  }
  const map = new Map<number, T>();
  existing.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
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
      loadedDataFrom: null,
      loadedDataTo: null,

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
              loadedDataFrom: null,
              loadedDataTo: null,
              isLoading: false,
            });
            return;
          }

          const initialWindow = getInitialDataWindow();

          const hydrateFromApi = async () => {
            const [
              customers,
              workTypes,
              jobs,
              payments,
              expenses,
              commissionWorkers,
              commissionPayments,
            ] = await Promise.all([
              apiClient.getCustomers(),
              apiClient.getWorkTypes(),
              apiClient.getJobs(initialWindow),
              apiClient.getPayments(initialWindow),
              apiClient.getExpenses(initialWindow),
              apiClient.getCommissionWorkers(),
              apiClient.getCommissionPayments(),
            ]);
            return { customers, workTypes, jobs, payments, expenses, commissionWorkers, commissionPayments };
          };

          const data = await hydrateFromApi();
          data.customers = patchCommissionDcCustomers(data.customers);

          set({
            ...data,
            backendConnected: true,
            lastSyncAt: new Date().toISOString(),
            syncError: null,
            loadedDataFrom: initialWindow.from,
            loadedDataTo: initialWindow.to,
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
            loadedDataFrom: null,
            loadedDataTo: null,
            isLoading: false,
          });
        }
      },

      refreshData: async () => {
        if (!get().backendConnected) {
          return;
        }

        const window = (() => {
          const state = get();
          if (state.loadedDataFrom && state.loadedDataTo) {
            return { from: state.loadedDataFrom, to: state.loadedDataTo };
          }
          return getInitialDataWindow();
        })();

        const [
          customers,
          workTypes,
          jobs,
          payments,
          expenses,
          commissionWorkers,
          commissionPayments,
        ] = await Promise.all([
          apiClient.getCustomers(),
          apiClient.getWorkTypes(),
          apiClient.getJobs(window),
          apiClient.getPayments(window),
          apiClient.getExpenses(window),
          apiClient.getCommissionWorkers(),
          apiClient.getCommissionPayments(),
        ]);

        set({
          customers: patchCommissionDcCustomers(customers),
          workTypes,
          jobs,
          payments,
          expenses,
          commissionWorkers,
          commissionPayments,
          lastSyncAt: new Date().toISOString(),
          syncError: null,
          loadedDataFrom: window.from,
          loadedDataTo: window.to,
        });
      },

      ensureRangeLoaded: async (range) => {
        const state = get();
        if (!state.backendConnected) {
          return;
        }

        const normalizedRange = {
          from: range.from <= range.to ? range.from : range.to,
          to: range.from <= range.to ? range.to : range.from,
        };

        const loadedFrom = state.loadedDataFrom;
        const loadedTo = state.loadedDataTo;
        if (
          loadedFrom &&
          loadedTo &&
          normalizedRange.from >= loadedFrom &&
          normalizedRange.to <= loadedTo
        ) {
          return;
        }

        const segments: Array<{ from: string; to: string }> = [];
        if (!loadedFrom || !loadedTo) {
          segments.push(normalizedRange);
        } else {
          if (normalizedRange.from < loadedFrom) {
            segments.push({
              from: normalizedRange.from,
              to: shiftLocalDate(loadedFrom, -1),
            });
          }
          if (normalizedRange.to > loadedTo) {
            segments.push({
              from: shiftLocalDate(loadedTo, 1),
              to: normalizedRange.to,
            });
          }
        }

        if (segments.length === 0) {
          return;
        }

        let mergedJobs = state.jobs;
        let mergedPayments = state.payments;
        let mergedExpenses = state.expenses;

        for (const segment of segments) {
          const [jobs, payments, expenses] = await Promise.all([
            apiClient.getJobs(segment),
            apiClient.getPayments(segment),
            apiClient.getExpenses(segment),
          ]);
          mergedJobs = mergeById(mergedJobs, jobs);
          mergedPayments = mergeById(mergedPayments, payments);
          mergedExpenses = mergeById(mergedExpenses, expenses);
        }

        set({
          jobs: mergedJobs,
          payments: mergedPayments,
          expenses: mergedExpenses,
          loadedDataFrom:
            loadedFrom && loadedFrom < normalizedRange.from
              ? loadedFrom
              : normalizedRange.from,
          loadedDataTo:
            loadedTo && loadedTo > normalizedRange.to
              ? loadedTo
              : normalizedRange.to,
          lastSyncAt: new Date().toISOString(),
          syncError: null,
        });
      },

      loadJobsBefore: async (beforeDate, limit = 250) => {
        const state = get();
        if (!state.backendConnected) {
          return 0;
        }

        const page = await apiClient.getJobsPage({
          to: beforeDate,
          limit,
          offset: 0,
        });
        const mergedJobs = mergeById(state.jobs, page.items);

        const incomingEarliest = page.items.reduce<string | null>(
          (earliest, job) => (earliest === null || job.date < earliest ? job.date : earliest),
          null
        );

        set({
          jobs: mergedJobs,
          loadedDataFrom:
            incomingEarliest && state.loadedDataFrom
              ? incomingEarliest < state.loadedDataFrom
                ? incomingEarliest
                : state.loadedDataFrom
              : incomingEarliest ?? state.loadedDataFrom,
          loadedDataTo: state.loadedDataTo,
          lastSyncAt: new Date().toISOString(),
          syncError: null,
        });

        return page.items.length;
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

        const created = await apiClient.createCommissionWorker(worker);
        set((state) => ({ commissionWorkers: [...state.commissionWorkers, created] }));
        return created;
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

        const updated = await apiClient.updateCommissionWorker(id, updates);
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

        await apiClient.deleteCommissionWorker(id);
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

        const created = await apiClient.createCommissionPayment(payment);
        set((state) => ({ commissionPayments: [...state.commissionPayments, created] }));
        return created;
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

        const updated = await apiClient.updateCommissionPayment(id, updates);
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

        await apiClient.deleteCommissionPayment(id);
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
        categories: state.categories,
        backendConnected: state.backendConnected,
        lastSyncAt: state.lastSyncAt,
        loadedDataFrom: state.loadedDataFrom,
        loadedDataTo: state.loadedDataTo,
      }),
    }
  )
);

// Debounced offline snapshot — writes large arrays to localStorage only when
// backend is unavailable, and at most once per 2 s to avoid thrashing on
// rapid mutations (e.g. bulk job import).
let offlineSnapshotTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleOfflineSnapshot(state: ReturnType<typeof useDataStore.getState>) {
  if (offlineSnapshotTimer !== null) {
    clearTimeout(offlineSnapshotTimer);
  }
  offlineSnapshotTimer = setTimeout(() => {
    offlineSnapshotTimer = null;
    try {
      localStorage.setItem(LEGACY_KEYS.customers, JSON.stringify(state.customers));
      localStorage.setItem(LEGACY_KEYS.jobs, JSON.stringify(state.jobs));
      localStorage.setItem(LEGACY_KEYS.payments, JSON.stringify(state.payments));
      localStorage.setItem(LEGACY_KEYS.workTypes, JSON.stringify(state.workTypes));
      localStorage.setItem(LEGACY_KEYS.expenses, JSON.stringify(state.expenses));
      localStorage.setItem(LEGACY_KEYS.categories, JSON.stringify(state.categories));
      localStorage.setItem(LEGACY_KEYS.commissionWorkers, JSON.stringify(state.commissionWorkers));
      localStorage.setItem(LEGACY_KEYS.commissionPayments, JSON.stringify(state.commissionPayments));
    } catch {
      // Quota exceeded or private-browsing restriction — safe to ignore
    }
  }, 2000);
}

let previousBackendConnected = useDataStore.getState().backendConnected;

useDataStore.subscribe((state) => {
  if (state.backendConnected) {
    if (!previousBackendConnected) {
      // Clean up old offline snapshot keys only on offline -> online transition.
      if (offlineSnapshotTimer !== null) {
        clearTimeout(offlineSnapshotTimer);
        offlineSnapshotTimer = null;
      }
      try {
        for (const key of Object.values(LEGACY_KEYS)) {
          localStorage.removeItem(key);
        }
      } catch {
        // ignore
      }
    }
    previousBackendConnected = true;
    return;
  }

  previousBackendConnected = false;
  scheduleOfflineSnapshot(state);
});
