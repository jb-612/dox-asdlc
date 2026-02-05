/**
 * Tests for Review Store (P04-F06)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useReviewStore,
  selectPhase,
  selectConfig,
  selectSwarmId,
  selectReviewerProgress,
  selectCLIEntries,
  selectResults,
  selectSelectedFindings,
  selectIgnoredFindings,
  selectVisibleFindings,
  selectAllReviewersComplete,
  selectOverallProgress,
  type ReviewConfig,
} from './reviewStore';
import type { UnifiedReport, ReviewFinding } from '../api/types';

// ============================================================================
// Test Data
// ============================================================================

const mockConfig: ReviewConfig = {
  target: 'src/',
  scope: 'full_repo',
  reviewers: {
    security: true,
    performance: true,
    style: false,
  },
};

const mockFinding: ReviewFinding = {
  id: 'finding-001',
  reviewer_type: 'security',
  severity: 'high',
  category: 'security/injection',
  title: 'SQL Injection Vulnerability',
  description: 'User input not sanitized',
  file_path: 'src/api/users.py',
  line_start: 42,
  line_end: 45,
  code_snippet: 'query = f"SELECT * FROM users WHERE id = {user_id}"',
  recommendation: 'Use parameterized queries',
  confidence: 0.95,
};

const mockFinding2: ReviewFinding = {
  id: 'finding-002',
  reviewer_type: 'performance',
  severity: 'medium',
  category: 'performance/query',
  title: 'N+1 Query Pattern',
  description: 'Inefficient database queries in loop',
  file_path: 'src/api/orders.py',
  line_start: 100,
  line_end: 110,
  code_snippet: 'for order in orders: fetch_items(order.id)',
  recommendation: 'Use eager loading',
  confidence: 0.85,
};

const mockResults: UnifiedReport = {
  swarm_id: 'swarm-123',
  target_path: 'src/',
  created_at: '2024-01-01T00:00:00Z',
  reviewers_completed: ['security', 'performance'],
  reviewers_failed: [],
  critical_findings: [],
  high_findings: [mockFinding],
  medium_findings: [mockFinding2],
  low_findings: [],
  info_findings: [],
  total_findings: 2,
  findings_by_reviewer: { security: 1, performance: 1 },
  findings_by_category: { 'security/injection': 1, 'performance/query': 1 },
  duplicates_removed: 0,
};

// ============================================================================
// Tests
// ============================================================================

describe('reviewStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useReviewStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('Initial State', () => {
    it('has correct initial phase', () => {
      const { result } = renderHook(() => useReviewStore());
      expect(result.current.phase).toBe('idle');
    });

    it('has null currentSwarmId initially', () => {
      const { result } = renderHook(() => useReviewStore());
      expect(result.current.currentSwarmId).toBeNull();
    });

    it('has null config initially', () => {
      const { result } = renderHook(() => useReviewStore());
      expect(result.current.config).toBeNull();
    });

    it('has empty reviewerProgress initially', () => {
      const { result } = renderHook(() => useReviewStore());
      expect(result.current.reviewerProgress).toEqual({});
    });

    it('has empty cliEntries initially', () => {
      const { result } = renderHook(() => useReviewStore());
      expect(result.current.cliEntries).toEqual([]);
    });

    it('has null results initially', () => {
      const { result } = renderHook(() => useReviewStore());
      expect(result.current.results).toBeNull();
    });

    it('has empty selectedFindings initially', () => {
      const { result } = renderHook(() => useReviewStore());
      expect(result.current.selectedFindings.size).toBe(0);
    });

    it('has empty ignoredFindings initially', () => {
      const { result } = renderHook(() => useReviewStore());
      expect(result.current.ignoredFindings.size).toBe(0);
    });
  });

  describe('setPhase', () => {
    it('sets phase to running', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setPhase('running');
      });

      expect(result.current.phase).toBe('running');
    });

    it('sets phase to complete', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setPhase('complete');
      });

      expect(result.current.phase).toBe('complete');
    });

    it('sets phase to error', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setPhase('error');
      });

      expect(result.current.phase).toBe('error');
    });
  });

  describe('setSwarmId', () => {
    it('sets swarm ID', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setSwarmId('swarm-123');
      });

      expect(result.current.currentSwarmId).toBe('swarm-123');
    });

    it('clears swarm ID with null', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setSwarmId('swarm-123');
      });

      act(() => {
        result.current.setSwarmId(null);
      });

      expect(result.current.currentSwarmId).toBeNull();
    });
  });

  describe('setConfig', () => {
    it('sets config', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setConfig(mockConfig);
      });

      expect(result.current.config).toEqual(mockConfig);
    });
  });

  describe('startReview', () => {
    it('initializes progress for enabled reviewers', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
      });

      expect(result.current.reviewerProgress.security).toBeDefined();
      expect(result.current.reviewerProgress.performance).toBeDefined();
      expect(result.current.reviewerProgress.style).toBeUndefined();
    });

    it('sets phase to running', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
      });

      expect(result.current.phase).toBe('running');
    });

    it('sets config', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
      });

      expect(result.current.config).toEqual(mockConfig);
    });

    it('clears previous results', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setResults(mockResults);
      });

      act(() => {
        result.current.startReview(mockConfig);
      });

      expect(result.current.results).toBeNull();
    });

    it('clears previous selections', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.toggleFindingSelection('finding-001');
      });

      act(() => {
        result.current.startReview(mockConfig);
      });

      expect(result.current.selectedFindings.size).toBe(0);
    });

    it('initializes reviewer status as pending', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
      });

      expect(result.current.reviewerProgress.security?.status).toBe('pending');
      expect(result.current.reviewerProgress.performance?.status).toBe('pending');
    });
  });

  describe('updateProgress', () => {
    it('updates progress for a reviewer', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
      });

      act(() => {
        result.current.updateProgress('security', {
          status: 'in_progress',
          progress: 50,
          filesReviewed: 5,
        });
      });

      expect(result.current.reviewerProgress.security?.status).toBe('in_progress');
      expect(result.current.reviewerProgress.security?.progress).toBe(50);
      expect(result.current.reviewerProgress.security?.filesReviewed).toBe(5);
    });

    it('does not create progress for non-existent reviewer', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
      });

      act(() => {
        result.current.updateProgress('style', {
          status: 'in_progress',
          progress: 50,
        });
      });

      expect(result.current.reviewerProgress.style).toBeUndefined();
    });

    it('preserves existing progress values when partially updating', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
      });

      act(() => {
        result.current.updateProgress('security', {
          filesReviewed: 10,
          findingsCount: 3,
        });
      });

      act(() => {
        result.current.updateProgress('security', {
          status: 'complete',
          progress: 100,
        });
      });

      expect(result.current.reviewerProgress.security?.filesReviewed).toBe(10);
      expect(result.current.reviewerProgress.security?.findingsCount).toBe(3);
      expect(result.current.reviewerProgress.security?.status).toBe('complete');
    });
  });

  describe('addCLIEntry', () => {
    it('adds a CLI entry with timestamp', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.addCLIEntry({
          reviewer: 'security',
          message: 'Starting security review...',
          type: 'info',
        });
      });

      expect(result.current.cliEntries.length).toBe(1);
      expect(result.current.cliEntries[0].reviewer).toBe('security');
      expect(result.current.cliEntries[0].message).toBe('Starting security review...');
      expect(result.current.cliEntries[0].type).toBe('info');
      expect(result.current.cliEntries[0].timestamp).toBeDefined();
    });

    it('appends entries in order', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.addCLIEntry({
          reviewer: 'system',
          message: 'Review started',
          type: 'info',
        });
      });

      act(() => {
        result.current.addCLIEntry({
          reviewer: 'security',
          message: 'Found vulnerability',
          type: 'finding',
        });
      });

      expect(result.current.cliEntries.length).toBe(2);
      expect(result.current.cliEntries[0].message).toBe('Review started');
      expect(result.current.cliEntries[1].message).toBe('Found vulnerability');
    });
  });

  describe('setTokensUsed and setEstimatedCost', () => {
    it('sets tokens used', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setTokensUsed(50000);
      });

      expect(result.current.tokensUsed).toBe(50000);
    });

    it('sets estimated cost', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setEstimatedCost(1.25);
      });

      expect(result.current.estimatedCost).toBe(1.25);
    });
  });

  describe('setResults', () => {
    it('sets results', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setResults(mockResults);
      });

      expect(result.current.results).toEqual(mockResults);
    });

    it('clears results with null', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setResults(mockResults);
      });

      act(() => {
        result.current.setResults(null);
      });

      expect(result.current.results).toBeNull();
    });
  });

  describe('Finding Selection', () => {
    it('toggleFindingSelection adds finding to selection', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.toggleFindingSelection('finding-001');
      });

      expect(result.current.selectedFindings.has('finding-001')).toBe(true);
    });

    it('toggleFindingSelection removes finding from selection', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.toggleFindingSelection('finding-001');
      });

      act(() => {
        result.current.toggleFindingSelection('finding-001');
      });

      expect(result.current.selectedFindings.has('finding-001')).toBe(false);
    });

    it('selectAllFindings selects all findings except ignored', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setResults(mockResults);
        result.current.ignoreFinding('finding-001');
      });

      act(() => {
        result.current.selectAllFindings();
      });

      expect(result.current.selectedFindings.has('finding-001')).toBe(false);
      expect(result.current.selectedFindings.has('finding-002')).toBe(true);
    });

    it('clearSelection clears all selections', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.toggleFindingSelection('finding-001');
        result.current.toggleFindingSelection('finding-002');
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedFindings.size).toBe(0);
    });
  });

  describe('Finding Ignore', () => {
    it('ignoreFinding adds finding to ignored set', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.ignoreFinding('finding-001');
      });

      expect(result.current.ignoredFindings.has('finding-001')).toBe(true);
    });

    it('ignoreFinding removes finding from selection', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.toggleFindingSelection('finding-001');
      });

      act(() => {
        result.current.ignoreFinding('finding-001');
      });

      expect(result.current.selectedFindings.has('finding-001')).toBe(false);
    });

    it('unignoreFinding removes finding from ignored set', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.ignoreFinding('finding-001');
      });

      act(() => {
        result.current.unignoreFinding('finding-001');
      });

      expect(result.current.ignoredFindings.has('finding-001')).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setPhase('running');
        result.current.setSwarmId('swarm-123');
        result.current.setConfig(mockConfig);
        result.current.setResults(mockResults);
        result.current.toggleFindingSelection('finding-001');
        result.current.ignoreFinding('finding-002');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.currentSwarmId).toBeNull();
      expect(result.current.config).toBeNull();
      expect(result.current.results).toBeNull();
      expect(result.current.selectedFindings.size).toBe(0);
      expect(result.current.ignoredFindings.size).toBe(0);
    });
  });

  describe('Selectors', () => {
    it('selectPhase returns correct value', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setPhase('running');
      });

      expect(selectPhase(result.current)).toBe('running');
    });

    it('selectConfig returns correct value', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setConfig(mockConfig);
      });

      expect(selectConfig(result.current)).toEqual(mockConfig);
    });

    it('selectSwarmId returns correct value', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setSwarmId('swarm-456');
      });

      expect(selectSwarmId(result.current)).toBe('swarm-456');
    });

    it('selectReviewerProgress returns correct value', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
      });

      const progress = selectReviewerProgress(result.current);
      expect(progress.security).toBeDefined();
      expect(progress.performance).toBeDefined();
    });

    it('selectCLIEntries returns correct value', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.addCLIEntry({
          reviewer: 'system',
          message: 'Test',
          type: 'info',
        });
      });

      const entries = selectCLIEntries(result.current);
      expect(entries.length).toBe(1);
    });

    it('selectResults returns correct value', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setResults(mockResults);
      });

      expect(selectResults(result.current)).toEqual(mockResults);
    });

    it('selectSelectedFindings returns correct value', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.toggleFindingSelection('finding-001');
      });

      expect(selectSelectedFindings(result.current).has('finding-001')).toBe(true);
    });

    it('selectIgnoredFindings returns correct value', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.ignoreFinding('finding-001');
      });

      expect(selectIgnoredFindings(result.current).has('finding-001')).toBe(true);
    });

    it('selectVisibleFindings excludes ignored findings', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.setResults(mockResults);
        result.current.ignoreFinding('finding-001');
      });

      const visible = selectVisibleFindings(result.current);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe('finding-002');
    });

    it('selectVisibleFindings returns empty array when no results', () => {
      const { result } = renderHook(() => useReviewStore());

      const visible = selectVisibleFindings(result.current);
      expect(visible).toEqual([]);
    });

    it('selectAllReviewersComplete returns true when all complete', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
        result.current.updateProgress('security', { status: 'complete' });
        result.current.updateProgress('performance', { status: 'complete' });
      });

      expect(selectAllReviewersComplete(result.current)).toBe(true);
    });

    it('selectAllReviewersComplete returns true when some failed', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
        result.current.updateProgress('security', { status: 'complete' });
        result.current.updateProgress('performance', { status: 'failed' });
      });

      expect(selectAllReviewersComplete(result.current)).toBe(true);
    });

    it('selectAllReviewersComplete returns false when still running', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
        result.current.updateProgress('security', { status: 'complete' });
        result.current.updateProgress('performance', { status: 'in_progress' });
      });

      expect(selectAllReviewersComplete(result.current)).toBe(false);
    });

    it('selectAllReviewersComplete returns false when no reviewers', () => {
      const { result } = renderHook(() => useReviewStore());

      expect(selectAllReviewersComplete(result.current)).toBe(false);
    });

    it('selectOverallProgress returns average progress', () => {
      const { result } = renderHook(() => useReviewStore());

      act(() => {
        result.current.startReview(mockConfig);
        result.current.updateProgress('security', { progress: 100 });
        result.current.updateProgress('performance', { progress: 50 });
      });

      expect(selectOverallProgress(result.current)).toBe(75);
    });

    it('selectOverallProgress returns 0 when no reviewers', () => {
      const { result } = renderHook(() => useReviewStore());

      expect(selectOverallProgress(result.current)).toBe(0);
    });
  });
});
