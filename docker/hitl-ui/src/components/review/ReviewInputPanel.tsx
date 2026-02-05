/**
 * ReviewInputPanel Component (T04)
 *
 * Main input panel for configuring and starting a code review.
 * Combines TargetInput, ScopeSelector, ReviewerToggles, and CustomPathInput.
 */

import { useState, useCallback, useMemo } from 'react';
import Button from '../common/Button';
import { TargetInput } from './TargetInput';
import { ScopeSelector, type Scope } from './ScopeSelector';
import { ReviewerToggles, type ReviewerConfig } from './ReviewerToggles';
import { CustomPathInput } from './CustomPathInput';
import { validatePath } from './pathValidation';
import type { ReviewConfig } from '../../stores/reviewStore';

interface ReviewInputPanelProps {
  onStartReview: (config: ReviewConfig) => void;
  isLoading: boolean;
}

export function ReviewInputPanel({ onStartReview, isLoading }: ReviewInputPanelProps) {
  // Form state
  const [target, setTarget] = useState('');
  const [scope, setScope] = useState<Scope>('full_repo');
  const [customPath, setCustomPath] = useState('');
  const [reviewers, setReviewers] = useState<ReviewerConfig>({
    security: true,
    performance: true,
    style: true,
  });

  // Validation errors
  const [targetError, setTargetError] = useState<string | undefined>();
  const [customPathError, setCustomPathError] = useState<string | undefined>();

  // Derived validation state
  const hasEnabledReviewer = useMemo(
    () => Object.values(reviewers).some((v) => v),
    [reviewers]
  );

  const customPathValidationError = useMemo(
    () => (scope === 'custom_path' ? validatePath(customPath) : undefined),
    [scope, customPath]
  );

  const isValid = useMemo(() => {
    // Target is required
    if (!target.trim()) return false;

    // At least one reviewer must be enabled
    if (!hasEnabledReviewer) return false;

    // Custom path must be valid if scope is custom_path
    if (scope === 'custom_path') {
      if (!customPath.trim()) return false;
      if (customPathValidationError) return false;
    }

    return true;
  }, [target, hasEnabledReviewer, scope, customPath, customPathValidationError]);

  // Handle target change with validation
  const handleTargetChange = useCallback((value: string) => {
    setTarget(value);
    // Clear error when user starts typing
    if (targetError) {
      setTargetError(undefined);
    }
  }, [targetError]);

  // Handle custom path change
  const handleCustomPathChange = useCallback((value: string) => {
    setCustomPath(value);
    // Clear error when user starts typing
    if (customPathError) {
      setCustomPathError(undefined);
    }
  }, [customPathError]);

  // Handle scope change
  const handleScopeChange = useCallback((newScope: Scope) => {
    setScope(newScope);
    // Clear custom path error when switching away from custom_path
    if (newScope !== 'custom_path') {
      setCustomPathError(undefined);
    }
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(() => {
    // Validate before submitting
    let hasErrors = false;

    if (!target.trim()) {
      setTargetError('Target is required');
      hasErrors = true;
    }

    if (scope === 'custom_path' && !customPath.trim()) {
      setCustomPathError('Custom path is required');
      hasErrors = true;
    }

    if (hasErrors || !isValid) {
      return;
    }

    const config: ReviewConfig = {
      target: target.trim(),
      scope,
      customPath: scope === 'custom_path' ? customPath.trim() : undefined,
      reviewers,
    };

    onStartReview(config);
  }, [target, scope, customPath, reviewers, isValid, onStartReview]);

  return (
    <div
      className="space-y-6 p-6 bg-bg-secondary rounded-lg border border-bg-tertiary"
      data-testid="review-input-panel"
    >
      {/* Target Input */}
      <TargetInput
        value={target}
        onChange={handleTargetChange}
        error={targetError}
        disabled={isLoading}
      />

      {/* Scope Selector */}
      <ScopeSelector
        value={scope}
        onChange={handleScopeChange}
        disabled={isLoading}
      />

      {/* Custom Path (conditional) */}
      {scope === 'custom_path' && (
        <CustomPathInput
          value={customPath}
          onChange={handleCustomPathChange}
          error={customPathError}
          disabled={isLoading}
        />
      )}

      {/* Reviewer Toggles */}
      <ReviewerToggles
        value={reviewers}
        onChange={setReviewers}
        disabled={isLoading}
      />

      {/* Start Button */}
      <Button
        onClick={handleSubmit}
        disabled={!isValid || isLoading}
        loading={isLoading}
        variant="primary"
        className="w-full"
      >
        {isLoading ? 'Starting Review...' : 'Start Code Review'}
      </Button>
    </div>
  );
}

export default ReviewInputPanel;
