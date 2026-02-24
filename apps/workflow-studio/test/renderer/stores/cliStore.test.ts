import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CLISession, CLISpawnConfig, SessionHistoryEntry } from '../../../src/shared/types/cli';

// ---------------------------------------------------------------------------
// Mock window.electronAPI
// ---------------------------------------------------------------------------

const mockSpawn = vi.fn();
const mockKill = vi.fn();
const mockList = vi.fn();
const mockWrite = vi.fn();
const mockSaveSession = vi.fn();
const mockGetHistory = vi.fn();
const mockOnEvent = vi.fn();
const mockRemoveListener = vi.fn();

vi.stubGlobal('window', {
  ...globalThis.window,
  electronAPI: {
    cli: {
      spawn: mockSpawn,
      kill: mockKill,
      list: mockList,
      write: mockWrite,
      saveSession: mockSaveSession,
      getHistory: mockGetHistory,
    },
    onEvent: mockOnEvent,
    removeListener: mockRemoveListener,
  },
});

import { useCLIStore } from '../../../src/renderer/stores/cliStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<CLISpawnConfig>): CLISpawnConfig {
  return {
    command: 'claude',
    args: ['--help'],
    cwd: '/tmp',
    mode: 'local',
    ...overrides,
  };
}

function makeSession(id: string, overrides?: Partial<CLISession>): CLISession {
  return {
    id,
    config: makeConfig(),
    status: 'running',
    pid: 12345,
    startedAt: '2026-01-01T00:00:00Z',
    mode: 'local',
    ...overrides,
  };
}

function makeHistoryEntry(id: string): SessionHistoryEntry {
  return {
    id,
    config: makeConfig(),
    startedAt: '2026-01-01T00:00:00Z',
    exitedAt: '2026-01-01T01:00:00Z',
    exitCode: 0,
    mode: 'local',
  };
}

