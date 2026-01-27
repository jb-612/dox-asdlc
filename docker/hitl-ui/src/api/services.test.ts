/**
 * Tests for service health API hooks
 *
 * T15: API functions and React Query hooks for service health data
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  getServicesHealth,
  getServiceSparkline,
  useServicesHealth,
  useServiceSparkline,
  servicesQueryKeys,
} from './services';
import { apiClient } from './client';
import type { ServicesHealthResponse, ServiceSparklineResponse } from './types/services';

// Mock axios client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('Services API', () => {
  const mockServicesHealthResponse: ServicesHealthResponse = {
    services: [
      {
        name: 'orchestrator',
        status: 'healthy',
        cpuPercent: 45,
        memoryPercent: 60,
        podCount: 2,
        requestRate: 150,
        latencyP50: 25,
      },
      {
        name: 'workers',
        status: 'degraded',
        cpuPercent: 75,
        memoryPercent: 70,
        podCount: 3,
      },
    ],
    connections: [
      { from: 'hitl-ui', to: 'orchestrator', type: 'http' },
      { from: 'orchestrator', to: 'workers', type: 'http' },
    ],
    timestamp: '2026-01-27T10:00:00Z',
  };

  const mockSparklineResponse: ServiceSparklineResponse = {
    service: 'orchestrator',
    metric: 'cpu',
    dataPoints: [
      { timestamp: 1706180400000, value: 40 },
      { timestamp: 1706180460000, value: 45 },
      { timestamp: 1706180520000, value: 42 },
    ],
    interval: '15s',
    duration: '15m',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getServicesHealth', () => {
    it('calls correct API endpoint when useMock is false', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockServicesHealthResponse });

      await getServicesHealth({ useMock: false });

      expect(apiClient.get).toHaveBeenCalledWith('/metrics/services/health');
    });

    it('returns services health response from API', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockServicesHealthResponse });

      const result = await getServicesHealth({ useMock: false });

      expect(result).toEqual(mockServicesHealthResponse);
    });

    it('returns mock data when useMock is true', async () => {
      const result = await getServicesHealth({ useMock: true });

      expect(result).toBeDefined();
      expect(result.services).toBeDefined();
      expect(Array.isArray(result.services)).toBe(true);
      // Should not call API when using mocks
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('throws error when API fails and useMock is false', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      await expect(getServicesHealth({ useMock: false })).rejects.toThrow('Network error');
    });
  });

  describe('getServiceSparkline', () => {
    it('calls correct API endpoint with service name and metric', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockSparklineResponse });

      await getServiceSparkline('orchestrator', 'cpu', { useMock: false });

      expect(apiClient.get).toHaveBeenCalledWith(
        '/metrics/services/orchestrator/sparkline',
        { params: { metric: 'cpu' } }
      );
    });

    it('returns sparkline data from API', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockSparklineResponse });

      const result = await getServiceSparkline('orchestrator', 'cpu', { useMock: false });

      expect(result).toEqual(mockSparklineResponse);
    });

    it('returns mock data when useMock is true', async () => {
      const result = await getServiceSparkline('orchestrator', 'cpu', { useMock: true });

      expect(result).toBeDefined();
      expect(result.dataPoints).toBeDefined();
      expect(Array.isArray(result.dataPoints)).toBe(true);
      // Should not call API when using mocks
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('Query Keys', () => {
    it('generates correct key for services health', () => {
      const key = servicesQueryKeys.health();
      expect(key).toEqual(['services', 'health']);
    });

    it('generates correct key for service sparkline', () => {
      const key = servicesQueryKeys.sparkline('orchestrator', 'cpu');
      expect(key).toEqual(['services', 'sparkline', 'orchestrator', 'cpu']);
    });

    it('generates unique keys for different services', () => {
      const key1 = servicesQueryKeys.sparkline('orchestrator', 'cpu');
      const key2 = servicesQueryKeys.sparkline('workers', 'cpu');
      expect(key1).not.toEqual(key2);
    });

    it('generates unique keys for different metrics', () => {
      const key1 = servicesQueryKeys.sparkline('orchestrator', 'cpu');
      const key2 = servicesQueryKeys.sparkline('orchestrator', 'memory');
      expect(key1).not.toEqual(key2);
    });
  });
});

describe('Services Hooks', () => {
  let queryClient: QueryClient;

  const mockServicesHealthResponse: ServicesHealthResponse = {
    services: [
      {
        name: 'orchestrator',
        status: 'healthy',
        cpuPercent: 45,
        memoryPercent: 60,
        podCount: 2,
      },
    ],
    connections: [],
    timestamp: '2026-01-27T10:00:00Z',
  };

  const mockSparklineResponse: ServiceSparklineResponse = {
    service: 'orchestrator',
    metric: 'cpu',
    dataPoints: [
      { timestamp: 1706180400000, value: 40 },
      { timestamp: 1706180460000, value: 45 },
    ],
    interval: '15s',
    duration: '15m',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  describe('useServicesHealth', () => {
    it('fetches services health data from API', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockServicesHealthResponse });

      const { result } = renderHook(() => useServicesHealth({ useMock: false }), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockServicesHealthResponse);
    });

    it('uses mock data when useMock is true', async () => {
      const { result } = renderHook(() => useServicesHealth({ useMock: true }), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.services).toBeDefined();
      // API should not be called
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('returns loading state initially', () => {
      vi.mocked(apiClient.get).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useServicesHealth({ useMock: false }), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('returns error state on failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useServicesHealth({ useMock: false }), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useServiceSparkline', () => {
    it('fetches sparkline data for specific service and metric', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockSparklineResponse });

      const { result } = renderHook(
        () => useServiceSparkline('orchestrator', 'cpu', { useMock: false }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockSparklineResponse);
    });

    it('uses mock data when useMock is true', async () => {
      const { result } = renderHook(
        () => useServiceSparkline('orchestrator', 'cpu', { useMock: true }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.dataPoints).toBeDefined();
      // API should not be called
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('is disabled when service name is null', () => {
      const { result } = renderHook(
        () => useServiceSparkline(null, 'cpu'),
        { wrapper }
      );

      expect(result.current.isFetching).toBe(false);
    });

    it('is disabled when metric is null', () => {
      const { result } = renderHook(
        () => useServiceSparkline('orchestrator', null),
        { wrapper }
      );

      expect(result.current.isFetching).toBe(false);
    });
  });
});
