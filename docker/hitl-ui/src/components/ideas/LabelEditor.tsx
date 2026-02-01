/**
 * LabelEditor - Component for editing labels on an idea (P08-F03 T14)
 *
 * Features:
 * - Display current labels as badges
 * - Add label button with picker dropdown
 * - Search/filter in picker
 * - Remove label (x) button
 * - Auto-assigned vs manual indicator
 * - Taxonomy-aware suggestions
 * - Keyboard navigation
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { PlusIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { LabelDefinition } from '../../types/classification';
import { DEFAULT_LABELS } from '../../types/classification';

export interface LabelEditorProps {
  /** Currently assigned label IDs */
  labels: string[];
  /** Label IDs that were auto-assigned by classification */
  autoAssignedLabels?: string[];
  /** Available labels from taxonomy */
  availableLabels?: LabelDefinition[];
  /** Callback when labels change */
  onChange: (labels: string[]) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Whether to allow adding custom labels not in taxonomy */
  allowCustomLabels?: boolean;
  /** Placeholder text when no labels */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Maximum number of labels allowed */
  maxLabels?: number;
}

/**
 * Get color for a label, defaulting to gray if not found
 */
function getLabelColor(labelId: string, availableLabels: LabelDefinition[]): string {
  const label = availableLabels.find((l) => l.id === labelId);
  return label?.color || '#6b7280';
}

/**
 * Get display name for a label
 */
function getLabelName(labelId: string, availableLabels: LabelDefinition[]): string {
  const label = availableLabels.find((l) => l.id === labelId);
  return label?.name || labelId;
}

/**
 * LabelEditor component
 */
