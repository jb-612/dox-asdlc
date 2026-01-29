/**
 * SubmitPRDButton - Submit button with maturity gate and confirmation (P05-F11 T12)
 *
 * Features:
 * - Disabled state below 80% maturity with tooltip explaining why
 * - Shows current maturity vs required (e.g., "65% / 80% required")
 * - Enabled state at 80%+ with "Submit for PRD" label
 * - Confirmation dialog before submission
 * - Loading spinner during submission
 * - Success/error feedback
 */

import { useState, useCallback } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { PRDSubmissionResult } from '../../../types/ideation';
import { SUBMIT_THRESHOLD } from '../../../types/ideation';

export interface SubmitPRDButtonProps {
  /** Current maturity score (0-100) */
  maturityScore: number;
  /** Callback to submit the PRD */
  onSubmit: () => Promise<PRDSubmissionResult>;
  /** Callback on successful submission */
  onSuccess?: (result: PRDSubmissionResult) => void;
  /** Callback on submission error */
  onError?: (error: string) => void;
  /** Custom maturity threshold (default: 80) */
  threshold?: number;
  /** Custom class name */
  className?: string;
}

type SubmitState = 'idle' | 'confirming' | 'loading' | 'success' | 'error';

export default function SubmitPRDButton({
  maturityScore,
  onSubmit,
  onSuccess,
  onError,
  threshold = SUBMIT_THRESHOLD,
  className,
}: SubmitPRDButtonProps) {
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [result, setResult] = useState<PRDSubmissionResult | null>(null);

  const isEnabled = maturityScore >= threshold;

  const handleButtonClick = useCallback(() => {
    if (!isEnabled) return;
    setState('confirming');
  }, [isEnabled]);

  const handleCancel = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const result = await onSubmit();

      if (result.success) {
        setState('success');
        setResult(result);
        onSuccess?.(result);
      } else {
        setState('error');
        setError(result.error || 'Submission failed');
        onError?.(result.error || 'Submission failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Submission failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [onSubmit, onSuccess, onError]);

  const handleRetry = useCallback(() => {
    handleConfirm();
  }, [handleConfirm]);

  return (
    <div data-testid="submit-prd-container" className={clsx('relative', className)}>
      {/* Maturity Indicator */}
      <div data-testid="maturity-indicator" className="mb-2 text-sm text-text-secondary">
        <span className={clsx(isEnabled ? 'text-status-success' : 'text-status-warning')}>
          {maturityScore}%
        </span>
        <span className="mx-1">/</span>
        <span>{threshold}% required</span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden mb-3">
        <div
          data-testid="maturity-progress"
          className={clsx(
            'h-full rounded-full transition-all duration-300',
            isEnabled ? 'bg-status-success' : 'bg-status-warning'
          )}
          style={{ width: `${maturityScore}%` }}
        />
      </div>

      {/* Submit Button */}
      <div className="relative">
        <button
          data-testid="submit-prd-button"
          onClick={handleButtonClick}
          onMouseEnter={() => !isEnabled && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          disabled={!isEnabled || state === 'loading'}
          aria-label={isEnabled ? 'Submit for PRD generation' : `Cannot submit. Maturity must reach ${threshold}%`}
          className={clsx(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
            isEnabled
              ? 'bg-status-success text-white hover:bg-status-success/90'
              : 'bg-bg-tertiary text-text-muted opacity-50 cursor-not-allowed'
          )}
        >
          <DocumentCheckIcon className="h-5 w-5" />
          Submit for PRD
        </button>

        {/* Disabled Tooltip */}
        {showTooltip && !isEnabled && (
          <div
            data-testid="disabled-tooltip"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg shadow-lg text-sm text-text-secondary whitespace-nowrap z-10"
          >
            Maturity must reach {threshold}% to submit
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-bg-secondary border-r border-b border-border-primary" />
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {state === 'confirming' && (
        <div
          data-testid="confirmation-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="bg-bg-primary border border-border-primary rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 id="confirm-title" className="text-lg font-semibold text-text-primary mb-2">
              Confirm Submission
            </h3>
            <p className="text-text-secondary mb-4">
              Submit your PRD for review with a maturity score of <strong>{maturityScore}%</strong>?
              This will create a HITL gate for approval.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                data-testid="cancel-submit"
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-submit"
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg bg-status-success text-white hover:bg-status-success/90 transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Dialog */}
      {state === 'loading' && (
        <div
          data-testid="confirmation-dialog"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="bg-bg-primary border border-border-primary rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3">
              <div data-testid="loading-spinner" role="status" aria-label="Submitting">
                <ArrowPathIcon className="h-6 w-6 text-accent-teal animate-spin" />
              </div>
              <span className="text-text-primary">Submitting...</span>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button
                data-testid="cancel-submit"
                onClick={handleCancel}
                disabled
                className="px-4 py-2 rounded-lg bg-bg-secondary text-text-muted cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-submit"
                disabled
                className="px-4 py-2 rounded-lg bg-status-success/50 text-white/50 cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Dialog */}
      {state === 'success' && (
        <div
          data-testid="success-message"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="bg-bg-primary border border-border-primary rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircleIcon className="h-8 w-8 text-status-success" />
              <div>
                <h3 className="text-lg font-semibold text-text-primary">PRD Submitted</h3>
                <p className="text-sm text-text-secondary">
                  Your PRD has been submitted for review.
                </p>
              </div>
            </div>
            {result?.gateId && (
              <p className="text-sm text-text-muted mb-4">
                Gate ID: <code className="bg-bg-secondary px-1 rounded">{result.gateId}</code>
              </p>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg bg-status-success text-white hover:bg-status-success/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Dialog */}
      {state === 'error' && (
        <div
          data-testid="error-message"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="bg-bg-primary border border-border-primary rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <ExclamationCircleIcon className="h-8 w-8 text-status-error" />
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Submission Failed</h3>
                <p className="text-sm text-status-error">{error}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                Close
              </button>
              <button
                data-testid="retry-submit"
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg bg-status-warning text-white hover:bg-status-warning/90 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
