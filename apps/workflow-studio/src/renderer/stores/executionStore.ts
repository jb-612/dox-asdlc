import { create } from 'zustand';
import type {
  Execution,
  ExecutionEvent,
  ExecutionStatus,
  NodeExecutionState,
  ScrutinyLevel,
} from '../../shared/types/execution';
import type { WorkflowDefinition } from '../../shared/types/workflow';
import type { WorkItemReference } from '../../shared/types/workitem';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface ExecutionState {
  /** Full execution snapshot as last received from the main process. */
  execution: Execution | null;

  /** Flat list of execution events for the event log panel. */
  events: ExecutionEvent[];

  /** Convenience flags derived from execution.status. */
  isRunning: boolean;
  isPaused: boolean;
  isWaitingGate: boolean;

  /** Error message from the last failed IPC call, if any. */
  lastError: string | null;

  /** Whether IPC listeners have been wired up. */
  subscribed: boolean;

  /** Current scrutiny level for gate deliverable views (P15-F04). */
  scrutinyLevel: ScrutinyLevel;

  // --- Actions ---

  /** Replace the full execution snapshot and sync derived flags. */
  setExecution: (execution: Execution) => void;

  /** Append a single event to the log. */
  addEvent: (event: ExecutionEvent) => void;

  /** Patch a single node's execution state inside the current execution. */
  updateNodeState: (nodeId: string, state: Partial<NodeExecutionState>) => void;

  /** Reset store to idle state (no execution). */
  clearExecution: () => void;

  /** Update the scrutiny level for deliverables view (P15-F04). */
  setScrutinyLevel: (level: ScrutinyLevel) => void;

  /** Send revision feedback for a block in gate mode (P15-F04). */
  reviseBlock: (nodeId: string, feedback: string) => Promise<void>;

  // --- IPC controls ---

  /** Tell the main process to start an execution. */
  startExecution: (
    workflow: WorkflowDefinition,
    workItem?: WorkItemReference,
    variables?: Record<string, unknown>,
    mockMode?: boolean,
  ) => Promise<void>;

  /** Pause the running execution. */
  pauseExecution: () => Promise<void>;

  /** Resume a paused execution. */
  resumeExecution: () => Promise<void>;

  /** Abort the active execution. */
  abortExecution: () => Promise<void>;

  /** Submit a HITL gate decision. */
  submitGateDecision: (
    nodeId: string,
    gateId: string,
    selectedOption: string,
    reason?: string,
  ) => Promise<void>;

  // --- Subscription management ---

  /** Subscribe to IPC push events from the main process. Call once on mount. */
  subscribe: () => void;

  /** Unsubscribe from IPC push events. Call on unmount. */
  unsubscribe: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveFlags(status: ExecutionStatus | undefined): {
  isRunning: boolean;
  isPaused: boolean;
  isWaitingGate: boolean;
} {
  return {
    isRunning: status === 'running',
    isPaused: status === 'paused',
    isWaitingGate: status === 'waiting_gate',
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  // ---- Initial state ----
  execution: null,
  events: [],
  isRunning: false,
  isPaused: false,
  isWaitingGate: false,
  lastError: null,
  subscribed: false,
  scrutinyLevel: 'summary',

  // -----------------------------------------------------------------------
  // State mutations
  // -----------------------------------------------------------------------

  setExecution: (execution) => {
    // If the workflow has a defaultScrutinyLevel, use it (T17)
    const defaultLevel = execution.workflow?.defaultScrutinyLevel;
    const updates: Partial<ExecutionState> = {
      execution,
      events: execution.events,
      lastError: null,
      ...deriveFlags(execution.status),
    };
    if (defaultLevel) {
      updates.scrutinyLevel = defaultLevel;
    }
    set(updates);
  },

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, event],
    })),

  updateNodeState: (nodeId, patch) =>
    set((state) => {
      if (!state.execution) return state;

      const existing = state.execution.nodeStates[nodeId];
      if (!existing) return state;

      const updatedNodeStates = {
        ...state.execution.nodeStates,
        [nodeId]: { ...existing, ...patch, nodeId },
      };

      return {
        execution: {
          ...state.execution,
          nodeStates: updatedNodeStates,
        },
      };
    }),

  clearExecution: () =>
    set({
      execution: null,
      events: [],
      isRunning: false,
      isPaused: false,
      isWaitingGate: false,
      lastError: null,
      scrutinyLevel: 'summary',
    }),

  setScrutinyLevel: (level) => set({ scrutinyLevel: level }),

  reviseBlock: async (nodeId, feedback) => {
    const { execution } = get();
    if (!execution) {
      set({ lastError: 'No active execution' });
      return;
    }

    set({ lastError: null });
    try {
      const result = await window.electronAPI.execution.revise({
        executionId: execution.id,
        nodeId,
        feedback,
      });
      if (!result.success) {
        set({ lastError: result.error ?? 'Failed to revise block' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
    }
  },

  // -----------------------------------------------------------------------
  // IPC controls
  // -----------------------------------------------------------------------

  startExecution: async (workflow, workItem, variables, mockMode = true) => {
    set({ lastError: null });
    try {
      const result = await window.electronAPI.execution.start({
        workflowId: workflow.id,
        workflow,
        workItem,
        variables,
        mockMode,
      });
      if (!result.success) {
        set({ lastError: result.error ?? 'Failed to start execution' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
    }
  },

  pauseExecution: async () => {
    set({ lastError: null });
    try {
      const result = await window.electronAPI.execution.pause();
      if (!result.success) {
        set({ lastError: result.error ?? 'Failed to pause execution' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
    }
  },

  resumeExecution: async () => {
    set({ lastError: null });
    try {
      const result = await window.electronAPI.execution.resume();
      if (!result.success) {
        set({ lastError: result.error ?? 'Failed to resume execution' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
    }
  },

  abortExecution: async () => {
    set({ lastError: null });
    try {
      const result = await window.electronAPI.execution.abort();
      if (!result.success) {
        set({ lastError: result.error ?? 'Failed to abort execution' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
    }
  },

  submitGateDecision: async (nodeId, gateId, selectedOption, reason) => {
    const { execution } = get();
    if (!execution) {
      set({ lastError: 'No active execution' });
      return;
    }

    set({ lastError: null });
    try {
      const result = await window.electronAPI.execution.gateDecision({
        executionId: execution.id,
        gateId,
        nodeId,
        selectedOption,
        decidedBy: 'user',
        reason,
      });
      if (!result.success) {
        set({ lastError: result.error ?? 'Failed to submit gate decision' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
    }
  },

  // -----------------------------------------------------------------------
  // IPC event subscription
  // -----------------------------------------------------------------------

  subscribe: () => {
    if (get().subscribed) return;

    // Full state snapshots from the engine
    window.electronAPI.onEvent(
      IPC_CHANNELS.EXECUTION_STATE_UPDATE,
      (...args: unknown[]) => {
        const execution = args[0] as Execution | null;
        if (execution) {
          set({
            execution,
            events: execution.events,
            ...deriveFlags(execution.status),
          });
        }
      },
    );

    // Individual events (appended as they arrive in real time)
    window.electronAPI.onEvent(
      IPC_CHANNELS.EXECUTION_EVENT,
      (...args: unknown[]) => {
        const event = args[0] as ExecutionEvent | null;
        if (event) {
          // Only append if we do not already have this event id
          const { events } = get();
          const exists = events.some((e) => e.id === event.id);
          if (!exists) {
            set({ events: [...events, event] });
          }
        }
      },
    );

    set({ subscribed: true });
  },

  unsubscribe: () => {
    window.electronAPI.removeListener(IPC_CHANNELS.EXECUTION_STATE_UPDATE);
    window.electronAPI.removeListener(IPC_CHANNELS.EXECUTION_EVENT);
    set({ subscribed: false });
  },
}));