export function LabelEditor({
  labels,
  autoAssignedLabels = [],
  availableLabels = DEFAULT_LABELS,
  onChange,
  readOnly = false,
  allowCustomLabels = false,
  placeholder = 'No labels',
  className,
  maxLabels = 10,
}: LabelEditorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Filter available labels based on search and already selected
  const filteredLabels = useMemo(() => {
    const notSelected = availableLabels.filter((l) => !labels.includes(l.id));
    if (!searchQuery.trim()) {
      return notSelected;
    }
    const query = searchQuery.toLowerCase();
    return notSelected.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        l.id.toLowerCase().includes(query) ||
        l.description?.toLowerCase().includes(query) ||
        l.keywords.some((k) => k.toLowerCase().includes(query))
    );
  }, [availableLabels, labels, searchQuery]);

  // Check if custom label can be added
  const canAddCustomLabel = useMemo(() => {
    if (!allowCustomLabels || !searchQuery.trim()) return false;
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return !availableLabels.some((l) => l.id.toLowerCase() === normalizedQuery);
  }, [allowCustomLabels, searchQuery, availableLabels]);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
        setSearchQuery('');
      }
    }

    if (isPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isPickerOpen]);

  // Focus search input when picker opens
  useEffect(() => {
    if (isPickerOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isPickerOpen]);

  // Reset highlighted index when filtered labels change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredLabels]);

  const handleAddLabel = useCallback(
    (labelId: string) => {
      if (labels.length >= maxLabels) return;
      if (!labels.includes(labelId)) {
        onChange([...labels, labelId]);
      }
      setIsPickerOpen(false);
      setSearchQuery('');
      addButtonRef.current?.focus();
    },
    [labels, onChange, maxLabels]
  );

  const handleRemoveLabel = useCallback(
    (labelId: string) => {
      onChange(labels.filter((l) => l !== labelId));
    },
    [labels, onChange]
  );

  const handleTogglePicker = useCallback(() => {
    setIsPickerOpen((prev) => !prev);
    setSearchQuery('');
    setHighlightedIndex(0);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isPickerOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsPickerOpen(true);
        }
        return;
      }

      const totalItems = filteredLabels.length + (canAddCustomLabel ? 1 : 0);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex < filteredLabels.length) {
            handleAddLabel(filteredLabels[highlightedIndex].id);
          } else if (canAddCustomLabel) {
            handleAddLabel(searchQuery.trim());
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsPickerOpen(false);
          setSearchQuery('');
          addButtonRef.current?.focus();
          break;
      }
    },
    [isPickerOpen, filteredLabels, highlightedIndex, canAddCustomLabel, searchQuery, handleAddLabel]
  );

  const isAutoAssigned = useCallback(
    (labelId: string) => autoAssignedLabels.includes(labelId),
    [autoAssignedLabels]
  );

  const canAddMore = labels.length < maxLabels;

  return (
    <div className={clsx('relative', className)} data-testid="label-editor">
      {/* Current Labels */}
      <div className="flex flex-wrap gap-2 items-center">
        {labels.length === 0 && !readOnly && (
          <span className="text-sm text-text-muted">{placeholder}</span>
        )}

        {labels.map((labelId) => {
          const color = getLabelColor(labelId, availableLabels);
          const name = getLabelName(labelId, availableLabels);
          const isAuto = isAutoAssigned(labelId);

          return (
            <span
              key={labelId}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                'border transition-colors'
              )}
              style={{
                backgroundColor: `${color}20`,
                borderColor: `${color}40`,
                color: color,
              }}
              data-testid={`label-${labelId}`}
            >
              {isAuto && (
                <SparklesIcon
                  className="h-3 w-3"
                  title="Auto-assigned by classification"
                  aria-label="Auto-assigned"
                  data-testid={`label-auto-${labelId}`}
                />
              )}
              <span>{name}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveLabel(labelId)}
                  className="ml-0.5 hover:opacity-70 transition-opacity"
                  aria-label={`Remove ${name} label`}
                  data-testid={`remove-label-${labelId}`}
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}

        {/* Add Label Button */}
        {!readOnly && canAddMore && (
          <button
            ref={addButtonRef}
            type="button"
            onClick={handleTogglePicker}
            onKeyDown={handleKeyDown}
            className={clsx(
              'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
              'border border-dashed border-border-primary',
              'text-text-secondary hover:text-text-primary hover:border-border-secondary',
              'transition-colors focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-1'
            )}
            aria-label="Add label"
            aria-haspopup="listbox"
            aria-expanded={isPickerOpen}
            data-testid="add-label-button"
          >
            <PlusIcon className="h-3 w-3" />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Label Picker Dropdown */}
      {isPickerOpen && (
        <div
          ref={pickerRef}
          className={clsx(
            'absolute z-50 mt-2 w-64 max-h-72 overflow-hidden',
            'bg-bg-primary rounded-lg shadow-lg border border-border-primary',
            'flex flex-col'
          )}
          role="listbox"
          data-testid="label-picker"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border-primary">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search labels..."
              className={clsx(
                'w-full px-3 py-1.5 text-sm rounded-md',
                'bg-bg-secondary text-text-primary placeholder-text-muted',
                'border border-border-primary focus:border-accent-blue focus:outline-none'
              )}
              aria-label="Search labels"
              data-testid="label-search-input"
            />
          </div>

          {/* Label Options */}
          <div className="overflow-y-auto flex-1">
            {filteredLabels.length === 0 && !canAddCustomLabel && (
              <div className="p-3 text-sm text-text-muted text-center">
                No matching labels
              </div>
            )}

            {filteredLabels.map((label, index) => (
              <button
                key={label.id}
                type="button"
                onClick={() => handleAddLabel(label.id)}
                className={clsx(
                  'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                  'hover:bg-bg-tertiary transition-colors',
                  index === highlightedIndex && 'bg-bg-tertiary'
                )}
                role="option"
                aria-selected={index === highlightedIndex}
                data-testid={`label-option-${label.id}`}
              >
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: label.color || '#6b7280' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary truncate">
                    {label.name}
                  </div>
                  {label.description && (
                    <div className="text-xs text-text-muted truncate">
                      {label.description}
                    </div>
                  )}
                </div>
              </button>
            ))}

            {/* Custom Label Option */}
            {canAddCustomLabel && (
              <button
                type="button"
                onClick={() => handleAddLabel(searchQuery.trim())}
                className={clsx(
                  'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                  'hover:bg-bg-tertiary transition-colors border-t border-border-primary',
                  highlightedIndex === filteredLabels.length && 'bg-bg-tertiary'
                )}
                role="option"
                aria-selected={highlightedIndex === filteredLabels.length}
                data-testid="add-custom-label"
              >
                <PlusIcon className="h-3 w-3 text-text-muted" />
                <span className="text-text-secondary">
                  Create "{searchQuery.trim()}"
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LabelEditor;
