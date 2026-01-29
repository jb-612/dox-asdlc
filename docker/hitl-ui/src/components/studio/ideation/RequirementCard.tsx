/**
 * RequirementCard - Display extracted requirement with edit/delete (P05-F11 T10)
 *
 * Features:
 * - Requirement ID, description, type badge, priority badge
 * - Edit mode with inline form
 * - Delete button with confirmation dialog
 * - Category indicator
 * - Compact display that expands on click
 */

import { useState, useCallback } from 'react';
import {
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { Requirement, RequirementType, RequirementPriority } from '../../../types/ideation';

export interface RequirementCardProps {
  /** The requirement to display */
  requirement: Requirement;
  /** Callback when requirement is updated */
  onUpdate?: (id: string, updates: Partial<Requirement>) => void;
  /** Callback when requirement is deleted */
  onDelete?: (id: string) => void;
  /** Read-only mode (hides edit/delete) */
  readOnly?: boolean;
  /** Custom class name */
  className?: string;
}

// Type labels and styles
const TYPE_CONFIG: Record<RequirementType, { label: string; className: string }> = {
  functional: { label: 'Functional', className: 'bg-accent-blue text-white' },
  non_functional: { label: 'Non-Functional', className: 'bg-accent-purple text-white' },
  constraint: { label: 'Constraint', className: 'bg-accent-teal text-white' },
};

// Priority labels and styles
const PRIORITY_CONFIG: Record<RequirementPriority, { label: string; className: string }> = {
  must_have: { label: 'Must Have', className: 'bg-status-error text-white' },
  should_have: { label: 'Should Have', className: 'bg-status-warning text-black' },
  could_have: { label: 'Could Have', className: 'bg-status-info text-white' },
};

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  problem: 'Problem Statement',
  users: 'Target Users',
  functional: 'Functional',
  nfr: 'Non-Functional Requirements',
  scope: 'Scope & Constraints',
  success: 'Success Criteria',
  risks: 'Risks & Assumptions',
};

