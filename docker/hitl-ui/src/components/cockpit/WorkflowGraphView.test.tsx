/**
 * Tests for WorkflowGraphView component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowGraphView, { type WorkflowNode, type WorkflowEdge } from './WorkflowGraphView';

describe('WorkflowGraphView', () => {
  const defaultNodes: WorkflowNode[] = [
    { id: 'discovery', label: 'Discovery', type: 'cluster', status: 'active', runsCount: 25 },
    { id: 'design', label: 'Design', type: 'cluster', status: 'active', runsCount: 18 },
    { id: 'development', label: 'Development', type: 'cluster', status: 'active', runsCount: 42 },
    { id: 'validation', label: 'Validation', type: 'cluster', status: 'idle', runsCount: 12 },
    { id: 'prd-agent', label: 'PRD Agent', type: 'agent', status: 'running', runsCount: 10, parentId: 'discovery' },
    { id: 'acceptance-agent', label: 'Acceptance Agent', type: 'agent', status: 'idle', runsCount: 8, parentId: 'discovery' },
    { id: 'requirements-gate', label: 'Requirements Gate', type: 'gate', status: 'pending', runsCount: 3, parentId: 'discovery' },
  ];

  const defaultEdges: WorkflowEdge[] = [
    { id: 'e1', source: 'discovery', target: 'design', flowCount: 20 },
    { id: 'e2', source: 'design', target: 'development', flowCount: 15 },
    { id: 'e3', source: 'development', target: 'validation', flowCount: 10 },
    { id: 'e4', source: 'prd-agent', target: 'acceptance-agent', flowCount: 8 },
    { id: 'e5', source: 'acceptance-agent', target: 'requirements-gate', flowCount: 5 },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('workflow-graph')).toBeInTheDocument();
    });

    it('renders panel title', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByText(/workflow graph/i)).toBeInTheDocument();
    });

    it('renders all cluster nodes', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('node-discovery')).toBeInTheDocument();
      expect(screen.getByTestId('node-design')).toBeInTheDocument();
      expect(screen.getByTestId('node-development')).toBeInTheDocument();
      expect(screen.getByTestId('node-validation')).toBeInTheDocument();
    });

    it('renders node labels', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByText('Discovery')).toBeInTheDocument();
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} className="my-custom-class" />);
      expect(screen.getByTestId('workflow-graph')).toHaveClass('my-custom-class');
    });
  });

  describe('Node Types', () => {
    it('renders cluster nodes with cluster styling', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('node-discovery')).toHaveClass('node-cluster');
    });

    it('renders agent nodes with agent styling', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} showDetailedView />);
      expect(screen.getByTestId('node-prd-agent')).toHaveClass('node-agent');
    });

    it('renders gate nodes with gate styling', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} showDetailedView />);
      expect(screen.getByTestId('node-requirements-gate')).toHaveClass('node-gate');
    });
  });

  describe('Node Status', () => {
    it('shows active status styling', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('node-discovery')).toHaveClass('status-active');
    });

    it('shows idle status styling', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('node-validation')).toHaveClass('status-idle');
    });

    it('shows running status styling', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} showDetailedView />);
      expect(screen.getByTestId('node-prd-agent')).toHaveClass('status-running');
    });

    it('shows pending status styling', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} showDetailedView />);
      expect(screen.getByTestId('node-requirements-gate')).toHaveClass('status-pending');
    });
  });

  describe('Runs Count', () => {
    it('displays runs count on nodes', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('node-discovery')).toHaveTextContent('25 runs');
      expect(screen.getByTestId('node-development')).toHaveTextContent('42 runs');
    });
  });

  describe('Edges / Connections', () => {
    it('renders edges between nodes', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('edge-e1')).toBeInTheDocument();
      expect(screen.getByTestId('edge-e2')).toBeInTheDocument();
    });

    it('shows flow count on edges', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      const edge = screen.getByTestId('edge-e1');
      expect(edge).toHaveTextContent('20');
    });
  });

  describe('Click Handlers', () => {
    it('calls onNodeClick when node is clicked', () => {
      const onClick = vi.fn();
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} onNodeClick={onClick} />);

      fireEvent.click(screen.getByTestId('node-discovery'));

      expect(onClick).toHaveBeenCalledWith('discovery', 'cluster');
    });

    it('calls onEdgeClick when edge is clicked', () => {
      const onClick = vi.fn();
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} onEdgeClick={onClick} />);

      fireEvent.click(screen.getByTestId('edge-e1'));

      expect(onClick).toHaveBeenCalledWith('discovery', 'design');
    });
  });

  describe('Tooltips', () => {
    it('shows tooltip on node hover', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);

      fireEvent.mouseEnter(screen.getByTestId('node-discovery'));

      expect(screen.getByTestId('node-tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('node-tooltip')).toHaveTextContent('Discovery');
      expect(screen.getByTestId('node-tooltip')).toHaveTextContent('25 runs');
    });

    it('hides tooltip on mouse leave', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);

      fireEvent.mouseEnter(screen.getByTestId('node-discovery'));
      expect(screen.getByTestId('node-tooltip')).toBeInTheDocument();

      fireEvent.mouseLeave(screen.getByTestId('node-discovery'));
      expect(screen.queryByTestId('node-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('View Modes', () => {
    it('shows simplified view by default (clusters only)', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('node-discovery')).toBeInTheDocument();
      expect(screen.queryByTestId('node-prd-agent')).not.toBeInTheDocument();
    });

    it('shows detailed view when enabled', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} showDetailedView />);
      expect(screen.getByTestId('node-discovery')).toBeInTheDocument();
      expect(screen.getByTestId('node-prd-agent')).toBeInTheDocument();
      expect(screen.getByTestId('node-requirements-gate')).toBeInTheDocument();
    });

    it('toggles view mode', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);

      fireEvent.click(screen.getByTestId('toggle-view'));

      expect(screen.getByTestId('node-prd-agent')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('shows horizontal layout by default', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('workflow-graph')).toHaveClass('layout-horizontal');
    });

    it('supports vertical layout', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} layout="vertical" />);
      expect(screen.getByTestId('workflow-graph')).toHaveClass('layout-vertical');
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<WorkflowGraphView nodes={[]} edges={[]} isLoading />);
      expect(screen.getByTestId('workflow-graph-loading')).toBeInTheDocument();
    });

    it('shows skeleton nodes when loading', () => {
      render(<WorkflowGraphView nodes={[]} edges={[]} isLoading />);
      expect(screen.getAllByTestId('node-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no nodes', () => {
      render(<WorkflowGraphView nodes={[]} edges={[]} />);
      expect(screen.getByText(/no workflow data/i)).toBeInTheDocument();
    });
  });

  describe('Legend', () => {
    it('shows legend', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} showLegend />);
      expect(screen.getByTestId('workflow-legend')).toBeInTheDocument();
    });

    it('legend shows node types', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} showLegend />);
      expect(screen.getByText(/cluster/i)).toBeInTheDocument();
      expect(screen.getByText(/agent/i)).toBeInTheDocument();
      expect(screen.getByText(/gate/i)).toBeInTheDocument();
    });

    it('legend shows status colors', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} showLegend />);
      expect(screen.getByTestId('legend-status-active')).toBeInTheDocument();
      expect(screen.getByTestId('legend-status-idle')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper role', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('workflow-graph-container')).toHaveAttribute('role', 'img');
    });

    it('has aria-label', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} />);
      expect(screen.getByTestId('workflow-graph-container')).toHaveAttribute('aria-label', 'Workflow visualization');
    });

    it('nodes are focusable', () => {
      render(<WorkflowGraphView nodes={defaultNodes} edges={defaultEdges} onNodeClick={vi.fn()} />);
      expect(screen.getByTestId('node-discovery')).toHaveAttribute('tabIndex', '0');
    });
  });
});
