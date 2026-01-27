/**
 * Tests for ServiceCard component
 *
 * T13: Service card displaying health status and sparkline metrics
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ServiceCard from './ServiceCard';
import type { ServiceHealthInfo, SparklineDataPoint } from '../../api/types/services';

describe('ServiceCard', () => {
  const mockSparklineData: SparklineDataPoint[] = [
    { timestamp: 1706180400000, value: 30 },
    { timestamp: 1706180460000, value: 35 },
    { timestamp: 1706180520000, value: 45 },
    { timestamp: 1706180580000, value: 40 },
  ];

  const mockHealthyService: ServiceHealthInfo = {
    name: 'orchestrator',
    status: 'healthy',
    cpuPercent: 45,
    memoryPercent: 60,
    podCount: 2,
    requestRate: 150.5,
    latencyP50: 25,
    lastRestart: undefined,
  };

  const mockDegradedService: ServiceHealthInfo = {
    name: 'workers',
    status: 'degraded',
    cpuPercent: 75,
    memoryPercent: 82,
    podCount: 3,
    requestRate: 200,
    latencyP50: 150,
    lastRestart: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  };

  const mockUnhealthyService: ServiceHealthInfo = {
    name: 'redis',
    status: 'unhealthy',
    cpuPercent: 95,
    memoryPercent: 92,
    podCount: 1,
    requestRate: undefined,
    latencyP50: undefined,
    lastRestart: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
  };

  const mockServiceWithoutOptionalMetrics: ServiceHealthInfo = {
    name: 'elasticsearch',
    status: 'healthy',
    cpuPercent: 35,
    memoryPercent: 55,
    podCount: 3,
    requestRate: undefined,
    latencyP50: undefined,
    lastRestart: undefined,
  };

  describe('Renders all metrics', () => {
    it('displays service name as header', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.getByTestId('service-name')).toHaveTextContent('orchestrator');
    });

    it('displays health status badge', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.getByTestId('health-badge')).toBeInTheDocument();
      expect(screen.getByTestId('health-badge')).toHaveTextContent(/healthy/i);
    });

    it('displays CPU sparkline', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.getByTestId('cpu-sparkline')).toBeInTheDocument();
    });

    it('displays memory sparkline', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.getByTestId('memory-sparkline')).toBeInTheDocument();
    });

    it('displays CPU percentage value', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.getByTestId('cpu-value')).toHaveTextContent('45%');
    });

    it('displays memory percentage value', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.getByTestId('memory-value')).toHaveTextContent('60%');
    });

    it('displays request rate', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.getByTestId('request-rate')).toHaveTextContent(/150\.5.*req\/s/i);
    });

    it('displays latency p50', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.getByTestId('latency-p50')).toHaveTextContent(/25.*ms/i);
    });

    it('displays pod count', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.getByTestId('pod-count')).toHaveTextContent('2');
    });
  });

  describe('Shows correct status color', () => {
    it('shows green border for healthy status', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      const card = screen.getByTestId('service-card');
      expect(card).toHaveClass('border-status-success');
    });

    it('shows yellow/orange border for degraded status', () => {
      render(
        <ServiceCard
          service={mockDegradedService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      const card = screen.getByTestId('service-card');
      expect(card).toHaveClass('border-status-warning');
    });

    it('shows red border for unhealthy status', () => {
      render(
        <ServiceCard
          service={mockUnhealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      const card = screen.getByTestId('service-card');
      expect(card).toHaveClass('border-status-error');
    });

    it('shows correct badge color for healthy', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      const badge = screen.getByTestId('health-badge');
      expect(badge).toHaveClass('bg-status-success');
    });

    it('shows correct badge color for degraded', () => {
      render(
        <ServiceCard
          service={mockDegradedService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      const badge = screen.getByTestId('health-badge');
      expect(badge).toHaveClass('bg-status-warning');
    });

    it('shows correct badge color for unhealthy', () => {
      render(
        <ServiceCard
          service={mockUnhealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      const badge = screen.getByTestId('health-badge');
      expect(badge).toHaveClass('bg-status-error');
    });
  });

  describe('Hides optional metrics when null', () => {
    it('hides request rate when undefined', () => {
      render(
        <ServiceCard
          service={mockServiceWithoutOptionalMetrics}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.queryByTestId('request-rate')).not.toBeInTheDocument();
    });

    it('hides latency p50 when undefined', () => {
      render(
        <ServiceCard
          service={mockServiceWithoutOptionalMetrics}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.queryByTestId('latency-p50')).not.toBeInTheDocument();
    });

    it('hides last restart when undefined', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.queryByTestId('last-restart')).not.toBeInTheDocument();
    });

    it('shows last restart when within 24 hours', () => {
      render(
        <ServiceCard
          service={mockDegradedService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.getByTestId('last-restart')).toBeInTheDocument();
      expect(screen.getByTestId('last-restart')).toHaveTextContent(/ago|restart/i);
    });

    it('hides last restart when older than 24 hours', () => {
      const oldRestartService: ServiceHealthInfo = {
        ...mockHealthyService,
        lastRestart: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
      };
      render(
        <ServiceCard
          service={oldRestartService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      expect(screen.queryByTestId('last-restart')).not.toBeInTheDocument();
    });
  });

  describe('Click handler fires', () => {
    it('calls onClick when card is clicked', () => {
      const onClick = vi.fn();
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
          onClick={onClick}
        />
      );

      fireEvent.click(screen.getByTestId('service-card'));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(mockHealthyService.name);
    });

    it('card is interactive when onClick provided', () => {
      const onClick = vi.fn();
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
          onClick={onClick}
        />
      );

      const card = screen.getByTestId('service-card');
      expect(card).toHaveClass('cursor-pointer');
    });

    it('card is not interactive when onClick not provided', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );

      const card = screen.getByTestId('service-card');
      expect(card).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Loading states', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
          isLoading
        />
      );
      expect(screen.getByTestId('service-card-loading')).toBeInTheDocument();
    });

    it('passes loading state to sparklines', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={[]}
          memorySparkline={[]}
          sparklineLoading
        />
      );
      // Sparklines should show their loading state
      expect(screen.getAllByTestId('sparkline-loading')).toHaveLength(2);
    });
  });

  describe('Accessibility', () => {
    it('has appropriate heading level for service name', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
        />
      );
      const heading = screen.getByRole('heading', { name: /orchestrator/i });
      expect(heading).toBeInTheDocument();
    });

    it('card has role button when clickable', () => {
      const onClick = vi.fn();
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
          onClick={onClick}
        />
      );
      const card = screen.getByTestId('service-card');
      expect(card).toHaveAttribute('role', 'button');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(
        <ServiceCard
          service={mockHealthyService}
          cpuSparkline={mockSparklineData}
          memorySparkline={mockSparklineData}
          className="my-custom-class"
        />
      );
      const card = screen.getByTestId('service-card');
      expect(card).toHaveClass('my-custom-class');
    });
  });
});
