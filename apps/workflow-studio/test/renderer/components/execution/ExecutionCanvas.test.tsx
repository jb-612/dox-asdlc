import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Execution } from '../../../../src/shared/types/execution';
import type { WorkflowDefinition } from '../../../../src/shared/types/workflow';

// ---------------------------------------------------------------------------
// Mock reactflow (it needs a real DOM with measurements)
// ---------------------------------------------------------------------------

vi.mock('reactflow', () => {
  const ReactFlowMock = ({ nodes, children }: { nodes: unknown[]; children?: React.ReactNode }) => (
    <div data-testid="execution-canvas">
      {(nodes as { id: string; data: { statusClass: string; executionStatus: string } }[]).map((n) => (
        <div
          key={n.id}
          data-testid={`canvas-node`}
          data-status={n.data.executionStatus}
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('renders parallel nodes side by side (same fork source)', () => {
    const execution = createExecution();
    // Add a parallel node that shares the same source as node-2
    execution.workflow.nodes.push({
      id: 'node-3',
      type: 'frontend',
      label: 'Frontend',
      config: {},
      inputs: [],
      outputs: [],
      position: { x: 200, y: 100 },
    });
    execution.workflow.transitions.push({
      id: 't-2',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-3',
      condition: { type: 'always' },
    });
    execution.nodeStates['node-3'] = { nodeId: 'node-3', status: 'running' };

    render(<ExecutionCanvas execution={execution} />);
    const nodes = screen.getAllByTestId('canvas-node');
    expect(nodes).toHaveLength(3);
  });
});
