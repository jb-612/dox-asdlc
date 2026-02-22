import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { ExecutionEngine } from '../services/execution-engine';
import type { CLISpawner } from '../services/cli-spawner';
import type { RedisEventClient } from '../services/redis-client';
import type { SettingsService } from '../services/settings-service';
import type { WorkflowDefinition } from '../../shared/types/workflow';
import type { WorkItemReference } from '../../shared/types/workitem';

// ---------------------------------------------------------------------------
// Execution IPC handlers
//
// Bridges IPC channels from the renderer to the ExecutionEngine running in
// the main process. A single engine instance is maintained; only one
// execution can run at a time.
//
// The handlers accept an optional CLISpawner and RedisEventClient for real
// CLI execution mode. When mockMode is false in the start config, the engine
// spawns real CLI processes instead of using simulated delays.
// ---------------------------------------------------------------------------

let engine: ExecutionEngine | null = null;

export interface ExecutionHandlerDeps {
  cliSpawner?: CLISpawner;
  redisClient?: RedisEventClient;
  settingsService?: SettingsService;
}

// ---------------------------------------------------------------------------
// In-memory workflow lookup (mirrors workflow-handlers.ts seed store).
//
// In a production build the engine would receive the full workflow from the
// renderer or load it from persistent storage. For now we accept the
// workflow object directly in the start payload.
// ---------------------------------------------------------------------------

export function registerExecutionHandlers(deps?: ExecutionHandlerDeps): void {
  const cliSpawner = deps?.cliSpawner;
  const redisClient = deps?.redisClient;
  const settingsService = deps?.settingsService;

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
        mockMode?: boolean;
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

      engine = new ExecutionEngine(mainWindow, {
        mockMode: config.mockMode ?? true,
        cliSpawner: cliSpawner ?? undefined,
        redisClient: redisClient ?? undefined,
        remoteAgentUrl: settingsService?.get().cursorAgentUrl || undefined,
      });

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
        selectedOption: string;
        decidedBy?: string;
        reason?: string;
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

      eng.submitGateDecision(decision.nodeId, decision.selectedOption);
      return { success: true };
    },
  );

  // --- CLI Exit forwarding -----------------------------------------------
  // CLISpawner sends CLI_EXIT via ipcMain when a pty process exits.
  // Forward the exit to the active engine so it can resolve node waits.
  if (cliSpawner) {
    ipcMain.on(IPC_CHANNELS.CLI_EXIT, (_event, data: { sessionId: string; exitCode: number }) => {
      if (engine) {
        engine.handleCLIExit(data.sessionId, data.exitCode);
      }
    });
  }
}
