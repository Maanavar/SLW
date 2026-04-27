/**
 * Environment Configuration
 * Safely accesses environment variables with defaults
 */

const ENV = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  apiTimeout: import.meta.env.VITE_API_TIMEOUT ? parseInt(import.meta.env.VITE_API_TIMEOUT) : 30000,
  enableBackendSync: import.meta.env.VITE_ENABLE_BACKEND_SYNC !== 'false',
  adminApiKey: import.meta.env.VITE_ADMIN_API_KEY || '',

  // Feature Flags
  enableReports: import.meta.env.VITE_ENABLE_REPORTS !== 'false',
  enablePaymentSync: import.meta.env.VITE_ENABLE_PAYMENT_SYNC === 'true',

  // Application Settings
  timezone: import.meta.env.VITE_APP_TIMEZONE || 'Asia/Kolkata',
  currencySymbol: import.meta.env.VITE_CURRENCY_SYMBOL || '₹',

  // Debug & Logging
  debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
  logLevel: (import.meta.env.VITE_LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',

  // Derived values
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

export default ENV;

/**
 * Log environment info in development
 */
if (ENV.isDevelopment && ENV.debugMode) {
  console.log('🔧 Environment Configuration:', {
    apiBaseUrl: ENV.apiBaseUrl,
    timezone: ENV.timezone,
    features: {
      reports: ENV.enableReports,
      paymentSync: ENV.enablePaymentSync,
    },
  });
}
