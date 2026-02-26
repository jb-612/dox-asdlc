import React from 'react';
import { useMonitoringStore } from '../../stores/monitoringStore';
import type { AgentSession } from '../../../shared/types/monitoring';

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const STATUS_BADGE: Record<AgentSession['status'], string> = {
  running: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-700',
};

export default function SessionList(): React.ReactElement {
  const sessions = useMonitoringStore((s) => s.sessions);
  const selectSession = useMonitoringStore((s) => s.selectSession);

  if (sessions.size === 0) {
    return (
      <div className="px-3 py-4 text-sm text-gray-400 text-center">No sessions</div>
    );
  }

  const sorted = [...sessions.values()].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (a.status !== 'running' && b.status === 'running') return 1;
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  return (
    <ul className="divide-y divide-gray-100">
      {sorted.map((session) => {
        const isEnded = session.status !== 'running';
        return (
          <li
            key={session.sessionId}
            onClick={() => selectSession(session.sessionId)}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 ${isEnded ? 'opacity-50' : ''}`}
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${session.status === 'running' ? 'bg-green-500' : 'bg-gray-400'}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-gray-900 truncate">{session.agentId}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[session.status]}`}>
                  {session.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                <span>{relativeTime(session.startedAt)}</span>
                <span>{session.eventCount} events</span>
                {session.totalCostUsd != null && (
                  <span>${session.totalCostUsd.toFixed(4)}</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
