import { useCallback } from 'react';
import type { CLISession } from '../../../shared/types/cli';
import { StatusBadge } from '../shared/StatusBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CLISessionListProps {
  sessions: CLISession[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onKill: (sessionId: string) => void;
  onNewSession: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

function truncateId(id: string, maxLen = 8): string {
  return id.length > maxLen ? id.slice(0, maxLen) : id;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * List of CLI sessions with status badges, PID, and started time.
 *
 * Each item is clickable to select and view output in the terminal panel.
 * Active (selected) session is highlighted. Kill button on running sessions.
 */
export default function CLISessionList({
  sessions,
  selectedSessionId,
  onSelect,
  onKill,
  onNewSession,
}: CLISessionListProps): JSX.Element {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-700 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-gray-200">Sessions</h3>
        <button
          type="button"
          onClick={onNewSession}
          className="px-2.5 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          + New
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-full px-3">
            <p className="text-xs text-gray-500 text-center">
              No sessions. Click + New to spawn a CLI session.
            </p>
          </div>
        ) : (
          <ul className="py-1">
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isSelected={session.id === selectedSessionId}
                onSelect={onSelect}
                onKill={onKill}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session list item
// ---------------------------------------------------------------------------

interface SessionItemProps {
  session: CLISession;
  isSelected: boolean;
  onSelect: (sessionId: string) => void;
  onKill: (sessionId: string) => void;
}

function SessionItem({
  session,
  isSelected,
  onSelect,
  onKill,
}: SessionItemProps): JSX.Element {
  const handleSelect = useCallback(() => {
    onSelect(session.id);
  }, [onSelect, session.id]);

  const handleKill = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onKill(session.id);
    },
    [onKill, session.id],
  );

  const isRunning = session.status === 'running' || session.status === 'starting';

  return (
    <li
      onClick={handleSelect}
      className={`
        px-3 py-2 cursor-pointer border-l-2 transition-colors
        ${
          isSelected
            ? 'bg-gray-700/60 border-l-blue-500'
            : 'border-l-transparent hover:bg-gray-800'
        }
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge status={session.status} size="sm" />
          <span className="text-xs font-mono text-gray-300 truncate">
            {truncateId(session.id)}
          </span>
        </div>
        {isRunning && (
          <button
            type="button"
            onClick={handleKill}
            className="px-1.5 py-0.5 text-[10px] font-medium rounded text-red-400 hover:bg-red-900/40 transition-colors shrink-0"
            title="Kill session"
          >
            Kill
          </button>
        )}
      </div>

      <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500">
        <span className="truncate">
          {session.config.command}{' '}
          {session.config.args.length > 0 ? session.config.args.join(' ') : ''}
        </span>
      </div>

      <div className="mt-0.5 flex items-center gap-3 text-[10px] text-gray-500">
        {session.pid && <span>PID: {session.pid}</span>}
        <span>{formatTime(session.startedAt)}</span>
      </div>
    </li>
  );
}
