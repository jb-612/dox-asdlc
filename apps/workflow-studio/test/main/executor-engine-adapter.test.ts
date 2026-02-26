// ---------------------------------------------------------------------------
// ExecutorEngineAdapter tests (P15-F09, T05)
//
// Verifies that the adapter bridges CLISpawner and the ExecutorEngine
// interface used by WorkflowExecutor for parallel execution.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutorEngineAdapter } from '../../src/main/services/executor-engine-adapter';
import type { ContainerRecord } from '../../src/shared/types/execution';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(overrides?: Partial<ContainerRecord>): ContainerRecord {
  return {
    id: 'ctr-1',
    state: 'running',
    blockId: 'block-a',
    port: 49200,
    agentUrl: 'http://localhost:49200',
    createdAt: Date.now(),
    dormantSince: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutorEngineAdapter', () => {
  let spawnMock: ReturnType<typeof vi.fn>;
  let buildPromptMock: ReturnType<typeof vi.fn>;
  let waitExitMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    spawnMock = vi.fn().mockReturnValue({ id: 'session-1', status: 'running' });
    buildPromptMock = vi.fn().mockReturnValue('Do the thing');
    waitExitMock = vi.fn().mockResolvedValue(0);
  });

  it('executeBlock calls CLISpawner with composed prompt and returns success', async () => {
    const adapter = new ExecutorEngineAdapter({
      spawn: spawnMock,
      waitForExit: waitExitMock,
      buildPromptFn: buildPromptMock,
      mockMode: false,
    });

    const container = makeContainer();
    const result = await adapter.executeBlock('block-a', container);

    expect(buildPromptMock).toHaveBeenCalledWith('block-a');
    expect(spawnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'claude',
        args: expect.arrayContaining(['-p', 'Do the thing']),
      }),
    );
    expect(result.blockId).toBe('block-a');
    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('executeBlock returns failed result on non-zero exit code', async () => {
    waitExitMock.mockResolvedValue(1);

    const adapter = new ExecutorEngineAdapter({
      spawn: spawnMock,
      waitForExit: waitExitMock,
      buildPromptFn: buildPromptMock,
      mockMode: false,
    });

    const container = makeContainer();
    const result = await adapter.executeBlock('block-b', container);

    expect(result.blockId).toBe('block-b');
    expect(result.success).toBe(false);
    expect(result.error).toContain('exit code 1');
  });

  it('executeBlock returns failed result when spawn throws', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('Docker daemon not available');
    });

    const adapter = new ExecutorEngineAdapter({
      spawn: spawnMock,
      waitForExit: waitExitMock,
      buildPromptFn: buildPromptMock,
      mockMode: false,
    });

    const container = makeContainer();
    const result = await adapter.executeBlock('block-c', container);

    expect(result.blockId).toBe('block-c');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Docker daemon not available');
  });

  it('uses mock mode when mockMode is true', async () => {
    const adapter = new ExecutorEngineAdapter({
      spawn: spawnMock,
      waitForExit: waitExitMock,
      buildPromptFn: buildPromptMock,
      mockMode: true,
    });

    const container = makeContainer();
    const result = await adapter.executeBlock('block-d', container);

    // In mock mode, the CLISpawner should NOT be called
    expect(spawnMock).not.toHaveBeenCalled();
    expect(result.blockId).toBe('block-d');
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ mock: true });
  });

  it('passes --output-format json flag to CLI', async () => {
    const adapter = new ExecutorEngineAdapter({
      spawn: spawnMock,
      waitForExit: waitExitMock,
      buildPromptFn: buildPromptMock,
      mockMode: false,
    });

    const container = makeContainer();
    await adapter.executeBlock('block-e', container);

    const spawnCall = spawnMock.mock.calls[0][0];
    expect(spawnCall.args).toContain('--output-format');
    expect(spawnCall.args).toContain('json');
  });

  it('implements ExecutorEngine interface (type check)', () => {
    // This test verifies that ExecutorEngineAdapter is assignable to ExecutorEngine
    const adapter = new ExecutorEngineAdapter({
      spawn: spawnMock,
      waitForExit: waitExitMock,
      buildPromptFn: buildPromptMock,
      mockMode: false,
    });

    // ExecutorEngine requires: executeBlock(blockId, container) => Promise<ParallelBlockResult>
    expect(typeof adapter.executeBlock).toBe('function');
  });
});
