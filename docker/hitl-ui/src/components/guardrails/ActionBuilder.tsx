/**
 * ActionBuilder - Visual editor for guideline action configuration (P11-F01 T23)
 *
 * Renders different input fields based on the selected action_type:
 * - instruction: textarea for instruction text
 * - tool_allow: tag-based tool pattern list for allowed tools
 * - tool_deny: tag-based tool pattern list for denied tools
 * - hitl_require: gate_type text input + instruction textarea
 * - custom: instruction textarea
 */

import { useState } from 'react';
import type { GuidelineAction, ActionType } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ActionBuilderProps {
  action: GuidelineAction;
  onChange: (action: GuidelineAction) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Action type options
// ---------------------------------------------------------------------------

const ACTION_TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'instruction', label: 'Instruction' },
  { value: 'tool_allow', label: 'Tool Allow' },
  { value: 'tool_deny', label: 'Tool Deny' },
  { value: 'hitl_require', label: 'HITL Require' },
  { value: 'custom', label: 'Custom' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Action types that use the instruction textarea. */
const INSTRUCTION_TYPES: ActionType[] = ['instruction', 'hitl_require', 'custom'];

function showInstruction(type: ActionType): boolean {
  return INSTRUCTION_TYPES.includes(type);
}

// ---------------------------------------------------------------------------
// TagInput sub-component (inline)
// ---------------------------------------------------------------------------

interface TagInputProps {
  tags: string[];
  testIdPrefix: string;
  inputTestId: string;
  containerTestId: string;
  placeholder?: string;
  disabled?: boolean;
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
}

function TagInput({
  tags,
  testIdPrefix,
  inputTestId,
  containerTestId,
  placeholder,
  disabled,
  onAdd,
  onRemove,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed && !tags.includes(trimmed)) {
        onAdd(trimmed);
        setInputValue('');
      }
    }
  };

  return (
    <div data-testid={containerTestId}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
              bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
          >
            {tag}
            <button
              type="button"
              data-testid={`${testIdPrefix}-remove-${index}`}
              disabled={disabled}
              onClick={() => onRemove(index)}
              className="ml-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Remove ${tag}`}
            >
              x
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        data-testid={inputTestId}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? 'Add tool pattern...'}
        className="w-full px-3 py-1.5 text-sm border rounded
          border-gray-300 dark:border-gray-600
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          placeholder-gray-400 dark:placeholder-gray-500
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionBuilder({ action, onChange, disabled }: ActionBuilderProps) {
  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as ActionType;
    onChange({
      action_type: newType,
      instruction: showInstruction(newType) ? (action.instruction ?? '') : null,
      tools_allowed: newType === 'tool_allow' ? (action.tools_allowed ?? []) : null,
      tools_denied: newType === 'tool_deny' ? (action.tools_denied ?? []) : null,
      gate_type: newType === 'hitl_require' ? (action.gate_type ?? '') : null,
    });
  };

  const handleInstructionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...action,
      instruction: e.target.value,
    });
  };

  const handleGateTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...action,
      gate_type: e.target.value,
    });
  };

  const handleToolAllowedAdd = (tag: string) => {
    onChange({
      ...action,
      tools_allowed: [...(action.tools_allowed ?? []), tag],
    });
  };

  const handleToolAllowedRemove = (index: number) => {
    const updated = [...(action.tools_allowed ?? [])];
    updated.splice(index, 1);
    onChange({
      ...action,
      tools_allowed: updated,
    });
  };

  const handleToolDeniedAdd = (tag: string) => {
    onChange({
      ...action,
      tools_denied: [...(action.tools_denied ?? []), tag],
    });
  };

  const handleToolDeniedRemove = (index: number) => {
    const updated = [...(action.tools_denied ?? [])];
    updated.splice(index, 1);
    onChange({
      ...action,
      tools_denied: updated,
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div data-testid="action-builder" className="space-y-3">
      {/* Section heading */}
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Action</h4>

      {/* Action type dropdown */}
      <label className="block">
        <span className="text-xs text-gray-500 dark:text-gray-400">Type</span>
        <select
          data-testid="action-type-select"
          value={action.action_type}
          onChange={handleTypeChange}
          disabled={disabled}
          className="mt-1 block w-full px-3 py-1.5 text-sm border rounded
            border-gray-300 dark:border-gray-600
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ACTION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* Instruction textarea (instruction, hitl_require, custom) */}
      {showInstruction(action.action_type) && (
        <label className="block">
          <span className="text-xs text-gray-500 dark:text-gray-400">Instruction</span>
          <textarea
            data-testid="action-instruction"
            value={action.instruction ?? ''}
            onChange={handleInstructionChange}
            disabled={disabled}
            rows={3}
            placeholder="Enter instruction text..."
            className="mt-1 block w-full px-3 py-1.5 text-sm border rounded
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              resize-y"
          />
        </label>
      )}

      {/* Tools allowed (tool_allow) */}
      {action.action_type === 'tool_allow' && (
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Tools Allowed</span>
          <div className="mt-1">
            <TagInput
              tags={action.tools_allowed ?? []}
              testIdPrefix="action-tools-allowed"
              inputTestId="action-tools-allowed-input"
              containerTestId="action-tools-allowed"
              placeholder="Add allowed tool pattern..."
              disabled={disabled}
              onAdd={handleToolAllowedAdd}
              onRemove={handleToolAllowedRemove}
            />
          </div>
        </div>
      )}

      {/* Tools denied (tool_deny) */}
      {action.action_type === 'tool_deny' && (
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Tools Denied</span>
          <div className="mt-1">
            <TagInput
              tags={action.tools_denied ?? []}
              testIdPrefix="action-tools-denied"
              inputTestId="action-tools-denied-input"
              containerTestId="action-tools-denied"
              placeholder="Add denied tool pattern..."
              disabled={disabled}
              onAdd={handleToolDeniedAdd}
              onRemove={handleToolDeniedRemove}
            />
          </div>
        </div>
      )}

      {/* Gate type (hitl_require) */}
      {action.action_type === 'hitl_require' && (
        <label className="block">
          <span className="text-xs text-gray-500 dark:text-gray-400">Gate Type</span>
          <input
            type="text"
            data-testid="action-gate-type"
            value={action.gate_type ?? ''}
            onChange={handleGateTypeChange}
            disabled={disabled}
            placeholder="e.g. deployment_approval"
            className="mt-1 block w-full px-3 py-1.5 text-sm border rounded
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>
      )}
    </div>
  );
}

export default ActionBuilder;
