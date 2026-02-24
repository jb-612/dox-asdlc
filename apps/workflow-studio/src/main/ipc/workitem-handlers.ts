import { ipcMain } from 'electron';
import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { WorkItemType, WorkItemReference } from '../../shared/types/workitem';
import type { WorkItemService } from '../services/workitem-service';

// ---------------------------------------------------------------------------
// Work Item IPC handlers
//
// Bridges IPC channels from the renderer to the WorkItemService which reads
// PRDs from the filesystem and issues from GitHub.
//
// Also provides WORKITEM_LIST_FS for reading work items directly from a
// filesystem directory (P15-F03).
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

  // --- List work items from filesystem directory (P15-F03) -----------------
  ipcMain.handle(
    IPC_CHANNELS.WORKITEM_LIST_FS,
    async (_event, directory?: string): Promise<WorkItemReference[]> => {
      const dir = directory || '';
      if (!dir) {
        return [];
      }

      const resolved = resolve(dir);
      if (resolved.includes('..') || dir.includes('..')) {
        console.error('[WorkItemHandlers] listFs: path traversal rejected:', dir);
        return [];
      }

      try {
        const dirStat = await stat(resolved);
        if (!dirStat.isDirectory()) {
          console.error('[WorkItemHandlers] listFs: not a directory:', resolved);
          return [];
        }

        const entries = await readdir(resolved, { withFileTypes: true });
        const items: WorkItemReference[] = [];

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const fullPath = join(resolved, entry.name);
          let title = entry.name;

          // Try to read a design.md or prd.md or user_stories.md for a title
          for (const filename of ['design.md', 'prd.md', 'user_stories.md']) {
            try {
              const content = await readFile(join(fullPath, filename), 'utf-8');
              const match = content.match(/^#\s+(.+)/m);
              if (match) {
                title = match[1];
              }
              break;
            } catch {
              // Try next file
            }
          }

          items.push({
            id: entry.name,
            title,
            type: 'prd',
            source: 'filesystem',
            path: fullPath,
          });
        }

        return items;
      } catch (err: unknown) {
        console.error('[WorkItemHandlers] listFs error:', err);
        return [];
      }
    },
  );
}
