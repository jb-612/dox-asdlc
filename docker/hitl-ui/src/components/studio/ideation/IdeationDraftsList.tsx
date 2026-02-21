/**
 * IdeationDraftsList - List of saved ideation session drafts (P05-F11 T19)
 *
 * Features:
 * - List saved drafts with name, date, maturity score
 * - "Resume" button to load draft into store
 * - "Delete" button with confirmation
 * - Empty state when no drafts
 * - Loading state
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DocumentDuplicateIcon,
  TrashIcon,
  ArrowPathIcon,
  PlayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
  ArchiveBoxIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { listIdeationDrafts, deleteIdeationDraft, loadIdeationDraft } from '../../../api/ideation';
import type { IdeationMessage, MaturityState, Requirement, ProjectStatus, SavedProject } from '../../../types/ideation';

export interface IdeationDraftsListProps {
  /** Callback when a draft is resumed */
  onResume: (data: {
    sessionId: string;
    projectName: string;
    messages: IdeationMessage[];
    maturity: MaturityState;
    requirements: Requirement[];
    status: ProjectStatus;
    dataSource: 'mock' | 'configured';
  }) => void;
  /** Whether to use mock data (from page-level toggle) */
  useMock?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Status badge configuration
 */
const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; bgColor: string; textColor: string; icon: React.ElementType }
> = {
  draft: {
    label: 'Draft',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    icon: DocumentTextIcon,
  },
  approved: {
    label: 'Approved',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: CheckCircleIcon,
  },
  in_build: {
    label: 'In Build',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: WrenchScrewdriverIcon,
  },
  closed: {
    label: 'Closed',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    icon: ArchiveBoxIcon,
  },
};

export default function IdeationDraftsList({
  onResume,
  useMock,
  className,
}: IdeationDraftsListProps) {
  // State
  const [drafts, setDrafts] = useState<SavedProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadingDraft, setLoadingDraft] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load drafts on mount and when refreshKey changes
  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listIdeationDrafts(useMock);
      setDrafts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drafts');
    } finally {
      setIsLoading(false);
    }
  }, [useMock]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts, refreshKey]);

  // Handler for manual refresh
  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Handle resume draft
  const handleResume = useCallback(
    async (draft: SavedProject) => {
      setLoadingDraft(draft.sessionId);
      try {
        const data = await loadIdeationDraft(draft.sessionId, useMock);
        if (data) {
          onResume({
            sessionId: draft.sessionId,
            projectName: data.projectName,
            messages: data.messages,
            maturity: data.maturity,
            requirements: data.requirements,
            status: data.status,
            dataSource: data.dataSource,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load draft');
      } finally {
        setLoadingDraft(null);
      }
    },
    [onResume, useMock]
  );

  // Handle delete draft
  const handleDelete = useCallback(async (sessionId: string) => {
    setDeleteError(null);
    try {
      await deleteIdeationDraft(sessionId);
      setDrafts((prev) => prev.filter((d) => d.sessionId !== sessionId));
      setDeleteConfirm(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete draft');
    }
  }, []);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get maturity color
  const getMaturityColor = (score: number) => {
    if (score >= 80) return 'text-status-success';
    if (score >= 50) return 'text-status-warning';
    return 'text-status-error';
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('flex flex-col', className)}
        data-testid="ideation-drafts-list"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-text-primary">Saved Drafts</h3>
        </div>
        <div className="space-y-3" data-testid="drafts-loading">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-bg-secondary rounded-lg p-4"
            >
              <div className="h-4 bg-bg-tertiary rounded w-1/3 mb-2" />
              <div className="h-3 bg-bg-tertiary rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && drafts.length === 0) {
    return (
      <div
        className={clsx('flex flex-col', className)}
        data-testid="ideation-drafts-list"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-text-primary">Saved Drafts</h3>
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1 text-text-muted hover:text-text-secondary"
            aria-label="Refresh drafts"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center p-8 text-center bg-bg-secondary rounded-lg">
          <ExclamationTriangleIcon className="h-12 w-12 text-status-error mb-3" />
          <p className="text-text-secondary">Failed to load drafts</p>
          <p className="text-sm text-text-muted mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (drafts.length === 0) {
    return (
      <div
        className={clsx('flex flex-col', className)}
        data-testid="ideation-drafts-list"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-text-primary">Saved Drafts</h3>
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1 text-text-muted hover:text-text-secondary"
            aria-label="Refresh drafts"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
        <div
          className="flex flex-col items-center justify-center p-8 text-center bg-bg-secondary rounded-lg"
          data-testid="empty-state"
        >
          <DocumentDuplicateIcon className="h-12 w-12 text-text-muted mb-3" />
          <p className="text-text-secondary">No saved drafts</p>
          <p className="text-sm text-text-muted mt-1">
            Start a new ideation session to create your first draft.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('flex flex-col', className)}
      data-testid="ideation-drafts-list"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-text-primary">Saved Drafts</h3>
          <span className="text-sm text-text-muted">({drafts.length} drafts)</span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="p-1 text-text-muted hover:text-text-secondary"
          aria-label="Refresh drafts"
        >
          <ArrowPathIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Error banner */}
      {deleteError && (
        <div className="mb-4 p-3 bg-status-error/10 border border-status-error/20 rounded-lg">
          <p className="text-sm text-status-error">Failed to delete: {deleteError}</p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="mb-4 p-4 bg-status-warning/10 border border-status-warning/20 rounded-lg">
          <p className="text-sm text-text-primary font-medium mb-2">Confirm Delete</p>
          <p className="text-sm text-text-secondary mb-3">
            Are you sure you want to delete this draft? This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleDelete(deleteConfirm)}
              className="px-3 py-1.5 text-sm bg-status-error text-white rounded hover:bg-status-error/90"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              className="px-3 py-1.5 text-sm border border-border-primary rounded hover:bg-bg-tertiary text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Drafts list */}
      <ul className="space-y-3" role="list">
        {drafts.map((draft) => {
          const statusConfig = STATUS_CONFIG[draft.status || 'draft'];
          const StatusIcon = statusConfig.icon;

          return (
            <li
              key={draft.sessionId}
              className="bg-bg-secondary rounded-lg p-4 border border-border-secondary hover:border-border-primary transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-medium text-text-primary truncate">
                      {draft.projectName}
                    </h4>
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        statusConfig.bgColor,
                        statusConfig.textColor
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={clsx('text-sm font-medium', getMaturityColor(draft.maturityScore))}>
                      {draft.maturityScore}% maturity
                    </span>
                    <span className="text-sm text-text-muted">
                      {formatDate(draft.lastModified)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    type="button"
                    onClick={() => handleResume(draft)}
                    disabled={loadingDraft === draft.sessionId}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    aria-label={`Resume ${draft.projectName}`}
                  >
                    <PlayIcon className="h-4 w-4" />
                    {loadingDraft === draft.sessionId ? 'Loading...' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(draft.sessionId)}
                    disabled={deleteConfirm === draft.sessionId}
                    className="p-1.5 text-text-muted hover:text-status-error disabled:opacity-50"
                    aria-label={`Delete ${draft.projectName}`}
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
