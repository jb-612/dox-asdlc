/**
 * RunTimeline - Chronological event timeline for a run
 *
 * Displays events with visual markers, expandable details, and filtering.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlayIcon,
  StopIcon,
  WrenchIcon,
  DocumentIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Event type */
export type EventType = 'start' | 'tool_call' | 'artifact' | 'completion' | 'failure' | 'info';

/** Timeline event */
export interface TimelineEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: EventType;
  /** Timestamp */
  timestamp: string;
  /** Event message */
  message: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

export interface RunTimelineProps {
  /** Events to display */
  events: TimelineEvent[];
  /** Loading state */
  isLoading?: boolean;
  /** Auto-scroll to latest */
  autoScroll?: boolean;
  /** Show relative time from start */
  showRelativeTime?: boolean;
  /** Show filter dropdown */
  showFilter?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when event is clicked */
  onEventClick?: (eventId: string) => void;
}

// Event type configuration
const eventConfig: Record<EventType, { icon: typeof PlayIcon; label: string; bgClass: string; textClass: string }> = {
  start: {
    icon: PlayIcon,
    label: 'Start',
    bgClass: 'bg-accent-teal',
    textClass: 'text-accent-teal',
  },
  tool_call: {
    icon: WrenchIcon,
    label: 'Tool Call',
    bgClass: 'bg-accent-purple',
    textClass: 'text-accent-purple',
  },
  artifact: {
    icon: DocumentIcon,
    label: 'Artifact',
    bgClass: 'bg-accent-blue',
    textClass: 'text-accent-blue',
  },
  completion: {
    icon: CheckCircleIcon,
    label: 'Completed',
    bgClass: 'bg-status-success',
    textClass: 'text-status-success',
  },
  failure: {
    icon: ExclamationCircleIcon,
    label: 'Failed',
    bgClass: 'bg-status-error',
    textClass: 'text-status-error',
  },
  info: {
    icon: StopIcon,
    label: 'Info',
    bgClass: 'bg-text-muted',
    textClass: 'text-text-muted',
  },
};

export default function RunTimeline({
  events,
  isLoading = false,
  autoScroll = false,
  showRelativeTime = false,
  showFilter = false,
  className,
  onEventClick,
}: RunTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  // Toggle event expansion
  const toggleExpand = useCallback((eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  // Expand all events
  const expandAll = useCallback(() => {
    setExpandedEvents(new Set(events.map((e) => e.id)));
  }, [events]);

  // Collapse all events
  const collapseAll = useCallback(() => {
    setExpandedEvents(new Set());
  }, []);

  // Handle event click
  const handleEventClick = useCallback(
    (eventId: string) => {
      onEventClick?.(eventId);
    },
    [onEventClick]
  );

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  // Get start timestamp for relative time
  const startTimestamp = useMemo(() => {
    const startEvent = events.find((e) => e.type === 'start');
    return startEvent ? new Date(startEvent.timestamp).getTime() : null;
  }, [events]);

  // Format time
  const formatTime = useCallback(
    (timestamp: string) => {
      const date = new Date(timestamp);
      if (showRelativeTime && startTimestamp) {
        const diffMs = date.getTime() - startTimestamp;
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return `+${diffSec}s`;
        const diffMin = Math.floor(diffSec / 60);
        const remainingSec = diffSec % 60;
        return `+${diffMin}m ${remainingSec}s`;
      }
      return date.toLocaleTimeString();
    },
    [showRelativeTime, startTimestamp]
  );

  // Format details for display
  const formatDetails = (details: Record<string, unknown>) => {
    return Object.entries(details).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
    }));
  };

  // Auto-scroll to latest event
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  // Check if all expanded
  const allExpanded = expandedEvents.size === events.length && events.length > 0;

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)}
        data-testid="timeline-loading"
      >
        <h3 className="text-lg font-semibold text-text-primary mb-4">Timeline</h3>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex gap-4"
              data-testid="event-skeleton"
            >
              <div className="w-3 h-3 rounded-full bg-bg-tertiary animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-bg-tertiary rounded animate-pulse" />
                <div className="h-3 w-64 bg-bg-tertiary rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (events.length === 0) {
    return (
      <div
        className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)}
        data-testid="run-timeline"
      >
        <h3 className="text-lg font-semibold text-text-primary mb-4">Timeline</h3>
        <p className="text-center text-text-muted py-8">No events recorded</p>
      </div>
    );
  }

  return (
    <div
      className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)}
      data-testid="run-timeline"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Timeline</h3>
        <div className="flex items-center gap-2">
          {/* Filter */}
          {showFilter && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EventType | 'all')}
              className="h-8 px-2 text-sm rounded-lg border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-teal"
              data-testid="event-filter"
            >
              <option value="all">All Events</option>
              <option value="start">Start</option>
              <option value="tool_call">Tool Calls</option>
              <option value="artifact">Artifacts</option>
              <option value="completion">Completion</option>
              <option value="failure">Failures</option>
            </select>
          )}

          {/* Expand/Collapse All */}
          {!allExpanded ? (
            <button
              onClick={expandAll}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
              data-testid="expand-all"
            >
              Expand All
            </button>
          ) : (
            <button
              onClick={collapseAll}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
              data-testid="collapse-all"
            >
              Collapse All
            </button>
          )}
        </div>
      </div>

      {/* Timeline container */}
      <div
        ref={containerRef}
        className="max-h-96 overflow-y-auto pr-2"
        data-testid="timeline-container"
      >
        <ul className="relative space-y-0" role="list">
          {/* Timeline line */}
          <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-border-secondary" />

          {filteredEvents.map((event, index) => {
            const config = eventConfig[event.type];
            const Icon = config.icon;
            const isExpanded = expandedEvents.has(event.id);
            const isLast = index === filteredEvents.length - 1;

            return (
              <li
                key={event.id}
                className={clsx(
                  'relative pl-6 pb-4',
                  isLast && 'pb-0',
                  onEventClick && 'cursor-pointer'
                )}
                data-testid={`event-${event.id}`}
                onClick={() => onEventClick && handleEventClick(event.id)}
                role="listitem"
              >
                {/* Marker */}
                <div
                  className={clsx(
                    'absolute left-0 w-3 h-3 rounded-full flex items-center justify-center',
                    config.bgClass
                  )}
                  data-testid={`marker-${event.type}`}
                >
                  <Icon className="h-2 w-2 text-white" />
                </div>

                {/* Content */}
                <div className="bg-bg-tertiary rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Timestamp and type */}
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs text-text-muted font-mono"
                          data-testid={`time-${event.id}`}
                        >
                          {formatTime(event.timestamp)}
                        </span>
                        <span className={clsx('text-xs', config.textClass)}>
                          {config.label}
                        </span>
                      </div>

                      {/* Message */}
                      <p className="text-sm text-text-primary">{event.message}</p>
                    </div>

                    {/* Expand button */}
                    {event.details && (
                      <button
                        onClick={(e) => toggleExpand(event.id, e)}
                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors"
                        data-testid={`expand-${event.id}`}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Details (expanded) */}
                  {isExpanded && event.details && (
                    <div
                      className="mt-3 pt-3 border-t border-border-secondary"
                      data-testid={`details-${event.id}`}
                    >
                      <dl className="space-y-1 text-xs">
                        {formatDetails(event.details).map(({ key, value }) => (
                          <div key={key} className="flex gap-2">
                            <dt className="text-text-muted capitalize">{key}:</dt>
                            <dd className="text-text-secondary font-mono break-all">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
