// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';
import type { CLISpawner } from '../../src/main/services/cli-spawner';
import type { RedisEventClient } from '../../src/main/services/redis-client';

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

function createMockCLISpawner(): CLISpawner {
  return {
    spawn: vi.fn().mockReturnValue({
      id: 'cli-session-1',
      config: { command: 'claude', args: [], cwd: '/tmp' },
      status: 'running',
      pid: 9999,
      startedAt: new Date().toISOString(),
    }),
    kill: vi.fn().mockReturnValue(true),
    write: vi.fn().mockReturnValue(true),
    list: vi.fn().mockReturnValue([]),
    killAll: vi.fn(),
  } as unknown as CLISpawner;
}

function createMockRedisClient(): RedisEventClient {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    isConnected: false,
  } as unknown as RedisEventClient;
}

function createSimpleWorkflow(): WorkflowDefinition {
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
        type: 'backend',
        label: 'Backend Agent',
        config: { timeoutSeconds: 5 },
        inputs: [],
        outputs: [],
        position: { x: 0, y: 0 },
      },
    ],
    transitions: [],
    gates: [],
    variables: [],
  };
}

function createTwoNodeWorkflow(): WorkflowDefinition {
  return {
    id: 'workflow-2',
    metadata: {
      name: 'Two Node Workflow',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
        position: { x: 0, y: 100 },
      },
    ],
    transitions: [
      {
        id: 'trans-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        condition: { type: 'always' },
      },
    ],
    gates: [],
    variables: [],
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ExecutionEngine integration', () => {
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

  describe('mock mode (default)', () => {
    it('should execute in mock mode by default', async () => {
      const engine = new ExecutionEngine(mockMainWindow);
      const workflow = createSimpleWorkflow();

      const execution = await engine.start(workflow);

      expect(execution.status).toBe('completed');
      expect(execution.nodeStates['node-1'].status).toBe('completed');
      // Mock mode produces mock output
      expect(execution.nodeStates['node-1'].output).toMatchObject({ mock: true });
    });

    it('should use mock mode when explicitly set to true', async () => {
      const engine = new ExecutionEngine(mockMainWindow, {
        mockMode: true,
      });
      const workflow = createSimpleWorkflow();

      const execution = await engine.start(workflow);

      expect(execution.status).toBe('completed');
      expect(execution.nodeStates['node-1'].output).toMatchObject({ mock: true });
    });
  });

  describe('real CLI mode', () => {
    it('should call CLISpawner.spawn for agent nodes when mockMode is false', async () => {
      const mockSpawner = createMockCLISpawner();

      // Simulate the CLI process exiting with code 0 after spawn
      vi.mocked(mockSpawner.spawn).mockImplementation((config) => {
        const session = {
          id: 'cli-session-1',
          config,
          status: 'running' as const,
          pid: 9999,
          startedAt: new Date().toISOString(),
        };
        // Simulate immediate exit via the onExit callback
        // The engine should handle this by listening for CLI_EXIT events
        setTimeout(() => {
          // Send CLI_EXIT event through IPC mock
          (mockMainWindow.webContents.send as ReturnType<typeof vi.fn>).mock.calls;
        }, 10);
        return session;
      });

      const engine = new ExecutionEngine(mockMainWindow, {
        mockMode: false,
        cliSpawner: mockSpawner,
        nodeTimeoutMs: 5000,
      });

      const workflow = createSimpleWorkflow();
      const execution = await engine.start(workflow);

      // Should have called spawn
      expect(mockSpawner.spawn).toHaveBeenCalledTimes(1);
      const spawnCall = vi.mocked(mockSpawner.spawn).mock.calls[0][0];
      expect(spawnCall.command).toBe('claude');
    });

    it('should handle CLI exit with success (exit code 0)', async () => {
      const mockSpawner = createMockCLISpawner();

      const engine = new ExecutionEngine(mockMainWindow, {
        mockMode: false,
        cliSpawner: mockSpawner,
        nodeTimeoutMs: 5000,
      });

      const workflow = createSimpleWorkflow();
      const executionPromise = engine.start(workflow);

      // Wait for the engine to start and spawn the CLI
      await new Promise((r) => setTimeout(r, 50));

      // Simulate CLI exit with success
      engine.handleCLIExit('cli-session-1', 0);

      const execution = await executionPromise;
      expect(execution.nodeStates['node-1'].status).toBe('completed');
    });

    it('should handle CLI exit with failure (non-zero exit code)', async () => {
      const mockSpawner = createMockCLISpawner();

      const engine = new ExecutionEngine(mockMainWindow, {
        mockMode: false,
        cliSpawner: mockSpawner,
        nodeTimeoutMs: 5000,
      });

      const workflow = createSimpleWorkflow();
      const executionPromise = engine.start(workflow);

      await new Promise((r) => setTimeout(r, 50));

      // Simulate CLI exit with failure
      engine.handleCLIExit('cli-session-1', 1);

      const execution = await executionPromise;
      expect(execution.nodeStates['node-1'].status).toBe('failed');
      expect(execution.nodeStates['node-1'].error).toContain('exit code 1');
    });

    it('should handle abort by killing CLI sessions', async () => {
      const mockSpawner = createMockCLISpawner();

      const engine = new ExecutionEngine(mockMainWindow, {
        mockMode: false,
        cliSpawner: mockSpawner,
        nodeTimeoutMs: 10000,
      });

      const workflow = createSimpleWorkflow();
      const executionPromise = engine.start(workflow);

      // Wait for CLI to be spawned
      await new Promise((r) => setTimeout(r, 50));

      // Abort the execution
      engine.abort();

      const execution = await executionPromise;
      expect(execution.status).toBe('aborted');
      expect(mockSpawner.kill).toHaveBeenCalledWith('cli-session-1');
    });

    it('should pass RedisEventClient without breaking execution', async () => {
      const mockSpawner = createMockCLISpawner();
      const mockRedis = createMockRedisClient();

      const engine = new ExecutionEngine(mockMainWindow, {
        mockMode: false,
        cliSpawner: mockSpawner,
        redisClient: mockRedis,
        nodeTimeoutMs: 5000,
      });

      const workflow = createSimpleWorkflow();
      const executionPromise = engine.start(workflow);

      await new Promise((r) => setTimeout(r, 50));
      engine.handleCLIExit('cli-session-1', 0);

      const execution = await executionPromise;
      expect(execution.status).toBe('completed');
    });
  });

  describe('timeout handling', () => {
    it('should kill CLI session and fail node on timeout', async () => {
      const mockSpawner = createMockCLISpawner();

      const engine = new ExecutionEngine(mockMainWindow, {
        mockMode: false,
        cliSpawner: mockSpawner,
        nodeTimeoutMs: 100, // Very short timeout for test
      });

      const workflow = createSimpleWorkflow();
      const execution = await engine.start(workflow);

      // Should have killed the CLI session due to timeout
      expect(mockSpawner.kill).toHaveBeenCalledWith('cli-session-1');
      expect(execution.nodeStates['node-1'].status).toBe('failed');
      expect(execution.nodeStates['node-1'].error).toContain('timed out');
    });
  });
});
