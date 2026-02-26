import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron modules before importing
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid',
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

function makeSimpleWorkflow(): any {
  return {
    id: 'wf-1',
    metadata: { name: 'Test', version: '1.0.0', createdAt: '', updatedAt: '', tags: [] },
    nodes: [
      {
        id: 'n1',
        type: 'plan',
        label: 'Plan',
        position: { x: 0, y: 0 },
        config: { backend: 'claude', model: 'sonnet', systemPrompt: 'test' },
      },
    ],
    transitions: [],
    gates: [],
    variables: [],
  };
}

describe('ExecutionEngine mock mode default', () => {
  it('defaults to real execution (mockMode: false) when no option is provided', () => {
    const engine = new ExecutionEngine(makeMockWindow(), {});
    // Access private field via type assertion
    expect((engine as any).mockMode).toBe(false);
  });

  it('defaults to real execution when options is undefined', () => {
    const engine = new ExecutionEngine(makeMockWindow());
    expect((engine as any).mockMode).toBe(false);
  });

  it('respects explicit mockMode: true', () => {
    const engine = new ExecutionEngine(makeMockWindow(), { mockMode: true });
    expect((engine as any).mockMode).toBe(true);
  });

  it('respects explicit mockMode: false', () => {
    const engine = new ExecutionEngine(makeMockWindow(), { mockMode: false });
    expect((engine as any).mockMode).toBe(false);
  });
});
