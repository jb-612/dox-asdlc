/**
 * ReviewProgressPanel Component (T09)
 *
 * Main container for review progress visualization.
 * Integrates:
 * - ThreeLaneView for reviewer progress
 * - CLIMimicView for terminal output
 * - TokenCostCounter for cost tracking
 *
 * Handles polling via useSwarmStatus and updates the review store.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSwarmStatus } from '../../api/swarm';
import { useReviewStore } from '../../stores/reviewStore';
import { ThreeLaneView } from './ThreeLaneView';
import { CLIMimicView } from './CLIMimicView';
import { TokenCostCounter } from './TokenCostCounter';
import type { ReviewerType, ReviewerStatus } from '../../api/types';

interface ReviewProgressPanelProps {
  swarmId: string;
  onComplete: () => void;
}

export function ReviewProgressPanel({
  swarmId,
  onComplete,
}: ReviewProgressPanelProps) {
  const { data: status, isLoading, error } = useSwarmStatus(swarmId);

  const reviewerProgress = useReviewStore((state) => state.reviewerProgress);
  const cliEntries = useReviewStore((state) => state.cliEntries);
  const tokensUsed = useReviewStore((state) => state.tokensUsed);
  const estimatedCost = useReviewStore((state) => state.estimatedCost);
  const updateProgress = useReviewStore((state) => state.updateProgress);
  const addCLIEntry = useReviewStore((state) => state.addCLIEntry);

  // Track previous status for each reviewer to detect changes
  const previousStatusRef = useRef<Record<string, ReviewerStatus['status']>>({});
  const hasCalledOnComplete = useRef(false);

  // Memoized callback for stable reference
  const handleStatusUpdate = useCallback(() => {
    if (!status?.reviewers) return;

    Object.entries(status.reviewers).forEach(([type, progress]) => {
      const reviewerType = type as ReviewerType;
      const previousStatus = previousStatusRef.current[reviewerType];

      // Update progress in store
      updateProgress(reviewerType, {
        type: reviewerType,
        status: progress.status,
        progress: progress.progress_percent,
        filesReviewed: progress.files_reviewed,
        findingsCount: progress.findings_count,
        durationSeconds: progress.duration_seconds,
      });

      // Add CLI entry for status changes (only if status actually changed)
      if (progress.status !== previousStatus) {
        if (progress.status === 'complete') {
          addCLIEntry({
            reviewer: reviewerType,
            message: `Completed with ${progress.findings_count} findings`,
            type: 'info',
          });
        }

        if (progress.status === 'in_progress') {
          addCLIEntry({
            reviewer: reviewerType,
            message: 'Starting review...',
            type: 'progress',
          });
        }

        if (progress.status === 'failed') {
          addCLIEntry({
            reviewer: reviewerType,
            message: 'Review failed',
            type: 'error',
          });
        }

        // Update the previous status ref
        previousStatusRef.current[reviewerType] = progress.status;
      }
    });

    // Check for completion (only call once)
    if (
      !hasCalledOnComplete.current &&
      (status?.status === 'complete' || status?.status === 'failed')
    ) {
      hasCalledOnComplete.current = true;
      onComplete();
    }
  }, [status, updateProgress, addCLIEntry, onComplete]);

  // Update store when status changes
  useEffect(() => {
    handleStatusUpdate();
  }, [handleStatusUpdate]);

  if (error) {
    return (
      <div
        className="p-6 bg-status-error/10 rounded-lg border border-status-error"
        data-testid="error-state"
      >
        <p className="text-status-error">
          Error fetching status: {error.message}
        </p>
      </div>
    );
  }

  if (isLoading && !status) {
    return (
      <div
        className="p-6 bg-bg-secondary rounded-lg border border-bg-tertiary animate-pulse"
        data-testid="loading-state"
      >
        <div className="h-4 bg-bg-tertiary rounded w-1/4 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-32 bg-bg-tertiary rounded" />
          <div className="h-32 bg-bg-tertiary rounded" />
          <div className="h-32 bg-bg-tertiary rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 p-6 bg-bg-secondary rounded-lg border border-bg-tertiary"
      data-testid="review-progress-panel"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          Review in Progress
        </h2>
        <TokenCostCounter
          tokensUsed={tokensUsed}
          estimatedCost={estimatedCost}
          isRunning={status?.status === 'in_progress'}
        />
      </div>

      <ThreeLaneView reviewers={Object.values(reviewerProgress)} />

      <CLIMimicView entries={cliEntries} maxLines={100} />
    </div>
  );
}

export default ReviewProgressPanel;
