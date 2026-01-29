/**
 * Application configuration
 *
 * Provides centralized access to environment-based configuration values.
 * Values can be overridden via Vite environment variables.
 */

/**
 * API configuration
 */
export const config = {
  /**
   * Base URL for API requests.
   * Defaults to '/api' for same-origin requests.
   */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',

  /**
   * Whether to use mock API implementations.
   * Enabled when VITE_USE_MOCKS=true.
   */
  useMockApi: import.meta.env.VITE_USE_MOCKS === 'true',

  /**
   * WebSocket URL for real-time updates.
   * Defaults to ws://localhost:8080/ws.
   */
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws',

  /**
   * VictoriaMetrics API URL for metrics dashboard.
   */
  victoriaMetricsUrl: import.meta.env.VITE_VM_URL || 'http://localhost:8428',

  /**
   * Whether running in development mode.
   */
  isDev: import.meta.env.DEV,

  /**
   * Whether running in production mode.
   */
  isProd: import.meta.env.PROD,
} as const;

/**
 * Feature flags configuration
 */
export const featureFlags = {
  /**
   * Enable extended logging in development.
   */
  extendedLogging: import.meta.env.DEV,

  /**
   * Enable experimental features.
   */
  experimental: import.meta.env.VITE_EXPERIMENTAL === 'true',
} as const;

export default config;
