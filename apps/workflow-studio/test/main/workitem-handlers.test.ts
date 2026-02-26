// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { WorkItem } from '../../src/shared/types/workitem';

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

describe('workitem-handlers WORKITEM_LOAD_FS', () => {
  beforeEach(() => {
    handlers.clear();
    registerWorkItemHandlers(mockService as any);
  });

  it('returns null when no path is provided', async () => {
    const result = await invokeHandler('workitem:load-fs', '');
    expect(result).toBeNull();
  });

  it('returns null when path does not exist', async () => {
    const result = await invokeHandler('workitem:load-fs', '/tmp/does-not-exist-' + Date.now());
    expect(result).toBeNull();
  });

  it('loads content from prd.md and extracts title', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wi-load-test-'));
    const itemDir = join(dir, 'P01-F01-feature');
    mkdirSync(itemDir);
    writeFileSync(join(itemDir, 'prd.md'), '# My Feature PRD\n\nContent here.');

    try {
      const result = await invokeHandler('workitem:load-fs', itemDir) as WorkItem;
      expect(result).not.toBeNull();
      expect(result.id).toBe('P01-F01-feature');
      expect(result.title).toBe('My Feature PRD');
      expect(result.content).toContain('Content here.');
      expect(result.type).toBe('prd');
      expect(result.source).toBe('filesystem');
      expect(result.path).toBe(itemDir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to user_stories.md when prd.md is absent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wi-load-test-'));
    const itemDir = join(dir, 'P02-F01-stories');
    mkdirSync(itemDir);
    writeFileSync(join(itemDir, 'user_stories.md'), '# User Stories\n\nUS-01: As a user...');

    try {
      const result = await invokeHandler('workitem:load-fs', itemDir) as WorkItem;
      expect(result).not.toBeNull();
      expect(result.title).toBe('User Stories');
      expect(result.content).toContain('US-01');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to design.md when prd.md and user_stories.md are absent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wi-load-test-'));
    const itemDir = join(dir, 'P03-F01-design');
    mkdirSync(itemDir);
    writeFileSync(join(itemDir, 'design.md'), '# Technical Design\n\nArchitecture decisions here.');

    try {
      const result = await invokeHandler('workitem:load-fs', itemDir) as WorkItem;
      expect(result).not.toBeNull();
      expect(result.title).toBe('Technical Design');
      expect(result.content).toContain('Architecture decisions here.');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when directory has no readable content files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wi-load-test-'));
    const itemDir = join(dir, 'P04-F01-empty');
    mkdirSync(itemDir);
    // Only a non-standard file present
    writeFileSync(join(itemDir, 'notes.txt'), 'Some notes');

    try {
      const result = await invokeHandler('workitem:load-fs', itemDir);
      expect(result).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects path traversal attempts', async () => {
    const result = await invokeHandler('workitem:load-fs', '/tmp/../etc/passwd');
    expect(result).toBeNull();
  });
});
