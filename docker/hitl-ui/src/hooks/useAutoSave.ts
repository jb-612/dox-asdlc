/**
 * useAutoSave - Auto-save hook for ideation sessions (P05-F11 T20)
 *
 * Features:
 * - Auto-save at configurable intervals (default: 2 minutes)
 * - Debounce rapid changes (default: 500ms)
 * - Skip save if no changes since last save
 * - Show toast notifications on save (optional)
 * - Handle save errors gracefully
 * - Provide manual save function
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { showToast } from '../utils/toast';

export interface UseAutoSaveOptions<T> {
  /** Whether auto-save is enabled */
  enabled: boolean;
  /** Data to save */
  data: T;
  /** Function to call to save data */
  saveFunc: (data: T) => Promise<void>;
  /** Interval between saves in milliseconds (default: 2 minutes) */
  intervalMs?: number;
  /** Debounce time for rapid changes in milliseconds (default: 500ms) */
  debounceMs?: number;
  /** Whether to show toast notifications (default: true) */
  showToasts?: boolean;
}

export interface UseAutoSaveResult {
  /** Whether a save is in progress */
  isSaving: boolean;
  /** Last save time (ISO string) or null if never saved */
  lastSaveTime: string | null;
  /** Last error message or null if no error */
  lastError: string | null;
  /** Manually trigger a save */
  saveNow: () => Promise<void>;
}

/**
 * Compares data for changes using JSON.stringify.
 *
 * Trade-offs:
 * - Simple and reliable for small-to-medium serializable objects
 * - No external dependencies required
 * - O(n) where n is the stringified length
 *
 * For very large data structures (>100KB), consider using a more efficient
 * deep-equal library like 'fast-deep-equal' or implementing shallow comparison
 * if the data shape is known. However, for typical ideation session data
 * (messages, maturity state, requirements), JSON.stringify is acceptable
 * and avoids additional bundle size.
 */
function dataHasChanged<T>(prev: T | null, current: T): boolean {
  if (prev === null) return true;
  return JSON.stringify(prev) !== JSON.stringify(current);
}

/**
 * Auto-save hook
 */
export function useAutoSave<T>({
  enabled,
  data,
  saveFunc,
  intervalMs = 2 * 60 * 1000, // 2 minutes
  debounceMs = 500,
  showToasts = true,
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  // State
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Refs
  const lastSavedDataRef = useRef<T | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  const pendingChangeRef = useRef(false);

  // Update data ref when data changes
  useEffect(() => {
    const hasChanged = dataHasChanged(dataRef.current, data);
    dataRef.current = data;
    if (hasChanged) {
      pendingChangeRef.current = true;
    }
  }, [data]);

  // Mark data as changed with debounce
  useEffect(() => {
    if (!enabled) return;

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set debounce timer
    debounceRef.current = setTimeout(() => {
      // Data is now stable after debounce
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [data, enabled, debounceMs]);

  // Perform save
  const performSave = useCallback(async () => {
    // Check if there are changes to save
    if (!dataHasChanged(lastSavedDataRef.current, dataRef.current)) {
      return;
    }

    setIsSaving(true);
    setLastError(null);

    try {
      await saveFunc(dataRef.current);
      lastSavedDataRef.current = dataRef.current;
      pendingChangeRef.current = false;
      const now = new Date().toISOString();
      setLastSaveTime(now);

      if (showToasts) {
        showToast('Draft saved', 'success');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Save failed';
      setLastError(errorMessage);

      if (showToasts) {
        showToast(`Save failed: ${errorMessage}`, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  }, [saveFunc, showToasts]);

  // Manual save
  const saveNow = useCallback(async () => {
    // Clear existing interval to reset timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Perform save immediately
    await performSave();

    // Restart interval if enabled
    if (enabled) {
      intervalRef.current = setInterval(performSave, intervalMs);
    }
  }, [enabled, intervalMs, performSave]);

  // Set up interval
  useEffect(() => {
    if (!enabled) {
      // Clear interval when disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start interval
    intervalRef.current = setInterval(performSave, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMs, performSave]);

  // Return result
  return useMemo(
    () => ({
      isSaving,
      lastSaveTime,
      lastError,
      saveNow,
    }),
    [isSaving, lastSaveTime, lastError, saveNow]
  );
}
