// @vitest-environment node
// ---------------------------------------------------------------------------
// Merge conflict wiring tests (P15-F09, T13)
//
// Verifies that merge conflicts are detected after parallel lane execution,
// sent to the renderer via IPC, and resolved via a Promise-based gate.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParallelBlockResult, MergeConflict, MergeResolution } from '../../src/shared/types/execution';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';
import { mergeResults } from '../../src/main/services/merge-strategies';
import { handleMergeConflicts, type MergeConflictDeps } from '../../src/main/services/merge-conflict-handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a ParallelBlockResult with filesChanged in its output.
 */
function makeResult(blockId: string, filesChanged: string[]): ParallelBlockResult {
  return {
    blockId,
    success: true,
    output: { filesChanged },
    durationMs: 100,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Merge conflict wiring (T13)', () => {
  let sentMessages: Array<{ channel: string; data: unknown }>;
  let resolutionCallback: ((resolutions: MergeResolution[]) => void) | null;

  const makeDeps = (): MergeConflictDeps => {
    sentMessages = [];
    resolutionCallback = null;

    return {
      sendToRenderer: vi.fn((channel: string, data: unknown) => {
        sentMessages.push({ channel, data });
      }),
      waitForResolution: vi.fn(() => {
        return new Promise<MergeResolution[]>((resolve) => {
          resolutionCallback = resolve;
        });
      }),
    };
  };

  it('calls mergeResults after WorkflowExecutor completes parallel lane', () => {
    // Verify mergeResults is called with 'workspace' strategy and produces
    // a result that includes files and conflicts arrays.
    const results: ParallelBlockResult[] = [
      makeResult('block-A', ['src/foo.ts', 'src/bar.ts']),
      makeResult('block-B', ['src/bar.ts', 'src/baz.ts']),
    ];

    const merged = mergeResults('workspace', results) as { files: string[]; conflicts: string[] };

    expect(merged.files).toContain('src/foo.ts');
    expect(merged.files).toContain('src/bar.ts');
    expect(merged.files).toContain('src/baz.ts');
    expect(merged.conflicts).toEqual(['src/bar.ts']);
  });

  it('sends conflicts to renderer via IPC when mergeResults has conflicts', async () => {
    const deps = makeDeps();
    const results: ParallelBlockResult[] = [
      makeResult('block-A', ['src/shared.ts']),
      makeResult('block-B', ['src/shared.ts']),
    ];

    // Start handleMergeConflicts -- it should send conflicts to the renderer
    const handlePromise = handleMergeConflicts(results, deps);

    // Allow microtasks to settle so sendToRenderer is called
    await vi.waitFor(() => {
      expect(deps.sendToRenderer).toHaveBeenCalled();
    });

    // Verify the IPC message
    const conflictMsg = sentMessages.find(
      (m) => m.channel === IPC_CHANNELS.EXECUTION_MERGE_CONFLICT,
    );
    expect(conflictMsg).toBeDefined();

    const conflicts = conflictMsg!.data as MergeConflict[];
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].filePath).toBe('src/shared.ts');

    // Resolve so the promise completes
    if (resolutionCallback) {
      resolutionCallback([{ filePath: 'src/shared.ts', keepBlockId: 'block-A' }]);
    }

    const resolved = await handlePromise;
    expect(resolved.resolvedResults).toBeDefined();
  });

  it('waits for resolution and applies it', async () => {
    const deps = makeDeps();
    const results: ParallelBlockResult[] = [
      makeResult('block-A', ['src/shared.ts', 'src/a-only.ts']),
      makeResult('block-B', ['src/shared.ts', 'src/b-only.ts']),
    ];

    const handlePromise = handleMergeConflicts(results, deps);

    // Wait for the handler to send conflicts
    await vi.waitFor(() => {
      expect(deps.sendToRenderer).toHaveBeenCalled();
    });

    // Submit resolution: keep block-A's version of shared.ts
    resolutionCallback!([{ filePath: 'src/shared.ts', keepBlockId: 'block-A' }]);

    const resolved = await handlePromise;

    // The resolved results should preserve block-A for the conflicting file
    // and both blocks' non-conflicting files
    expect(resolved.resolvedFiles).toContain('src/a-only.ts');
    expect(resolved.resolvedFiles).toContain('src/b-only.ts');
    expect(resolved.resolvedFiles).toContain('src/shared.ts');
    expect(resolved.keptBlocks).toEqual({ 'src/shared.ts': 'block-A' });
  });

  it('skips merge when no conflicts detected', async () => {
    const deps = makeDeps();
    const results: ParallelBlockResult[] = [
      makeResult('block-A', ['src/foo.ts']),
      makeResult('block-B', ['src/bar.ts']),
    ];

    const resolved = await handleMergeConflicts(results, deps);

    // No conflicts means sendToRenderer should NOT be called
    expect(deps.sendToRenderer).not.toHaveBeenCalled();
    // waitForResolution should NOT be called
    expect(deps.waitForResolution).not.toHaveBeenCalled();

    // All files should still be in the resolved set
    expect(resolved.resolvedFiles).toContain('src/foo.ts');
    expect(resolved.resolvedFiles).toContain('src/bar.ts');
    expect(resolved.hadConflicts).toBe(false);
  });

  it('handles abort resolution', async () => {
    const deps = makeDeps();
    const results: ParallelBlockResult[] = [
      makeResult('block-A', ['src/shared.ts']),
      makeResult('block-B', ['src/shared.ts']),
    ];

    const handlePromise = handleMergeConflicts(results, deps);

    await vi.waitFor(() => {
      expect(deps.sendToRenderer).toHaveBeenCalled();
    });

    // Submit abort resolution
    resolutionCallback!([{ filePath: 'src/shared.ts', keepBlockId: 'abort' }]);

    const resolved = await handlePromise;
    expect(resolved.aborted).toBe(true);
  });

  it('handles results with no filesChanged output', async () => {
    const deps = makeDeps();
    const results: ParallelBlockResult[] = [
      { blockId: 'block-A', success: true, output: { message: 'done' }, durationMs: 50 },
      { blockId: 'block-B', success: true, output: null, durationMs: 50 },
    ];

    const resolved = await handleMergeConflicts(results, deps);

    expect(deps.sendToRenderer).not.toHaveBeenCalled();
    expect(resolved.hadConflicts).toBe(false);
    expect(resolved.resolvedFiles).toEqual([]);
  });

  it('identifies which blocks conflict on each file', async () => {
    const deps = makeDeps();
    const results: ParallelBlockResult[] = [
      makeResult('block-A', ['src/shared.ts', 'src/common.ts']),
      makeResult('block-B', ['src/shared.ts']),
      makeResult('block-C', ['src/common.ts']),
    ];

    const handlePromise = handleMergeConflicts(results, deps);

    await vi.waitFor(() => {
      expect(deps.sendToRenderer).toHaveBeenCalled();
    });

    const conflictMsg = sentMessages.find(
      (m) => m.channel === IPC_CHANNELS.EXECUTION_MERGE_CONFLICT,
    );
    const conflicts = conflictMsg!.data as MergeConflict[];

    // Should have 2 conflicts: shared.ts (A vs B) and common.ts (A vs C)
    expect(conflicts).toHaveLength(2);
    const sharedConflict = conflicts.find((c) => c.filePath === 'src/shared.ts');
    const commonConflict = conflicts.find((c) => c.filePath === 'src/common.ts');
    expect(sharedConflict).toBeDefined();
    expect(commonConflict).toBeDefined();

    // Resolve both
    resolutionCallback!([
      { filePath: 'src/shared.ts', keepBlockId: 'block-A' },
      { filePath: 'src/common.ts', keepBlockId: 'block-C' },
    ]);

    const resolved = await handlePromise;
    expect(resolved.keptBlocks).toEqual({
      'src/shared.ts': 'block-A',
      'src/common.ts': 'block-C',
    });
  });
});
