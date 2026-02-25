// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { CLISession, CLISpawnConfig, CLIPreset, SessionHistoryEntry } from '../../src/shared/types/cli';

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------

let tmpDir: string;

// ---------------------------------------------------------------------------
// Electron mock — must come before any import that references 'electron'
// ---------------------------------------------------------------------------

vi.mock('electron', () => {
  // tmpDir is initialised lazily at the point app.getPath is called, so we
  // read it through a closure rather than capturing the value at mock-creation
  // time.
  return {
    app: {
      getPath: (_name: string) => tmpDir,
    },
    ipcMain: {
      handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
        handlers.set(channel, handler);
      },
    },
  };
});

// handlers map populated by ipcMain.handle — declared early so the electron
// mock closure can reference it.
const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { SessionHistoryService } from '../../src/main/services/session-history-service';
import { registerCLIHandlers } from '../../src/main/ipc/cli-handlers';

// ---------------------------------------------------------------------------
// Helpers — shared fixture factories
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<CLISpawnConfig>): CLISpawnConfig {
  return {
    command: 'claude',
    args: [],
    cwd: '/tmp',
    mode: 'local',
    ...overrides,
  };
}

function makeSession(overrides?: Partial<CLISession>): CLISession {
  return {
    id: 'session-001',
    config: makeConfig(),
    status: 'exited',
    startedAt: new Date(Date.now() - 10_000).toISOString(), // 10 s ago
    exitedAt: new Date().toISOString(),
    exitCode: 0,
    mode: 'local',
    ...overrides,
  };
}

function makeHistoryEntry(overrides?: Partial<SessionHistoryEntry>): SessionHistoryEntry {
  return {
    id: 'session-001',
    config: makeConfig(),
    startedAt: new Date(Date.now() - 10_000).toISOString(),
    exitedAt: new Date().toISOString(),
    exitCode: 0,
    mode: 'local',
    ...overrides,
  };
}

