/**
 * OutputQuickviewPanel - Displays output artifacts with quick actions
 */

import { useCallback } from 'react';
import {
  DocumentIcon,
  ArrowDownTrayIcon,
  BookmarkIcon,
  PaperAirplaneIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Validation status */
export type ValidationStatus = 'valid' | 'pending_review' | 'invalid';

/** Output artifact */
export interface OutputArtifact {
  /** Artifact ID */
  id: string;
  /** Artifact name */
  name: string;
  /** Artifact type */
  type: string;
  /** Validation status */
  status: ValidationStatus;
  /** Created timestamp */
  createdAt: string;
  /** Preview content */
  preview: string;
  /** Validation error (if invalid) */
  validationError?: string;
}

export interface OutputQuickviewPanelProps {
  /** Output artifacts */
  artifacts: OutputArtifact[];
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when artifact card is clicked */
  onArtifactClick?: (artifactId: string) => void;
  /** Callback when download is clicked */
  onDownload?: (artifactId: string) => void;
  /** Callback when save is clicked */
  onSave?: (artifactId: string) => void;
  /** Callback when submit is clicked */
  onSubmit?: (artifactId: string) => void;
  /** Callback when open is clicked */
  onOpen?: (artifactId: string) => void;
}

// Status icon mapping
const statusIcons: Record<ValidationStatus, typeof CheckCircleIcon> = {
  valid: CheckCircleIcon,
  pending_review: ClockIcon,
  invalid: XCircleIcon,
};

// Status colors
const statusColors: Record<ValidationStatus, string> = {
  valid: 'text-status-success',
  pending_review: 'text-status-warning',
  invalid: 'text-status-error',
};

// Status labels
const statusLabels: Record<ValidationStatus, string> = {
  valid: 'Valid',
  pending_review: 'Pending Review',
  invalid: 'Invalid',
};

export default function OutputQuickviewPanel({
  artifacts,
  isLoading = false,
  className,
  onArtifactClick,
  onDownload,
  onSave,
  onSubmit,
  onOpen,
}: OutputQuickviewPanelProps) {
  // Handle card click
  const handleCardClick = useCallback(
    (artifactId: string) => {
      onArtifactClick?.(artifactId);
    },
    [onArtifactClick]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, artifactId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(artifactId);
      }
    },
    [handleCardClick]
  );

  // Handle action click (prevent propagation to card)
  const handleAction = useCallback(
    (e: React.MouseEvent, callback?: (id: string) => void, artifactId?: string) => {
      e.stopPropagation();
      if (callback && artifactId) {
        callback(artifactId);
      }
    },
    []
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('p-4', className)} data-testid="quickview-loading">
        <div className="h-6 w-32 bg-bg-tertiary rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-32 bg-bg-tertiary rounded-lg animate-pulse"
              data-testid="artifact-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('p-4 flex flex-col h-full', className)}
      data-testid="output-quickview-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Outputs</h3>
        <span className="text-sm text-text-muted">
          <span data-testid="artifact-count">{artifacts.length}</span> artifact
          {artifacts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Artifacts */}
      <div className="flex-1 overflow-y-auto">
        {artifacts.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            No outputs yet. Start a conversation to generate artifacts.
          </div>
        ) : (
          <div className="space-y-3">
            {artifacts.map((artifact) => {
              const StatusIcon = statusIcons[artifact.status];
              const canSubmit = artifact.status === 'valid';

              return (
                <div
                  key={artifact.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCardClick(artifact.id)}
                  onKeyDown={(e) => handleKeyDown(e, artifact.id)}
                  className={clsx(
                    'p-3 rounded-lg border border-border-primary bg-bg-secondary',
                    'cursor-pointer hover:border-accent-blue transition-colors'
                  )}
                  data-testid={`artifact-${artifact.id}`}
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <DocumentIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
                    <span className="font-medium text-text-primary truncate flex-1">
                      {artifact.name}
                    </span>
                    <StatusIcon
                      className={clsx('h-4 w-4 flex-shrink-0', statusColors[artifact.status])}
                      data-testid={`status-${artifact.status}`}
                    />
                  </div>

                  {/* Preview */}
                  <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                    {artifact.preview}
                  </p>

                  {/* Validation error */}
                  {artifact.validationError && (
                    <div className="flex items-center gap-1 text-xs text-status-error mb-2">
                      <ExclamationTriangleIcon className="h-3 w-3 flex-shrink-0" />
                      {artifact.validationError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1 pt-2 border-t border-border-secondary">
                    <button
                      onClick={(e) => handleAction(e, onDownload, artifact.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-bg-tertiary transition-colors"
                      data-testid={`action-download-${artifact.id}`}
                      aria-label="Download"
                    >
                      <ArrowDownTrayIcon className="h-3 w-3" />
                      Download
                    </button>
                    <button
                      onClick={(e) => handleAction(e, onSave, artifact.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-bg-tertiary transition-colors"
                      data-testid={`action-save-${artifact.id}`}
                      aria-label="Save"
                    >
                      <BookmarkIcon className="h-3 w-3" />
                      Save
                    </button>
                    <button
                      onClick={(e) => canSubmit && handleAction(e, onSubmit, artifact.id)}
                      disabled={!canSubmit}
                      className={clsx(
                        'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
                        canSubmit
                          ? 'hover:bg-bg-tertiary'
                          : 'opacity-50 cursor-not-allowed'
                      )}
                      data-testid={`action-submit-${artifact.id}`}
                      aria-label="Submit"
                    >
                      <PaperAirplaneIcon className="h-3 w-3" />
                      Submit
                    </button>
                    <button
                      onClick={(e) => handleAction(e, onOpen, artifact.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-bg-tertiary transition-colors ml-auto"
                      data-testid={`action-open-${artifact.id}`}
                      aria-label="Open"
                    >
                      <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
