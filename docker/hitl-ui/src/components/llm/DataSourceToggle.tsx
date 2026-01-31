/**
 * DataSourceToggle Component (P05-F13 T33)
 *
 * Toggle switch for selecting between mock and real data sources.
 * Persists selection to localStorage.
 */

import clsx from 'clsx';
import { useLLMConfigStore } from '../../stores/llmConfigStore';

export interface DataSourceToggleProps {
  /** Custom class name */
  className?: string;
}

export default function DataSourceToggle({ className }: DataSourceToggleProps) {
  const { dataSource, setDataSource } = useLLMConfigStore();

  return (
    <div
      data-testid="data-source-toggle"
      className={clsx('flex items-center gap-2', className)}
    >
      <span className="text-sm text-text-muted">Data Source:</span>
      <div className="flex rounded-lg border border-border-primary overflow-hidden">
        <button
          data-testid="data-source-mock"
          type="button"
          className={clsx(
            'px-3 py-1 text-sm transition-colors',
            dataSource === 'mock'
              ? 'bg-accent-teal/20 text-accent-teal font-medium'
              : 'bg-bg-primary text-text-secondary hover:bg-bg-tertiary'
          )}
          onClick={() => setDataSource('mock')}
        >
          Mock
        </button>
        <button
          data-testid="data-source-real"
          type="button"
          className={clsx(
            'px-3 py-1 text-sm transition-colors border-l border-border-primary',
            dataSource === 'real'
              ? 'bg-accent-teal/20 text-accent-teal font-medium'
              : 'bg-bg-primary text-text-secondary hover:bg-bg-tertiary'
          )}
          onClick={() => setDataSource('real')}
        >
          Real
        </button>
      </div>
    </div>
  );
}
