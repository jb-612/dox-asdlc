/**
 * ErrorFallback - Displays error information with recovery options
 *
 * Used as the fallback UI for ErrorBoundary when an error occurs.
 */

import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  className?: string;
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
  className,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      data-testid="error-fallback"
      className={clsx(
        'flex flex-col items-center justify-center p-8 bg-bg-secondary rounded-lg border border-status-error/30',
        className
      )}
    >
      <ExclamationTriangleIcon className="h-16 w-16 text-status-error mb-4" />

      <h2 className="text-xl font-semibold text-text-primary mb-2">
        Something went wrong
      </h2>

      <p className="text-sm text-text-secondary mb-4 text-center max-w-md">
        {error.message || 'An unexpected error occurred'}
      </p>

      <div className="flex items-center gap-3">
        <button
          data-testid="retry-button"
          onClick={resetErrorBoundary}
          className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Try Again
        </button>

        <button
          data-testid="show-details"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg hover:bg-bg-tertiary/80 transition-colors"
        >
          {showDetails ? (
            <>
              <ChevronUpIcon className="h-4 w-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDownIcon className="h-4 w-4" />
              Show Details
            </>
          )}
        </button>
      </div>

      {showDetails && error.stack && (
        <div
          data-testid="error-details"
          className="mt-4 p-4 bg-bg-primary rounded-lg border border-bg-tertiary w-full max-w-2xl overflow-auto"
        >
          <pre className="text-xs text-text-tertiary whitespace-pre-wrap font-mono">
            {error.stack}
          </pre>
        </div>
      )}
    </div>
  );
}
