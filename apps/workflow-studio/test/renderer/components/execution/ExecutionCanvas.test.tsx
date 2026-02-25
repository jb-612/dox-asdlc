import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Execution } from '../../../../src/shared/types/execution';
import type { WorkflowDefinition } from '../../../../src/shared/types/workflow';

// ---------------------------------------------------------------------------
// Mock reactflow (it needs a real DOM with measurements)
// ---------------------------------------------------------------------------

const mockFitView = vi.fn();

vi.mock('reactflow', () => {
  const ReactFlowMock = ({ nodes, children }: { nodes: unknown[]; children?: React.ReactNode }) => (
    <div data-testid="execution-canvas">
      {(nodes as { id: string; position: { x: number; y: number }; data: { statusClass: string; executionStatus: string } }[]).map((n) => (
        <div
          key={n.id}
          data-testid={`canvas-node`}
          data-nodeid={n.id}
          data-status={n.data.executionStatus}
          data-x={n.position.x}
          data-y={n.position.y}
          className={n.data.statusClass}
        >
          {n.id}
        </div>
      ))}
      {children}
    </div>
  );
  return {
    __esModule: true,
    default: ReactFlowMock,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    useReactFlow: () => ({ fitView: mockFitView }),
  };
});

// Mock the execution node components that ReactFlow uses
vi.mock('../../../../src/renderer/components/execution/ExecutionAgentNode', () => ({
  default: () => null,
}));
vi.mock('../../../../src/renderer/components/execution/ExecutionGateNode', () => ({
  default: () => null,
}));
vi.mock('../../../../src/renderer/components/execution/ExecutionTransitionEdge', () => ({
  default: () => null,
}));

