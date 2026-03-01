// @vitest-environment node
// ---------------------------------------------------------------------------
// F15-T05: ForEach node execution
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `fe-uuid-${++uuidCounter}`,
}));

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

describe('F15-T05: executeForEachNode', { timeout: 30000 }, () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    const mod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = mod.ExecutionEngine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('3-item array runs body 3 times', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-fe',
      metadata: { name: 'ForEach Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'fe-1', type: 'backend' as const, kind: 'control', label: 'ForEach', config: {
          blockType: 'forEach',
          forEachConfig: { collectionVariable: 'items', itemVariable: 'item', bodyNodeIds: ['body-1'] },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'body-1', type: 'backend' as const, label: 'Body', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'fe-1', targetNodeId: 'body-1', condition: { type: 'always' as const } },
      ],
      gates: [],
      variables: [{ name: 'items', type: 'array', required: true, defaultValue: ['a', 'b', 'c'] }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    expect(result.nodeStates['fe-1'].status).toBe('completed');
    // Body ran for each item — execution events should show iteration data
    const events = result.events.filter(e => e.message?.startsWith('ForEach iteration'));
    expect(events.length).toBe(3);
  });

  it('empty collection skips body', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-fe',
      metadata: { name: 'ForEach Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'fe-1', type: 'backend' as const, kind: 'control', label: 'ForEach', config: {
          blockType: 'forEach',
          forEachConfig: { collectionVariable: 'items', itemVariable: 'item', bodyNodeIds: ['body-1'] },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'body-1', type: 'backend' as const, label: 'Body', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'fe-1', targetNodeId: 'body-1', condition: { type: 'always' as const } },
      ],
      gates: [],
      variables: [{ name: 'items', type: 'array', required: true, defaultValue: [] }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    expect(result.nodeStates['fe-1'].status).toBe('completed');
    // Body should be skipped (not executed as normal)
    expect(result.nodeStates['body-1'].status).toBe('skipped');
  });

  it('maxIterations cap prevents runaway', async () => {
    const bigArray = Array.from({ length: 200 }, (_, i) => i);
    const workflow: WorkflowDefinition = {
      id: 'wf-fe',
      metadata: { name: 'ForEach Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'fe-1', type: 'backend' as const, kind: 'control', label: 'ForEach', config: {
          blockType: 'forEach',
          forEachConfig: { collectionVariable: 'items', itemVariable: 'item', bodyNodeIds: ['body-1'], maxIterations: 5 },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'body-1', type: 'backend' as const, label: 'Body', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'fe-1', targetNodeId: 'body-1', condition: { type: 'always' as const } },
      ],
      gates: [],
      variables: [{ name: 'items', type: 'array', required: true, defaultValue: bigArray }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    expect(result.nodeStates['fe-1'].status).toBe('completed');
    // Should have run exactly 5 iterations, not 200
    const iterEvents = result.events.filter(e => e.message?.startsWith('ForEach iteration'));
    expect(iterEvents.length).toBe(5);
  });

  it('item variable is injected into execution variables', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-fe',
      metadata: { name: 'ForEach Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'fe-1', type: 'backend' as const, kind: 'control', label: 'ForEach', config: {
          blockType: 'forEach',
          forEachConfig: { collectionVariable: 'items', itemVariable: 'currentItem', bodyNodeIds: ['body-1'] },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'body-1', type: 'backend' as const, label: 'Body', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'fe-1', targetNodeId: 'body-1', condition: { type: 'always' as const } },
      ],
      gates: [],
      variables: [{ name: 'items', type: 'array', required: true, defaultValue: ['x'] }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    // After forEach completes, the last item should still be in variables
    expect(result.variables['currentItem']).toBe('x');
  });
});
