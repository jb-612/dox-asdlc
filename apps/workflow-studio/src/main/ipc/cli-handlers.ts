import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { CLISpawnConfig } from '../../shared/types/cli';
import type { CLISpawner } from '../services/cli-spawner';

// ---------------------------------------------------------------------------
// CLI IPC handlers
//
// Bridges IPC channels from the renderer to the CLISpawner service. Each
// handler delegates directly to the spawner instance which manages the real
// child processes.
// ---------------------------------------------------------------------------

export function registerCLIHandlers(spawner: CLISpawner): void {
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
}
