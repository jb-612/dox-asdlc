import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { FormattedEvent } from './eventFormatter';

const ROW_HEIGHT = 36;
const BUFFER_ROWS = 10;

export interface VirtualizedEventLogProps<T> {
  events: T[];
  maxHeight?: number;
  autoScroll?: boolean;
  onEventClick?: (event: T) => void;
  formatter: (event: T) => FormattedEvent;
  /** Show auto-scroll toggle button (default: false) */
  showAutoScrollToggle?: boolean;
  /** Filter predicate — events failing this are hidden */
  filterPredicate?: (event: T) => boolean;
  /** Highlight events matching this text */
  searchText?: string;
}

const SEVERITY_COLORS: Record<FormattedEvent['severity'], string> = {
  info: '#9ca3af',
  warning: '#fbbf24',
  error: '#f87171',
};

function highlightText(text: string, searchText: string): JSX.Element {
  if (!searchText) return <>{text}</>;
  const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === searchText.toLowerCase() ? (
          <mark key={i} style={{ background: '#854d0e', color: '#fde68a', borderRadius: 2 }}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function VirtualizedEventLog<T>({
  events,
  maxHeight = 400,
  autoScroll = true,
  onEventClick,
  formatter,
  showAutoScrollToggle = false,
  filterPredicate,
  searchText,
}: VirtualizedEventLogProps<T>): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(autoScroll);

  const filteredEvents = useMemo(
    () => (filterPredicate ? events.filter(filterPredicate) : events),
    [events, filterPredicate],
  );

  const totalHeight = filteredEvents.length * ROW_HEIGHT;
  const visibleCount = Math.ceil(maxHeight / ROW_HEIGHT);
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endIdx = Math.min(filteredEvents.length, startIdx + visibleCount + BUFFER_ROWS * 2);

  const visibleEvents = useMemo(
    () => filteredEvents.slice(startIdx, endIdx),
    [filteredEvents, startIdx, endIdx],
  );

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    if (autoScrollEnabled && containerRef.current) {
      containerRef.current.scrollTop = totalHeight;
    }
  }, [filteredEvents.length, autoScrollEnabled, totalHeight]);

  return (
    <div style={{ position: 'relative' }}>
      {showAutoScrollToggle && (
        <button
          onClick={() => setAutoScrollEnabled((v) => !v)}
          aria-label="Auto-scroll"
          style={{
            position: 'absolute',
            top: 4,
            right: 8,
            zIndex: 10,
            padding: '2px 8px',
            fontSize: 10,
            background: '#374151',
            color: '#d1d5db',
            border: '1px solid #4b5563',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Auto-scroll {autoScrollEnabled ? 'ON' : 'OFF'}
        </button>
      )}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        role="log"
        style={{
          maxHeight,
          overflowY: 'auto',
          backgroundColor: '#111827',
          border: '1px solid #374151',
          borderRadius: 6,
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {filteredEvents.length === 0 && (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>
            No events yet
          </div>
        )}
        {filteredEvents.length > 0 && (
          <div style={{ height: totalHeight, position: 'relative' }}>
            {visibleEvents.map((event, i) => {
              const idx = startIdx + i;
              const formatted = formatter(event);
              return (
                <div
                  key={idx}
                  onClick={onEventClick ? () => onEventClick(event) : undefined}
                  style={{
                    position: 'absolute',
                    top: idx * ROW_HEIGHT,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    paddingLeft: 12,
                    paddingRight: 12,
                    cursor: onEventClick ? 'pointer' : 'default',
                    borderBottom: '1px solid #1f2937',
                    color: SEVERITY_COLORS[formatted.severity],
                  }}
                >
                  <span style={{ width: 20, textAlign: 'center', flexShrink: 0 }}>
                    {formatted.icon}
                  </span>
                  <span
                    style={{
                      width: 56,
                      flexShrink: 0,
                      color: '#6b7280',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatted.timestamp
                      ? new Date(formatted.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : ''}
                  </span>
                  <span style={{ width: 130, flexShrink: 0, fontWeight: 500 }}>
                    {searchText ? highlightText(formatted.label, searchText) : formatted.label}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#d1d5db',
                    }}
                  >
                    {searchText ? highlightText(formatted.detail, searchText) : formatted.detail}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
