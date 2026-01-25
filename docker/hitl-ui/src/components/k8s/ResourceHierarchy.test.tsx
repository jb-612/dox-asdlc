/**
 * Tests for ResourceHierarchy component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResourceHierarchy from './ResourceHierarchy';
import type { K8sPod } from '../../api/types/kubernetes';

// Mock react-d3-tree since it uses DOM APIs not available in jsdom
vi.mock('react-d3-tree', () => ({
  default: ({ data, onNodeClick, renderCustomNodeElement }: {
    data: unknown;
    onNodeClick?: (node: { data: unknown }) => void;
    renderCustomNodeElement?: (props: { nodeDatum: unknown }) => JSX.Element;
  }) => (
    <div data-testid="mock-tree">
      <div data-testid="tree-data">{JSON.stringify(data)}</div>
      <button
        data-testid="tree-node-click"
        onClick={() => onNodeClick?.({ data: { name: 'test-pod', attributes: { type: 'pod', namespace: 'default' } } })}
      >
        Click Node
      </button>
      {renderCustomNodeElement && (
        <div data-testid="custom-node">
          {renderCustomNodeElement({ nodeDatum: { name: 'test', attributes: { type: 'pod', status: 'healthy' } } })}
        </div>
      )}
    </div>
  ),
}));

// Sample mock pods for testing
const mockPods: K8sPod[] = [
  {
    name: 'orchestrator-7d5f8b6c9-x2k4j',
    namespace: 'dox-asdlc',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-1',
    podIP: '10.244.0.15',
    hostIP: '192.168.1.10',
    containers: [
      { name: 'orchestrator', image: 'dox-asdlc/orchestrator:latest', ready: true, restartCount: 0, state: 'running' },
    ],
    restarts: 0,
    age: '5d',
    createdAt: '2026-01-20T10:00:00Z',
    labels: { app: 'orchestrator' },
    ownerKind: 'Deployment',
    ownerName: 'orchestrator',
  },
  {
    name: 'worker-pool-5b9c6d8f7-m3n2p',
    namespace: 'dox-asdlc',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-2',
    podIP: '10.244.1.22',
    hostIP: '192.168.1.11',
    containers: [
      { name: 'worker', image: 'dox-asdlc/worker:latest', ready: true, restartCount: 2, state: 'running' },
    ],
    restarts: 2,
    age: '5d',
    createdAt: '2026-01-20T10:00:00Z',
    labels: { app: 'worker-pool' },
    ownerKind: 'Deployment',
    ownerName: 'worker-pool',
  },
  {
    name: 'coredns-5d78c9869d-abc12',
    namespace: 'kube-system',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-1',
    podIP: '10.244.0.5',
    hostIP: '192.168.1.10',
    containers: [
      { name: 'coredns', image: 'registry.k8s.io/coredns/coredns:v1.10.1', ready: true, restartCount: 0, state: 'running' },
    ],
    restarts: 0,
    age: '30d',
    createdAt: '2025-12-26T00:00:00Z',
    labels: { 'k8s-app': 'kube-dns' },
    ownerKind: 'Deployment',
    ownerName: 'coredns',
  },
  {
    name: 'pending-pod',
    namespace: 'dox-asdlc',
    status: 'Pending',
    phase: 'Pending',
    nodeName: '',
    podIP: '',
    hostIP: '',
    containers: [
      { name: 'app', image: 'app:latest', ready: false, restartCount: 0, state: 'waiting', stateReason: 'ContainerCreating' },
    ],
    restarts: 0,
    age: '5m',
    createdAt: new Date().toISOString(),
    labels: { app: 'app' },
    ownerKind: 'Deployment',
    ownerName: 'app',
  },
  {
    name: 'failed-pod',
    namespace: 'dox-asdlc',
    status: 'Failed',
    phase: 'Failed',
    nodeName: 'node-2',
    podIP: '10.244.1.50',
    hostIP: '192.168.1.11',
    containers: [
      { name: 'migration', image: 'migration:latest', ready: false, restartCount: 3, state: 'terminated', stateReason: 'Error' },
    ],
    restarts: 3,
    age: '1d',
    createdAt: '2026-01-24T10:00:00Z',
    labels: { app: 'migration' },
    ownerKind: 'Job',
    ownerName: 'migration-job',
  },
];

describe('ResourceHierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering states', () => {
    it('renders loading state when isLoading is true and no pods', () => {
      render(<ResourceHierarchy pods={[]} isLoading={true} />);
      expect(screen.getByTestId('resource-hierarchy-loading')).toBeInTheDocument();
    });

    it('renders empty state when no pods provided', () => {
      render(<ResourceHierarchy pods={[]} />);
      expect(screen.getByTestId('resource-hierarchy-empty')).toBeInTheDocument();
      expect(screen.getByText('No resources to display')).toBeInTheDocument();
    });

    it('renders tree when pods are provided', () => {
      render(<ResourceHierarchy pods={mockPods} />);
      expect(screen.getByTestId('resource-hierarchy')).toBeInTheDocument();
      expect(screen.getByTestId('mock-tree')).toBeInTheDocument();
    });
  });

  describe('controls', () => {
    it('renders namespace filter with all namespaces', () => {
      render(<ResourceHierarchy pods={mockPods} />);
      const filter = screen.getByTestId('namespace-filter');
      expect(filter).toBeInTheDocument();
      expect(filter).toHaveValue('all');

      // Check namespace options
      const options = filter.querySelectorAll('option');
      expect(options.length).toBe(3); // 'all' + 2 namespaces
    });

    it('renders zoom controls', () => {
      render(<ResourceHierarchy pods={mockPods} />);
      expect(screen.getByTestId('zoom-in')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-out')).toBeInTheDocument();
      expect(screen.getByTestId('fit-to-screen')).toBeInTheDocument();
    });

    it('renders legend', () => {
      render(<ResourceHierarchy pods={mockPods} />);
      expect(screen.getByText('Healthy')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Unhealthy')).toBeInTheDocument();
    });
  });

  describe('namespace filtering', () => {
    it('filters pods by selected namespace', () => {
      render(<ResourceHierarchy pods={mockPods} />);
      const filter = screen.getByTestId('namespace-filter');

      fireEvent.change(filter, { target: { value: 'dox-asdlc' } });

      expect(filter).toHaveValue('dox-asdlc');
      // The tree should update with filtered data
      const treeData = screen.getByTestId('tree-data');
      expect(treeData.textContent).toContain('dox-asdlc');
    });

    it('respects initial namespace prop', () => {
      render(<ResourceHierarchy pods={mockPods} namespace="kube-system" />);
      const filter = screen.getByTestId('namespace-filter');
      expect(filter).toHaveValue('kube-system');
    });
  });

  describe('zoom controls', () => {
    it('handles zoom in click', () => {
      render(<ResourceHierarchy pods={mockPods} />);
      const zoomIn = screen.getByTestId('zoom-in');

      // Should not throw
      fireEvent.click(zoomIn);
      expect(zoomIn).toBeInTheDocument();
    });

    it('handles zoom out click', () => {
      render(<ResourceHierarchy pods={mockPods} />);
      const zoomOut = screen.getByTestId('zoom-out');

      fireEvent.click(zoomOut);
      expect(zoomOut).toBeInTheDocument();
    });

    it('handles fit-to-screen click', () => {
      render(<ResourceHierarchy pods={mockPods} />);
      const fitButton = screen.getByTestId('fit-to-screen');

      fireEvent.click(fitButton);
      expect(fitButton).toBeInTheDocument();
    });
  });

  describe('node click handling', () => {
    it('calls onNodeClick when a tree node is clicked', () => {
      const onNodeClick = vi.fn();
      render(<ResourceHierarchy pods={mockPods} onNodeClick={onNodeClick} />);

      const clickButton = screen.getByTestId('tree-node-click');
      fireEvent.click(clickButton);

      expect(onNodeClick).toHaveBeenCalledWith('pod', 'test-pod', 'default');
    });

    it('does not crash when onNodeClick is not provided', () => {
      render(<ResourceHierarchy pods={mockPods} />);

      const clickButton = screen.getByTestId('tree-node-click');
      // Should not throw
      fireEvent.click(clickButton);
    });
  });

  describe('tree data structure', () => {
    it('builds correct tree structure from pods', () => {
      render(<ResourceHierarchy pods={mockPods} namespace="dox-asdlc" />);
      const treeData = screen.getByTestId('tree-data');
      const data = JSON.parse(treeData.textContent || '{}');

      // Should have the namespace as root (since only one namespace)
      expect(data.name).toBe('dox-asdlc');
      expect(data.attributes.type).toBe('namespace');
    });

    it('includes pod counts in tree data', () => {
      render(<ResourceHierarchy pods={mockPods} namespace="dox-asdlc" />);
      const treeData = screen.getByTestId('tree-data');
      const data = JSON.parse(treeData.textContent || '{}');

      // Should have pod counts
      expect(data.attributes.podCount).toBeDefined();
      expect(data.attributes.readyCount).toBeDefined();
    });
  });

  describe('custom styling', () => {
    it('applies custom className', () => {
      render(<ResourceHierarchy pods={mockPods} className="custom-class" />);
      const hierarchy = screen.getByTestId('resource-hierarchy');
      expect(hierarchy).toHaveClass('custom-class');
    });
  });

  describe('accessibility', () => {
    it('has accessible button titles', () => {
      render(<ResourceHierarchy pods={mockPods} />);

      expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
      expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
      expect(screen.getByTitle('Fit to screen')).toBeInTheDocument();
    });
  });
});
