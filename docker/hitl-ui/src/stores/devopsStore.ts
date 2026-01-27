/**
 * DevOps Activity Zustand Store (P06-F07)
 *
 * Manages UI state for DevOps activity notifications:
 * - Banner dismissed state
 * - Track which activity triggered the banner
 */

import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export interface DevOpsState {
  /** Whether the notification banner has been dismissed by the user */
  bannerDismissed: boolean;

  /** The ID of the activity that last triggered the banner */
  lastActivityId: string | null;

  // Actions
  /** Set the banner dismissed state */
  setBannerDismissed: (dismissed: boolean) => void;

  /** Set the last activity ID that triggered the banner */
  setLastActivityId: (activityId: string | null) => void;

  /** Reset the banner state when a new activity starts */
  resetBannerForActivity: (activityId: string) => void;

  /** Reset all state */
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  bannerDismissed: false,
  lastActivityId: null,
};

// ============================================================================
// Store
// ============================================================================

export const useDevOpsStore = create<DevOpsState>((set) => ({
  ...initialState,

  setBannerDismissed: (dismissed) =>
    set({ bannerDismissed: dismissed }),

  setLastActivityId: (activityId) =>
    set({ lastActivityId: activityId }),

  resetBannerForActivity: (activityId) =>
    set((state) => {
      // Only reset if this is a new activity
      if (state.lastActivityId !== activityId) {
        return {
          bannerDismissed: false,
          lastActivityId: activityId,
        };
      }
      return state;
    }),

  reset: () => set(initialState),
}));

// ============================================================================
// Selectors (for optimization)
// ============================================================================

export const selectBannerDismissed = (state: DevOpsState) => state.bannerDismissed;
export const selectLastActivityId = (state: DevOpsState) => state.lastActivityId;
