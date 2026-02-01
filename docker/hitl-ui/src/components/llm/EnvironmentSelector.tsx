/**
 * EnvironmentSelector Component (P09-F01 T10)
 *
 * Dropdown selector for filtering secrets by environment (dev/staging/prod).
 */

import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import clsx from 'clsx';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { SecretsEnvironment } from '../../types/llmConfig';
import { SECRETS_ENVIRONMENT_NAMES } from '../../types/llmConfig';

export interface EnvironmentSelectorProps {
  /** Currently selected environment */
  value: SecretsEnvironment | 'all';
  /** Callback when environment changes */
  onChange: (env: SecretsEnvironment | 'all') => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

const environments: Array<{ id: SecretsEnvironment | 'all'; name: string; color: string }> = [
  { id: 'all', name: 'All Environments', color: 'bg-gray-500' },
  { id: 'dev', name: SECRETS_ENVIRONMENT_NAMES.dev, color: 'bg-green-500' },
  { id: 'staging', name: SECRETS_ENVIRONMENT_NAMES.staging, color: 'bg-yellow-500' },
  { id: 'prod', name: SECRETS_ENVIRONMENT_NAMES.prod, color: 'bg-red-500' },
];

function getEnvironmentById(id: SecretsEnvironment | 'all') {
  return environments.find((e) => e.id === id) || environments[0];
}

export default function EnvironmentSelector({
  value,
  onChange,
  disabled = false,
  className,
}: EnvironmentSelectorProps) {
  const selected = getEnvironmentById(value);

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className={clsx('relative', className)}>
        <Listbox.Button
          data-testid="environment-selector"
          className={clsx(
            'relative w-full cursor-pointer rounded-lg py-2 pl-3 pr-10 text-left',
            'bg-bg-tertiary border border-border-primary',
            'focus:outline-none focus:ring-2 focus:ring-accent-purple focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'text-sm'
          )}
        >
          <span className="flex items-center gap-2">
            <span className={clsx('h-2 w-2 rounded-full', selected.color)} />
            <span className="text-text-primary">{selected.name}</span>
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon className="h-4 w-4 text-text-muted" aria-hidden="true" />
          </span>
        </Listbox.Button>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options
            className={clsx(
              'absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg py-1',
              'bg-bg-secondary border border-border-primary shadow-lg',
              'focus:outline-none text-sm'
            )}
          >
            {environments.map((env) => (
              <Listbox.Option
                key={env.id}
                value={env.id}
                className={({ active }) =>
                  clsx(
                    'relative cursor-pointer select-none py-2 pl-10 pr-4',
                    active ? 'bg-accent-purple/10 text-text-primary' : 'text-text-secondary'
                  )
                }
              >
                {({ selected: isSelected }) => (
                  <>
                    <span className="flex items-center gap-2">
                      <span className={clsx('h-2 w-2 rounded-full', env.color)} />
                      <span
                        className={clsx(
                          'block truncate',
                          isSelected ? 'font-medium text-text-primary' : 'font-normal'
                        )}
                      >
                        {env.name}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-accent-purple">
                        <CheckIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
}
