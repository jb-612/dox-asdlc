import { create } from 'zustand';
import type {
  Execution,
  ExecutionEvent,
  ExecutionStatus,
  NodeExecutionState,
} from '../../shared/types/execution';
import type { WorkflowDefinition } from '../../shared/types/workflow';
import type { WorkItemReference } from '../../shared/types/workitem';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

// ---------------------------------------------------------------------------
// Type declarations for the preload bridge (window.electronAPI)
// ---------------------------------------------------------------------------

interface ElectronExecutionAPI {
  start: (config: {
    workflowId: string;
    workflow?: WorkflowDefinition;
    workItem?: WorkItemReference;
    variables?: Record<string, unknown>;
  }) => Promise<{ success: boolean; executionId?: string; error?: string }>;
  pause: () => Promise<{ success: boolean; error?: string }>;
  resume: () => Promise<{ success: boolean; error?: string }>;
  abort: () => Promise<{ success: boolean; executionId?: string; error?: string }>;
  gateDecision: (decision: {
    executionId: string;
    gateId: string;
    nodeId: string;
    decision: string;
    comment?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

interface ElectronAPI {
  execution: ElectronExecutionAPI;
  onEvent: (channel: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

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

  // --- Actions ---

  /** Replace the full execution snapshot and sync derived flags. */
  setExecution: (execution: Execution) => void;

  /** Append a single event to the log. */
  addEvent: (event: ExecutionEvent) => void;

  /** Patch a single node's execution state inside the current execution. */
  updateNodeState: (nodeId: string, state: Partial<NodeExecutionState>) => void;

  /** Reset store to idle state (no execution). */
  clearExecution: () => void;

  // --- IPC controls ---

  /** Tell the main process to start an execution. */
  startExecution: (
    workflow: WorkflowDefinition,
    workItem?: WorkItemReference,
    variables?: Record<string, unknown>,
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
    decision: string,
    comment?: string,
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

  // -----------------------------------------------------------------------
  // State mutations
  // -----------------------------------------------------------------------

  setExecution: (execution) =>
    set({
      execution,
      events: execution.events,
      lastError: null,
      ...deriveFlags(execution.status),
    }),

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
    }),

  // -----------------------------------------------------------------------
  // IPC controls
  // -----------------------------------------------------------------------

  startExecution: async (workflow, workItem, variables) => {
    set({ lastError: null });
    try {
      const result = await window.electronAPI.execution.start({
        workflowId: workflow.id,
        workflow,
        workItem,
        variables,
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

  submitGateDecision: async (nodeId, gateId, decision, comment) => {
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
        decision,
        comment,
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
