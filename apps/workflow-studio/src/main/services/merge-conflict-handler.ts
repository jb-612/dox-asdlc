// ---------------------------------------------------------------------------
// Merge conflict handler (P15-F09, T13)
//
// Detects file-level merge conflicts from parallel block results and
// orchestrates resolution via the renderer process (HITL gate pattern).
//
// Integration point: called after WorkflowExecutor.execute() returns
// results from a parallel lane that uses the 'workspace' merge strategy.
// ---------------------------------------------------------------------------

import type { ParallelBlockResult, MergeConflict, MergeResolution } from '../../shared/types/execution';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { mergeResults } from './merge-strategies';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Dependencies injected into handleMergeConflicts for testability.
 * In production, sendToRenderer wraps BrowserWindow.webContents.send
 * and waitForResolution wraps a Promise-based IPC gate.
 */
export interface MergeConflictDeps {
  /** Send a message to the renderer process. */
  sendToRenderer: (channel: string, data: unknown) => void;
  /** Wait for the renderer to submit merge resolutions. */
  waitForResolution: () => Promise<MergeResolution[]>;
}

/**
 * Result of the merge conflict resolution process.
 */
export interface MergeConflictResult {
  /** Whether any conflicts were detected. */
  hadConflicts: boolean;
  /** Whether the user chose to abort the merge. */
  aborted: boolean;
  /** The original parallel block results (passthrough). */
  resolvedResults: ParallelBlockResult[];
  /** All resolved file paths (union of all blocks, conflicts resolved). */
  resolvedFiles: string[];
  /** Map of conflicting file paths to the block ID whose version was kept. */
  keptBlocks: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Handle merge conflicts from parallel block execution results.
 *
 * Uses the 'workspace' merge strategy to detect file-level conflicts,
 * then sends conflicts to the renderer for human resolution. Waits for
 * the user to choose which block's version to keep for each conflicting
 * file before returning the resolved result.
 *
 * If no conflicts are detected, returns immediately without involving
 * the renderer.
 *
 * @param results  Array of ParallelBlockResult from a completed parallel lane.
 * @param deps     Injectable dependencies for IPC communication.
 * @returns Resolved merge result with conflict decisions applied.
 */
export async function handleMergeConflicts(
  results: ParallelBlockResult[],
  deps: MergeConflictDeps,
): Promise<MergeConflictResult> {
  // Use workspace merge strategy to detect file conflicts
  const merged = mergeResults('workspace', results) as {
    files: string[];
    conflicts: string[];
  };

  const allFiles = merged.files;
  const conflictPaths = merged.conflicts;

  // No conflicts -- return immediately
  if (conflictPaths.length === 0) {
    return {
      hadConflicts: false,
      aborted: false,
      resolvedResults: results,
      resolvedFiles: allFiles,
      keptBlocks: {},
    };
  }

  // Build MergeConflict objects identifying which blocks conflict on each file
  const conflicts = buildConflicts(conflictPaths, results);

  // Send conflicts to the renderer for human resolution
  deps.sendToRenderer(IPC_CHANNELS.EXECUTION_MERGE_CONFLICT, conflicts);

  // Wait for the renderer to submit resolutions
  const resolutions = await deps.waitForResolution();

  // Check for abort
  const hasAbort = resolutions.some((r) => r.keepBlockId === 'abort');
  if (hasAbort) {
    return {
      hadConflicts: true,
      aborted: true,
      resolvedResults: results,
      resolvedFiles: [],
      keptBlocks: {},
    };
  }

  // Apply resolutions
  const keptBlocks: Record<string, string> = {};
  for (const resolution of resolutions) {
    keptBlocks[resolution.filePath] = resolution.keepBlockId;
  }

  return {
    hadConflicts: true,
    aborted: false,
    resolvedResults: results,
    resolvedFiles: allFiles,
    keptBlocks,
  };
}

/**
 * Build MergeConflict objects from conflicting file paths and block results.
 *
 * For each conflicting file, identifies the first two blocks that both
 * modified it and creates a MergeConflict entry.
 *
 * @param conflictPaths  Array of file paths with conflicts.
 * @param results        Array of parallel block results.
 * @returns Array of MergeConflict objects.
 */
function buildConflicts(
  conflictPaths: string[],
  results: ParallelBlockResult[],
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];

  for (const filePath of conflictPaths) {
    // Find which blocks touched this file
    const touchingBlocks: string[] = [];
    for (const result of results) {
      const output = result.output as Record<string, unknown> | undefined;
      const filesChanged = output?.filesChanged;
      if (Array.isArray(filesChanged) && filesChanged.includes(filePath)) {
        touchingBlocks.push(result.blockId);
      }
    }

    if (touchingBlocks.length >= 2) {
      conflicts.push({
        filePath,
        blockAId: touchingBlocks[0],
        blockBId: touchingBlocks[1],
      });
    }
  }

  return conflicts;
}
