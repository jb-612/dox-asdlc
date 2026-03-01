import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { ExecutionEngine } from '../services/execution-engine';
import type { EngineHost } from '../../cli/types';
import type { CLISpawner } from '../services/cli-spawner';
import type { RedisEventClient } from '../services/redis-client';
import type { SettingsService } from '../services/settings-service';
import type { ExecutorContainerPool } from '../services/workflow-executor';
import type { WorkflowDefinition } from '../../shared/types/workflow';
import type { WorkItemReference } from '../../shared/types/workitem';
import type { RepoMount } from '../../shared/types/repo';

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
  /** Getter for the container pool. Called at execution start time so the
   *  pool can be initialized asynchronously after handler registration. */
  getContainerPool?: () => ExecutorContainerPool | null;
  /** Execution history service for persistent history (P15-F14) */
  historyService?: import('../services/execution-history-service').ExecutionHistoryService;
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
  const getContainerPool = deps?.getContainerPool;
  const historyService = deps?.historyService;

  // --- Start execution ---------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.EXECUTION_START,
    async (
      _event,
      config: {
        workflowId: string;
        workflow?: WorkflowDefinition;
        workItem?: WorkItemReference;
        repoMount?: RepoMount;
        variables?: Record<string, unknown>;
        mockMode?: boolean;
      },
    ) => {
      // Validate payload
      if (!config || typeof config !== 'object') {
        return { success: false, error: 'Invalid or missing payload' };
      }
      if (typeof config.workflowId !== 'string' || config.workflowId.length === 0) {
        return { success: false, error: 'Missing or invalid workflowId (must be a non-empty string)' };
      }

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

      const host: EngineHost = { send: (ch, ...args) => mainWindow.webContents.send(ch, ...args) };
      engine = new ExecutionEngine(host, {
        mockMode: config.mockMode ?? false,
        cliSpawner: cliSpawner ?? undefined,
        redisClient: redisClient ?? undefined,
        remoteAgentUrl: settingsService?.get().cursorAgentUrl || undefined,
        workingDirectory: config.repoMount?.localPath || undefined,
        fileRestrictions: config.repoMount?.fileRestrictions || undefined,
        readOnly: config.repoMount?.readOnly || undefined,
        historyService: historyService ?? undefined,
      });

      // Wire container pool for parallel execution (P15-F09 T04)
      const pool = getContainerPool?.();
      if (pool) {
        engine.containerPool = pool;
      }

      // Start is async and runs in the background -- we return immediately
      // with the execution ID while the engine drives the workflow.
      const executionPromise = engine.start(workflow, workItem);

      // Inject initial variables
      const state = engine.getState();
      if (state && config.variables) {
        Object.assign(state.variables, config.variables);
      }

      // Do not await -- let the traversal run in the background
      executionPromise
        .catch((err: unknown) => {
          console.error('[ExecutionEngine] Unexpected error:', err);
        })
        .finally(() => {
          engine = null;
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
    engine = null;
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
      // Validate payload
      if (!decision || typeof decision !== 'object') {
        return { success: false, error: 'Invalid or missing payload' };
      }
      if (typeof decision.executionId !== 'string' || !decision.executionId) {
        return { success: false, error: 'Missing or invalid executionId' };
      }
      if (typeof decision.nodeId !== 'string' || !decision.nodeId) {
        return { success: false, error: 'Missing or invalid nodeId' };
      }
      if (typeof decision.selectedOption !== 'string' || !decision.selectedOption) {
        return { success: false, error: 'Missing or invalid selectedOption' };
      }

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

  // --- Revise block (P15-F04) --------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.EXECUTION_REVISE,
    async (
      _event,
      config: {
        executionId: string;
        nodeId: string;
        feedback: string;
      },
    ) => {
      // Validate payload
      if (!config || typeof config !== 'object') {
        return { success: false, error: 'Invalid or missing payload' };
      }
      if (typeof config.executionId !== 'string' || !config.executionId) {
        return { success: false, error: 'Missing or invalid executionId' };
      }
      if (typeof config.nodeId !== 'string' || !config.nodeId) {
        return { success: false, error: 'Missing or invalid nodeId' };
      }
      if (typeof config.feedback !== 'string' || !config.feedback) {
        return { success: false, error: 'Missing or invalid feedback' };
      }

      const eng = engine;
      if (!eng) {
        return { success: false, error: 'No active execution' };
      }

      const state = eng.getState();
      if (!state || state.id !== config.executionId) {
        return { success: false, error: 'Execution not found' };
      }

      try {
        eng.reviseBlock(config.nodeId, config.feedback);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
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

    // --- CLI Output forwarding (P15-F04 T08) --------------------------------
    // Forward raw CLI output to the execution engine for tool_call / bash_command
    // event parsing. The engine silently ignores non-tool output lines.
    ipcMain.on(IPC_CHANNELS.CLI_OUTPUT, (_event, data: { sessionId: string; data: string }) => {
      if (engine) {
        engine.handleCLIOutput(data.sessionId, data.data);
      }
    });
  }
}
