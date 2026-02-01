/**
 * ClassificationBadge - Displays classification status of an idea (P08-F03 T13)
 *
 * Shows functional/non-functional/undetermined classification with:
 * - Color coding (green for functional, purple for non-functional, gray for undetermined)
 * - Confidence percentage display
 * - Tooltip with reasoning
 * - "Processing" state animation
 * - Click handler for details
 */

import { useState, useCallback } from 'react';
import clsx from 'clsx';
import type { ClassificationType } from '../../types/classification';

export interface ClassificationBadgeProps {
  /** The classification type to display */
  classification: ClassificationType;
  /** Confidence score (0.0 - 1.0), optional */
  confidence?: number;
  /** Reasoning text for tooltip */
  reasoning?: string;
  /** Whether classification is in progress */
  isProcessing?: boolean;
  /** Click handler for viewing details */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show confidence percentage */
  showConfidence?: boolean;
}

/**
 * Color configuration for each classification type
 */
const classificationStyles: Record<
  ClassificationType,
  { bg: string; text: string; border: string; dot: string }
> = {
  functional: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  non_functional: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  undetermined: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-600',
    dot: 'bg-gray-400',
  },
};

/**
 * Display labels for each classification type
 */
const classificationLabels: Record<ClassificationType, string> = {
  functional: 'Functional',
  non_functional: 'Non-Functional',
  undetermined: 'Undetermined',
};

/**
 * Size configuration
 */
const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
  lg: 'px-3 py-1.5 text-base gap-2',
};

const dotSizes = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
};

/**
 * Format confidence as percentage
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * ClassificationBadge component
 */
export function ClassificationBadge({
  classification,
  confidence,
  reasoning,
  isProcessing = false,
  onClick,
  className,
  size = 'sm',
  showConfidence = true,
}: ClassificationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (reasoning) {
      setShowTooltip(true);
    }
  }, [reasoning]);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && onClick) {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  // Processing state
  if (isProcessing) {
    return (
      <span
        className={clsx(
          'inline-flex items-center rounded-full font-medium border',
          sizeStyles[size],
          'bg-blue-100 dark:bg-blue-900/30',
          'text-blue-800 dark:text-blue-300',
          'border-blue-200 dark:border-blue-800',
          className
        )}
        data-testid="classification-badge-processing"
        aria-label="Classification in progress"
      >
        <span
          className={clsx(
            dotSizes[size],
            'rounded-full bg-blue-500 animate-pulse'
          )}
        />
        <span>Processing...</span>
      </span>
    );
  }

  const styles = classificationStyles[classification];
  const label = classificationLabels[classification];

  return (
    <span
      className={clsx('relative inline-flex', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        className={clsx(
          'inline-flex items-center rounded-full font-medium border transition-colors',
          sizeStyles[size],
          styles.bg,
          styles.text,
          styles.border,
          onClick && 'cursor-pointer hover:opacity-80'
        )}
        onClick={onClick ? handleClick : undefined}
        onKeyDown={onClick ? handleKeyDown : undefined}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        data-testid="classification-badge"
        aria-label={`Classification: ${label}${confidence !== undefined ? `, ${formatConfidence(confidence)} confidence` : ''}`}
      >
        <span className={clsx(dotSizes[size], 'rounded-full', styles.dot)} />
        <span>{label}</span>
        {showConfidence && confidence !== undefined && (
          <span className="opacity-70">({formatConfidence(confidence)})</span>
        )}
      </span>

      {/* Tooltip */}
      {showTooltip && reasoning && (
        <div
          className={clsx(
            'absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2',
            'px-3 py-2 max-w-xs',
            'bg-bg-secondary text-text-primary text-sm rounded-lg shadow-lg',
            'border border-border-primary',
            'whitespace-normal'
          )}
          role="tooltip"
          data-testid="classification-tooltip"
        >
          <div className="font-medium mb-1">Classification Reasoning</div>
          <div className="text-text-secondary">{reasoning}</div>
          {/* Arrow */}
          <div
            className={clsx(
              'absolute top-full left-1/2 -translate-x-1/2 -mt-px',
              'border-8 border-transparent border-t-border-primary'
            )}
          />
          <div
            className={clsx(
              'absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]',
              'border-[7px] border-transparent border-t-bg-secondary'
            )}
          />
        </div>
      )}
    </span>
  );
}

export default ClassificationBadge;
