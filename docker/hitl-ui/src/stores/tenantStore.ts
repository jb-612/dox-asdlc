import { create } from 'zustand';

/**
 * Session storage key for persisting tenant selection
 */
const TENANT_STORAGE_KEY = 'asdlc:currentTenant';

interface TenantState {
  /** Currently selected tenant ID */
  currentTenant: string;
  /** List of available tenant IDs from configuration */
  availableTenants: string[];
  /** Whether multi-tenancy is enabled */
  multiTenancyEnabled: boolean;
  /**
   * Set the current tenant and persist to session storage.
   * The tenant ID will be included in X-Tenant-ID header on all API requests.
   */
  setTenant: (tenant: string) => void;
  /** Update the list of available tenants */
  setAvailableTenants: (tenants: string[]) => void;
  /**
   * Initialize tenant from session storage if available.
   * Call this on app startup to restore the user's previous selection.
   */
  initializeFromSession: () => void;
}

// Get configuration from environment variables
const MULTI_TENANCY_ENABLED =
  import.meta.env.VITE_MULTI_TENANCY_ENABLED === 'true';
const ALLOWED_TENANTS = (
  import.meta.env.VITE_ALLOWED_TENANTS || 'default'
).split(',').map((t: string) => t.trim()).filter(Boolean);

/**
 * Get initial tenant from session storage or use first allowed tenant
 */
function getInitialTenant(): string {
  // Try to restore from session storage
  const storedTenant = sessionStorage.getItem(TENANT_STORAGE_KEY);
  if (storedTenant && ALLOWED_TENANTS.includes(storedTenant)) {
    return storedTenant;
  }
  // Fall back to first allowed tenant or default
  return ALLOWED_TENANTS[0] || 'default';
}

export const useTenantStore = create<TenantState>((set, get) => ({
  currentTenant: getInitialTenant(),
  availableTenants: ALLOWED_TENANTS,
  multiTenancyEnabled: MULTI_TENANCY_ENABLED,

  setTenant: (tenant: string) => {
    // Validate tenant is in allowed list
    const { availableTenants } = get();
    if (!availableTenants.includes(tenant)) {
      console.warn(`Tenant "${tenant}" is not in allowed tenants list`);
      return;
    }

    // Persist to session storage for API client interceptor
    sessionStorage.setItem(TENANT_STORAGE_KEY, tenant);

    // Update state
    set({ currentTenant: tenant });
  },

  setAvailableTenants: (tenants: string[]) => {
    set({ availableTenants: tenants });

    // If current tenant is not in new list, switch to first available
    const { currentTenant } = get();
    if (!tenants.includes(currentTenant) && tenants.length > 0) {
      const newTenant = tenants[0];
      sessionStorage.setItem(TENANT_STORAGE_KEY, newTenant);
      set({ currentTenant: newTenant });
    }
  },

  initializeFromSession: () => {
    const storedTenant = sessionStorage.getItem(TENANT_STORAGE_KEY);
    if (storedTenant) {
      const { availableTenants } = get();
      if (availableTenants.includes(storedTenant)) {
        set({ currentTenant: storedTenant });
      }
    }
  },
}));

/**
 * Get the current tenant ID for use outside React components.
 * Reads directly from session storage to ensure consistency with API client.
 */
export function getCurrentTenantId(): string | null {
  return sessionStorage.getItem(TENANT_STORAGE_KEY);
}
