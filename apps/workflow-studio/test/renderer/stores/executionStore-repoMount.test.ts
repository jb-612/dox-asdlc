import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock window.electronAPI
// ---------------------------------------------------------------------------

const mockStart = vi.fn().mockResolvedValue({ success: true, executionId: 'exec-1' });

vi.stubGlobal('window', {
  electronAPI: {
    execution: {
      start: mockStart,
      pause: vi.fn().mockResolvedValue({ success: true }),
      resume: vi.fn().mockResolvedValue({ success: true }),
      abort: vi.fn().mockResolvedValue({ success: true }),
      gateDecision: vi.fn().mockResolvedValue({ success: true }),
      revise: vi.fn().mockResolvedValue({ success: true }),
    },
    onEvent: vi.fn(),
    removeListener: vi.fn(),
  },
});

import { useExecutionStore } from '../../../src/renderer/stores/executionStore';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executionStore repoMount passthrough', () => {
  beforeEach(() => {
    mockStart.mockClear();
    useExecutionStore.getState().clearExecution();
  });

  const mockWorkflow: any = {
    id: 'wf-1',
    metadata: { name: 'Test', version: '1.0.0', createdAt: '', updatedAt: '', tags: [] },
    nodes: [],
    transitions: [],
    gates: [],
    variables: [],
  };

  it('includes repoMount in IPC payload when provided', async () => {
    const repoMount = {
      source: 'local' as const,
      localPath: '/tmp/my-repo',
      fileRestrictions: ['src/**'],
      readOnly: false,
    };

    await useExecutionStore.getState().startExecution(
      mockWorkflow,
      undefined,
      {},
      false,
      repoMount,
    );

    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf-1',
        repoMount: {
          source: 'local',
          localPath: '/tmp/my-repo',
          fileRestrictions: ['src/**'],
          readOnly: false,
        },
      }),
    );
  });

  it('omits repoMount from payload when not provided', async () => {
    await useExecutionStore.getState().startExecution(
      mockWorkflow,
      undefined,
      {},
      false,
    );

    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf-1',
      }),
    );
    // repoMount should be undefined (not present or undefined)
    const payload = mockStart.mock.calls[0][0];
    expect(payload.repoMount).toBeUndefined();
  });
});
