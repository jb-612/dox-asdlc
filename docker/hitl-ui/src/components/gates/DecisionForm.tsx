import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useGateDecision } from '@/api/gates';
import { Button } from '@/components/common';

interface DecisionFormProps {
  gateId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type DecisionType = 'approve' | 'reject' | null;

export default function DecisionForm({
  gateId,
  onSuccess,
  onCancel,
}: DecisionFormProps) {
  const navigate = useNavigate();
  const [decision, setDecision] = useState<DecisionType>(null);
  const [feedback, setFeedback] = useState('');
  const [reason, setReason] = useState('');

  const { mutate: submitDecision, isPending } = useGateDecision();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!decision) return;

    // For rejection, reason is required
    if (decision === 'reject' && !reason.trim()) {
      return;
    }

    submitDecision(
      {
        gate_id: gateId,
        decision: decision,
        decided_by: 'operator', // TODO: Get from auth context
        reason: decision === 'reject' ? reason : undefined,
        feedback: feedback || undefined,
      },
      {
        onSuccess: () => {
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

      {/* Reason (required for rejection) */}
      {decision === 'reject' && (
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
