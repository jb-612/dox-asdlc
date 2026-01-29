/**
 * Tests for useAutoSave hook (P05-F11 T20)
 *
 * Features:
 * - Auto-save every 2 minutes when session is active
 * - Debounce rapid changes (500ms)
 * - Skip save if no changes since last save
 * - Show toast notification on save
 * - Handle save errors gracefully
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';

// Mock save function
const mockSaveFunc = vi.fn();

// Mock toast
const mockShowToast = vi.fn();
vi.mock('../utils/toast', () => ({
  showToast: (message: string, type: string) => mockShowToast(message, type),
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSaveFunc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('does not save when disabled', async () => {
      renderHook(() =>
        useAutoSave({
          enabled: false,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
        })
      );

      // Wait for interval
      await act(async () => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(mockSaveFunc).not.toHaveBeenCalled();
    });

    it('saves when enabled and data changes', async () => {
      const { rerender } = renderHook(
        ({ data }) =>
          useAutoSave({
            enabled: true,
            data,
            saveFunc: mockSaveFunc,
          }),
        {
          initialProps: { data: { test: 'initial' } },
        }
      );

      // Change data
      rerender({ data: { test: 'changed' } });

      // Wait for debounce
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Wait for interval
      await act(async () => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(mockSaveFunc).toHaveBeenCalled();
    });

    it('does not save if data has not changed', async () => {
      renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
        })
      );

      // First interval - should save
      await act(async () => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(mockSaveFunc).toHaveBeenCalledTimes(1);

      // Second interval - no data change, should not save again
      await act(async () => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(mockSaveFunc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Debouncing', () => {
    it('debounces rapid data changes', async () => {
      const { rerender } = renderHook(
        ({ data }) =>
          useAutoSave({
            enabled: true,
            data,
            saveFunc: mockSaveFunc,
            debounceMs: 500,
          }),
        {
          initialProps: { data: { test: 1 } },
        }
      );

      // Rapid changes
      rerender({ data: { test: 2 } });
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      rerender({ data: { test: 3 } });
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      rerender({ data: { test: 4 } });
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Still debouncing, no save yet
      expect(mockSaveFunc).not.toHaveBeenCalled();

      // Wait for debounce to complete plus interval
      await act(async () => {
        vi.advanceTimersByTime(500 + 2 * 60 * 1000);
      });

      // Should save the final state only once (at interval)
      expect(mockSaveFunc).toHaveBeenCalledTimes(1);
    });

    it('uses custom debounce time', async () => {
      const { rerender } = renderHook(
        ({ data }) =>
          useAutoSave({
            enabled: true,
            data,
            saveFunc: mockSaveFunc,
            debounceMs: 1000,
          }),
        {
          initialProps: { data: { test: 'initial' } },
        }
      );

      rerender({ data: { test: 'changed' } });

      // 500ms - should not have debounced yet
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Should still be in debounce period
      expect(mockSaveFunc).not.toHaveBeenCalled();

      // Complete debounce plus interval
      await act(async () => {
        vi.advanceTimersByTime(500 + 2 * 60 * 1000);
      });

      expect(mockSaveFunc).toHaveBeenCalled();
    });
  });

  describe('Interval', () => {
    it('saves at regular intervals', async () => {
      const { rerender } = renderHook(
        ({ data }) =>
          useAutoSave({
            enabled: true,
            data,
            saveFunc: mockSaveFunc,
            intervalMs: 60 * 1000, // 1 minute
          }),
        {
          initialProps: { data: { test: 1 } },
        }
      );

      // First interval
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      expect(mockSaveFunc).toHaveBeenCalledTimes(1);

      // Change data
      rerender({ data: { test: 2 } });
      await act(async () => {
        vi.advanceTimersByTime(500); // debounce
      });

      // Second interval
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      expect(mockSaveFunc).toHaveBeenCalledTimes(2);
    });

    it('uses custom interval time', async () => {
      renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
          intervalMs: 30 * 1000, // 30 seconds
        })
      );

      // 30 seconds
      await act(async () => {
        vi.advanceTimersByTime(30 * 1000);
      });

      expect(mockSaveFunc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Toast Notifications', () => {
    it('shows success toast on save', async () => {
      renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
          showToasts: true,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('saved'),
        'success'
      );
    });

    it('does not show toast when showToasts is false', async () => {
      renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
          showToasts: false,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('shows error toast on save failure', async () => {
      mockSaveFunc.mockRejectedValue(new Error('Save failed'));

      renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
          showToasts: true,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        'error'
      );
    });
  });

  describe('Error Handling', () => {
    it('catches save errors gracefully', async () => {
      mockSaveFunc.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
        })
      );

      await act(async () => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      // Should not throw
      expect(result.current.lastError).toBe('Network error');
    });

    it('retries on next interval after error', async () => {
      mockSaveFunc.mockRejectedValueOnce(new Error('Network error'));
      mockSaveFunc.mockResolvedValueOnce(undefined);

      const { rerender } = renderHook(
        ({ data }) =>
          useAutoSave({
            enabled: true,
            data,
            saveFunc: mockSaveFunc,
            intervalMs: 60 * 1000,
          }),
        {
          initialProps: { data: { test: 1 } },
        }
      );

      // First interval - fails
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      expect(mockSaveFunc).toHaveBeenCalledTimes(1);

      // Change data to trigger next save
      rerender({ data: { test: 2 } });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Second interval - succeeds
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      expect(mockSaveFunc).toHaveBeenCalledTimes(2);
    });
  });

  describe('Manual Save', () => {
    it('provides saveNow function for manual save', async () => {
      const { result } = renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
        })
      );

      await act(async () => {
        await result.current.saveNow();
      });

      expect(mockSaveFunc).toHaveBeenCalledTimes(1);
    });

    it('saveNow resets the timer', async () => {
      const { result } = renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
          intervalMs: 60 * 1000,
        })
      );

      // Advance 30 seconds
      await act(async () => {
        vi.advanceTimersByTime(30 * 1000);
      });

      // Manual save
      await act(async () => {
        await result.current.saveNow();
      });

      expect(mockSaveFunc).toHaveBeenCalledTimes(1);

      // Advance another 30 seconds (60 total from last save)
      await act(async () => {
        vi.advanceTimersByTime(30 * 1000);
      });

      // Should not have auto-saved yet (interval reset)
      expect(mockSaveFunc).toHaveBeenCalledTimes(1);

      // Advance to complete the interval from manual save
      await act(async () => {
        vi.advanceTimersByTime(30 * 1000);
      });

      // Now should auto-save (but data hasn't changed, so no save)
      expect(mockSaveFunc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Status', () => {
    it('provides isSaving status', async () => {
      let resolveSave: () => void;
      mockSaveFunc.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve;
          })
      );

      const { result } = renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
        })
      );

      expect(result.current.isSaving).toBe(false);

      // Trigger save
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(result.current.isSaving).toBe(true);

      // Complete save
      await act(async () => {
        resolveSave();
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('provides lastSaveTime', async () => {
      const { result } = renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
        })
      );

      expect(result.current.lastSaveTime).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(result.current.lastSaveTime).not.toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('clears interval on unmount', async () => {
      const { unmount } = renderHook(() =>
        useAutoSave({
          enabled: true,
          data: { test: 'data' },
          saveFunc: mockSaveFunc,
          intervalMs: 60 * 1000,
        })
      );

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      expect(mockSaveFunc).not.toHaveBeenCalled();
    });

    it('clears debounce on unmount', async () => {
      const { unmount, rerender } = renderHook(
        ({ data }) =>
          useAutoSave({
            enabled: true,
            data,
            saveFunc: mockSaveFunc,
          }),
        {
          initialProps: { data: { test: 1 } },
        }
      );

      rerender({ data: { test: 2 } });

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(500 + 2 * 60 * 1000);
      });

      expect(mockSaveFunc).not.toHaveBeenCalled();
    });
  });
});
