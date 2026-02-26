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
  v4: () => `test-uuid-${++uuidCounter}`,
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

// Mock the diff-capture module
const mockCaptureGitDiff = vi.fn();
vi.mock('../../src/main/services/diff-capture', () => ({
  captureGitDiff: (...args: unknown[]) => mockCaptureGitDiff(...args),
  parseUnifiedDiff: vi.fn(),
}));

// Mock child_process for git rev-parse
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
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

function createMockCLISpawner(sessionId = 'session-1'): CLISpawner {
  return {
    spawn: vi.fn(() => ({ id: sessionId })),
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
// Test fixtures
// ---------------------------------------------------------------------------

function makeCodeWorkflow(): WorkflowDefinition {
  return {
    id: 'wf-diff',
    metadata: {
      name: 'DiffTest',
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
      tags: [],
    },
    nodes: [{
      id: 'code-node-1',
      type: 'coding',
      label: 'Code Block',
      position: { x: 0, y: 0 },
      config: {
        backend: 'claude',
        systemPrompt: 'Implement the feature',
      },
    }],
    transitions: [],
    gates: [],
    variables: [],
  };
}

function makePlanWorkflow(): WorkflowDefinition {
  return {
    id: 'wf-plan',
    metadata: {
      name: 'PlanTest',
      version: '1.0.0',
      createdAt: '',
      updatedAt: '',
      tags: [],
    },
    nodes: [{
      id: 'plan-node-1',
      type: 'plan',
      label: 'Plan Block',
      position: { x: 0, y: 0 },
      config: {
        backend: 'claude',
        systemPrompt: 'Plan the feature',
      },
    }],
    transitions: [],
    gates: [],
    variables: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionEngine diff capture integration (T05)', () => {
  let mockWindow: BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockWindow = createMockMainWindow();
    mockExecSync.mockReturnValue('abc123\n');
    mockCaptureGitDiff.mockResolvedValue([]);
  });

  it('captures pre-execution SHA before spawning CLI for code blocks', async () => {
    const spawner = createMockCLISpawner('sess-diff-1');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test-repo',
    });

    const startPromise = engine.start(makeCodeWorkflow());
    await new Promise((r) => setTimeout(r, 100));
    engine.handleCLIExit('sess-diff-1', 0);
    await startPromise;

    // Should have called git rev-parse HEAD to get the pre-exec SHA
    expect(mockExecSync).toHaveBeenCalledWith(
      'git rev-parse HEAD',
      expect.objectContaining({ cwd: '/tmp/test-repo' }),
    );
  });

  it('calls captureGitDiff after successful code block execution', async () => {
    const spawner = createMockCLISpawner('sess-diff-2');
    mockCaptureGitDiff.mockResolvedValue([
      { path: 'src/app.ts', oldContent: 'old', newContent: 'new', hunks: [] },
    ]);

    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test-repo',
    });

    const startPromise = engine.start(makeCodeWorkflow());
    await new Promise((r) => setTimeout(r, 100));
    engine.handleCLIExit('sess-diff-2', 0);
    const execution = await startPromise;

    // Should have called captureGitDiff with workDir and the pre-exec SHA
    expect(mockCaptureGitDiff).toHaveBeenCalledWith('/tmp/test-repo', 'abc123');

    // fileDiffs should be stored in the node output
    const nodeState = execution.nodeStates['code-node-1'];
    expect(nodeState.status).toBe('completed');
    const output = nodeState.output as Record<string, unknown>;
    expect(output.fileDiffs).toEqual([
      { path: 'src/app.ts', oldContent: 'old', newContent: 'new', hunks: [] },
    ]);
  });

  it('does NOT call captureGitDiff for non-code blocks', async () => {
    const spawner = createMockCLISpawner('sess-diff-3');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test-repo',
    });

    const startPromise = engine.start(makePlanWorkflow());
    await new Promise((r) => setTimeout(r, 100));
    engine.handleCLIExit('sess-diff-3', 0);
    await startPromise;

    expect(mockCaptureGitDiff).not.toHaveBeenCalled();
  });

  it('does NOT call captureGitDiff when CLI exits with non-zero code', async () => {
    const spawner = createMockCLISpawner('sess-diff-4');
    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test-repo',
    });

    const startPromise = engine.start(makeCodeWorkflow());
    await new Promise((r) => setTimeout(r, 100));
    engine.handleCLIExit('sess-diff-4', 1);
    await startPromise;

    expect(mockCaptureGitDiff).not.toHaveBeenCalled();
  });

  it('handles captureGitDiff failure gracefully', async () => {
    const spawner = createMockCLISpawner('sess-diff-5');
    mockCaptureGitDiff.mockRejectedValue(new Error('git not found'));

    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test-repo',
    });

    const startPromise = engine.start(makeCodeWorkflow());
    await new Promise((r) => setTimeout(r, 100));
    engine.handleCLIExit('sess-diff-5', 0);
    const execution = await startPromise;

    // Node should still complete successfully even if diff capture fails
    const nodeState = execution.nodeStates['code-node-1'];
    expect(nodeState.status).toBe('completed');
  });

  it('handles git rev-parse failure gracefully', async () => {
    const spawner = createMockCLISpawner('sess-diff-6');
    mockExecSync.mockImplementation(() => {
      throw new Error('not a git repository');
    });

    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: spawner,
      workingDirectory: '/tmp/test-repo',
    });

    const startPromise = engine.start(makeCodeWorkflow());
    await new Promise((r) => setTimeout(r, 100));
    engine.handleCLIExit('sess-diff-6', 0);
    const execution = await startPromise;

    // Node should still complete — diff capture is best-effort
    const nodeState = execution.nodeStates['code-node-1'];
    expect(nodeState.status).toBe('completed');
    // captureGitDiff should NOT be called without a valid pre-exec SHA
    expect(mockCaptureGitDiff).not.toHaveBeenCalled();
  });
});
