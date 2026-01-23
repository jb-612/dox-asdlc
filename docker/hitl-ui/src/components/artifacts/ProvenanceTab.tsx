/**
 * ProvenanceTab - Displays artifact creation provenance
 */

import { useCallback } from 'react';
import {
  CpuChipIcon,
  DocumentIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Run reference */
export interface ProducingRun {
  id: string;
  agent: string;
  cluster: string;
  startedAt: string;
  completedAt?: string;
  status: 'success' | 'failed' | 'running';
}

/** Input artifact reference */
export interface InputArtifact {
  id: string;
  name: string;
  type: string;
}

/** Gate reference */
export interface ApprovingGate {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedAt?: string;
  reviewer?: string;
}

/** Feedback item */
export interface FeedbackItem {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
}

/** Artifact provenance */
export interface ArtifactProvenance {
  producingRun: ProducingRun;
  inputArtifacts: InputArtifact[];
  approvingGate?: ApprovingGate;
  feedback: FeedbackItem[];
}

export interface ProvenanceTabProps {
  /** Provenance data */
  provenance: ArtifactProvenance | null;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when run link is clicked */
  onRunClick?: (runId: string) => void;
  /** Callback when artifact link is clicked */
  onArtifactClick?: (artifactId: string) => void;
  /** Callback when gate link is clicked */
  onGateClick?: (gateId: string) => void;
}

// Format timestamp
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Calculate duration
function formatDuration(start: string, end?: string): string {
  if (!end) return 'In progress';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMs = endDate.getTime() - startDate.getTime();
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Status badge styles
const runStatusStyles = {
  success: 'bg-status-success/10 text-status-success',
  failed: 'bg-status-error/10 text-status-error',
  running: 'bg-status-warning/10 text-status-warning',
};

const gateStatusStyles = {
  pending: 'bg-status-warning/10 text-status-warning',
  approved: 'bg-status-success/10 text-status-success',
  rejected: 'bg-status-error/10 text-status-error',
};

export default function ProvenanceTab({
  provenance,
  isLoading = false,
  className,
  onRunClick,
  onArtifactClick,
  onGateClick,
}: ProvenanceTabProps) {
  // Handle link click
  const handleLinkClick = useCallback(
    (
      e: React.MouseEvent | React.KeyboardEvent,
      callback?: (id: string) => void,
      id?: string
    ) => {
      if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (callback && id) {
        callback(id);
      }
    },
    []
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('p-4', className)} data-testid="provenance-loading">
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} data-testid="skeleton-section">
              <div className="h-6 w-32 bg-bg-tertiary rounded animate-pulse mb-3" />
              <div className="h-24 bg-bg-tertiary rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!provenance) {
    return (
      <div className={clsx('p-4', className)} data-testid="provenance-tab">
        <div className="flex items-center justify-center h-64 text-text-muted">
          No provenance data available
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full', className)} data-testid="provenance-tab">
      {/* Header */}
      <div className="p-4 border-b border-border-primary">
        <h3 className="text-lg font-semibold text-text-primary">Provenance</h3>
        <p className="text-sm text-text-muted mt-1">
          Track where this artifact came from and how it was approved
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Producing Run */}
        <section data-testid="producing-run">
          <h4 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
            <CpuChipIcon className="h-4 w-4 text-accent-blue" />
            Producing Run
          </h4>
          <div className="p-4 rounded-lg bg-bg-tertiary border border-border-primary">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={(e) => handleLinkClick(e, onRunClick, provenance.producingRun.id)}
                onKeyDown={(e) => handleLinkClick(e, onRunClick, provenance.producingRun.id)}
                className="flex items-center gap-1 text-accent-blue hover:underline font-mono text-sm"
                data-testid="run-link"
              >
                {provenance.producingRun.id}
                <ArrowTopRightOnSquareIcon className="h-3 w-3" />
              </button>
              <span
                className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  runStatusStyles[provenance.producingRun.status]
                )}
                data-testid="run-status"
              >
                {provenance.producingRun.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">Agent:</span>
                <span className="ml-2 text-text-primary">{provenance.producingRun.agent}</span>
              </div>
              <div>
                <span className="text-text-muted">Cluster:</span>
                <span className="ml-2 text-text-primary">{provenance.producingRun.cluster}</span>
              </div>
              <div>
                <span className="text-text-muted">Duration:</span>
                <span className="ml-2 text-text-primary" data-testid="run-duration">
                  {formatDuration(
                    provenance.producingRun.startedAt,
                    provenance.producingRun.completedAt
                  )}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Input Artifacts */}
        <section data-testid="input-artifacts">
          <h4 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
            <DocumentIcon className="h-4 w-4 text-accent-blue" />
            Input Artifacts
            <span className="text-text-muted">
              (<span data-testid="input-count">{provenance.inputArtifacts.length}</span>)
            </span>
          </h4>
          {provenance.inputArtifacts.length === 0 ? (
            <p className="text-sm text-text-muted">No input artifacts</p>
          ) : (
            <div className="space-y-2">
              {provenance.inputArtifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  onClick={() => onArtifactClick?.(artifact.id)}
                  className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary border border-border-primary hover:border-accent-blue cursor-pointer transition-colors"
                  data-testid={`input-${artifact.id}`}
                >
                  <span className="text-sm text-text-primary">{artifact.name}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded bg-bg-secondary text-text-muted"
                    data-testid="artifact-type"
                  >
                    {artifact.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Approving Gate */}
        <section data-testid="approving-gate">
          <h4 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
            <ShieldCheckIcon className="h-4 w-4 text-accent-blue" />
            Approval Gate
          </h4>
          {!provenance.approvingGate ? (
            <p className="text-sm text-text-muted">No gate approval required</p>
          ) : (
            <div className="p-4 rounded-lg bg-bg-tertiary border border-border-primary">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={(e) =>
                    handleLinkClick(e, onGateClick, provenance.approvingGate?.id)
                  }
                  onKeyDown={(e) =>
                    handleLinkClick(e, onGateClick, provenance.approvingGate?.id)
                  }
                  className="flex items-center gap-1 text-accent-blue hover:underline text-sm"
                  data-testid="gate-link"
                >
                  {provenance.approvingGate.name}
                  <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                </button>
                <span
                  className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                    gateStatusStyles[provenance.approvingGate.status]
                  )}
                  data-testid="gate-status"
                >
                  {provenance.approvingGate.status === 'approved' && (
                    <CheckCircleIcon className="h-3 w-3" />
                  )}
                  {provenance.approvingGate.status === 'pending' && (
                    <ClockIcon className="h-3 w-3" />
                  )}
                  {provenance.approvingGate.status === 'rejected' && (
                    <XCircleIcon className="h-3 w-3" />
                  )}
                  {provenance.approvingGate.status}
                </span>
              </div>
              {provenance.approvingGate.decidedAt && (
                <div className="text-sm text-text-muted">
                  <span>Reviewed by </span>
                  <span className="text-text-primary">{provenance.approvingGate.reviewer}</span>
                  <span> on </span>
                  <span data-testid="gate-time">
                    {formatTimestamp(provenance.approvingGate.decidedAt)}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Feedback */}
        <section data-testid="feedback-section">
          <h4 className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
            <ChatBubbleLeftRightIcon className="h-4 w-4 text-accent-blue" />
            Associated Feedback
            <span className="text-text-muted">
              (<span data-testid="feedback-count">{provenance.feedback.length}</span>)
            </span>
          </h4>
          {provenance.feedback.length === 0 ? (
            <p className="text-sm text-text-muted">No feedback associated</p>
          ) : (
            <div className="space-y-2">
              {provenance.feedback.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-bg-tertiary border border-border-primary"
                  data-testid={`feedback-${item.id}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded bg-bg-secondary text-text-muted capitalize"
                      data-testid="feedback-type"
                    >
                      {item.type}
                    </span>
                    <span className="text-xs text-text-muted">
                      {formatTimestamp(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary">{item.summary}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
