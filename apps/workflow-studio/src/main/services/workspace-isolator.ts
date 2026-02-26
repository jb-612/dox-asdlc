// ---------------------------------------------------------------------------
// Workspace isolator (P15-F05, T29)
//
// For parallel blocks, each needs its own workspace copy to prevent
// concurrent file access conflicts. This service creates and cleans up
// isolated workspace copies.
//
// Each isolation creates a temporary directory under os.tmpdir() and
// recursively copies the source workspace into it.
// ---------------------------------------------------------------------------

import { cp, rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Manages per-block workspace isolation for parallel execution.
 *
 * Each parallel block receives its own copy of the workspace directory,
 * which is cleaned up after the block completes.
 */
export class WorkspaceIsolator {
  /**
   * Create an isolated copy of a workspace for a specific block.
   *
   * @param workspacePath Absolute path to the source workspace directory.
   * @param blockId       Unique block identifier used to name the copy.
   * @returns The absolute path to the isolated workspace copy.
   */
  async isolate(workspacePath: string, blockId: string): Promise<string> {
    const timestamp = Date.now();
    const dirName = `asdlc-workspace-${blockId}-${timestamp}`;
    const isolatedPath = join(tmpdir(), dirName);

    await mkdir(isolatedPath, { recursive: true });
    await cp(workspacePath, isolatedPath, { recursive: true });

    return isolatedPath;
  }

  /**
   * Clean up an isolated workspace.
   *
   * For safety, only removes paths that are under the system temp directory.
   *
   * @param isolatedPath The path to the isolated workspace to remove.
   * @throws Error if the path is not under the temp directory.
   */
  async cleanup(isolatedPath: string): Promise<void> {
    // Safety check: only allow removal of paths under tmp
    const tmp = tmpdir();
    if (!isolatedPath.startsWith(tmp)) {
      throw new Error(
        `Unsafe cleanup path: '${isolatedPath}' is not under '${tmp}'. ` +
          'Only temporary workspace paths can be cleaned up.',
      );
    }

    try {
      await rm(isolatedPath, { recursive: true, force: true });
    } catch {
      // Best effort -- do not throw if cleanup fails (e.g. ENOENT)
    }
  }
}
