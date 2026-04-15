import type {
  ActivityLog,
  Customer,
  Expense,
  Job,
  Payment,
  WorkType,
} from '@/types';
import ENV from './envConfig';

interface RequestOptions extends RequestInit {
  includeAdminKey?: boolean;
}

interface LogsResponse {
  total: number;
  limit: number;
  offset: number;
  items: ActivityLog[];
}

export interface LegacyImportPayload {
  overwrite?: boolean;
  customers: Customer[];
  workTypes: WorkType[];
  jobs: Job[];
  payments: Payment[];
  expenses?: Expense[];
}

export interface PurgeScope {
  allData?: boolean;
  jobs?: boolean;
  payments?: boolean;
  expenses?: boolean;
  customers?: boolean;
  workTypes?: boolean;
  logs?: boolean;
}

const ADMIN_KEY_STORAGE = 'slw_admin_api_key';
let runtimeAdminApiKey = '';

function getApiBaseUrl(): string {
  return `${ENV.apiBaseUrl.replace(/\/+$/, '')}/api`;
}

function getAdminApiKey(): string {
  if (runtimeAdminApiKey) {
    return runtimeAdminApiKey;
  }

  const fromStorage =
    typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_KEY_STORAGE) : '';
  if (fromStorage) {
    runtimeAdminApiKey = fromStorage;
    return runtimeAdminApiKey;
  }

  return ENV.adminApiKey || '';
}

function setAdminApiKey(apiKey: string) {
  runtimeAdminApiKey = apiKey.trim();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ADMIN_KEY_STORAGE, runtimeAdminApiKey);
  }
}

function clearAdminApiKey() {
  runtimeAdminApiKey = '';
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ADMIN_KEY_STORAGE);
  }
}

async function request<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ENV.apiTimeout);
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD';

  try {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }
    if (isMutation) {
      headers.set('x-actor-name', 'SLW Frontend');
    }

    if (options.includeAdminKey) {
      const adminKey = getAdminApiKey();
      if (adminKey) {
        headers.set('x-admin-key', adminKey);
      }
    }

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message =
        body && typeof body.error === 'string'
          ? body.error
          : `Request failed (${response.status})`;
      throw new Error(message);
    }

    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${ENV.apiTimeout}ms`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export const apiClient = {
  hasAdminApiKey: () => Boolean(getAdminApiKey()),
  setAdminApiKey,
  clearAdminApiKey,

  getCustomers: () => request<Customer[]>('/customers'),
  createCustomer: (payload: Omit<Customer, 'id'>) =>
    request<Customer>('/customers', {
      method: 'POST',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),
  updateCustomer: (id: number, payload: Partial<Customer>) =>
    request<Customer>(`/customers/${id}`, {
      method: 'PUT',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),
  deleteCustomer: (id: number) =>
    request<void>(`/customers/${id}`, {
      method: 'DELETE',
      includeAdminKey: true,
    }),

  getWorkTypes: () => request<WorkType[]>('/work-types'),
  createWorkType: (payload: Omit<WorkType, 'id'>) =>
    request<WorkType>('/work-types', {
      method: 'POST',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),
  updateWorkType: (id: number, payload: Partial<WorkType>) =>
    request<WorkType>(`/work-types/${id}`, {
      method: 'PUT',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),
  deleteWorkType: (id: number) =>
    request<void>(`/work-types/${id}`, {
      method: 'DELETE',
      includeAdminKey: true,
    }),

  getJobs: () => request<Job[]>('/jobs'),
  createJob: (payload: Omit<Job, 'id' | 'createdAt'>) =>
    request<Job>('/jobs', {
      method: 'POST',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),
  createJobsBulk: (payload: Omit<Job, 'id' | 'createdAt'>[]) =>
    request<Job[]>('/jobs/bulk', {
      method: 'POST',
      includeAdminKey: true,
      body: JSON.stringify({ jobs: payload }),
    }),
  updateJob: (id: number, payload: Partial<Job>) =>
    request<Job>(`/jobs/${id}`, {
      method: 'PUT',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),
  deleteJob: (id: number) =>
    request<void>(`/jobs/${id}`, {
      method: 'DELETE',
      includeAdminKey: true,
    }),
  deleteAllJobs: () =>
    request<{ deleted: number }>('/jobs?all=true', {
      method: 'DELETE',
      includeAdminKey: true,
    }),

  getPayments: () => request<Payment[]>('/payments'),
  createPayment: (payload: Omit<Payment, 'id' | 'createdAt'>) =>
    request<Payment>('/payments', {
      method: 'POST',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),
  updatePayment: (id: number, payload: Partial<Payment>) =>
    request<Payment>(`/payments/${id}`, {
      method: 'PUT',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),
  deletePayment: (id: number) =>
    request<void>(`/payments/${id}`, {
      method: 'DELETE',
      includeAdminKey: true,
    }),
  deleteAllPayments: () =>
    request<{ deleted: number }>('/payments?all=true', {
      method: 'DELETE',
      includeAdminKey: true,
    }),

  getExpenses: () => request<Expense[]>('/expenses'),
  createExpense: (payload: Omit<Expense, 'id' | 'createdAt'>) =>
    request<Expense>('/expenses', {
      method: 'POST',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),
  updateExpense: (id: number, payload: Partial<Expense>) =>
    request<Expense>(`/expenses/${id}`, {
      method: 'PUT',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),
  deleteExpense: (id: number) =>
    request<void>(`/expenses/${id}`, {
      method: 'DELETE',
      includeAdminKey: true,
    }),
  deleteAllExpenses: () =>
    request<{ deleted: number }>('/expenses?all=true', {
      method: 'DELETE',
      includeAdminKey: true,
    }),

  getLogs: (params?: { limit?: number; offset?: number; entityType?: string; action?: string }) => {
    const search = new URLSearchParams();
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.offset) search.set('offset', String(params.offset));
    if (params?.entityType) search.set('entityType', params.entityType);
    if (params?.action) search.set('action', params.action);

    const query = search.toString();
    return request<LogsResponse>(`/logs${query ? `?${query}` : ''}`);
  },

  importLegacyData: (payload: LegacyImportPayload) =>
    request<{ ok: boolean; imported: Record<string, number> }>('/admin/import-legacy', {
      method: 'POST',
      includeAdminKey: true,
      body: JSON.stringify(payload),
    }),

  purgeData: (scope: PurgeScope) =>
    request<{ ok: boolean; summary: Record<string, number> }>('/admin/purge', {
      method: 'POST',
      includeAdminKey: true,
      body: JSON.stringify({
        confirmText: 'DELETE ALL DATA',
        scope,
      }),
    }),
};
