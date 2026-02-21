/**
 * Shared test utilities for the HITL UI test suite.
 *
 * Re-exports @testing-library/react with a custom `render` function that
 * wraps components in the providers required by most pages/components
 * (BrowserRouter, QueryClientProvider).
 *
 * Usage:
 *   import { render, screen } from '@/test/test-utils';
 */

import React, { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Create a fresh QueryClient configured for tests (no retries).
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * AllProviders wraps children in BrowserRouter + QueryClientProvider.
 * A new QueryClient is created per render to avoid shared state between tests.
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

/**
 * Custom render that wraps the component under test in all required providers.
 * Accepts the same options as @testing-library/react `render`.
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from @testing-library/react so tests only need one import.
export * from '@testing-library/react';

// Override `render` with the custom version.
export { customRender as render, createTestQueryClient };
