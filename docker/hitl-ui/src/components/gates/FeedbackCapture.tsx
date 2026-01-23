/**
 * FeedbackCapture - Structured feedback form for HITL gate reviews
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Feedback tag types */
export type FeedbackTag = 'quality' | 'completeness' | 'scope' | 'style' | 'other';

/** Severity levels */
export type Severity = 'low' | 'medium' | 'high';

/** Feedback data structure */
export interface FeedbackData {
  /** Selected tags */
  tags: FeedbackTag[];
  /** Correction summary text */
  summary: string;
  /** Severity level */
  severity: Severity;
  /** Whether to consider for improvement */
  considerForImprovement: boolean;
  /** Review duration in seconds */
  durationSeconds: number;
}

export interface FeedbackCaptureProps {
  /** Whether feedback is optional */
  optional?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when feedback is submitted */
  onSubmit?: (feedback: FeedbackData) => void;
  /** Callback when feedback is skipped */
  onSkip?: () => void;
}

const feedbackTags: { id: FeedbackTag; label: string }[] = [
  { id: 'quality', label: 'Quality' },
  { id: 'completeness', label: 'Completeness' },
  { id: 'scope', label: 'Scope' },
  { id: 'style', label: 'Style' },
  { id: 'other', label: 'Other' },
];

const severityOptions: { id: Severity; label: string; color: string }[] = [
  { id: 'low', label: 'Low', color: 'bg-status-success' },
  { id: 'medium', label: 'Medium', color: 'bg-status-warning' },
  { id: 'high', label: 'High', color: 'bg-status-error' },
];

const MAX_SUMMARY_LENGTH = 500;

// Format duration as mm:ss
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function FeedbackCapture({
  optional = false,
  className,
  onSubmit,
  onSkip,
}: FeedbackCaptureProps) {
  const [selectedTags, setSelectedTags] = useState<Set<FeedbackTag>>(new Set());
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [considerForImprovement, setConsiderForImprovement] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const startTimeRef = useRef(Date.now());

  // Track review duration
  useEffect(() => {
    const interval = setInterval(() => {
      setDurationSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Toggle tag selection
  const handleToggleTag = useCallback((tagId: FeedbackTag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  // Handle tag keyboard
  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent, tagId: FeedbackTag) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggleTag(tagId);
      }
    },
    [handleToggleTag]
  );

  // Handle severity keyboard
  const handleSeverityKeyDown = useCallback(
    (e: React.KeyboardEvent, severityId: Severity) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setSeverity(severityId);
      }
    },
    []
  );

  // Handle summary change
  const handleSummaryChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_SUMMARY_LENGTH) {
      setSummary(value);
    }
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (summary.trim()) {
      onSubmit?.({
        tags: Array.from(selectedTags),
        summary: summary.trim(),
        severity,
        considerForImprovement,
        durationSeconds,
      });
    }
  }, [selectedTags, summary, severity, considerForImprovement, durationSeconds, onSubmit]);

  // Handle skip
  const handleSkip = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  const canSubmit = summary.trim().length > 0;

  return (
    <div
      className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)}
      data-testid="feedback-capture"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-accent-blue" />
          <span className="font-medium text-text-primary">
            Feedback {optional && <span className="text-text-muted font-normal">(Optional)</span>}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm text-text-muted">
          <ClockIcon className="h-4 w-4" />
          <span data-testid="review-duration">{formatDuration(durationSeconds)}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="mb-4">
        <p className="text-sm text-text-muted mb-2">Category Tags</p>
        <div className="flex flex-wrap gap-2">
          {feedbackTags.map((tag) => {
            const isSelected = selectedTags.has(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => handleToggleTag(tag.id)}
                onKeyDown={(e) => handleTagKeyDown(e, tag.id)}
                tabIndex={0}
                className={clsx(
                  'px-3 py-1 rounded-full text-sm transition-colors',
                  isSelected
                    ? 'bg-accent-blue text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:bg-bg-primary'
                )}
                data-testid={`tag-${tag.id}`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Correction Summary */}
      <div className="mb-4">
        <p className="text-sm text-text-muted mb-2">Correction Summary</p>
        <textarea
          value={summary}
          onChange={handleSummaryChange}
          placeholder="Describe the issue or correction needed..."
          aria-label="Correction summary"
          className="w-full h-24 px-3 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary text-sm resize-none focus:outline-none focus:border-accent-blue"
          data-testid="correction-summary"
        />
        <div className="flex justify-end text-xs text-text-muted mt-1">
          <span data-testid="char-count">{summary.length}</span>
          <span>/</span>
          <span data-testid="char-limit">{MAX_SUMMARY_LENGTH}</span>
        </div>
      </div>

      {/* Severity */}
      <div className="mb-4" data-testid="severity-selector">
        <p className="text-sm text-text-muted mb-2">Severity</p>
        <div className="flex gap-2">
          {severityOptions.map((option) => {
            const isSelected = severity === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setSeverity(option.id)}
                onKeyDown={(e) => handleSeverityKeyDown(e, option.id)}
                tabIndex={0}
                className={clsx(
                  'px-4 py-1.5 rounded text-sm font-medium transition-colors',
                  isSelected ? `${option.color} text-white` : 'bg-bg-tertiary text-text-secondary hover:bg-bg-primary'
                )}
                data-testid={`severity-${option.id}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Consider for Improvement */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={considerForImprovement}
            onChange={(e) => setConsiderForImprovement(e.target.checked)}
            className="rounded border-border-primary text-accent-blue focus:ring-accent-blue"
            data-testid="consider-improvement"
          />
          <span className="text-sm text-text-secondary">
            Consider for system improvement (Evaluator Agent)
          </span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-primary">
        {optional && (
          <button
            onClick={handleSkip}
            className="px-4 py-2 rounded text-sm text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
            data-testid="skip-feedback"
          >
            Skip
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded text-sm',
            canSubmit
              ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
              : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
          )}
          data-testid="submit-feedback"
        >
          <CheckIcon className="h-4 w-4" />
          Submit Feedback
        </button>
      </div>
    </div>
  );
}
