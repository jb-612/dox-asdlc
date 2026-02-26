// @vitest-environment node
// ---------------------------------------------------------------------------
// WorkspaceIsolator tests (P15-F05 Phase C, T29)
//
// Tests for per-block workspace isolation: copy, cleanup, and error handling.
// Uses mocked fs operations.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceIsolator } from '../../src/main/services/workspace-isolator';

// ---------------------------------------------------------------------------
// Mock fs/promises
// ---------------------------------------------------------------------------
const mockCp = vi.fn(async () => {});
const mockRm = vi.fn(async () => {});
const mockMkdir = vi.fn(async () => undefined);
const mockAccess = vi.fn(async () => {});

vi.mock('fs/promises', () => ({
  cp: (...args: unknown[]) => mockCp(...args),
  rm: (...args: unknown[]) => mockRm(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  access: (...args: unknown[]) => mockAccess(...args),
}));

// Mock os.tmpdir
vi.mock('os', () => ({
  tmpdir: () => '/tmp',
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('WorkspaceIsolator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isolate', () => {
    it('creates a temp directory and copies workspace into it', async () => {
      const isolator = new WorkspaceIsolator();

      const result = await isolator.isolate('/project/repo', 'block-1');

      expect(mockMkdir).toHaveBeenCalledTimes(1);
      expect(mockCp).toHaveBeenCalledTimes(1);

      // The destination should include the block ID
      const [src, dest, opts] = mockCp.mock.calls[0];
      expect(src).toBe('/project/repo');
      expect(dest).toContain('block-1');
      expect(opts).toEqual(expect.objectContaining({ recursive: true }));

      // Return the isolated path
      expect(result).toContain('block-1');
    });

    it('returns a path under the temp directory', async () => {
      const isolator = new WorkspaceIsolator();

      const result = await isolator.isolate('/project/repo', 'block-X');

      expect(result).toMatch(/^\/tmp\//);
    });

    it('propagates errors from fs operations', async () => {
      mockMkdir.mockRejectedValueOnce(new Error('disk full'));

      const isolator = new WorkspaceIsolator();

      await expect(isolator.isolate('/project/repo', 'block-1')).rejects.toThrow('disk full');
    });

    it('generates unique paths for different block IDs', async () => {
      const isolator = new WorkspaceIsolator();

      const path1 = await isolator.isolate('/project/repo', 'block-A');
      const path2 = await isolator.isolate('/project/repo', 'block-B');

      expect(path1).not.toBe(path2);
    });
  });

  describe('cleanup', () => {
    it('removes the isolated workspace with recursive and force flags', async () => {
      const isolator = new WorkspaceIsolator();

      await isolator.cleanup('/tmp/asdlc-workspace-block-1');

      expect(mockRm).toHaveBeenCalledWith(
        '/tmp/asdlc-workspace-block-1',
        expect.objectContaining({ recursive: true, force: true }),
      );
    });

    it('does not throw when cleanup of non-existent path fails', async () => {
      mockRm.mockRejectedValueOnce(new Error('ENOENT'));

      const isolator = new WorkspaceIsolator();

      await expect(
        isolator.cleanup('/tmp/asdlc-workspace-nonexistent'),
      ).resolves.not.toThrow();
    });

    it('rejects paths outside of temp directory for safety', async () => {
      const isolator = new WorkspaceIsolator();

      await expect(
        isolator.cleanup('/home/user/important-data'),
      ).rejects.toThrow(/unsafe/i);
    });
  });
});
