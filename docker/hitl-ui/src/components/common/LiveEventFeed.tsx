/**
 * LiveEventFeed - Real-time event stream display connected to eventStore
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  PauseIcon,
  PlayIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEventStore, type SystemEvent } from '../../stores/eventStore';
import { formatRelativeTime } from '../../utils/formatters';

// Maximum number of events to keep in display
const MAX_EVENTS = 100;

export type EventFilterType = 'all' | 'runs' | 'gates' | 'artifacts' | 'sessions' | 'errors';

export interface LiveEventFeedProps {
  /** Maximum height of the feed */
  maxHeight?: string;
  /** Show filter controls */
  showFilters?: boolean;
  /** Show connection status */
  showConnectionStatus?: boolean;
  /** Initial filter */
  initialFilter?: EventFilterType;
  /** Custom class name */
  className?: string;
  /** Callback when event is clicked */
  onEventClick?: (event: SystemEvent) => void;
}

// Event type to filter mapping
const eventTypeFilters: Record<EventFilterType, string[]> = {
  all: [],
  runs: ['run.started', 'run.completed', 'run.failed'],
  gates: ['gate.created', 'gate.decided'],
  artifacts: ['artifact.created', 'artifact.approved'],
  sessions: ['session.started', 'session.completed'],
  errors: ['error', 'run.failed'],
};

// Get event color based on type
function getEventColor(type: string): string {
  if (type.includes('started')) return 'text-status-info';
  if (type.includes('completed') || type.includes('approved')) return 'text-status-success';
  if (type.includes('failed') || type === 'error') return 'text-status-error';
  if (type.includes('created')) return 'text-status-warning';
  if (type.includes('decided')) return 'text-accent-teal';
  return 'text-text-muted';
}

// Get event description
function getEventDescription(event: SystemEvent): string {
  const { type, data = {} } = event;

  switch (type) {
    case 'session.started':
      return `Session started${data.epic_id ? ` for ${data.epic_id}` : ''}`;
    case 'session.completed':
      return `Session completed`;
    case 'run.started':
      return `${data.agent_type || 'Agent'} started (${data.model || 'unknown'})`;
    case 'run.completed':
      return `Run completed - ${data.tokens_used || 0} tokens`;
    case 'run.failed':
      return `Run failed: ${data.error || 'Unknown error'}`;
    case 'gate.created':
      return `New ${data.type || 'gate'} awaiting decision`;
    case 'gate.decided':
      return `Gate ${data.decision || 'processed'} by ${data.decided_by || 'system'}`;
    case 'artifact.created':
      return `Artifact created: ${data.name || 'unknown'}`;
    case 'artifact.approved':
      return `Artifact approved`;
    case 'worker.status':
      return `Worker ${data.worker_id || ''}: ${data.status || 'unknown'}`;
    case 'error':
      return `Error: ${data.message || 'Unknown error'}`;
    default:
      return type;
  }
}

