import { useState, useEffect, useCallback } from 'react';
import type { ExecutionStatus } from '../../../shared/types/execution';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExecutionControlsProps {
  status: ExecutionStatus;
  startedAt: string;
  onPause?: () => void;
  onResume?: () => void;
  onStep?: () => void;
  onAbort?: () => void;
}

// ---------------------------------------------------------------------------
// Status indicator config
// ---------------------------------------------------------------------------

interface StatusIndicator {
  dotColor: string;
  label: string;
}

const STATUS_INDICATORS: Record<ExecutionStatus, StatusIndicator> = {
  pending: { dotColor: 'bg-gray-400', label: 'Pending' },
  running: { dotColor: 'bg-blue-400', label: 'Running' },
  paused: { dotColor: 'bg-yellow-400', label: 'Paused' },
  waiting_gate: { dotColor: 'bg-amber-400', label: 'Waiting for Gate' },
  completed: { dotColor: 'bg-green-400', label: 'Completed' },
  failed: { dotColor: 'bg-red-400', label: 'Failed' },
  aborted: { dotColor: 'bg-gray-500', label: 'Aborted' },
};

// ---------------------------------------------------------------------------
// Elapsed time helper
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${String(m).padStart(2, '0')}m`);
  parts.push(`${String(s).padStart(2, '0')}s`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Horizontal control bar at the top of the execution view.
 *
 * Provides play/pause toggle, step (disabled placeholder), abort with
 * confirmation, a colored status indicator, and a live elapsed time display.
 */
export default function ExecutionControls({
  status,
  startedAt,
  onPause,
  onResume,
  onStep,
  onAbort,
}: ExecutionControlsProps): JSX.Element {
  // ---- Elapsed time ticker ---------------------------------------------------

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();

    function tick() {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }

    tick();

    const isActive = status === 'running' || status === 'waiting_gate';
    if (!isActive) return;

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, status]);

  // ---- Abort confirmation ----------------------------------------------------

  const [confirmAbort, setConfirmAbort] = useState(false);

  const handleAbortClick = useCallback(() => {
    if (confirmAbort) {
      onAbort?.();
      setConfirmAbort(false);
    } else {
      setConfirmAbort(true);
    }
  }, [confirmAbort, onAbort]);

  // Reset confirmation when status changes
  useEffect(() => {
    setConfirmAbort(false);
  }, [status]);

  // ---- Derived state ---------------------------------------------------------

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isTerminal = status === 'completed' || status === 'failed' || status === 'aborted';
  const indicator = STATUS_INDICATORS[status];

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700">
      {/* Play / Pause toggle */}
      <button
        type="button"
        disabled={isTerminal}
        onClick={isRunning ? onPause : onResume}
        className={`
          flex items-center justify-center w-8 h-8 rounded-md
          transition-colors text-sm font-medium
          ${isTerminal
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : isRunning
              ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
              : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
          }
        `}
        title={isRunning ? 'Pause execution' : 'Resume execution'}
      >
        {isRunning ? (
          /* Pause icon */
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 4a1 1 0 011 0v12a1 1 0 01-2 0V4zm8 0a1 1 0 011 0v12a1 1 0 01-2 0V4z"
              clipRule="evenodd"
            />
            <rect x="5" y="4" width="3" height="12" rx="1" />
            <rect x="12" y="4" width="3" height="12" rx="1" />
          </svg>
        ) : (
          /* Play icon */
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Step button (disabled placeholder for future use) */}
      <button
        type="button"
        disabled
        className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-700 text-gray-500 cursor-not-allowed"
        title="Step (coming soon)"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M3 4a1 1 0 011.5-.87l6 3.5a1 1 0 010 1.74l-6 3.5A1 1 0 013 11V4zm10 0a1 1 0 012 0v12a1 1 0 01-2 0V4z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Abort button */}
      <button
        type="button"
        disabled={isTerminal}
        onClick={handleAbortClick}
        className={`
          flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium
          transition-colors
          ${isTerminal
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : confirmAbort
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
          }
        `}
        title={confirmAbort ? 'Click again to confirm abort' : 'Abort execution'}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
        {confirmAbort ? 'Confirm Abort' : 'Abort'}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${indicator.dotColor} ${status === 'running' ? 'animate-pulse' : ''}`} />
        <span className="text-xs text-gray-300 font-medium">{indicator.label}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-600" />

      {/* Elapsed time */}
      <span className="text-xs text-gray-400 font-mono tabular-nums min-w-[72px] text-right">
        {formatElapsed(elapsed)}
      </span>
    </div>
  );
}
