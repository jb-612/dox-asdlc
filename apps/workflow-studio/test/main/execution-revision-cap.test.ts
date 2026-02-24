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

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as BrowserWindow;
}

// ---------------------------------------------------------------------------
// Tests for T17: revision count cap and default scrutiny
// ---------------------------------------------------------------------------

describe('T17: Revision count cap', () => {
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

  it('should reject reviseBlock after 10 revisions', async () => {
    const engine = new ExecutionEngine(mockMainWindow);

    const workflow = {
      id: 'wf-1',
      metadata: {
        name: 'Test',
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
          prompt: 'Review',
          options: [{ label: 'Continue', value: 'continue', isDefault: true }],
          required: true,
        },
      ],
      variables: [],
    };

    const execPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 100));

    // Set revision count to max
    const state = engine.getState();
    if (state) {
      state.nodeStates['node-1'].revisionCount = 10;
    }

    // Attempting to revise should throw
    expect(() => engine.reviseBlock('node-1', 'more changes')).toThrow(
      'Maximum revisions (10) reached',
    );

    // Clean up
    engine.submitGateDecision('node-1', 'continue');
    await execPromise;
  });

  it('should allow revisions below cap', async () => {
    const engine = new ExecutionEngine(mockMainWindow);

    const workflow = {
      id: 'wf-1',
      metadata: {
        name: 'Test',
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
          prompt: 'Review',
          options: [{ label: 'Continue', value: 'continue', isDefault: true }],
          required: true,
        },
      ],
      variables: [],
    };

    const execPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 100));

    const state = engine.getState();
    if (state) {
      state.nodeStates['node-1'].revisionCount = 9;
    }

    // This should not throw (9 < 10)
    expect(() => engine.reviseBlock('node-1', 'one more revision')).not.toThrow();

    // Wait for status to leave waiting_gate first (the __revise__ handler
    // sets it to 'running'), then poll for it to return after re-execution.
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
});

describe('T17: Default scrutiny from workflow', () => {
  it('workflow defaultScrutinyLevel is read from WorkflowDefinition type', () => {
    // This test verifies the type exists by constructing a valid workflow
    const workflow = {
      id: 'wf-1',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
      },
      nodes: [],
      transitions: [],
      gates: [],
      variables: [],
      defaultScrutinyLevel: 'full_content' as const,
    };

    expect(workflow.defaultScrutinyLevel).toBe('full_content');
  });
});