export default function RequirementCard({
  requirement,
  onUpdate,
  onDelete,
  readOnly = false,
  className,
}: RequirementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit form state
  const [editDescription, setEditDescription] = useState(requirement.description);
  const [editType, setEditType] = useState<RequirementType>(requirement.type);
  const [editPriority, setEditPriority] = useState<RequirementPriority>(requirement.priority);

  const typeConfig = TYPE_CONFIG[requirement.type];
  const priorityConfig = PRIORITY_CONFIG[requirement.priority];
  const categoryLabel = CATEGORY_LABELS[requirement.categoryId] || requirement.categoryId;

  // Format requirement ID for display
  const displayId = requirement.id.toUpperCase().replace(/^REQ[-_]?/i, 'REQ-');

  // Handle expand/collapse
  const handleToggleExpand = useCallback(() => {
    if (!isEditing) {
      setIsExpanded((prev) => !prev);
    }
  }, [isEditing]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggleExpand();
      }
    },
    [handleToggleExpand]
  );

  // Handle edit mode
  const handleStartEdit = useCallback(() => {
    setEditDescription(requirement.description);
    setEditType(requirement.type);
    setEditPriority(requirement.priority);
    setIsEditing(true);
  }, [requirement]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditDescription(requirement.description);
    setEditType(requirement.type);
    setEditPriority(requirement.priority);
  }, [requirement]);

  const handleSaveEdit = useCallback(() => {
    onUpdate?.(requirement.id, {
      description: editDescription,
      type: editType,
      priority: editPriority,
    });
    setIsEditing(false);
  }, [requirement.id, editDescription, editType, editPriority, onUpdate]);

  // Handle delete
  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    onDelete?.(requirement.id);
    setShowDeleteConfirm(false);
  }, [requirement.id, onDelete]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      data-testid={`requirement-card-${requirement.id}`}
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
      onClick={handleToggleExpand}
      onKeyDown={handleKeyDown}
      className={clsx(
        'border border-border-primary rounded-lg bg-bg-secondary',
        'transition-all duration-200 cursor-pointer',
        'hover:border-border-secondary',
        'focus:outline-none focus:ring-2 focus:ring-accent-blue',
        className
      )}
    >
      {/* Header - always visible */}
      <div
        data-testid={`requirement-header-${requirement.id}`}
        className="p-3 flex items-center gap-3"
      >
        {/* Expand/collapse icon */}
        <div className="text-text-muted">
          {isExpanded ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </div>

        {/* ID */}
        <span className="text-xs font-mono text-text-muted">{displayId}</span>

        {/* Description (truncated in compact view) */}
        <p className="flex-1 text-sm text-text-primary truncate">
          {requirement.description}
        </p>

        {/* Badges */}
        <div className="flex items-center gap-2">
          <span
            data-testid={`type-badge-${requirement.id}`}
            className={clsx(
              'px-2 py-0.5 text-xs font-medium rounded',
              typeConfig.className
            )}
          >
            {typeConfig.label}
          </span>
          <span
            data-testid={`priority-badge-${requirement.id}`}
            className={clsx(
              'px-2 py-0.5 text-xs font-medium rounded',
              priorityConfig.className
            )}
          >
            {priorityConfig.label}
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div
          data-testid={`requirement-details-${requirement.id}`}
          className="border-t border-border-primary p-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Edit mode */}
          {isEditing ? (
            <div
              data-testid={`requirement-edit-form-${requirement.id}`}
              className="space-y-4"
            >
              {/* Description input */}
              <div>
                <label
                  htmlFor={`edit-description-${requirement.id}`}
                  className="block text-sm font-medium text-text-secondary mb-1"
                >
                  Description
                </label>
                <textarea
                  id={`edit-description-${requirement.id}`}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className={clsx(
                    'w-full px-3 py-2 rounded-lg',
                    'bg-bg-primary border border-border-primary',
                    'text-text-primary text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-accent-blue'
                  )}
                  rows={3}
                />
              </div>

              {/* Type and Priority dropdowns */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label
                    htmlFor={`edit-type-${requirement.id}`}
                    className="block text-sm font-medium text-text-secondary mb-1"
                  >
                    Type
                  </label>
                  <select
                    id={`edit-type-${requirement.id}`}
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as RequirementType)}
                    className={clsx(
                      'w-full px-3 py-2 rounded-lg',
                      'bg-bg-primary border border-border-primary',
                      'text-text-primary text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-accent-blue'
                    )}
                  >
                    <option value="functional">Functional</option>
                    <option value="non_functional">Non-Functional</option>
                    <option value="constraint">Constraint</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label
                    htmlFor={`edit-priority-${requirement.id}`}
                    className="block text-sm font-medium text-text-secondary mb-1"
                  >
                    Priority
                  </label>
                  <select
                    id={`edit-priority-${requirement.id}`}
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as RequirementPriority)}
                    className={clsx(
                      'w-full px-3 py-2 rounded-lg',
                      'bg-bg-primary border border-border-primary',
                      'text-text-primary text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-accent-blue'
                    )}
                  >
                    <option value="must_have">Must Have</option>
                    <option value="should_have">Should Have</option>
                    <option value="could_have">Could Have</option>
                  </select>
                </div>
              </div>

              {/* Edit actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-lg',
                    'bg-bg-tertiary text-text-secondary',
                    'hover:bg-bg-primary transition-colors'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-lg',
                    'bg-accent-blue text-white',
                    'hover:bg-accent-blue/90 transition-colors'
                  )}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            /* View mode */
            <div className="space-y-4">
              {/* Full description */}
              <p className="text-sm text-text-primary">{requirement.description}</p>

              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span
                  data-testid={`category-indicator-${requirement.id}`}
                  className="flex items-center gap-1"
                >
                  <span className="font-medium">Category:</span> {categoryLabel}
                </span>
                <span>
                  <span className="font-medium">Created:</span>{' '}
                  {formatDate(requirement.createdAt)}
                </span>
              </div>

              {/* Actions */}
              {!readOnly && (
                <div className="flex justify-end gap-2 pt-2 border-t border-border-secondary">
                  <button
                    onClick={handleStartEdit}
                    aria-label="Edit requirement"
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg',
                      'text-text-secondary hover:text-text-primary',
                      'hover:bg-bg-tertiary transition-colors'
                    )}
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    aria-label="Delete requirement"
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg',
                      'text-status-error hover:text-status-error',
                      'hover:bg-status-error/10 transition-colors'
                    )}
                  >
                    <TrashIcon className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Delete confirmation dialog */}
          {showDeleteConfirm && (
            <div
              data-testid={`delete-confirmation-${requirement.id}`}
              className="mt-4 p-4 bg-status-error/10 border border-status-error/20 rounded-lg"
            >
              <p className="text-sm text-text-primary mb-3">
                Are you sure you want to delete this requirement?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelDelete}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-lg',
                    'bg-bg-tertiary text-text-secondary',
                    'hover:bg-bg-primary transition-colors'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-lg',
                    'bg-status-error text-white',
                    'hover:bg-status-error/90 transition-colors'
                  )}
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