export default function LiveEventFeed({
  maxHeight = '400px',
  showFilters = true,
  showConnectionStatus = true,
  initialFilter = 'all',
  className,
  onEventClick,
}: LiveEventFeedProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<EventFilterType>(initialFilter);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  // Get state from eventStore
  const events = useEventStore((state) => state.events);
  const isConnected = useEventStore((state) => state.connected);
  const clearEvents = useEventStore((state) => state.clearEvents);

  // Filter and limit events
  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Apply type filter
    const filterTypes = eventTypeFilters[filter];
    if (filterTypes.length > 0) {
      result = result.filter((e) => filterTypes.includes(e.type));
    }

    // Limit to MAX_EVENTS
    if (result.length > MAX_EVENTS) {
      result = result.slice(-MAX_EVENTS);
    }

    return result;
  }, [events, filter]);

  // Auto-scroll when new events arrive (if not paused and was at bottom)
  useEffect(() => {
    if (!isPaused && wasAtBottomRef.current && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [filteredEvents, isPaused]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (feedRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
      wasAtBottomRef.current = scrollTop + clientHeight >= scrollHeight - 10;
    }
  }, []);

  // Toggle event expansion
  const toggleExpanded = useCallback((eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  // Handle clear events
  const handleClear = useCallback(() => {
    clearEvents();
    setExpandedEvents(new Set());
  }, [clearEvents]);

  // Render connection status indicator
  const renderConnectionStatus = () => {
    if (!showConnectionStatus) return null;

    return (
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-status-success' : 'bg-status-error'
          )}
          data-testid="connection-indicator"
        />
        <span className="text-xs text-text-muted">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    );
  };

  // Render filter dropdown
  const renderFilterDropdown = () => {
    if (!showFilters) return null;

    const filterOptions: { value: EventFilterType; label: string }[] = [
      { value: 'all', label: 'All Events' },
      { value: 'runs', label: 'Runs' },
      { value: 'gates', label: 'Gates' },
      { value: 'artifacts', label: 'Artifacts' },
      { value: 'sessions', label: 'Sessions' },
      { value: 'errors', label: 'Errors' },
    ];

    return (
      <div className="relative">
        <button
          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          className={clsx(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
            filter !== 'all'
              ? 'bg-accent-teal/20 text-accent-teal'
              : 'text-text-muted hover:bg-bg-tertiary'
          )}
          aria-label="Filter events"
        >
          <FunnelIcon className="h-4 w-4" />
          <span className="hidden sm:inline">
            {filterOptions.find((o) => o.value === filter)?.label}
          </span>
        </button>

        {showFilterDropdown && (
          <div className="absolute right-0 top-full mt-1 z-10 bg-bg-secondary border border-border-primary rounded-lg shadow-lg py-1 min-w-[140px]">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setFilter(option.value);
                  setShowFilterDropdown(false);
                }}
                className={clsx(
                  'w-full text-left px-3 py-1.5 text-sm transition-colors',
                  filter === option.value
                    ? 'bg-accent-teal/20 text-accent-teal'
                    : 'text-text-secondary hover:bg-bg-tertiary'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render controls
  const renderControls = () => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary bg-bg-secondary">
      <div className="flex items-center gap-3">
        {renderConnectionStatus()}
        <span className="text-xs text-text-muted" data-testid="event-count">
          {filteredEvents.length} events
        </span>
      </div>

      <div className="flex items-center gap-2">
        {renderFilterDropdown()}

        <button
          onClick={() => setIsPaused(!isPaused)}
          className={clsx(
            'p-1 rounded transition-colors',
            isPaused
              ? 'bg-status-warning/20 text-status-warning'
              : 'text-text-muted hover:bg-bg-tertiary'
          )}
          aria-label={isPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
          data-testid="pause-button"
        >
          {isPaused ? (
            <PlayIcon className="h-4 w-4" />
          ) : (
            <PauseIcon className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={handleClear}
          className="p-1 rounded text-text-muted hover:bg-bg-tertiary transition-colors"
          aria-label="Clear events"
          data-testid="clear-button"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // Render single event
  const renderEvent = (event: SystemEvent) => {
    const isExpanded = expandedEvents.has(event.id);
    const hasMetadata = event.data && Object.keys(event.data).length > 0;

    return (
      <div
        key={event.id}
        className="border-b border-border-secondary last:border-b-0 hover:bg-bg-tertiary/50 transition-colors"
      >
        <button
          onClick={() => {
            if (hasMetadata) {
              toggleExpanded(event.id);
            }
            onEventClick?.(event);
          }}
          className="w-full text-left px-3 py-2 flex items-start gap-2"
        >
          {hasMetadata && (
            <span className="mt-0.5 text-text-muted">
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </span>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={clsx('text-sm', getEventColor(event.type))}>
                {getEventDescription(event)}
              </span>
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {formatRelativeTime(
                typeof event.timestamp === 'string'
                  ? event.timestamp
                  : event.timestamp.toISOString()
              )}
            </div>
          </div>
        </button>

        {isExpanded && hasMetadata && (
          <div className="px-3 pb-2 pl-9">
            <pre className="text-xs bg-bg-tertiary rounded p-2 overflow-x-auto text-text-secondary">
              {JSON.stringify(event.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-8 text-text-muted">
      <ArrowPathIcon className="h-8 w-8 mb-2" />
      <p className="text-sm">No events yet</p>
      {filter !== 'all' && (
        <button
          onClick={() => setFilter('all')}
          className="mt-2 text-xs text-accent-teal hover:underline"
        >
          Clear filter
        </button>
      )}
    </div>
  );

  return (
    <div
      className={clsx(
        'live-event-feed rounded-lg border border-border-primary overflow-hidden',
        className
      )}
    >
      {renderControls()}

      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="overflow-y-auto bg-bg-primary"
        style={{ maxHeight }}
        data-testid="event-feed"
      >
        {filteredEvents.length === 0
          ? renderEmptyState()
          : filteredEvents.map(renderEvent)}
      </div>

      {isPaused && (
        <div className="px-3 py-1.5 bg-status-warning/10 text-status-warning text-xs text-center border-t border-border-primary">
          Auto-scroll paused
        </div>
      )}
    </div>
  );
}
