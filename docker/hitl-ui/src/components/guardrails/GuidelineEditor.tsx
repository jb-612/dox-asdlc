/**
 * GuidelineEditor - Form for creating or editing a guideline (P11-F01 T24)
 *
 * Integrates ConditionBuilder and ActionBuilder sub-components for
 * the condition and action sections. Supports both create and edit modes
 * with validation, optimistic-locking version conflict handling, and
 * loading state during save.
 */

import { useState, useCallback, useEffect } from 'react';
import { useCreateGuideline, useUpdateGuideline } from '@/api/guardrails';
import { ConditionBuilder } from './ConditionBuilder';
import { ActionBuilder } from './ActionBuilder';
import type {
  Guideline,
  GuidelineCategory,
  GuidelineCondition,
  GuidelineAction,
} from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GuidelineEditorProps {
  guideline?: Guideline | null;
  isCreating?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Category dropdown options
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: GuidelineCategory; label: string }[] = [
  { value: 'cognitive_isolation', label: 'Cognitive Isolation' },
  { value: 'tdd_protocol', label: 'TDD Protocol' },
  { value: 'hitl_gate', label: 'HITL Gate' },
  { value: 'tool_restriction', label: 'Tool Restriction' },
  { value: 'path_restriction', label: 'Path Restriction' },
  { value: 'commit_policy', label: 'Commit Policy' },
  { value: 'custom', label: 'Custom' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GuidelineEditor({
  guideline,
  isCreating,
  onSave,
  onCancel,
}: GuidelineEditorProps) {
  // -------------------------------------------------------------------------
  // Determine mode
  // -------------------------------------------------------------------------
  const isEditMode = !!guideline && !isCreating;

  // -------------------------------------------------------------------------
  // Form state
  // -------------------------------------------------------------------------
  const [name, setName] = useState(guideline?.name ?? '');
  const [description, setDescription] = useState(guideline?.description ?? '');
  const [category, setCategory] = useState<GuidelineCategory>(
    guideline?.category ?? 'custom'
  );
  const [priority, setPriority] = useState(guideline?.priority ?? 100);
  const [condition, setCondition] = useState<GuidelineCondition>(
    guideline?.condition ?? {}
  );
  const [action, setAction] = useState<GuidelineAction>(
    guideline?.action ?? { action_type: 'instruction', instruction: '' }
  );
  const [enabled, setEnabled] = useState(guideline?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Reset form state when guideline prop changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    setName(guideline?.name ?? '');
    setDescription(guideline?.description ?? '');
    setCategory(guideline?.category ?? 'custom');
    setPriority(guideline?.priority ?? 100);
    setCondition(guideline?.condition ?? {});
    setAction(guideline?.action ?? { action_type: 'instruction', instruction: '' });
    setEnabled(guideline?.enabled ?? true);
    setError(null);
  }, [guideline?.id, isCreating]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------
  const createMutation = useCreateGuideline();
  const updateMutation = useUpdateGuideline();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // -------------------------------------------------------------------------
  // Error clearing on form change
  // -------------------------------------------------------------------------
  const clearError = useCallback(() => {
    if (error) setError(null);
  }, [error]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    clearError();
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    clearError();
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value as GuidelineCategory);
    clearError();
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPriority(Number(e.target.value));
    clearError();
  };

  const handleConditionChange = (newCondition: GuidelineCondition) => {
    setCondition(newCondition);
    clearError();
  };

  const handleActionChange = (newAction: GuidelineAction) => {
    setAction(newAction);
    clearError();
  };

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------
  const validate = (): string | null => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return 'Name is required.';
    }
    if (trimmedName.length > 200) {
      return 'Name must be 200 characters or fewer.';
    }
    if (priority < 0 || priority > 1000) {
      return 'Priority must be between 0 and 1000.';
    }
    return null;
  };

  // -------------------------------------------------------------------------
  // Save handler
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      if (isEditMode && guideline) {
        await updateMutation.mutateAsync({
          id: guideline.id,
          body: {
            name,
            description,
            category,
            priority,
            enabled,
            condition,
            action,
            version: guideline.version,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name,
          description,
          category,
          priority,
          enabled,
          condition,
          action,
        });
      }
      onSave?.();
    } catch (err: unknown) {
      const response = (err as Record<string, unknown>)?.response as
        | { status?: number }
        | undefined;
      if (response?.status === 409) {
        setError(
          'Version conflict: this guideline was modified by another user. Please reload and try again.'
        );
      } else {
        setError('Failed to save guideline. Please try again.');
      }
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      data-testid="guideline-editor"
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3
          data-testid="editor-title"
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          {isEditMode ? 'Edit Guideline' : 'Create Guideline'}
        </h3>
        <button
          data-testid="editor-close-btn"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Close editor"
        >
          x
        </button>
      </div>

      {/* Form body */}
      <div className="p-4 space-y-4">
        {/* Name */}
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
          </span>
          <input
            type="text"
            data-testid="editor-name"
            value={name}
            onChange={handleNameChange}
            maxLength={200}
            placeholder="Guideline name"
            className="mt-1 block w-full px-3 py-2 text-sm border rounded
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {/* Description */}
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </span>
          <textarea
            data-testid="editor-description"
            value={description}
            onChange={handleDescriptionChange}
            rows={3}
            placeholder="Describe what this guideline does..."
            className="mt-1 block w-full px-3 py-2 text-sm border rounded
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500
              resize-y"
          />
        </label>

        {/* Category */}
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Category
          </span>
          <select
            data-testid="editor-category"
            value={category}
            onChange={handleCategoryChange}
            className="mt-1 block w-full px-3 py-2 text-sm border rounded
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* Priority */}
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Priority
          </span>
          <input
            type="number"
            data-testid="editor-priority"
            value={priority}
            onChange={handlePriorityChange}
            min={0}
            max={1000}
            className="mt-1 block w-full px-3 py-2 text-sm border rounded
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {/* Enabled */}
        <label className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enabled
          </span>
          <button
            type="button"
            data-testid="editor-enabled-toggle"
            onClick={() => { setEnabled(!enabled); clearError(); }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors
              ${enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
            role="switch"
            aria-checked={enabled}
            aria-label="Enable guideline"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </label>

        {/* Conditions */}
        <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
          <ConditionBuilder
            condition={condition}
            onChange={handleConditionChange}
          />
        </div>

        {/* Action */}
        <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
          <ActionBuilder action={action} onChange={handleActionChange} />
        </div>

        {/* Error banner */}
        {error && (
          <div
            data-testid="editor-error"
            className="px-3 py-2 text-sm text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded"
            role="alert"
          >
            {error}
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <button
          data-testid="editor-cancel-btn"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
            bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
            rounded hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          data-testid="editor-save-btn"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-white
            bg-blue-600 hover:bg-blue-700 rounded
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default GuidelineEditor;
