/**
 * ArtifactCard - Card component for displaying artifact previews
 */

import {
  DocumentTextIcon,
  DocumentIcon,
  CodeBracketIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  CloudArrowUpIcon,
  FolderOpenIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import Badge from './Badge';
import type { ArtifactType, ArtifactStatus } from '../../api/types';
import { formatBytes, formatRelativeTime } from '../../utils/formatters';

export interface ArtifactCardProps {
  /** Artifact ID */
  id: string;
  /** Artifact name/filename */
  name: string;
  /** Artifact type */
  type: ArtifactType;
  /** Validation/approval status */
  status: ArtifactStatus;
  /** File size in bytes */
  sizeBytes?: number;
  /** Creation timestamp */
  createdAt?: string;
  /** Creator (agent or user) */
  createdBy?: string;
  /** Preview text or content */
  preview?: string | null;
  /** Whether the card is selected */
  selected?: boolean;
  /** Show action buttons */
  showActions?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when card is clicked */
  onClick?: () => void;
  /** Callback for download action */
  onDownload?: () => void;
  /** Callback for save action */
  onSave?: () => void;
  /** Callback for submit action */
  onSubmit?: () => void;
  /** Callback for open/view action */
  onOpen?: () => void;
}

// Icon mapping for artifact types
const typeIcons: Record<ArtifactType, typeof DocumentIcon> = {
  file: DocumentTextIcon,
  diff: CodeBracketIcon,
  log: DocumentIcon,
  report: ChartBarIcon,
};

// Status to badge variant mapping
const statusVariants: Record<ArtifactStatus, 'success' | 'warning' | 'error' | 'pending' | 'info'> = {
  draft: 'pending',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'error',
};

// Status labels
const statusLabels: Record<ArtifactStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

// Status icons
const statusIcons: Record<ArtifactStatus, typeof CheckCircleIcon> = {
  draft: PencilSquareIcon,
  pending_review: ClockIcon,
  approved: CheckCircleIcon,
  rejected: XCircleIcon,
};

export default function ArtifactCard({
  id,
  name,
  type,
  status,
  sizeBytes,
  createdAt,
  createdBy,
  preview,
  selected = false,
  showActions = true,
  className,
  onClick,
  onDownload,
  onSave,
  onSubmit,
  onOpen,
}: ArtifactCardProps) {
  const TypeIcon = typeIcons[type];
  const StatusIcon = statusIcons[status];

  // Get file extension for display
  const extension = name.split('.').pop()?.toLowerCase() || '';

  // Handle action button click without triggering card click
  const handleAction = (
    e: React.MouseEvent,
    action?: () => void
  ) => {
    e.stopPropagation();
    action?.();
  };

  return (
    <div
      className={clsx(
        'artifact-card rounded-lg border transition-all',
        selected
          ? 'border-accent-teal bg-accent-teal/5'
          : 'border-border-primary bg-bg-secondary hover:border-border-secondary',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      data-testid="artifact-card"
      data-artifact-id={id}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border-secondary">
        {/* Type Icon */}
        <div
          className={clsx(
            'flex-shrink-0 p-2 rounded-lg',
            type === 'diff'
              ? 'bg-accent-purple/10 text-accent-purple'
              : type === 'report'
              ? 'bg-status-info/10 text-status-info'
              : type === 'log'
              ? 'bg-status-warning/10 text-status-warning'
              : 'bg-accent-teal/10 text-accent-teal'
          )}
        >
          <TypeIcon className="h-5 w-5" />
        </div>

        {/* Title & Meta */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-text-primary truncate" title={name}>
            {name}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
            {extension && (
              <span className="uppercase font-mono">{extension}</span>
            )}
            {sizeBytes !== undefined && (
              <>
                <span>•</span>
                <span>{formatBytes(sizeBytes)}</span>
              </>
            )}
            {createdAt && (
              <>
                <span>•</span>
                <span>{formatRelativeTime(createdAt)}</span>
              </>
            )}
          </div>
          {createdBy && (
            <div className="text-xs text-text-muted mt-1">
              by <span className="text-text-secondary">{createdBy}</span>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <Badge
          variant={statusVariants[status]}
          icon={StatusIcon}
          size="sm"
        >
          {statusLabels[status]}
        </Badge>
      </div>

      {/* Preview (if available) */}
      {preview && (
        <div className="px-4 py-3 bg-bg-tertiary/50">
          <pre className="text-xs text-text-secondary font-mono overflow-hidden whitespace-pre-wrap line-clamp-3">
            {preview}
          </pre>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2 px-4 py-3">
          {onOpen && (
            <button
              onClick={(e) => handleAction(e, onOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent-teal hover:bg-accent-teal/10 rounded transition-colors"
              aria-label="Open artifact"
            >
              <FolderOpenIcon className="h-4 w-4" />
              Open
            </button>
          )}
          {onDownload && (
            <button
              onClick={(e) => handleAction(e, onDownload)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary rounded transition-colors"
              aria-label="Download artifact"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download
            </button>
          )}
          {onSave && status === 'draft' && (
            <button
              onClick={(e) => handleAction(e, onSave)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary rounded transition-colors"
              aria-label="Save artifact"
            >
              <CloudArrowUpIcon className="h-4 w-4" />
              Save
            </button>
          )}
          {onSubmit && (status === 'draft' || status === 'rejected') && (
            <button
              onClick={(e) => handleAction(e, onSubmit)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-status-success hover:bg-status-success/10 rounded transition-colors ml-auto"
              aria-label="Submit for review"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Submit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
