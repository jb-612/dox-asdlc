import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useGateDecision } from '@/api/gates';
import { useSubmitFeedback } from '@/api/feedback';
import type { FeedbackSubmission } from '@/api/feedback';
import { Button } from '@/components/common';
import FeedbackCapture, { type FeedbackData } from './FeedbackCapture';

interface DecisionFormProps {
  gateId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type DecisionType = 'approve' | 'reject' | null;
type SeverityType = 'critical' | 'major' | 'minor' | 'trivial';

const severityOptions: { value: SeverityType; label: string; description: string }[] = [
  { value: 'critical', label: 'Critical', description: 'Blocks release, must be fixed immediately' },
  { value: 'major', label: 'Major', description: 'Significant issue that should be addressed' },
  { value: 'minor', label: 'Minor', description: 'Small issue, can be fixed later' },
  { value: 'trivial', label: 'Trivial', description: 'Cosmetic or low-impact issue' },
];

export default function DecisionForm({
  gateId,
  onSuccess,
  onCancel,
}: DecisionFormProps) {
  const navigate = useNavigate();
  const [decision, setDecision] = useState<DecisionType>(null);
  const [feedback, setFeedback] = useState('');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState<SeverityType>('major');
  const [showFeedbackCapture, setShowFeedbackCapture] = useState(false);
  const [structuredFeedback, setStructuredFeedback] = useState<FeedbackData | null>(null);
  const startTimeRef = useRef(Date.now());

  const { mutate: submitDecision, isPending } = useGateDecision();
  const { mutate: submitFeedback } = useSubmitFeedback();

  // Handle structured feedback from FeedbackCapture
  const handleFeedbackSubmit = useCallback((data: FeedbackData) => {
    setStructuredFeedback(data);
    setShowFeedbackCapture(false);
  }, []);

  const handleFeedbackSkip = useCallback(() => {
    setShowFeedbackCapture(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!decision) return;

    // For rejection, reason is required
    if (decision === 'reject' && !reason.trim()) {
      return;
    }

    // Calculate review duration
    const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);

    // Build reason with severity info for rejection
    const reasonWithSeverity = decision === 'reject' && reason
      ? `[${severity.toUpperCase()}] ${reason}`
      : undefined;

    submitDecision(
      {
        gate_id: gateId,
        decision: decision,
        decided_by: 'operator', // TODO: Get from auth context
        reason: reasonWithSeverity,
        feedback: feedback || undefined,
      },
      {
        onSuccess: () => {
          // Submit structured feedback if available
          if (structuredFeedback) {
            const feedbackPayload: FeedbackSubmission = {
              gateId,
              decision: decision === 'approve' ? 'approved' : 'rejected',
              tags: structuredFeedback.tags,
              summary: structuredFeedback.summary,
              severity: structuredFeedback.severity,
              considerForImprovement: structuredFeedback.considerForImprovement,
              durationSeconds: structuredFeedback.durationSeconds || durationSeconds,
              reviewerComment: feedback || undefined,
            };
            submitFeedback(feedbackPayload);
          }
          onSuccess?.();
          navigate('/gates');
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Decision Selection */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-3">
          Decision
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDecision('approve')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
              decision === 'approve'
                ? 'border-status-success bg-status-success/10 text-status-success'
                : 'border-bg-tertiary bg-bg-tertiary/50 text-text-secondary hover:border-status-success/50'
            }`}
          >
            <CheckIcon className="h-5 w-5" />
            <span className="font-medium">Approve</span>
          </button>
          <button
            type="button"
            onClick={() => setDecision('reject')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
              decision === 'reject'
                ? 'border-status-error bg-status-error/10 text-status-error'
                : 'border-bg-tertiary bg-bg-tertiary/50 text-text-secondary hover:border-status-error/50'
            }`}
          >
            <XMarkIcon className="h-5 w-5" />
            <span className="font-medium">Reject</span>
          </button>
        </div>
      </div>

      {/* Rejection Details */}
      {decision === 'reject' && (
        <div className="space-y-4">
          {/* Severity Selection */}
          <div>
            <label
              htmlFor="severity"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Severity <span className="text-status-error">*</span>
            </label>
            <select
              id="severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityType)}
              className="input-field w-full"
              data-testid="severity-select"
            >
              {severityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} - {opt.description}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label
              htmlFor="reason"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Reason for Rejection <span className="text-status-error">*</span>
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this gate request is being rejected..."
              className="input-field w-full resize-none"
              required
            />
            <p className="mt-1 text-xs text-text-tertiary">
              This will be shared with the submitting agent.
            </p>
          </div>
        </div>
      )}

      {/* Optional Feedback */}
      <div>
        <label
          htmlFor="feedback"
          className="block text-sm font-medium text-text-primary mb-2"
        >
          Additional Feedback{' '}
          <span className="text-text-tertiary">(optional)</span>
        </label>
        <textarea
          id="feedback"
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Any additional notes or feedback..."
          className="input-field w-full resize-none"
        />
      </div>

      {/* Structured Feedback Capture */}
      <div className="border-t border-bg-tertiary pt-4">
        <button
          type="button"
          onClick={() => setShowFeedbackCapture(!showFeedbackCapture)}
          className="flex items-center gap-2 text-sm text-accent-blue hover:text-accent-blue/80 transition-colors"
          data-testid="toggle-feedback-capture"
        >
          {showFeedbackCapture ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
          {structuredFeedback
            ? 'Feedback captured - click to edit'
            : 'Add structured feedback for system improvement'}
        </button>

        {showFeedbackCapture && (
          <div className="mt-4">
            <FeedbackCapture
              optional
              onSubmit={handleFeedbackSubmit}
              onSkip={handleFeedbackSkip}
            />
          </div>
        )}

        {structuredFeedback && !showFeedbackCapture && (
          <div className="mt-2 p-3 bg-bg-tertiary rounded-lg text-sm" data-testid="feedback-summary">
            <div className="flex flex-wrap gap-2 mb-2">
              {structuredFeedback.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-accent-blue/20 text-accent-blue rounded-full text-xs"
                >
                  {tag}
                </span>
              ))}
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                structuredFeedback.severity === 'high'
                  ? 'bg-status-error/20 text-status-error'
                  : structuredFeedback.severity === 'medium'
                  ? 'bg-status-warning/20 text-status-warning'
                  : 'bg-status-success/20 text-status-success'
              }`}>
                {structuredFeedback.severity} severity
              </span>
            </div>
            <p className="text-text-secondary line-clamp-2">{structuredFeedback.summary}</p>
            {structuredFeedback.considerForImprovement && (
              <p className="text-xs text-accent-blue mt-1">
                Marked for system improvement
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-bg-tertiary">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel || (() => navigate('/gates'))}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant={decision === 'approve' ? 'success' : decision === 'reject' ? 'danger' : 'primary'}
          loading={isPending}
          disabled={!decision || (decision === 'reject' && !reason.trim())}
        >
          {isPending
            ? 'Submitting...'
            : decision === 'approve'
            ? 'Confirm Approval'
            : decision === 'reject'
            ? 'Confirm Rejection'
            : 'Select Decision'}
        </Button>
      </div>
    </form>
  );
}
