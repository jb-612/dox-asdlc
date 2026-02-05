/**
 * TargetInput Component (T05)
 *
 * Input field for specifying the review target (repo URL, PR number, or branch name).
 * Provides validation feedback and helpful examples.
 */

import clsx from 'clsx';

interface TargetInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function TargetInput({ value, onChange, error, disabled }: TargetInputProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor="review-target"
        className="text-sm font-medium text-text-primary"
      >
        Target
      </label>
      <input
        id="review-target"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter repo URL, PR number, or branch name"
        disabled={disabled}
        className={clsx(
          'w-full px-3 py-2 rounded-md border',
          'bg-bg-tertiary text-text-primary',
          'placeholder:text-text-tertiary',
          error ? 'border-status-error' : 'border-bg-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-accent-teal',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
      {error && (
        <p className="text-xs text-status-error">{error}</p>
      )}
      <p className="text-xs text-text-tertiary">
        Examples: https://github.com/org/repo, #123, feature/my-branch
      </p>
    </div>
  );
}

export default TargetInput;
