import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ExecutionEvent, ExecutionEventType } from '../../../shared/types/execution';
import { formatEvent } from '../../utils/eventFormatter';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EventLogPanelProps {
  events: ExecutionEvent[];
  /** When provided, only show events for this node. */
  filterNodeId?: string;
}

// ---------------------------------------------------------------------------
// Filter categories
// ---------------------------------------------------------------------------

type FilterCategory = 'all' | 'nodes' | 'gates' | 'tools' | 'errors';

const FILTER_BUTTONS: { key: FilterCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'nodes', label: 'Nodes' },
  { key: 'gates', label: 'Gates' },
  { key: 'tools', label: 'Tools' },
  { key: 'errors', label: 'Errors' },
];

function categoryForType(type: ExecutionEventType): FilterCategory[] {
  switch (type) {
    case 'node_started':
    case 'node_completed':
    case 'node_skipped':
      return ['nodes'];
    case 'node_failed':
      return ['nodes', 'errors'];
    case 'gate_waiting':
    case 'gate_decided':
    case 'block_gate_open':
      return ['gates'];
    case 'tool_call':
    case 'bash_command':
      return ['tools'];
    case 'execution_failed':
    case 'execution_aborted':
    case 'cli_error':
      return ['errors'];
    case 'block_revision':
      return ['gates'];
    default:
      return [];
  }
}

function matchesFilter(event: ExecutionEvent, filter: FilterCategory): boolean {
  if (filter === 'all') return true;
  return categoryForType(event.type).includes(filter);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Event log panel with filtering, node-level filtering, and auto-scroll.
 * Uses the formatEvent utility for consistent display formatting.
 */
export default function EventLogPanel({
  events,
  filterNodeId,
}: EventLogPanelProps): JSX.Element {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = events;
    if (filterNodeId) {
      list = list.filter((e) => e.nodeId === filterNodeId);
    }
    return list.filter((e) => matchesFilter(e, filter));
  }, [events, filter, filterNodeId]);

  // Auto-scroll to bottom when events change
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
    <div data-testid="event-log-panel" className="flex flex-col h-full bg-gray-900">
      {/* Filter bar */}
      <div
        data-testid="event-log-filter"
        className="flex items-center gap-1 px-3 py-2 border-b border-gray-700 flex-shrink-0"
      >
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
          <div className="flex items-center justify-center h-full text-gray-500 text-xs">
            No events to display
          </div>
        ) : (
          filtered.map((event) => {
            const formatted = formatEvent(event);
            return (
              <div
                key={event.id}
                data-testid="event-log-entry"
                className="flex items-start gap-2 py-1 px-1 rounded hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap mt-0.5 min-w-[60px]">
                  {formatted.timestamp}
                </span>
                <span className="flex-shrink-0 mt-0.5 text-gray-400 text-xs">
                  {formatted.icon}
                </span>
                <span className="text-xs text-gray-300 leading-relaxed break-words">
                  {formatted.text}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
