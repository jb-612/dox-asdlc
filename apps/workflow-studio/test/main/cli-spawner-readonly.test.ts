// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { CLISpawnConfig } from '../../src/shared/types/cli';

// ---------------------------------------------------------------------------
// Tests for read-only Docker mounts (P15-F03, T23)
//
// When repoMount.readOnly is true:
//   1. The Docker bind mount should include `:ro` suffix
//   2. The system prompt should include a read-only instruction
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CLISpawner: read-only Docker mounts (T23)', () => {
  let CLISpawner: typeof import('../../src/main/services/cli-spawner').CLISpawner;
  let ptyModule: typeof import('node-pty');
  let spawner: InstanceType<typeof CLISpawner>;
  let mockMainWindow: BrowserWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockOnData.mockReset();
    mockOnExit.mockReset();
    mockWrite.mockReset();
    mockKill.mockReset();

    mockMainWindow = {
      webContents: {
        send: vi.fn(),
      },
    } as unknown as BrowserWindow;

    const mod = await import('../../src/main/services/cli-spawner');
    CLISpawner = mod.CLISpawner;
    ptyModule = await import('node-pty');

    spawner = new CLISpawner(mockMainWindow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends :ro to bind mount when context.readOnly is true', () => {
    const config: CLISpawnConfig = {
      command: 'claude',
      args: [],
      cwd: '/tmp',
      mode: 'docker',
      context: {
        repoPath: '/home/user/my-repo',
        readOnly: true,
      },
    };

    spawner.spawn(config);

    // Inspect the docker args passed to pty.spawn
    const call = vi.mocked(ptyModule.spawn).mock.calls[0];
    const dockerArgs = call[1] as string[];

    // Should have -v /home/user/my-repo:/workspace:ro
    expect(dockerArgs).toContain('-v');
    const vIndex = dockerArgs.indexOf('-v');
    const mountArg = dockerArgs[vIndex + 1];
    expect(mountArg).toBe('/home/user/my-repo:/workspace:ro');
  });

  it('does NOT append :ro when context.readOnly is false', () => {
    const config: CLISpawnConfig = {
      command: 'claude',
      args: [],
      cwd: '/tmp',
      mode: 'docker',
      context: {
        repoPath: '/home/user/my-repo',
        readOnly: false,
      },
    };

    spawner.spawn(config);

    const call = vi.mocked(ptyModule.spawn).mock.calls[0];
    const dockerArgs = call[1] as string[];

    const vIndex = dockerArgs.indexOf('-v');
    const mountArg = dockerArgs[vIndex + 1];
    expect(mountArg).toBe('/home/user/my-repo:/workspace');
  });

  it('does NOT append :ro when context.readOnly is undefined', () => {
    const config: CLISpawnConfig = {
      command: 'claude',
      args: [],
      cwd: '/tmp',
      mode: 'docker',
      context: {
        repoPath: '/home/user/my-repo',
      },
    };

    spawner.spawn(config);

    const call = vi.mocked(ptyModule.spawn).mock.calls[0];
    const dockerArgs = call[1] as string[];

    const vIndex = dockerArgs.indexOf('-v');
    const mountArg = dockerArgs[vIndex + 1];
    expect(mountArg).toBe('/home/user/my-repo:/workspace');
  });

  it('prepends read-only instruction to system prompt when context.readOnly is true', () => {
    const config: CLISpawnConfig = {
      command: 'claude',
      args: [],
      cwd: '/tmp',
      mode: 'docker',
      context: {
        repoPath: '/home/user/my-repo',
        readOnly: true,
        systemPrompt: 'Do something useful.',
      },
    };

    spawner.spawn(config);

    const call = vi.mocked(ptyModule.spawn).mock.calls[0];
    const dockerArgs = call[1] as string[];

    // Find the --system-prompt arg
    const spIdx = dockerArgs.indexOf('--system-prompt');
    expect(spIdx).toBeGreaterThan(-1);
    const systemPromptValue = dockerArgs[spIdx + 1];
    expect(systemPromptValue).toContain(
      'This repository is mounted read-only. Do not attempt to write files.',
    );
    // Should also contain the original prompt
    expect(systemPromptValue).toContain('Do something useful.');
  });

  it('sets system prompt with read-only instruction even when no systemPrompt provided', () => {
    const config: CLISpawnConfig = {
      command: 'claude',
      args: [],
      cwd: '/tmp',
      mode: 'docker',
      context: {
        repoPath: '/home/user/my-repo',
        readOnly: true,
      },
    };

    spawner.spawn(config);

    const call = vi.mocked(ptyModule.spawn).mock.calls[0];
    const dockerArgs = call[1] as string[];

    const spIdx = dockerArgs.indexOf('--system-prompt');
    expect(spIdx).toBeGreaterThan(-1);
    const systemPromptValue = dockerArgs[spIdx + 1];
    expect(systemPromptValue).toContain(
      'This repository is mounted read-only. Do not attempt to write files.',
    );
  });
});
