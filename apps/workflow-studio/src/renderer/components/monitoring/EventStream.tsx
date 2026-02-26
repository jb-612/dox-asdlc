// ---------------------------------------------------------------------------
// EventStream (P15, T09)
//
// Table showing filtered telemetry events newest-first.
// Columns: Time | Agent | Type | Tool | Details
// ---------------------------------------------------------------------------

import React, { useRef, useEffect, useState } from 'react';
import { useMonitoringStore, selectFilteredEvents } from '../../stores/monitoringStore';
import type { TelemetryEventType } from '../../../shared/types/monitoring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const TYPE_COLORS: Record<TelemetryEventType, string> = {
  agent_start:    'bg-blue-100 text-blue-800',
  agent_complete: 'bg-green-100 text-green-800',
  agent_error:    'bg-red-100 text-red-800',
  tool_call:      'bg-purple-100 text-purple-800',
  bash_command:   'bg-yellow-100 text-yellow-800',
  metric:         'bg-gray-100 text-gray-700',
  lifecycle:      'bg-indigo-100 text-indigo-800',
  token_usage:    'bg-orange-100 text-orange-800',
  custom:         'bg-gray-100 text-gray-700',
};

function extractFields(data: unknown): { tool: string; details: string } {
  if (data == null || typeof data !== 'object') return { tool: '-', details: '-' };
  const d = data as Record<string, unknown>;
  const tool = (typeof d.toolName === 'string' ? d.toolName
    : typeof d.command === 'string' ? d.command
    : '-');
  const rawDetails = typeof d.errorMessage === 'string' ? d.errorMessage
    : typeof d.toolResultSummary === 'string' ? d.toolResultSummary
    : '-';
  const details = rawDetails.length > 80 ? rawDetails.slice(0, 77) + '...' : rawDetails;
  return { tool, details };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventStream() {
  const events = useMonitoringStore(selectFilteredEvents);
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Newest-first
  const sorted = [...events].reverse();

  // Auto-scroll to top on new event only if already at top
  useEffect(() => {
    const el = containerRef.current;
    if (el && el.scrollTop < 40) {
      el.scrollTop = 0;
    }
  }, [events.length]);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No events yet
      </div>
    );
  }

  return (
    <div ref={containerRef} className="overflow-auto max-h-96 text-xs font-mono">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-white text-gray-500 uppercase text-[10px] tracking-wide">
          <tr>
            <th className="px-2 py-1 text-left w-20">Time</th>
            <th className="px-2 py-1 text-left w-28">Agent</th>
            <th className="px-2 py-1 text-left w-28">Type</th>
            <th className="px-2 py-1 text-left w-24">Tool</th>
            <th className="px-2 py-1 text-left">Details</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((event) => {
            const { tool, details } = extractFields(event.data);
            const isError = event.type === 'agent_error';
            const isExpanded = expandedId === event.id;
            return (
              <React.Fragment key={event.id}>
                <tr
                  className={`cursor-pointer border-t border-gray-100 hover:bg-gray-50 ${isError ? 'bg-red-50' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                >
                  <td className="px-2 py-1 text-gray-500 whitespace-nowrap">{relativeTime(event.timestamp)}</td>
                  <td className="px-2 py-1 truncate max-w-[7rem]" title={event.agentId}>{event.agentId}</td>
                  <td className="px-2 py-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_COLORS[event.type]}`}>
                      {event.type}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-gray-600">{tool}</td>
                  <td className="px-2 py-1 text-gray-700 truncate max-w-xs">{details}</td>
                </tr>
                {isExpanded && (
                  <tr className={isError ? 'bg-red-50' : 'bg-gray-50'}>
                    <td colSpan={5} className="px-4 py-2">
                      <pre className="text-[10px] whitespace-pre-wrap break-all text-gray-700">
                        {JSON.stringify(event, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
