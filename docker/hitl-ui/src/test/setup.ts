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

// Mock ResizeObserver (used by @headlessui/react Dialog component)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Mock getComputedStyle for scrollbar width calculations
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (element: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(element, pseudoElt);
  // Return a default scrollbar width of 0 for tests
  return {
    ...style,
    getPropertyValue: (prop: string) => {
      if (prop === 'scrollbar-width') return '0';
      return style.getPropertyValue(prop);
    },
  };
};
