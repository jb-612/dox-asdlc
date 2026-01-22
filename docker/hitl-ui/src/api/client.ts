import axios from 'axios';

// Get API base URL from environment or default to relative /api
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Create axios instance with default configuration
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor for adding auth headers, logging, etc.
apiClient.interceptors.request.use(
  (config) => {
    // Add tenant header if multi-tenancy is enabled
    const tenant = sessionStorage.getItem('currentTenant');
    if (tenant) {
      config.headers['X-Tenant-ID'] = tenant;
    }

    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Log errors in development
    if (import.meta.env.DEV) {
      console.error('[API Error]', error.response?.data || error.message);
    }

    // Handle specific error codes
    if (error.response?.status === 401) {
      // Handle unauthorized - could redirect to login
      console.warn('Unauthorized request');
    }

    if (error.response?.status === 404) {
      // Resource not found
      console.warn('Resource not found:', error.config?.url);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
