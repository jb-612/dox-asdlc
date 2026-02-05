/**
 * Review Store (P04-F06)
 *
 * Manages UI state for the Code Review Page:
 * - Review configuration and phase tracking
 * - Reviewer progress monitoring
 * - CLI-style output entries
 * - Results and finding selection/ignore state
 */

import { create } from 'zustand';
import type { UnifiedReport, ReviewerType } from '../api/types';

// ============================================================================
// Types
// ============================================================================

export interface ReviewConfig {
  target: string;
  scope: 'full_repo' | 'changed_files' | 'custom_path';
  customPath?: string;
  reviewers: {
    security: boolean;
    performance: boolean;
    style: boolean;
  };
}

export interface ReviewerProgress {
  type: ReviewerType;
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  progress: number;
  filesReviewed: number;
  findingsCount: number;
  durationSeconds?: number;
}

export interface CLIEntry {
  timestamp: string;
  reviewer: ReviewerType | 'system';
  message: string;
  type: 'info' | 'progress' | 'finding' | 'error';
}

export type ReviewPhase = 'idle' | 'configuring' | 'running' | 'complete' | 'error';

export interface ReviewState {
  // Current review
  currentSwarmId: string | null;
  phase: ReviewPhase;
  config: ReviewConfig | null;

  // Progress tracking
  reviewerProgress: Record<string, ReviewerProgress>;
  cliEntries: CLIEntry[];
  tokensUsed: number;
  estimatedCost: number;

  // Results
  results: UnifiedReport | null;
  selectedFindings: Set<string>;
  ignoredFindings: Set<string>;

  // Actions
  setPhase: (phase: ReviewPhase) => void;
  setSwarmId: (id: string | null) => void;
  setConfig: (config: ReviewConfig | null) => void;
  startReview: (config: ReviewConfig) => void;
  updateProgress: (reviewerType: string, progress: Partial<ReviewerProgress>) => void;
  addCLIEntry: (entry: Omit<CLIEntry, 'timestamp'>) => void;
  setTokensUsed: (tokens: number) => void;
  setEstimatedCost: (cost: number) => void;
  setResults: (results: UnifiedReport | null) => void;
  toggleFindingSelection: (findingId: string) => void;
  selectAllFindings: () => void;
  clearSelection: () => void;
  ignoreFinding: (findingId: string) => void;
  unignoreFinding: (findingId: string) => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  currentSwarmId: null,
  phase: 'idle' as ReviewPhase,
  config: null,
  reviewerProgress: {},
  cliEntries: [],
  tokensUsed: 0,
  estimatedCost: 0,
  results: null,
  selectedFindings: new Set<string>(),
  ignoredFindings: new Set<string>(),
};

// ============================================================================
// Store
// ============================================================================

