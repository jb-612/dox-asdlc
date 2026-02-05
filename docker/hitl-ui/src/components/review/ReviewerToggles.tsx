/**
 * ReviewerToggles Component (T07)
 *
 * Toggle switches for enabling/disabling each reviewer type:
 * - Security
 * - Performance
 * - Style
 *
 * Displays warning when all reviewers are disabled.
 */

import { Switch } from '@headlessui/react';
import {
  ShieldCheckIcon,
  BoltIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { ComponentType, SVGProps } from 'react';

export interface ReviewerConfig {
  security: boolean;
  performance: boolean;
  style: boolean;
}

interface ReviewerInfo {
  key: keyof ReviewerConfig;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
}

const REVIEWERS: ReviewerInfo[] = [
  {
    key: 'security',
    label: 'Security',
    description: 'Check for vulnerabilities, injection attacks, secrets exposure',
    icon: ShieldCheckIcon,
    color: 'text-purple-500',
  },
  {
    key: 'performance',
    label: 'Performance',
    description: 'Find N+1 queries, memory leaks, algorithmic issues',
    icon: BoltIcon,
    color: 'text-teal-500',
  },
  {
    key: 'style',
    label: 'Style',
    description: 'Review naming, documentation, code organization',
    icon: DocumentTextIcon,
    color: 'text-blue-500',
  },
];

interface ReviewerTogglesProps {
  value: ReviewerConfig;
  onChange: (value: ReviewerConfig) => void;
  disabled?: boolean;
}

export function ReviewerToggles({ value, onChange, disabled }: ReviewerTogglesProps) {
  const allDisabled = !value.security && !value.performance && !value.style;

  const toggleReviewer = (key: keyof ReviewerConfig) => {
    if (disabled) return;
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-primary">
        Reviewers
      </label>

      <div className="space-y-3">
        {REVIEWERS.map((reviewer) => {
          const Icon = reviewer.icon;
          return (
            <div
              key={reviewer.key}
              className={clsx(
                'flex items-center justify-between p-3 rounded-lg',
                'bg-bg-tertiary border border-bg-tertiary',
                disabled && 'opacity-50'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={clsx('h-5 w-5', reviewer.color)} />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {reviewer.label}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {reviewer.description}
                  </p>
                </div>
              </div>

              <Switch
                checked={value[reviewer.key]}
                onChange={() => toggleReviewer(reviewer.key)}
                disabled={disabled}
                className={clsx(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:ring-offset-2 focus:ring-offset-bg-primary',
                  value[reviewer.key] ? 'bg-accent-teal' : 'bg-bg-secondary',
                  disabled && 'cursor-not-allowed'
                )}
              >
                <span className="sr-only">
                  {value[reviewer.key] ? 'Disable' : 'Enable'} {reviewer.label} reviewer
                </span>
                <span
                  className={clsx(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    value[reviewer.key] ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </Switch>
            </div>
          );
        })}
      </div>

      {allDisabled && (
        <p className="text-xs text-status-warning flex items-center gap-1">
          <ExclamationTriangleIcon className="h-4 w-4" />
          At least one reviewer must be enabled
        </p>
      )}
    </div>
  );
}

export default ReviewerToggles;
