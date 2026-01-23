/**
 * Tests for WorkerUtilizationPanel component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkerUtilizationPanel, { type Worker } from './WorkerUtilizationPanel';

describe('WorkerUtilizationPanel', () => {
  const defaultWorkers: Worker[] = [
    {
      id: 'worker-1',
      name: 'Worker 1',
      status: 'running',
      currentTask: 'PRD Generation',
      taskId: 'task-123',
      model: 'claude-3-opus',
      utilization: 85,
      startedAt: '2026-01-23T10:00:00Z',
    },
    {
      id: 'worker-2',
      name: 'Worker 2',
      status: 'idle',
      model: 'claude-3-sonnet',
      utilization: 0,
    },
    {
      id: 'worker-3',
      name: 'Worker 3',
      status: 'running',
      currentTask: 'Code Review',
      taskId: 'task-456',
      model: 'claude-3-opus',
      utilization: 72,
      startedAt: '2026-01-23T10:15:00Z',
    },
    {
      id: 'worker-4',
      name: 'Worker 4',
      status: 'error',
      currentTask: 'Failed Task',
      taskId: 'task-789',
      model: 'claude-3-haiku',
      utilization: 0,
      error: 'Connection timeout',
    },
    {
      id: 'worker-5',
      name: 'Worker 5',
      status: 'idle',
      model: 'claude-3-sonnet',
      utilization: 0,
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByTestId('worker-panel')).toBeInTheDocument();
    });

    it('renders panel title', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByText(/worker utilization/i)).toBeInTheDocument();
    });

    it('renders all workers', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByTestId('worker-worker-1')).toBeInTheDocument();
      expect(screen.getByTestId('worker-worker-2')).toBeInTheDocument();
      expect(screen.getByTestId('worker-worker-3')).toBeInTheDocument();
      expect(screen.getByTestId('worker-worker-4')).toBeInTheDocument();
      expect(screen.getByTestId('worker-worker-5')).toBeInTheDocument();
    });

    it('renders worker names', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByText('Worker 1')).toBeInTheDocument();
      expect(screen.getByText('Worker 2')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} className="my-custom-class" />);
      expect(screen.getByTestId('worker-panel')).toHaveClass('my-custom-class');
    });
  });

  describe('Worker Status Display', () => {
    it('shows running status', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      const worker = screen.getByTestId('worker-worker-1');
      expect(worker).toHaveTextContent(/running/i);
    });

    it('shows idle status', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      const worker = screen.getByTestId('worker-worker-2');
      expect(worker).toHaveTextContent(/idle/i);
    });

    it('shows error status', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      const worker = screen.getByTestId('worker-worker-4');
      expect(worker).toHaveTextContent(/error/i);
    });

    it('shows status badge with correct color for running', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      const worker = screen.getByTestId('worker-worker-1');
      expect(worker.querySelector('[data-testid="status-badge"]')).toHaveClass('bg-status-success');
    });

    it('shows status badge with correct color for idle', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      const worker = screen.getByTestId('worker-worker-2');
      expect(worker.querySelector('[data-testid="status-badge"]')).toHaveClass('bg-text-muted');
    });

    it('shows status badge with correct color for error', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      const worker = screen.getByTestId('worker-worker-4');
      expect(worker.querySelector('[data-testid="status-badge"]')).toHaveClass('bg-status-error');
    });
  });

  describe('Current Task Display', () => {
    it('shows current task for running workers', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByText('PRD Generation')).toBeInTheDocument();
      expect(screen.getByText('Code Review')).toBeInTheDocument();
    });

    it('shows no task for idle workers', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      const worker = screen.getByTestId('worker-worker-2');
      expect(worker).toHaveTextContent(/no active task/i);
    });

    it('shows error message for error workers', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    });
  });

  describe('Model Display', () => {
    it('shows worker model', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getAllByText(/claude-3-opus/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/claude-3-sonnet/i).length).toBeGreaterThan(0);
    });
  });

  describe('Utilization Display', () => {
    it('shows utilization percentage for running workers', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('72%')).toBeInTheDocument();
    });

    it('shows utilization bar', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      const worker = screen.getByTestId('worker-worker-1');
      expect(worker.querySelector('[data-testid="utilization-bar"]')).toBeInTheDocument();
    });

    it('utilization bar width matches percentage', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      const worker = screen.getByTestId('worker-worker-1');
      const bar = worker.querySelector('[data-testid="utilization-bar-fill"]');
      expect(bar).toHaveStyle({ width: '85%' });
    });
  });

  describe('Status Filter', () => {
    it('shows status filter buttons', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-running')).toBeInTheDocument();
      expect(screen.getByTestId('filter-idle')).toBeInTheDocument();
      expect(screen.getByTestId('filter-error')).toBeInTheDocument();
    });

    it('filters by running status', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      fireEvent.click(screen.getByTestId('filter-running'));

      expect(screen.getByTestId('worker-worker-1')).toBeInTheDocument();
      expect(screen.getByTestId('worker-worker-3')).toBeInTheDocument();
      expect(screen.queryByTestId('worker-worker-2')).not.toBeInTheDocument();
    });

    it('filters by idle status', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      fireEvent.click(screen.getByTestId('filter-idle'));

      expect(screen.getByTestId('worker-worker-2')).toBeInTheDocument();
      expect(screen.getByTestId('worker-worker-5')).toBeInTheDocument();
      expect(screen.queryByTestId('worker-worker-1')).not.toBeInTheDocument();
    });

    it('filters by error status', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      fireEvent.click(screen.getByTestId('filter-error'));

      expect(screen.getByTestId('worker-worker-4')).toBeInTheDocument();
      expect(screen.queryByTestId('worker-worker-1')).not.toBeInTheDocument();
    });

    it('shows all when All filter is selected', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      fireEvent.click(screen.getByTestId('filter-running'));
      fireEvent.click(screen.getByTestId('filter-all'));

      expect(screen.getByTestId('worker-worker-1')).toBeInTheDocument();
      expect(screen.getByTestId('worker-worker-2')).toBeInTheDocument();
      expect(screen.getByTestId('worker-worker-4')).toBeInTheDocument();
    });

    it('shows filter counts', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByTestId('filter-all')).toHaveTextContent('5');
      expect(screen.getByTestId('filter-running')).toHaveTextContent('2');
      expect(screen.getByTestId('filter-idle')).toHaveTextContent('2');
      expect(screen.getByTestId('filter-error')).toHaveTextContent('1');
    });

    it('highlights selected filter', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      fireEvent.click(screen.getByTestId('filter-running'));
      expect(screen.getByTestId('filter-running')).toHaveClass('bg-accent-teal');
    });
  });

  describe('Overall Utilization', () => {
    it('shows overall utilization percentage', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByTestId('overall-utilization')).toBeInTheDocument();
    });

    it('calculates average utilization correctly', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      // (85 + 0 + 72 + 0 + 0) / 5 = 31.4%
      expect(screen.getByTestId('overall-utilization')).toHaveTextContent(/31%/);
    });
  });

  describe('Worker Click', () => {
    it('calls onWorkerClick when worker is clicked', () => {
      const onClick = vi.fn();
      render(<WorkerUtilizationPanel workers={defaultWorkers} onWorkerClick={onClick} />);

      fireEvent.click(screen.getByTestId('worker-worker-1'));

      expect(onClick).toHaveBeenCalledWith('worker-1');
    });

    it('calls onTaskClick when task is clicked', () => {
      const onClick = vi.fn();
      render(<WorkerUtilizationPanel workers={defaultWorkers} onTaskClick={onClick} />);

      const taskLink = screen.getByTestId('worker-worker-1').querySelector('[data-testid="task-link"]');
      fireEvent.click(taskLink!);

      expect(onClick).toHaveBeenCalledWith('task-123');
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<WorkerUtilizationPanel workers={[]} isLoading />);
      expect(screen.getByTestId('worker-panel-loading')).toBeInTheDocument();
    });

    it('shows skeleton workers when loading', () => {
      render(<WorkerUtilizationPanel workers={[]} isLoading />);
      expect(screen.getAllByTestId('worker-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no workers', () => {
      render(<WorkerUtilizationPanel workers={[]} />);
      expect(screen.getByText(/no workers available/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByRole('heading', { name: /worker utilization/i })).toBeInTheDocument();
    });

    it('workers have aria-label', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByTestId('worker-worker-1')).toHaveAttribute('aria-label');
    });

    it('filter buttons have aria-pressed', () => {
      render(<WorkerUtilizationPanel workers={defaultWorkers} />);
      expect(screen.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('filter-running')).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
