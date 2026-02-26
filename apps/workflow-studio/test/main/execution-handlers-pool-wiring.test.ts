// @vitest-environment node
// ---------------------------------------------------------------------------
// P15-F09 T04: ContainerPool wiring from execution-handlers
//
// Verifies that when getContainerPool is provided to registerExecutionHandlers,
// the pool reference is injected into the ExecutionEngine when an execution
// starts. Also verifies that a null pool does not set anything.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockBrowserWindowInstance, mockIpcMainHandle, mockIpcMainOn, capturedHandlers } = vi.hoisted(() => {
  const capturedHandlers: Record<string, (...args: unknown[]) => unknown> = {};

  const mockIpcMainHandle = vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    capturedHandlers[channel] = handler;
  });

  const mockIpcMainOn = vi.fn();

  const mockBrowserWindowInstance = {
    webContents: {
      send: vi.fn(),
    },
  };

  return { mockBrowserWindowInstance, mockIpcMainHandle, mockIpcMainOn, capturedHandlers };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcMainHandle,
    on: mockIpcMainOn,
  },
  BrowserWindow: {
    getAllWindows: () => [mockBrowserWindowInstance],
  },
}));

// Mock the ExecutionEngine to capture the containerPool assignment
const { MockExecutionEngine, mockEngineInstances } = vi.hoisted(() => {
  const mockEngineInstances: Array<{
    containerPool: unknown;
    isActive: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
  }> = [];

  const MockExecutionEngine = vi.fn().mockImplementation(() => {
    const instance = {
      containerPool: null as unknown,
      isActive: vi.fn().mockReturnValue(false),
      start: vi.fn().mockResolvedValue({ id: 'exec-1', status: 'running' }),
      getState: vi.fn().mockReturnValue({
        id: 'exec-1',
        status: 'running',
        variables: {},
      }),
      pause: vi.fn(),
      resume: vi.fn(),
      abort: vi.fn(),
      submitGateDecision: vi.fn(),
      reviseBlock: vi.fn(),
      handleCLIExit: vi.fn(),
      handleCLIOutput: vi.fn(),
    };
    mockEngineInstances.push(instance);
    return instance;
  });

  return { MockExecutionEngine, mockEngineInstances };
});

vi.mock('../../src/main/services/execution-engine', () => ({
  ExecutionEngine: MockExecutionEngine,
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { registerExecutionHandlers } from '../../src/main/ipc/execution-handlers';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalWorkflow(id: string) {
  return {
    workflowId: id,
    workflow: {
      id,
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
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Execution handlers - ContainerPool wiring (P15-F09 T04)', () => {
  beforeEach(() => {
    mockEngineInstances.length = 0;
    // Clear captured handlers between tests
    for (const key of Object.keys(capturedHandlers)) {
      delete capturedHandlers[key];
    }
    // Re-configure mocks that clearAllMocks would have reset
    MockExecutionEngine.mockImplementation(() => {
      const instance = {
        containerPool: null as unknown,
        isActive: vi.fn().mockReturnValue(false),
        start: vi.fn().mockResolvedValue({ id: 'exec-1', status: 'running' }),
        getState: vi.fn().mockReturnValue({
          id: 'exec-1',
          status: 'running',
          variables: {},
        }),
        pause: vi.fn(),
        resume: vi.fn(),
        abort: vi.fn(),
        submitGateDecision: vi.fn(),
        reviseBlock: vi.fn(),
        handleCLIExit: vi.fn(),
        handleCLIOutput: vi.fn(),
      };
      mockEngineInstances.push(instance);
      return instance;
    });
  });

  it('sets engine.containerPool when getContainerPool returns a pool', async () => {
    const mockPool = {
      acquire: vi.fn(),
      release: vi.fn(),
      teardown: vi.fn(),
    };

    registerExecutionHandlers({
      getContainerPool: () => mockPool,
    });

    const startHandler = capturedHandlers[IPC_CHANNELS.EXECUTION_START];
    expect(startHandler).toBeDefined();

    await startHandler({}, makeMinimalWorkflow('wf-1'));

    expect(mockEngineInstances.length).toBe(1);
    expect(mockEngineInstances[0].containerPool).toBe(mockPool);
  });

  it('does not set engine.containerPool when getContainerPool returns null', async () => {
    registerExecutionHandlers({
      getContainerPool: () => null,
    });

    const startHandler = capturedHandlers[IPC_CHANNELS.EXECUTION_START];
    expect(startHandler).toBeDefined();

    await startHandler({}, makeMinimalWorkflow('wf-2'));

    expect(mockEngineInstances.length).toBe(1);
    expect(mockEngineInstances[0].containerPool).toBeNull();
  });

  it('does not set engine.containerPool when getContainerPool is not provided', async () => {
    registerExecutionHandlers({});

    const startHandler = capturedHandlers[IPC_CHANNELS.EXECUTION_START];
    expect(startHandler).toBeDefined();

    await startHandler({}, makeMinimalWorkflow('wf-3'));

    expect(mockEngineInstances.length).toBe(1);
    expect(mockEngineInstances[0].containerPool).toBeNull();
  });

  it('calls getContainerPool at execution start time (not registration time)', async () => {
    let poolValue: unknown = null;
    const getContainerPool = vi.fn(() => poolValue);

    registerExecutionHandlers({
      getContainerPool,
    });

    // getContainerPool should NOT have been called during registration
    expect(getContainerPool).not.toHaveBeenCalled();

    const startHandler = capturedHandlers[IPC_CHANNELS.EXECUTION_START];

    // Now set the pool value (simulating async pool init completing after registration)
    const mockPool = {
      acquire: vi.fn(),
      release: vi.fn(),
      teardown: vi.fn(),
    };
    poolValue = mockPool;

    await startHandler({}, makeMinimalWorkflow('wf-4'));

    // getContainerPool should have been called at execution start
    expect(getContainerPool).toHaveBeenCalledOnce();
    expect(mockEngineInstances[0].containerPool).toBe(mockPool);
  });
});
