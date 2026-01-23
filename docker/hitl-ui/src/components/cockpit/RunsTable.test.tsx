/**
 * Tests for RunsTable component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RunsTable, { type Run } from './RunsTable';

describe('RunsTable', () => {
  const defaultRuns: Run[] = [
    {
      id: 'run-1',
      runId: 'R-001',
      cluster: 'Discovery',
      agent: 'PRD Agent',
      status: 'completed',
      model: 'claude-3-opus',
      duration: 120,
      startedAt: '2026-01-23T10:00:00Z',
      completedAt: '2026-01-23T10:02:00Z',
      epicId: 'EPIC-101',
      repoId: 'repo-main',
      environment: 'production',
    },
    {
      id: 'run-2',
      runId: 'R-002',
      cluster: 'Design',
      agent: 'Architect Agent',
      status: 'running',
      model: 'claude-3-sonnet',
      duration: 60,
      startedAt: '2026-01-23T10:05:00Z',
      epicId: 'EPIC-101',
      repoId: 'repo-main',
      environment: 'staging',
    },
    {
      id: 'run-3',
      runId: 'R-003',
      cluster: 'Development',
      agent: 'Coding Agent',
      status: 'failed',
      model: 'claude-3-opus',
      duration: 45,
      startedAt: '2026-01-23T10:10:00Z',
      completedAt: '2026-01-23T10:10:45Z',
      epicId: 'EPIC-102',
      repoId: 'repo-feature',
      environment: 'development',
      error: 'Compilation error',
    },
    {
      id: 'run-4',
      runId: 'R-004',
      cluster: 'Validation',
      agent: 'Validation Agent',
      status: 'pending',
      model: 'claude-3-haiku',
      startedAt: '2026-01-23T10:15:00Z',
      epicId: 'EPIC-103',
      repoId: 'repo-main',
      environment: 'production',
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<RunsTable runs={defaultRuns} />);
      expect(screen.getByTestId('runs-table')).toBeInTheDocument();
    });

    it('renders table headers', () => {
      render(<RunsTable runs={defaultRuns} />);
      expect(screen.getByText('Run ID')).toBeInTheDocument();
      expect(screen.getByText('Cluster')).toBeInTheDocument();
      expect(screen.getByText('Agent')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Model')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
    });

    it('renders all rows', () => {
      render(<RunsTable runs={defaultRuns} />);
      expect(screen.getByTestId('row-run-1')).toBeInTheDocument();
      expect(screen.getByTestId('row-run-2')).toBeInTheDocument();
      expect(screen.getByTestId('row-run-3')).toBeInTheDocument();
      expect(screen.getByTestId('row-run-4')).toBeInTheDocument();
    });

    it('renders run IDs', () => {
      render(<RunsTable runs={defaultRuns} />);
      expect(screen.getByText('R-001')).toBeInTheDocument();
      expect(screen.getByText('R-002')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<RunsTable runs={defaultRuns} className="my-custom-class" />);
      expect(screen.getByTestId('runs-table')).toHaveClass('my-custom-class');
    });
  });

  describe('Sorting', () => {
    it('sorts by run ID when header is clicked', () => {
      render(<RunsTable runs={defaultRuns} />);
      const header = screen.getByTestId('sort-runId');
      fireEvent.click(header);

      const rows = screen.getAllByTestId(/^row-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'row-run-1');
    });

    it('toggles sort direction on second click', () => {
      render(<RunsTable runs={defaultRuns} />);

      // First click: sort ascending by runId
      fireEvent.click(screen.getByTestId('sort-runId'));
      let rows = screen.getAllByTestId(/^row-run/);
      expect(rows[0]).toHaveAttribute('data-testid', 'row-run-1'); // R-001 first (asc)

      // Second click: toggle to descending
      fireEvent.click(screen.getByTestId('sort-runId'));
      rows = screen.getAllByTestId(/^row-run/);
      expect(rows[0]).toHaveAttribute('data-testid', 'row-run-4'); // R-004 first (desc)
    });

    it('shows sort indicator', () => {
      render(<RunsTable runs={defaultRuns} />);
      fireEvent.click(screen.getByTestId('sort-runId'));

      // Re-query after click since the component re-renders
      const updatedHeader = screen.getByTestId('sort-runId');
      expect(updatedHeader.querySelector('[data-testid="sort-indicator"]')).toBeInTheDocument();
    });

    it('sorts by status', () => {
      render(<RunsTable runs={defaultRuns} />);
      const header = screen.getByTestId('sort-status');
      fireEvent.click(header);

      // Status sorted alphabetically: completed, failed, pending, running
      const rows = screen.getAllByTestId(/^row-/);
      expect(rows[0]).toHaveTextContent('completed');
    });
  });

  describe('Filtering', () => {
    it('shows filter input', () => {
      render(<RunsTable runs={defaultRuns} />);
      expect(screen.getByTestId('filter-input')).toBeInTheDocument();
    });

    it('filters by run ID', () => {
      render(<RunsTable runs={defaultRuns} />);
      const input = screen.getByTestId('filter-input');
      fireEvent.change(input, { target: { value: 'R-001' } });

      expect(screen.getByTestId('row-run-1')).toBeInTheDocument();
      expect(screen.queryByTestId('row-run-2')).not.toBeInTheDocument();
    });

    it('filters by epic', () => {
      render(<RunsTable runs={defaultRuns} />);
      const input = screen.getByTestId('filter-input');
      fireEvent.change(input, { target: { value: 'EPIC-102' } });

      expect(screen.getByTestId('row-run-3')).toBeInTheDocument();
      expect(screen.queryByTestId('row-run-1')).not.toBeInTheDocument();
    });

    it('shows cluster filter dropdown', () => {
      render(<RunsTable runs={defaultRuns} showFilters />);
      expect(screen.getByTestId('filter-cluster')).toBeInTheDocument();
    });

    it('filters by cluster', () => {
      render(<RunsTable runs={defaultRuns} showFilters />);
      const select = screen.getByTestId('filter-cluster');
      fireEvent.change(select, { target: { value: 'Discovery' } });

      expect(screen.getByTestId('row-run-1')).toBeInTheDocument();
      expect(screen.queryByTestId('row-run-2')).not.toBeInTheDocument();
    });

    it('filters by status', () => {
      render(<RunsTable runs={defaultRuns} showFilters />);
      const select = screen.getByTestId('filter-status');
      fireEvent.change(select, { target: { value: 'failed' } });

      expect(screen.getByTestId('row-run-3')).toBeInTheDocument();
      expect(screen.queryByTestId('row-run-1')).not.toBeInTheDocument();
    });

    it('combines multiple filters', () => {
      render(<RunsTable runs={defaultRuns} showFilters />);

      const statusSelect = screen.getByTestId('filter-status');
      fireEvent.change(statusSelect, { target: { value: 'completed' } });

      const input = screen.getByTestId('filter-input');
      fireEvent.change(input, { target: { value: 'EPIC-101' } });

      expect(screen.getByTestId('row-run-1')).toBeInTheDocument();
      expect(screen.queryByTestId('row-run-3')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    const manyRuns = Array.from({ length: 60 }, (_, i) => ({
      id: `run-${i + 1}`,
      runId: `R-${String(i + 1).padStart(3, '0')}`,
      cluster: 'Discovery',
      agent: 'PRD Agent',
      status: 'completed' as const,
      model: 'claude-3-opus',
      duration: 60,
      startedAt: '2026-01-23T10:00:00Z',
      completedAt: '2026-01-23T10:01:00Z',
      epicId: `EPIC-${i + 100}`,
      repoId: 'repo-main',
      environment: 'production',
    }));

    it('shows pagination controls', () => {
      render(<RunsTable runs={manyRuns} pageSize={10} />);
      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    it('shows first page by default', () => {
      render(<RunsTable runs={manyRuns} pageSize={10} />);
      expect(screen.getByText('R-001')).toBeInTheDocument();
      expect(screen.queryByText('R-011')).not.toBeInTheDocument();
    });

    it('navigates to next page', () => {
      render(<RunsTable runs={manyRuns} pageSize={10} />);
      fireEvent.click(screen.getByTestId('next-page'));

      expect(screen.queryByText('R-001')).not.toBeInTheDocument();
      expect(screen.getByText('R-011')).toBeInTheDocument();
    });

    it('navigates to previous page', () => {
      render(<RunsTable runs={manyRuns} pageSize={10} />);
      fireEvent.click(screen.getByTestId('next-page'));
      fireEvent.click(screen.getByTestId('prev-page'));

      expect(screen.getByText('R-001')).toBeInTheDocument();
    });

    it('shows page info', () => {
      render(<RunsTable runs={manyRuns} pageSize={10} />);
      expect(screen.getByTestId('page-info')).toHaveTextContent(/1.*of.*6/);
    });

    it('disables prev button on first page', () => {
      render(<RunsTable runs={manyRuns} pageSize={10} />);
      expect(screen.getByTestId('prev-page')).toBeDisabled();
    });

    it('disables next button on last page', () => {
      render(<RunsTable runs={manyRuns} pageSize={10} />);
      // Go to last page
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getByTestId('next-page'));
      }
      expect(screen.getByTestId('next-page')).toBeDisabled();
    });
  });

  describe('Row Actions', () => {
    it('calls onRowClick when row is clicked', () => {
      const onClick = vi.fn();
      render(<RunsTable runs={defaultRuns} onRowClick={onClick} />);

      fireEvent.click(screen.getByTestId('row-run-1'));

      expect(onClick).toHaveBeenCalledWith('run-1');
    });

    it('rows are clickable when onRowClick is provided', () => {
      const onClick = vi.fn();
      render(<RunsTable runs={defaultRuns} onRowClick={onClick} />);

      expect(screen.getByTestId('row-run-1')).toHaveClass('cursor-pointer');
    });
  });

  describe('Status Display', () => {
    it('shows completed status with success color', () => {
      render(<RunsTable runs={defaultRuns} />);
      const row = screen.getByTestId('row-run-1');
      expect(row.querySelector('[data-testid="status-badge"]')).toHaveClass('bg-status-success');
    });

    it('shows running status with teal color', () => {
      render(<RunsTable runs={defaultRuns} />);
      const row = screen.getByTestId('row-run-2');
      expect(row.querySelector('[data-testid="status-badge"]')).toHaveClass('bg-accent-teal');
    });

    it('shows failed status with error color', () => {
      render(<RunsTable runs={defaultRuns} />);
      const row = screen.getByTestId('row-run-3');
      expect(row.querySelector('[data-testid="status-badge"]')).toHaveClass('bg-status-error');
    });

    it('shows pending status with warning color', () => {
      render(<RunsTable runs={defaultRuns} />);
      const row = screen.getByTestId('row-run-4');
      expect(row.querySelector('[data-testid="status-badge"]')).toHaveClass('bg-status-warning');
    });
  });

  describe('Duration Display', () => {
    it('shows formatted duration', () => {
      render(<RunsTable runs={defaultRuns} />);
      expect(screen.getByTestId('row-run-1')).toHaveTextContent('2m 0s');
    });

    it('shows -- for runs without duration', () => {
      render(<RunsTable runs={defaultRuns} />);
      expect(screen.getByTestId('row-run-4')).toHaveTextContent('--');
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<RunsTable runs={[]} isLoading />);
      expect(screen.getByTestId('runs-table-loading')).toBeInTheDocument();
    });

    it('shows skeleton rows when loading', () => {
      render(<RunsTable runs={[]} isLoading />);
      expect(screen.getAllByTestId('row-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no runs', () => {
      render(<RunsTable runs={[]} />);
      expect(screen.getByText(/no runs found/i)).toBeInTheDocument();
    });

    it('shows empty state after filtering removes all results', () => {
      render(<RunsTable runs={defaultRuns} />);
      const input = screen.getByTestId('filter-input');
      fireEvent.change(input, { target: { value: 'nonexistent' } });

      expect(screen.getByText(/no runs found/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper table role', () => {
      render(<RunsTable runs={defaultRuns} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('has proper header and body row groups', () => {
      render(<RunsTable runs={defaultRuns} />);
      // Table has two rowgroups: thead and tbody
      const rowgroups = screen.getAllByRole('rowgroup');
      expect(rowgroups.length).toBeGreaterThanOrEqual(2);
    });

    it('sort buttons are focusable', () => {
      render(<RunsTable runs={defaultRuns} />);
      expect(screen.getByTestId('sort-runId')).toHaveAttribute('tabIndex', '0');
    });
  });
});
