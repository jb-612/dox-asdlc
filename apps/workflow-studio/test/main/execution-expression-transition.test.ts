// @vitest-environment node
// ---------------------------------------------------------------------------
// F15-T07: shouldExecuteNode expression transition support
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `expr-uuid-${++uuidCounter}`,
}));

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

describe('F15-T07: expression transitions', { timeout: 30000 }, () => {
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

  it('true expression allows target node to execute', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-expr',
      metadata: { name: 'Expr Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'n1', type: 'backend' as const, label: 'Source', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'n2', type: 'backend' as const, label: 'Target', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'n1', targetNodeId: 'n2', condition: { type: 'expression' as const, expression: 'status == "success"' } },
      ],
      gates: [],
      variables: [{ name: 'status', type: 'string', required: true, defaultValue: 'success' }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    expect(result.nodeStates['n1'].status).toBe('completed');
    expect(result.nodeStates['n2'].status).toBe('completed');
  });

  it('false expression skips target node', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-expr',
      metadata: { name: 'Expr Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'n1', type: 'backend' as const, label: 'Source', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'n2', type: 'backend' as const, label: 'Target', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'n1', targetNodeId: 'n2', condition: { type: 'expression' as const, expression: 'status == "success"' } },
      ],
      gates: [],
      variables: [{ name: 'status', type: 'string', required: true, defaultValue: 'failed' }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    expect(result.nodeStates['n1'].status).toBe('completed');
    expect(result.nodeStates['n2'].status).toBe('skipped');
  });

  it('invalid expression skips target safely', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-expr',
      metadata: { name: 'Expr Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'n1', type: 'backend' as const, label: 'Source', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'n2', type: 'backend' as const, label: 'Target', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
      ],
      transitions: [
        { id: 't1', sourceNodeId: 'n1', targetNodeId: 'n2', condition: { type: 'expression' as const, expression: 'a +++ b' } },
      ],
      gates: [],
      variables: [],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    expect(result.nodeStates['n1'].status).toBe('completed');
    // Invalid expression should skip safely, not crash
    expect(result.nodeStates['n2'].status).toBe('skipped');
  });
});
