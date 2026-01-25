/**
 * Tests for NodesPanel component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NodesPanel from './NodesPanel';
import type { K8sNode } from '../../api/types/kubernetes';

describe('NodesPanel', () => {
  const mockNodes: K8sNode[] = [
    {
      name: 'node-1',
      status: 'Ready',
      roles: ['control-plane', 'master'],
      version: 'v1.28.4',
      os: 'linux',
      containerRuntime: 'containerd://1.7.2',
      capacity: { cpu: '4', memory: '16Gi', pods: 110 },
      allocatable: { cpu: '3800m', memory: '15Gi', pods: 110 },
      usage: { cpuPercent: 35, memoryPercent: 52, podsCount: 12 },
      conditions: [],
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      name: 'node-2',
      status: 'Ready',
      roles: ['worker'],
      version: 'v1.28.4',
      os: 'linux',
      containerRuntime: 'containerd://1.7.2',
      capacity: { cpu: '8', memory: '32Gi', pods: 110 },
      allocatable: { cpu: '7800m', memory: '31Gi', pods: 110 },
      usage: { cpuPercent: 68, memoryPercent: 71, podsCount: 25 },
      conditions: [],
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      name: 'node-3',
      status: 'NotReady',
      roles: ['worker'],
      version: 'v1.28.4',
      os: 'linux',
      containerRuntime: 'containerd://1.7.2',
      capacity: { cpu: '8', memory: '32Gi', pods: 110 },
      allocatable: { cpu: '7800m', memory: '31Gi', pods: 110 },
      usage: { cpuPercent: 0, memoryPercent: 0, podsCount: 0 },
      conditions: [],
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getByTestId('nodes-panel')).toBeInTheDocument();
    });

    it('renders all node cards', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getByTestId('node-card-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('node-card-node-2')).toBeInTheDocument();
      expect(screen.getByTestId('node-card-node-3')).toBeInTheDocument();
    });

    it('displays node names', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getByText('node-1')).toBeInTheDocument();
      expect(screen.getByText('node-2')).toBeInTheDocument();
      expect(screen.getByText('node-3')).toBeInTheDocument();
    });

    it('displays node roles', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getByText('control-plane')).toBeInTheDocument();
      expect(screen.getByText('master')).toBeInTheDocument();
      expect(screen.getAllByText('worker')).toHaveLength(2);
    });

    it('applies custom className', () => {
      render(<NodesPanel nodes={mockNodes} className="my-custom-class" />);
      expect(screen.getByTestId('nodes-panel')).toHaveClass('my-custom-class');
    });
  });

  describe('Status Display', () => {
    it('shows Ready status correctly', () => {
      render(<NodesPanel nodes={mockNodes} />);
      const node1 = screen.getByTestId('node-card-node-1');
      expect(node1).toHaveTextContent('Ready');
    });

    it('shows NotReady status correctly', () => {
      render(<NodesPanel nodes={mockNodes} />);
      const node3 = screen.getByTestId('node-card-node-3');
      expect(node3).toHaveTextContent('Not Ready');
    });

    it('color codes Ready nodes with success style', () => {
      render(<NodesPanel nodes={mockNodes} />);
      const node1 = screen.getByTestId('node-card-node-1');
      expect(node1).toHaveClass('bg-status-success/10');
    });

    it('color codes NotReady nodes with error style', () => {
      render(<NodesPanel nodes={mockNodes} />);
      const node3 = screen.getByTestId('node-card-node-3');
      expect(node3).toHaveClass('bg-status-error/10');
    });
  });

  describe('Node Information', () => {
    it('displays version', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getAllByText(/v1\.28\.4/)).toHaveLength(3);
    });

    it('displays container runtime', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getAllByText(/containerd/)).toHaveLength(3);
    });

    it('displays OS', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getAllByText(/linux/)).toHaveLength(3);
    });

    it('displays pod count', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getByText(/12\/110/)).toBeInTheDocument();
      expect(screen.getByText(/25\/110/)).toBeInTheDocument();
    });
  });

  describe('Status Filters', () => {
    it('renders filter buttons', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getByTestId('status-filters')).toBeInTheDocument();
      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-ready')).toBeInTheDocument();
      expect(screen.getByTestId('filter-notready')).toBeInTheDocument();
    });

    it('shows count in filter buttons', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getByTestId('filter-all')).toHaveTextContent('(3)');
      expect(screen.getByTestId('filter-ready')).toHaveTextContent('(2)');
      expect(screen.getByTestId('filter-notready')).toHaveTextContent('(1)');
    });

    it('filters nodes when filter clicked', () => {
      render(<NodesPanel nodes={mockNodes} />);

      // Click Ready filter
      fireEvent.click(screen.getByTestId('filter-ready'));

      // Should show only Ready nodes
      expect(screen.getByTestId('node-card-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('node-card-node-2')).toBeInTheDocument();
      expect(screen.queryByTestId('node-card-node-3')).not.toBeInTheDocument();
    });

    it('shows all nodes when All filter clicked', () => {
      render(<NodesPanel nodes={mockNodes} />);

      // Click NotReady, then All
      fireEvent.click(screen.getByTestId('filter-notready'));
      fireEvent.click(screen.getByTestId('filter-all'));

      // Should show all nodes
      expect(screen.getByTestId('node-card-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('node-card-node-2')).toBeInTheDocument();
      expect(screen.getByTestId('node-card-node-3')).toBeInTheDocument();
    });

    it('shows empty message when filter matches no nodes', () => {
      render(<NodesPanel nodes={mockNodes} />);

      // Click Unknown filter (no nodes have this status)
      fireEvent.click(screen.getByTestId('filter-unknown'));

      expect(screen.getByText(/no nodes match/i)).toBeInTheDocument();
    });
  });

  describe('Click Handler', () => {
    it('calls onNodeClick when node card clicked', () => {
      const onNodeClick = vi.fn();
      render(<NodesPanel nodes={mockNodes} onNodeClick={onNodeClick} />);

      fireEvent.click(screen.getByTestId('node-card-node-1'));

      expect(onNodeClick).toHaveBeenCalledTimes(1);
      expect(onNodeClick).toHaveBeenCalledWith(mockNodes[0]);
    });

    it('nodes are clickable when onNodeClick provided', () => {
      const onNodeClick = vi.fn();
      render(<NodesPanel nodes={mockNodes} onNodeClick={onNodeClick} />);

      const nodeCard = screen.getByTestId('node-card-node-1');
      expect(nodeCard).toHaveClass('cursor-pointer');
    });
  });

  describe('Loading State', () => {
    it('shows loading skeletons when isLoading and no nodes', () => {
      render(<NodesPanel nodes={[]} isLoading />);
      expect(screen.getByTestId('nodes-panel-loading')).toBeInTheDocument();
      expect(screen.getAllByTestId('node-skeleton')).toHaveLength(3);
    });

    it('shows nodes when isLoading but nodes exist', () => {
      render(<NodesPanel nodes={mockNodes} isLoading />);
      expect(screen.getByTestId('nodes-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('nodes-panel-loading')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no nodes', () => {
      render(<NodesPanel nodes={[]} />);
      expect(screen.getByTestId('nodes-panel-empty')).toBeInTheDocument();
      expect(screen.getByText(/no nodes available/i)).toBeInTheDocument();
    });
  });

  describe('Grid Layout', () => {
    it('renders nodes in a grid', () => {
      render(<NodesPanel nodes={mockNodes} />);
      expect(screen.getByTestId('nodes-grid')).toHaveClass('grid');
    });

    it('uses responsive grid columns', () => {
      render(<NodesPanel nodes={mockNodes} />);
      const grid = screen.getByTestId('nodes-grid');
      expect(grid).toHaveClass('md:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
    });
  });
});
