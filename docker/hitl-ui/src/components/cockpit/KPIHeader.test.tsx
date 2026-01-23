/**
 * Tests for KPIHeader component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KPIHeader, { type KPI } from './KPIHeader';

describe('KPIHeader', () => {
  const defaultKPIs: KPI[] = [
    {
      id: 'pending-gates',
      label: 'Pending Gates',
      value: 5,
      trend: 'up',
      trendValue: '+2',
      threshold: { warning: 3, critical: 10 },
    },
    {
      id: 'active-runs',
      label: 'Active Runs',
      value: 12,
      trend: 'stable',
      threshold: { warning: 20, critical: 50 },
    },
    {
      id: 'success-rate',
      label: 'Success Rate',
      value: 94,
      unit: '%',
      trend: 'up',
      trendValue: '+2%',
      threshold: { warning: 85, critical: 70, inverse: true },
    },
    {
      id: 'avg-duration',
      label: 'Avg Duration',
      value: 45,
      unit: 's',
      trend: 'down',
      trendValue: '-5s',
      threshold: { warning: 60, critical: 120 },
    },
    {
      id: 'queued-tasks',
      label: 'Queued Tasks',
      value: 8,
      trend: 'down',
      trendValue: '-3',
      threshold: { warning: 15, critical: 30 },
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      expect(screen.getByTestId('kpi-header')).toBeInTheDocument();
    });

    it('renders all KPIs', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      expect(screen.getByTestId('kpi-pending-gates')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-active-runs')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-success-rate')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-avg-duration')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-queued-tasks')).toBeInTheDocument();
    });

    it('renders KPI labels', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      expect(screen.getByText('Pending Gates')).toBeInTheDocument();
      expect(screen.getByText('Active Runs')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
    });

    it('renders KPI values', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('94%')).toBeInTheDocument();
      expect(screen.getByText('45s')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<KPIHeader kpis={defaultKPIs} className="my-custom-class" />);
      expect(screen.getByTestId('kpi-header')).toHaveClass('my-custom-class');
    });
  });

  describe('Trend Indicators', () => {
    it('shows up trend icon', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      const kpi = screen.getByTestId('kpi-pending-gates');
      expect(kpi.querySelector('[data-testid="trend-up"]')).toBeInTheDocument();
    });

    it('shows down trend icon', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      const kpi = screen.getByTestId('kpi-avg-duration');
      expect(kpi.querySelector('[data-testid="trend-down"]')).toBeInTheDocument();
    });

    it('shows stable trend icon', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      const kpi = screen.getByTestId('kpi-active-runs');
      expect(kpi.querySelector('[data-testid="trend-stable"]')).toBeInTheDocument();
    });

    it('shows trend value', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.getByText('-5s')).toBeInTheDocument();
    });
  });

  describe('Color Coding (Thresholds)', () => {
    it('shows green when value is healthy', () => {
      const healthyKPIs: KPI[] = [
        {
          id: 'test',
          label: 'Test',
          value: 1,
          threshold: { warning: 5, critical: 10 },
        },
      ];
      render(<KPIHeader kpis={healthyKPIs} />);
      expect(screen.getByTestId('kpi-test')).toHaveClass('border-status-success');
    });

    it('shows yellow when value is in warning range', () => {
      const warningKPIs: KPI[] = [
        {
          id: 'test',
          label: 'Test',
          value: 7,
          threshold: { warning: 5, critical: 10 },
        },
      ];
      render(<KPIHeader kpis={warningKPIs} />);
      expect(screen.getByTestId('kpi-test')).toHaveClass('border-status-warning');
    });

    it('shows red when value is critical', () => {
      const criticalKPIs: KPI[] = [
        {
          id: 'test',
          label: 'Test',
          value: 15,
          threshold: { warning: 5, critical: 10 },
        },
      ];
      render(<KPIHeader kpis={criticalKPIs} />);
      expect(screen.getByTestId('kpi-test')).toHaveClass('border-status-error');
    });

    it('handles inverse thresholds (lower is critical)', () => {
      const inverseKPIs: KPI[] = [
        {
          id: 'test',
          label: 'Test',
          value: 60,
          threshold: { warning: 85, critical: 70, inverse: true },
        },
      ];
      render(<KPIHeader kpis={inverseKPIs} />);
      expect(screen.getByTestId('kpi-test')).toHaveClass('border-status-error');
    });

    it('inverse threshold: shows green when value is high', () => {
      const inverseHealthyKPIs: KPI[] = [
        {
          id: 'test',
          label: 'Test',
          value: 95,
          threshold: { warning: 85, critical: 70, inverse: true },
        },
      ];
      render(<KPIHeader kpis={inverseHealthyKPIs} />);
      expect(screen.getByTestId('kpi-test')).toHaveClass('border-status-success');
    });
  });

  describe('Click Handlers', () => {
    it('calls onClick when KPI is clicked', () => {
      const onClick = vi.fn();
      render(<KPIHeader kpis={defaultKPIs} onKPIClick={onClick} />);

      fireEvent.click(screen.getByTestId('kpi-pending-gates'));

      expect(onClick).toHaveBeenCalledWith('pending-gates');
    });

    it('KPIs are clickable buttons', () => {
      const onClick = vi.fn();
      render(<KPIHeader kpis={defaultKPIs} onKPIClick={onClick} />);

      const kpi = screen.getByTestId('kpi-pending-gates');
      expect(kpi.tagName).toBe('BUTTON');
    });

    it('KPIs are not clickable when onClick is not provided', () => {
      render(<KPIHeader kpis={defaultKPIs} />);

      const kpi = screen.getByTestId('kpi-pending-gates');
      expect(kpi.tagName).toBe('DIV');
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<KPIHeader kpis={[]} isLoading />);
      expect(screen.getByTestId('kpi-loading')).toBeInTheDocument();
    });

    it('shows 5 skeleton cards when loading', () => {
      render(<KPIHeader kpis={[]} isLoading />);
      expect(screen.getAllByTestId('kpi-skeleton')).toHaveLength(5);
    });

    it('hides loading when data is available', () => {
      render(<KPIHeader kpis={defaultKPIs} isLoading={false} />);
      expect(screen.queryByTestId('kpi-loading')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no KPIs', () => {
      render(<KPIHeader kpis={[]} />);
      expect(screen.getByText(/no metrics available/i)).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('renders in grid layout', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      expect(screen.getByTestId('kpi-header')).toHaveClass('grid');
    });

    it('applies responsive grid classes', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      const header = screen.getByTestId('kpi-header');
      expect(header).toHaveClass('grid-cols-2');
      expect(header).toHaveClass('md:grid-cols-5');
    });
  });

  describe('Accessibility', () => {
    it('has aria-label on KPIs', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      expect(screen.getByTestId('kpi-pending-gates')).toHaveAttribute('aria-label', 'Pending Gates: 5');
    });

    it('KPIs are focusable when clickable', () => {
      const onClick = vi.fn();
      render(<KPIHeader kpis={defaultKPIs} onKPIClick={onClick} />);

      const kpi = screen.getByTestId('kpi-pending-gates');
      expect(kpi).toHaveAttribute('tabIndex', '0');
    });

    it('trend icons have aria-hidden', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      const trendIcon = screen.getByTestId('kpi-pending-gates').querySelector('[data-testid="trend-up"]');
      expect(trendIcon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Refresh', () => {
    it('shows refresh button when onRefresh provided', () => {
      const onRefresh = vi.fn();
      render(<KPIHeader kpis={defaultKPIs} onRefresh={onRefresh} />);
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('hides refresh button when onRefresh not provided', () => {
      render(<KPIHeader kpis={defaultKPIs} />);
      expect(screen.queryByTestId('refresh-button')).not.toBeInTheDocument();
    });

    it('calls onRefresh when refresh button clicked', () => {
      const onRefresh = vi.fn();
      render(<KPIHeader kpis={defaultKPIs} onRefresh={onRefresh} />);

      fireEvent.click(screen.getByTestId('refresh-button'));

      expect(onRefresh).toHaveBeenCalled();
    });

    it('shows last updated time when provided', () => {
      render(<KPIHeader kpis={defaultKPIs} lastUpdated="2 min ago" />);
      expect(screen.getByText(/updated 2 min ago/i)).toBeInTheDocument();
    });
  });
});
