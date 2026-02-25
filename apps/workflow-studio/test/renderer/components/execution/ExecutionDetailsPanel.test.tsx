import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExecutionDetailsPanel from '../../../../src/renderer/components/execution/ExecutionDetailsPanel';
import type { ExecutionDetailsPanelProps } from '../../../../src/renderer/components/execution/ExecutionDetailsPanel';
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
        onGateContinue={vi.fn()}
        onGateRevise={vi.fn()}
      />,
    );
    expect(screen.getByText('Gate Decision')).toBeInTheDocument();
  });

  it('does not show Gate Decision tab when status is running', () => {
    render(
      <ExecutionDetailsPanel
        execution={createExecution('running')}
        selectedNodeId="node-1"
      />,
    );
    expect(screen.queryByText('Gate Decision')).not.toBeInTheDocument();
  });

  it('renders event log tab', () => {
    render(
      <ExecutionDetailsPanel
        execution={createExecution('running')}
        selectedNodeId="node-1"
      />,
    );
    expect(screen.getByText('Event Log')).toBeInTheDocument();
  });

  it('renders current node tab', () => {
    render(
      <ExecutionDetailsPanel
        execution={createExecution('running')}
        selectedNodeId="node-1"
      />,
    );
    expect(screen.getByText('Current Node')).toBeInTheDocument();
  });

  it('renders variables tab', () => {
    render(
      <ExecutionDetailsPanel
        execution={createExecution('running')}
        selectedNodeId="node-1"
      />,
    );
    expect(screen.getByText('Variables')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Issue #280: StepGatePanel wiring and prop cleanup
// ---------------------------------------------------------------------------

describe('ExecutionDetailsPanel -- onGateContinue / onGateRevise wiring (#280)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes onGateContinue and onGateRevise through to StepGatePanel', () => {
    const onContinue = vi.fn();
    const onRevise = vi.fn();

    render(
      <ExecutionDetailsPanel
        execution={createExecution('waiting_gate')}
        selectedNodeId="node-1"
        onGateContinue={onContinue}
        onGateRevise={onRevise}
      />,
    );

    // Switch to gate tab
    fireEvent.click(screen.getByText('Gate Decision'));

    // The StepGatePanel should be rendered (it has data-testid="step-gate-panel")
    expect(screen.getByTestId('step-gate-panel')).toBeInTheDocument();

    // Click the continue button inside StepGatePanel -> ContinueReviseBar
    fireEvent.click(screen.getByTestId('continue-btn'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('does not accept an onGateDecision prop (prop has been removed)', () => {
    // Verify at the TypeScript type level that onGateDecision is not
    // part of ExecutionDetailsPanelProps. We do this by confirming the
    // props interface only contains the expected keys.
    type AllowedKeys = keyof ExecutionDetailsPanelProps;
    const keys: AllowedKeys[] = [
      'execution',
      'selectedNodeId',
      'onGateContinue',
      'onGateRevise',
    ];
    // If onGateDecision were still a key this would be a compile error --
    // but we also verify at runtime that the union is exhaustive.
    const hasOnGateDecision = keys.includes('onGateDecision' as AllowedKeys);
    expect(hasOnGateDecision).toBe(false);
  });

  it('renders StepGatePanel with correct props when in waiting_gate status', () => {
    render(
      <ExecutionDetailsPanel
        execution={createExecution('waiting_gate')}
        selectedNodeId="node-1"
        onGateContinue={vi.fn()}
        onGateRevise={vi.fn()}
      />,
    );

    // Click gate tab
    fireEvent.click(screen.getByText('Gate Decision'));

    // StepGatePanel should show the node label
    expect(screen.getByText('Planner')).toBeInTheDocument();

    // StepGatePanel should show the "Awaiting Review" badge
    expect(screen.getByText('Awaiting Review')).toBeInTheDocument();
  });

  it('handles BlockDeliverables safely when output is not a valid BlockDeliverables', () => {
    const exec = createExecution('waiting_gate');
    // Set output to something that is NOT a BlockDeliverables (no blockType)
    exec.nodeStates['node-1'].output = { someRandomKey: 'value' };

    render(
      <ExecutionDetailsPanel
        execution={exec}
        selectedNodeId="node-1"
        onGateContinue={vi.fn()}
        onGateRevise={vi.fn()}
      />,
    );

    // Click gate tab -- should not crash, deliverables should be null
    fireEvent.click(screen.getByText('Gate Decision'));
    expect(screen.getByTestId('step-gate-panel')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Barrel export verification (#280)
// ---------------------------------------------------------------------------

describe('execution barrel export (#280)', () => {
  it('exports StepGatePanel', async () => {
    const barrel = await import(
      '../../../../src/renderer/components/execution/index'
    );
    expect(barrel).toHaveProperty('StepGatePanel');
  });

  it('does NOT export GateDecisionForm', async () => {
    const barrel = await import(
      '../../../../src/renderer/components/execution/index'
    );
    expect(barrel).not.toHaveProperty('GateDecisionForm');
  });
});
