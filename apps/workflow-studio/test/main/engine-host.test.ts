// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T03: ExecutionEngine accepts EngineHost
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `uuid-${++uuidCounter}`,
}));

const simpleWorkflow: WorkflowDefinition = {
  id: 'wf-host',
  metadata: { name: 'Host Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
  nodes: [
    { id: 'n1', type: 'backend' as const, label: 'Step 1', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
  ],
  transitions: [],
  gates: [],
  variables: [],
};

describe('F17-T03: EngineHost in ExecutionEngine', { timeout: 30000 }, () => {
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

  it('accepts EngineHost instead of BrowserWindow', async () => {
    const sent: { channel: string; args: unknown[] }[] = [];
    const host = {
      send(channel: string, ...args: unknown[]) {
        sent.push({ channel, args });
      },
    };

    const engine = new ExecutionEngine(host, { mockMode: true });
    const result = await engine.start(simpleWorkflow);

    expect(result.status).toBe('completed');
    // Host should have received events via send()
    expect(sent.length).toBeGreaterThan(0);
    const channels = sent.map((s) => s.channel);
    expect(channels).toContain('execution:state-update');
  });

  it('NullWindow works as EngineHost', async () => {
    const { NullWindow } = await import('../../src/cli/null-window');
    const { Writable } = await import('stream');

    const chunks: string[] = [];
    const stdout = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk.toString()); cb(); },
    });

    const nw = new NullWindow({ json: true, stdout });
    const engine = new ExecutionEngine(nw, { mockMode: true });
    const result = await engine.start(simpleWorkflow);

    expect(result.status).toBe('completed');
    expect(chunks.length).toBeGreaterThan(0);
    // First line should be valid NDJSON
    const first = JSON.parse(chunks[0]);
    expect(first.channel).toBeDefined();
  });

  it('BrowserWindow wrapper satisfies EngineHost', () => {
    const mockBW = {
      webContents: { send: vi.fn() },
    };

    // BrowserWindow can be used directly if it has webContents.send
    const engine = new ExecutionEngine(mockBW as never, { mockMode: true });
    expect(engine).toBeDefined();
  });
});
