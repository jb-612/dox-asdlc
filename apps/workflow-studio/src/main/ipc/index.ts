import { registerWorkflowHandlers } from './workflow-handlers';
import { registerExecutionHandlers } from './execution-handlers';
import { registerWorkItemHandlers } from './workitem-handlers';
import { registerCLIHandlers } from './cli-handlers';

/**
 * Register all IPC handlers on the main process.
 *
 * Must be called once after app.whenReady() resolves. Each handler module
 * registers its own ipcMain.handle() listeners for the channels defined
 * in shared/ipc-channels.ts.
 */
export function registerAllHandlers(): void {
  registerWorkflowHandlers();
  registerExecutionHandlers();
  registerWorkItemHandlers();
  registerCLIHandlers();
}
