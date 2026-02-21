import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { WorkflowDefinitionSchema } from '../schemas/workflow-schema';
import type { WorkflowDefinition } from '../../shared/types/workflow';
import type { WorkflowFileService } from '../services/workflow-file-service';

// ---------------------------------------------------------------------------
// Workflow IPC handlers
//
// Delegates workflow CRUD to the WorkflowFileService for persistent storage.
// Falls back to an in-memory Map for workflows that have not been saved to
// disk yet (e.g. the seeded sample workflows at startup).
// ---------------------------------------------------------------------------

/** In-memory cache for workflows not yet persisted to disk. */
const memoryCache: Map<string, WorkflowDefinition> = new Map();

/**
 * Register workflow IPC handlers.
 *
 * @param fileService  If provided, enables file-based persistence. When null
 *                     the handlers fall back to in-memory-only mode (useful
 *                     for tests).
 */
export function registerWorkflowHandlers(fileService: WorkflowFileService | null): void {
  // --- List ---------------------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.WORKFLOW_LIST, async () => {
    // Merge file-based and in-memory workflows
    const fileSummaries = fileService ? await fileService.list() : [];
    const fileIds = new Set(fileSummaries.map((s) => s.id));

    const memorySummaries = Array.from(memoryCache.values())
      .filter((w) => !fileIds.has(w.id))
      .map((w) => ({
        id: w.id,
        name: w.metadata.name,
        description: w.metadata.description,
        version: w.metadata.version,
        updatedAt: w.metadata.updatedAt,
        nodeCount: w.nodes.length,
        tags: w.metadata.tags,
      }));

    const fromFile = fileSummaries.map((s) => ({
      id: s.id,
      name: s.name,
      updatedAt: s.updatedAt,
      nodeCount: s.nodeCount,
    }));

    return [...fromFile, ...memorySummaries];
  });

  // --- Load ---------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_LOAD,
    async (_event, id: string) => {
      // Try file service first
      if (fileService) {
        const fromFile = await fileService.load(id);
        if (fromFile) return fromFile;
      }
      // Fall back to memory cache
      return memoryCache.get(id) ?? null;
    },
  );

  // --- Save ---------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_SAVE,
    async (_event, raw: unknown) => {
      const result = WorkflowDefinitionSchema.safeParse(raw);
      if (!result.success) {
        return {
          success: false,
          errors: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        };
      }

      const workflow = result.data as WorkflowDefinition;
      workflow.metadata.updatedAt = new Date().toISOString();

      // Persist to file if service is available
      if (fileService) {
        try {
          const saved = await fileService.save(workflow);
          // Remove from memory cache since it is now on disk
          memoryCache.delete(workflow.id);
          return saved;
        } catch (err: unknown) {
          console.error('[WorkflowHandlers] file save error, falling back to memory:', err);
        }
      }

      // Fall back to in-memory cache
      memoryCache.set(workflow.id, workflow);
      return { success: true, id: workflow.id };
    },
  );

  // --- Delete -------------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.WORKFLOW_DELETE,
    async (_event, id: string) => {
      let deleted = false;

      // Try file service first
      if (fileService) {
        deleted = await fileService.delete(id);
      }

      // Also remove from memory cache
      if (memoryCache.delete(id)) {
        deleted = true;
      }

      return { success: deleted };
    },
  );
}

/**
 * Seed a workflow into the in-memory cache. Used at startup to provide
 * sample workflows before the user has saved anything to disk.
 */
export function seedWorkflow(workflow: WorkflowDefinition): void {
  memoryCache.set(workflow.id, workflow);
}
