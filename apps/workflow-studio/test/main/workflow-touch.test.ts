// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';
import type { WorkflowFileService } from '../../src/main/services/workflow-file-service';

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
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { registerWorkflowHandlers, seedWorkflow } from '../../src/main/ipc/workflow-handlers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkflow(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id: uuidv4(),
    metadata: {
      name: 'Test Workflow',
      version: '1.0.0',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      tags: ['test'],
    },
    nodes: [],
    transitions: [],
    gates: [],
    variables: [],
    ...overrides,
  };
}

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  return handler({} as Electron.IpcMainInvokeEvent, ...args);
}

// ---------------------------------------------------------------------------
// Mock file service factory
// ---------------------------------------------------------------------------

function createMockFileService(workflows: Map<string, WorkflowDefinition>): WorkflowFileService {
  return {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockImplementation(async () =>
      Array.from(workflows.values()).map((w) => ({
        id: w.id,
        name: w.metadata.name,
        description: w.metadata.description,
        version: w.metadata.version,
        updatedAt: w.metadata.updatedAt,
        nodeCount: w.nodes.length,
        tags: w.metadata.tags,
        status: w.metadata.status,
      })),
    ),
    load: vi.fn().mockImplementation(async (id: string) => workflows.get(id) ?? null),
    save: vi.fn().mockImplementation(async (wf: WorkflowDefinition) => {
      workflows.set(wf.id, { ...wf });
      return { success: true, id: wf.id };
    }),
    delete: vi.fn().mockImplementation(async (id: string) => workflows.delete(id)),
  } as unknown as WorkflowFileService;
}

// ---------------------------------------------------------------------------
// Tests: WORKFLOW_TOUCH with file service
// ---------------------------------------------------------------------------

describe('workflow-touch handler with file service', () => {
  let fileWorkflows: Map<string, WorkflowDefinition>;
  let mockFileService: WorkflowFileService;

  beforeEach(() => {
    handlers.clear();
    fileWorkflows = new Map();
    mockFileService = createMockFileService(fileWorkflows);
  });

  it('loads workflow via file service, sets metadata.lastUsedAt to ISO timestamp, and saves', async () => {
    const wf = makeWorkflow();
    expect(wf.metadata.lastUsedAt).toBeUndefined();
    fileWorkflows.set(wf.id, wf);

    registerWorkflowHandlers(mockFileService);

    const result = await invokeHandler('workflow:touch', wf.id) as {
      success: boolean;
      lastUsedAt: string;
    };

    // Handler returns success and a valid ISO timestamp
    expect(result.success).toBe(true);
    expect(result.lastUsedAt).toBeTruthy();
    expect(new Date(result.lastUsedAt).toISOString()).toBe(result.lastUsedAt);

    // File service was used to load and save
    expect(mockFileService.load).toHaveBeenCalledWith(wf.id);
    expect(mockFileService.save).toHaveBeenCalledTimes(1);

    // The saved workflow has lastUsedAt set
    const savedWf = (mockFileService.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as WorkflowDefinition;
    expect(savedWf.metadata.lastUsedAt).toBe(result.lastUsedAt);
  });

  it('also updates metadata.updatedAt when touching', async () => {
    const wf = makeWorkflow();
    const originalUpdatedAt = wf.metadata.updatedAt;
    fileWorkflows.set(wf.id, wf);

    registerWorkflowHandlers(mockFileService);

    const result = await invokeHandler('workflow:touch', wf.id) as {
      success: boolean;
      lastUsedAt: string;
    };

    const savedWf = (mockFileService.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as WorkflowDefinition;
    expect(savedWf.metadata.updatedAt).toBe(result.lastUsedAt);
    expect(savedWf.metadata.updatedAt).not.toBe(originalUpdatedAt);
  });

  it('returns {success: false} when workflow not found in file service or memory', async () => {
    registerWorkflowHandlers(mockFileService);

    const result = await invokeHandler('workflow:touch', 'nonexistent-id') as {
      success: boolean;
      error: string;
    };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('falls back to in-memory cache when file service returns null', async () => {
    registerWorkflowHandlers(mockFileService);

    // Seed into memory (not file service)
    const wf = makeWorkflow();
    seedWorkflow(wf);

    const result = await invokeHandler('workflow:touch', wf.id) as {
      success: boolean;
      lastUsedAt: string;
    };

    expect(result.success).toBe(true);
    expect(result.lastUsedAt).toBeTruthy();

    // File service load was called but returned null, so save was NOT called on file service
    expect(mockFileService.load).toHaveBeenCalledWith(wf.id);
    expect(mockFileService.save).not.toHaveBeenCalled();
  });
});
