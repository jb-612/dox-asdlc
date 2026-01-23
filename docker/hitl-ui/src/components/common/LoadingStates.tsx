/**
 * LoadingStates - Collection of loading state components
 *
 * Provides spinners, overlays, skeleton screens, and streaming indicators.
 */

import clsx from 'clsx';

// ============================================================================
// LoadingSpinner
// ============================================================================

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'muted';
  className?: string;
}

const spinnerSizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

const spinnerColors = {
  primary: 'text-accent-blue',
  white: 'text-white',
  muted: 'text-text-tertiary',
};

export function LoadingSpinner({
  size = 'md',
  color = 'primary',
  className,
}: LoadingSpinnerProps) {
  return (
    <svg
      data-testid="loading-spinner"
      className={clsx(
        'animate-spin',
        spinnerSizes[size],
        spinnerColors[color],
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================================================
// LoadingOverlay
// ============================================================================

interface LoadingOverlayProps {
  message?: string;
  variant?: 'fullscreen' | 'inline';
  className?: string;
}

export function LoadingOverlay({
  message = 'Loading...',
  variant = 'inline',
  className,
}: LoadingOverlayProps) {
  return (
    <div
      data-testid="loading-overlay"
      className={clsx(
        'flex flex-col items-center justify-center bg-bg-primary/80 backdrop-blur-sm z-50',
        variant === 'fullscreen' ? 'fixed inset-0' : 'relative min-h-[200px]',
        className
      )}
    >
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-sm text-text-secondary">{message}</p>
    </div>
  );
}

// ============================================================================
// SkeletonLine
// ============================================================================

interface SkeletonLineProps {
  width?: 'full' | '3/4' | '1/2' | '1/3' | '1/4';
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

const lineWidths = {
  full: 'w-full',
  '3/4': 'w-3/4',
  '1/2': 'w-1/2',
  '1/3': 'w-1/3',
  '1/4': 'w-1/4',
};

const lineHeights = {
  sm: 'h-3',
  md: 'h-4',
  lg: 'h-6',
};

export function SkeletonLine({
  width = 'full',
  height = 'md',
  className,
}: SkeletonLineProps) {
  return (
    <div
      data-testid="skeleton-line"
      className={clsx(
        'bg-bg-tertiary rounded animate-pulse',
        lineWidths[width],
        lineHeights[height],
        className
      )}
    />
  );
}

// ============================================================================
// SkeletonCard
// ============================================================================

interface SkeletonCardProps {
  lines?: number;
  showHeader?: boolean;
  className?: string;
}

export function SkeletonCard({
  lines = 3,
  showHeader = true,
  className,
}: SkeletonCardProps) {
  return (
    <div
      data-testid="skeleton-card"
      className={clsx(
        'bg-bg-secondary border border-bg-tertiary rounded-lg p-4 space-y-3',
        className
      )}
    >
      {showHeader && (
        <div data-testid="skeleton-header" className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-bg-tertiary rounded-full animate-pulse" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="1/2" height="sm" />
            <SkeletonLine width="1/4" height="sm" />
          </div>
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '3/4' : 'full'}
        />
      ))}
    </div>
  );
}

// ============================================================================
// SkeletonTable
// ============================================================================

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}: SkeletonTableProps) {
  return (
    <div
      data-testid="skeleton-table"
      className={clsx(
        'bg-bg-secondary border border-bg-tertiary rounded-lg overflow-hidden',
        className
      )}
    >
      {showHeader && (
        <div
          data-testid="skeleton-table-header"
          className="flex gap-4 p-4 bg-bg-tertiary/50 border-b border-bg-tertiary"
        >
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="flex-1">
              <SkeletonLine height="sm" />
            </div>
          ))}
        </div>
      )}
      <div className="divide-y divide-bg-tertiary">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            data-testid="skeleton-row"
            className="flex gap-4 p-4"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                data-testid="skeleton-cell"
                className="flex-1"
              >
                <SkeletonLine
                  width={colIndex === 0 ? '3/4' : 'full'}
                  height="sm"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// StreamingIndicator
// ============================================================================

interface StreamingIndicatorProps {
  label?: string;
  variant?: 'default' | 'inline';
  className?: string;
}

export function StreamingIndicator({
  label,
  variant = 'default',
  className,
}: StreamingIndicatorProps) {
  return (
    <div
      data-testid="streaming-indicator"
      className={clsx(
        'items-center gap-2',
        variant === 'inline' ? 'inline-flex' : 'flex',
        className
      )}
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            data-testid="streaming-dot"
            className={clsx(
              'w-2 h-2 bg-accent-blue rounded-full animate-bounce',
              i === 1 && 'animation-delay-150',
              i === 2 && 'animation-delay-300'
            )}
            style={{
              animationDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </div>
      {label && (
        <span className="text-sm text-text-secondary">{label}</span>
      )}
    </div>
  );
}
