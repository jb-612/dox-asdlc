/**
 * ScopeSelector Component (T06)
 *
 * Radio group for selecting the review scope:
 * - Full Repository
 * - Changed Files Only
 * - Custom Path
 */

import { RadioGroup } from '@headlessui/react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

export type Scope = 'full_repo' | 'changed_files' | 'custom_path';

interface ScopeOption {
  value: Scope;
  label: string;
  description: string;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  {
    value: 'full_repo',
    label: 'Full Repository',
    description: 'Review all files in the repository',
  },
  {
    value: 'changed_files',
    label: 'Changed Files Only',
    description: 'Review only modified files in PR/branch',
  },
  {
    value: 'custom_path',
    label: 'Custom Path',
    description: 'Review files in a specific directory',
  },
];

interface ScopeSelectorProps {
  value: Scope;
  onChange: (value: Scope) => void;
  disabled?: boolean;
}

export function ScopeSelector({ value, onChange, disabled }: ScopeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-primary">
        Scope
      </label>
      <RadioGroup
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="space-y-2"
      >
        {SCOPE_OPTIONS.map((option) => (
          <RadioGroup.Option
            key={option.value}
            value={option.value}
            className={({ checked, disabled: optionDisabled }) =>
              clsx(
                'relative flex cursor-pointer rounded-lg px-4 py-3 border',
                'focus:outline-none',
                checked
                  ? 'bg-accent-teal/10 border-accent-teal'
                  : 'bg-bg-tertiary border-bg-tertiary hover:border-text-tertiary',
                optionDisabled && 'opacity-50 cursor-not-allowed'
              )
            }
          >
            {({ checked }) => (
              <div className="flex w-full items-center justify-between">
                <div>
                  <RadioGroup.Label
                    as="p"
                    className="text-sm font-medium text-text-primary"
                  >
                    {option.label}
                  </RadioGroup.Label>
                  <RadioGroup.Description
                    as="span"
                    className="text-xs text-text-tertiary"
                  >
                    {option.description}
                  </RadioGroup.Description>
                </div>
                {checked && (
                  <CheckCircleIcon className="h-5 w-5 text-accent-teal flex-shrink-0" />
                )}
              </div>
            )}
          </RadioGroup.Option>
        ))}
      </RadioGroup>
    </div>
  );
}

export default ScopeSelector;
