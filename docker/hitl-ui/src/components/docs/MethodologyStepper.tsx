/**
 * MethodologyStepper - Interactive stepper for aSDLC methodology stages
 *
 * Displays the 8 stages of the aSDLC methodology with navigation,
 * progress indicator, and detailed stage information.
 */

import { useState, useCallback } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Stage definition */
export interface Stage {
  /** Unique identifier */
  id: string;
  /** Stage name */
  name: string;
  /** Short description */
  description: string;
  /** Why this stage is important */
  why: string;
  /** Input artifacts/items */
  inputs: string[];
  /** Output artifacts/items */
  outputs: string[];
  /** Required approvals */
  approvals: string[];
  /** Common issues at this stage */
  issues: string[];
}

export interface MethodologyStepperProps {
  /** Stages to display */
  stages: Stage[];
  /** Initial stage to display */
  initialStage?: string;
  /** Compact mode (hides descriptions) */
  compact?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when stage changes */
  onStageChange?: (stageId: string) => void;
}

export default function MethodologyStepper({
  stages,
  initialStage,
  compact = false,
  className,
  onStageChange,
}: MethodologyStepperProps) {
  // Find initial stage index
  const initialIndex = initialStage ? stages.findIndex((s) => s.id === initialStage) : 0;
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, initialIndex));

  // Navigate to specific stage
  const goToStage = useCallback(
    (index: number) => {
      if (index >= 0 && index < stages.length) {
        setCurrentIndex(index);
        onStageChange?.(stages[index].id);
      }
    },
    [stages, onStageChange]
  );

  // Navigate to previous stage
  const prevStage = useCallback(() => {
    goToStage(currentIndex - 1);
  }, [currentIndex, goToStage]);

  // Navigate to next stage
  const nextStage = useCallback(() => {
    goToStage(currentIndex + 1);
  }, [currentIndex, goToStage]);

  // Handle keyboard navigation on stage indicators
  const handleStageKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goToStage(index);
      }
    },
    [goToStage]
  );

  // Handle global keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        nextStage();
      } else if (e.key === 'ArrowLeft') {
        prevStage();
      }
    },
    [nextStage, prevStage]
  );

  // Empty state
  if (stages.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center p-8 text-text-muted', className)} data-testid="methodology-stepper">
        <p>No stages available</p>
      </div>
    );
  }

  const currentStage = stages[currentIndex];
  const progress = ((currentIndex + 1) / stages.length) * 100;

  return (
    <div
      className={clsx('space-y-6', compact && 'compact', className)}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      data-testid="methodology-stepper"
    >
      {/* Stage indicators */}
      <div className="relative" role="tablist" data-testid="stage-indicators">
        <div className="flex items-center justify-between">
          {stages.map((stage, index) => {
            const isCurrent = index === currentIndex;
            const isCompleted = index < currentIndex;
            const isFuture = index > currentIndex;

            return (
              <div key={stage.id} className="flex items-center flex-1">
                {/* Stage indicator */}
                <button
                  className={clsx(
                    'relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold transition-colors',
                    isCurrent && 'bg-accent-teal border-accent-teal text-white',
                    isCompleted && 'bg-accent-teal border-accent-teal text-white',
                    isFuture && 'bg-bg-secondary border-border-primary text-text-muted hover:border-accent-teal/50'
                  )}
                  onClick={() => goToStage(index)}
                  onKeyDown={(e) => handleStageKeyDown(e, index)}
                  tabIndex={0}
                  role="tab"
                  aria-selected={isCurrent}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-testid={`stage-${stage.id}`}
                >
                  {isCompleted ? (
                    <CheckCircleIcon className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </button>

                {/* Connector line */}
                {index < stages.length - 1 && (
                  <div
                    className={clsx(
                      'flex-1 h-1 mx-2',
                      index < currentIndex ? 'bg-accent-teal' : 'bg-border-primary'
                    )}
                    data-testid="stage-connector"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Stage labels (hidden in compact mode) */}
        {!compact && (
          <div className="flex justify-between mt-2">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex-1 text-center px-1">
                <span
                  className={clsx(
                    'text-xs',
                    index === currentIndex ? 'text-accent-teal font-medium' : 'text-text-muted'
                  )}
                >
                  {stage.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-4" data-testid="progress-indicator">
        <span className="text-sm text-text-secondary">
          Stage {currentIndex + 1} of {stages.length}
        </span>
        <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden" data-testid="progress-bar">
          <div
            className="h-full bg-accent-teal transition-all duration-300"
            style={{ width: `${progress}%` }}
            data-testid="progress-bar-fill"
          />
        </div>
      </div>

      {/* Stage content */}
      <div
        className="bg-bg-secondary border border-border-primary rounded-lg p-6"
        data-testid="stage-content"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-text-primary">{currentStage.name}</h3>
            {!compact && (
              <p className="text-text-secondary mt-1">{currentStage.description}</p>
            )}
          </div>
          <span className="text-sm text-text-muted px-3 py-1 bg-bg-tertiary rounded-full">
            Stage {currentIndex + 1}
          </span>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Why */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
              <span className="text-accent-teal">Why</span>
            </h4>
            <p className="text-sm text-text-secondary">{currentStage.why}</p>
          </div>

          {/* Inputs */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
              <DocumentArrowDownIcon className="h-4 w-4 text-accent-blue" />
              Inputs
            </h4>
            <ul className="space-y-1">
              {currentStage.inputs.map((input, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                  <ArrowRightIcon className="h-3 w-3 text-text-muted" />
                  {input}
                </li>
              ))}
            </ul>
          </div>

          {/* Outputs */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
              <DocumentArrowUpIcon className="h-4 w-4 text-status-success" />
              Outputs
            </h4>
            <ul className="space-y-1">
              {currentStage.outputs.map((output, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                  <ArrowRightIcon className="h-3 w-3 text-text-muted" />
                  {output}
                </li>
              ))}
            </ul>
          </div>

          {/* Approvals (only if any) */}
          {currentStage.approvals.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                <ShieldCheckIcon className="h-4 w-4 text-accent-purple" />
                Approvals Required
              </h4>
              <ul className="space-y-1">
                {currentStage.approvals.map((approval, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                    <ArrowRightIcon className="h-3 w-3 text-text-muted" />
                    {approval}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Common Issues */}
          <div className={currentStage.approvals.length === 0 ? 'md:col-span-2' : ''}>
            <h4 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-status-warning" />
              Common Issues
            </h4>
            <ul className="space-y-1">
              {currentStage.issues.map((issue, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                  <ArrowRightIcon className="h-3 w-3 text-text-muted" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevStage}
          disabled={currentIndex === 0}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
            currentIndex === 0
              ? 'border-border-primary text-text-muted cursor-not-allowed'
              : 'border-border-primary text-text-secondary hover:bg-bg-tertiary'
          )}
          aria-label="Previous stage"
          data-testid="prev-button"
        >
          <ChevronLeftIcon className="h-5 w-5" />
          Previous
        </button>

        <button
          onClick={nextStage}
          disabled={currentIndex === stages.length - 1}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            currentIndex === stages.length - 1
              ? 'bg-bg-tertiary text-text-muted cursor-not-allowed'
              : 'bg-accent-teal text-white hover:bg-accent-teal/90'
          )}
          aria-label="Next stage"
          data-testid="next-button"
        >
          Next
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
