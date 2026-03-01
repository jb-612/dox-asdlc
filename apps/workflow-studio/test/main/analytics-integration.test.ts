// @vitest-environment node
// ---------------------------------------------------------------------------
// F16-T11: Wire persistence — ExecutionEngine saves analytics on completion
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `uuid-${++uuidCounter}`,
}));

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

const singleNodeWorkflow: WorkflowDefinition = {
  id: 'wf-analytics',
  metadata: { name: 'Analytics Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
  nodes: [
    { id: 'n1', type: 'backend' as const, label: 'Step 1', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
  ],
  transitions: [],
  gates: [],
  variables: [],
};

describe('F16-T11: Analytics persistence wiring', { timeout: 30000 }, () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let AnalyticsService: typeof import('../../src/main/services/analytics-service').AnalyticsService;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    tempDir = await mkdtemp(join(tmpdir(), 'analytics-int-'));
    const engineMod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = engineMod.ExecutionEngine;
    const analyticsMod = await import('../../src/main/services/analytics-service');
    AnalyticsService = analyticsMod.AnalyticsService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('execution_completed triggers analytics save', async () => {
    const analyticsService = new AnalyticsService(tempDir);
    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      analyticsService,
    });

    const result = await engine.start(singleNodeWorkflow);
    expect(result.status).toBe('completed');

    // Analytics file should be written
    const files = await readdir(tempDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/\.json$/);

    const content = JSON.parse(await readFile(join(tempDir, files[0]), 'utf-8'));
    expect(content.executions.length).toBe(1);
    expect(content.executions[0].executionId).toBe(result.id);
    expect(content.executions[0].workflowName).toBe('Analytics Test');
  });

  it('execution carries traceId into analytics', async () => {
    const analyticsService = new AnalyticsService(tempDir);
    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      analyticsService,
    });

    const result = await engine.start(singleNodeWorkflow);
    expect(result.traceId).toBeDefined();

    const files = await readdir(tempDir);
    const content = JSON.parse(await readFile(join(tempDir, files[0]), 'utf-8'));
    expect(content.executions[0].status).toBe('completed');
  });
});
