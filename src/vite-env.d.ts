/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT?: string;
  readonly VITE_ENABLE_BACKEND_SYNC?: string;
  readonly VITE_ENABLE_REPORTS?: string;
  readonly VITE_ENABLE_PAYMENT_SYNC?: string;
  readonly VITE_APP_TIMEZONE?: string;
  readonly VITE_CURRENCY_SYMBOL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_DEBUG_MODE?: string;
  readonly VITE_LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
