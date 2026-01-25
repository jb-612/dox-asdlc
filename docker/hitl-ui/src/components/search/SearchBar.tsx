/**
 * SearchBar - Search input with debouncing, clear button, and keyboard support
 *
 * Part of P05-F08 KnowledgeStore Search UI
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export interface SearchBarProps {
  /** Callback when search value changes (debounced) or Enter is pressed */
  onSearch: (query: string) => void;
  /** Initial search query */
  initialQuery?: string;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Show loading indicator */
  isLoading?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Show filters toggle button */
  showFiltersToggle?: boolean;
  /** Callback when filters button is clicked */
  onFiltersToggle?: () => void;
  /** Callback when input is cleared */
  onClear?: () => void;
  /** Custom class name */
  className?: string;
}

export default function SearchBar({
  onSearch,
  initialQuery = '',
  debounceMs = 300,
  isLoading = false,
  placeholder = 'Search knowledge base...',
  showFiltersToggle = false,
  onFiltersToggle,
  onClear,
  className,
}: SearchBarProps) {
  const [value, setValue] = useState(initialQuery);
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Update value when initialQuery changes
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  // Debounced search callback
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      // Only trigger debounced search if value is different from last search
      // Enter key will trigger immediate search
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, debounceMs]);

  // Setup debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, debounceMs, onSearch]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  // Handle clear
  const handleClear = useCallback(() => {
    setValue('');
    onClear?.();
    inputRef.current?.focus();
  }, [onClear]);

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Clear any pending debounce and search immediately
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        onSearch(value);
      }
      if (e.key === 'Escape') {
        setValue('');
        onClear?.();
      }
    },
    [value, onSearch, onClear]
  );

  const showClearButton = value.length > 0 && !isLoading;

  return (
    <div className={clsx('relative flex gap-2', className)} data-testid="search-bar">
      {/* Search input container */}
      <div className="relative flex-1">
        {/* Search icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={clsx(
            'w-full h-11 pl-10 pr-10 rounded-lg border border-border-primary bg-bg-secondary',
            'text-text-primary placeholder-text-muted text-base',
            'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent',
            'transition-colors'
          )}
          aria-label="Search knowledge base"
        />

        {/* Clear button or loading indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {isLoading ? (
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-text-muted border-t-accent-teal"
              data-testid="search-loading"
            />
          ) : (
            showClearButton && (
              <button
                onClick={handleClear}
                className="text-text-muted hover:text-text-secondary transition-colors p-0.5"
                aria-label="Clear search"
                data-testid="clear-button"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )
          )}
        </div>
      </div>

      {/* Filters toggle button */}
      {showFiltersToggle && (
        <button
          onClick={onFiltersToggle}
          className={clsx(
            'h-11 px-4 rounded-lg border border-border-primary bg-bg-secondary',
            'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary',
            'focus:outline-none focus:ring-2 focus:ring-accent-teal',
            'transition-colors flex items-center gap-2'
          )}
          aria-label="Toggle search filters"
          data-testid="filters-toggle"
        >
          <AdjustmentsHorizontalIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      )}
    </div>
  );
}
