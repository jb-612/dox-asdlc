/**
 * ServiceSelector - Dropdown to filter metrics by service
 *
 * Features:
 * - "All Services" as first option
 * - Health indicator (green dot = healthy, yellow = unhealthy)
 * - Loading state while services load
 */

import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useServices } from '../../api/metrics';
import { useMetricsStore } from '../../stores/metricsStore';
import type { ServiceInfo } from '../../api/types/metrics';

export interface ServiceSelectorProps {
  /** Custom class name */
  className?: string;
}

interface ServiceOption {
  value: string | null;
  label: string;
  healthy?: boolean;
}

export default function ServiceSelector({ className }: ServiceSelectorProps) {
  const { selectedService, setSelectedService } = useMetricsStore();
  const { data: services, isLoading } = useServices();

  // Build options list with "All Services" first
  const options: ServiceOption[] = [
    { value: null, label: 'All Services', healthy: true },
    ...(services?.map((s: ServiceInfo) => ({
      value: s.name,
      label: s.displayName,
      healthy: s.healthy,
    })) || []),
  ];

  // Find current selection
  const currentOption =
    options.find((opt) => opt.value === selectedService) || options[0];

  if (isLoading) {
    return (
      <div
        className={clsx('w-48 h-9 bg-bg-tertiary rounded-lg animate-pulse', className)}
        data-testid="service-selector-loading"
      />
    );
  }

  return (
    <Listbox
      value={selectedService}
      onChange={setSelectedService}
      data-testid="service-selector"
    >
      <div className={clsx('relative', className)}>
        <Listbox.Button
          className="relative w-48 cursor-pointer rounded-lg bg-bg-tertiary py-2 pl-3 pr-10 text-left text-sm text-text-primary border border-border-primary hover:bg-bg-tertiary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
          data-testid="service-selector-button"
        >
          <span className="flex items-center gap-2 truncate">
            <HealthIndicator healthy={currentOption.healthy} />
            {currentOption.label}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon className="h-5 w-5 text-text-muted" aria-hidden="true" />
          </span>
        </Listbox.Button>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-bg-secondary border border-border-primary py-1 text-sm shadow-lg focus:outline-none"
            data-testid="service-selector-options"
          >
            {options.map((option) => (
              <Listbox.Option
                key={option.value ?? 'all'}
                value={option.value}
                className={({ active }) =>
                  clsx(
                    'relative cursor-pointer select-none py-2 pl-10 pr-4',
                    active ? 'bg-bg-tertiary text-text-primary' : 'text-text-secondary'
                  )
                }
                data-testid={`service-option-${option.value ?? 'all'}`}
              >
                {({ selected, active }) => (
                  <>
                    <span
                      className={clsx(
                        'flex items-center gap-2 truncate',
                        selected ? 'font-medium text-text-primary' : 'font-normal'
                      )}
                    >
                      <HealthIndicator healthy={option.healthy} />
                      {option.label}
                    </span>
                    {selected && (
                      <span
                        className={clsx(
                          'absolute inset-y-0 left-0 flex items-center pl-3',
                          active ? 'text-text-primary' : 'text-accent-blue'
                        )}
                      >
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

/**
 * Health indicator dot component
 */
function HealthIndicator({ healthy }: { healthy?: boolean }) {
  return (
    <span
      className={clsx(
        'h-2 w-2 rounded-full flex-shrink-0',
        healthy === false ? 'bg-status-warning' : 'bg-status-success'
      )}
      aria-label={healthy === false ? 'Unhealthy' : 'Healthy'}
      data-testid="health-indicator"
    />
  );
}
