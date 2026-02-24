import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { WorkflowDefinitionSchema } from '../schemas/workflow-schema';
import type { WorkflowDefinition } from '../../shared/types/workflow';
import type { WorkflowFileService } from '../services/workflow-file-service';

// ---------------------------------------------------------------------------
// Template IPC handlers (P15-F02)
//
// Delegates template CRUD to a dedicated WorkflowFileService instance that
// points to the template directory (separate from the workflow directory).
// ---------------------------------------------------------------------------

export function registerTemplateHandlers(fileService: WorkflowFileService): void {
  // --- List ---------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.TEMPLATE_LIST, async () => {
    const summaries = await fileService.list();
    return summaries.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      version: s.version,
      updatedAt: s.updatedAt,
      nodeCount: s.nodeCount,
      tags: s.tags,
      status: s.status ?? 'active',
    }));
  });

  // --- Load ---------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE_LOAD,
    async (_event, id: string) => {
      return fileService.load(id);
    },
  );

  // --- Save ---------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE_SAVE,
    async (_event, raw: unknown) => {
      const result = WorkflowDefinitionSchema.safeParse(raw);
      if (!result.success) {
        return {
          success: false,
          error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        };
      }

      const workflow = result.data as WorkflowDefinition;
      workflow.metadata.updatedAt = new Date().toISOString();

      try {
        const saved = await fileService.save(workflow);
        return { success: saved.success };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown save error';
        return { success: false, error: message };
      }
    },
  );

  // --- Delete -------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE_DELETE,
    async (_event, id: string) => {
      const deleted = await fileService.delete(id);
      return { success: deleted };
    },
  );

  // --- Toggle Status ------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE_TOGGLE_STATUS,
    async (_event, id: string) => {
      const template = await fileService.load(id);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      const currentStatus = template.metadata.status ?? 'active';
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      template.metadata.status = newStatus;
      template.metadata.updatedAt = new Date().toISOString();

      try {
        await fileService.save(template);
        return { success: true, status: newStatus };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    },
  );

  // --- Duplicate ----------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE_DUPLICATE,
    async (_event, id: string) => {
      const template = await fileService.load(id);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      const clone: WorkflowDefinition = JSON.parse(JSON.stringify(template));
      clone.id = uuidv4();
      clone.metadata.name = `${template.metadata.name} (Copy)`;
      clone.metadata.status = 'active';
      clone.metadata.createdAt = new Date().toISOString();
      clone.metadata.updatedAt = new Date().toISOString();

      try {
        await fileService.save(clone);
        return { success: true, id: clone.id };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
      }
    },
  );
}
