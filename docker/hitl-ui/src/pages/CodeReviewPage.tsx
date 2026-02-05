/**
 * Code Review Page - Main page for triggering and viewing parallel code reviews
 */

import { useState, useCallback } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useReviewStore, ReviewConfig } from '../stores/reviewStore';
import { useSwarmReview } from '../api/swarm';
import { ReviewFinding } from '../api/types';
import {
  ReviewInputPanel,
  ReviewProgressPanel,
  ReviewResultsPanel,
  GitHubIssueModal,
} from '../components/review';
import { downloadMarkdownReport, exportToPDF } from '../utils/reportExport';
import { copyFindingToClipboard } from '../utils/clipboardUtils';

type Phase = 'input' | 'progress' | 'results';

export function CodeReviewPage() {
  const [phase, setPhase] = useState<Phase>('input');
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueModalFindings, setIssueModalFindings] = useState<ReviewFinding[]>([]);
  const [issueModalMode, setIssueModalMode] = useState<'single' | 'bulk'>('single');

  const {
    currentSwarmId,
    results,
    selectedFindings,
    reset,
    setSwarmId,
    setPhase: setStorePhase,
    startReview,
  } = useReviewStore();

  const swarmMutation = useSwarmReview();

  const handleStartReview = useCallback(async (config: ReviewConfig) => {
    // Prepare the request
    const reviewerTypes = Object.entries(config.reviewers)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type);

    // Determine target path
    let targetPath = config.target;
    if (config.scope === 'custom_path' && config.customPath) {
      targetPath = config.customPath;
    }

    // Initialize the store
    startReview(config);

    try {
      // Trigger the swarm
      const response = await swarmMutation.mutateAsync({
        target_path: targetPath,
        reviewer_types: reviewerTypes as any[],
      });

      // Store the swarm ID and transition to progress
      setSwarmId(response.swarm_id);
      setStorePhase('running');
      setPhase('progress');
    } catch (error) {
      console.error('Failed to start review:', error);
      setStorePhase('error');
    }
  }, [swarmMutation, startReview, setSwarmId, setStorePhase]);

  const handleProgressComplete = useCallback(() => {
    setStorePhase('complete');
    setPhase('results');
  }, [setStorePhase]);

  const handleReset = useCallback(() => {
    reset();
    setPhase('input');
  }, [reset]);

  const handleCreateIssue = useCallback((finding: ReviewFinding) => {
    setIssueModalFindings([finding]);
    setIssueModalMode('single');
    setIssueModalOpen(true);
  }, []);

  const handleBulkCreateIssues = useCallback(() => {
    if (!results) return;

    // Get all selected findings
    const allFindings = [
      ...results.critical_findings,
      ...results.high_findings,
      ...results.medium_findings,
      ...results.low_findings,
      ...results.info_findings,
    ];

    const selected = allFindings.filter(f => selectedFindings.has(f.id));
    if (selected.length === 0) return;

    setIssueModalFindings(selected);
    setIssueModalMode('bulk');
    setIssueModalOpen(true);
  }, [results, selectedFindings]);

  const handleDownloadReport = useCallback((format: 'markdown' | 'pdf') => {
    if (!results) return;

    if (format === 'markdown') {
      downloadMarkdownReport(results);
    } else {
      exportToPDF(results);
    }
  }, [results]);

  const handleCopyFinding = useCallback(async (finding: ReviewFinding) => {
    const success = await copyFindingToClipboard(finding);
    if (success) {
      // TODO: Show toast notification
      console.log('Copied to clipboard');
    }
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border-primary bg-bg-secondary">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {phase !== 'input' && (
              <button
                onClick={handleReset}
                className="p-2 rounded hover:bg-bg-tertiary text-text-secondary"
                title="Start new review"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-text-primary">Code Review</h1>
              <p className="text-sm text-text-tertiary">
                {phase === 'input' && 'Configure and start a parallel code review'}
                {phase === 'progress' && 'Review in progress...'}
                {phase === 'results' && `Results for ${currentSwarmId}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {phase === 'input' && (
          <div className="max-w-2xl mx-auto">
            <ReviewInputPanel
              onStartReview={handleStartReview}
              isLoading={swarmMutation.isPending}
            />
          </div>
        )}

        {phase === 'progress' && currentSwarmId && (
          <div className="max-w-4xl mx-auto">
            <ReviewProgressPanel
              swarmId={currentSwarmId}
              onComplete={handleProgressComplete}
            />
          </div>
        )}

        {phase === 'results' && results && (
          <div className="max-w-4xl mx-auto">
            <ReviewResultsPanel
              onCreateIssue={handleCreateIssue}
              onBulkCreateIssues={handleBulkCreateIssues}
              onDownloadReport={handleDownloadReport}
            />
          </div>
        )}
      </main>

      {/* GitHub Issue Modal */}
      <GitHubIssueModal
        isOpen={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        findings={issueModalFindings}
        swarmId={currentSwarmId || ''}
        mode={issueModalMode}
      />
    </div>
  );
}

export default CodeReviewPage;
