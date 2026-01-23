/**
 * Tests for CockpitPage
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CockpitPage from './CockpitPage';

// Wrap in router for any navigation
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('CockpitPage', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderWithRouter(<CockpitPage />);
      expect(screen.getByTestId('cockpit-page')).toBeInTheDocument();
    });

    it('renders page title', () => {
      renderWithRouter(<CockpitPage />);
      expect(screen.getByRole('heading', { level: 1, name: /agent cockpit/i })).toBeInTheDocument();
    });

    it('applies custom className', () => {
      renderWithRouter(<CockpitPage className="my-custom-class" />);
      expect(screen.getByTestId('cockpit-page')).toHaveClass('my-custom-class');
    });
  });

  describe('Panel Composition', () => {
    it('renders KPIHeader panel', () => {
      renderWithRouter(<CockpitPage />);
      expect(screen.getByTestId('kpi-header')).toBeInTheDocument();
    });

    it('renders WorkerUtilizationPanel', () => {
      renderWithRouter(<CockpitPage />);
      expect(screen.getByTestId('worker-panel')).toBeInTheDocument();
    });

    it('renders WorkflowGraphView', () => {
      renderWithRouter(<CockpitPage />);
      expect(screen.getByTestId('workflow-graph')).toBeInTheDocument();
    });

    it('renders RunsTable', () => {
      renderWithRouter(<CockpitPage />);
      expect(screen.getByTestId('runs-table')).toBeInTheDocument();
    });

    it('renders GitIntegrationPanel', () => {
      renderWithRouter(<CockpitPage />);
      expect(screen.getByTestId('git-integration-panel')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('has responsive grid layout', () => {
      renderWithRouter(<CockpitPage />);
      const gridContainer = screen.getByTestId('cockpit-grid');
      expect(gridContainer).toHaveClass('grid');
    });

    it('KPI header spans full width', () => {
      renderWithRouter(<CockpitPage />);
      const kpiSection = screen.getByTestId('kpi-section');
      expect(kpiSection).toHaveClass('col-span-full');
    });

    it('workflow graph and workers are in same row', () => {
      renderWithRouter(<CockpitPage />);
      const middleRow = screen.getByTestId('middle-row');
      expect(middleRow).toBeInTheDocument();
      expect(middleRow.querySelector('[data-testid="workflow-graph"]')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows page-level loading state', () => {
      renderWithRouter(<CockpitPage isLoading />);
      expect(screen.getByTestId('cockpit-loading')).toBeInTheDocument();
    });

    it('shows skeleton panels when loading', () => {
      renderWithRouter(<CockpitPage isLoading />);
      expect(screen.getAllByTestId('panel-skeleton').length).toBeGreaterThan(0);
    });

    it('hides actual content when loading', () => {
      renderWithRouter(<CockpitPage isLoading />);
      expect(screen.queryByTestId('kpi-header')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when error occurs', () => {
      renderWithRouter(<CockpitPage error="Failed to load data" />);
      expect(screen.getByTestId('cockpit-error')).toBeInTheDocument();
      expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      renderWithRouter(<CockpitPage error="Failed to load" onRetry={vi.fn()} />);
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      renderWithRouter(<CockpitPage error="Failed to load" onRetry={onRetry} />);

      fireEvent.click(screen.getByTestId('retry-button'));

      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('Data Flow', () => {
    it('displays KPIs from props', () => {
      const kpis = [
        { id: 'active-runs', label: 'Active Runs', value: 5 },
        { id: 'success-rate', label: 'Success Rate', value: 85, unit: '%' },
      ];

      renderWithRouter(<CockpitPage kpis={kpis} />);

      expect(screen.getByText('Active Runs')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('displays workers from props', () => {
      const workers = [
        { id: 'w1', name: 'Worker 1', status: 'running' as const, model: 'claude-3-opus', utilization: 75 },
      ];

      renderWithRouter(<CockpitPage workers={workers} />);

      expect(screen.getByText('Worker 1')).toBeInTheDocument();
    });

    it('displays runs from props', () => {
      const runs = [
        {
          id: 'r1',
          runId: 'RUN-001',
          cluster: 'Discovery',
          agent: 'PRD Agent',
          status: 'completed' as const,
          model: 'claude-3-opus',
          startedAt: '2026-01-23T10:00:00Z',
          epicId: 'EPIC-101',
          repoId: 'repo-main',
          environment: 'production',
        },
      ];

      renderWithRouter(<CockpitPage runs={runs} />);

      expect(screen.getByText('RUN-001')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onRunClick when a run is clicked', () => {
      const onRunClick = vi.fn();
      const runs = [
        {
          id: 'r1',
          runId: 'RUN-001',
          cluster: 'Discovery',
          agent: 'PRD Agent',
          status: 'completed' as const,
          model: 'claude-3-opus',
          startedAt: '2026-01-23T10:00:00Z',
          epicId: 'EPIC-101',
          repoId: 'repo-main',
          environment: 'production',
        },
      ];

      renderWithRouter(<CockpitPage runs={runs} onRunClick={onRunClick} />);

      fireEvent.click(screen.getByTestId('row-r1'));

      expect(onRunClick).toHaveBeenCalledWith('r1');
    });

    it('calls onWorkerClick when a worker is clicked', () => {
      const onWorkerClick = vi.fn();
      const workers = [
        { id: 'w1', name: 'Worker 1', status: 'running' as const, model: 'claude-3-opus', utilization: 75 },
      ];

      renderWithRouter(<CockpitPage workers={workers} onWorkerClick={onWorkerClick} />);

      fireEvent.click(screen.getByTestId('worker-w1'));

      expect(onWorkerClick).toHaveBeenCalledWith('w1');
    });

    it('calls onNodeClick when a workflow node is clicked', () => {
      const onNodeClick = vi.fn();
      const nodes = [
        { id: 'discovery', label: 'Discovery', type: 'cluster' as const, status: 'active' as const, runsCount: 10 },
      ];

      renderWithRouter(<CockpitPage workflowNodes={nodes} workflowEdges={[]} onNodeClick={onNodeClick} />);

      fireEvent.click(screen.getByTestId('node-discovery'));

      expect(onNodeClick).toHaveBeenCalledWith('discovery', 'cluster');
    });
  });

  describe('Refresh', () => {
    it('shows refresh button', () => {
      renderWithRouter(<CockpitPage onRefresh={vi.fn()} />);
      expect(screen.getByTestId('page-refresh')).toBeInTheDocument();
    });

    it('calls onRefresh when clicked', () => {
      const onRefresh = vi.fn();
      renderWithRouter(<CockpitPage onRefresh={onRefresh} />);

      fireEvent.click(screen.getByTestId('page-refresh'));

      expect(onRefresh).toHaveBeenCalled();
    });

    it('hides refresh button when no handler', () => {
      renderWithRouter(<CockpitPage />);
      expect(screen.queryByTestId('page-refresh')).not.toBeInTheDocument();
    });
  });

  describe('Auto Refresh', () => {
    it('shows auto-refresh toggle', () => {
      renderWithRouter(<CockpitPage onRefresh={vi.fn()} />);
      expect(screen.getByTestId('auto-refresh-toggle')).toBeInTheDocument();
    });

    it('indicates when auto-refresh is active', () => {
      renderWithRouter(<CockpitPage onRefresh={vi.fn()} autoRefresh />);
      const toggle = screen.getByTestId('auto-refresh-toggle');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onAutoRefreshChange when toggled', () => {
      const onAutoRefreshChange = vi.fn();
      renderWithRouter(<CockpitPage onRefresh={vi.fn()} onAutoRefreshChange={onAutoRefreshChange} />);

      fireEvent.click(screen.getByTestId('auto-refresh-toggle'));

      expect(onAutoRefreshChange).toHaveBeenCalled();
    });
  });

  describe('Last Updated', () => {
    it('shows last updated time', () => {
      renderWithRouter(<CockpitPage lastUpdated="2026-01-23T10:30:00Z" />);
      expect(screen.getByTestId('last-updated')).toBeInTheDocument();
    });

    it('formats time correctly', () => {
      renderWithRouter(<CockpitPage lastUpdated="2026-01-23T10:30:00Z" />);
      const lastUpdated = screen.getByTestId('last-updated');
      expect(lastUpdated).toHaveTextContent(/updated/i);
    });
  });

  describe('Accessibility', () => {
    it('has main landmark', () => {
      renderWithRouter(<CockpitPage />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('has proper heading hierarchy', () => {
      renderWithRouter(<CockpitPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent(/cockpit/i);
    });

    it('refresh button has accessible label', () => {
      renderWithRouter(<CockpitPage onRefresh={vi.fn()} />);
      const refreshBtn = screen.getByTestId('page-refresh');
      expect(refreshBtn).toHaveAttribute('aria-label');
    });
  });
});
