/**
 * Tests for PodsTable component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import PodsTable from './PodsTable';
import type { K8sPod } from '../../api/types/kubernetes';

describe('PodsTable', () => {
  const mockPods: K8sPod[] = [
    {
      name: 'orchestrator-abc123',
      namespace: 'dox-asdlc',
      status: 'Running',
      phase: 'Running',
      nodeName: 'node-1',
      podIP: '10.0.0.1',
      hostIP: '192.168.1.1',
      containers: [],
      restarts: 0,
      age: '5d',
      createdAt: '2026-01-20T10:00:00Z',
      labels: {},
      ownerKind: 'Deployment',
      ownerName: 'orchestrator',
    },
    {
      name: 'worker-xyz789',
      namespace: 'dox-asdlc',
      status: 'Running',
      phase: 'Running',
      nodeName: 'node-2',
      podIP: '10.0.0.2',
      hostIP: '192.168.1.2',
      containers: [],
      restarts: 2,
      age: '3d',
      createdAt: '2026-01-22T10:00:00Z',
      labels: {},
      ownerKind: 'Deployment',
      ownerName: 'worker',
    },
    {
      name: 'redis-0',
      namespace: 'dox-asdlc',
      status: 'Running',
      phase: 'Running',
      nodeName: 'node-1',
      podIP: '10.0.0.3',
      hostIP: '192.168.1.1',
      containers: [],
      restarts: 0,
      age: '10d',
      createdAt: '2026-01-15T10:00:00Z',
      labels: {},
      ownerKind: 'StatefulSet',
      ownerName: 'redis',
    },
    {
      name: 'failed-job-pod',
      namespace: 'default',
      status: 'Failed',
      phase: 'Failed',
      nodeName: 'node-2',
      podIP: '10.0.0.4',
      hostIP: '192.168.1.2',
      containers: [],
      restarts: 6,
      age: '1d',
      createdAt: '2026-01-24T10:00:00Z',
      labels: {},
      ownerKind: 'Job',
      ownerName: 'failed-job',
    },
    {
      name: 'pending-pod',
      namespace: 'kube-system',
      status: 'Pending',
      phase: 'Pending',
      nodeName: '',
      podIP: '',
      hostIP: '',
      containers: [],
      restarts: 0,
      age: '5m',
      createdAt: '2026-01-25T09:55:00Z',
      labels: {},
      ownerKind: 'Deployment',
      ownerName: 'pending-deploy',
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<PodsTable pods={mockPods} />);
      expect(screen.getByTestId('pods-table')).toBeInTheDocument();
    });

    it('renders all pod rows', () => {
      render(<PodsTable pods={mockPods} />);
      expect(screen.getByTestId('pod-row-orchestrator-abc123')).toBeInTheDocument();
      expect(screen.getByTestId('pod-row-worker-xyz789')).toBeInTheDocument();
      expect(screen.getByTestId('pod-row-redis-0')).toBeInTheDocument();
      expect(screen.getByTestId('pod-row-failed-job-pod')).toBeInTheDocument();
      expect(screen.getByTestId('pod-row-pending-pod')).toBeInTheDocument();
    });

    it('displays pod names', () => {
      render(<PodsTable pods={mockPods} />);
      expect(screen.getByText('orchestrator-abc123')).toBeInTheDocument();
      expect(screen.getByText('worker-xyz789')).toBeInTheDocument();
    });

    it('displays namespaces', () => {
      render(<PodsTable pods={mockPods} />);
      expect(screen.getAllByText('dox-asdlc')).toHaveLength(3);
      expect(screen.getByText('default')).toBeInTheDocument();
      expect(screen.getByText('kube-system')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<PodsTable pods={mockPods} className="my-custom-class" />);
      expect(screen.getByTestId('pods-table')).toHaveClass('my-custom-class');
    });
  });

  describe('Status Badges', () => {
    it('displays status badges', () => {
      render(<PodsTable pods={mockPods} />);
      const badges = screen.getAllByTestId('status-badge');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('shows Running status', () => {
      render(<PodsTable pods={mockPods} />);
      expect(screen.getAllByText('Running')).toHaveLength(3);
    });

    it('shows Failed status', () => {
      render(<PodsTable pods={mockPods} />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('shows Pending status', () => {
      render(<PodsTable pods={mockPods} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('renders sortable column headers', () => {
      render(<PodsTable pods={mockPods} />);
      expect(screen.getByTestId('sort-name')).toBeInTheDocument();
      expect(screen.getByTestId('sort-namespace')).toBeInTheDocument();
      expect(screen.getByTestId('sort-status')).toBeInTheDocument();
      expect(screen.getByTestId('sort-nodeName')).toBeInTheDocument();
      expect(screen.getByTestId('sort-age')).toBeInTheDocument();
      expect(screen.getByTestId('sort-restarts')).toBeInTheDocument();
    });

    it('sorts by name ascending by default', () => {
      render(<PodsTable pods={mockPods} />);
      const rows = screen.getAllByTestId(/^pod-row-/);
      // Should be alphabetically sorted by name
      expect(rows[0]).toHaveAttribute('data-testid', 'pod-row-failed-job-pod');
      expect(rows[1]).toHaveAttribute('data-testid', 'pod-row-orchestrator-abc123');
    });

    it('toggles sort direction on repeated click', () => {
      render(<PodsTable pods={mockPods} />);

      // Click name header to sort descending
      fireEvent.click(screen.getByTestId('sort-name'));

      const rows = screen.getAllByTestId(/^pod-row-/);
      // Should be reverse alphabetical
      expect(rows[0]).toHaveAttribute('data-testid', 'pod-row-worker-xyz789');
    });

    it('sorts by restarts', () => {
      render(<PodsTable pods={mockPods} />);

      // Click restarts header
      fireEvent.click(screen.getByTestId('sort-restarts'));

      const rows = screen.getAllByTestId(/^pod-row-/);
      // First should have 0 restarts
      expect(rows[0]).toHaveAttribute('data-testid', expect.stringContaining('orchestrator'));
    });
  });

  describe('Filters', () => {
    it('hides filters by default', () => {
      render(<PodsTable pods={mockPods} />);
      expect(screen.queryByTestId('filters')).not.toBeInTheDocument();
    });

    it('shows filters when showFilters is true', () => {
      render(<PodsTable pods={mockPods} showFilters />);
      expect(screen.getByTestId('filters')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<PodsTable pods={mockPods} showFilters />);
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('filters by search query (after debounce)', () => {
      vi.useFakeTimers();
      render(<PodsTable pods={mockPods} showFilters />);

      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'orchestrator' },
      });

      // Fast-forward debounce timer
      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(screen.getByTestId('pod-row-orchestrator-abc123')).toBeInTheDocument();
      expect(screen.queryByTestId('pod-row-worker-xyz789')).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it('renders namespace filter', () => {
      render(<PodsTable pods={mockPods} showFilters />);
      expect(screen.getByTestId('namespace-filter')).toBeInTheDocument();
    });

    it('filters by namespace', () => {
      render(<PodsTable pods={mockPods} showFilters />);

      fireEvent.change(screen.getByTestId('namespace-filter'), {
        target: { value: 'default' },
      });

      expect(screen.getByTestId('pod-row-failed-job-pod')).toBeInTheDocument();
      expect(screen.queryByTestId('pod-row-orchestrator-abc123')).not.toBeInTheDocument();
    });

    it('renders status filter', () => {
      render(<PodsTable pods={mockPods} showFilters />);
      expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    });

    it('filters by status', () => {
      render(<PodsTable pods={mockPods} showFilters />);

      fireEvent.change(screen.getByTestId('status-filter'), {
        target: { value: 'Failed' },
      });

      expect(screen.getByTestId('pod-row-failed-job-pod')).toBeInTheDocument();
      expect(screen.queryByTestId('pod-row-orchestrator-abc123')).not.toBeInTheDocument();
    });

    it('shows filter result count', () => {
      render(<PodsTable pods={mockPods} showFilters />);

      fireEvent.change(screen.getByTestId('status-filter'), {
        target: { value: 'Running' },
      });

      expect(screen.getByText(/3 of 5 pods/)).toBeInTheDocument();
    });

    it('renders node filter', () => {
      render(<PodsTable pods={mockPods} showFilters />);
      expect(screen.getByTestId('node-filter')).toBeInTheDocument();
    });

    it('filters by node', () => {
      render(<PodsTable pods={mockPods} showFilters />);

      fireEvent.change(screen.getByTestId('node-filter'), {
        target: { value: 'node-1' },
      });

      expect(screen.getByTestId('pod-row-orchestrator-abc123')).toBeInTheDocument();
      expect(screen.getByTestId('pod-row-redis-0')).toBeInTheDocument();
      expect(screen.queryByTestId('pod-row-worker-xyz789')).not.toBeInTheDocument();
    });

    it('shows all nodes in node filter dropdown', () => {
      render(<PodsTable pods={mockPods} showFilters />);
      const nodeFilter = screen.getByTestId('node-filter');

      // Should have 'All Nodes' plus unique nodes (node-1, node-2)
      expect(nodeFilter).toHaveTextContent('All Nodes');
      expect(nodeFilter).toHaveTextContent('node-1');
      expect(nodeFilter).toHaveTextContent('node-2');
    });
  });

  describe('Debounced Search', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('debounces search input by 300ms', () => {
      render(<PodsTable pods={mockPods} showFilters />);

      // Type in search box
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'worker' },
      });

      // Before debounce timeout, all pods should still be visible (based on sorting)
      expect(screen.getAllByTestId(/^pod-row-/).length).toBe(5);

      // Fast-forward debounce timer
      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Now only matching pods should be visible
      expect(screen.getByTestId('pod-row-worker-xyz789')).toBeInTheDocument();
      expect(screen.queryByTestId('pod-row-orchestrator-abc123')).not.toBeInTheDocument();
    });

    it('only applies filter after debounce completes', () => {
      render(<PodsTable pods={mockPods} showFilters />);

      // Type first character
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'o' },
      });

      // Advance only 100ms (not full debounce)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // All pods still visible
      expect(screen.getAllByTestId(/^pod-row-/).length).toBe(5);

      // Type another character before debounce completes
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'or' },
      });

      // Advance full debounce time
      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Should filter based on final value 'or'
      expect(screen.getByTestId('pod-row-orchestrator-abc123')).toBeInTheDocument();
    });
  });

  describe('Row Click', () => {
    it('calls onPodClick when row clicked', () => {
      const onPodClick = vi.fn();
      render(<PodsTable pods={mockPods} onPodClick={onPodClick} />);

      fireEvent.click(screen.getByTestId('pod-row-orchestrator-abc123'));

      expect(onPodClick).toHaveBeenCalledTimes(1);
      expect(onPodClick).toHaveBeenCalledWith(mockPods[0]);
    });

    it('rows are clickable when onPodClick provided', () => {
      const onPodClick = vi.fn();
      render(<PodsTable pods={mockPods} onPodClick={onPodClick} />);

      const row = screen.getByTestId('pod-row-orchestrator-abc123');
      expect(row).toHaveClass('cursor-pointer');
    });
  });

  describe('Restart Count Styling', () => {
    it('highlights high restart counts in red', () => {
      render(<PodsTable pods={mockPods} />);
      const failedRow = screen.getByTestId('pod-row-failed-job-pod');
      // The restart count cell should have error styling
      expect(failedRow).toHaveTextContent('6');
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading and no pods', () => {
      render(<PodsTable pods={[]} isLoading />);
      expect(screen.getByTestId('pods-table-loading')).toBeInTheDocument();
      expect(screen.getAllByTestId('row-skeleton')).toHaveLength(5);
    });

    it('shows pods when isLoading but pods exist', () => {
      render(<PodsTable pods={mockPods} isLoading />);
      expect(screen.getByTestId('pods-table')).toBeInTheDocument();
      expect(screen.queryByTestId('pods-table-loading')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    // Generate a large mock dataset for pagination tests
    const generateManyPods = (count: number): K8sPod[] => {
      return Array.from({ length: count }, (_, i) => ({
        name: `pod-${i.toString().padStart(3, '0')}`,
        namespace: 'default',
        status: 'Running' as const,
        phase: 'Running',
        nodeName: `node-${(i % 3) + 1}`,
        podIP: `10.0.0.${i}`,
        hostIP: '192.168.1.1',
        containers: [],
        restarts: 0,
        age: '1d',
        createdAt: '2026-01-20T10:00:00Z',
        labels: {},
        ownerKind: 'Deployment',
        ownerName: 'test-deploy',
      }));
    };

    it('shows pagination controls when more than 50 pods', () => {
      const manyPods = generateManyPods(75);
      render(<PodsTable pods={manyPods} showFilters />);

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    it('does not show pagination when 50 or fewer pods', () => {
      const fewPods = generateManyPods(50);
      render(<PodsTable pods={fewPods} showFilters />);

      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    });

    it('shows only pageSize pods per page', () => {
      const manyPods = generateManyPods(75);
      render(<PodsTable pods={manyPods} pageSize={50} />);

      const rows = screen.getAllByTestId(/^pod-row-/);
      expect(rows.length).toBe(50);
    });

    it('navigates to next page', () => {
      const manyPods = generateManyPods(75);
      render(<PodsTable pods={manyPods} pageSize={50} />);

      // Initially on page 1
      expect(screen.getByTestId('pod-row-pod-000')).toBeInTheDocument();

      // Click next page
      fireEvent.click(screen.getByTestId('page-next'));

      // Should now be on page 2
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
      expect(screen.queryByTestId('pod-row-pod-000')).not.toBeInTheDocument();
      expect(screen.getByTestId('pod-row-pod-050')).toBeInTheDocument();
    });

    it('navigates to previous page', () => {
      const manyPods = generateManyPods(75);
      render(<PodsTable pods={manyPods} pageSize={50} />);

      // Go to page 2
      fireEvent.click(screen.getByTestId('page-next'));
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

      // Click previous page
      fireEvent.click(screen.getByTestId('page-prev'));

      // Should be back on page 1
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.getByTestId('pod-row-pod-000')).toBeInTheDocument();
    });

    it('navigates to first page', () => {
      const manyPods = generateManyPods(150);
      render(<PodsTable pods={manyPods} pageSize={50} />);

      // Go to page 3
      fireEvent.click(screen.getByTestId('page-next'));
      fireEvent.click(screen.getByTestId('page-next'));
      expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();

      // Click first page
      fireEvent.click(screen.getByTestId('page-first'));

      // Should be on page 1
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    it('navigates to last page', () => {
      const manyPods = generateManyPods(150);
      render(<PodsTable pods={manyPods} pageSize={50} />);

      // Click last page
      fireEvent.click(screen.getByTestId('page-last'));

      // Should be on page 3
      expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
      expect(screen.getByTestId('pod-row-pod-100')).toBeInTheDocument();
    });

    it('navigates to specific page number', () => {
      const manyPods = generateManyPods(150);
      render(<PodsTable pods={manyPods} pageSize={50} />);

      // Click page 2 button
      fireEvent.click(screen.getByTestId('page-2'));

      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    });

    it('disables prev/first buttons on first page', () => {
      const manyPods = generateManyPods(75);
      render(<PodsTable pods={manyPods} pageSize={50} />);

      expect(screen.getByTestId('page-prev')).toBeDisabled();
      expect(screen.getByTestId('page-first')).toBeDisabled();
    });

    it('disables next/last buttons on last page', () => {
      const manyPods = generateManyPods(75);
      render(<PodsTable pods={manyPods} pageSize={50} />);

      // Go to last page
      fireEvent.click(screen.getByTestId('page-last'));

      expect(screen.getByTestId('page-next')).toBeDisabled();
      expect(screen.getByTestId('page-last')).toBeDisabled();
    });

    it('resets to page 1 when filters change', () => {
      vi.useFakeTimers();
      // Generate 200 pods: pod-000 through pod-199
      const manyPods = generateManyPods(200);
      render(<PodsTable pods={manyPods} pageSize={50} showFilters />);

      // Go to page 2
      fireEvent.click(screen.getByTestId('page-next'));
      expect(screen.getByText('Page 2 of 4')).toBeInTheDocument();

      // Change filter (search for pod-1 which matches: pod-010-019, pod-100-199)
      // That's 10 + 100 = 110 pods, which means 3 pages at 50/page  (no wait: 100 pods / 50 = 2 pages)
      // Actually pod-1 matches names containing "pod-1": pod-010 through pod-019 (10) and pod-100 through pod-199 (100) = 110 total
      // 110/50 = 2.2, so 3 pages
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'pod-1' },
      });

      // Wait for debounce and state update
      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Should be back on page 1 - looking for the exact text that should appear
      // Check that we're on page 1 (use regex for flexibility)
      expect(screen.getByTestId('result-count')).toHaveTextContent('1-50 of');
      // Also check pagination shows page 1
      expect(screen.getByTestId('pagination')).toHaveTextContent('Page 1');

      vi.useRealTimers();
    });

    it('shows correct result range in header', () => {
      const manyPods = generateManyPods(75);
      render(<PodsTable pods={manyPods} pageSize={50} showFilters />);

      // Page 1 should show 1-50 of 75
      expect(screen.getByText('1-50 of 75 pods')).toBeInTheDocument();

      // Go to page 2
      fireEvent.click(screen.getByTestId('page-next'));

      // Page 2 should show 51-75 of 75
      expect(screen.getByText('51-75 of 75 pods')).toBeInTheDocument();
    });

    it('respects custom pageSize prop', () => {
      const manyPods = generateManyPods(30);
      render(<PodsTable pods={manyPods} pageSize={10} />);

      // Should show 10 pods per page
      const rows = screen.getAllByTestId(/^pod-row-/);
      expect(rows.length).toBe(10);

      // Should have 3 pages total
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    it('can disable pagination with enablePagination=false', () => {
      const manyPods = generateManyPods(75);
      render(<PodsTable pods={manyPods} enablePagination={false} />);

      // Should show all pods
      const rows = screen.getAllByTestId(/^pod-row-/);
      expect(rows.length).toBe(75);

      // Should not show pagination controls
      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no pods', () => {
      render(<PodsTable pods={[]} />);
      expect(screen.getByTestId('pods-table-empty')).toBeInTheDocument();
      expect(screen.getByText(/no pods available/i)).toBeInTheDocument();
    });

    it('shows empty message when filters match no pods', () => {
      vi.useFakeTimers();
      render(<PodsTable pods={mockPods} showFilters />);

      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'nonexistent' },
      });

      // Fast-forward debounce timer
      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(screen.getByText(/no pods match/i)).toBeInTheDocument();

      vi.useRealTimers();
    });
  });
});
