// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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

import { registerWorkItemHandlers } from '../../src/main/ipc/workitem-handlers';
import type { WorkItemReference } from '../../src/shared/types/workitem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Minimal mock service that satisfies the type
const mockService = {
  list: vi.fn().mockResolvedValue([]),
  listAll: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
};

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  return handler({} as Electron.IpcMainInvokeEvent, ...args);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workitem-handlers WORKITEM_LIST_FS', () => {
  beforeEach(() => {
    handlers.clear();
    registerWorkItemHandlers(mockService as any);
  });

  it('returns empty array when no directory is provided', async () => {
    const result = await invokeHandler('workitem:list-fs', '') as WorkItemReference[];
    expect(result).toEqual([]);
  });

  it('returns empty array when directory does not exist', async () => {
    const result = await invokeHandler('workitem:list-fs', '/tmp/does-not-exist-' + Date.now()) as WorkItemReference[];
    expect(result).toEqual([]);
  });

  it('returns work items from filesystem subdirectories', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wi-test-'));

    // Create two work item directories
    mkdirSync(join(dir, 'P01-F01-feature'));
    writeFileSync(join(dir, 'P01-F01-feature', 'design.md'), '# Redis Event Bus\nSome content here.');

    mkdirSync(join(dir, 'P02-F01-other'));
    // No design.md -- should use dirname as title

    // Create a file (not a directory) to ensure it is skipped
    writeFileSync(join(dir, 'README.md'), '# Not a work item');

    try {
      const result = await invokeHandler('workitem:list-fs', dir) as WorkItemReference[];
      expect(result).toHaveLength(2);

      const item1 = result.find((r) => r.id === 'P01-F01-feature');
      expect(item1).toBeTruthy();
      expect(item1!.title).toBe('Redis Event Bus');
      expect(item1!.type).toBe('prd');
      expect(item1!.source).toBe('filesystem');
      expect(item1!.path).toBe(join(dir, 'P01-F01-feature'));

      const item2 = result.find((r) => r.id === 'P02-F01-other');
      expect(item2).toBeTruthy();
      expect(item2!.title).toBe('P02-F01-other'); // Falls back to dirname
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads title from prd.md if design.md is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wi-test-'));
    mkdirSync(join(dir, 'P03-F01-prd'));
    writeFileSync(join(dir, 'P03-F01-prd', 'prd.md'), '# PRD Title\nBody content.');

    try {
      const result = await invokeHandler('workitem:list-fs', dir) as WorkItemReference[];
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('PRD Title');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
