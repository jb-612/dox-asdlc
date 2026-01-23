/**
 * SearchInput - Debounced search input with clear and loading states
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export interface SearchInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Initial value */
  initialValue?: string;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Show loading indicator */
  isLoading?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Disable the input */
  disabled?: boolean;
  /** Show clear button */
  showClear?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when search value changes (debounced) */
  onSearch?: (value: string) => void;
  /** Callback when input value changes (immediate) */
  onChange?: (value: string) => void;
  /** Callback when input is cleared */
  onClear?: () => void;
  /** Callback when Enter key is pressed */
  onSubmit?: (value: string) => void;
}

// Size variants
const sizeClasses = {
  sm: 'h-8 text-sm pl-8 pr-8',
  md: 'h-10 text-base pl-10 pr-10',
  lg: 'h-12 text-lg pl-12 pr-12',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const iconPositions = {
  sm: 'left-2',
  md: 'left-3',
  lg: 'left-3.5',
};

const clearPositions = {
  sm: 'right-2',
  md: 'right-3',
  lg: 'right-3.5',
};

export default function SearchInput({
  placeholder = 'Search...',
  initialValue = '',
  debounceMs = 300,
  isLoading = false,
  size = 'md',
  disabled = false,
  showClear = true,
  className,
  onSearch,
  onChange,
  onClear,
  onSubmit,
}: SearchInputProps) {
  const [value, setValue] = useState(initialValue);
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Update value when initialValue changes
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Debounced search callback
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onSearch?.(value);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, debounceMs, onSearch]);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      onChange?.(newValue);
    },
    [onChange]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    setValue('');
    onClear?.();
    onChange?.('');
    onSearch?.('');
    inputRef.current?.focus();
  }, [onClear, onChange, onSearch]);

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit?.(value);
      }
      if (e.key === 'Escape') {
        handleClear();
      }
    },
    [value, onSubmit, handleClear]
  );

  return (
    <div className={clsx('relative', className)} data-testid="search-input">
      {/* Search icon */}
      <div
        className={clsx(
          'absolute top-1/2 -translate-y-1/2 text-text-muted pointer-events-none',
          iconPositions[size]
        )}
      >
        <MagnifyingGlassIcon className={iconSizes[size]} data-testid="search-icon" />
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={clsx(
          'w-full rounded-lg border border-border-primary bg-bg-secondary',
          'text-text-primary placeholder-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent',
          'transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
          sizeClasses[size]
        )}
        data-testid="search-input-field"
      />

      {/* Clear button or loading indicator */}
      <div
        className={clsx(
          'absolute top-1/2 -translate-y-1/2 flex items-center',
          clearPositions[size]
        )}
      >
        {isLoading ? (
          <div
            className={clsx(
              'animate-spin rounded-full border-2 border-text-muted border-t-accent-teal',
              size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
            )}
            data-testid="loading-indicator"
          />
        ) : (
          showClear &&
          value && (
            <button
              onClick={handleClear}
              className="text-text-muted hover:text-text-secondary transition-colors"
              aria-label="Clear search"
              data-testid="clear-button"
            >
              <XMarkIcon className={iconSizes[size]} />
            </button>
          )
        )}
      </div>
    </div>
  );
}
