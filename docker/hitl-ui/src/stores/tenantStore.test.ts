import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

describe('tenantStore', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    vi.clearAllMocks();
    // Reset modules to get fresh store state
    vi.resetModules();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('initializes with default tenant', async () => {
    const { useTenantStore } = await import('./tenantStore');
    const { result } = renderHook(() => useTenantStore());

    expect(result.current.currentTenant).toBe('default');
    expect(result.current.availableTenants).toContain('default');
  });

  it('persists tenant selection to sessionStorage when setTenant is called', async () => {
    const { useTenantStore } = await import('./tenantStore');
    const { result } = renderHook(() => useTenantStore());

    // First, add the tenant to available list
    act(() => {
      result.current.setAvailableTenants(['default', 'tenant-a', 'tenant-b']);
    });

    // Now set the tenant
    act(() => {
      result.current.setTenant('tenant-a');
    });

    expect(result.current.currentTenant).toBe('tenant-a');
    expect(sessionStorage.getItem('currentTenant')).toBe('tenant-a');
  });

  it('restores tenant from sessionStorage on initialization', async () => {
    // Set up sessionStorage before importing the module
    sessionStorage.setItem('currentTenant', 'default');

    const { useTenantStore } = await import('./tenantStore');
    const { result } = renderHook(() => useTenantStore());

    // The store should have initialized from session storage
    expect(result.current.currentTenant).toBe('default');
  });

  it('updates availableTenants when setAvailableTenants is called', async () => {
    const { useTenantStore } = await import('./tenantStore');
    const { result } = renderHook(() => useTenantStore());

    act(() => {
      result.current.setAvailableTenants(['tenant-a', 'tenant-b', 'tenant-c']);
    });

    expect(result.current.availableTenants).toEqual(['tenant-a', 'tenant-b', 'tenant-c']);
  });

  it('maintains current tenant when available tenants are updated and current is still valid', async () => {
    const { useTenantStore } = await import('./tenantStore');
    const { result } = renderHook(() => useTenantStore());

    // Set available tenants first
    act(() => {
      result.current.setAvailableTenants(['default', 'tenant-a', 'tenant-b']);
    });

    // Set current tenant
    act(() => {
      result.current.setTenant('tenant-a');
    });

    // Update available tenants (including current)
    act(() => {
      result.current.setAvailableTenants(['default', 'tenant-a', 'tenant-c']);
    });

    expect(result.current.currentTenant).toBe('tenant-a');
  });

  it('switches to first available tenant when current is removed from list', async () => {
    const { useTenantStore } = await import('./tenantStore');
    const { result } = renderHook(() => useTenantStore());

    // Set available tenants first
    act(() => {
      result.current.setAvailableTenants(['default', 'tenant-a', 'tenant-b']);
    });

    // Set current tenant
    act(() => {
      result.current.setTenant('tenant-a');
    });

    // Update available tenants (excluding current)
    act(() => {
      result.current.setAvailableTenants(['default', 'tenant-c']);
    });

    // Should switch to first available
    expect(result.current.currentTenant).toBe('default');
    expect(sessionStorage.getItem('currentTenant')).toBe('default');
  });

  it('does not set tenant if not in allowed list', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { useTenantStore } = await import('./tenantStore');
    const { result } = renderHook(() => useTenantStore());

    const originalTenant = result.current.currentTenant;

    act(() => {
      result.current.setTenant('invalid-tenant');
    });

    // Should not change
    expect(result.current.currentTenant).toBe(originalTenant);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Tenant "invalid-tenant" is not in allowed tenants list'
    );

    consoleSpy.mockRestore();
  });

  it('initializeFromSession restores tenant from storage', async () => {
    const { useTenantStore } = await import('./tenantStore');
    const { result } = renderHook(() => useTenantStore());

    // Set up available tenants
    act(() => {
      result.current.setAvailableTenants(['default', 'tenant-x']);
    });

    // Manually set session storage
    sessionStorage.setItem('currentTenant', 'tenant-x');

    // Call initialize
    act(() => {
      result.current.initializeFromSession();
    });

    expect(result.current.currentTenant).toBe('tenant-x');
  });
});

describe('getCurrentTenantId', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns null when no tenant is stored', async () => {
    const { getCurrentTenantId } = await import('./tenantStore');

    expect(getCurrentTenantId()).toBeNull();
  });

  it('returns tenant ID from session storage', async () => {
    sessionStorage.setItem('currentTenant', 'test-tenant');

    const { getCurrentTenantId } = await import('./tenantStore');

    expect(getCurrentTenantId()).toBe('test-tenant');
  });
});
