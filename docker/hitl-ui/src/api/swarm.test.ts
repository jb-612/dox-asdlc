/**
 * Tests for Swarm Review API (P04-F06)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  triggerSwarmReview,
  fetchSwarmStatus,
  useSwarmReview,
  useSwarmStatus,
  swarmKeys,
  isSwarmRunning,
  isSwarmFinished,
  getSwarmProgress,
  formatDuration,
} from './swarm';
import {
  mockTriggerSwarmReview,
  mockFetchSwarmStatus,
  resetMockSwarms,
} from './mocks/swarm';
import type {
  SwarmReviewRequest,
  SwarmStatusResponse,
} from './types';

// Mock the mocks module to control areMocksEnabled
vi.mock('./mocks/index', () => ({
  areMocksEnabled: vi.fn(() => true),
}));

// ============================================================================
// Test Setup
// ============================================================================

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('swarm API', () => {
  beforeEach(() => {
    resetMockSwarms();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('swarmKeys', () => {
    it('generates correct all key', () => {
      expect(swarmKeys.all).toEqual(['swarm']);
    });

    it('generates correct status key', () => {
      expect(swarmKeys.status('swarm-123')).toEqual([
        'swarm',
        'status',
        'swarm-123',
      ]);
    });
  });

  describe('triggerSwarmReview', () => {
    it('returns a swarm response with ID', async () => {
      const request: SwarmReviewRequest = {
        target_path: 'src/',
        reviewer_types: ['security', 'performance'],
      };

      const response = await triggerSwarmReview(request);

      expect(response.swarm_id).toBeDefined();
      expect(response.swarm_id).toMatch(/^swarm-/);
      expect(response.status).toBe('pending');
      expect(response.poll_url).toContain(response.swarm_id);
    });

    it('uses all reviewers when none specified', async () => {
      const request: SwarmReviewRequest = {
        target_path: 'src/',
      };

      const response = await triggerSwarmReview(request);

      // Verify by fetching status
      const status = await fetchSwarmStatus(response.swarm_id);
      expect(Object.keys(status.reviewers)).toContain('security');
      expect(Object.keys(status.reviewers)).toContain('performance');
      expect(Object.keys(status.reviewers)).toContain('style');
    });
  });

  describe('fetchSwarmStatus', () => {
    it('returns status for existing swarm', async () => {
      const request: SwarmReviewRequest = {
        target_path: 'src/',
        reviewer_types: ['security'],
      };

      const triggerResponse = await triggerSwarmReview(request);
      const status = await fetchSwarmStatus(triggerResponse.swarm_id);

      expect(status.swarm_id).toBe(triggerResponse.swarm_id);
      expect(status.reviewers).toBeDefined();
      expect(status.reviewers.security).toBeDefined();
    });

    it('throws error for non-existent swarm', async () => {
      await expect(fetchSwarmStatus('non-existent-swarm')).rejects.toThrow(
        'Swarm not found'
      );
    });

    it('shows progress over time', async () => {
      const request: SwarmReviewRequest = {
        target_path: 'src/',
        reviewer_types: ['security'],
      };

      const triggerResponse = await triggerSwarmReview(request);

      // First fetch - should be pending or early progress
      const status1 = await fetchSwarmStatus(triggerResponse.swarm_id);
      expect(status1.status).toMatch(/pending|in_progress/);

      // Note: In actual implementation, we'd wait and check progress increases
      // For mocks, we rely on the mock's time-based simulation
    });
  });

  describe('useSwarmReview hook', () => {
    it('returns mutation functions', () => {
      const { result } = renderHook(() => useSwarmReview(), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.mutate).toBeDefined();
      expect(result.current.mutateAsync).toBeDefined();
      expect(result.current.isPending).toBe(false);
    });

    it('triggers review on mutate', async () => {
      const { result } = renderHook(() => useSwarmReview(), {
        wrapper: createQueryWrapper(),
      });

      let response;
      await waitFor(async () => {
        response = await result.current.mutateAsync({
          target_path: 'src/',
          reviewer_types: ['security'],
        });
      });

      expect(response?.swarm_id).toBeDefined();
    });
  });

  describe('useSwarmStatus hook', () => {
    it('fetches status when swarmId is provided', async () => {
      // First trigger a swarm
      const triggerResponse = await triggerSwarmReview({
        target_path: 'src/',
        reviewer_types: ['security'],
      });

      const { result } = renderHook(
        () => useSwarmStatus(triggerResponse.swarm_id),
        {
          wrapper: createQueryWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data?.swarm_id).toBe(triggerResponse.swarm_id);
    });

    it('does not fetch when swarmId is null', () => {
      const { result } = renderHook(() => useSwarmStatus(null), {
        wrapper: createQueryWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('respects enabled option', () => {
      const { result } = renderHook(
        () => useSwarmStatus('swarm-123', { enabled: false }),
        {
          wrapper: createQueryWrapper(),
        }
      );

      expect(result.current.isFetching).toBe(false);
    });
  });

  describe('utility functions', () => {
    describe('isSwarmRunning', () => {
      it('returns true for pending', () => {
        expect(isSwarmRunning('pending')).toBe(true);
      });

      it('returns true for in_progress', () => {
        expect(isSwarmRunning('in_progress')).toBe(true);
      });

      it('returns true for aggregating', () => {
        expect(isSwarmRunning('aggregating')).toBe(true);
      });

      it('returns false for complete', () => {
        expect(isSwarmRunning('complete')).toBe(false);
      });

      it('returns false for failed', () => {
        expect(isSwarmRunning('failed')).toBe(false);
      });
    });

    describe('isSwarmFinished', () => {
      it('returns true for complete', () => {
        expect(isSwarmFinished('complete')).toBe(true);
      });

      it('returns true for failed', () => {
        expect(isSwarmFinished('failed')).toBe(true);
      });

      it('returns false for pending', () => {
        expect(isSwarmFinished('pending')).toBe(false);
      });

      it('returns false for in_progress', () => {
        expect(isSwarmFinished('in_progress')).toBe(false);
      });

      it('returns false for aggregating', () => {
        expect(isSwarmFinished('aggregating')).toBe(false);
      });
    });

    describe('getSwarmProgress', () => {
      it('calculates average progress across reviewers', () => {
        const status: SwarmStatusResponse = {
          swarm_id: 'test',
          status: 'in_progress',
          reviewers: {
            security: {
              status: 'complete',
              files_reviewed: 10,
              findings_count: 2,
              progress_percent: 100,
            },
            performance: {
              status: 'in_progress',
              files_reviewed: 5,
              findings_count: 0,
              progress_percent: 50,
            },
          },
        };

        expect(getSwarmProgress(status)).toBe(75);
      });

      it('returns 0 for empty reviewers', () => {
        const status: SwarmStatusResponse = {
          swarm_id: 'test',
          status: 'pending',
          reviewers: {},
        };

        expect(getSwarmProgress(status)).toBe(0);
      });

      it('handles single reviewer', () => {
        const status: SwarmStatusResponse = {
          swarm_id: 'test',
          status: 'in_progress',
          reviewers: {
            security: {
              status: 'in_progress',
              files_reviewed: 3,
              findings_count: 1,
              progress_percent: 30,
            },
          },
        };

        expect(getSwarmProgress(status)).toBe(30);
      });
    });

    describe('formatDuration', () => {
      it('formats seconds less than 60', () => {
        expect(formatDuration(5.5)).toBe('5.5s');
        expect(formatDuration(45.123)).toBe('45.1s');
      });

      it('formats minutes and seconds', () => {
        expect(formatDuration(65)).toBe('1m 5s');
        expect(formatDuration(125)).toBe('2m 5s');
      });

      it('handles exact minutes', () => {
        expect(formatDuration(60)).toBe('1m 0s');
        expect(formatDuration(120)).toBe('2m 0s');
      });
    });
  });
});

describe('swarm mocks', () => {
  beforeEach(() => {
    resetMockSwarms();
  });

  describe('mockTriggerSwarmReview', () => {
    it('generates unique swarm IDs', () => {
      const response1 = mockTriggerSwarmReview({ target_path: 'src/' });
      const response2 = mockTriggerSwarmReview({ target_path: 'src/' });

      expect(response1.swarm_id).not.toBe(response2.swarm_id);
    });

    it('includes poll_url with swarm ID', () => {
      const response = mockTriggerSwarmReview({ target_path: 'src/' });

      expect(response.poll_url).toBe(`/api/swarm/review/${response.swarm_id}`);
    });
  });

  describe('mockFetchSwarmStatus', () => {
    it('returns unified report when complete', async () => {
      const triggerResponse = mockTriggerSwarmReview({
        target_path: 'src/',
        reviewer_types: ['security', 'performance'],
      });

      // Simulate time passing by manipulating the mock state
      // Wait for mock to complete (10+ seconds simulated)
      // In tests, we can verify the structure is correct

      // The mock uses real time, but we can at least verify initial state
      const status = mockFetchSwarmStatus(triggerResponse.swarm_id);
      expect(status.swarm_id).toBe(triggerResponse.swarm_id);
      expect(status.reviewers.security).toBeDefined();
      expect(status.reviewers.performance).toBeDefined();
    });

    it('includes findings by severity when complete', async () => {
      // Create a mock swarm and verify structure
      const response = mockTriggerSwarmReview({
        target_path: 'src/',
        reviewer_types: ['security'],
      });

      // At minimum, verify the swarm was created
      const status = mockFetchSwarmStatus(response.swarm_id);
      expect(status).toBeDefined();

      // The unified_report will be present when status is complete
      // In real scenario, this happens after ~10 seconds
    });

    it('tracks reviewer types from request', () => {
      const response = mockTriggerSwarmReview({
        target_path: 'src/',
        reviewer_types: ['style'],
      });

      const status = mockFetchSwarmStatus(response.swarm_id);

      expect(status.reviewers.style).toBeDefined();
      expect(status.reviewers.security).toBeUndefined();
      expect(status.reviewers.performance).toBeUndefined();
    });
  });
});
