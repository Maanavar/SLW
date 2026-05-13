import type {
  ActivityLog,
  AuthUser,
  BackupListItem,
  CommissionPayment,
  CommissionWorker,
  Customer,
  Expense,
  FollowUpOverview,
  Job,
  MonthLockStateResponse,
  Payment,
  WorkType,
} from '@/types';
import ENV from './envConfig';

type RequestOptions = RequestInit;

interface LogsResponse {
  total: number;
  limit: number;
  offset: number;
  items: ActivityLog[];
}

interface LoginResponse {
  expiresAt: string;
  user: AuthUser;
}

interface SessionResponse {
  user: AuthUser;
}

interface DateWindowParams {
  from?: string;
  to?: string;
}

interface CustomerScopedParams extends DateWindowParams {
  customerId?: number;
}

interface ExpenseQueryParams extends DateWindowParams {
  category?: string;
  isRecurring?: boolean;
}

interface PaginationParams {
  limit?: number;
  offset?: number;
}

interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
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

function emitAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('slw-auth-changed'));
  }
}

function getApiBaseUrl(): string {
  return `${ENV.apiBaseUrl.replace(/\/+$/, '')}/api`;
}

function appendQuery(path: string, params?: object) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      continue;
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function parseResponseBody(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

function isErrorBody(body: unknown): body is { error: string } {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return false;
  }
  const { error } = body;
  return typeof error === 'string' && error.trim().length > 0;
}

function formatErrorDetails(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('details' in body)) {
    return null;
  }

  const details = (body as { details?: unknown }).details;
  if (typeof details !== 'object' || details === null) {
    return null;
  }

  const fieldErrors =
    'fieldErrors' in details && typeof (details as { fieldErrors?: unknown }).fieldErrors === 'object'
      ? ((details as { fieldErrors?: Record<string, unknown> }).fieldErrors ?? {})
      : {};
  const formErrors =
    'formErrors' in details && Array.isArray((details as { formErrors?: unknown }).formErrors)
      ? ((details as { formErrors?: unknown[] }).formErrors ?? [])
      : [];

  const messages: string[] = [];

  Object.entries(fieldErrors).forEach(([field, value]) => {
    if (!Array.isArray(value)) {
      return;
    }
    const text = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    if (text.length > 0) {
      messages.push(`${field}: ${text.join(', ')}`);
    }
  });

  formErrors.forEach((entry) => {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      messages.push(entry);
    }
  });

  return messages.length > 0 ? messages.join(' | ') : null;
}

function getErrorMessage(body: unknown, status: number): string {
  if (isErrorBody(body)) {
    const details = formatErrorDetails(body);
    return details ? `${body.error}: ${details}` : body.error;
  }
  return `Request failed (${status})`;
}

