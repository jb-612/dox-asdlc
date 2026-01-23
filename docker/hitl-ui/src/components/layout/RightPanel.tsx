import { useState, useEffect, useRef } from 'react';
import {
  XMarkIcon,
  FunnelIcon,
  ArrowPathIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { useEventStore, SystemEvent } from '@/stores/eventStore';
import clsx from 'clsx';

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const eventTypeColors: Record<string, string> = {
  run_started: 'text-accent-teal',
  run_completed: 'text-status-success',
  run_failed: 'text-status-error',
  gate_pending: 'text-status-warning',
  gate_approved: 'text-status-success',
  gate_rejected: 'text-status-error',
  agent_spawned: 'text-accent-purple',
  tool_call: 'text-text-secondary',
  default: 'text-text-muted',
};

function EventItem({ event }: { event: SystemEvent }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = eventTypeColors[event.type] || eventTypeColors.default;

  return (
    <div
      className="border-b border-bg-tertiary py-2 cursor-pointer hover:bg-bg-tertiary/30 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <div className={clsx('flex-shrink-0 mt-1 h-2 w-2 rounded-full', colorClass.replace('text-', 'bg-'))} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={clsx('text-xs font-medium uppercase', colorClass)}>
              {event.type.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-text-muted flex-shrink-0">
              {formatTime(event.timestamp)}
            </span>
          </div>
          <p className="text-sm text-text-primary truncate mt-0.5">
            {event.description}
          </p>
          {event.epicId && (
            <span className="text-xs text-text-muted">{event.epicId}</span>
          )}
          {expanded && event.metadata && (
            <div className="mt-2 p-2 bg-bg-tertiary rounded text-xs font-mono text-text-secondary overflow-x-auto">
              <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return date.toLocaleTimeString();
}

export default function RightPanel({ isOpen, onClose }: RightPanelProps) {
  const {
    events,
    connected,
    reconnecting,
    connectionError,
    autoScroll,
    setAutoScroll,
    getFilteredEvents,
    clearEvents,
    filter,
    setFilter,
  } = useEventStore();

  const feedRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredEvents = getFilteredEvents();

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  if (!isOpen) return null;

  return (
    <div className="flex w-80 flex-col border-l border-bg-tertiary bg-bg-secondary">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-bg-tertiary px-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">Live Events</h3>
          {connected ? (
            <div className="h-2 w-2 rounded-full bg-status-success animate-pulse" />
          ) : reconnecting ? (
            <div className="h-2 w-2 rounded-full bg-status-warning animate-pulse" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-status-error" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={clsx(
              'p-1.5 rounded hover:bg-bg-tertiary transition-colors',
              autoScroll ? 'text-accent-teal' : 'text-text-secondary'
            )}
            title={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
          >
            {autoScroll ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={clsx(
              'p-1.5 rounded hover:bg-bg-tertiary transition-colors',
              filter ? 'text-accent-teal' : 'text-text-secondary'
            )}
            title="Filter events"
          >
            <FunnelIcon className="h-4 w-4" />
          </button>
          <button
            onClick={clearEvents}
            className="p-1.5 rounded text-text-secondary hover:bg-bg-tertiary transition-colors"
            title="Clear events"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-text-secondary hover:bg-bg-tertiary transition-colors"
            title="Close panel"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter dropdown */}
      {filterOpen && (
        <div className="border-b border-bg-tertiary p-3 bg-bg-tertiary/50">
          <label className="text-xs text-text-secondary block mb-2">
            Filter by event type
          </label>
          <div className="flex flex-wrap gap-1">
            {['run_started', 'run_completed', 'run_failed', 'gate_pending', 'gate_approved', 'gate_rejected'].map((type) => (
              <button
                key={type}
                onClick={() => {
                  const currentTypes = filter?.types || [];
                  const newTypes = currentTypes.includes(type)
                    ? currentTypes.filter((t) => t !== type)
                    : [...currentTypes, type];
                  setFilter(newTypes.length > 0 ? { ...filter, types: newTypes } : null);
                }}
                className={clsx(
                  'text-xs px-2 py-1 rounded',
                  filter?.types?.includes(type)
                    ? 'bg-accent-teal text-text-primary'
                    : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
                )}
              >
                {type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Connection error */}
      {connectionError && (
        <div className="px-4 py-2 bg-status-error/10 text-status-error text-xs">
          {connectionError}
        </div>
      )}

      {/* Event feed */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto px-4"
      >
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-muted text-sm">
            <p>No events yet</p>
            {!connected && <p className="text-xs mt-1">Waiting for connection...</p>}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <EventItem key={event.id} event={event} />
          ))
        )}
      </div>

      {/* Footer with stats */}
      <div className="border-t border-bg-tertiary px-4 py-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{filteredEvents.length} events</span>
          <span>{connected ? 'Connected' : reconnecting ? 'Reconnecting...' : 'Disconnected'}</span>
        </div>
      </div>
    </div>
  );
}
