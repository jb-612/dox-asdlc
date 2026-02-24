import { create } from 'zustand';
import type { CLISession, CLISpawnConfig, SessionHistoryEntry } from '../../shared/types/cli';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of output lines kept per session (ring buffer). */
const MAX_OUTPUT_LINES = 10000;

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface CLIState {
  sessions: Map<string, CLISession>;
  outputBuffers: Map<string, string[]>;
  selectedSessionId: string | null;

  /** Session history entries from persistent storage (P15-F06). */
  history: SessionHistoryEntry[];

  /** Whether IPC listeners have been wired up. */
  subscribed: boolean;

  /** Last error from an IPC call. */
  lastError: string | null;

  // --- Mutations ---
  addSession: (session: CLISession) => void;
  removeSession: (sessionId: string) => void;
  updateStatus: (sessionId: string, status: CLISession['status'], exitCode?: number) => void;
  appendOutput: (sessionId: string, data: string) => void;
  selectSession: (sessionId: string | null) => void;
  /** Clear the terminal output buffer for a session (T09). */
  clearOutput: (sessionId: string) => void;

  // --- IPC actions ---
  spawnSession: (config: CLISpawnConfig) => Promise<void>;
  killSession: (sessionId: string) => Promise<void>;
  writeToSession: (sessionId: string, data: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  /** Load session history from persistent storage (T10). */
  loadHistory: (limit?: number) => Promise<void>;

  // --- Subscription management ---
  subscribe: () => void;
  unsubscribe: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCLIStore = create<CLIState>((set, get) => ({
  sessions: new Map(),
  outputBuffers: new Map(),
  selectedSessionId: null,
  history: [],
  subscribed: false,
  lastError: null,

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  addSession: (session) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.set(session.id, session);
      const outputBuffers = new Map(state.outputBuffers);
      if (!outputBuffers.has(session.id)) {
        outputBuffers.set(session.id, []);
      }
      return { sessions, outputBuffers };
    }),

  removeSession: (sessionId) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.delete(sessionId);
      const outputBuffers = new Map(state.outputBuffers);
      outputBuffers.delete(sessionId);
      const selectedSessionId =
        state.selectedSessionId === sessionId ? null : state.selectedSessionId;
      return { sessions, outputBuffers, selectedSessionId };
    }),

  updateStatus: (sessionId, status, exitCode) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      const existing = sessions.get(sessionId);
      if (!existing) return state;

      const updated: CLISession = {
        ...existing,
        status,
        ...(exitCode !== undefined ? { exitCode } : {}),
        ...(status === 'exited' || status === 'error'
          ? { exitedAt: new Date().toISOString() }
          : {}),
      };
      sessions.set(sessionId, updated);
      return { sessions };
    }),

  appendOutput: (sessionId, data) =>
    set((state) => {
      const outputBuffers = new Map(state.outputBuffers);
      const buffer = outputBuffers.get(sessionId) ?? [];
      const newLines = data.split('\n');
      const updated = [...buffer, ...newLines].slice(-MAX_OUTPUT_LINES);
      outputBuffers.set(sessionId, updated);
      return { outputBuffers };
    }),

  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),

  clearOutput: (sessionId) =>
    set((state) => {
      const outputBuffers = new Map(state.outputBuffers);
      outputBuffers.set(sessionId, []);
      return { outputBuffers };
    }),

  // -----------------------------------------------------------------------
  // IPC actions
  // -----------------------------------------------------------------------

  spawnSession: async (config) => {
    set({ lastError: null });
    try {
      const result = await window.electronAPI.cli.spawn(config);
      if (result.success && result.sessionId) {
        const session: CLISession = {
          id: result.sessionId,
          config,
          status: 'running',
          pid: result.pid,
          startedAt: new Date().toISOString(),
          mode: config.mode ?? 'local',
          context: config.context,
        };
        get().addSession(session);
        get().selectSession(session.id);
      } else {
        set({ lastError: result.error ?? 'Failed to spawn session' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
    }
  },

  killSession: async (sessionId) => {
    set({ lastError: null });
    try {
      const result = await window.electronAPI.cli.kill(sessionId);
      if (!result.success) {
        set({ lastError: result.error ?? 'Failed to kill session' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
    }
  },

  writeToSession: async (sessionId, data) => {
    set({ lastError: null });
    try {
      const result = await window.electronAPI.cli.write(sessionId, data);
      if (!result.success) {
        set({ lastError: result.error ?? 'Failed to write to session' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
    }
  },

  loadSessions: async () => {
    try {
      const sessions = await window.electronAPI.cli.list();
      const map = new Map<string, CLISession>();
      for (const s of sessions) {
        map.set(s.id, s);
      }
      set({ sessions: map });
    } catch {
      // silently ignore -- sessions may not be available during startup
    }
  },

  loadHistory: async (limit?: number) => {
    try {
      const history = await window.electronAPI.cli.getHistory(limit);
      set({ history });
    } catch {
      // silently ignore
    }
  },

  // -----------------------------------------------------------------------
  // IPC event subscription
  // -----------------------------------------------------------------------

  subscribe: () => {
    if (get().subscribed) return;

    // CLI output from any session
    window.electronAPI.onEvent(
      IPC_CHANNELS.CLI_OUTPUT,
      (...args: unknown[]) => {
        const payload = args[0] as { sessionId: string; data: string } | null;
        if (payload) {
          get().appendOutput(payload.sessionId, payload.data);
        }
      },
    );

    // CLI session exited
    window.electronAPI.onEvent(
      IPC_CHANNELS.CLI_EXIT,
      (...args: unknown[]) => {
        const payload = args[0] as { sessionId: string; exitCode?: number } | null;
        if (payload) {
          get().updateStatus(payload.sessionId, 'exited', payload.exitCode);
          // Auto-save to history on exit
          const session = get().sessions.get(payload.sessionId);
          if (session) {
            window.electronAPI.cli.saveSession(session).catch(() => {});
          }
        }
      },
    );

    // CLI session error
    window.electronAPI.onEvent(
      IPC_CHANNELS.CLI_ERROR,
      (...args: unknown[]) => {
        const payload = args[0] as { sessionId: string; error: string } | null;
        if (payload) {
          get().updateStatus(payload.sessionId, 'error');
          get().appendOutput(payload.sessionId, `[ERROR] ${payload.error}`);
        }
      },
    );

    set({ subscribed: true });
  },

  unsubscribe: () => {
    window.electronAPI.removeListener(IPC_CHANNELS.CLI_OUTPUT);
    window.electronAPI.removeListener(IPC_CHANNELS.CLI_EXIT);
    window.electronAPI.removeListener(IPC_CHANNELS.CLI_ERROR);
    set({ subscribed: false });
  },
}));
