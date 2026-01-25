/**
 * ReindexButton - Button to trigger re-indexing with progress indicator
 *
 * Part of P05-F08 KnowledgeStore Search UI
 *
 * States:
 * - Idle: Shows "Re-index" button
 * - Running: Shows spinner with progress percentage
 * - Completed: Shows checkmark that fades back to button
 */

import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { useReindexStatus, useTriggerReindex } from '../../api/searchHooks';
import type { SearchBackendMode } from '../../api/types';

export interface ReindexButtonProps {
  /** Backend mode for API calls */
  mode?: SearchBackendMode;
  /** Custom class name */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

// Icons
function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

export default function ReindexButton({
  mode = 'mock',
  className,
  disabled = false,
}: ReindexButtonProps) {
  const [showComplete, setShowComplete] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<string>('idle');

  // Query reindex status
  const { data: status, isLoading: statusLoading } = useReindexStatus({
    mode,
    // Only poll when running or just started
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'running') return 1000;
      if (showComplete) return false;
      return 5000; // Slow poll when idle
    },
  });

  // Mutation to trigger reindex
  const { mutate: triggerReindex, isPending: isTriggering } = useTriggerReindex({
    mode,
  });

  // Handle completion animation
  useEffect(() => {
    if (previousStatus === 'running' && status?.status === 'completed') {
      setShowComplete(true);
      const timer = setTimeout(() => {
        setShowComplete(false);
      }, 3000); // Show checkmark for 3 seconds
      return () => clearTimeout(timer);
    }
    setPreviousStatus(status?.status || 'idle');
  }, [status?.status, previousStatus]);

  // Handle click
  const handleClick = useCallback(() => {
    if (status?.status === 'running' || isTriggering || showComplete) return;
    triggerReindex({});
  }, [status?.status, isTriggering, showComplete, triggerReindex]);

  // Determine current visual state
  const isRunning = status?.status === 'running' || isTriggering;
  const progress = status?.progress ?? 0;

  // Render completed state with checkmark
  if (showComplete) {
    return (
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg',
          'bg-green-500/20 text-green-400 border border-green-500/30',
          'transition-all duration-300',
          className
        )}
        data-testid="reindex-button-complete"
      >
        <div className="relative h-5 w-5">
          <div className="absolute inset-0 rounded-full border-2 border-green-400" />
          <CheckIcon className="h-5 w-5 text-green-400" />
        </div>
        <span className="text-sm font-medium">Indexed</span>
      </div>
    );
  }

  // Render running state with spinner
  if (isRunning) {
    return (
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg',
          'bg-accent-teal/20 text-accent-teal border border-accent-teal/30',
          'transition-all duration-300',
          className
        )}
        data-testid="reindex-button-running"
      >
        <SpinnerIcon className="h-4 w-4" />
        <span className="text-sm font-medium">
          {progress > 0 ? `${progress}%` : 'Starting...'}
        </span>
      </div>
    );
  }

  // Render idle state with button
  return (
    <button
      onClick={handleClick}
      disabled={disabled || statusLoading}
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg',
        'bg-bg-tertiary text-text-secondary border border-border-primary',
        'hover:bg-bg-tertiary/80 hover:text-text-primary',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:ring-offset-1 focus:ring-offset-bg-primary',
        (disabled || statusLoading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      aria-label="Re-index the knowledge store"
      data-testid="reindex-button"
    >
      <RefreshIcon className="h-4 w-4" />
      <span className="text-sm font-medium">Re-index</span>
    </button>
  );
}
