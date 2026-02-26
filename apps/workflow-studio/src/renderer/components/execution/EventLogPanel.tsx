import { useState, useCallback, useMemo } from 'react';
import type { ExecutionEvent, ExecutionEventType } from '../../../shared/types/execution';
import { formatExecutionEvent } from '../shared/eventFormatter';
import { VirtualizedEventLog } from '../shared/VirtualizedEventLog';

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Event log panel with filtering, node-level filtering, and auto-scroll.
 * Thin wrapper around VirtualizedEventLog for rendering.
 */
export default function EventLogPanel({
  events,
  filterNodeId,
}: EventLogPanelProps): JSX.Element {
  const [filter, setFilter] = useState<FilterCategory>('all');

  const handleFilterClick = useCallback((key: FilterCategory) => {
    setFilter(key);
  }, []);

  const filterPredicate = useMemo(() => {
    return (event: ExecutionEvent): boolean => {
      if (filterNodeId && event.nodeId !== filterNodeId) return false;
      if (filter === 'all') return true;
      return categoryForType(event.type).includes(filter);
    };
  }, [filter, filterNodeId]);

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

      {/* Event list — delegated to VirtualizedEventLog */}
      <div className="flex-1 overflow-hidden">
        <VirtualizedEventLog
          events={events}
          formatter={formatExecutionEvent}
          filterPredicate={filterPredicate}
          autoScroll={true}
        />
      </div>
    </div>
  );
}
