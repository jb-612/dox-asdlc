/**
 * AdminLabelsPage - Label taxonomy management page (P08-F03 T15)
 *
 * Features:
 * - List all labels in taxonomy
 * - Add new label form
 * - Edit label form (name, description, keywords, color)
 * - Delete with confirmation
 * - Color picker
 * - Preview badge
 * - Route: /admin/labels
 */

import { useState, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import {
  TagIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel } from '../api/classification';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import type { LabelDefinition } from '../types/classification';

export interface AdminLabelsPageProps {
  /** Custom class name */
  className?: string;
}

/**
 * Predefined colors for the color picker
 */
const COLOR_PALETTE = [
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6b7280', // Gray
];

/**
 * Form data for creating/editing a label
 */
interface LabelFormData {
  id: string;
  name: string;
  description: string;
  keywords: string;
  color: string;
}

/**
 * Initial form data
 */
const INITIAL_FORM_DATA: LabelFormData = {
  id: '',
  name: '',
  description: '',
  keywords: '',
  color: '#6b7280',
};

/**
 * AdminLabelsPage component
 */
export default function AdminLabelsPage({ className }: AdminLabelsPageProps) {
  const { data: labels, isLoading, error, refetch } = useLabels();
  const createLabelMutation = useCreateLabel();
  const updateLabelMutation = useUpdateLabel();
  const deleteLabelMutation = useDeleteLabel();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelDefinition | null>(null);
  const [formData, setFormData] = useState<LabelFormData>(INITIAL_FORM_DATA);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isEditing = editingLabel !== null;
  const isSaving = createLabelMutation.isPending || updateLabelMutation.isPending;
  const isDeleting = deleteLabelMutation.isPending;

  /**
   * Open form for creating a new label
   */
  const handleAddNew = useCallback(() => {
    setEditingLabel(null);
    setFormData(INITIAL_FORM_DATA);
    setIsFormOpen(true);
  }, []);

  /**
   * Open form for editing an existing label
   */
  const handleEdit = useCallback((label: LabelDefinition) => {
    setEditingLabel(label);
    setFormData({
      id: label.id,
      name: label.name,
      description: label.description || '',
      keywords: label.keywords.join(', '),
      color: label.color || '#6b7280',
    });
    setIsFormOpen(true);
  }, []);

  /**
   * Close the form
   */
  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingLabel(null);
    setFormData(INITIAL_FORM_DATA);
  }, []);

  /**
   * Handle form field changes
   */
  const handleFieldChange = useCallback(
    (field: keyof LabelFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  /**
   * Handle color selection
   */
  const handleColorSelect = useCallback((color: string) => {
    setFormData((prev) => ({ ...prev, color }));
  }, []);

  /**
   * Submit the form
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const labelData = {
        id: formData.id.trim().toLowerCase().replace(/\s+/g, '-') || undefined,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        keywords: formData.keywords
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean),
        color: formData.color,
      };

      try {
        if (isEditing) {
          await updateLabelMutation.mutateAsync({
            id: editingLabel.id,
            updates: labelData,
          });
        } else {
          await createLabelMutation.mutateAsync(labelData);
        }
        handleCloseForm();
      } catch (err) {
        // Error is handled by mutation state
        console.error('Failed to save label:', err);
      }
    },
    [formData, isEditing, editingLabel, createLabelMutation, updateLabelMutation, handleCloseForm]
  );

  /**
   * Initiate delete confirmation
   */
  const handleDeleteClick = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  /**
   * Cancel delete
   */
  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  /**
   * Confirm and execute delete
   */
  const handleDeleteConfirm = useCallback(
    async (id: string) => {
      try {
        await deleteLabelMutation.mutateAsync(id);
        setDeleteConfirmId(null);
      } catch (err) {
        console.error('Failed to delete label:', err);
      }
    },
    [deleteLabelMutation]
  );

  /**
   * Refresh labels
   */
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  /**
   * Generate ID from name
   */
  const generatedId = useMemo(() => {
    if (formData.id) return formData.id;
    return formData.name.trim().toLowerCase().replace(/\s+/g, '-');
  }, [formData.id, formData.name]);

  /**
   * Validate form
   */
  const isFormValid = useMemo(() => {
    return formData.name.trim().length > 0;
  }, [formData.name]);

  // Error state
  if (error && !isLoading) {
    return (
      <div
        data-testid="admin-labels-page"
        role="main"
        className={clsx('h-full flex flex-col bg-bg-primary', className)}
      >
        <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-purple/10">
                <TagIcon className="h-6 w-6 text-accent-purple" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">Label Taxonomy</h1>
                <p className="text-sm text-text-secondary mt-1">
                  Manage classification labels
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center" data-testid="error-state">
            <ExclamationTriangleIcon className="h-12 w-12 text-status-error mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Failed to load labels
            </h2>
            <p className="text-text-secondary mb-4">
              {(error as Error)?.message || 'Unable to connect to the backend API'}
            </p>
            <Button onClick={handleRefresh} data-testid="try-again-button">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="admin-labels-page"
      role="main"
      className={clsx('h-full flex flex-col bg-bg-primary', className)}
    >
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-purple/10">
              <TagIcon className="h-6 w-6 text-accent-purple" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Label Taxonomy</h1>
              <p className="text-sm text-text-secondary mt-1">
                Manage classification labels for ideas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              data-testid="refresh-button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              aria-label="Refresh labels"
            >
              <ArrowPathIcon className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
            </button>

            <Button
              data-testid="add-label-button"
              onClick={handleAddNew}
              disabled={isFormOpen}
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Label
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Add/Edit Form */}
          {isFormOpen && (
            <div
              className="mb-6 p-6 bg-bg-secondary rounded-lg border border-border-primary"
              data-testid="label-form"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-primary">
                  {isEditing ? 'Edit Label' : 'New Label'}
                </h2>
                <button
                  onClick={handleCloseForm}
                  className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                  aria-label="Close form"
                  data-testid="close-form-button"
                >
                  <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label
                    htmlFor="label-name"
                    className="block text-sm font-medium text-text-secondary mb-1"
                  >
                    Name *
                  </label>
                  <input
                    id="label-name"
                    type="text"
                    value={formData.name}
                    onChange={handleFieldChange('name')}
                    placeholder="e.g., Feature"
                    className={clsx(
                      'w-full px-3 py-2 rounded-lg',
                      'bg-bg-primary text-text-primary placeholder-text-muted',
                      'border border-border-primary focus:border-accent-blue focus:outline-none'
                    )}
                    data-testid="label-name-input"
                    required
                  />
                </div>

                {/* ID (auto-generated or custom) */}
                {!isEditing && (
                  <div>
                    <label
                      htmlFor="label-id"
                      className="block text-sm font-medium text-text-secondary mb-1"
                    >
                      ID (optional)
                    </label>
                    <input
                      id="label-id"
                      type="text"
                      value={formData.id}
                      onChange={handleFieldChange('id')}
                      placeholder={generatedId || 'auto-generated from name'}
                      className={clsx(
                        'w-full px-3 py-2 rounded-lg',
                        'bg-bg-primary text-text-primary placeholder-text-muted',
                        'border border-border-primary focus:border-accent-blue focus:outline-none'
                      )}
                      data-testid="label-id-input"
                    />
                    {generatedId && !formData.id && (
                      <p className="mt-1 text-xs text-text-muted">
                        Will be: {generatedId}
                      </p>
                    )}
                  </div>
                )}

                {/* Description */}
                <div>
                  <label
                    htmlFor="label-description"
                    className="block text-sm font-medium text-text-secondary mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="label-description"
                    value={formData.description}
                    onChange={handleFieldChange('description')}
                    placeholder="Brief description of when to use this label"
                    rows={2}
                    className={clsx(
                      'w-full px-3 py-2 rounded-lg resize-none',
                      'bg-bg-primary text-text-primary placeholder-text-muted',
                      'border border-border-primary focus:border-accent-blue focus:outline-none'
                    )}
                    data-testid="label-description-input"
                  />
                </div>

                {/* Keywords */}
                <div>
                  <label
                    htmlFor="label-keywords"
                    className="block text-sm font-medium text-text-secondary mb-1"
                  >
                    Keywords (comma-separated)
                  </label>
                  <input
                    id="label-keywords"
                    type="text"
                    value={formData.keywords}
                    onChange={handleFieldChange('keywords')}
                    placeholder="e.g., add, new, create, implement"
                    className={clsx(
                      'w-full px-3 py-2 rounded-lg',
                      'bg-bg-primary text-text-primary placeholder-text-muted',
                      'border border-border-primary focus:border-accent-blue focus:outline-none'
                    )}
                    data-testid="label-keywords-input"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Keywords help match ideas to this label
                  </p>
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Color
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2" data-testid="color-palette">
                      {COLOR_PALETTE.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleColorSelect(color)}
                          className={clsx(
                            'h-8 w-8 rounded-full border-2 transition-all',
                            formData.color === color
                              ? 'border-text-primary scale-110'
                              : 'border-transparent hover:scale-105'
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={`Select color ${color}`}
                          data-testid={`color-${color}`}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => handleColorSelect(e.target.value)}
                      className="h-8 w-8 cursor-pointer"
                      aria-label="Custom color picker"
                      data-testid="custom-color-picker"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Preview
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full border"
                      style={{
                        backgroundColor: `${formData.color}20`,
                        borderColor: `${formData.color}40`,
                        color: formData.color,
                      }}
                      data-testid="label-preview"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: formData.color }}
                      />
                      {formData.name || 'Label Name'}
                    </span>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-primary">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCloseForm}
                    disabled={isSaving}
                    data-testid="cancel-button"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isFormValid || isSaving}
                    data-testid="save-button"
                  >
                    {isSaving ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="h-4 w-4 mr-1" />
                        {isEditing ? 'Save Changes' : 'Create Label'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Labels List */}
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            <div className="px-4 py-3 border-b border-border-primary">
              <h2 className="font-medium text-text-primary">
                Labels ({labels?.length || 0})
              </h2>
            </div>

            {isLoading && (
              <div className="p-8 text-center" data-testid="loading-state">
                <Spinner size="lg" className="mx-auto mb-2" />
                <p className="text-text-muted">Loading labels...</p>
              </div>
            )}

            {!isLoading && labels?.length === 0 && (
              <div className="p-8 text-center text-text-muted" data-testid="empty-state">
                <TagIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No labels defined yet.</p>
                <button
                  onClick={handleAddNew}
                  className="text-accent-blue hover:underline mt-2"
                >
                  Add your first label
                </button>
              </div>
            )}

            {!isLoading && labels && labels.length > 0 && (
              <div className="divide-y divide-border-primary" data-testid="labels-list">
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className="px-4 py-3 flex items-center gap-4 hover:bg-bg-tertiary/50 transition-colors"
                    data-testid={`label-row-${label.id}`}
                  >
                    {/* Color dot and name */}
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: label.color || '#6b7280' }}
                      />
                      <span className="font-medium text-text-primary">{label.name}</span>
                    </div>

                    {/* ID */}
                    <div className="text-xs text-text-muted font-mono w-24">
                      {label.id}
                    </div>

                    {/* Description */}
                    <div className="flex-1 text-sm text-text-secondary truncate">
                      {label.description || '-'}
                    </div>

                    {/* Keywords */}
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {label.keywords.slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="px-1.5 py-0.5 text-xs bg-bg-tertiary text-text-muted rounded"
                        >
                          {kw}
                        </span>
                      ))}
                      {label.keywords.length > 3 && (
                        <span className="text-xs text-text-muted">
                          +{label.keywords.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {deleteConfirmId === label.id ? (
                        <>
                          <span className="text-xs text-text-secondary mr-2">Delete?</span>
                          <button
                            onClick={() => handleDeleteConfirm(label.id)}
                            disabled={isDeleting}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 transition-colors"
                            aria-label="Confirm delete"
                            data-testid={`confirm-delete-${label.id}`}
                          >
                            {isDeleting ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <CheckIcon className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={handleDeleteCancel}
                            className="p-1.5 hover:bg-bg-tertiary rounded text-text-secondary transition-colors"
                            aria-label="Cancel delete"
                            data-testid={`cancel-delete-${label.id}`}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(label)}
                            className="p-1.5 hover:bg-bg-tertiary rounded text-text-secondary transition-colors"
                            aria-label={`Edit ${label.name}`}
                            data-testid={`edit-${label.id}`}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(label.id)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 transition-colors"
                            aria-label={`Delete ${label.name}`}
                            data-testid={`delete-${label.id}`}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
