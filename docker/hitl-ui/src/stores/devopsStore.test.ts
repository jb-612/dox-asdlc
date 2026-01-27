/**
 * Tests for DevOps Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useDevOpsStore,
  selectBannerDismissed,
  selectLastActivityId,
} from './devopsStore';

describe('devopsStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useDevOpsStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('Initial State', () => {
    it('has bannerDismissed set to false initially', () => {
      const { result } = renderHook(() => useDevOpsStore());
      expect(result.current.bannerDismissed).toBe(false);
    });

    it('has lastActivityId set to null initially', () => {
      const { result } = renderHook(() => useDevOpsStore());
      expect(result.current.lastActivityId).toBeNull();
    });
  });

  describe('setBannerDismissed', () => {
    it('sets bannerDismissed to true', () => {
      const { result } = renderHook(() => useDevOpsStore());

      act(() => {
        result.current.setBannerDismissed(true);
      });

      expect(result.current.bannerDismissed).toBe(true);
    });

    it('sets bannerDismissed to false', () => {
      const { result } = renderHook(() => useDevOpsStore());

      act(() => {
        result.current.setBannerDismissed(true);
      });

      act(() => {
        result.current.setBannerDismissed(false);
      });

      expect(result.current.bannerDismissed).toBe(false);
    });
  });

  describe('setLastActivityId', () => {
    it('sets lastActivityId to a string value', () => {
      const { result } = renderHook(() => useDevOpsStore());

      act(() => {
        result.current.setLastActivityId('activity-123');
      });

      expect(result.current.lastActivityId).toBe('activity-123');
    });

    it('sets lastActivityId to null', () => {
      const { result } = renderHook(() => useDevOpsStore());

      act(() => {
        result.current.setLastActivityId('activity-123');
      });

      act(() => {
        result.current.setLastActivityId(null);
      });

      expect(result.current.lastActivityId).toBeNull();
    });
  });

  describe('resetBannerForActivity', () => {
    it('resets banner for new activity', () => {
      const { result } = renderHook(() => useDevOpsStore());

      // Dismiss banner for first activity
      act(() => {
        result.current.setLastActivityId('activity-1');
        result.current.setBannerDismissed(true);
      });

      // New activity should reset banner
      act(() => {
        result.current.resetBannerForActivity('activity-2');
      });

      expect(result.current.bannerDismissed).toBe(false);
      expect(result.current.lastActivityId).toBe('activity-2');
    });

    it('does not reset banner for same activity', () => {
      const { result } = renderHook(() => useDevOpsStore());

      // Set activity and dismiss banner
      act(() => {
        result.current.setLastActivityId('activity-1');
        result.current.setBannerDismissed(true);
      });

      // Same activity should not reset banner
      act(() => {
        result.current.resetBannerForActivity('activity-1');
      });

      expect(result.current.bannerDismissed).toBe(true);
      expect(result.current.lastActivityId).toBe('activity-1');
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      const { result } = renderHook(() => useDevOpsStore());

      act(() => {
        result.current.setBannerDismissed(true);
        result.current.setLastActivityId('activity-123');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.bannerDismissed).toBe(false);
      expect(result.current.lastActivityId).toBeNull();
    });
  });

  describe('Selectors', () => {
    it('selectBannerDismissed returns correct value', () => {
      const { result } = renderHook(() => useDevOpsStore());

      act(() => {
        result.current.setBannerDismissed(true);
      });

      expect(selectBannerDismissed(result.current)).toBe(true);
    });

    it('selectLastActivityId returns correct value', () => {
      const { result } = renderHook(() => useDevOpsStore());

      act(() => {
        result.current.setLastActivityId('activity-456');
      });

      expect(selectLastActivityId(result.current)).toBe('activity-456');
    });
  });
});
