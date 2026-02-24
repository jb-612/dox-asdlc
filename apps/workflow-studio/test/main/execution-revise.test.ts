// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as BrowserWindow;
}

function createWorkflowWithGate() {
  return {
    id: 'workflow-1',
    metadata: {
      name: 'Test Workflow',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes: [
      {
        id: 'node-1',
        type: 'planner' as const,
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
        prompt: 'Review the plan',
        options: [
          { label: 'Continue', value: 'continue', isDefault: true },
          { label: 'Reject', value: 'reject' },
        ],
        required: true,
      },
    ],
    variables: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionEngine.reviseBlock', () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let mockMainWindow: BrowserWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockMainWindow = createMockMainWindow();
    const mod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = mod.ExecutionEngine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should reject reviseBlock when no execution is active', () => {
    const engine = new ExecutionEngine(mockMainWindow);
    expect(() => engine.reviseBlock('node-1', 'feedback')).toThrow(
      'No active execution',
    );
  });

  it('should reject reviseBlock when node is not in waiting_gate status', async () => {
    const engine = new ExecutionEngine(mockMainWindow);
    const workflow = createWorkflowWithGate();

    // Start execution (it will hit the gate and wait)
    const execPromise = engine.start(workflow);

    // Wait for the gate to be reached
    await new Promise((r) => setTimeout(r, 100));

    // Node is in waiting_gate, submit a decision to move it past
    engine.submitGateDecision('node-1', 'continue');

    await execPromise;

    // Now the node should be completed, not waiting_gate
    expect(() => engine.reviseBlock('node-1', 'feedback')).toThrow(
      'not in waiting_gate',
    );
  });

  it('should reject reviseBlock when revision count exceeds cap (10)', async () => {
    const engine = new ExecutionEngine(mockMainWindow);
    const workflow = createWorkflowWithGate();

    const execPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 100));

    // Manually set revisionCount to 10 on the node state
    const state = engine.getState();
    if (state) {
      state.nodeStates['node-1'].revisionCount = 10;
    }

    expect(() => engine.reviseBlock('node-1', 'more feedback')).toThrow(
      'Maximum revisions (10) reached',
    );

    // Clean up by resolving the gate
    engine.submitGateDecision('node-1', 'continue');
    await execPromise;
  });

  it('should increment revisionCount on successful revise', async () => {
    const engine = new ExecutionEngine(mockMainWindow);
    const workflow = createWorkflowWithGate();

    const execPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 100));

    const state = engine.getState();
    expect(state?.nodeStates['node-1'].status).toBe('waiting_gate');
    expect(state?.nodeStates['node-1'].revisionCount ?? 0).toBe(0);

    // Revise the block -- this synchronously increments revisionCount
    engine.reviseBlock('node-1', 'Please add more detail to the plan');

    // Verify revision count was incremented immediately
    expect(state?.nodeStates['node-1'].revisionCount).toBe(1);

    // Clean up: First wait for status to leave waiting_gate (the __revise__
    // handler sets it to 'running'), then poll for it to return to
    // waiting_gate after mock re-execution completes.
    const deadline = Date.now() + 10000;

    // Phase 1: Wait for status to change away from waiting_gate
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      if (state?.nodeStates['node-1'].status !== 'waiting_gate') break;
    }

    // Phase 2: Wait for waiting_gate to reappear after re-execution
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
      const currentState = engine.getState();
      if (currentState?.nodeStates['node-1'].status === 'waiting_gate') {
        engine.submitGateDecision('node-1', 'continue');
        break;
      }
    }
    await execPromise;
  }, 20000);

  it('should emit block_revision event on successful revise', async () => {
    const engine = new ExecutionEngine(mockMainWindow);
    const workflow = createWorkflowWithGate();

    const execPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 100));

    engine.reviseBlock('node-1', 'Add acceptance criteria');

    // Verify block_revision event emitted synchronously
    const state = engine.getState();
    const revisionEvents = state?.events.filter((e) => e.type === 'block_revision');
    expect(revisionEvents?.length).toBeGreaterThanOrEqual(1);
    expect(revisionEvents?.[0].message).toContain('revised');

    // Clean up: wait for status to transition away from waiting_gate first,
    // then poll for it to come back after mock re-execution.
    const deadline = Date.now() + 10000;

    // Phase 1: Wait for status to leave waiting_gate
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      if (state?.nodeStates['node-1'].status !== 'waiting_gate') break;
    }

    // Phase 2: Wait for waiting_gate to reappear
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
      const currentState = engine.getState();
      if (currentState?.nodeStates['node-1'].status === 'waiting_gate') {
        engine.submitGateDecision('node-1', 'continue');
        break;
      }
    }
    await execPromise;
  }, 20000);
});
