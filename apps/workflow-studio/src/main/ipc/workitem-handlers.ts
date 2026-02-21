import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { WorkItemType } from '../../shared/types/workitem';
import type { WorkItemService } from '../services/workitem-service';

// ---------------------------------------------------------------------------
// Work Item IPC handlers
//
// Bridges IPC channels from the renderer to the WorkItemService which reads
// PRDs from the filesystem and issues from GitHub.
// ---------------------------------------------------------------------------

export function registerWorkItemHandlers(service: WorkItemService): void {
  ipcMain.handle(
    IPC_CHANNELS.WORKITEM_LIST,
    async (_event, type?: string) => {
      try {
        if (!type || type === 'all') {
          return await service.listAll();
        }
        return await service.list(type as WorkItemType);
      } catch (err: unknown) {
        console.error('[WorkItemHandlers] list error:', err);
        return [];
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKITEM_GET,
    async (_event, id: string) => {
      try {
        return await service.get(id);
      } catch (err: unknown) {
        console.error('[WorkItemHandlers] get error:', err);
        return null;
      }
    },
  );
}
