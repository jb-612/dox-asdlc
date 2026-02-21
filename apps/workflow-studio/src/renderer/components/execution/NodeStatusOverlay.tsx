import { memo } from 'react';
import type { NodeExecutionStatus } from '../../../shared/types/execution';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NodeStatusOverlayProps {
  status: NodeExecutionStatus;
}

// ---------------------------------------------------------------------------
// Status icon SVGs rendered inline to avoid external icon-library dependency.
// ---------------------------------------------------------------------------

function SpinnerIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4 animate-spin text-blue-400"
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
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function CheckmarkIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4 text-green-400"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FailedIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4 text-red-400"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function HourglassIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4 text-amber-400 animate-pulse"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M4 2a1 1 0 000 2h1v1a7 7 0 003.243 5.9L10 12l-1.757 1.1A7 7 0 005 19v1H4a1 1 0 100 2h12a1 1 0 100-2h-1v-1a7 7 0 00-3.243-5.9L10 12l1.757-1.1A7 7 0 0015 5V4h1a1 1 0 100-2H4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SkippedIcon(): JSX.Element {
  return (
    <svg
      className="w-4 h-4 text-gray-500"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M4 4a1 1 0 011-1h2a1 1 0 010 2H5a1 1 0 01-1-1zm8 0a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 5a1 1 0 011-1h2a1 1 0 110 2H5a1 1 0 01-1-1zm8 0a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Background color ring for the overlay badge
// ---------------------------------------------------------------------------

const STATUS_BG: Record<NodeExecutionStatus, string> = {
  pending: 'bg-gray-700',
  running: 'bg-blue-900/80',
  completed: 'bg-green-900/80',
  failed: 'bg-red-900/80',
  skipped: 'bg-gray-800',
  waiting_gate: 'bg-amber-900/80',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Small overlay badge rendered at the top-right corner of an execution node.
 * Shows an icon reflecting the node's execution status.
 *
 * Parent must use `position: relative` so this positions correctly.
 */
function NodeStatusOverlay({ status }: NodeStatusOverlayProps): JSX.Element | null {
  if (status === 'pending') return null;

  const icon = (() => {
    switch (status) {
      case 'running':
        return <SpinnerIcon />;
      case 'completed':
        return <CheckmarkIcon />;
      case 'failed':
        return <FailedIcon />;
      case 'waiting_gate':
        return <HourglassIcon />;
      case 'skipped':
        return <SkippedIcon />;
      default:
        return null;
    }
  })();

  return (
    <div
      className={`
        absolute -top-2 -right-2 z-20
        flex items-center justify-center
        w-6 h-6 rounded-full
        border border-gray-700 shadow-md
        ${STATUS_BG[status]}
      `}
    >
      {icon}
    </div>
  );
}

export default memo(NodeStatusOverlay);
