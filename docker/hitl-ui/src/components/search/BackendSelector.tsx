/**
 * BackendSelector - Toggle between backend modes (REST, GraphQL, MCP, Mock)
 *
 * Part of P05-F08 KnowledgeStore Search UI
 */

import { useMemo } from 'react';
import clsx from 'clsx';
import type { SearchBackendMode } from '../../api/types';

export interface BackendSelectorProps {
  /** Current backend mode */
  mode: SearchBackendMode;
  /** Mode change callback */
  onChange: (mode: SearchBackendMode) => void;
  /** Whether selector is disabled */
  disabled?: boolean;
  /** Show health indicator */
  showHealth?: boolean;
  /** Health status (for non-mock backends) */
  healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
  /** Custom class name */
  className?: string;
}

interface BackendOption {
  value: SearchBackendMode;
  label: string;
  description: string;
}

const BACKEND_OPTIONS: BackendOption[] = [
  {
    value: 'mock',
    label: 'Mock',
    description: 'Local mock data for development',
  },
  {
    value: 'rest',
    label: 'REST API',
    description: 'HTTP REST endpoints',
  },
  {
    value: 'graphql',
    label: 'GraphQL',
    description: 'GraphQL queries',
  },
  {
    value: 'mcp',
    label: 'MCP',
    description: 'Model Context Protocol',
  },
];

/**
 * Get health indicator color based on mode and status
 */
function getHealthColor(mode: SearchBackendMode, status?: string): string {
  // Mock is always healthy
  if (mode === 'mock') {
    return 'bg-green-500';
  }

  switch (status) {
    case 'healthy':
      return 'bg-green-500';
    case 'unhealthy':
      return 'bg-red-500';
    default:
      return 'bg-yellow-500';
  }
}

export default function BackendSelector({
  mode,
  onChange,
  disabled = false,
  showHealth = false,
  healthStatus,
  className,
}: BackendSelectorProps) {
  const healthColor = useMemo(
    () => getHealthColor(mode, healthStatus),
    [mode, healthStatus]
  );

  return (
    <div
      className={clsx('flex items-center gap-2', className)}
      data-testid="backend-selector"
    >
      {/* Health indicator */}
      {showHealth && (
        <div
          className={clsx(
            'h-2.5 w-2.5 rounded-full flex-shrink-0',
            healthColor
          )}
          data-testid="health-indicator"
          role="status"
          aria-label={
            mode === 'mock'
              ? 'Mock backend status: healthy'
              : `Backend status: ${healthStatus || 'unknown'}`
          }
          title={
            mode === 'mock'
              ? 'Mock backend (always available)'
              : `Backend status: ${healthStatus || 'unknown'}`
          }
        />
      )}

      {/* Select dropdown */}
      <div className="relative">
        <select
          value={mode}
          onChange={(e) => onChange(e.target.value as SearchBackendMode)}
          disabled={disabled}
          className={clsx(
            'appearance-none px-3 py-2 pr-8 rounded-lg border border-border-primary bg-bg-secondary',
            'text-sm text-text-primary',
            'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent',
            'transition-colors cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Select backend mode"
        >
          {BACKEND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Dropdown arrow */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className="h-4 w-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Mode description (hidden on mobile) */}
      <span className="hidden lg:block text-xs text-text-muted">
        {BACKEND_OPTIONS.find((o) => o.value === mode)?.description}
      </span>
    </div>
  );
}
