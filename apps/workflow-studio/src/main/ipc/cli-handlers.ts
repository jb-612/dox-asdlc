import { ipcMain, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { CLISession, CLISpawnConfig } from '../../shared/types/cli';

// ---------------------------------------------------------------------------
// In-memory CLI session tracking for development
// ---------------------------------------------------------------------------

const sessions: Map<string, CLISession> = new Map();

function emitToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send(channel, data);
  }
}

// ---------------------------------------------------------------------------
// IPC handler registration
// ---------------------------------------------------------------------------

export function registerCLIHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.CLI_SPAWN,
    async (_event, config: CLISpawnConfig) => {
      // Stub: simulate spawning a CLI session without actually starting a process.
      // In a real implementation this would use child_process.spawn.
      const session: CLISession = {
        id: uuidv4(),
        config,
        status: 'running',
        pid: Math.floor(Math.random() * 90000) + 10000,
        startedAt: new Date().toISOString(),
      };

      sessions.set(session.id, session);

      // Simulate initial CLI output after a short delay
      setTimeout(() => {
        emitToRenderer(IPC_CHANNELS.CLI_OUTPUT, {
          sessionId: session.id,
          data: `[stub] Claude CLI session started (pid: ${session.pid})\n`,
          timestamp: new Date().toISOString(),
        });
      }, 100);

      return { success: true, sessionId: session.id, pid: session.pid };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.CLI_KILL,
    async (_event, sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      session.status = 'exited';
      session.exitedAt = new Date().toISOString();
      session.exitCode = 0;

      emitToRenderer(IPC_CHANNELS.CLI_EXIT, {
        sessionId,
        exitCode: 0,
        timestamp: session.exitedAt,
      });

      return { success: true };
    },
  );

  ipcMain.handle(IPC_CHANNELS.CLI_LIST, async () => {
    return Array.from(sessions.values());
  });

  ipcMain.handle(
    IPC_CHANNELS.CLI_WRITE,
    async (_event, sessionId: string, data: string) => {
      const session = sessions.get(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }
      if (session.status !== 'running') {
        return { success: false, error: 'Session is not running' };
      }

      // Stub: echo the input back as output
      setTimeout(() => {
        emitToRenderer(IPC_CHANNELS.CLI_OUTPUT, {
          sessionId,
          data: `[stub echo] ${data}\n`,
          timestamp: new Date().toISOString(),
        });
      }, 50);

      return { success: true };
    },
  );
}
