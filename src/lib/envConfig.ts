/**
 * Environment Configuration
 * Safely accesses environment variables with defaults
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function parseTimeout(raw: string | undefined): number {
  if (!raw) {
    return 30000;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
}

function parseLogLevel(raw: string | undefined): LogLevel {
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return 'info';
}

const ENV = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  apiTimeout: parseTimeout(import.meta.env.VITE_API_TIMEOUT),
  enableBackendSync: import.meta.env.VITE_ENABLE_BACKEND_SYNC !== 'false',

  // Feature Flags
  enableReports: import.meta.env.VITE_ENABLE_REPORTS !== 'false',
  enablePaymentSync: import.meta.env.VITE_ENABLE_PAYMENT_SYNC === 'true',
  enableOfflineLogin: import.meta.env.VITE_ENABLE_OFFLINE_LOGIN === 'true',

  // Application Settings
  timezone: import.meta.env.VITE_APP_TIMEZONE ?? 'Asia/Kolkata',
  currencySymbol: import.meta.env.VITE_CURRENCY_SYMBOL ?? 'INR',

  // Error Tracking
  sentryDsn: import.meta.env.VITE_SENTRY_DSN ?? '',

  // Debug & Logging
  debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
  logLevel: parseLogLevel(import.meta.env.VITE_LOG_LEVEL),

  // Derived values
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

export default ENV;

/**
 * Log environment info in development
 */
if (ENV.isDevelopment && ENV.debugMode) {
  console.log('Environment Configuration:', {
    apiBaseUrl: ENV.apiBaseUrl,
    timezone: ENV.timezone,
    features: {
      reports: ENV.enableReports,
      paymentSync: ENV.enablePaymentSync,
    },
  });
}
