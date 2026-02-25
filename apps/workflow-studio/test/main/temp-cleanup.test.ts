// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Tests for temp directory cleanup on app quit (P15-F03, T22)
//
// The main process should scan os.tmpdir() for directories matching the
// pattern "wf-repo-*" when the app quits, remove each one, and log the count.
// Non-matching entries must be left untouched.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReaddirSync = vi.fn();
const mockRmSync = vi.fn();
const mockTmpdir = vi.fn(() => '/tmp');
const mockConsoleLog = vi.fn();

vi.mock('fs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('fs')>();
  return {
    ...orig,
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
    rmSync: (...args: unknown[]) => mockRmSync(...args),
  };
});

vi.mock('os', async (importOriginal) => {
  const orig = await importOriginal<typeof import('os')>();
  return {
    ...orig,
    tmpdir: () => mockTmpdir(),
  };
});

// ---------------------------------------------------------------------------
// Import the cleanup utility
// ---------------------------------------------------------------------------

import { cleanupTempRepoDirs } from '../../src/main/temp-cleanup';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cleanupTempRepoDirs (P15-F03, T22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(mockConsoleLog);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes directories matching wf-repo-* pattern', () => {
    mockReaddirSync.mockReturnValue([
      'wf-repo-abc123',
      'wf-repo-def456',
      'other-dir',
      'some-file.txt',
    ]);

    cleanupTempRepoDirs();

    expect(mockRmSync).toHaveBeenCalledTimes(2);
    expect(mockRmSync).toHaveBeenCalledWith('/tmp/wf-repo-abc123', {
      recursive: true,
      force: true,
    });
    expect(mockRmSync).toHaveBeenCalledWith('/tmp/wf-repo-def456', {
      recursive: true,
      force: true,
    });
  });

  it('leaves non-matching directories alone', () => {
    mockReaddirSync.mockReturnValue([
      'other-dir',
      'my-project',
      'some-file.txt',
    ]);

    cleanupTempRepoDirs();

    expect(mockRmSync).not.toHaveBeenCalled();
  });

  it('logs the cleanup count when directories are removed', () => {
    mockReaddirSync.mockReturnValue([
      'wf-repo-aaa',
      'wf-repo-bbb',
      'wf-repo-ccc',
    ]);

    cleanupTempRepoDirs();

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[Cleanup] Removed 3 temporary repo directories',
    );
  });

  it('does not log when no directories are removed', () => {
    mockReaddirSync.mockReturnValue(['other-dir']);

    cleanupTempRepoDirs();

    expect(mockConsoleLog).not.toHaveBeenCalledWith(
      expect.stringContaining('[Cleanup]'),
    );
  });

  it('handles empty temp directory', () => {
    mockReaddirSync.mockReturnValue([]);

    cleanupTempRepoDirs();

    expect(mockRmSync).not.toHaveBeenCalled();
  });

  it('continues cleanup if individual rm fails', () => {
    mockReaddirSync.mockReturnValue([
      'wf-repo-first',
      'wf-repo-second',
      'wf-repo-third',
    ]);
    mockRmSync
      .mockImplementationOnce(() => { /* success */ })
      .mockImplementationOnce(() => { throw new Error('EPERM'); })
      .mockImplementationOnce(() => { /* success */ });

    // Should not throw
    cleanupTempRepoDirs();

    // All three should be attempted
    expect(mockRmSync).toHaveBeenCalledTimes(3);
    // Only 2 succeeded
    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[Cleanup] Removed 2 temporary repo directories',
    );
  });

  it('does not crash when readdirSync throws', () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    // Should not throw
    expect(() => cleanupTempRepoDirs()).not.toThrow();
  });
});
