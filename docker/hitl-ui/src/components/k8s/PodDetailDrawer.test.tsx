/**
 * Tests for PodDetailDrawer component
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PodDetailDrawer from './PodDetailDrawer';
import type { K8sPod, Container } from '../../api/types/kubernetes';
import type { PodEvent } from './PodDetailDrawer';

// Mock ResizeObserver for HeadlessUI Dialog
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver if needed
const IntersectionObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('PodDetailDrawer', () => {
  const mockContainers: Container[] = [
    {
      name: 'main',
      image: 'nginx:1.25',
      ready: true,
      restartCount: 0,
      state: 'running',
    },
    {
      name: 'sidecar',
      image: 'busybox:latest',
      ready: true,
      restartCount: 2,
      state: 'running',
    },
  ];

  const mockPod: K8sPod = {
    name: 'test-pod-abc123',
    namespace: 'test-namespace',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-1',
    podIP: '10.244.0.15',
    hostIP: '192.168.1.10',
    containers: mockContainers,
    restarts: 2,
    age: '5d',
    createdAt: '2026-01-20T10:00:00Z',
    labels: { app: 'test-app', version: 'v1' },
    ownerKind: 'Deployment',
    ownerName: 'test-deployment',
  };

  const mockEvents: PodEvent[] = [
    {
      type: 'Normal',
      reason: 'Scheduled',
      message: 'Successfully assigned to node-1',
      timestamp: '2026-01-25T10:00:00Z',
    },
    {
      type: 'Normal',
      reason: 'Started',
      message: 'Started container main',
      timestamp: '2026-01-25T10:01:00Z',
    },
    {
      type: 'Warning',
      reason: 'BackOff',
      message: 'Back-off restarting failed container',
      timestamp: '2026-01-25T10:02:00Z',
      count: 3,
    },
  ];

  const mockLogs = `2026-01-25T10:00:00Z INFO Starting application
2026-01-25T10:00:01Z INFO Listening on port 8080
2026-01-25T10:00:02Z DEBUG Processing request
2026-01-25T10:00:03Z INFO Request completed`;

  const defaultProps = {
    pod: mockPod,
    isOpen: true,
    onClose: vi.fn(),
    events: mockEvents,
    logs: mockLogs,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing when open', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      expect(screen.getByTestId('pod-detail-drawer')).toBeInTheDocument();
    });

    it('does not render when pod is null', () => {
      render(<PodDetailDrawer {...defaultProps} pod={null} />);
      expect(screen.queryByTestId('pod-detail-drawer')).not.toBeInTheDocument();
    });

    it('shows drawer title', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      expect(screen.getByTestId('drawer-title')).toHaveTextContent('Pod Details');
    });

    it('shows pod name and namespace in header', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      expect(screen.getByText('test-namespace/test-pod-abc123')).toBeInTheDocument();
    });

    it('renders all tabs', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      expect(screen.getByTestId('tab-info')).toBeInTheDocument();
      expect(screen.getByTestId('tab-containers')).toBeInTheDocument();
      expect(screen.getByTestId('tab-events')).toBeInTheDocument();
      expect(screen.getByTestId('tab-logs')).toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(<PodDetailDrawer {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByTestId('close-drawer'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Info Tab', () => {
    it('shows Info tab by default', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      expect(screen.getByTestId('info-tab')).toBeInTheDocument();
    });

    it('displays pod name', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      expect(screen.getByTestId('pod-name')).toHaveTextContent('test-pod-abc123');
    });

    it('displays pod namespace', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      expect(screen.getByTestId('pod-namespace')).toHaveTextContent('test-namespace');
    });

    it('displays pod status badge', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      expect(screen.getByTestId('pod-status')).toHaveTextContent('Running');
    });

    it('displays node name', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      expect(screen.getByTestId('pod-node')).toHaveTextContent('node-1');
    });

    it('displays owner reference', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      const ownerRef = screen.getByTestId('owner-reference');
      expect(ownerRef).toHaveTextContent('Deployment');
      expect(ownerRef).toHaveTextContent('test-deployment');
    });

    it('displays labels', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      const labels = screen.getByTestId('pod-labels');
      expect(labels).toHaveTextContent('app:test-app');
      expect(labels).toHaveTextContent('version:v1');
    });
  });

  describe('Containers Tab', () => {
    it('switches to Containers tab when clicked', () => {
      render(<PodDetailDrawer {...defaultProps} />);

      fireEvent.click(screen.getByTestId('tab-containers'));

      expect(screen.getByTestId('containers-tab')).toBeInTheDocument();
    });

    it('displays all containers', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-containers'));

      expect(screen.getByTestId('container-main')).toBeInTheDocument();
      expect(screen.getByTestId('container-sidecar')).toBeInTheDocument();
    });

    it('displays container name and image', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-containers'));

      const mainContainer = screen.getByTestId('container-main');
      expect(mainContainer).toHaveTextContent('main');
      expect(mainContainer).toHaveTextContent('nginx:1.25');
    });

    it('displays container state', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-containers'));

      const stateElements = screen.getAllByTestId('container-state');
      expect(stateElements[0]).toHaveTextContent('running');
    });

    it('shows message when no containers', () => {
      const podWithNoContainers = { ...mockPod, containers: [] };
      render(<PodDetailDrawer {...defaultProps} pod={podWithNoContainers} />);
      fireEvent.click(screen.getByTestId('tab-containers'));

      expect(screen.getByText('No containers found')).toBeInTheDocument();
    });
  });

  describe('Events Tab', () => {
    it('switches to Events tab when clicked', () => {
      render(<PodDetailDrawer {...defaultProps} />);

      fireEvent.click(screen.getByTestId('tab-events'));

      expect(screen.getByTestId('events-tab')).toBeInTheDocument();
    });

    it('displays all events', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-events'));

      expect(screen.getByTestId('event-0')).toBeInTheDocument();
      expect(screen.getByTestId('event-1')).toBeInTheDocument();
      expect(screen.getByTestId('event-2')).toBeInTheDocument();
    });

    it('displays event reason and message', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-events'));

      expect(screen.getByText('Scheduled')).toBeInTheDocument();
      expect(screen.getByText('Successfully assigned to node-1')).toBeInTheDocument();
    });

    it('shows event type filter buttons', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-events'));

      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-normal')).toBeInTheDocument();
      expect(screen.getByTestId('filter-warning')).toBeInTheDocument();
    });

    it('filters events by type', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-events'));

      // Filter to Warning only
      fireEvent.click(screen.getByTestId('filter-warning'));

      // Should only show Warning event
      expect(screen.getByText('BackOff')).toBeInTheDocument();
      expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();
    });

    it('shows count for repeated events', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-events'));

      expect(screen.getByText('Count: 3')).toBeInTheDocument();
    });

    it('shows message when no events', () => {
      render(<PodDetailDrawer {...defaultProps} events={[]} />);
      fireEvent.click(screen.getByTestId('tab-events'));

      expect(screen.getByText('No events found')).toBeInTheDocument();
    });
  });

  describe('Logs Tab', () => {
    it('switches to Logs tab when clicked', () => {
      render(<PodDetailDrawer {...defaultProps} />);

      fireEvent.click(screen.getByTestId('tab-logs'));

      expect(screen.getByTestId('logs-tab')).toBeInTheDocument();
    });

    it('displays logs content', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      const logsContent = screen.getByTestId('logs-content');
      expect(logsContent).toHaveTextContent('Starting application');
      expect(logsContent).toHaveTextContent('Listening on port 8080');
    });

    it('shows loading state', () => {
      render(<PodDetailDrawer {...defaultProps} isLogsLoading logs="" />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      expect(screen.getByText('Loading logs...')).toBeInTheDocument();
    });

    it('shows no logs message when empty', () => {
      render(<PodDetailDrawer {...defaultProps} logs="" />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      expect(screen.getByText('No logs available')).toBeInTheDocument();
    });

    it('shows container selector for multi-container pods', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      expect(screen.getByTestId('container-selector')).toBeInTheDocument();
    });

    it('calls onContainerSelect when container changed', () => {
      const onContainerSelect = vi.fn();
      render(
        <PodDetailDrawer
          {...defaultProps}
          onContainerSelect={onContainerSelect}
        />
      );
      fireEvent.click(screen.getByTestId('tab-logs'));

      fireEvent.change(screen.getByTestId('container-selector'), {
        target: { value: 'sidecar' },
      });

      expect(onContainerSelect).toHaveBeenCalledWith('sidecar');
    });

    it('hides container selector for single-container pods', () => {
      const singleContainerPod = {
        ...mockPod,
        containers: [mockContainers[0]],
      };
      render(<PodDetailDrawer {...defaultProps} pod={singleContainerPod} />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      expect(screen.queryByTestId('container-selector')).not.toBeInTheDocument();
    });

    it('shows search input', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      expect(screen.getByTestId('log-search')).toBeInTheDocument();
    });

    it('filters logs by search query', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      fireEvent.change(screen.getByTestId('log-search'), {
        target: { value: 'INFO' },
      });

      const logsContent = screen.getByTestId('logs-content');
      expect(logsContent).toHaveTextContent('Starting application');
      expect(logsContent).not.toHaveTextContent('DEBUG');
    });

    it('shows copy logs button', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      expect(screen.getByTestId('copy-logs')).toBeInTheDocument();
    });

    it('shows download logs button', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      expect(screen.getByTestId('download-logs')).toBeInTheDocument();
    });

    it('shows auto-scroll toggle', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      expect(screen.getByTestId('auto-scroll-toggle')).toBeInTheDocument();
    });

    it('toggles auto-scroll on click', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('tab-logs'));

      const toggle = screen.getByTestId('auto-scroll-toggle');

      // Initially auto-scroll should be on (indicated by blue styling)
      expect(toggle).toHaveClass('bg-accent-blue/20');

      // Click to toggle off
      fireEvent.click(toggle);

      expect(toggle).not.toHaveClass('bg-accent-blue/20');
    });
  });

  describe('Tab Switching', () => {
    it('resets to Info tab when pod changes', async () => {
      const { rerender } = render(<PodDetailDrawer {...defaultProps} />);

      // Switch to Containers tab
      fireEvent.click(screen.getByTestId('tab-containers'));
      expect(screen.getByTestId('containers-tab')).toBeInTheDocument();

      // Change the pod
      const newPod = { ...mockPod, name: 'different-pod' };
      rerender(<PodDetailDrawer {...defaultProps} pod={newPod} />);

      // Should be back on Info tab
      await waitFor(() => {
        expect(screen.getByTestId('info-tab')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has close button with sr-only text', () => {
      render(<PodDetailDrawer {...defaultProps} />);
      expect(screen.getByText('Close panel')).toHaveClass('sr-only');
    });
  });
});
