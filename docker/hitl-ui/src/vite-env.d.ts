/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_MULTI_TENANCY_ENABLED: string;
  readonly VITE_ALLOWED_TENANTS: string;
  readonly VITE_POLLING_INTERVAL: string;
  readonly VITE_USE_MOCKS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
