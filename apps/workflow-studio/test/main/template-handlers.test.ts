// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

// ---------------------------------------------------------------------------
// Mocks — ipcMain stub
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
// Helpers
// ---------------------------------------------------------------------------

function makeTemplate(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  const id = uuidv4();
  return {
    id,
    metadata: {
      name: 'Test Template',
      description: 'A test template',
      version: '1.0.0',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      tags: ['test'],
      status: 'active',
    },
    nodes: [
      {
        id: uuidv4(),
        type: 'coding',
        label: 'Coder',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 0, y: 0 },
      },
    ],
    transitions: [],
    gates: [],
    variables: [],
    ...overrides,
  };
}

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  // Simulate ipcMain.handle signature: (event, ...args)
  return handler({} as unknown, ...args);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('template-handlers', () => {
  let tempDir: string;

  beforeEach(async () => {
    handlers.clear();
    tempDir = mkdtempSync(join(tmpdir(), 'template-test-'));

    // Dynamically import to re-trigger registration with fresh handlers map
    const { WorkflowFileService } = await import(
      '../../src/main/services/workflow-file-service'
    );
    const { registerTemplateHandlers } = await import(
      '../../src/main/ipc/template-handlers'
    );
    const fileService = new WorkflowFileService(tempDir);
    registerTemplateHandlers(fileService);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // --- T10 test case 1: list returns empty when no files ----
  it('template:list returns empty array when no templates exist', async () => {
    const result = await invokeHandler('template:list');
    expect(result).toEqual([]);
  });

  // --- T10 test case 2: list returns TemplateListItem with status defaulting to active ---
  it('template:list returns items with status defaulting to active', async () => {
    const template = makeTemplate();
    delete (template.metadata as Record<string, unknown>).status;
    writeFileSync(join(tempDir, 'tpl.json'), JSON.stringify(template));

    const result = (await invokeHandler('template:list')) as Array<Record<string, unknown>>;
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('active');
    expect(result[0].name).toBe('Test Template');
    expect(result[0].nodeCount).toBe(1);
  });

  // --- T10 test case 3: save with invalid schema returns error ---
  it('template:save with invalid data returns error', async () => {
    const result = (await invokeHandler('template:save', { bad: 'data' })) as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // --- T10 test case 4: save with valid template persists ---
  it('template:save persists a valid template', async () => {
    const template = makeTemplate();
    const result = (await invokeHandler('template:save', template)) as Record<string, unknown>;
    expect(result.success).toBe(true);

    // Verify file exists
    const files = readdirSync(tempDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(1);
  });

  // --- T10 test case 5: toggle-status flips active to paused ---
  it('template:toggle-status flips active to paused', async () => {
    const template = makeTemplate();
    template.metadata.status = 'active';
    writeFileSync(join(tempDir, 'tpl.json'), JSON.stringify(template));

    const result = (await invokeHandler('template:toggle-status', template.id)) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(result.status).toBe('paused');

    // Verify persisted via load handler (save uses name-based filename)
    const loaded = (await invokeHandler('template:load', template.id)) as Record<string, unknown> | null;
    expect(loaded).not.toBeNull();
    expect((loaded as { metadata: { status: string } }).metadata.status).toBe('paused');
  });

  // --- T10 test case 6: toggle-status flips paused to active ---
  it('template:toggle-status flips paused to active', async () => {
    const template = makeTemplate();
    template.metadata.status = 'paused';
    writeFileSync(join(tempDir, 'tpl.json'), JSON.stringify(template));

    const result = (await invokeHandler('template:toggle-status', template.id)) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(result.status).toBe('active');
  });

  // --- T10 test case 7: duplicate creates new id and appends (Copy) ---
  it('template:duplicate creates new id with (Copy) suffix and active status', async () => {
    const template = makeTemplate();
    template.metadata.status = 'paused';
    writeFileSync(join(tempDir, 'tpl.json'), JSON.stringify(template));

    const result = (await invokeHandler('template:duplicate', template.id)) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.id).not.toBe(template.id);

    // Verify the duplicated template
    const files = readdirSync(tempDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(2);

    // Find the copy
    for (const f of files) {
      const content = JSON.parse(readFileSync(join(tempDir, f), 'utf-8'));
      if (content.id === result.id) {
        expect(content.metadata.name).toBe('Test Template (Copy)');
        expect(content.metadata.status).toBe('active');
      }
    }
  });

  // --- T10 test case 8: delete returns false for unknown id ---
  it('template:delete returns success false for unknown id', async () => {
    const result = (await invokeHandler('template:delete', 'nonexistent-id')) as Record<string, unknown>;
    expect(result.success).toBe(false);
  });

  // --- T10 test case 9: delete removes an existing template ---
  it('template:delete removes an existing template', async () => {
    const template = makeTemplate();
    writeFileSync(join(tempDir, 'tpl.json'), JSON.stringify(template));

    const result = (await invokeHandler('template:delete', template.id)) as Record<string, unknown>;
    expect(result.success).toBe(true);

    const files = readdirSync(tempDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(0);
  });

  // --- T10 test case 10: toggle-status returns error for unknown id ---
  it('template:toggle-status returns error for unknown id', async () => {
    const result = (await invokeHandler('template:toggle-status', 'nonexistent')) as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(result.error).toBe('Template not found');
  });
});
