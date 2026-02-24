import { useState, useCallback } from 'react';
import type { SessionHistoryEntry, CLISpawnConfig } from '../../../shared/types/cli';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionHistoryPanelProps {
  history: SessionHistoryEntry[];
  onRerun: (config: Partial<CLISpawnConfig>) => void;
  onClearAll: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(isoDate?: string): string {
  if (!isoDate) return '-';
  try {
    return new Date(isoDate).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

function exitBadge(exitCode?: number): JSX.Element {
  if (exitCode === undefined) {
    return <span className="text-[10px] text-gray-500">-</span>;
  }
  const color = exitCode === 0 ? 'bg-green-600' : 'bg-red-600';
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ${color} text-white`}>
      {exitCode}
    </span>
  );
}

function modeIcon(mode: string): string {
  return mode === 'docker' ? '\u{1F433}' : '\u{1F4BB}'; // whale vs computer
}

function formatDuration(seconds?: number): string {
  if (seconds === undefined) return '';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Collapsible panel showing session history entries.
 * Each entry shows mode, command, context, timestamps, and exit code.
 * "Re-run" opens SpawnDialog with the entry's config pre-filled.
 */
export default function SessionHistoryPanel({
  history,
  onRerun,
  onClearAll,
}: SessionHistoryPanelProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(true);

  const handleRerun = useCallback(
    (entry: SessionHistoryEntry) => {
      onRerun(entry.config);
    },
    [onRerun],
  );

  return (
    <div className="border-t border-gray-700">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-400">
          History ({history.length})
        </span>
        <span className="text-gray-500 text-[10px]">{collapsed ? '\u25BC' : '\u25B2'}</span>
      </button>

      {!collapsed && (
        <div className="max-h-[200px] overflow-y-auto">
          {history.length === 0 ? (
            <p className="px-3 py-2 text-[10px] text-gray-500 text-center">
              No history yet. Completed sessions appear here.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-700/50">
                {history.map((entry) => (
                  <li key={entry.id} className="px-3 py-2 hover:bg-gray-700/20 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs" title={entry.mode}>
                          {modeIcon(entry.mode)}
                        </span>
                        <span className="text-xs font-mono text-gray-300 truncate">
                          {entry.config.command} {entry.config.args.join(' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {exitBadge(entry.exitCode)}
                        <button
                          type="button"
                          onClick={() => handleRerun(entry)}
                          className="px-1.5 py-0.5 text-[10px] font-medium rounded text-blue-400 hover:bg-blue-900/40 transition-colors"
                          title="Re-run with this config"
                        >
                          Re-run
                        </button>
                      </div>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500">
                      <span>{formatTime(entry.startedAt)}</span>
                      {entry.sessionSummary && (
                        <>
                          <span>{formatDuration(entry.sessionSummary.durationSeconds)}</span>
                          {entry.sessionSummary.toolCallCount > 0 && (
                            <span>{entry.sessionSummary.toolCallCount} tools</span>
                          )}
                          {entry.sessionSummary.filesModified.length > 0 && (
                            <span>{entry.sessionSummary.filesModified.length} files</span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Context summary */}
                    {entry.context && (
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
                        {entry.context.repoPath && (
                          <span className="truncate max-w-[150px]" title={entry.context.repoPath}>
                            {entry.context.repoPath}
                          </span>
                        )}
                        {entry.context.githubIssue && (
                          <span>{entry.context.githubIssue}</span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* Clear all */}
              <div className="px-3 py-2 border-t border-gray-700/50">
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-[10px] font-medium text-gray-500 hover:text-red-400 transition-colors"
                >
                  Clear All History
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
