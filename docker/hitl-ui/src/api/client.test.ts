import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';

describe('apiClient tenant header', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    // Reset module cache to get fresh interceptor
    vi.resetModules();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('includes X-Tenant-ID header when tenant is set in sessionStorage', async () => {
    // Set tenant in sessionStorage
    sessionStorage.setItem('currentTenant', 'acme-corp');

    // Import client fresh
    const { apiClient } = await import('./client');

    // Get the request interceptor by inspecting the client
    // The interceptor modifies config before requests are sent
    const config: InternalAxiosRequestConfig = {
      headers: {} as InternalAxiosRequestConfig['headers'],
      url: '/test',
      method: 'get',
    };

    // Find the request interceptor (first one in the handlers array)
    const requestInterceptor = (apiClient.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }>;
    }).handlers[0];

    const modifiedConfig = requestInterceptor.fulfilled(config);

    expect(modifiedConfig.headers['X-Tenant-ID']).toBe('acme-corp');
  });

  it('does not include X-Tenant-ID header when no tenant is set', async () => {
    // Ensure sessionStorage is empty
    sessionStorage.removeItem('currentTenant');

    // Import client fresh
    const { apiClient } = await import('./client');

    const config: InternalAxiosRequestConfig = {
      headers: {} as InternalAxiosRequestConfig['headers'],
      url: '/test',
      method: 'get',
    };

    const requestInterceptor = (apiClient.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }>;
    }).handlers[0];

    const modifiedConfig = requestInterceptor.fulfilled(config);

    // Header should not be present
    expect(modifiedConfig.headers['X-Tenant-ID']).toBeUndefined();
  });

  it('updates X-Tenant-ID header when tenant changes', async () => {
    const { apiClient } = await import('./client');

    const requestInterceptor = (apiClient.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }>;
    }).handlers[0];

    // First request with tenant-a
    sessionStorage.setItem('currentTenant', 'tenant-a');
    const config1: InternalAxiosRequestConfig = {
      headers: {} as InternalAxiosRequestConfig['headers'],
      url: '/test',
      method: 'get',
    };
    const modifiedConfig1 = requestInterceptor.fulfilled(config1);
    expect(modifiedConfig1.headers['X-Tenant-ID']).toBe('tenant-a');

    // Change tenant
    sessionStorage.setItem('currentTenant', 'tenant-b');
    const config2: InternalAxiosRequestConfig = {
      headers: {} as InternalAxiosRequestConfig['headers'],
      url: '/test',
      method: 'get',
    };
    const modifiedConfig2 = requestInterceptor.fulfilled(config2);
    expect(modifiedConfig2.headers['X-Tenant-ID']).toBe('tenant-b');
  });

  it('reads tenant from sessionStorage on each request', async () => {
    const { apiClient } = await import('./client');

    const requestInterceptor = (apiClient.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }>;
    }).handlers[0];

    // No tenant initially
    const config1: InternalAxiosRequestConfig = {
      headers: {} as InternalAxiosRequestConfig['headers'],
      url: '/test',
      method: 'get',
    };
    const result1 = requestInterceptor.fulfilled(config1);
    expect(result1.headers['X-Tenant-ID']).toBeUndefined();

    // Set tenant
    sessionStorage.setItem('currentTenant', 'new-tenant');

    // Next request should include tenant
    const config2: InternalAxiosRequestConfig = {
      headers: {} as InternalAxiosRequestConfig['headers'],
      url: '/test',
      method: 'get',
    };
    const result2 = requestInterceptor.fulfilled(config2);
    expect(result2.headers['X-Tenant-ID']).toBe('new-tenant');
  });
});
