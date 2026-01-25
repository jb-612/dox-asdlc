/**
 * Tests for HealthCheckPanel component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HealthCheckPanel from './HealthCheckPanel';
import type { HealthCheckResult } from '../../api/types/kubernetes';

// Mock the API module
vi.mock('../../api/kubernetes', () => ({
  useRunHealthCheck: () => ({
    mutate: vi.fn((type, options) => {
      // Simulate successful health check
      setTimeout(() => {
        options.onSuccess({
          type,
          status: 'pass',
          message: `${type} check passed`,
          details: { test: 'data' },
          duration: 100,
          timestamp: new Date().toISOString(),
        });
      }, 10);
    }),
    isPending: false,
  }),
}));

// Wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('HealthCheckPanel', () => {
  const mockInitialResults: Record<string, HealthCheckResult> = {
    dns: {
      type: 'dns',
      status: 'pass',
      message: 'DNS resolution working',
      details: { resolved: 'test.local' },
      duration: 45,
      timestamp: '2026-01-25T10:00:00Z',
    },
    connectivity: {
      type: 'connectivity',
      status: 'warning',
      message: 'Some connectivity issues',
      details: { tested: 5, failed: 1 },
      duration: 230,
      timestamp: '2026-01-25T10:00:00Z',
    },
    storage: {
      type: 'storage',
      status: 'fail',
      message: 'Storage check failed',
      details: { error: 'PVC not bound' },
      duration: 120,
      timestamp: '2026-01-25T10:00:00Z',
    },
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<HealthCheckPanel />, { wrapper: createWrapper() });
      expect(screen.getByTestId('health-check-panel')).toBeInTheDocument();
    });

    it('renders all 7 health check buttons', () => {
      render(<HealthCheckPanel />, { wrapper: createWrapper() });
      expect(screen.getByTestId('health-check-dns')).toBeInTheDocument();
      expect(screen.getByTestId('health-check-connectivity')).toBeInTheDocument();
      expect(screen.getByTestId('health-check-storage')).toBeInTheDocument();
      expect(screen.getByTestId('health-check-api-server')).toBeInTheDocument();
      expect(screen.getByTestId('health-check-etcd')).toBeInTheDocument();
      expect(screen.getByTestId('health-check-scheduler')).toBeInTheDocument();
      expect(screen.getByTestId('health-check-controller')).toBeInTheDocument();
    });

    it('renders Run All button', () => {
      render(<HealthCheckPanel />, { wrapper: createWrapper() });
      expect(screen.getByTestId('run-all-button')).toBeInTheDocument();
    });

    it('renders health check grid', () => {
      render(<HealthCheckPanel />, { wrapper: createWrapper() });
      expect(screen.getByTestId('health-check-grid')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<HealthCheckPanel className="my-custom-class" />, { wrapper: createWrapper() });
      expect(screen.getByTestId('health-check-panel')).toHaveClass('my-custom-class');
    });
  });

  describe('Health Check Labels', () => {
    it('displays human-readable labels', () => {
      render(<HealthCheckPanel />, { wrapper: createWrapper() });
      expect(screen.getByText('DNS Resolution')).toBeInTheDocument();
      expect(screen.getByText('Pod Connectivity')).toBeInTheDocument();
      expect(screen.getByText('Storage (PV/PVC)')).toBeInTheDocument();
      expect(screen.getByText('API Server')).toBeInTheDocument();
      expect(screen.getByText('etcd Cluster')).toBeInTheDocument();
      expect(screen.getByText('Scheduler')).toBeInTheDocument();
      expect(screen.getByText('Controller Manager')).toBeInTheDocument();
    });
  });

  describe('Initial Results', () => {
    it('displays initial results when provided', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });

      // Check that results are shown
      expect(screen.getByText('DNS resolution working')).toBeInTheDocument();
      expect(screen.getByText('Some connectivity issues')).toBeInTheDocument();
      expect(screen.getByText('Storage check failed')).toBeInTheDocument();
    });

    it('shows status icons for initial results', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });

      // Each health check should have a status icon
      const statusIcons = screen.getAllByTestId('status-icon');
      expect(statusIcons.length).toBeGreaterThan(0);
    });

    it('shows duration for initial results', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });
      expect(screen.getByText('45ms')).toBeInTheDocument();
      expect(screen.getByText('230ms')).toBeInTheDocument();
    });
  });

  describe('Status Counts', () => {
    it('shows passed count', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });
      expect(screen.getByText(/1 passed/)).toBeInTheDocument();
    });

    it('shows warning count', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });
      expect(screen.getByText(/1 warnings/)).toBeInTheDocument();
    });

    it('shows failed count', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });
      expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    });
  });

  describe('Running Health Checks', () => {
    it('runs individual check when button clicked', async () => {
      render(<HealthCheckPanel />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('run-check-dns'));

      // Should show result after execution
      await waitFor(() => {
        expect(screen.getByText(/dns check passed/i)).toBeInTheDocument();
      });
    });

    it('runs all checks when Run All clicked', async () => {
      render(<HealthCheckPanel />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('run-all-button'));

      // Should show multiple results after execution
      await waitFor(() => {
        // All checks should have passed
        expect(screen.getAllByText(/check passed/i).length).toBeGreaterThan(1);
      });
    });
  });

  describe('Expandable Details', () => {
    it('shows expand button when result has details', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });
      expect(screen.getByTestId('expand-dns')).toBeInTheDocument();
    });

    it('expands details on click', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('expand-dns'));

      expect(screen.getByTestId('details-dns')).toBeInTheDocument();
    });

    it('collapses details on second click', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });

      // Expand
      fireEvent.click(screen.getByTestId('expand-dns'));
      expect(screen.getByTestId('details-dns')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByTestId('expand-dns'));
      expect(screen.queryByTestId('details-dns')).not.toBeInTheDocument();
    });

    it('shows JSON details in expanded view', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTestId('expand-dns'));

      expect(screen.getByText(/"resolved"/)).toBeInTheDocument();
    });
  });

  describe('Timestamp Display', () => {
    it('shows last run timestamp', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });
      expect(screen.getAllByText(/last run:/i).length).toBeGreaterThan(0);
    });
  });

  describe('Grid Layout', () => {
    it('renders in responsive grid', () => {
      render(<HealthCheckPanel />, { wrapper: createWrapper() });
      const grid = screen.getByTestId('health-check-grid');
      expect(grid).toHaveClass('grid');
      expect(grid).toHaveClass('sm:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
    });
  });

  describe('Status Styling', () => {
    it('applies success styling for pass status', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });
      const dnsCheck = screen.getByTestId('health-check-dns');
      expect(dnsCheck).toHaveClass('bg-status-success/10');
    });

    it('applies warning styling for warning status', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });
      const connectivityCheck = screen.getByTestId('health-check-connectivity');
      expect(connectivityCheck).toHaveClass('bg-status-warning/10');
    });

    it('applies error styling for fail status', () => {
      render(<HealthCheckPanel initialResults={mockInitialResults} />, { wrapper: createWrapper() });
      const storageCheck = screen.getByTestId('health-check-storage');
      expect(storageCheck).toHaveClass('bg-status-error/10');
    });
  });
});