async function request<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ENV.apiTimeout);

  try {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers,
      credentials: 'include', // send httpOnly session cookie on every request
      signal: controller.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const body = parseResponseBody(text);

    if (!response.ok) {
      if (response.status === 401) {
        emitAuthChange();
      }
      const message = getErrorMessage(body, response.status);
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
  hasAuthToken: () => false,
  hasOfflineSession: () => false,
  createOfflineSession: () => {
    throw new Error('Offline login is disabled.');
  },
  setAuthToken: () => {
    throw new Error('Direct auth token management is disabled.');
  },
  clearAuthToken: () => {
    emitAuthChange();
  },
  login: async (payload: { password: string; name?: string; email?: string }) => {
    const response = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    emitAuthChange();
    return response;
  },
  getAuthSession: () => request<SessionResponse>('/auth/session'),
  logout: async () => {
    try {
      await request<void>('/auth/logout', { method: 'POST' });
    } finally {
      emitAuthChange();
    }
  },

  getCustomers: () => request<Customer[]>('/customers'),
  createCustomer: (payload: Omit<Customer, 'id'>) =>
    request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCustomer: (id: number, payload: Partial<Customer>) =>
    request<Customer>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCustomer: (id: number) =>
    request<void>(`/customers/${id}`, {
      method: 'DELETE',
    }),

  getWorkTypes: () => request<WorkType[]>('/work-types'),
  createWorkType: (payload: Omit<WorkType, 'id'>) =>
    request<WorkType>('/work-types', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWorkType: (id: number, payload: Partial<WorkType>) =>
    request<WorkType>(`/work-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteWorkType: (id: number) =>
    request<void>(`/work-types/${id}`, {
      method: 'DELETE',
    }),

  getJobs: (params?: CustomerScopedParams) => request<Job[]>(appendQuery('/jobs', params ?? {})),
  getJobsPage: (params?: CustomerScopedParams & PaginationParams) =>
    request<PaginatedResponse<Job>>(appendQuery('/jobs/page', params ?? {})),
  createJob: (payload: Omit<Job, 'id' | 'createdAt'>) =>
    request<Job>('/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createJobsBulk: (payload: Omit<Job, 'id' | 'createdAt'>[]) =>
    request<Job[]>('/jobs/bulk', {
      method: 'POST',
      body: JSON.stringify({ jobs: payload }),
    }),
  updateJob: (id: number, payload: Partial<Job>) =>
    request<Job>(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteJob: (id: number) =>
    request<void>(`/jobs/${id}`, {
      method: 'DELETE',
    }),
  deleteAllJobs: () =>
    request<{ deleted: number }>('/jobs?all=true', {
      method: 'DELETE',
    }),

  getPayments: (params?: CustomerScopedParams) =>
    request<Payment[]>(appendQuery('/payments', params ?? {})),
  getPaymentsPage: (params?: CustomerScopedParams & PaginationParams) =>
    request<PaginatedResponse<Payment>>(appendQuery('/payments/page', params ?? {})),
  createPayment: (payload: Omit<Payment, 'id' | 'createdAt'>) =>
    request<Payment>('/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePayment: (id: number, payload: Partial<Payment>) =>
    request<Payment>(`/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deletePayment: (id: number) =>
    request<void>(`/payments/${id}`, {
      method: 'DELETE',
    }),
  deleteAllPayments: () =>
    request<{ deleted: number }>('/payments?all=true', {
      method: 'DELETE',
    }),

  getExpenses: (params?: ExpenseQueryParams) =>
    request<Expense[]>(appendQuery('/expenses', params ?? {})),
  getExpensesPage: (params?: ExpenseQueryParams & PaginationParams) =>
    request<PaginatedResponse<Expense>>(appendQuery('/expenses/page', params ?? {})),
  createExpense: (payload: Omit<Expense, 'id' | 'createdAt'>) =>
    request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateExpense: (id: number, payload: Partial<Expense>) =>
    request<Expense>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteExpense: (id: number) =>
    request<void>(`/expenses/${id}`, {
      method: 'DELETE',
    }),
  deleteAllExpenses: () =>
    request<{ deleted: number }>('/expenses?all=true', {
      method: 'DELETE',
    }),

  getCommissionWorkers: () => request<CommissionWorker[]>('/commission-workers'),
  createCommissionWorker: (payload: Omit<CommissionWorker, 'id' | 'createdAt'>) =>
    request<CommissionWorker>('/commission-workers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCommissionWorker: (id: number, payload: Partial<CommissionWorker>) =>
    request<CommissionWorker>(`/commission-workers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCommissionWorker: (id: number) =>
    request<void>(`/commission-workers/${id}`, {
      method: 'DELETE',
    }),

  getCommissionPayments: () => request<CommissionPayment[]>('/commission-payments'),
  createCommissionPayment: (payload: Omit<CommissionPayment, 'id' | 'createdAt'>) =>
    request<CommissionPayment>('/commission-payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCommissionPayment: (id: number, payload: Partial<CommissionPayment>) =>
    request<CommissionPayment>(`/commission-payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCommissionPayment: (id: number) =>
    request<void>(`/commission-payments/${id}`, {
      method: 'DELETE',
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
      body: JSON.stringify(payload),
    }),

  purgeData: (scope: PurgeScope) =>
    request<{ ok: boolean; summary: Record<string, number> }>('/admin/purge', {
      method: 'POST',
      body: JSON.stringify({
        confirmText: 'DELETE ALL DATA',
        scope,
      }),
    }),

  getFollowUpOverview: () => request<FollowUpOverview>('/followups'),
  upsertCustomerFollowUp: (customerId: number, payload: { nextFollowUpDate: string; notes?: string | null }) =>
    request<void>(`/followups/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  clearCustomerFollowUp: (customerId: number) =>
    request<void>(`/followups/${customerId}`, {
      method: 'DELETE',
    }),

  getMonthLockState: () =>
    request<MonthLockStateResponse>('/admin/month-locks'),
  lockMonth: (payload: { monthKey: string; notes?: string | null }) =>
    request<void>('/admin/month-locks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  unlockMonth: (monthKey: string) =>
    request<void>(`/admin/month-locks/${monthKey}`, {
      method: 'DELETE',
    }),
  setMonthLockOverride: (payload: { minutes: number; reason?: string | null }) =>
    request('/admin/month-locks/override', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  clearMonthLockOverride: () =>
    request<void>('/admin/month-locks/override', {
      method: 'DELETE',
    }),

  getBackups: () => request<BackupListItem[]>('/admin/backups'),
  createBackup: () =>
    request<BackupListItem>('/admin/backups/create', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  restoreBackup: (fileName: string) =>
    request<{ ok: boolean; restoredFile: string }>('/admin/backups/restore', {
      method: 'POST',
      body: JSON.stringify({ fileName }),
    }),
};
