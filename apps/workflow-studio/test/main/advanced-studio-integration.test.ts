// @vitest-environment node
// ---------------------------------------------------------------------------
// F15-T14: Integration round-trip
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';
import { validateWorkflow } from '../../src/main/services/workflow-validator';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `int-uuid-${++uuidCounter}`,
}));

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

describe('F15-T14: Advanced Studio integration', { timeout: 30000 }, () => {
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

  it('condition branch workflow executes correct path', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-int-cond',
      metadata: { name: 'Int Cond', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'cond-1', type: 'backend' as const, kind: 'control', label: 'Check', config: {
          blockType: 'condition',
          conditionConfig: { expression: 'mode == "fast"', trueBranchNodeId: 'fast', falseBranchNodeId: 'slow' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'fast', type: 'backend' as const, label: 'Fast Path', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
        { id: 'slow', type: 'backend' as const, label: 'Slow Path', config: {}, inputs: [], outputs: [], position: { x: 100, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'cond-1', targetNodeId: 'fast', condition: { type: 'always' as const } },
        { id: 't2', sourceNodeId: 'cond-1', targetNodeId: 'slow', condition: { type: 'always' as const } },
      ],
      gates: [],
      variables: [{ name: 'mode', type: 'string', required: true, defaultValue: 'fast' }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);
    expect(result.nodeStates['cond-1'].status).toBe('completed');
    expect(result.nodeStates['fast'].status).toBe('completed');
    expect(result.nodeStates['slow'].status).toBe('skipped');
  });

  it('forEach 3-item body executes correctly', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-int-fe',
      metadata: { name: 'Int FE', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'fe-1', type: 'backend' as const, kind: 'control', label: 'Loop', config: {
          blockType: 'forEach',
          forEachConfig: { collectionVariable: 'items', itemVariable: 'item', bodyNodeIds: ['body-1'] },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'body-1', type: 'backend' as const, label: 'Body', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'fe-1', targetNodeId: 'body-1', condition: { type: 'always' as const } },
      ],
      gates: [],
      variables: [{ name: 'items', type: 'array', required: true, defaultValue: ['x', 'y', 'z'] }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);
    expect(result.nodeStates['fe-1'].status).toBe('completed');
    const iterEvents = result.events.filter(e => e.message?.startsWith('ForEach iteration'));
    expect(iterEvents.length).toBe(3);
  });

  it('subWorkflow child completes successfully', async () => {
    const childWorkflow: WorkflowDefinition = {
      id: 'wf-child',
      metadata: { name: 'Child', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'c1', type: 'backend' as const, label: 'Child Step', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const workflow: WorkflowDefinition = {
      id: 'wf-int-sw',
      metadata: { name: 'Int SW', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'sw-1', type: 'backend' as const, kind: 'control', label: 'Sub', config: {
          blockType: 'subWorkflow',
          subWorkflowConfig: { workflowId: 'wf-child' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      workflowResolver: (id: string) => id === 'wf-child' ? childWorkflow : null,
    });
    const result = await engine.start(workflow);
    expect(result.nodeStates['sw-1'].status).toBe('completed');
  });

  it('save/reload preserves structure (JSON round-trip)', () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-roundtrip',
      metadata: { name: 'Round Trip', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'cond-1', type: 'backend' as const, kind: 'control', label: 'Cond', config: {
          blockType: 'condition',
          conditionConfig: { expression: 'x > 0', trueBranchNodeId: 'a', falseBranchNodeId: 'b' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'fe-1', type: 'backend' as const, kind: 'control', label: 'FE', config: {
          blockType: 'forEach',
          forEachConfig: { collectionVariable: 'items', itemVariable: 'it', bodyNodeIds: ['body'] },
        }, inputs: [], outputs: [], position: { x: 100, y: 0 } },
        { id: 'sw-1', type: 'backend' as const, kind: 'control', label: 'SW', config: {
          blockType: 'subWorkflow',
          subWorkflowConfig: { workflowId: 'wf-child', inputMappings: { a: 'b' } },
        }, inputs: [], outputs: [], position: { x: 200, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [{ name: 'items', type: 'array', required: false, defaultValue: [1, 2] }],
    };

    const serialized = JSON.stringify(workflow);
    const deserialized = JSON.parse(serialized) as WorkflowDefinition;

    expect(deserialized.nodes[0].config.conditionConfig?.expression).toBe('x > 0');
    expect(deserialized.nodes[1].config.forEachConfig?.bodyNodeIds).toEqual(['body']);
    expect(deserialized.nodes[2].config.subWorkflowConfig?.inputMappings).toEqual({ a: 'b' });
    expect(deserialized.nodes[0].kind).toBe('control');
  });

  it('validation blocks bad config', () => {
    const wf: WorkflowDefinition = {
      id: 'wf-bad',
      metadata: { name: 'Bad', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'sw-1', type: 'backend' as const, kind: 'control', label: 'SW', config: {
          blockType: 'subWorkflow',
          subWorkflowConfig: { workflowId: '' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const result = validateWorkflow(wf);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
