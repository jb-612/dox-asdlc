/**
 * FilterDropdown - Multi-select filter dropdown with select all/clear all
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  FunnelIcon,
  CheckIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export interface FilterOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Optional count badge */
  count?: number;
  /** Optional icon */
  icon?: React.ElementType;
}

export interface FilterDropdownProps {
  /** Filter options */
  options: FilterOption[];
  /** Selected values */
  selected: string[];
  /** Label for the dropdown button */
  label?: string;
  /** Placeholder when no selection */
  placeholder?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show count badge on button */
  showBadge?: boolean;
  /** Allow multiple selections */
  multiple?: boolean;
  /** Show select all/clear all */
  showBulkActions?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when selection changes */
  onChange: (selected: string[]) => void;
}

// Size variants
const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-base px-4 py-2',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export default function FilterDropdown({
  options,
  selected,
  label = 'Filter',
  placeholder = 'All',
  size = 'md',
  showBadge = true,
  multiple = true,
  showBulkActions = true,
  className,
  onChange,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toggle option selection
  const toggleOption = useCallback(
    (value: string) => {
      if (multiple) {
        if (selected.includes(value)) {
          onChange(selected.filter((v) => v !== value));
        } else {
          onChange([...selected, value]);
        }
      } else {
        onChange([value]);
        setIsOpen(false);
      }
    },
    [selected, onChange, multiple]
  );

  // Select all
  const selectAll = useCallback(() => {
    onChange(options.map((o) => o.value));
  }, [options, onChange]);

  // Clear all
  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  // Check if all selected
  const allSelected = useMemo(() => {
    return selected.length === options.length;
  }, [selected, options]);

  // Check if any selected
  const hasSelection = selected.length > 0;

  // Get display text
  const displayText = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const option = options.find((o) => o.value === selected[0]);
      return option?.label || selected[0];
    }
    return `${selected.length} selected`;
  }, [selected, options, placeholder]);

  return (
    <div className={clsx('relative', className)} ref={dropdownRef} data-testid="filter-dropdown">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 rounded-lg border transition-colors',
          hasSelection
            ? 'border-accent-teal/50 bg-accent-teal/10 text-accent-teal'
            : 'border-border-primary bg-bg-secondary text-text-secondary hover:bg-bg-tertiary',
          sizeClasses[size]
        )}
        data-testid="filter-button"
      >
        <FunnelIcon className={iconSizes[size]} />
        {label && <span>{label}</span>}
        {hasSelection && showBadge && (
          <span
            className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-teal text-white text-xs font-medium"
            data-testid="filter-badge"
          >
            {selected.length}
          </span>
        )}
        <ChevronDownIcon
          className={clsx(
            iconSizes[size],
            'transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute z-50 mt-1 min-w-[200px] bg-bg-secondary border border-border-primary rounded-lg shadow-lg overflow-hidden"
          data-testid="filter-menu"
        >
          {/* Bulk actions */}
          {showBulkActions && multiple && (
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-secondary">
              <button
                onClick={selectAll}
                className={clsx(
                  'text-xs transition-colors',
                  allSelected
                    ? 'text-text-muted cursor-not-allowed'
                    : 'text-accent-teal hover:underline'
                )}
                disabled={allSelected}
                data-testid="select-all"
              >
                Select All
              </button>
              <button
                onClick={clearAll}
                className={clsx(
                  'text-xs transition-colors',
                  !hasSelection
                    ? 'text-text-muted cursor-not-allowed'
                    : 'text-status-error hover:underline'
                )}
                disabled={!hasSelection}
                data-testid="clear-all"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Options */}
          <div className="max-h-64 overflow-y-auto" data-testid="filter-options">
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              const Icon = option.icon;

              return (
                <button
                  key={option.value}
                  onClick={() => toggleOption(option.value)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                    isSelected
                      ? 'bg-accent-teal/10 text-accent-teal'
                      : 'text-text-secondary hover:bg-bg-tertiary'
                  )}
                  data-testid={`option-${option.value}`}
                >
                  {/* Checkbox indicator */}
                  <span
                    className={clsx(
                      'flex items-center justify-center w-4 h-4 rounded border',
                      isSelected
                        ? 'border-accent-teal bg-accent-teal text-white'
                        : 'border-border-primary bg-bg-primary'
                    )}
                  >
                    {isSelected && <CheckIcon className="h-3 w-3" />}
                  </span>

                  {/* Icon */}
                  {Icon && <Icon className={clsx(iconSizes[size], 'text-text-muted')} />}

                  {/* Label */}
                  <span className="flex-1 text-sm">{option.label}</span>

                  {/* Count */}
                  {option.count !== undefined && (
                    <span className="text-xs text-text-muted">{option.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Clear filter button */}
          {hasSelection && (
            <div className="border-t border-border-secondary">
              <button
                onClick={() => {
                  clearAll();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-text-muted hover:text-text-secondary hover:bg-bg-tertiary transition-colors"
                data-testid="clear-filter"
              >
                <XMarkIcon className="h-4 w-4" />
                Clear Filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
