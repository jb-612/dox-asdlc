// ---------------------------------------------------------------------------
// Monitoring IPC handlers (P15-F07, T04)
//
// Registers IPC channels for telemetry queries and pushes live events to all
// renderer windows whenever the MonitoringStore emits an 'event'.
//
// Channels registered (invoke):
//   - monitoring:get-events      -> store.getEvents(filter?)
//   - monitoring:get-sessions    -> store.getSessions()
//   - monitoring:get-stats       -> store.getStats()
//   - monitoring:start-receiver  -> receiver.start()
//   - monitoring:stop-receiver   -> receiver.stop()
//
// Push events (main -> renderer):
//   - monitoring:event        -> every TelemetryEvent appended to the store
// ---------------------------------------------------------------------------

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { MonitoringStore, EventFilter } from '../services/monitoring-store';
import type { TelemetryReceiver } from '../services/telemetry-receiver';

/**
 * Register IPC handlers for monitoring queries and receiver lifecycle control.
 *
 * @param store    The MonitoringStore instance managed by the main process.
 * @param receiver The TelemetryReceiver instance managed by the main process.
 */
export function registerMonitoringHandlers(store: MonitoringStore, receiver: TelemetryReceiver): void {
  ipcMain.handle(
    IPC_CHANNELS.MONITORING_GET_EVENTS,
    (_event, filter?: EventFilter) => store.getEvents(filter),
  );

  ipcMain.handle(IPC_CHANNELS.MONITORING_GET_SESSIONS, () => store.getSessions());

  ipcMain.handle(IPC_CHANNELS.MONITORING_GET_STATS, () => store.getStats());

  ipcMain.handle(IPC_CHANNELS.MONITORING_RECEIVER_START, async () => {
    try {
      await receiver.start();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.MONITORING_RECEIVER_STOP, async () => {
    await receiver.stop();
    return { success: true };
  });
}

/**
 * Subscribe to store events and push each TelemetryEvent to all renderer windows.
 * Skips destroyed windows to avoid Electron errors on teardown.
 *
 * @param store The MonitoringStore instance managed by the main process.
 */
export function setupMonitoringPush(store: MonitoringStore): void {
  store.on('event', (event) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      try {
        win.webContents.send(IPC_CHANNELS.MONITORING_EVENT, event);
      } catch {
        // Window may be in the process of being destroyed; skip it.
      }
    }
  });
}
