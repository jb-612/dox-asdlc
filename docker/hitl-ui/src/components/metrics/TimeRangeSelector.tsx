/**
 * TimeRangeSelector - Button group to select time range
 *
 * Features:
 * - Button group with options: 15m, 1h, 6h, 24h, 7d
 * - Highlights active time range
 * - Consistent styling with K8s interval selector
 */

import clsx from 'clsx';
import { useMetricsStore } from '../../stores/metricsStore';
import { TIME_RANGE_OPTIONS, type TimeRange } from '../../api/types/metrics';

export interface TimeRangeSelectorProps {
  /** Custom class name */
  className?: string;
}

export default function TimeRangeSelector({ className }: TimeRangeSelectorProps) {
  const { timeRange, setTimeRange } = useMetricsStore();

  return (
    <div
      className={clsx('flex items-center gap-1', className)}
      role="group"
      aria-label="Time range selection"
      data-testid="time-range-selector"
    >
      {TIME_RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => setTimeRange(option.value)}
          className={clsx(
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            timeRange === option.value
              ? 'bg-accent-blue text-white'
              : 'bg-bg-tertiary text-text-muted hover:bg-bg-tertiary/80 hover:text-text-secondary'
          )}
          aria-pressed={timeRange === option.value}
          data-testid={`time-range-${option.value}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
