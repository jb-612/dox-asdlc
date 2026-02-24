import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { CLISpawnConfig, CLISession, SessionHistoryEntry, SessionSummary } from '../../shared/types/cli';
import type { CLISpawner } from '../services/cli-spawner';
import type { SessionHistoryService } from '../services/session-history-service';

// ---------------------------------------------------------------------------
// CLI IPC handlers
//
// Bridges IPC channels from the renderer to the CLISpawner service and
// SessionHistoryService. Each handler delegates directly to the service
// instances which manage the real child processes and persistent state.
// ---------------------------------------------------------------------------

export function registerCLIHandlers(
  spawner: CLISpawner,
  historyService: SessionHistoryService,
): void {
  // -------------------------------------------------------------------------
  // Core session operations (existing)
  // -------------------------------------------------------------------------

  ipcMain.handle(
    IPC_CHANNELS.CLI_SPAWN,
    async (_event, config: CLISpawnConfig) => {
      try {
        const session = spawner.spawn(config);
        return { success: true, sessionId: session.id, pid: session.pid };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.CLI_KILL,
    async (_event, sessionId: string) => {
      const killed = spawner.kill(sessionId);
      if (!killed) {
        return { success: false, error: 'Session not found' };
      }
      return { success: true };
    },
  );

  ipcMain.handle(IPC_CHANNELS.CLI_LIST, async () => {
    return spawner.list();
  });

  ipcMain.handle(
    IPC_CHANNELS.CLI_WRITE,
    async (_event, sessionId: string, data: string) => {
      const written = spawner.write(sessionId, data);
      if (!written) {
        return { success: false, error: 'Session not found or stdin unavailable' };
      }
      return { success: true };
    },
  );

  // -------------------------------------------------------------------------
  // Session history (P15-F06 T05/T06)
  // -------------------------------------------------------------------------

  ipcMain.handle(
    IPC_CHANNELS.CLI_SESSION_HISTORY,
    async (_event, limit?: number) => {
      return historyService.list(limit);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.CLI_SESSION_SAVE,
    async (_event, session: CLISession) => {
      try {
        const entry: SessionHistoryEntry = {
          id: session.id,
          config: session.config,
          startedAt: session.startedAt,
          exitedAt: session.exitedAt,
          exitCode: session.exitCode,
          mode: session.mode ?? 'local',
          context: session.context,
          sessionSummary: buildSessionSummary(session, spawner),
        };
        historyService.addEntry(entry);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Docker status (P15-F06 T03/T14)
  // -------------------------------------------------------------------------

  ipcMain.handle(IPC_CHANNELS.CLI_DOCKER_STATUS, async () => {
    return spawner.getDockerStatus();
  });

  // -------------------------------------------------------------------------
  // Docker images (P15-F06)
  // -------------------------------------------------------------------------

  ipcMain.handle(IPC_CHANNELS.CLI_LIST_IMAGES, async () => {
    return listDockerImages();
  });

  // -------------------------------------------------------------------------
  // Presets (P15-F06)
  // -------------------------------------------------------------------------

  ipcMain.handle(IPC_CHANNELS.CLI_PRESETS_LOAD, async () => {
    return historyService.loadPresets();
  });

  ipcMain.handle(
    IPC_CHANNELS.CLI_PRESETS_SAVE,
    async (_event, presets: unknown[]) => {
      try {
        historyService.savePresets(presets as never);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse the session output buffer for a lightweight summary (T15). */
function buildSessionSummary(
  session: CLISession,
  spawner: CLISpawner,
): SessionSummary | undefined {
  try {
    const output = spawner.getOutputBuffer(session.id);
    if (!output) return undefined;

    // Count tool-call patterns (Claude Code format: "Tool: <name>")
    const toolCallMatches = output.match(/(?:Tool|Using):\s+\w+/g);
    const toolCallCount = toolCallMatches?.length ?? 0;

    // Extract modified files from common patterns
    const filePatterns = output.match(/(?:Writing|Editing|Creating|Updated)\s+([^\s]+\.\w+)/g);
    const filesModified = filePatterns
      ? [...new Set(filePatterns.map((m) => m.replace(/^(?:Writing|Editing|Creating|Updated)\s+/, '')))]
      : [];

    const startMs = new Date(session.startedAt).getTime();
    const endMs = session.exitedAt
      ? new Date(session.exitedAt).getTime()
      : Date.now();
    const durationSeconds = Math.round((endMs - startMs) / 1000);

    let exitStatus: SessionSummary['exitStatus'] = 'success';
    if (session.exitCode !== undefined && session.exitCode !== 0) {
      exitStatus = 'error';
    } else if (session.status === 'error') {
      exitStatus = 'killed';
    }

    return { toolCallCount, filesModified, exitStatus, durationSeconds };
  } catch {
    return undefined;
  }
}

/** List locally available Docker images. */
function listDockerImages(): Promise<{ id: string; name: string; tag: string }[]> {
  return new Promise((resolve) => {
    execFile(
      'docker',
      ['images', '--format', '{{.ID}}|{{.Repository}}|{{.Tag}}'],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        const images = stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .map((line) => {
            const [id, name, tag] = line.split('|');
            return { id: id ?? '', name: name ?? '', tag: tag ?? '' };
          })
          .filter((img) => img.name !== '<none>');
        resolve(images);
      },
    );
  });
}
