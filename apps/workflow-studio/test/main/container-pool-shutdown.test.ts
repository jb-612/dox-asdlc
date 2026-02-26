// @vitest-environment node
// ---------------------------------------------------------------------------
// T23: Container pool shutdown hook wiring tests
//
// Verifies that registerShutdownHooks correctly wires pool.teardown() to
// process signals and app lifecycle events.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  registerShutdownHooks,
  type ShutdownTarget,
} from '../../src/main/services/container-pool-shutdown';

describe('T23: container pool shutdown hooks', () => {
  const mockTeardown = vi.fn().mockResolvedValue(undefined);

  let processListeners: Map<string, Array<(...args: unknown[]) => void>>;
  let targetListeners: Map<string, Array<(...args: unknown[]) => void>>;

  let mockTarget: ShutdownTarget;

  beforeEach(() => {
    vi.clearAllMocks();

    processListeners = new Map();
    targetListeners = new Map();

    // Capture process.on calls
    vi.spyOn(process, 'on').mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (!processListeners.has(event)) {
        processListeners.set(event, []);
      }
      processListeners.get(event)!.push(handler);
      return process;
    });

    mockTarget = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!targetListeners.has(event)) {
          targetListeners.set(event, []);
        }
        targetListeners.get(event)!.push(handler);
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers before-quit handler on the target', () => {
    registerShutdownHooks(mockTeardown, mockTarget);

    expect(mockTarget.on).toHaveBeenCalledWith('before-quit', expect.any(Function));
  });

  it('registers SIGTERM and SIGINT handlers on process', () => {
    registerShutdownHooks(mockTeardown, mockTarget);

    expect(processListeners.has('SIGTERM')).toBe(true);
    expect(processListeners.has('SIGINT')).toBe(true);
  });

  it('before-quit triggers teardown', async () => {
    registerShutdownHooks(mockTeardown, mockTarget);

    const handlers = targetListeners.get('before-quit') ?? [];
    expect(handlers.length).toBeGreaterThan(0);

    await handlers[0]();
    expect(mockTeardown).toHaveBeenCalled();
  });

  it('SIGTERM triggers teardown', async () => {
    registerShutdownHooks(mockTeardown, mockTarget);

    const handlers = processListeners.get('SIGTERM') ?? [];
    expect(handlers.length).toBeGreaterThan(0);

    await handlers[0]();
    expect(mockTeardown).toHaveBeenCalled();
  });

  it('SIGINT triggers teardown', async () => {
    registerShutdownHooks(mockTeardown, mockTarget);

    const handlers = processListeners.get('SIGINT') ?? [];
    expect(handlers.length).toBeGreaterThan(0);

    await handlers[0]();
    expect(mockTeardown).toHaveBeenCalled();
  });

  it('does not call teardown if already torn down', async () => {
    registerShutdownHooks(mockTeardown, mockTarget);

    const beforeQuitHandlers = targetListeners.get('before-quit') ?? [];
    const sigTermHandlers = processListeners.get('SIGTERM') ?? [];

    // First call
    await beforeQuitHandlers[0]();
    expect(mockTeardown).toHaveBeenCalledTimes(1);

    // Second call should be a no-op (idempotent)
    await sigTermHandlers[0]();
    expect(mockTeardown).toHaveBeenCalledTimes(1);
  });

  it('does not throw if teardown rejects', async () => {
    const failingTeardown = vi.fn().mockRejectedValue(new Error('teardown failed'));
    registerShutdownHooks(failingTeardown, mockTarget);

    const handlers = targetListeners.get('before-quit') ?? [];
    await expect(handlers[0]()).resolves.not.toThrow();
  });
});