export const useReviewStore = create<ReviewState>((set, get) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),

  setSwarmId: (id) => set({ currentSwarmId: id }),

  setConfig: (config) => set({ config }),

  startReview: (config) => {
    // Initialize progress for enabled reviewers
    const reviewerProgress: Record<string, ReviewerProgress> = {};

    if (config.reviewers.security) {
      reviewerProgress.security = {
        type: 'security',
        status: 'pending',
        progress: 0,
        filesReviewed: 0,
        findingsCount: 0,
      };
    }

    if (config.reviewers.performance) {
      reviewerProgress.performance = {
        type: 'performance',
        status: 'pending',
        progress: 0,
        filesReviewed: 0,
        findingsCount: 0,
      };
    }

    if (config.reviewers.style) {
      reviewerProgress.style = {
        type: 'style',
        status: 'pending',
        progress: 0,
        filesReviewed: 0,
        findingsCount: 0,
      };
    }

    set({
      config,
      phase: 'running',
      reviewerProgress,
      cliEntries: [],
      tokensUsed: 0,
      estimatedCost: 0,
      results: null,
      selectedFindings: new Set(),
      ignoredFindings: new Set(),
    });
  },

  updateProgress: (reviewerType, progress) => {
    set((state) => {
      const existing = state.reviewerProgress[reviewerType];
      if (!existing) return state;

      return {
        reviewerProgress: {
          ...state.reviewerProgress,
          [reviewerType]: {
            ...existing,
            ...progress,
          },
        },
      };
    });
  },

  addCLIEntry: (entry) => {
    const newEntry: CLIEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      cliEntries: [...state.cliEntries, newEntry],
    }));
  },

  setTokensUsed: (tokens) => set({ tokensUsed: tokens }),

  setEstimatedCost: (cost) => set({ estimatedCost: cost }),

  setResults: (results) => set({ results }),

  toggleFindingSelection: (findingId) => {
    set((state) => {
      const newSelection = new Set(state.selectedFindings);
      if (newSelection.has(findingId)) {
        newSelection.delete(findingId);
      } else {
        newSelection.add(findingId);
      }
      return { selectedFindings: newSelection };
    });
  },

  selectAllFindings: () => {
    const { results, ignoredFindings } = get();
    if (!results) return;

    const allFindingIds = new Set<string>();

    // Gather all finding IDs from all severity levels
    const allFindings = [
      ...results.critical_findings,
      ...results.high_findings,
      ...results.medium_findings,
      ...results.low_findings,
      ...results.info_findings,
    ];

    allFindings.forEach((finding) => {
      // Only add if not ignored
      if (!ignoredFindings.has(finding.id)) {
        allFindingIds.add(finding.id);
      }
    });

    set({ selectedFindings: allFindingIds });
  },

  clearSelection: () => set({ selectedFindings: new Set() }),

  ignoreFinding: (findingId) => {
    set((state) => {
      const newIgnored = new Set(state.ignoredFindings);
      newIgnored.add(findingId);

      // Also remove from selection if present
      const newSelection = new Set(state.selectedFindings);
      newSelection.delete(findingId);

      return {
        ignoredFindings: newIgnored,
        selectedFindings: newSelection,
      };
    });
  },

  unignoreFinding: (findingId) => {
    set((state) => {
      const newIgnored = new Set(state.ignoredFindings);
      newIgnored.delete(findingId);
      return { ignoredFindings: newIgnored };
    });
  },

  reset: () =>
    set({
      ...initialState,
      selectedFindings: new Set(),
      ignoredFindings: new Set(),
    }),
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectPhase = (state: ReviewState) => state.phase;
export const selectConfig = (state: ReviewState) => state.config;
export const selectSwarmId = (state: ReviewState) => state.currentSwarmId;
export const selectReviewerProgress = (state: ReviewState) => state.reviewerProgress;
export const selectCLIEntries = (state: ReviewState) => state.cliEntries;
export const selectResults = (state: ReviewState) => state.results;
export const selectSelectedFindings = (state: ReviewState) => state.selectedFindings;
export const selectIgnoredFindings = (state: ReviewState) => state.ignoredFindings;

/**
 * Get all findings not in the ignored set
 */
export const selectVisibleFindings = (state: ReviewState) => {
  if (!state.results) return [];

  const allFindings = [
    ...state.results.critical_findings,
    ...state.results.high_findings,
    ...state.results.medium_findings,
    ...state.results.low_findings,
    ...state.results.info_findings,
  ];

  return allFindings.filter((f) => !state.ignoredFindings.has(f.id));
};

/**
 * Check if all enabled reviewers have completed
 */
export const selectAllReviewersComplete = (state: ReviewState): boolean => {
  const progress = Object.values(state.reviewerProgress);
  if (progress.length === 0) return false;

  return progress.every(
    (p) => p.status === 'complete' || p.status === 'failed'
  );
};

/**
 * Get overall progress percentage across all reviewers
 */
export const selectOverallProgress = (state: ReviewState): number => {
  const progress = Object.values(state.reviewerProgress);
  if (progress.length === 0) return 0;

  const total = progress.reduce((sum, p) => sum + p.progress, 0);
  return Math.round(total / progress.length);
};
