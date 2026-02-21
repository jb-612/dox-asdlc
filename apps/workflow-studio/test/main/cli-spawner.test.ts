// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { CLISpawnConfig, CLISession } from '../../src/shared/types/cli';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock node-pty
const mockOnData = vi.fn();
const mockOnExit = vi.fn();
const mockWrite = vi.fn();
const mockKill = vi.fn();
const mockPid = 12345;

const mockPtyProcess = {
  pid: mockPid,
  onData: mockOnData,
  onExit: mockOnExit,
  write: mockWrite,
  kill: mockKill,
};

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => mockPtyProcess),
}));

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

// Mock uuid to return predictable values
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CLISpawner (node-pty)', () => {
  let CLISpawner: typeof import('../../src/main/services/cli-spawner').CLISpawner;
  let ptyModule: typeof import('node-pty');
  let spawner: InstanceType<typeof CLISpawner>;
  let mockMainWindow: BrowserWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;

    // Reset mock callbacks
    mockOnData.mockReset();
    mockOnExit.mockReset();
    mockWrite.mockReset();
    mockKill.mockReset();

    // Create mock BrowserWindow
    mockMainWindow = {
      webContents: {
        send: vi.fn(),
      },
    } as unknown as BrowserWindow;

    // Import after mocks are set up
    const mod = await import('../../src/main/services/cli-spawner');
    CLISpawner = mod.CLISpawner;
    ptyModule = await import('node-pty');

    spawner = new CLISpawner(mockMainWindow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('spawn()', () => {
    it('should create a session and return a valid CLISession', () => {
      const config: CLISpawnConfig = {
        command: 'claude',
        args: ['--agent', 'backend'],
        cwd: '/tmp/test',
      };

      const session = spawner.spawn(config);

      expect(session).toBeDefined();
      expect(session.id).toBe('test-uuid-1');
      expect(session.config).toEqual(config);
      expect(session.status).toBe('running');
      expect(session.pid).toBe(mockPid);
      expect(session.startedAt).toBeDefined();
    });

    it('should call pty.spawn with correct arguments', () => {
      const config: CLISpawnConfig = {
        command: 'claude',
        args: ['--model', 'sonnet'],
        cwd: '/tmp/work',
        env: { CUSTOM_VAR: 'test' },
        instanceId: 'p01-feature',
      };

      spawner.spawn(config);

      expect(ptyModule.spawn).toHaveBeenCalledTimes(1);
      const call = vi.mocked(ptyModule.spawn).mock.calls[0];
      // First arg is the shell (platform-dependent)
      expect(call[1]).toEqual(expect.arrayContaining([])); // shell args
      expect(call[2]).toMatchObject({
        cwd: '/tmp/work',
      });
      // Environment should include CLAUDE_INSTANCE_ID
      expect(call[2]!.env).toMatchObject({
        CUSTOM_VAR: 'test',
        CLAUDE_INSTANCE_ID: 'p01-feature',
      });
    });

    it('should register onData handler that forwards output via IPC', () => {
      const config: CLISpawnConfig = {
        command: 'claude',
        args: [],
        cwd: '/tmp',
      };

      spawner.spawn(config);

      // The spawner should have registered an onData callback
      expect(mockOnData).toHaveBeenCalledTimes(1);
      const onDataCallback = mockOnData.mock.calls[0][0];

      // Simulate data from PTY
      onDataCallback('Hello from PTY');

      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'cli:output',
        {
          sessionId: 'test-uuid-1',
          data: 'Hello from PTY',
        },
      );
    });

    it('should register onExit handler that updates session status', () => {
      const config: CLISpawnConfig = {
        command: 'claude',
        args: [],
        cwd: '/tmp',
      };

      const session = spawner.spawn(config);

      expect(mockOnExit).toHaveBeenCalledTimes(1);
      const onExitCallback = mockOnExit.mock.calls[0][0];

      // Simulate exit
      onExitCallback({ exitCode: 0, signal: 0 });

      expect(session.status).toBe('exited');
      expect(session.exitCode).toBe(0);
      expect(session.exitedAt).toBeDefined();
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'cli:exit',
        {
          sessionId: 'test-uuid-1',
          exitCode: 0,
        },
      );
    });
  });

  describe('kill()', () => {
    it('should send SIGTERM to the pty process', () => {
      const config: CLISpawnConfig = {
        command: 'claude',
        args: [],
        cwd: '/tmp',
      };

      const session = spawner.spawn(config);
      const result = spawner.kill(session.id);

      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalled();
    });

    it('should return false for unknown session id', () => {
      const result = spawner.kill('nonexistent-id');
      expect(result).toBe(false);
    });

    it('should escalate to SIGKILL after timeout', async () => {
      vi.useFakeTimers();

      const config: CLISpawnConfig = {
        command: 'claude',
        args: [],
        cwd: '/tmp',
      };

      const session = spawner.spawn(config);
      spawner.kill(session.id);

      // First call is the initial kill
      expect(mockKill).toHaveBeenCalledTimes(1);

      // Advance timers past the 5 second timeout
      vi.advanceTimersByTime(5001);

      // Should have been called again with SIGKILL
      expect(mockKill).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('write()', () => {
    it('should write data to the pty process', () => {
      const config: CLISpawnConfig = {
        command: 'claude',
        args: [],
        cwd: '/tmp',
      };

      const session = spawner.spawn(config);
      const result = spawner.write(session.id, 'test input\n');

      expect(result).toBe(true);
      expect(mockWrite).toHaveBeenCalledWith('test input\n');
    });

    it('should return false for unknown session id', () => {
      const result = spawner.write('nonexistent-id', 'data');
      expect(result).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return all tracked sessions', () => {
      const config1: CLISpawnConfig = {
        command: 'claude',
        args: ['--agent', 'backend'],
        cwd: '/tmp/1',
      };
      const config2: CLISpawnConfig = {
        command: 'claude',
        args: ['--agent', 'frontend'],
        cwd: '/tmp/2',
      };

      spawner.spawn(config1);
      spawner.spawn(config2);

      const sessions = spawner.list();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('test-uuid-1');
      expect(sessions[1].id).toBe('test-uuid-2');
    });

    it('should return empty array when no sessions exist', () => {
      const sessions = spawner.list();
      expect(sessions).toHaveLength(0);
    });
  });

  describe('killAll()', () => {
    it('should kill all active sessions', () => {
      const config: CLISpawnConfig = {
        command: 'claude',
        args: [],
        cwd: '/tmp',
      };

      spawner.spawn(config);
      spawner.spawn(config);
      spawner.spawn(config);

      spawner.killAll();

      // kill() is called for each session, each calling mockKill once
      expect(mockKill).toHaveBeenCalledTimes(3);
    });
  });
});
