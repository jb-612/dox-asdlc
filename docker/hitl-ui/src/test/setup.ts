import '@testing-library/jest-dom';

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_BASE_URL: '/api',
    VITE_MULTI_TENANCY_ENABLED: 'false',
    VITE_ALLOWED_TENANTS: 'default',
    VITE_POLLING_INTERVAL: '10000',
    VITE_USE_MOCKS: 'true',
    DEV: true,
    PROD: false,
    MODE: 'test',
  },
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
