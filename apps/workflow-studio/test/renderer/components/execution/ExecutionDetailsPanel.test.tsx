import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExecutionDetailsPanel from '../../../../src/renderer/components/execution/ExecutionDetailsPanel';
import type { Execution } from '../../../../src/shared/types/execution';

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

const mockReviseBlock = vi.fn();
const mockSubmitGateDecision = vi.fn();

vi.mock('../../../../src/renderer/stores/executionStore', () => ({
  useExecutionStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      scrutinyLevel: 'summary',
      setScrutinyLevel: vi.fn(),
      reviseBlock: mockReviseBlock,
      submitGateDecision: mockSubmitGateDecision,
    };
    return selector(state);
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createExecution(status: string = 'running'): Execution {
  return {
    id: 'exec-1',
    workflowId: 'wf-1',
    workflow: {
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
          config: { gateMode: 'gate' as const },
          inputs: [],
          outputs: [],
          position: { x: 0, y: 0 },
        },
      ],
      transitions: [],
      gates: [
        {
          id: 'gate-1',
          nodeId: 'node-1',
          gateType: 'approval' as const,
          prompt: 'Review the output',
          options: [
            { label: 'Continue', value: 'continue', isDefault: true },
          ],
          required: true,
        },
      ],
      variables: [],
    },
    status: status as Execution['status'],
    currentNodeId: 'node-1',
    nodeStates: {
      'node-1': {
        nodeId: 'node-1',
        status: status === 'waiting_gate' ? 'waiting_gate' : 'running',
        output: {
          blockType: 'plan',
          markdownDocument: '# Plan',
          taskList: ['Task 1'],
        },
      },
    },
    events: [
      {
        id: 'evt-1',
        type: 'node_started',
        timestamp: '2026-01-01T00:00:00Z',
        message: 'Node started',
        nodeId: 'node-1',
      },
    ],
    variables: {},
    startedAt: '2026-01-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionDetailsPanel with Step Gate tab (T12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Gate Decision tab when status is waiting_gate', () => {
    render(
      <ExecutionDetailsPanel
        execution={createExecution('waiting_gate')}
        selectedNodeId="node-1"
        onGateDecision={vi.fn()}
      />,
    );
    expect(screen.getByText('Gate Decision')).toBeInTheDocument();
  });

  it('does not show Gate Decision tab when status is running', () => {
    render(
      <ExecutionDetailsPanel
        execution={createExecution('running')}
        selectedNodeId="node-1"
        onGateDecision={vi.fn()}
      />,
    );
    expect(screen.queryByText('Gate Decision')).not.toBeInTheDocument();
  });

  it('renders event log tab', () => {
    render(
      <ExecutionDetailsPanel
        execution={createExecution('running')}
        selectedNodeId="node-1"
        onGateDecision={vi.fn()}
      />,
    );
    expect(screen.getByText('Event Log')).toBeInTheDocument();
  });

  it('renders current node tab', () => {
    render(
      <ExecutionDetailsPanel
        execution={createExecution('running')}
        selectedNodeId="node-1"
        onGateDecision={vi.fn()}
      />,
    );
    expect(screen.getByText('Current Node')).toBeInTheDocument();
  });

  it('renders variables tab', () => {
    render(
      <ExecutionDetailsPanel
        execution={createExecution('running')}
        selectedNodeId="node-1"
        onGateDecision={vi.fn()}
      />,
    );
    expect(screen.getByText('Variables')).toBeInTheDocument();
  });
});
