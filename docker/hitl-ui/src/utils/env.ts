/**
 * Environment variable utilities
 *
 * Provides typed access to environment variables with validation.
 */

/**
 * Get a string environment variable
 */
export function getEnvVar(name: string, defaultValue?: string): string | undefined {
  const value = import.meta.env[name];
  return value !== undefined ? value : defaultValue;
}

/**
 * Get a boolean environment variable
 */
export function getBoolEnv(name: string, defaultValue: boolean = false): boolean {
  const value = getEnvVar(name);
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * Get a numeric environment variable
 */
export function getNumericEnv(name: string, defaultValue: number = 0): number {
  const value = getEnvVar(name);
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get a feature flag
 */
export function getFeatureFlag(feature: string, defaultValue: boolean = false): boolean {
  const name = `VITE_FEATURE_${feature.toUpperCase()}`;
  return getBoolEnv(name, defaultValue);
}

/**
 * Validate required environment variables
 */
export function validateEnv(required: string[]): {
  valid: boolean;
  missing: string[];
} {
  const missing = required.filter((name) => getEnvVar(name) === undefined);
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Log environment configuration (safe, no secrets)
 */
export function logEnvConfig(): void {
  if (import.meta.env.DEV) {
    console.log('[Config] Environment:', {
      apiBaseUrl: getEnvVar('VITE_API_BASE_URL'),
      wsUrl: getEnvVar('VITE_WS_URL'),
      useMocks: getBoolEnv('VITE_USE_MOCKS'),
      debug: getBoolEnv('VITE_DEBUG'),
      features: {
        discoveryStudio: getFeatureFlag('discovery_studio'),
        cockpit: getFeatureFlag('cockpit'),
        docs: getFeatureFlag('docs'),
        artifacts: getFeatureFlag('artifacts'),
        rlmTrajectory: getFeatureFlag('rlm_trajectory'),
      },
    });
  }
}

/**
 * Typed environment configuration
 */
export const EnvConfig = {
  // API
  apiBaseUrl: getEnvVar('VITE_API_BASE_URL', '/api'),

  // WebSocket
  wsUrl: getEnvVar('VITE_WS_URL', 'ws://localhost:8080/ws'),
  wsReconnectAttempts: getNumericEnv('VITE_WS_RECONNECT_ATTEMPTS', 10),
  wsReconnectDelay: getNumericEnv('VITE_WS_RECONNECT_DELAY', 1000),

  // Multi-tenancy
  multiTenancyEnabled: getBoolEnv('VITE_MULTI_TENANCY_ENABLED'),
  allowedTenants: getEnvVar('VITE_ALLOWED_TENANTS', 'default')?.split(',') || ['default'],

  // Polling & Cache
  pollingInterval: getNumericEnv('VITE_POLLING_INTERVAL', 10000),
  queryStaleTime: getNumericEnv('VITE_QUERY_STALE_TIME', 300000),

  // Development
  useMocks: getBoolEnv('VITE_USE_MOCKS'),
  debug: getBoolEnv('VITE_DEBUG'),
  queryDevtools: getBoolEnv('VITE_QUERY_DEVTOOLS', true),

  // UI
  appTitle: getEnvVar('VITE_APP_TITLE', 'aSDLC Human-in-the-Loop'),
  defaultTheme: getEnvVar('VITE_DEFAULT_THEME', 'system') as 'light' | 'dark' | 'system',
  maxEventFeedSize: getNumericEnv('VITE_MAX_EVENT_FEED_SIZE', 100),

  // External
  gitProviderUrl: getEnvVar('VITE_GIT_PROVIDER_URL'),
  analyticsUrl: getEnvVar('VITE_ANALYTICS_URL'),

  // Feature Flags
  features: {
    discoveryStudio: getFeatureFlag('discovery_studio', true),
    cockpit: getFeatureFlag('cockpit', true),
    docs: getFeatureFlag('docs', true),
    artifacts: getFeatureFlag('artifacts', true),
    rlmTrajectory: getFeatureFlag('rlm_trajectory', true),
  },
} as const;

/**
 * Check if running in development mode
 */
export const isDev = import.meta.env.DEV;

/**
 * Check if running in production mode
 */
export const isProd = import.meta.env.PROD;
