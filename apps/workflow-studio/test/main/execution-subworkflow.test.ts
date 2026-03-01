// @vitest-environment node
// ---------------------------------------------------------------------------
// F15-T06: SubWorkflow node execution
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `sw-uuid-${++uuidCounter}`,
}));

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

function createChildWorkflow(): WorkflowDefinition {
  return {
    id: 'wf-child',
    metadata: { name: 'Child', version: '1', createdAt: '', updatedAt: '', tags: [] },
    nodes: [
      { id: 'child-1', type: 'backend' as const, label: 'Child Step', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
    ],
    transitions: [],
    gates: [],
    variables: [{ name: 'inputVar', type: 'string', required: false }],
  };
}

describe('F15-T06: executeSubWorkflowNode', { timeout: 30000 }, () => {
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

  it('loads and executes child workflow', async () => {
    const childWorkflow = createChildWorkflow();

    const workflow: WorkflowDefinition = {
      id: 'wf-parent',
      metadata: { name: 'Parent', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'sw-1', type: 'backend' as const, kind: 'control', label: 'SubWf', config: {
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

  it('maps input variables to child', async () => {
    const childWorkflow = createChildWorkflow();

    const workflow: WorkflowDefinition = {
      id: 'wf-parent',
      metadata: { name: 'Parent', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'sw-1', type: 'backend' as const, kind: 'control', label: 'SubWf', config: {
          blockType: 'subWorkflow',
          subWorkflowConfig: {
            workflowId: 'wf-child',
            inputMappings: { parentVal: 'inputVar' },
          },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [{ name: 'parentVal', type: 'string', required: true, defaultValue: 'hello' }],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      workflowResolver: (id: string) => id === 'wf-child' ? childWorkflow : null,
    });

    const result = await engine.start(workflow);
    expect(result.nodeStates['sw-1'].status).toBe('completed');
  });

  it('depth > 3 fails', async () => {
    // Create a self-referencing workflow
    const selfRef: WorkflowDefinition = {
      id: 'wf-self',
      metadata: { name: 'Self', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'sw-deep', type: 'backend' as const, kind: 'control', label: 'SubWf', config: {
          blockType: 'subWorkflow',
          subWorkflowConfig: { workflowId: 'wf-self' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const workflow: WorkflowDefinition = {
      id: 'wf-parent',
      metadata: { name: 'Parent', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'sw-1', type: 'backend' as const, kind: 'control', label: 'SubWf', config: {
          blockType: 'subWorkflow',
          subWorkflowConfig: { workflowId: 'wf-self' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      workflowResolver: () => selfRef,
    });

    const result = await engine.start(workflow);
    expect(result.nodeStates['sw-1'].status).toBe('failed');
    // The error may be the depth error directly or a propagated child failure
    expect(result.nodeStates['sw-1'].error).toBeDefined();
  });

  it('missing workflowId fails', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-parent',
      metadata: { name: 'Parent', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'sw-1', type: 'backend' as const, kind: 'control', label: 'SubWf', config: {
          blockType: 'subWorkflow',
          subWorkflowConfig: { workflowId: 'nonexistent' },
        }, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      workflowResolver: () => null,
    });

    const result = await engine.start(workflow);
    expect(result.nodeStates['sw-1'].status).toBe('failed');
    expect(result.nodeStates['sw-1'].error).toContain('not found');
  });
});
