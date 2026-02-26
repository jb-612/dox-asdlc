import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).slice(2, 8),
}));

vi.mock('fs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('fs')>();
  return {
    ...orig,
    readFileSync: vi.fn(),
    existsSync: vi.fn(() => false),
  };
});

import { ExecutionEngine } from '../../src/main/services/execution-engine';

function makeMockWindow(): any {
  return {
    webContents: {
      send: vi.fn(),
    },
  };
}

describe('ExecutionEngine codex backend guard', () => {
  it('fails node with "not yet supported" when backend is codex', async () => {
    const win = makeMockWindow();
    const engine = new ExecutionEngine(win, { mockMode: false });

    const workflow: any = {
      id: 'wf-1',
      metadata: { name: 'Test', version: '1.0.0', createdAt: '', updatedAt: '', tags: [] },
      nodes: [{
        id: 'n1',
        type: 'dev',
        label: 'Codex Dev',
        position: { x: 0, y: 0 },
        config: { backend: 'codex', model: 'codex-1', systemPrompt: 'test' },
      }],
      transitions: [],
      gates: [],
      variables: [],
    };

    const result = await engine.start(workflow);

    expect(result.nodeStates['n1'].status).toBe('failed');
    expect(result.nodeStates['n1'].error).toContain('not yet supported');
    // Execution itself should be marked as failed
    expect(result.status).toBe('failed');
  });

  it('marks execution as failed when codex node fails', async () => {
    const win = makeMockWindow();
    const engine = new ExecutionEngine(win, { mockMode: true });

    const workflow: any = {
      id: 'wf-2',
      metadata: { name: 'Test', version: '1.0.0', createdAt: '', updatedAt: '', tags: [] },
      nodes: [
        {
          id: 'n1',
          type: 'plan',
          label: 'Plan',
          position: { x: 0, y: 0 },
          config: { backend: 'claude', model: 'sonnet', systemPrompt: 'plan' },
        },
        {
          id: 'n2',
          type: 'dev',
          label: 'Codex Dev',
          position: { x: 100, y: 0 },
          config: { backend: 'codex', model: 'codex-1', systemPrompt: 'dev' },
        },
      ],
      transitions: [{ id: 't1', sourceNodeId: 'n1', targetNodeId: 'n2' }],
      gates: [],
      variables: [],
    };

    const result = await engine.start(workflow);

    // First node should complete (mock mode)
    expect(result.nodeStates['n1'].status).toBe('completed');
    // Second node (codex) should fail
    expect(result.nodeStates['n2'].status).toBe('failed');
    expect(result.nodeStates['n2'].error).toContain('not yet supported');
    // Overall execution should be failed
    expect(result.status).toBe('failed');
  });
});
