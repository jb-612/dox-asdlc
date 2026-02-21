import { useEffect, useState, useCallback, useMemo } from 'react';
import { useCLIStore } from '../stores/cliStore';
import type { CLISpawnConfig } from '../../shared/types/cli';
import CLISessionList from '../components/cli/CLISessionList';
import TerminalPanel from '../components/cli/TerminalPanel';
import SpawnDialog from '../components/cli/SpawnDialog';

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

/**
 * CLIManagerPage -- manage and interact with Claude CLI sessions.
 *
 * Layout:
 *  - Left panel (~300px): session list with status badges
 *  - Right panel (flex-1): terminal output for selected session
 *
 * Features:
 *  - "New Session" button opens SpawnDialog
 *  - Click session to view its terminal output
 *  - Kill button on running sessions
 *  - Stdin input for running sessions
 */
export default function CLIManagerPage(): JSX.Element {
  const sessions = useCLIStore((s) => s.sessions);
  const outputBuffers = useCLIStore((s) => s.outputBuffers);
  const selectedSessionId = useCLIStore((s) => s.selectedSessionId);
  const selectSession = useCLIStore((s) => s.selectSession);
  const spawnSession = useCLIStore((s) => s.spawnSession);
  const killSession = useCLIStore((s) => s.killSession);
  const writeToSession = useCLIStore((s) => s.writeToSession);
  const subscribe = useCLIStore((s) => s.subscribe);
  const unsubscribe = useCLIStore((s) => s.unsubscribe);
  const loadSessions = useCLIStore((s) => s.loadSessions);
  const lastError = useCLIStore((s) => s.lastError);

  const [isSpawnOpen, setIsSpawnOpen] = useState(false);

  // Subscribe to IPC events on mount
  useEffect(() => {
    subscribe();
    loadSessions();
    return () => {
      unsubscribe();
    };
  }, [subscribe, unsubscribe, loadSessions]);

  // Convert Map to sorted array for the session list
  const sessionList = useMemo(() => {
    const list = Array.from(sessions.values());
    // Sort: running first, then by started time descending
    list.sort((a, b) => {
      const statusOrder = { starting: 0, running: 1, exited: 2, error: 3 };
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
    return list;
  }, [sessions]);

  // Terminal output for selected session
  const selectedOutput = useMemo(() => {
    if (!selectedSessionId) return [];
    return outputBuffers.get(selectedSessionId) ?? [];
  }, [selectedSessionId, outputBuffers]);

  // Selected session object
  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null;
    return sessions.get(selectedSessionId) ?? null;
  }, [selectedSessionId, sessions]);

  const handleSpawn = useCallback(
    (config: CLISpawnConfig) => {
      spawnSession(config);
    },
    [spawnSession],
  );

  const handleKill = useCallback(
    (sessionId: string) => {
      killSession(sessionId);
    },
    [killSession],
  );

  const handleWrite = useCallback(
    (data: string) => {
      if (selectedSessionId) {
        writeToSession(selectedSessionId, data);
      }
    },
    [selectedSessionId, writeToSession],
  );

  return (
    <div className="h-full flex flex-col">
      {/* Error banner */}
      {lastError && (
        <div className="px-4 py-2 bg-red-900/50 border-b border-red-800 text-red-300 text-xs shrink-0">
          {lastError}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Session list */}
        <div className="w-[300px] bg-gray-800 border-r border-gray-700 shrink-0">
          <CLISessionList
            sessions={sessionList}
            selectedSessionId={selectedSessionId}
            onSelect={selectSession}
            onKill={handleKill}
            onNewSession={() => setIsSpawnOpen(true)}
          />
        </div>

        {/* Right: Terminal output */}
        <div className="flex-1 min-w-0">
          <TerminalPanel
            outputLines={selectedOutput}
            hasSession={selectedSessionId !== null}
            isRunning={selectedSession?.status === 'running' || selectedSession?.status === 'starting'}
            onWrite={handleWrite}
          />
        </div>
      </div>

      {/* Spawn dialog */}
      <SpawnDialog
        isOpen={isSpawnOpen}
        onClose={() => setIsSpawnOpen(false)}
        onSpawn={handleSpawn}
      />
    </div>
  );
}
