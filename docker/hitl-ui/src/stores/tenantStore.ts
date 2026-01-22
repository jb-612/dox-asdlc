import { create } from 'zustand';

interface TenantState {
  currentTenant: string;
  availableTenants: string[];
  multiTenancyEnabled: boolean;
  setTenant: (tenant: string) => void;
  setAvailableTenants: (tenants: string[]) => void;
}

// Get configuration from environment variables
const MULTI_TENANCY_ENABLED =
  import.meta.env.VITE_MULTI_TENANCY_ENABLED === 'true';
const ALLOWED_TENANTS = (
  import.meta.env.VITE_ALLOWED_TENANTS || 'default'
).split(',');

export const useTenantStore = create<TenantState>((set) => ({
  currentTenant: ALLOWED_TENANTS[0] || 'default',
  availableTenants: ALLOWED_TENANTS,
  multiTenancyEnabled: MULTI_TENANCY_ENABLED,
  setTenant: (tenant) => set({ currentTenant: tenant }),
  setAvailableTenants: (tenants) => set({ availableTenants: tenants }),
}));
