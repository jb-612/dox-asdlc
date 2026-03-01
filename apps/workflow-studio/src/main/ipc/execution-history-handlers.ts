import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { ExecutionHistoryService } from '../services/execution-history-service';
import type { ExecutionEngine } from '../services/execution-engine';

export function registerExecutionHistoryHandlers(
  historyService: ExecutionHistoryService,
): void {
  ipcMain.handle(IPC_CHANNELS.EXECUTION_HISTORY_LIST, () => {
    return historyService.list();
  });

  ipcMain.handle(IPC_CHANNELS.EXECUTION_HISTORY_GET, (_event, id: string) => {
    if (typeof id !== 'string' || id.length === 0) {
      return { success: false, error: 'Invalid or missing id' };
    }
    const entry = historyService.getById(id);
    if (!entry) return { success: false, error: 'Not found' };
    return entry;
  });

  ipcMain.handle(IPC_CHANNELS.EXECUTION_HISTORY_CLEAR, async () => {
    await historyService.clear();
    return { success: true };
  });
}

export function registerReplayHandler(engine: ExecutionEngine): void {
  ipcMain.handle(
    IPC_CHANNELS.EXECUTION_REPLAY,
    (_event, request: { historyEntryId: string; mode: 'full' | 'resume' }) => {
      if (!request || typeof request !== 'object') {
        return { success: false, error: 'Invalid or missing request' };
      }
      if (typeof request.historyEntryId !== 'string' || !request.historyEntryId) {
        return { success: false, error: 'Missing or invalid historyEntryId' };
      }
      if (request.mode !== 'full' && request.mode !== 'resume') {
        return { success: false, error: 'Invalid mode (must be "full" or "resume")' };
      }
      return engine.replay(request);
    },
  );
}
