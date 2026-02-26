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

function createMockCLISpawner(sessionId = 'session-1'): CLISpawner & { _spawnedArgs: () => string[] } {
  let spawnedArgs: string[] = [];
  const spawner = {
    spawn: vi.fn((config: { args: string[] }) => {
      spawnedArgs = config.args;
      return { id: sessionId };
    }),
    write: vi.fn(),
    kill: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    killAll: vi.fn(),
    _spawnedArgs: () => spawnedArgs,
  } as unknown as CLISpawner & { _spawnedArgs: () => string[] };
  return spawner;
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { ExecutionEngine } from '../../src/main/services/execution-engine';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionEngine real mode CLI spawn args', () => {
  let mockWindow: BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockWindow = createMockMainWindow();
  });

  it('passes --output-format json and -p to CLI spawner', async () => {
    const mockSpawner = createMockCLISpawner('session-1');

    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: mockSpawner as unknown as CLISpawner,
    });

    const workflow: WorkflowDefinition = {
      id: 'wf-1',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
        tags: [],
      },
      nodes: [{
        id: 'n1',
        type: 'plan',
        label: 'Plan',
        position: { x: 0, y: 0 },
        config: {
          backend: 'claude',
          model: 'sonnet',
          maxTurns: 10,
          systemPrompt: 'Do the planning',
        },
      }],
      transitions: [],
      gates: [],
      variables: [],
    };

    // Start execution; will wait for CLI exit
    const startPromise = engine.start(workflow);

    // Give the engine a tick to spawn
    await new Promise((r) => setTimeout(r, 100));

    // Simulate CLI exit
    engine.handleCLIExit('session-1', 0);

    await startPromise;

    // Verify spawn was called
    expect(mockSpawner.spawn).toHaveBeenCalled();

    const spawnedArgs = mockSpawner._spawnedArgs();

    // Check args contain --output-format json
    expect(spawnedArgs).toContain('--output-format');
    const fmtIdx = spawnedArgs.indexOf('--output-format');
    expect(spawnedArgs[fmtIdx + 1]).toBe('json');

    // Check args contain -p with the prompt
    expect(spawnedArgs).toContain('-p');
    const pIdx = spawnedArgs.indexOf('-p');
    expect(typeof spawnedArgs[pIdx + 1]).toBe('string');
    expect(spawnedArgs[pIdx + 1].length).toBeGreaterThan(0);

    // Check that model and maxTurns are passed
    expect(spawnedArgs).toContain('--model');
    expect(spawnedArgs).toContain('sonnet');
    expect(spawnedArgs).toContain('--max-turns');
    expect(spawnedArgs).toContain('10');

    // write should NOT be called (prompt passed via -p instead)
    expect(mockSpawner.write).not.toHaveBeenCalled();
  });

  it('includes work item context in the -p prompt', async () => {
    const mockSpawner = createMockCLISpawner('session-2');

    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: mockSpawner as unknown as CLISpawner,
    });

    const workflow: WorkflowDefinition = {
      id: 'wf-2',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
        tags: [],
      },
      nodes: [{
        id: 'n1',
        type: 'plan',
        label: 'Plan',
        position: { x: 0, y: 0 },
        config: { backend: 'claude', systemPrompt: 'Plan the feature' },
      }],
      transitions: [],
      gates: [],
      variables: [],
    };

    const workItem = {
      id: 'P15-F01',
      title: 'Prompt Harness',
      type: 'feature' as const,
    };

    const startPromise = engine.start(workflow, workItem);
    await new Promise((r) => setTimeout(r, 100));
    engine.handleCLIExit('session-2', 0);
    await startPromise;

    const spawnedArgs = mockSpawner._spawnedArgs();
    const pIdx = spawnedArgs.indexOf('-p');
    const prompt = spawnedArgs[pIdx + 1];
    expect(prompt).toContain('P15-F01');
    expect(prompt).toContain('Prompt Harness');
  });

  it('places --output-format json before model and other flags', async () => {
    const mockSpawner = createMockCLISpawner('session-3');

    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: mockSpawner as unknown as CLISpawner,
    });

    const workflow: WorkflowDefinition = {
      id: 'wf-3',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
        tags: [],
      },
      nodes: [{
        id: 'n1',
        type: 'plan',
        label: 'Plan',
        position: { x: 0, y: 0 },
        config: {
          backend: 'claude',
          model: 'opus',
          maxTurns: 5,
          extraFlags: ['--verbose'],
          systemPrompt: 'Do work',
        },
      }],
      transitions: [],
      gates: [],
      variables: [],
    };

    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 100));
    engine.handleCLIExit('session-3', 0);
    await startPromise;

    const spawnedArgs = mockSpawner._spawnedArgs();

    // --output-format should be the first arg pair
    expect(spawnedArgs[0]).toBe('--output-format');
    expect(spawnedArgs[1]).toBe('json');

    // -p should be the last arg pair (prompt comes after all flags)
    const pIdx = spawnedArgs.indexOf('-p');
    expect(pIdx).toBe(spawnedArgs.length - 2);

    // Verify all flags are present
    expect(spawnedArgs).toContain('--model');
    expect(spawnedArgs).toContain('opus');
    expect(spawnedArgs).toContain('--max-turns');
    expect(spawnedArgs).toContain('5');
    expect(spawnedArgs).toContain('--verbose');
  });

  it('maxTurns is passed as a string', async () => {
    const mockSpawner = createMockCLISpawner('session-4');

    const engine = new ExecutionEngine(mockWindow, {
      mockMode: false,
      cliSpawner: mockSpawner as unknown as CLISpawner,
    });

    const workflow: WorkflowDefinition = {
      id: 'wf-4',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        createdAt: '',
        updatedAt: '',
        tags: [],
      },
      nodes: [{
        id: 'n1',
        type: 'coding',
        label: 'Coder',
        position: { x: 0, y: 0 },
        config: { backend: 'claude', maxTurns: 25, systemPrompt: 'Code it' },
      }],
      transitions: [],
      gates: [],
      variables: [],
    };

    const startPromise = engine.start(workflow);
    await new Promise((r) => setTimeout(r, 100));
    engine.handleCLIExit('session-4', 0);
    await startPromise;

    const spawnedArgs = mockSpawner._spawnedArgs();
    const mtIdx = spawnedArgs.indexOf('--max-turns');
    expect(spawnedArgs[mtIdx + 1]).toBe('25');
    expect(typeof spawnedArgs[mtIdx + 1]).toBe('string');
  });
});