function makePreset(id: string, name: string): CLIPreset {
  return { id, name, config: makeConfig() };
}

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`);
  return handler({} as Electron.IpcMainInvokeEvent, ...args);
}

// ---------------------------------------------------------------------------
// Mock CLISpawner
// ---------------------------------------------------------------------------

function makeMockSpawner(outputBuffer = '') {
  return {
    spawn: vi.fn(),
    kill: vi.fn().mockReturnValue(true),
    list: vi.fn().mockReturnValue([]),
    write: vi.fn().mockReturnValue(true),
    getDockerStatus: vi.fn().mockResolvedValue({ available: true, version: '24.0.0' }),
    getOutputBuffer: vi.fn().mockReturnValue(outputBuffer),
  };
}

// ===========================================================================
// Suite 1 — SessionHistoryService (unit)
// ===========================================================================

describe('SessionHistoryService', () => {
  let service: SessionHistoryService;

  beforeEach(() => {
    // Each test gets a fresh tmp directory so the files are isolated.
    tmpDir = mkdtempSync(join(tmpdir(), 'shs-test-'));
    service = new SessionHistoryService();
  });

  // Cleanup after each test suite block runs (vitest runs beforeEach per-it,
  // so we use a try/finally in individual tests or accept leftover dirs).
  // Simpler: let OS clean up /tmp automatically (acceptable for unit tests).

  it('addEntry stores the entry and list returns it', () => {
    const entry = makeHistoryEntry({ id: 'e1' });
    service.addEntry(entry);

    const results = service.list();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('e1');
  });

  it('ring buffer caps at 50 entries', () => {
    for (let i = 0; i < 55; i++) {
      service.addEntry(makeHistoryEntry({ id: `e${i}` }));
    }

    const results = service.list();
    expect(results).toHaveLength(50);
  });

  it('list returns entries newest-first', () => {
    const t0 = new Date(2026, 0, 1, 0, 0, 0).toISOString();
    const t1 = new Date(2026, 0, 1, 1, 0, 0).toISOString();
    const t2 = new Date(2026, 0, 1, 2, 0, 0).toISOString();

    service.addEntry(makeHistoryEntry({ id: 'oldest', startedAt: t0 }));
    service.addEntry(makeHistoryEntry({ id: 'middle', startedAt: t1 }));
    service.addEntry(makeHistoryEntry({ id: 'newest', startedAt: t2 }));

    const results = service.list();
    // addEntry pushes in insertion order; list() reverses → newest inserted = first
    expect(results[0].id).toBe('newest');
    expect(results[2].id).toBe('oldest');
  });

  it('list respects the optional limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      service.addEntry(makeHistoryEntry({ id: `e${i}` }));
    }

    const results = service.list(3);
    expect(results).toHaveLength(3);
  });

  it('clear empties the history', () => {
    service.addEntry(makeHistoryEntry({ id: 'e1' }));
    service.addEntry(makeHistoryEntry({ id: 'e2' }));

    service.clear();

    expect(service.list()).toHaveLength(0);
  });

  it('presets round-trip through savePresets / loadPresets', () => {
    const presets: CLIPreset[] = [
      makePreset('p1', 'Preset One'),
      makePreset('p2', 'Preset Two'),
    ];

    service.savePresets(presets);

    // A new service instance reads from the same tmpDir files
    const service2 = new SessionHistoryService();
    const loaded = service2.loadPresets();

    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe('p1');
    expect(loaded[1].name).toBe('Preset Two');
  });
});

// ===========================================================================
// Suite 2 — CLI Handler Registration
// ===========================================================================

describe('CLI Handler Registration (registerCLIHandlers)', () => {
  let mockSpawner: ReturnType<typeof makeMockSpawner>;
  let mockHistoryService: {
    list: ReturnType<typeof vi.fn>;
    addEntry: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    loadPresets: ReturnType<typeof vi.fn>;
    savePresets: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Fresh tmp dir for each test (electron mock reads it lazily)
    tmpDir = mkdtempSync(join(tmpdir(), 'cli-handlers-test-'));

    handlers.clear();
    mockSpawner = makeMockSpawner();
    mockHistoryService = {
      list: vi.fn().mockReturnValue([]),
      addEntry: vi.fn(),
      clear: vi.fn(),
      loadPresets: vi.fn().mockReturnValue([]),
      savePresets: vi.fn(),
    };

    registerCLIHandlers(
      mockSpawner as unknown as import('../../src/main/services/cli-spawner').CLISpawner,
      mockHistoryService as unknown as SessionHistoryService,
    );
  });

  it('registers all 10 expected IPC channels', () => {
    const expected = [
      'cli:spawn',
      'cli:kill',
      'cli:list',
      'cli:write',
      'cli:session-history',
      'cli:session-save',
      'cli:presets-load',
      'cli:presets-save',
      'cli:docker-status',
      'cli:list-images',
    ];

    for (const channel of expected) {
      expect(handlers.has(channel), `missing handler for ${channel}`).toBe(true);
    }
  });

  it('CLI_SESSION_HISTORY delegates to historyService.list with the limit arg', async () => {
    mockHistoryService.list.mockReturnValueOnce([makeHistoryEntry({ id: 'e1' })]);

    const result = await invokeHandler('cli:session-history', 5);

    expect(mockHistoryService.list).toHaveBeenCalledWith(5);
    expect(result).toHaveLength(1);
    expect((result as SessionHistoryEntry[])[0].id).toBe('e1');
  });

  it('CLI_SESSION_SAVE builds a history entry and calls historyService.addEntry', async () => {
    const session = makeSession({ id: 'sess-99', exitCode: 0 });

    const result = await invokeHandler('cli:session-save', session) as { success: boolean };

    expect(result.success).toBe(true);
    expect(mockHistoryService.addEntry).toHaveBeenCalledTimes(1);

    const savedEntry: SessionHistoryEntry = mockHistoryService.addEntry.mock.calls[0][0];
    expect(savedEntry.id).toBe('sess-99');
    expect(savedEntry.config).toEqual(session.config);
    expect(savedEntry.startedAt).toBe(session.startedAt);
    expect(savedEntry.exitCode).toBe(0);
    expect(savedEntry.mode).toBe('local');
  });

  it('CLI_PRESETS_SAVE delegates to historyService.savePresets', async () => {
    const presets = [makePreset('px', 'My Preset')];

    const result = await invokeHandler('cli:presets-save', presets) as { success: boolean };

    expect(result.success).toBe(true);
    expect(mockHistoryService.savePresets).toHaveBeenCalledWith(presets);
  });
});

// ===========================================================================
// Suite 3 — buildSessionSummary (via CLI_SESSION_SAVE handler)
//
// buildSessionSummary is private to cli-handlers.ts so we exercise it
// indirectly through the CLI_SESSION_SAVE IPC handler, inspecting the
// sessionSummary field on the entry passed to historyService.addEntry.
// ===========================================================================

describe('buildSessionSummary (via CLI_SESSION_SAVE)', () => {
  let mockHistoryService: {
    list: ReturnType<typeof vi.fn>;
    addEntry: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    loadPresets: ReturnType<typeof vi.fn>;
    savePresets: ReturnType<typeof vi.fn>;
  };

  function setupHandlersWithOutput(outputBuffer: string): void {
    handlers.clear();
    const spawner = makeMockSpawner(outputBuffer);
    mockHistoryService = {
      list: vi.fn().mockReturnValue([]),
      addEntry: vi.fn(),
      clear: vi.fn(),
      loadPresets: vi.fn().mockReturnValue([]),
      savePresets: vi.fn(),
    };
    registerCLIHandlers(
      spawner as unknown as import('../../src/main/services/cli-spawner').CLISpawner,
      mockHistoryService as unknown as SessionHistoryService,
    );
  }

  async function saveSession(session: CLISession): Promise<SessionHistoryEntry> {
    await invokeHandler('cli:session-save', session);
    return mockHistoryService.addEntry.mock.calls[0][0] as SessionHistoryEntry;
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'summary-test-'));
  });

  it('counts tool-call patterns in the output buffer', async () => {
    setupHandlersWithOutput(
      'Tool: Read\nTool: Write\nUsing: Bash\nTool: Grep\nSome other line',
    );

    const entry = await saveSession(makeSession());
    expect(entry.sessionSummary).toBeDefined();
    expect(entry.sessionSummary!.toolCallCount).toBe(4);
  });

  it('extracts modified file paths from output buffer', async () => {
    setupHandlersWithOutput(
      'Writing src/main/index.ts\n' +
      'Editing src/renderer/App.tsx\n' +
      'Creating test/unit/foo.test.ts\n' +
      'Updated README.md\n' +
      'Writing src/main/index.ts\n', // duplicate — should be de-duped
    );

    const entry = await saveSession(makeSession());
    const files = entry.sessionSummary!.filesModified;

    // 4 unique paths (the duplicate Writing src/main/index.ts is de-duped)
    expect(files).toContain('src/main/index.ts');
    expect(files).toContain('src/renderer/App.tsx');
    expect(files).toContain('test/unit/foo.test.ts');
    expect(files).toContain('README.md');
    // Ensure de-duplication
    expect(files.filter((f) => f === 'src/main/index.ts')).toHaveLength(1);
  });

  it('calculates durationSeconds from startedAt and exitedAt', async () => {
    // Non-empty output so buildSessionSummary does not short-circuit.
    setupHandlersWithOutput('session output');

    const startedAt = new Date(2026, 0, 1, 12, 0, 0).toISOString();
    const exitedAt = new Date(2026, 0, 1, 12, 0, 30).toISOString(); // 30 s later

    const session = makeSession({ startedAt, exitedAt, exitCode: 0 });
    const entry = await saveSession(session);

    expect(entry.sessionSummary).toBeDefined();
    expect(entry.sessionSummary!.durationSeconds).toBe(30);
  });

  it('returns exitStatus "error" for a non-zero exit code', async () => {
    // Non-empty output so buildSessionSummary does not short-circuit.
    setupHandlersWithOutput('session output');

    const session = makeSession({ exitCode: 1, status: 'exited' });
    const entry = await saveSession(session);

    expect(entry.sessionSummary).toBeDefined();
    expect(entry.sessionSummary!.exitStatus).toBe('error');
  });
});
