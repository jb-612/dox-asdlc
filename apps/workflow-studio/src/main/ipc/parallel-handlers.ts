// ---------------------------------------------------------------------------
// Parallel execution IPC handlers (P15-F05, T14)
//
// Registers IPC channels for container pool management and execution lane
// events. Bridges the ContainerPool in the main process to the renderer.
//
// Channels registered:
//   - container:pool-status   (invoke) -> returns pool.snapshot()
//   - container:pool-start    (invoke) -> calls pool.prewarm(count)
//   - container:pool-stop     (invoke) -> calls pool.teardown()
//
// Push events (main -> renderer):
//   - container:pool-status   (push)   -> on every pool state change
//   - execution:lane-start    (push)   -> when a parallel lane begins
//   - execution:lane-complete (push)   -> when a parallel lane completes
//   - execution:block-error   (push)   -> when a block fails during execution
//   - execution:aborted       (push)   -> when execution is aborted
// ---------------------------------------------------------------------------

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { ContainerPool } from '../services/container-pool';

/**
 * Register IPC handlers for the container pool and parallel execution events.
 *
 * @param pool The ContainerPool instance managed by the main process.
 */
export function registerParallelHandlers(pool: ContainerPool): void {
  // -----------------------------------------------------------------------
  // container:pool-status (invoke) -- return current pool snapshot
  // -----------------------------------------------------------------------

  ipcMain.handle(IPC_CHANNELS.CONTAINER_POOL_STATUS, () => {
    return pool.snapshot();
  });

  // -----------------------------------------------------------------------
  // container:pool-start (invoke) -- prewarm containers
  // -----------------------------------------------------------------------

  ipcMain.handle(
    IPC_CHANNELS.CONTAINER_POOL_START,
    async (_event, config: { count: number }) => {
      try {
        await pool.prewarm(config.count);
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  // -----------------------------------------------------------------------
  // container:pool-stop (invoke) -- teardown all containers
  // -----------------------------------------------------------------------

  ipcMain.handle(IPC_CHANNELS.CONTAINER_POOL_STOP, async () => {
    try {
      await pool.teardown();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // -----------------------------------------------------------------------
  // State-change callback -> push to renderer
  // -----------------------------------------------------------------------

  pool.onStateChange = () => {
    const windows = BrowserWindow.getAllWindows();
    const snapshot = pool.snapshot();
    for (const win of windows) {
      win.webContents.send(IPC_CHANNELS.CONTAINER_POOL_STATUS, snapshot);
    }
  };
}

// ---------------------------------------------------------------------------
// Lane event emitters (called by the workflow executor)
// ---------------------------------------------------------------------------

/**
 * Emit a lane-start event to all renderer windows.
 *
 * @param laneIndex The index of the lane in the execution plan.
 * @param nodeIds   The node IDs in the parallel lane.
 */
export function emitLaneStart(laneIndex: number, nodeIds: string[]): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send(IPC_CHANNELS.EXECUTION_LANE_START, { laneIndex, nodeIds });
  }
}

/**
 * Emit a lane-complete event to all renderer windows.
 *
 * @param laneIndex The index of the lane in the execution plan.
 * @param results   Summary results for each block in the lane.
 */
export function emitLaneComplete(
  laneIndex: number,
  results: Array<{ blockId: string; success: boolean }>,
): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send(IPC_CHANNELS.EXECUTION_LANE_COMPLETE, { laneIndex, results });
  }
}

/**
 * Emit a block-error event to all renderer windows.
 *
 * @param blockId The block that errored.
 * @param error   Human-readable error message.
 */
export function emitBlockError(blockId: string, error: string): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send(IPC_CHANNELS.EXECUTION_BLOCK_ERROR, { blockId, error });
  }
}

/**
 * Emit an execution-aborted event to all renderer windows.
 *
 * @param executionId The execution that was aborted.
 */
export function emitAborted(executionId: string): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send(IPC_CHANNELS.EXECUTION_ABORTED, { executionId });
  }
}
