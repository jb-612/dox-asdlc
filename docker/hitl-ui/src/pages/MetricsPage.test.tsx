/**
 * Integration tests for MetricsPage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MetricsPage from './MetricsPage';
import { useMetricsStore } from '../stores/metricsStore';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock the API module
vi.mock('../api/metrics', async () => {
  const actual = await vi.importActual('../api/metrics');
  return {
    ...actual,
    useServices: () => ({
      data: [
        { name: 'orchestrator', displayName: 'Orchestrator', healthy: true },
        { name: 'worker-pool', displayName: 'Worker Pool', healthy: true },
      ],
      isLoading: false,
      error: null,
    }),
    useCPUMetrics: () => ({
      data: {
        metric: 'cpu_usage_percent',
        service: 'cluster',
        dataPoints: [
          { timestamp: '2026-01-25T11:00:00Z', value: 40 },
          { timestamp: '2026-01-25T11:01:00Z', value: 45 },
        ],
      },
      isLoading: false,
      error: null,
    }),
    useMemoryMetrics: () => ({
      data: {
        metric: 'memory_usage_percent',
        service: 'cluster',
        dataPoints: [
          { timestamp: '2026-01-25T11:00:00Z', value: 55 },
          { timestamp: '2026-01-25T11:01:00Z', value: 58 },
        ],
      },
      isLoading: false,
      error: null,
    }),
    useRequestRateMetrics: () => ({
      data: {
        metric: 'request_rate',
        service: 'cluster',
        dataPoints: [
          { timestamp: '2026-01-25T11:00:00Z', value: 150 },
          { timestamp: '2026-01-25T11:01:00Z', value: 180 },
        ],
      },
      isLoading: false,
      error: null,
    }),
    useLatencyMetrics: () => ({
      data: {
        p50: {
          metric: 'latency_p50',
          service: 'cluster',
          dataPoints: [
            { timestamp: '2026-01-25T11:00:00Z', value: 25 },
            { timestamp: '2026-01-25T11:01:00Z', value: 28 },
          ],
        },
        p95: {
          metric: 'latency_p95',
          service: 'cluster',
          dataPoints: [
            { timestamp: '2026-01-25T11:00:00Z', value: 80 },
            { timestamp: '2026-01-25T11:01:00Z', value: 85 },
          ],
        },
        p99: {
          metric: 'latency_p99',
          service: 'cluster',
          dataPoints: [
            { timestamp: '2026-01-25T11:00:00Z', value: 150 },
            { timestamp: '2026-01-25T11:01:00Z', value: 160 },
          ],
        },
      },
      isLoading: false,
      error: null,
    }),
    useActiveTasks: () => ({
      data: {
        activeTasks: 12,
        maxTasks: 50,
        activeWorkers: 4,
        lastUpdated: '2026-01-25T12:00:00Z',
      },
      isLoading: false,
      error: null,
    }),
  };
});

describe('MetricsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    useMetricsStore.getState().reset();
  });

  const renderWithProviders = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MetricsPage />
      </QueryClientProvider>
    );
  };

  describe('Page Structure', () => {
    it('renders with data-testid', () => {
      renderWithProviders();
      expect(screen.getByTestId('metrics-page')).toBeInTheDocument();
    });

    it('renders page title', () => {
      renderWithProviders();
      expect(screen.getByText('Metrics Dashboard')).toBeInTheDocument();
    });

    it('renders page subtitle', () => {
      renderWithProviders();
      expect(screen.getByText('Monitor system health and performance')).toBeInTheDocument();
    });

    it('has role="main" for accessibility', () => {
      renderWithProviders();
      expect(screen.getByTestId('metrics-page')).toHaveAttribute('role', 'main');
    });
  });

  describe('Header Controls', () => {
    it('renders service selector', () => {
      renderWithProviders();
      expect(screen.getByTestId('service-selector')).toBeInTheDocument();
    });

    it('renders time range selector', () => {
      renderWithProviders();
      expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
    });

    it('renders auto-refresh toggle', () => {
      renderWithProviders();
      expect(screen.getByTestId('auto-refresh-toggle')).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      renderWithProviders();
      expect(screen.getByTestId('page-refresh')).toBeInTheDocument();
    });
  });

  describe('Chart Sections', () => {
    it('renders resource metrics section', () => {
      renderWithProviders();
      expect(screen.getByTestId('resource-metrics-section')).toBeInTheDocument();
      expect(screen.getByText('Resource Utilization')).toBeInTheDocument();
    });

    it('renders request metrics section', () => {
      renderWithProviders();
      expect(screen.getByTestId('request-metrics-section')).toBeInTheDocument();
      expect(screen.getByText('Request Metrics')).toBeInTheDocument();
    });

    it('renders tasks metrics section', () => {
      renderWithProviders();
      expect(screen.getByTestId('tasks-metrics-section')).toBeInTheDocument();
      expect(screen.getByText('Task Activity')).toBeInTheDocument();
    });

    it('renders CPU chart', () => {
      renderWithProviders();
      expect(screen.getByTestId('cpu-chart')).toBeInTheDocument();
    });

    it('renders memory chart', () => {
      renderWithProviders();
      expect(screen.getByTestId('memory-chart')).toBeInTheDocument();
    });

    it('renders request rate chart', () => {
      renderWithProviders();
      expect(screen.getByTestId('request-rate-chart')).toBeInTheDocument();
    });

    it('renders latency chart', () => {
      renderWithProviders();
      expect(screen.getByTestId('latency-chart')).toBeInTheDocument();
    });

    it('renders active tasks gauge', () => {
      renderWithProviders();
      expect(screen.getByTestId('active-tasks-gauge')).toBeInTheDocument();
    });
  });

  describe('Auto-Refresh Toggle', () => {
    it('auto-refresh is enabled by default', () => {
      renderWithProviders();
      const toggle = screen.getByTestId('auto-refresh-toggle');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('toggles auto-refresh on click', () => {
      renderWithProviders();
      const toggle = screen.getByTestId('auto-refresh-toggle');

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Time Range Selection', () => {
    it('updates time range when selected', () => {
      renderWithProviders();

      fireEvent.click(screen.getByTestId('time-range-6h'));

      expect(useMetricsStore.getState().timeRange).toBe('6h');
    });
  });

  describe('Metrics Grid', () => {
    it('renders metrics grid', () => {
      renderWithProviders();
      expect(screen.getByTestId('metrics-grid')).toBeInTheDocument();
    });
  });
});