function resetStore(): void {
  useCLIStore.setState({
    sessions: new Map(),
    outputBuffers: new Map(),
    selectedSessionId: null,
    history: [],
    subscribed: false,
    lastError: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cliStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('has an empty sessions map', () => {
      const state = useCLIStore.getState();
      expect(state.sessions.size).toBe(0);
    });

    it('has an empty outputBuffers map', () => {
      const state = useCLIStore.getState();
      expect(state.outputBuffers.size).toBe(0);
    });

    it('has selectedSessionId as null', () => {
      const state = useCLIStore.getState();
      expect(state.selectedSessionId).toBeNull();
    });

    it('has an empty history array', () => {
      const state = useCLIStore.getState();
      expect(state.history).toEqual([]);
    });

    it('has subscribed as false', () => {
      const state = useCLIStore.getState();
      expect(state.subscribed).toBe(false);
    });

    it('has lastError as null', () => {
      const state = useCLIStore.getState();
      expect(state.lastError).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // addSession
  // -------------------------------------------------------------------------

  describe('addSession', () => {
    it('adds a session to the sessions map', () => {
      const session = makeSession('sess-1');
      useCLIStore.getState().addSession(session);

      const state = useCLIStore.getState();
      expect(state.sessions.size).toBe(1);
      expect(state.sessions.get('sess-1')).toEqual(session);
    });

    it('initializes an empty output buffer for the session', () => {
      const session = makeSession('sess-1');
      useCLIStore.getState().addSession(session);

      const state = useCLIStore.getState();
      expect(state.outputBuffers.has('sess-1')).toBe(true);
      expect(state.outputBuffers.get('sess-1')).toEqual([]);
    });

    it('does not overwrite existing output buffer when adding same session ID', () => {
      const session = makeSession('sess-1');
      useCLIStore.getState().addSession(session);
      useCLIStore.getState().appendOutput('sess-1', 'line1');

      // Re-add same session
      useCLIStore.getState().addSession(makeSession('sess-1', { pid: 99999 }));

      const state = useCLIStore.getState();
      // Output buffer should be preserved because the condition checks has()
      expect(state.outputBuffers.get('sess-1')!.length).toBeGreaterThan(0);
    });

    it('can add multiple sessions', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().addSession(makeSession('sess-2'));

      const state = useCLIStore.getState();
      expect(state.sessions.size).toBe(2);
      expect(state.outputBuffers.size).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // removeSession
  // -------------------------------------------------------------------------

  describe('removeSession', () => {
    it('removes the session from the sessions map', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().removeSession('sess-1');

      const state = useCLIStore.getState();
      expect(state.sessions.size).toBe(0);
      expect(state.sessions.has('sess-1')).toBe(false);
    });

    it('removes the output buffer for the session', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().removeSession('sess-1');

      const state = useCLIStore.getState();
      expect(state.outputBuffers.has('sess-1')).toBe(false);
    });

    it('resets selectedSessionId if the removed session was selected', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().selectSession('sess-1');
      expect(useCLIStore.getState().selectedSessionId).toBe('sess-1');

      useCLIStore.getState().removeSession('sess-1');
      expect(useCLIStore.getState().selectedSessionId).toBeNull();
    });

    it('does not reset selectedSessionId if a different session is removed', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().addSession(makeSession('sess-2'));
      useCLIStore.getState().selectSession('sess-1');

      useCLIStore.getState().removeSession('sess-2');
      expect(useCLIStore.getState().selectedSessionId).toBe('sess-1');
    });

    it('is a no-op for non-existent session ID', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().removeSession('does-not-exist');

      expect(useCLIStore.getState().sessions.size).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // updateStatus
  // -------------------------------------------------------------------------

  describe('updateStatus', () => {
    it('updates the status field of an existing session', () => {
      useCLIStore.getState().addSession(makeSession('sess-1', { status: 'running' }));
      useCLIStore.getState().updateStatus('sess-1', 'exited');

      const session = useCLIStore.getState().sessions.get('sess-1');
      expect(session!.status).toBe('exited');
    });

    it('sets exitedAt when status is exited', () => {
      useCLIStore.getState().addSession(makeSession('sess-1', { status: 'running' }));
      useCLIStore.getState().updateStatus('sess-1', 'exited');

      const session = useCLIStore.getState().sessions.get('sess-1');
      expect(session!.exitedAt).toBeDefined();
      expect(typeof session!.exitedAt).toBe('string');
    });

    it('sets exitedAt when status is error', () => {
      useCLIStore.getState().addSession(makeSession('sess-1', { status: 'running' }));
      useCLIStore.getState().updateStatus('sess-1', 'error');

      const session = useCLIStore.getState().sessions.get('sess-1');
      expect(session!.exitedAt).toBeDefined();
    });

    it('does not set exitedAt when status is running', () => {
      useCLIStore.getState().addSession(makeSession('sess-1', { status: 'starting' }));
      useCLIStore.getState().updateStatus('sess-1', 'running');

      const session = useCLIStore.getState().sessions.get('sess-1');
      expect(session!.exitedAt).toBeUndefined();
    });

    it('sets exitCode when provided', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().updateStatus('sess-1', 'exited', 42);

      const session = useCLIStore.getState().sessions.get('sess-1');
      expect(session!.exitCode).toBe(42);
    });

    it('does not set exitCode when not provided', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().updateStatus('sess-1', 'exited');

      const session = useCLIStore.getState().sessions.get('sess-1');
      // exitCode should not be set via the spread, so it depends on the original session
      // The original makeSession does not set exitCode, so it should remain undefined
      expect(session!.exitCode).toBeUndefined();
    });

    it('is a no-op for non-existent session ID', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().updateStatus('no-such-session', 'error');

      // State should be unchanged
      const session = useCLIStore.getState().sessions.get('sess-1');
      expect(session!.status).toBe('running');
    });
  });

  // -------------------------------------------------------------------------
  // appendOutput
  // -------------------------------------------------------------------------

  describe('appendOutput', () => {
    it('splits data on newlines and appends to buffer', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().appendOutput('sess-1', 'line1\nline2\nline3');

      const buffer = useCLIStore.getState().outputBuffers.get('sess-1');
      expect(buffer).toEqual(['line1', 'line2', 'line3']);
    });

    it('appends to existing lines', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().appendOutput('sess-1', 'line1');
      useCLIStore.getState().appendOutput('sess-1', 'line2\nline3');

      const buffer = useCLIStore.getState().outputBuffers.get('sess-1');
      expect(buffer).toEqual(['line1', 'line2', 'line3']);
    });

    it('creates buffer for session without existing buffer', () => {
      // appendOutput on a session that was not addSession'd
      useCLIStore.getState().appendOutput('orphan', 'hello');

      const buffer = useCLIStore.getState().outputBuffers.get('orphan');
      expect(buffer).toEqual(['hello']);
    });

    it('handles empty string data', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().appendOutput('sess-1', '');

      const buffer = useCLIStore.getState().outputBuffers.get('sess-1');
      // ''.split('\n') produces ['']
      expect(buffer).toEqual(['']);
    });

    it('enforces the 10000-line ring buffer cap', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));

      // Add 9999 lines first
      const initialLines = Array.from({ length: 9999 }, (_, i) => `init-${i}`).join('\n');
      useCLIStore.getState().appendOutput('sess-1', initialLines);
      expect(useCLIStore.getState().outputBuffers.get('sess-1')!.length).toBe(9999);

      // Add 10 more lines to exceed the cap
      const extraLines = Array.from({ length: 10 }, (_, i) => `extra-${i}`).join('\n');
      useCLIStore.getState().appendOutput('sess-1', extraLines);

      const buffer = useCLIStore.getState().outputBuffers.get('sess-1')!;
      expect(buffer.length).toBe(10000);
      // The oldest lines should have been trimmed
      expect(buffer[0]).toBe('init-9');
      expect(buffer[buffer.length - 1]).toBe('extra-9');
    });

    it('trims oldest lines when exceeding cap in a single append', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));

      // Add 10005 lines in one go
      const lines = Array.from({ length: 10005 }, (_, i) => `line-${i}`).join('\n');
      useCLIStore.getState().appendOutput('sess-1', lines);

      const buffer = useCLIStore.getState().outputBuffers.get('sess-1')!;
      expect(buffer.length).toBe(10000);
      expect(buffer[0]).toBe('line-5');
      expect(buffer[buffer.length - 1]).toBe('line-10004');
    });
  });

  // -------------------------------------------------------------------------
  // selectSession
  // -------------------------------------------------------------------------

  describe('selectSession', () => {
    it('sets selectedSessionId to the given value', () => {
      useCLIStore.getState().selectSession('sess-1');
      expect(useCLIStore.getState().selectedSessionId).toBe('sess-1');
    });

    it('sets selectedSessionId to null', () => {
      useCLIStore.getState().selectSession('sess-1');
      useCLIStore.getState().selectSession(null);
      expect(useCLIStore.getState().selectedSessionId).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // clearOutput
  // -------------------------------------------------------------------------

  describe('clearOutput', () => {
    it('clears the output buffer for the given session', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().appendOutput('sess-1', 'line1\nline2\nline3');
      expect(useCLIStore.getState().outputBuffers.get('sess-1')!.length).toBe(3);

      useCLIStore.getState().clearOutput('sess-1');
      expect(useCLIStore.getState().outputBuffers.get('sess-1')).toEqual([]);
    });

    it('creates an empty buffer for a session that does not yet have one', () => {
      useCLIStore.getState().clearOutput('no-buffer');
      expect(useCLIStore.getState().outputBuffers.get('no-buffer')).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // subscribe
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('registers three IPC event listeners', () => {
      useCLIStore.getState().subscribe();

      expect(mockOnEvent).toHaveBeenCalledTimes(3);
      const channels = mockOnEvent.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(channels).toContain('cli:output');
      expect(channels).toContain('cli:exit');
      expect(channels).toContain('cli:error');
    });

    it('sets subscribed to true', () => {
      useCLIStore.getState().subscribe();
      expect(useCLIStore.getState().subscribed).toBe(true);
    });

    it('is idempotent -- calling subscribe twice does not double-register', () => {
      useCLIStore.getState().subscribe();
      useCLIStore.getState().subscribe();

      expect(mockOnEvent).toHaveBeenCalledTimes(3);
    });
  });

  // -------------------------------------------------------------------------
  // unsubscribe
  // -------------------------------------------------------------------------

  describe('unsubscribe', () => {
    it('removes all three IPC event listeners', () => {
      useCLIStore.getState().subscribe();
      useCLIStore.getState().unsubscribe();

      expect(mockRemoveListener).toHaveBeenCalledTimes(3);
      const channels = mockRemoveListener.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(channels).toContain('cli:output');
      expect(channels).toContain('cli:exit');
      expect(channels).toContain('cli:error');
    });

    it('sets subscribed to false', () => {
      useCLIStore.getState().subscribe();
      useCLIStore.getState().unsubscribe();
      expect(useCLIStore.getState().subscribed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // IPC event callbacks (through subscribe)
  // -------------------------------------------------------------------------

  describe('IPC event callbacks', () => {
    it('CLI_OUTPUT callback appends output to the correct session', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().subscribe();

      // Find the CLI_OUTPUT callback
      const outputCall = mockOnEvent.mock.calls.find(
        (call: unknown[]) => call[0] === 'cli:output',
      );
      const callback = outputCall![1] as (...args: unknown[]) => void;

      callback({ sessionId: 'sess-1', data: 'hello\nworld' });

      const buffer = useCLIStore.getState().outputBuffers.get('sess-1');
      expect(buffer).toEqual(['hello', 'world']);
    });

    it('CLI_EXIT callback updates status to exited', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      mockSaveSession.mockResolvedValue({ success: true });
      useCLIStore.getState().subscribe();

      const exitCall = mockOnEvent.mock.calls.find(
        (call: unknown[]) => call[0] === 'cli:exit',
      );
      const callback = exitCall![1] as (...args: unknown[]) => void;

      callback({ sessionId: 'sess-1', exitCode: 0 });

      const session = useCLIStore.getState().sessions.get('sess-1');
      expect(session!.status).toBe('exited');
      expect(session!.exitCode).toBe(0);
    });

    it('CLI_EXIT callback saves session to history', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      mockSaveSession.mockResolvedValue({ success: true });
      useCLIStore.getState().subscribe();

      const exitCall = mockOnEvent.mock.calls.find(
        (call: unknown[]) => call[0] === 'cli:exit',
      );
      const callback = exitCall![1] as (...args: unknown[]) => void;

      callback({ sessionId: 'sess-1', exitCode: 0 });

      expect(mockSaveSession).toHaveBeenCalled();
    });

    it('CLI_ERROR callback updates status to error and appends error message', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().subscribe();

      const errorCall = mockOnEvent.mock.calls.find(
        (call: unknown[]) => call[0] === 'cli:error',
      );
      const callback = errorCall![1] as (...args: unknown[]) => void;

      callback({ sessionId: 'sess-1', error: 'something broke' });

      const session = useCLIStore.getState().sessions.get('sess-1');
      expect(session!.status).toBe('error');

      const buffer = useCLIStore.getState().outputBuffers.get('sess-1');
      expect(buffer).toContain('[ERROR] something broke');
    });

    it('CLI_OUTPUT callback ignores null payload', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));
      useCLIStore.getState().subscribe();

      const outputCall = mockOnEvent.mock.calls.find(
        (call: unknown[]) => call[0] === 'cli:output',
      );
      const callback = outputCall![1] as (...args: unknown[]) => void;

      // Should not throw
      callback(null);

      const buffer = useCLIStore.getState().outputBuffers.get('sess-1');
      expect(buffer).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // spawnSession
  // -------------------------------------------------------------------------

  describe('spawnSession', () => {
    it('calls electronAPI.cli.spawn with the config', async () => {
      mockSpawn.mockResolvedValueOnce({
        success: true,
        sessionId: 'new-sess',
        pid: 9999,
      });

      const config = makeConfig();
      await useCLIStore.getState().spawnSession(config);

      expect(mockSpawn).toHaveBeenCalledWith(config);
    });

    it('adds the new session and selects it on success', async () => {
      mockSpawn.mockResolvedValueOnce({
        success: true,
        sessionId: 'new-sess',
        pid: 9999,
      });

      await useCLIStore.getState().spawnSession(makeConfig());

      const state = useCLIStore.getState();
      expect(state.sessions.has('new-sess')).toBe(true);
      expect(state.selectedSessionId).toBe('new-sess');
      expect(state.sessions.get('new-sess')!.pid).toBe(9999);
      expect(state.sessions.get('new-sess')!.status).toBe('running');
    });

    it('sets lastError when spawn returns success: false', async () => {
      mockSpawn.mockResolvedValueOnce({
        success: false,
        error: 'Command not found',
      });

      await useCLIStore.getState().spawnSession(makeConfig());

      expect(useCLIStore.getState().lastError).toBe('Command not found');
      expect(useCLIStore.getState().sessions.size).toBe(0);
    });

    it('sets lastError with default message when spawn returns success: false without error', async () => {
      mockSpawn.mockResolvedValueOnce({ success: false });

      await useCLIStore.getState().spawnSession(makeConfig());

      expect(useCLIStore.getState().lastError).toBe('Failed to spawn session');
    });

    it('sets lastError on thrown exception', async () => {
      mockSpawn.mockRejectedValueOnce(new Error('IPC timeout'));

      await useCLIStore.getState().spawnSession(makeConfig());

      expect(useCLIStore.getState().lastError).toBe('IPC timeout');
    });

    it('clears lastError before attempting spawn', async () => {
      useCLIStore.setState({ lastError: 'previous error' });
      mockSpawn.mockResolvedValueOnce({
        success: true,
        sessionId: 'new-sess',
        pid: 1,
      });

      await useCLIStore.getState().spawnSession(makeConfig());

      expect(useCLIStore.getState().lastError).toBeNull();
    });

    it('sets the mode from the config', async () => {
      mockSpawn.mockResolvedValueOnce({
        success: true,
        sessionId: 'docker-sess',
        pid: 5555,
      });

      await useCLIStore.getState().spawnSession(makeConfig({ mode: 'docker' }));

      const session = useCLIStore.getState().sessions.get('docker-sess');
      expect(session!.mode).toBe('docker');
    });
  });

  // -------------------------------------------------------------------------
  // killSession
  // -------------------------------------------------------------------------

  describe('killSession', () => {
    it('calls electronAPI.cli.kill with the session ID', async () => {
      mockKill.mockResolvedValueOnce({ success: true });

      await useCLIStore.getState().killSession('sess-1');

      expect(mockKill).toHaveBeenCalledWith('sess-1');
    });

    it('sets lastError when kill returns success: false', async () => {
      mockKill.mockResolvedValueOnce({ success: false, error: 'No such process' });

      await useCLIStore.getState().killSession('sess-1');

      expect(useCLIStore.getState().lastError).toBe('No such process');
    });

    it('sets lastError with default message when kill returns success: false without error', async () => {
      mockKill.mockResolvedValueOnce({ success: false });

      await useCLIStore.getState().killSession('sess-1');

      expect(useCLIStore.getState().lastError).toBe('Failed to kill session');
    });

    it('sets lastError on thrown exception', async () => {
      mockKill.mockRejectedValueOnce(new Error('IPC dead'));

      await useCLIStore.getState().killSession('sess-1');

      expect(useCLIStore.getState().lastError).toBe('IPC dead');
    });

    it('clears lastError before attempting kill', async () => {
      useCLIStore.setState({ lastError: 'old error' });
      mockKill.mockResolvedValueOnce({ success: true });

      await useCLIStore.getState().killSession('sess-1');

      expect(useCLIStore.getState().lastError).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // writeToSession
  // -------------------------------------------------------------------------

  describe('writeToSession', () => {
    it('calls electronAPI.cli.write with session ID and data', async () => {
      mockWrite.mockResolvedValueOnce({ success: true });

      await useCLIStore.getState().writeToSession('sess-1', 'ls -la\n');

      expect(mockWrite).toHaveBeenCalledWith('sess-1', 'ls -la\n');
    });

    it('sets lastError when write returns success: false', async () => {
      mockWrite.mockResolvedValueOnce({
        success: false,
        error: 'Session not found',
      });

      await useCLIStore.getState().writeToSession('sess-1', 'data');

      expect(useCLIStore.getState().lastError).toBe('Session not found');
    });

    it('sets lastError with default message when write returns success: false without error', async () => {
      mockWrite.mockResolvedValueOnce({ success: false });

      await useCLIStore.getState().writeToSession('sess-1', 'data');

      expect(useCLIStore.getState().lastError).toBe('Failed to write to session');
    });

    it('sets lastError on thrown exception', async () => {
      mockWrite.mockRejectedValueOnce(new Error('Write failed'));

      await useCLIStore.getState().writeToSession('sess-1', 'data');

      expect(useCLIStore.getState().lastError).toBe('Write failed');
    });

    it('clears lastError before attempting write', async () => {
      useCLIStore.setState({ lastError: 'stale error' });
      mockWrite.mockResolvedValueOnce({ success: true });

      await useCLIStore.getState().writeToSession('sess-1', 'data');

      expect(useCLIStore.getState().lastError).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // loadSessions
  // -------------------------------------------------------------------------

  describe('loadSessions', () => {
    it('hydrates sessions map from electronAPI.cli.list', async () => {
      const sessions: CLISession[] = [
        makeSession('sess-1'),
        makeSession('sess-2'),
      ];
      mockList.mockResolvedValueOnce(sessions);

      await useCLIStore.getState().loadSessions();

      const state = useCLIStore.getState();
      expect(state.sessions.size).toBe(2);
      expect(state.sessions.get('sess-1')).toEqual(sessions[0]);
      expect(state.sessions.get('sess-2')).toEqual(sessions[1]);
    });

    it('replaces existing sessions on load', async () => {
      useCLIStore.getState().addSession(makeSession('old-sess'));

      mockList.mockResolvedValueOnce([makeSession('new-sess')]);
      await useCLIStore.getState().loadSessions();

      const state = useCLIStore.getState();
      expect(state.sessions.size).toBe(1);
      expect(state.sessions.has('new-sess')).toBe(true);
      expect(state.sessions.has('old-sess')).toBe(false);
    });

    it('silently handles errors from cli.list', async () => {
      useCLIStore.getState().addSession(makeSession('existing'));
      mockList.mockRejectedValueOnce(new Error('IPC unavailable'));

      // Should not throw
      await useCLIStore.getState().loadSessions();

      // State should remain unchanged (the catch silently ignores)
      expect(useCLIStore.getState().sessions.has('existing')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // loadHistory
  // -------------------------------------------------------------------------

  describe('loadHistory', () => {
    it('loads history entries from electronAPI.cli.getHistory', async () => {
      const entries: SessionHistoryEntry[] = [
        makeHistoryEntry('hist-1'),
        makeHistoryEntry('hist-2'),
      ];
      mockGetHistory.mockResolvedValueOnce(entries);

      await useCLIStore.getState().loadHistory();

      expect(useCLIStore.getState().history).toEqual(entries);
    });

    it('passes limit parameter to getHistory', async () => {
      mockGetHistory.mockResolvedValueOnce([]);

      await useCLIStore.getState().loadHistory(5);

      expect(mockGetHistory).toHaveBeenCalledWith(5);
    });

    it('passes undefined limit when not specified', async () => {
      mockGetHistory.mockResolvedValueOnce([]);

      await useCLIStore.getState().loadHistory();

      expect(mockGetHistory).toHaveBeenCalledWith(undefined);
    });

    it('silently handles errors from cli.getHistory', async () => {
      useCLIStore.setState({ history: [makeHistoryEntry('existing')] });
      mockGetHistory.mockRejectedValueOnce(new Error('fail'));

      await useCLIStore.getState().loadHistory();

      // History should remain unchanged
      expect(useCLIStore.getState().history).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Ring buffer edge cases
  // -------------------------------------------------------------------------

  describe('ring buffer behavior', () => {
    it('exactly 10000 lines stays at 10000', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));

      const lines = Array.from({ length: 10000 }, (_, i) => `L${i}`).join('\n');
      useCLIStore.getState().appendOutput('sess-1', lines);

      expect(useCLIStore.getState().outputBuffers.get('sess-1')!.length).toBe(10000);
    });

    it('10001 lines trims to 10000 keeping newest', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));

      const lines = Array.from({ length: 10001 }, (_, i) => `L${i}`).join('\n');
      useCLIStore.getState().appendOutput('sess-1', lines);

      const buffer = useCLIStore.getState().outputBuffers.get('sess-1')!;
      expect(buffer.length).toBe(10000);
      expect(buffer[0]).toBe('L1');
      expect(buffer[buffer.length - 1]).toBe('L10000');
    });

    it('incremental appends beyond cap still enforce cap', () => {
      useCLIStore.getState().addSession(makeSession('sess-1'));

      // Fill to capacity
      const fillLines = Array.from({ length: 10000 }, (_, i) => `fill-${i}`).join('\n');
      useCLIStore.getState().appendOutput('sess-1', fillLines);

      // Add one more
      useCLIStore.getState().appendOutput('sess-1', 'overflow');

      const buffer = useCLIStore.getState().outputBuffers.get('sess-1')!;
      expect(buffer.length).toBe(10000);
      expect(buffer[buffer.length - 1]).toBe('overflow');
      expect(buffer[0]).toBe('fill-1');
    });
  });
});
