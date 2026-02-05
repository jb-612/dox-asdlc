/**
 * CustomPathInput Component (T08)
 *
 * Input field for specifying a custom path when scope is 'custom_path'.
 * Includes validation to prevent absolute paths and path traversal.
 */

import clsx from 'clsx';
import { validatePath } from './pathValidation';

interface CustomPathInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function CustomPathInput({
  value,
  onChange,
  error,
  disabled,
}: CustomPathInputProps) {
  const validationError = validatePath(value);
  const displayError = error || validationError;

  return (
    <div className="space-y-1">
      <label
        htmlFor="custom-path"
        className="text-sm font-medium text-text-primary"
      >
        Custom Path
      </label>
      <input
        id="custom-path"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., src/workers/"
        disabled={disabled}
        className={clsx(
          'w-full px-3 py-2 rounded-md border',
          'bg-bg-tertiary text-text-primary',
          'placeholder:text-text-tertiary',
          displayError ? 'border-status-error' : 'border-bg-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-accent-teal',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
      {displayError && (
        <p className="text-xs text-status-error">{displayError}</p>
      )}
      <p className="text-xs text-text-tertiary">
        Relative path from repository root
      </p>
    </div>
  );
}

export default CustomPathInput;
