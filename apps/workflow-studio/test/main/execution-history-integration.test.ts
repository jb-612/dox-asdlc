// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExecutionHandlerDeps } from '../../src/main/ipc/execution-handlers';
import type { ExecutionHistoryService } from '../../src/main/services/execution-history-service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    },
  },
  BrowserWindow: {
    getAllWindows: () => [{
      webContents: { send: vi.fn() },
    }],
  },
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `integ-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('F14-T11: History service wiring', () => {
  beforeEach(() => {
    handlers.clear();
    uuidCounter = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('ExecutionHandlerDeps includes historyService field', () => {
    const mockHistoryService = {
      addEntry: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockReturnValue([]),
      getById: vi.fn().mockReturnValue(null),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    const deps: ExecutionHandlerDeps = {
      historyService: mockHistoryService as unknown as ExecutionHistoryService,
    };

    expect(deps.historyService).toBeDefined();
  });

  it('ExecutionEngine receives historyService from deps', async () => {
    const mockHistoryService = {
      addEntry: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockReturnValue([]),
      getById: vi.fn().mockReturnValue(null),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    const { registerExecutionHandlers } = await import('../../src/main/ipc/execution-handlers');
    registerExecutionHandlers({
      historyService: mockHistoryService as unknown as ExecutionHistoryService,
    });

    // Invoke start with a mock workflow to verify historyService is passed through
    const startHandler = handlers.get('execution:start');
    expect(startHandler).toBeDefined();

    const result = await startHandler!({}, {
      workflowId: 'wf-1',
      workflow: {
        id: 'wf-1',
        metadata: { name: 'Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
        nodes: [{ id: 'n1', type: 'backend', label: 'B', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } }],
        transitions: [],
        gates: [],
        variables: [],
      },
      mockMode: true,
    }) as any;

    expect(result).toMatchObject({ success: true });

    // Wait for the async execution to complete
    await new Promise(resolve => setTimeout(resolve, 4000));

    // historyService.addEntry should have been called when execution completed
    expect(mockHistoryService.addEntry).toHaveBeenCalled();
  });

  it('executionStore EventType includes node_retry', async () => {
    // Verify that the execution event type union includes retry events
    const { default: executionTypes } = await import('../../src/shared/types/execution');
    // If we can assign 'node_retry' to ExecutionEventType without error, the type is correct
    const eventType: import('../../src/shared/types/execution').ExecutionEventType = 'node_retry';
    expect(eventType).toBe('node_retry');
  });
});
