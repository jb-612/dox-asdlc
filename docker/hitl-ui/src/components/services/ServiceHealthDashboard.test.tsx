/**
 * ServiceHealthDashboard Tests
 *
 * T25: Tests for the main service health dashboard component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceHealthDashboard from './ServiceHealthDashboard';
import * as servicesApi from '../../api/services';

// Mock the API hooks
vi.mock('../../api/services', async () => {
  const actual = await vi.importActual<typeof import('../../api/services')>('../../api/services');
  return {
    ...actual,
    useServicesHealth: vi.fn(),
    useServiceSparkline: vi.fn(),
    servicesQueryKeys: actual.servicesQueryKeys,
  };
});

// Create fresh query client for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

// Mock data
const mockServices = [
  {
    name: 'hitl-ui',
    status: 'healthy' as const,
    cpuPercent: 25,
    memoryPercent: 45,
    podCount: 1,
    requestRate: 50.5,
    latencyP50: 12,
  },
  {
    name: 'orchestrator',
    status: 'healthy' as const,
    cpuPercent: 42,
    memoryPercent: 58,
    podCount: 2,
    requestRate: 145.2,
    latencyP50: 28,
  },
  {
    name: 'workers',
    status: 'degraded' as const,
    cpuPercent: 72,
    memoryPercent: 68,
    podCount: 3,
    requestRate: 285.7,
    latencyP50: 95,
    lastRestart: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    name: 'redis',
    status: 'healthy' as const,
    cpuPercent: 15,
    memoryPercent: 52,
    podCount: 1,
  },
  {
    name: 'elasticsearch',
    status: 'healthy' as const,
    cpuPercent: 55,
    memoryPercent: 72,
    podCount: 1,
  },
];

const mockConnections = [
  { from: 'hitl-ui', to: 'orchestrator', type: 'http' as const },
  { from: 'orchestrator', to: 'workers', type: 'http' as const },
  { from: 'orchestrator', to: 'redis', type: 'redis' as const },
];

const mockHealthResponse = {
  services: mockServices,
  connections: mockConnections,
  timestamp: new Date().toISOString(),
};

const mockSparklineData = {
  service: 'hitl-ui',
  metric: 'cpu',
  dataPoints: [
    { timestamp: Date.now() - 60000, value: 24 },
    { timestamp: Date.now() - 30000, value: 26 },
    { timestamp: Date.now(), value: 25 },
  ],
  interval: '30s',
  duration: '15m',
};

describe('ServiceHealthDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Loading State', () => {
    it('renders loading skeleton when loading', () => {
      vi.mocked(servicesApi.useServicesHealth).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof servicesApi.useServicesHealth>);

      vi.mocked(servicesApi.useServiceSparkline).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as unknown as ReturnType<typeof servicesApi.useServiceSparkline>);

      renderWithProviders(<ServiceHealthDashboard />);

      expect(screen.getByTestId('service-health-dashboard-loading')).toBeInTheDocument();
    });
  });

  describe('Renders with Data', () => {
    beforeEach(() => {
      vi.mocked(servicesApi.useServicesHealth).mockReturnValue({
        data: mockHealthResponse,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof servicesApi.useServicesHealth>);

      vi.mocked(servicesApi.useServiceSparkline).mockReturnValue({
        data: mockSparklineData,
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof servicesApi.useServiceSparkline>);
    });

    it('renders the dashboard container', () => {
      renderWithProviders(<ServiceHealthDashboard />);

      expect(screen.getByTestId('service-health-dashboard')).toBeInTheDocument();
    });

    it('renders the service health list', () => {
      renderWithProviders(<ServiceHealthDashboard />);

      expect(screen.getByTestId('service-health-list')).toBeInTheDocument();
    });

    it('renders service cards grid', () => {
      renderWithProviders(<ServiceHealthDashboard />);

      expect(screen.getByTestId('service-cards-grid')).toBeInTheDocument();
    });

    it('renders one card per service', () => {
      renderWithProviders(<ServiceHealthDashboard />);

      const cards = screen.getAllByTestId('service-card');
      expect(cards.length).toBe(mockServices.length);
    });

    it('renders the header with title', () => {
      renderWithProviders(<ServiceHealthDashboard />);

      expect(screen.getByText('Service Health')).toBeInTheDocument();
    });

    it('renders refresh controls', () => {
      renderWithProviders(<ServiceHealthDashboard />);

      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('renders auto-refresh indicator', () => {
      renderWithProviders(<ServiceHealthDashboard />);

      expect(screen.getByTestId('auto-refresh-indicator')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('renders error message with retry button', () => {
      const mockError = new Error('Failed to fetch services');
      vi.mocked(servicesApi.useServicesHealth).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof servicesApi.useServicesHealth>);

      vi.mocked(servicesApi.useServiceSparkline).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof servicesApi.useServiceSparkline>);

      renderWithProviders(<ServiceHealthDashboard />);

      expect(screen.getByTestId('service-health-dashboard-error')).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch services/)).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });

    it('retry button calls refetch', async () => {
      const mockRefetch = vi.fn();
      const mockError = new Error('Failed to fetch services');
      vi.mocked(servicesApi.useServicesHealth).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch,
      } as unknown as ReturnType<typeof servicesApi.useServicesHealth>);

      vi.mocked(servicesApi.useServiceSparkline).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof servicesApi.useServiceSparkline>);

      renderWithProviders(<ServiceHealthDashboard />);

      const retryButton = screen.getByTestId('retry-button');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  describe('Refresh Controls', () => {
    it('refresh button calls refetch', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(servicesApi.useServicesHealth).mockReturnValue({
        data: mockHealthResponse,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      } as unknown as ReturnType<typeof servicesApi.useServicesHealth>);

      vi.mocked(servicesApi.useServiceSparkline).mockReturnValue({
        data: mockSparklineData,
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof servicesApi.useServiceSparkline>);

      renderWithProviders(<ServiceHealthDashboard />);

      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  describe('ServiceCard Click Handler', () => {
    it('calls onServiceClick when a service card is clicked', async () => {
      const mockOnServiceClick = vi.fn();
      vi.mocked(servicesApi.useServicesHealth).mockReturnValue({
        data: mockHealthResponse,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof servicesApi.useServicesHealth>);

      vi.mocked(servicesApi.useServiceSparkline).mockReturnValue({
        data: mockSparklineData,
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof servicesApi.useServiceSparkline>);

      renderWithProviders(<ServiceHealthDashboard onServiceClick={mockOnServiceClick} />);

      const cards = screen.getAllByTestId('service-card');
      fireEvent.click(cards[0]);

      await waitFor(() => {
        expect(mockOnServiceClick).toHaveBeenCalledWith(mockServices[0].name);
      });
    });
  });

  describe('Responsive Grid', () => {
    it('renders grid with responsive classes', () => {
      vi.mocked(servicesApi.useServicesHealth).mockReturnValue({
        data: mockHealthResponse,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof servicesApi.useServicesHealth>);

      vi.mocked(servicesApi.useServiceSparkline).mockReturnValue({
        data: mockSparklineData,
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof servicesApi.useServiceSparkline>);

      renderWithProviders(<ServiceHealthDashboard />);

      const grid = screen.getByTestId('service-cards-grid');
      // Check for responsive grid classes
      expect(grid).toHaveClass('grid');
    });
  });
});