import ExecutionCanvas from '../../../../src/renderer/components/execution/ExecutionCanvas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createExecution(overrides?: Partial<Execution>): Execution {
  const workflow: WorkflowDefinition = {
    id: 'wf-1',
    metadata: {
      name: 'Test',
      version: '1.0.0',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      tags: [],
    },
    nodes: [
      {
        id: 'node-1',
        type: 'planner',
        label: 'Planner',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 0, y: 0 },
      },
      {
        id: 'node-2',
        type: 'backend',
        label: 'Backend',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 200, y: 0 },
      },
    ],
    transitions: [
      {
        id: 't-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        condition: { type: 'always' },
      },
    ],
    gates: [],
    variables: [],
  };

  return {
    id: 'exec-1',
    workflowId: 'wf-1',
    workflow,
    status: 'running',
    nodeStates: {
      'node-1': { nodeId: 'node-1', status: 'completed' },
      'node-2': { nodeId: 'node-2', status: 'running' },
    },
    events: [],
    variables: {},
    startedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create an execution with a fork-join parallel structure:
 *   node-1 (fork) -> node-2 (backend)  -> node-4 (join)
 *   node-1 (fork) -> node-3 (frontend) -> node-4 (join)
 */
function createParallelExecution(): Execution {
  const workflow: WorkflowDefinition = {
    id: 'wf-2',
    metadata: {
      name: 'Parallel Test',
      version: '1.0.0',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      tags: [],
    },
    nodes: [
      {
        id: 'node-1',
        type: 'planner',
        label: 'Fork',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 0, y: 0 },
      },
      {
        id: 'node-2',
        type: 'backend',
        label: 'Backend',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 200, y: 0 },
      },
      {
        id: 'node-3',
        type: 'frontend',
        label: 'Frontend',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 200, y: 100 },
      },
      {
        id: 'node-4',
        type: 'reviewer',
        label: 'Join',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 400, y: 50 },
      },
    ],
    transitions: [
      {
        id: 't-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        condition: { type: 'always' },
      },
      {
        id: 't-2',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-3',
        condition: { type: 'always' },
      },
      {
        id: 't-3',
        sourceNodeId: 'node-2',
        targetNodeId: 'node-4',
        condition: { type: 'always' },
      },
      {
        id: 't-4',
        sourceNodeId: 'node-3',
        targetNodeId: 'node-4',
        condition: { type: 'always' },
      },
    ],
    gates: [],
    variables: [],
  };

  return {
    id: 'exec-2',
    workflowId: 'wf-2',
    workflow,
    status: 'running',
    nodeStates: {
      'node-1': { nodeId: 'node-1', status: 'completed' },
      'node-2': { nodeId: 'node-2', status: 'running' },
      'node-3': { nodeId: 'node-3', status: 'running' },
      'node-4': { nodeId: 'node-4', status: 'pending' },
    },
    currentNodeId: 'node-2',
    events: [],
    variables: {},
    startedAt: '2026-01-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the canvas container', () => {
    render(<ExecutionCanvas execution={createExecution()} />);
    expect(screen.getByTestId('execution-canvas')).toBeInTheDocument();
  });

  it('renders nodes with canvas-node test ids', () => {
    render(<ExecutionCanvas execution={createExecution()} />);
    const nodes = screen.getAllByTestId('canvas-node');
    expect(nodes).toHaveLength(2);
  });

  it('active (running) node has pulse CSS class', () => {
    render(<ExecutionCanvas execution={createExecution()} />);
    const nodes = screen.getAllByTestId('canvas-node');
    const runningNode = nodes.find((n) => n.getAttribute('data-status') === 'running');
    expect(runningNode).toBeTruthy();
    expect(runningNode!.className).toContain('execution-node-running');
  });

  it('completed node has green color CSS class', () => {
    render(<ExecutionCanvas execution={createExecution()} />);
    const nodes = screen.getAllByTestId('canvas-node');
    const completedNode = nodes.find((n) => n.getAttribute('data-status') === 'completed');
    expect(completedNode).toBeTruthy();
    expect(completedNode!.className).toContain('execution-node-completed');
  });

  describe('parallel layout (dagre)', () => {
    it('renders parallel nodes side by side -- different x, similar y', () => {
      const execution = createParallelExecution();
      render(<ExecutionCanvas execution={execution} />);

      const nodes = screen.getAllByTestId('canvas-node');
      const node2 = nodes.find((n) => n.getAttribute('data-nodeid') === 'node-2');
      const node3 = nodes.find((n) => n.getAttribute('data-nodeid') === 'node-3');

      expect(node2).toBeTruthy();
      expect(node3).toBeTruthy();

      const x2 = Number(node2!.getAttribute('data-x'));
      const x3 = Number(node3!.getAttribute('data-x'));
      const y2 = Number(node2!.getAttribute('data-y'));
      const y3 = Number(node3!.getAttribute('data-y'));

      // Parallel siblings should be placed at the same rank (similar y in TB layout)
      expect(Math.abs(y2 - y3)).toBeLessThan(10);
      // Parallel siblings should have different x positions (side by side)
      expect(Math.abs(x2 - x3)).toBeGreaterThan(20);
    });

    it('fork node is above parallel nodes in TB layout', () => {
      const execution = createParallelExecution();
      render(<ExecutionCanvas execution={execution} />);

      const nodes = screen.getAllByTestId('canvas-node');
      const forkNode = nodes.find((n) => n.getAttribute('data-nodeid') === 'node-1');
      const node2 = nodes.find((n) => n.getAttribute('data-nodeid') === 'node-2');

      const yFork = Number(forkNode!.getAttribute('data-y'));
      const y2 = Number(node2!.getAttribute('data-y'));

      // Fork node should have smaller y (above) in top-to-bottom layout
      expect(yFork).toBeLessThan(y2);
    });

    it('join node is below parallel nodes in TB layout', () => {
      const execution = createParallelExecution();
      render(<ExecutionCanvas execution={execution} />);

      const nodes = screen.getAllByTestId('canvas-node');
      const node2 = nodes.find((n) => n.getAttribute('data-nodeid') === 'node-2');
      const joinNode = nodes.find((n) => n.getAttribute('data-nodeid') === 'node-4');

      const y2 = Number(node2!.getAttribute('data-y'));
      const yJoin = Number(joinNode!.getAttribute('data-y'));

      // Join node should have larger y (below) in top-to-bottom layout
      expect(yJoin).toBeGreaterThan(y2);
    });
  });

  describe('centerOnActiveNode', () => {
    it('calls fitView targeting the active node when currentNodeId is set', async () => {
      const execution = createExecution({
        currentNodeId: 'node-2',
      });

      render(<ExecutionCanvas execution={execution} />);

      // Advance timers past the layout-settle delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mockFitView).toHaveBeenCalled();
      const callArgs = mockFitView.mock.calls[0][0];
      expect(callArgs).toBeDefined();
      // fitView should be called with a nodes filter or specific options
      expect(callArgs.nodes).toBeDefined();
      // The filter should target the active node
      const filteredNodes = callArgs.nodes;
      expect(filteredNodes).toHaveLength(1);
      expect(filteredNodes[0].id).toBe('node-2');
    });

    it('does not call fitView when there is no currentNodeId', () => {
      const execution = createExecution();
      // Ensure no currentNodeId
      delete execution.currentNodeId;

      render(<ExecutionCanvas execution={execution} />);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mockFitView).not.toHaveBeenCalled();
    });
  });
});
