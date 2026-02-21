import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ExecutionEvent, ExecutionEventType } from '../../../shared/types/execution';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExecutionEventListProps {
  events: ExecutionEvent[];
}

// ---------------------------------------------------------------------------
// Filter categories
// ---------------------------------------------------------------------------

type FilterCategory = 'all' | 'nodes' | 'gates' | 'errors';

const FILTER_BUTTONS: { key: FilterCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'nodes', label: 'Nodes' },
  { key: 'gates', label: 'Gates' },
  { key: 'errors', label: 'Errors' },
];

function categoryForEventType(type: ExecutionEventType): FilterCategory[] {
  switch (type) {
    case 'node_started':
    case 'node_completed':
    case 'node_failed':
    case 'node_skipped':
      return ['nodes'];
    case 'gate_waiting':
    case 'gate_decided':
      return ['gates'];
    case 'execution_failed':
    case 'execution_aborted':
    case 'node_failed':
    case 'cli_error':
      return ['errors'];
    default:
      return [];
  }
}

function matchesFilter(event: ExecutionEvent, filter: FilterCategory): boolean {
  if (filter === 'all') return true;
  return categoryForEventType(event.type).includes(filter);
}

// ---------------------------------------------------------------------------
// Event type styling
// ---------------------------------------------------------------------------

interface EventTypeStyle {
  iconColor: string;
  icon: JSX.Element;
}

function styleForEventType(type: ExecutionEventType): EventTypeStyle {
  switch (type) {
    case 'execution_started':
      return {
        iconColor: 'text-blue-400',
        icon: (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'execution_completed':
    case 'node_completed':
      return {
        iconColor: 'text-green-400',
        icon: (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'node_started':
      return {
        iconColor: 'text-blue-400',
        icon: (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'gate_waiting':
    case 'gate_decided':
      return {
        iconColor: 'text-amber-400',
        icon: (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'execution_failed':
    case 'execution_aborted':
    case 'node_failed':
      return {
        iconColor: 'text-red-400',
        icon: (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'variable_updated':
      return {
        iconColor: 'text-purple-400',
        icon: (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'node_skipped':
      return {
        iconColor: 'text-gray-400',
        icon: (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'cli_error':
      return {
        iconColor: 'text-red-400',
        icon: (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'cli_output':
    case 'cli_exit':
    default:
      return {
        iconColor: 'text-gray-400',
        icon: (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        ),
      };
  }
}

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour12: false });
  } catch {
    return '--:--:--';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Scrollable, filterable list of timestamped execution events.
 * Auto-scrolls to the bottom when new events arrive.
 */
export default function ExecutionEventList({ events }: ExecutionEventListProps): JSX.Element {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => events.filter((e) => matchesFilter(e, filter)),
    [events, filter],
  );

  // Auto-scroll to bottom on new events
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [filtered.length]);

  const handleFilterClick = useCallback((key: FilterCategory) => {
    setFilter(key);
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-700 flex-shrink-0">
        {FILTER_BUTTONS.map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => handleFilterClick(btn.key)}
            className={`
              px-2.5 py-1 rounded text-[11px] font-medium transition-colors
              ${filter === btn.key
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }
            `}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
            <svg className="w-8 h-8 mb-2 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>No events to display</span>
          </div>
        ) : (
          filtered.map((event) => {
            const typeStyle = styleForEventType(event.type);
            return (
              <div
                key={event.id}
                className="flex items-start gap-2 py-1 px-1 rounded hover:bg-gray-800/50 transition-colors"
              >
                {/* Timestamp */}
                <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap mt-0.5 min-w-[60px]">
                  {formatTimestamp(event.timestamp)}
                </span>

                {/* Icon */}
                <span className={`flex-shrink-0 mt-0.5 ${typeStyle.iconColor}`}>
                  {typeStyle.icon}
                </span>

                {/* Message */}
                <span className="text-xs text-gray-300 leading-relaxed break-words">
                  {event.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
