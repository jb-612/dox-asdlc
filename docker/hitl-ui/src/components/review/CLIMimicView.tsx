/**
 * CLIMimicView Component (T11)
 *
 * Terminal-style output display for review progress messages.
 * Features:
 * - Color-coded messages by reviewer type
 * - Auto-scroll with manual scroll detection
 * - Type prefixes ([INFO], [PROG], [FIND], [ERR!])
 * - Timestamp display
 * - Maximum line limit for performance
 */

import { useRef, useEffect, useState } from 'react';
import clsx from 'clsx';
import type { CLIEntry } from '../../stores/reviewStore';
import type { ReviewerType } from '../../api/types';

interface CLIMimicViewProps {
  entries: CLIEntry[];
  maxLines?: number;
}

/**
 * Color mappings for each reviewer type
 */
const REVIEWER_COLORS: Record<ReviewerType | 'system', string> = {
  security: 'text-purple-400',
  performance: 'text-teal-400',
  style: 'text-blue-400',
  system: 'text-gray-400',
};

/**
 * Type prefixes for message categorization
 */
const TYPE_PREFIXES: Record<CLIEntry['type'], string> = {
  info: '[INFO]',
  progress: '[PROG]',
  finding: '[FIND]',
  error: '[ERR!]',
};

/**
 * Format ISO timestamp to HH:MM:SS format
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function CLIMimicView({ entries, maxLines = 100 }: CLIMimicViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Limit displayed entries for performance
  const displayedEntries = entries.slice(-maxLines);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries.length, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="space-y-2" data-testid="cli-mimic-view">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">
          Terminal Output
        </span>
        {!autoScroll && (
          <button
            onClick={() => setAutoScroll(true)}
            className="text-xs text-accent-teal hover:underline"
            data-testid="resume-scroll-button"
          >
            Resume auto-scroll
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-48 overflow-y-auto rounded-lg bg-gray-900 p-4 font-mono text-xs"
        data-testid="cli-output-container"
      >
        {displayedEntries.length === 0 ? (
          <p className="text-gray-500" data-testid="empty-message">
            Waiting for output...
          </p>
        ) : (
          displayedEntries.map((entry, i) => (
            <div key={i} className="whitespace-pre-wrap" data-testid="cli-entry">
              <span className="text-gray-500">
                {formatTimestamp(entry.timestamp)}
              </span>{' '}
              <span
                className={clsx(
                  entry.type === 'error' ? 'text-red-400' : 'text-gray-400'
                )}
              >
                {TYPE_PREFIXES[entry.type]}
              </span>{' '}
              <span className={REVIEWER_COLORS[entry.reviewer]}>
                [{entry.reviewer}]
              </span>{' '}
              <span className="text-gray-200">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default CLIMimicView;
