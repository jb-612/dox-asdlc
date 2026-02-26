import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { ContainerRecord } from '../../../src/shared/types/execution';

// ---------------------------------------------------------------------------
// Mock preload bridge (window.electronAPI)
// ---------------------------------------------------------------------------

type EventCallback = (...args: unknown[]) => void;

const listeners = new Map<string, EventCallback>();

const mockOnEvent = vi.fn((channel: string, callback: EventCallback) => {
  listeners.set(channel, callback);
});

const mockRemoveListener = vi.fn((channel: string) => {
  listeners.delete(channel);
});

// Add electronAPI to the jsdom window (do not replace the window entirely)
(window as unknown as Record<string, unknown>).electronAPI = {
  onEvent: mockOnEvent,
  removeListener: mockRemoveListener,
};

// Import after mocking window.electronAPI
import { usePoolStatus } from '../../../src/renderer/hooks/usePoolStatus';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<ContainerRecord> = {}): ContainerRecord {
  return {
    id: 'container-1',
    state: 'idle',
    blockId: null,
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

describe('T16: usePoolStatus', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    listeners.clear();
  });

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  it('initializes with an empty containers array', () => {
    const { result } = renderHook(() => usePoolStatus());

    expect(result.current).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Subscribe to IPC
  // -------------------------------------------------------------------------

  it('subscribes to container:pool-status IPC channel on mount', () => {
    renderHook(() => usePoolStatus());

    expect(mockOnEvent).toHaveBeenCalledWith(
      'container:pool-status',
      expect.any(Function),
    );
  });

  // -------------------------------------------------------------------------
  // Updates on IPC event
  // -------------------------------------------------------------------------

  it('updates containers when IPC event fires', () => {
    const { result } = renderHook(() => usePoolStatus());

    const records: ContainerRecord[] = [
      makeRecord({ id: 'c-1', state: 'idle' }),
      makeRecord({ id: 'c-2', state: 'running', blockId: 'block-1' }),
    ];

    act(() => {
      const callback = listeners.get('container:pool-status');
      callback?.(records);
    });

    expect(result.current).toHaveLength(2);
    expect(result.current[0].id).toBe('c-1');
    expect(result.current[1].id).toBe('c-2');
    expect(result.current[1].state).toBe('running');
  });

  it('replaces previous state entirely on each IPC event', () => {
    const { result } = renderHook(() => usePoolStatus());

    // First update
    act(() => {
      const callback = listeners.get('container:pool-status');
      callback?.([makeRecord({ id: 'c-1' })]);
    });
    expect(result.current).toHaveLength(1);

    // Second update with different data
    act(() => {
      const callback = listeners.get('container:pool-status');
      callback?.([
        makeRecord({ id: 'c-2' }),
        makeRecord({ id: 'c-3' }),
        makeRecord({ id: 'c-4' }),
      ]);
    });
    expect(result.current).toHaveLength(3);
    expect(result.current[0].id).toBe('c-2');
  });

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => usePoolStatus());

    unmount();

    expect(mockRemoveListener).toHaveBeenCalledWith('container:pool-status');
  });

  // -------------------------------------------------------------------------
  // Empty IPC payload
  // -------------------------------------------------------------------------

  it('handles empty array from IPC', () => {
    const { result } = renderHook(() => usePoolStatus());

    act(() => {
      const callback = listeners.get('container:pool-status');
      callback?.([]);
    });

    expect(result.current).toEqual([]);
  });
});
