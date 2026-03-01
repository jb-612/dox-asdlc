// @vitest-environment node
// ---------------------------------------------------------------------------
// F15-T04: Condition node execution
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `cond-uuid-${++uuidCounter}`,
}));

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

describe('F15-T04: executeConditionNode', { timeout: 30000 }, () => {
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

  it('true expression follows trueBranch node', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-cond',
      metadata: { name: 'Cond Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'cond-1', type: 'backend' as const, kind: 'control', label: 'Cond', config: {
          blockType: 'condition',
          conditionConfig: { expression: 'status == "success"', trueBranchNodeId: 'node-a', falseBranchNodeId: 'node-b' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'node-a', type: 'backend' as const, label: 'True Branch', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
        { id: 'node-b', type: 'backend' as const, label: 'False Branch', config: {}, inputs: [], outputs: [], position: { x: 100, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'cond-1', targetNodeId: 'node-a', condition: { type: 'always' as const } },
        { id: 't2', sourceNodeId: 'cond-1', targetNodeId: 'node-b', condition: { type: 'always' as const } },
      ],
      gates: [],
      variables: [{ name: 'status', type: 'string', required: true, defaultValue: 'success' }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    // Condition node completed
    expect(result.nodeStates['cond-1'].status).toBe('completed');
    // True branch ran
    expect(result.nodeStates['node-a'].status).toBe('completed');
    // False branch skipped
    expect(result.nodeStates['node-b'].status).toBe('skipped');
  });

  it('false expression follows falseBranch node', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-cond',
      metadata: { name: 'Cond Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'cond-1', type: 'backend' as const, kind: 'control', label: 'Cond', config: {
          blockType: 'condition',
          conditionConfig: { expression: 'status == "success"', trueBranchNodeId: 'node-a', falseBranchNodeId: 'node-b' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'node-a', type: 'backend' as const, label: 'True Branch', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
        { id: 'node-b', type: 'backend' as const, label: 'False Branch', config: {}, inputs: [], outputs: [], position: { x: 100, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'cond-1', targetNodeId: 'node-a', condition: { type: 'always' as const } },
        { id: 't2', sourceNodeId: 'cond-1', targetNodeId: 'node-b', condition: { type: 'always' as const } },
      ],
      gates: [],
      variables: [{ name: 'status', type: 'string', required: true, defaultValue: 'failed' }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    expect(result.nodeStates['cond-1'].status).toBe('completed');
    expect(result.nodeStates['node-a'].status).toBe('skipped');
    expect(result.nodeStates['node-b'].status).toBe('completed');
  });

  it('missing conditionConfig fails the node', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-cond',
      metadata: { name: 'Cond Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'cond-1', type: 'backend' as const, kind: 'control', label: 'Cond', config: {
          blockType: 'condition',
          // no conditionConfig
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    expect(result.nodeStates['cond-1'].status).toBe('failed');
  });

  it('stores condition result in variables.__condition_<id>', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-cond',
      metadata: { name: 'Cond Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'cond-1', type: 'backend' as const, kind: 'control', label: 'Cond', config: {
          blockType: 'condition',
          conditionConfig: { expression: 'x > 0', trueBranchNodeId: 'node-a', falseBranchNodeId: 'node-b' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'node-a', type: 'backend' as const, label: 'True', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
        { id: 'node-b', type: 'backend' as const, label: 'False', config: {}, inputs: [], outputs: [], position: { x: 100, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'cond-1', targetNodeId: 'node-a', condition: { type: 'always' as const } },
        { id: 't2', sourceNodeId: 'cond-1', targetNodeId: 'node-b', condition: { type: 'always' as const } },
      ],
      gates: [],
      variables: [{ name: 'x', type: 'number', required: true, defaultValue: 5 }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    expect(result.variables['__condition_cond-1']).toBe(true);
  });
});
