// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWithRetry } from '../../src/main/services/retry-utils';
import type { RetryPolicy, RetryCallbacks } from '../../src/main/services/retry-utils';

describe('F14-T03: executeWithRetry', () => {
  let emittedEvents: Array<{ type: string; data?: unknown }>;
  let callbacks: RetryCallbacks;

  beforeEach(() => {
    emittedEvents = [];
    callbacks = {
      emitEvent: (type, data) => { emittedEvents.push({ type, data }); },
      isAborted: () => false,
      sleep: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('calls attemptFn once when maxRetries=0', async () => {
    const attemptFn = vi.fn().mockResolvedValue({ exitCode: 0 });
    const policy: RetryPolicy = { maxRetries: 0, retryableExitCodes: [], backoffBaseMs: 1000, nodeId: 'n1' };

    await executeWithRetry(attemptFn, policy, callbacks);

    expect(attemptFn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on exit 0 (success)', async () => {
    const attemptFn = vi.fn().mockResolvedValue({ exitCode: 0 });
    const policy: RetryPolicy = { maxRetries: 3, retryableExitCodes: [], backoffBaseMs: 1000, nodeId: 'n1' };

    const result = await executeWithRetry(attemptFn, policy, callbacks);

    expect(attemptFn).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBe(0);
  });

  it('retries on timeout (exit -1) up to maxRetries', async () => {
    const attemptFn = vi.fn()
      .mockResolvedValueOnce({ exitCode: -1 })
      .mockResolvedValueOnce({ exitCode: -1 })
      .mockResolvedValueOnce({ exitCode: 0 });
    const policy: RetryPolicy = { maxRetries: 3, retryableExitCodes: [], backoffBaseMs: 1000, nodeId: 'n1' };

    const result = await executeWithRetry(attemptFn, policy, callbacks);

    expect(attemptFn).toHaveBeenCalledTimes(3);
    expect(result.exitCode).toBe(0);
  });

  it('retries on specific retryableExitCodes', async () => {
    const attemptFn = vi.fn()
      .mockResolvedValueOnce({ exitCode: 137 })
      .mockResolvedValueOnce({ exitCode: 0 });
    const policy: RetryPolicy = { maxRetries: 2, retryableExitCodes: [137, 143], backoffBaseMs: 1000, nodeId: 'n1' };

    const result = await executeWithRetry(attemptFn, policy, callbacks);

    expect(attemptFn).toHaveBeenCalledTimes(2);
    expect(result.exitCode).toBe(0);
  });

  it('does NOT retry on non-retryable exit codes', async () => {
    const attemptFn = vi.fn().mockResolvedValue({ exitCode: 1 });
    const policy: RetryPolicy = { maxRetries: 3, retryableExitCodes: [137], backoffBaseMs: 1000, nodeId: 'n1' };

    const result = await executeWithRetry(attemptFn, policy, callbacks);

    expect(attemptFn).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBe(1);
  });

  it('emits node_retry event on each retry', async () => {
    const attemptFn = vi.fn()
      .mockResolvedValueOnce({ exitCode: -1 })
      .mockResolvedValueOnce({ exitCode: 0 });
    const policy: RetryPolicy = { maxRetries: 2, retryableExitCodes: [], backoffBaseMs: 1000, nodeId: 'n1' };

    await executeWithRetry(attemptFn, policy, callbacks);

    const retryEvents = emittedEvents.filter(e => e.type === 'node_retry');
    expect(retryEvents).toHaveLength(1);
    expect(retryEvents[0].data).toEqual({ attempt: 1, maxRetries: 2, nodeId: 'n1' });
  });

  it('emits node_retry_exhausted when max reached', async () => {
    const attemptFn = vi.fn().mockResolvedValue({ exitCode: -1 });
    const policy: RetryPolicy = { maxRetries: 2, retryableExitCodes: [], backoffBaseMs: 1000, nodeId: 'n1' };

    const result = await executeWithRetry(attemptFn, policy, callbacks);

    expect(attemptFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(result.exitCode).toBe(-1);
    const exhaustedEvents = emittedEvents.filter(e => e.type === 'node_retry_exhausted');
    expect(exhaustedEvents).toHaveLength(1);
  });

  it('checks isAborted before each attempt', async () => {
    let callCount = 0;
    callbacks.isAborted = () => {
      callCount++;
      return callCount > 1; // abort after first attempt
    };
    const attemptFn = vi.fn()
      .mockResolvedValueOnce({ exitCode: -1 })
      .mockResolvedValueOnce({ exitCode: 0 });
    const policy: RetryPolicy = { maxRetries: 3, retryableExitCodes: [], backoffBaseMs: 1000, nodeId: 'n1' };

    const result = await executeWithRetry(attemptFn, policy, callbacks);

    // Should have run first attempt (isAborted=false), then checked before retry (isAborted=true)
    expect(attemptFn).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBe(-1);
  });

  it('aborts mid-backoff sleep when isAborted becomes true', async () => {
    let aborted = false;
    callbacks.isAborted = () => aborted;
    callbacks.sleep = vi.fn().mockImplementation(async () => {
      aborted = true; // simulate abort during sleep
    });
    const attemptFn = vi.fn()
      .mockResolvedValueOnce({ exitCode: -1 })
      .mockResolvedValueOnce({ exitCode: 0 });
    const policy: RetryPolicy = { maxRetries: 3, retryableExitCodes: [], backoffBaseMs: 1000, nodeId: 'n1' };

    const result = await executeWithRetry(attemptFn, policy, callbacks);

    // First attempt returns -1, sleep called, abort set during sleep
    // isAborted checked after sleep, should not retry
    expect(attemptFn).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBe(-1);
  });
});
