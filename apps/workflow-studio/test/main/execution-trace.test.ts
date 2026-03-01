// @vitest-environment node
// ---------------------------------------------------------------------------
// F16-T03a: Trace context on Execution + emitEvent
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `trace-uuid-${++uuidCounter}`,
}));

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

describe('F16-T03a: Trace context', { timeout: 30000 }, () => {
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

  it('Execution has traceId set on start', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-trace',
      metadata: { name: 'Trace Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'n1', type: 'backend' as const, label: 'Step 1', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    expect(result.traceId).toBeDefined();
    expect(typeof result.traceId).toBe('string');
    expect(result.traceId!.length).toBeGreaterThan(0);
  });

  it('execution_started event carries traceId', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-trace',
      metadata: { name: 'Trace Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'n1', type: 'backend' as const, label: 'Step 1', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    const startEvent = result.events.find(e => e.type === 'execution_started');
    expect(startEvent?.traceId).toBe(result.traceId);
  });

  it('node_started events carry spanId', async () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-trace',
      metadata: { name: 'Trace Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        { id: 'n1', type: 'backend' as const, label: 'Step 1', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      ],
      transitions: [],
      gates: [],
      variables: [],
    };

    const engine = new ExecutionEngine(createMockMainWindow(), { mockMode: true });
    const result = await engine.start(workflow);

    const nodeStarted = result.events.find(e => e.type === 'node_started');
    expect(nodeStarted?.spanId).toBeDefined();
    expect(nodeStarted?.traceId).toBe(result.traceId);
  });
});
