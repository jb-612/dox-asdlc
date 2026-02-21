import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { ExecutionEngine } from '../services/execution-engine';
import type { WorkflowDefinition } from '../../shared/types/workflow';
import type { WorkItemReference } from '../../shared/types/workitem';

// ---------------------------------------------------------------------------
// Execution IPC handlers
//
// Bridges IPC channels from the renderer to the ExecutionEngine running in
// the main process. A single engine instance is maintained; only one
// execution can run at a time.
// ---------------------------------------------------------------------------

let engine: ExecutionEngine | null = null;

/**
 * Lazily obtain (or create) the ExecutionEngine, attaching it to the first
 * available BrowserWindow. A new engine is created for each execution to
 * guarantee a clean state.
 */
function getOrCreateEngine(): ExecutionEngine {
  const windows = BrowserWindow.getAllWindows();
  const mainWindow = windows[0] ?? null;

  if (!mainWindow) {
    throw new Error('No BrowserWindow available for execution');
  }

  if (!engine) {
    engine = new ExecutionEngine(mainWindow);
  }
  return engine;
}

// ---------------------------------------------------------------------------
// In-memory workflow lookup (mirrors workflow-handlers.ts seed store).
//
// In a production build the engine would receive the full workflow from the
// renderer or load it from persistent storage. For now we accept the
// workflow object directly in the start payload.
// ---------------------------------------------------------------------------

export function registerExecutionHandlers(): void {
  // --- Start execution ---------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.EXECUTION_START,
    async (
      _event,
      config: {
        workflowId: string;
        workflow?: WorkflowDefinition;
        workItem?: WorkItemReference;
        variables?: Record<string, unknown>;
      },
    ) => {
      // Refuse if already running
      if (engine?.isActive()) {
        return {
          success: false,
          error: 'An execution is already in progress. Abort it first.',
        };
      }

      // The renderer should pass the full workflow definition. If it does
      // not, we build a minimal stub so the engine can still start.
      const workflow: WorkflowDefinition = config.workflow ?? {
        id: config.workflowId,
        metadata: {
          name: 'Unknown Workflow',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
        nodes: [],
        transitions: [],
        gates: [],
        variables: [],
      };

      // Merge initial variables into the workflow if provided
      const workItem = config.workItem;

      // Fresh engine per execution
      const windows = BrowserWindow.getAllWindows();
      const mainWindow = windows[0] ?? null;
      if (!mainWindow) {
        return { success: false, error: 'No BrowserWindow available' };
      }
      engine = new ExecutionEngine(mainWindow);

      // Start is async and runs in the background -- we return immediately
      // with the execution ID while the engine drives the workflow.
      const executionPromise = engine.start(workflow, workItem);

      // Inject initial variables
      const state = engine.getState();
      if (state && config.variables) {
        Object.assign(state.variables, config.variables);
      }

      // Do not await -- let the traversal run in the background
      executionPromise.catch((err: unknown) => {
        console.error('[ExecutionEngine] Unexpected error:', err);
      });

      return {
        success: true,
        executionId: state?.id ?? 'unknown',
      };
    },
  );

  // --- Pause execution ---------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.EXECUTION_PAUSE, async () => {
    const eng = engine;
    if (!eng || !eng.isActive()) {
      return { success: false, error: 'No running execution to pause' };
    }
    eng.pause();
    return { success: true };
  });

  // --- Resume execution --------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.EXECUTION_RESUME, async () => {
    const eng = engine;
    if (!eng) {
      return { success: false, error: 'No paused execution to resume' };
    }
    eng.resume();
    return { success: true };
  });

  // --- Abort execution ---------------------------------------------------
  ipcMain.handle(IPC_CHANNELS.EXECUTION_ABORT, async () => {
    const eng = engine;
    if (!eng) {
      return { success: false, error: 'No active execution to abort' };
    }
    eng.abort();
    const state = eng.getState();
    return { success: true, executionId: state?.id };
  });

  // --- Gate decision -----------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.EXECUTION_GATE_DECISION,
    async (
      _event,
      decision: {
        executionId: string;
        gateId: string;
        nodeId: string;
        decision: string;
        comment?: string;
      },
    ) => {
      const eng = engine;
      if (!eng) {
        return { success: false, error: 'No active execution' };
      }

      const state = eng.getState();
      if (!state || state.id !== decision.executionId) {
        return { success: false, error: 'Execution not found' };
      }

      eng.submitGateDecision(decision.nodeId, decision.decision);
      return { success: true };
    },
  );
}
