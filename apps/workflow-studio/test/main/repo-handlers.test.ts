// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ---------------------------------------------------------------------------
// Mocks -- ipcMain stub + child_process + electron dialog
// ---------------------------------------------------------------------------

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    },
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

// Mock child_process.execFile for clone tests
const mockExecFile = vi.fn();
vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  return handler({} as Electron.IpcMainInvokeEvent, ...args);
}

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { registerRepoHandlers, isHttpsUrl } from '../../src/main/ipc/repo-handlers';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isHttpsUrl', () => {
  it('accepts valid HTTPS URL', () => {
    expect(isHttpsUrl('https://github.com/owner/repo.git')).toBe(true);
  });

  it('rejects HTTP URL', () => {
    expect(isHttpsUrl('http://github.com/owner/repo.git')).toBe(false);
  });

  it('rejects file:// URL', () => {
    expect(isHttpsUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects ssh:// URL', () => {
    expect(isHttpsUrl('ssh://git@github.com/owner/repo.git')).toBe(false);
  });

  it('rejects git:// URL', () => {
    expect(isHttpsUrl('git://github.com/owner/repo.git')).toBe(false);
  });

  it('rejects malformed URL', () => {
    expect(isHttpsUrl('not-a-url')).toBe(false);
  });
});

describe('repo-handlers', () => {
  beforeEach(async () => {
    handlers.clear();
    // Reset module-level activeClone state by reimporting fresh
    vi.resetModules();
    // Re-mock to keep our stubs after resetModules
    vi.doMock('electron', () => ({
      ipcMain: {
        handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
          handlers.set(channel, handler);
        },
      },
      dialog: {
        showOpenDialog: vi.fn(),
      },
    }));
    vi.doMock('child_process', () => ({
      execFile: (...args: unknown[]) => mockExecFile(...args),
    }));
    const mod = await import('../../src/main/ipc/repo-handlers');
    mod.registerRepoHandlers();
    mockExecFile.mockReset();
  });

  describe('REPO_VALIDATE_PATH', () => {
    it('returns valid=true, hasGit=true for directory with .git', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'repo-test-'));
      mkdirSync(join(dir, '.git'));

      try {
        const result = await invokeHandler('repo:validate-path', dir) as { valid: boolean; hasGit: boolean };
        expect(result.valid).toBe(true);
        expect(result.hasGit).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('returns valid=true, hasGit=false for directory without .git', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'repo-test-'));

      try {
        const result = await invokeHandler('repo:validate-path', dir) as { valid: boolean; hasGit: boolean };
        expect(result.valid).toBe(true);
        expect(result.hasGit).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('returns valid=false for non-existent path', async () => {
      const result = await invokeHandler('repo:validate-path', '/tmp/does-not-exist-' + Date.now()) as { valid: boolean };
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for a file path', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'repo-test-'));
      const filePath = join(dir, 'a-file.txt');
      writeFileSync(filePath, 'hello');

      try {
        const result = await invokeHandler('repo:validate-path', filePath) as { valid: boolean };
        expect(result.valid).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('REPO_CLONE', () => {
    it('rejects file:// URL without calling execFile', async () => {
      const result = await invokeHandler('repo:clone', 'file:///etc/passwd') as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Only HTTPS/i);
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('rejects ssh:// URL', async () => {
      const result = await invokeHandler('repo:clone', 'ssh://git@github.com/owner/repo.git') as { success: boolean };
      expect(result.success).toBe(false);
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('calls git clone with --config core.hooksPath=/dev/null for HTTPS URL', async () => {
      // Mock successful clone
      mockExecFile.mockImplementation((_cmd: string, args: string[], _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
        return { kill: vi.fn() };
      });

      const result = await invokeHandler('repo:clone', 'https://github.com/owner/repo.git') as { success: boolean; localPath: string };

      expect(result.success).toBe(true);
      expect(result.localPath).toBeTruthy();

      // Verify security args
      const callArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(callArgs).toContain('--depth=1');
      expect(callArgs).toContain('--config');
      expect(callArgs).toContain('core.hooksPath=/dev/null');
    });

    it('returns error on clone failure', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(new Error('clone failed'), '', 'fatal: repo not found');
        return { kill: vi.fn() };
      });

      const result = await invokeHandler('repo:clone', 'https://github.com/owner/nonexistent.git') as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('REPO_CLONE_CANCEL', () => {
    it('returns error when no active clone', async () => {
      const result = await invokeHandler('repo:clone-cancel') as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No active clone/);
    });
  });
});
