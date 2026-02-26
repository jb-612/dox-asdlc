// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';
import type { CLISpawner } from '../../src/main/services/cli-spawner';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `trans-uuid-${++uuidCounter}`,
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

vi.mock('../../src/main/services/diff-capture', () => ({
  captureGitDiff: vi.fn().mockResolvedValue([]),
  parseUnifiedDiff: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(() => 'abc123\n'),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

function createMockCLISpawner(sessionPrefix = 'sess'): CLISpawner {
  let callCount = 0;
  return {
    spawn: vi.fn(() => ({ id: `${sessionPrefix}-${++callCount}` })),
    write: vi.fn(),
    kill: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    killAll: vi.fn(),
  } as unknown as CLISpawner;
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { ExecutionEngine } from '../../src/main/services/execution-engine';

// ---------------------------------------------------------------------------
// Fixtures: two-node workflows with different transition conditions
// ---------------------------------------------------------------------------

function makeTwoNodeWorkflow(
  conditionType: 'always' | 'on_success' | 'on_failure',
): WorkflowDefinition {
  return {
    id: `wf-trans-${conditionType}`,
    metadata: {
      name: `TransTest-${conditionType}`,
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
      tags: [],
    },
    nodes: [
      {
        id: 'node-A',
        type: 'coding',
        label: 'Node A',
        position: { x: 0, y: 0 },
        config: { backend: 'claude', systemPrompt: 'do A' },
      },
      {
        id: 'node-B',
        type: 'coding',
        label: 'Node B',
        position: { x: 100, y: 0 },
        config: { backend: 'claude', systemPrompt: 'do B' },
      },
    ],
    transitions: [
      {
        id: 't-1',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        condition: { type: conditionType },
      },
    ],
    gates: [],
    variables: [],
  };
}

/** Three-node fan-out: A -> B (on_success), A -> C (on_failure) */
function makeFanOutWorkflow(): WorkflowDefinition {
  return {
    id: 'wf-fanout',
    metadata: {
      name: 'FanoutTest',
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
      tags: [],
    },
    nodes: [
      {
        id: 'node-A',
        type: 'coding',
        label: 'Node A',
        position: { x: 0, y: 0 },
        config: { backend: 'claude', systemPrompt: 'do A' },
      },
      {
        id: 'node-B',
        type: 'coding',
        label: 'Node B (success path)',
        position: { x: 100, y: 0 },
        config: { backend: 'claude', systemPrompt: 'do B' },
      },
      {
        id: 'node-C',
        type: 'coding',
        label: 'Node C (failure path)',
        position: { x: 100, y: 100 },
        config: { backend: 'claude', systemPrompt: 'do C' },
      },
    ],
    transitions: [
      {
        id: 't-success',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-B',
        condition: { type: 'on_success' },
      },
      {
        id: 't-failure',
        sourceNodeId: 'node-A',
        targetNodeId: 'node-C',
        condition: { type: 'on_failure' },
      },
    ],
    gates: [],
    variables: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionEngine transition condition evaluation (#291)', () => {
  let mockWindow: BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockWindow = createMockMainWindow();
  });

  it('on_success: executes node-B when node-A succeeds', async () => {
    const spawner = createMockCLISpawner('ts');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test',
    });

    const workflow = makeTwoNodeWorkflow('on_success');
    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 50));

    // Node A succeeds (exit code 0)
    engine.handleCLIExit('ts-1', 0);
    await new Promise((r) => setTimeout(r, 50));

    // Node B should have been started
    expect(spawner.spawn).toHaveBeenCalledTimes(2);

    engine.handleCLIExit('ts-2', 0);
    const execution = await startPromise;

    expect(execution.nodeStates['node-A'].status).toBe('completed');
    expect(execution.nodeStates['node-B'].status).toBe('completed');
  });

  it('on_success: skips node-B when node-A fails', async () => {
    const spawner = createMockCLISpawner('ts');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test',
    });

    const workflow = makeTwoNodeWorkflow('on_success');
    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 50));

    // Node A fails (exit code 1)
    engine.handleCLIExit('ts-1', 1);
    const execution = await startPromise;

    expect(execution.nodeStates['node-A'].status).toBe('failed');
    // Node B should be skipped — only 1 spawn call
    expect(execution.nodeStates['node-B'].status).toBe('skipped');
    expect(spawner.spawn).toHaveBeenCalledTimes(1);
  });

  it('on_failure: executes node-B when node-A fails', async () => {
    const spawner = createMockCLISpawner('ts');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test',
    });

    const workflow = makeTwoNodeWorkflow('on_failure');
    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 50));

    // Node A fails
    engine.handleCLIExit('ts-1', 1);
    await new Promise((r) => setTimeout(r, 50));

    // Node B should have been started
    expect(spawner.spawn).toHaveBeenCalledTimes(2);

    engine.handleCLIExit('ts-2', 0);
    const execution = await startPromise;

    expect(execution.nodeStates['node-A'].status).toBe('failed');
    expect(execution.nodeStates['node-B'].status).toBe('completed');
  });

  it('on_failure: skips node-B when node-A succeeds', async () => {
    const spawner = createMockCLISpawner('ts');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test',
    });

    const workflow = makeTwoNodeWorkflow('on_failure');
    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 50));

    // Node A succeeds
    engine.handleCLIExit('ts-1', 0);
    const execution = await startPromise;

    expect(execution.nodeStates['node-A'].status).toBe('completed');
    // Node B should be skipped
    expect(execution.nodeStates['node-B'].status).toBe('skipped');
    expect(spawner.spawn).toHaveBeenCalledTimes(1);
  });

  it('always: executes node-B regardless of node-A success', async () => {
    const spawner = createMockCLISpawner('ts');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test',
    });

    const workflow = makeTwoNodeWorkflow('always');
    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 50));

    engine.handleCLIExit('ts-1', 0);
    await new Promise((r) => setTimeout(r, 50));

    expect(spawner.spawn).toHaveBeenCalledTimes(2);
    engine.handleCLIExit('ts-2', 0);
    const execution = await startPromise;

    expect(execution.nodeStates['node-B'].status).toBe('completed');
  });

  it('always: executes node-B regardless of node-A failure', async () => {
    const spawner = createMockCLISpawner('ts');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test',
    });

    const workflow = makeTwoNodeWorkflow('always');
    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 50));

    engine.handleCLIExit('ts-1', 1);
    await new Promise((r) => setTimeout(r, 50));

    // Node B should still be started
    expect(spawner.spawn).toHaveBeenCalledTimes(2);
    engine.handleCLIExit('ts-2', 0);
    const execution = await startPromise;

    expect(execution.nodeStates['node-A'].status).toBe('failed');
    expect(execution.nodeStates['node-B'].status).toBe('completed');
  });

  it('fan-out: A success -> B runs, C skipped', async () => {
    const spawner = createMockCLISpawner('ts');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test',
    });

    const workflow = makeFanOutWorkflow();
    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 50));

    // A succeeds
    engine.handleCLIExit('ts-1', 0);
    await new Promise((r) => setTimeout(r, 50));

    // B should run, C should be skipped
    engine.handleCLIExit('ts-2', 0);
    const execution = await startPromise;

    expect(execution.nodeStates['node-A'].status).toBe('completed');
    expect(execution.nodeStates['node-B'].status).toBe('completed');
    expect(execution.nodeStates['node-C'].status).toBe('skipped');
  });

  it('fan-out: A fails -> C runs, B skipped', async () => {
    const spawner = createMockCLISpawner('ts');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test',
    });

    const workflow = makeFanOutWorkflow();
    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 50));

    // A fails
    engine.handleCLIExit('ts-1', 1);
    await new Promise((r) => setTimeout(r, 50));

    // C should run, B should be skipped
    engine.handleCLIExit('ts-2', 0);
    const execution = await startPromise;

    expect(execution.nodeStates['node-A'].status).toBe('failed');
    expect(execution.nodeStates['node-B'].status).toBe('skipped');
    expect(execution.nodeStates['node-C'].status).toBe('completed');
  });

  it('no incoming transitions (root node): always executes', async () => {
    const spawner = createMockCLISpawner('ts');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test',
    });

    // Use a workflow with on_success — node-A has no incoming transitions
    const workflow = makeTwoNodeWorkflow('on_success');
    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 50));

    // Node A should have been started (it's a root node)
    expect(spawner.spawn).toHaveBeenCalledTimes(1);

    engine.handleCLIExit('ts-1', 0);
    await new Promise((r) => setTimeout(r, 50));
    engine.handleCLIExit('ts-2', 0);
    const execution = await startPromise;

    expect(execution.nodeStates['node-A'].status).toBe('completed');
  });
});
