/**
 * Tests for RLMTrajectoryViewer component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RLMTrajectoryViewer, { type RLMTrajectory, type Subcall } from './RLMTrajectoryViewer';

describe('RLMTrajectoryViewer', () => {
  // Helper to create a subcall
  const createSubcall = (
    id: string,
    depth: number,
    overrides: Partial<Subcall> = {}
  ): Subcall => ({
    id,
    depth,
    name: `Subcall ${id}`,
    status: 'success',
    startedAt: '2026-01-23T10:00:00Z',
    completedAt: '2026-01-23T10:01:00Z',
    duration: 60000,
    tokens: { input: 1000, output: 500 },
    cost: 0.05,
    toolCalls: [
      { id: `tool-${id}-1`, name: 'read_file', status: 'success', duration: 100 },
      { id: `tool-${id}-2`, name: 'write_file', status: 'success', duration: 200 },
    ],
    children: [],
    ...overrides,
  });

  // Create nested structure
  const createNestedTrajectory = (maxDepth: number): Subcall[] => {
    const createLevel = (depth: number, parentId: string): Subcall[] => {
      if (depth >= maxDepth) return [];
      const subcall = createSubcall(`${parentId}-${depth}`, depth, {
        children: createLevel(depth + 1, `${parentId}-${depth}`),
      });
      return [subcall];
    };
    return createLevel(0, 'root');
  };

  const defaultTrajectory: RLMTrajectory = {
    runId: 'run-123',
    totalSubcalls: 5,
    maxDepth: 3,
    totalTokens: { input: 5000, output: 2500 },
    totalCost: 0.25,
    totalDuration: 300000,
    subcalls: [
      createSubcall('1', 0, {
        children: [
          createSubcall('1-1', 1, {
            children: [createSubcall('1-1-1', 2)],
          }),
          createSubcall('1-2', 1),
        ],
      }),
      createSubcall('2', 0, {
        status: 'failure',
        error: 'Something went wrong',
      }),
    ],
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByTestId('rlm-trajectory-viewer')).toBeInTheDocument();
    });

    it('renders section title', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByText(/trajectory/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} className="my-custom-class" />);
      expect(screen.getByTestId('rlm-trajectory-viewer')).toHaveClass('my-custom-class');
    });
  });

  describe('Summary Statistics', () => {
    it('displays total subcalls count', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByTestId('total-subcalls')).toHaveTextContent('5');
    });

    it('displays max depth', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByTestId('max-depth')).toHaveTextContent('3');
    });

    it('displays total tokens', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByTestId('total-tokens')).toHaveTextContent('7,500');
    });

    it('displays total cost', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByTestId('total-cost')).toHaveTextContent('$0.25');
    });

    it('displays total duration', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByTestId('total-duration')).toHaveTextContent('5m 0s');
    });
  });

  describe('Tree Structure', () => {
    it('renders root level subcalls', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByTestId('subcall-1')).toBeInTheDocument();
      expect(screen.getByTestId('subcall-2')).toBeInTheDocument();
    });

    it('shows subcall names', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByText('Subcall 1')).toBeInTheDocument();
      expect(screen.getByText('Subcall 2')).toBeInTheDocument();
    });

    it('shows expand icon for subcalls with children', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const expandBtn = screen.getByTestId('expand-1');
      expect(expandBtn).toBeInTheDocument();
    });

    it('does not show expand icon for leaf subcalls', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      // Subcall 2 has no children
      expect(screen.queryByTestId('expand-2')).not.toBeInTheDocument();
    });

    it('indents nested subcalls', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      fireEvent.click(screen.getByTestId('expand-1'));

      const childSubcall = screen.getByTestId('subcall-1-1');
      expect(childSubcall).toHaveStyle({ marginLeft: '24px' });
    });
  });

  describe('Expand/Collapse', () => {
    it('children are hidden by default', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.queryByTestId('subcall-1-1')).not.toBeInTheDocument();
    });

    it('expands to show children on click', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);

      fireEvent.click(screen.getByTestId('expand-1'));

      expect(screen.getByTestId('subcall-1-1')).toBeInTheDocument();
      expect(screen.getByTestId('subcall-1-2')).toBeInTheDocument();
    });

    it('collapses children on second click', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);

      fireEvent.click(screen.getByTestId('expand-1'));
      expect(screen.getByTestId('subcall-1-1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('expand-1'));
      expect(screen.queryByTestId('subcall-1-1')).not.toBeInTheDocument();
    });

    it('has aria-expanded attribute', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const expandBtn = screen.getByTestId('expand-1');
      expect(expandBtn).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(expandBtn);
      expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('shows nested children when parent expanded', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);

      // Expand first level
      fireEvent.click(screen.getByTestId('expand-1'));
      expect(screen.getByTestId('subcall-1-1')).toBeInTheDocument();

      // Expand second level
      fireEvent.click(screen.getByTestId('expand-1-1'));
      expect(screen.getByTestId('subcall-1-1-1')).toBeInTheDocument();
    });
  });

  describe('Expand All / Collapse All', () => {
    it('shows Expand All button', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByRole('button', { name: /expand all/i })).toBeInTheDocument();
    });

    it('shows Collapse All button', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByRole('button', { name: /collapse all/i })).toBeInTheDocument();
    });

    it('Expand All shows all nested children', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);

      fireEvent.click(screen.getByRole('button', { name: /expand all/i }));

      expect(screen.getByTestId('subcall-1-1')).toBeInTheDocument();
      expect(screen.getByTestId('subcall-1-2')).toBeInTheDocument();
      expect(screen.getByTestId('subcall-1-1-1')).toBeInTheDocument();
    });

    it('Collapse All hides all nested children', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);

      // First expand all
      fireEvent.click(screen.getByRole('button', { name: /expand all/i }));
      expect(screen.getByTestId('subcall-1-1')).toBeInTheDocument();

      // Then collapse all
      fireEvent.click(screen.getByRole('button', { name: /collapse all/i }));
      expect(screen.queryByTestId('subcall-1-1')).not.toBeInTheDocument();
    });
  });

  describe('Tool Calls Display', () => {
    it('shows tool call count', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const subcall = screen.getByTestId('subcall-1');
      expect(subcall).toHaveTextContent('2 tools');
    });

    it('expands to show tool call details', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);

      fireEvent.click(screen.getByTestId('toggle-tools-1'));

      expect(screen.getByTestId('tool-tool-1-1')).toBeInTheDocument();
      expect(screen.getByText('read_file')).toBeInTheDocument();
    });

    it('shows tool call status', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      fireEvent.click(screen.getByTestId('toggle-tools-1'));

      const tool = screen.getByTestId('tool-tool-1-1');
      expect(tool).toHaveTextContent(/success/i);
    });

    it('shows tool call duration', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      fireEvent.click(screen.getByTestId('toggle-tools-1'));

      const tool = screen.getByTestId('tool-tool-1-1');
      expect(tool).toHaveTextContent('100ms');
    });
  });

  describe('Metrics Display', () => {
    it('shows token count per subcall', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const subcall = screen.getByTestId('subcall-1');
      expect(subcall).toHaveTextContent('1,500'); // 1000 + 500
    });

    it('shows cost per subcall', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const subcall = screen.getByTestId('subcall-1');
      expect(subcall).toHaveTextContent('$0.05');
    });

    it('shows duration per subcall', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const subcall = screen.getByTestId('subcall-1');
      expect(subcall).toHaveTextContent('1m 0s');
    });
  });

  describe('Status Indicators', () => {
    it('shows success indicator for successful subcalls', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const subcall = screen.getByTestId('subcall-1');
      const successIcon = subcall.querySelector('[data-testid="status-success"]');
      expect(successIcon).toBeInTheDocument();
    });

    it('shows failure indicator for failed subcalls', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const subcall = screen.getByTestId('subcall-2');
      const failureIcon = subcall.querySelector('[data-testid="status-failure"]');
      expect(failureIcon).toBeInTheDocument();
    });

    it('shows error message for failed subcalls', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const subcall = screen.getByTestId('subcall-2');
      expect(subcall).toHaveTextContent('Something went wrong');
    });

    it('applies success styling', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const statusIcon = screen.getByTestId('subcall-1').querySelector('[data-testid="status-success"]');
      expect(statusIcon).toHaveClass('text-status-success');
    });

    it('applies failure styling', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const statusIcon = screen.getByTestId('subcall-2').querySelector('[data-testid="status-failure"]');
      expect(statusIcon).toHaveClass('text-status-error');
    });
  });

  describe('Depth Limit', () => {
    it('limits display to 10 levels by default', () => {
      const deepTrajectory: RLMTrajectory = {
        runId: 'run-deep',
        totalSubcalls: 15,
        maxDepth: 15,
        totalTokens: { input: 10000, output: 5000 },
        totalCost: 0.50,
        totalDuration: 600000,
        subcalls: createNestedTrajectory(15),
      };

      render(<RLMTrajectoryViewer trajectory={deepTrajectory} />);

      // Expand all
      fireEvent.click(screen.getByRole('button', { name: /expand all/i }));

      // Should show up to depth 9 (0-indexed), depth 10+ should show pagination
      expect(screen.getByTestId('depth-limit-reached')).toBeInTheDocument();
    });

    it('shows "Load more" for truncated depth', () => {
      const deepTrajectory: RLMTrajectory = {
        runId: 'run-deep',
        totalSubcalls: 15,
        maxDepth: 15,
        totalTokens: { input: 10000, output: 5000 },
        totalCost: 0.50,
        totalDuration: 600000,
        subcalls: createNestedTrajectory(15),
      };

      render(<RLMTrajectoryViewer trajectory={deepTrajectory} />);
      fireEvent.click(screen.getByRole('button', { name: /expand all/i }));

      expect(screen.getByRole('button', { name: /load deeper levels/i })).toBeInTheDocument();
    });

    it('allows custom maxDisplayDepth', () => {
      const deepTrajectory: RLMTrajectory = {
        runId: 'run-deep',
        totalSubcalls: 10,
        maxDepth: 10,
        totalTokens: { input: 10000, output: 5000 },
        totalCost: 0.50,
        totalDuration: 600000,
        subcalls: createNestedTrajectory(10),
      };

      render(<RLMTrajectoryViewer trajectory={deepTrajectory} maxDisplayDepth={5} />);
      fireEvent.click(screen.getByRole('button', { name: /expand all/i }));

      expect(screen.getByTestId('depth-limit-reached')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows message when no subcalls', () => {
      const emptyTrajectory: RLMTrajectory = {
        runId: 'run-empty',
        totalSubcalls: 0,
        maxDepth: 0,
        totalTokens: { input: 0, output: 0 },
        totalCost: 0,
        totalDuration: 0,
        subcalls: [],
      };

      render(<RLMTrajectoryViewer trajectory={emptyTrajectory} />);
      expect(screen.getByText(/no subcalls/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} isLoading />);
      expect(screen.getByTestId('trajectory-loading')).toBeInTheDocument();
    });

    it('shows skeleton elements when loading', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} isLoading />);
      expect(screen.getAllByTestId('subcall-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Callbacks', () => {
    it('calls onSubcallClick when subcall clicked', () => {
      const onClick = vi.fn();
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} onSubcallClick={onClick} />);

      fireEvent.click(screen.getByTestId('subcall-1'));

      expect(onClick).toHaveBeenCalledWith('1');
    });

    it('calls onToolCallClick when tool call clicked', () => {
      const onClick = vi.fn();
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} onToolCallClick={onClick} />);

      fireEvent.click(screen.getByTestId('toggle-tools-1'));
      fireEvent.click(screen.getByTestId('tool-tool-1-1'));

      expect(onClick).toHaveBeenCalledWith('tool-1-1');
    });
  });

  describe('Accessibility', () => {
    it('has proper section headings', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    });

    it('expand buttons are keyboard accessible', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      const expandBtn = screen.getByTestId('expand-1');
      expect(expandBtn).toHaveAttribute('type', 'button');
    });

    it('tree has proper role', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getByRole('tree')).toBeInTheDocument();
    });

    it('tree items have proper role', () => {
      render(<RLMTrajectoryViewer trajectory={defaultTrajectory} />);
      expect(screen.getAllByRole('treeitem').length).toBeGreaterThan(0);
    });
  });
});
