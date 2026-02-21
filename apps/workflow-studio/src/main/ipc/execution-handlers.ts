import { ipcMain, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { Execution, ExecutionEvent, NodeExecutionState } from '../../shared/types/execution';

// ---------------------------------------------------------------------------
// In-memory execution state for development
// ---------------------------------------------------------------------------

let currentExecution: Execution | null = null;

function emitToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send(channel, data);
  }
}

function createEvent(
  type: ExecutionEvent['type'],
  message: string,
  nodeId?: string,
  data?: unknown,
): ExecutionEvent {
  return {
    id: uuidv4(),
    type,
    timestamp: new Date().toISOString(),
    nodeId,
    data,
    message,
  };
}

// ---------------------------------------------------------------------------
// IPC handler registration
// ---------------------------------------------------------------------------

export function registerExecutionHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.EXECUTION_START,
    async (_event, config: { workflowId: string; variables?: Record<string, unknown> }) => {
      // Stub: create a mock execution. In a real implementation this would
      // load the workflow, initialise node states, and begin orchestration.
      const executionId = uuidv4();
      const now = new Date().toISOString();

      const startEvent = createEvent(
        'execution_started',
        `Execution ${executionId} started for workflow ${config.workflowId}`,
      );

      currentExecution = {
        id: executionId,
        workflowId: config.workflowId,
        // Stub: workflow object would normally be loaded from storage
        workflow: {
          id: config.workflowId,
          metadata: {
            name: 'Stub Workflow',
            version: '1.0.0',
            createdAt: now,
            updatedAt: now,
            tags: [],
          },
          nodes: [],
          transitions: [],
          gates: [],
          variables: [],
        },
        status: 'running',
        nodeStates: {},
        events: [startEvent],
        variables: config.variables ?? {},
        startedAt: now,
      };

      emitToRenderer(IPC_CHANNELS.EXECUTION_EVENT, startEvent);
      emitToRenderer(IPC_CHANNELS.EXECUTION_STATE_UPDATE, {
        executionId,
        status: currentExecution.status,
      });

      return { success: true, executionId };
    },
  );

  ipcMain.handle(IPC_CHANNELS.EXECUTION_PAUSE, async () => {
    if (!currentExecution || currentExecution.status !== 'running') {
      return { success: false, error: 'No running execution to pause' };
    }

    currentExecution.status = 'paused';
    const event = createEvent('execution_started', 'Execution paused');
    currentExecution.events.push(event);

    emitToRenderer(IPC_CHANNELS.EXECUTION_EVENT, event);
    emitToRenderer(IPC_CHANNELS.EXECUTION_STATE_UPDATE, {
      executionId: currentExecution.id,
      status: 'paused',
    });

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.EXECUTION_RESUME, async () => {
    if (!currentExecution || currentExecution.status !== 'paused') {
      return { success: false, error: 'No paused execution to resume' };
    }

    currentExecution.status = 'running';
    const event = createEvent('execution_started', 'Execution resumed');
    currentExecution.events.push(event);

    emitToRenderer(IPC_CHANNELS.EXECUTION_EVENT, event);
    emitToRenderer(IPC_CHANNELS.EXECUTION_STATE_UPDATE, {
      executionId: currentExecution.id,
      status: 'running',
    });

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.EXECUTION_ABORT, async () => {
    if (!currentExecution) {
      return { success: false, error: 'No active execution to abort' };
    }

    currentExecution.status = 'aborted';
    currentExecution.completedAt = new Date().toISOString();

    const event = createEvent('execution_aborted', 'Execution aborted by user');
    currentExecution.events.push(event);

    emitToRenderer(IPC_CHANNELS.EXECUTION_EVENT, event);
    emitToRenderer(IPC_CHANNELS.EXECUTION_STATE_UPDATE, {
      executionId: currentExecution.id,
      status: 'aborted',
    });

    const id = currentExecution.id;
    currentExecution = null;

    return { success: true, executionId: id };
  });

  ipcMain.handle(
    IPC_CHANNELS.EXECUTION_GATE_DECISION,
    async (
      _event,
      decision: { executionId: string; gateId: string; decision: string; comment?: string },
    ) => {
      if (!currentExecution || currentExecution.id !== decision.executionId) {
        return { success: false, error: 'Execution not found' };
      }

      const event = createEvent(
        'gate_decided',
        `Gate ${decision.gateId} decided: ${decision.decision}`,
        undefined,
        { gateId: decision.gateId, decision: decision.decision, comment: decision.comment },
      );
      currentExecution.events.push(event);

      // Resume execution after gate decision
      if (currentExecution.status === 'waiting_gate') {
        currentExecution.status = 'running';
      }

      emitToRenderer(IPC_CHANNELS.EXECUTION_EVENT, event);
      emitToRenderer(IPC_CHANNELS.EXECUTION_STATE_UPDATE, {
        executionId: currentExecution.id,
        status: currentExecution.status,
      });

      return { success: true };
    },
  );
}
