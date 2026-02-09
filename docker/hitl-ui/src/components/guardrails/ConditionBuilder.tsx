/**
 * ConditionBuilder - Visual editor for guideline conditions (P11-F01 T22)
 *
 * Allows editing the condition fields that determine when a guideline applies.
 * Each field is a list of strings (OR within the field, AND across fields).
 * Uses a reusable TagInput sub-component for the add/remove tag pattern.
 */

import { useState } from 'react';
import type { GuidelineCondition } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConditionBuilderProps {
  condition: GuidelineCondition;
  onChange: (condition: GuidelineCondition) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// TagInput sub-component (local helper, not exported)
// ---------------------------------------------------------------------------

function TagInput({
  label,
  values,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  values: string[] | null | undefined;
  onChange: (values: string[] | null) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const current = values ?? [];
    if (!current.includes(trimmed)) {
      onChange([...current, trimmed]);
    }
    setInput('');
  };

  const handleRemove = (index: number) => {
    const current = values ?? [];
    const updated = current.filter((_, i) => i !== index);
    onChange(updated.length > 0 ? updated : null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd();
    }
  };

  const testIdBase = label.toLowerCase().replace(/\s/g, '-');

  return (
    <div data-testid={`condition-${testIdBase}`}>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </label>
      <div className="flex flex-wrap gap-1 mb-1">
        {(values ?? []).map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs"
          >
            {v}
            {!disabled && (
              <button
                onClick={() => handleRemove(i)}
                className="hover:text-red-600"
                data-testid={`remove-${testIdBase}-${i}`}
              >
                x
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleAdd}
          placeholder={placeholder}
          className="w-full px-2 py-1 text-sm border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          data-testid={`input-${testIdBase}`}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition field definitions
// ---------------------------------------------------------------------------

interface ConditionFieldDef {
  key: keyof GuidelineCondition;
  label: string;
  placeholder: string;
}

const CONDITION_FIELDS: ConditionFieldDef[] = [
  { key: 'agents', label: 'Agents', placeholder: 'Add agent...' },
  { key: 'domains', label: 'Domains', placeholder: 'Add domain...' },
  { key: 'actions', label: 'Actions', placeholder: 'Add action...' },
  { key: 'paths', label: 'Paths', placeholder: 'Add path...' },
  { key: 'events', label: 'Events', placeholder: 'Add event...' },
  { key: 'gate_types', label: 'Gate Types', placeholder: 'Add gate type...' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConditionBuilder({
  condition,
  onChange,
  disabled,
}: ConditionBuilderProps) {
  const handleFieldChange = (key: keyof GuidelineCondition) => (values: string[] | null) => {
    onChange({ ...condition, [key]: values });
  };

  return (
    <div className="space-y-3" data-testid="condition-builder">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Conditions
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        AND logic across fields
      </p>
      {CONDITION_FIELDS.map(({ key, label, placeholder }) => (
        <TagInput
          key={key}
          label={label}
          values={condition[key]}
          onChange={handleFieldChange(key)}
          placeholder={placeholder}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export default ConditionBuilder;
