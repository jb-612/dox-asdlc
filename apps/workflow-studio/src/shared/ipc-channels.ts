export const IPC_CHANNELS = {
  // Workflow operations
  WORKFLOW_LIST: 'workflow:list',
  WORKFLOW_LOAD: 'workflow:load',
  WORKFLOW_SAVE: 'workflow:save',
  WORKFLOW_DELETE: 'workflow:delete',

  // Execution operations
  EXECUTION_START: 'execution:start',
  EXECUTION_PAUSE: 'execution:pause',
  EXECUTION_RESUME: 'execution:resume',
  EXECUTION_ABORT: 'execution:abort',
  EXECUTION_GATE_DECISION: 'execution:gate-decision',

  // Execution events (main -> renderer)
  EXECUTION_EVENT: 'execution:event',
  EXECUTION_STATE_UPDATE: 'execution:state-update',

  // Work item operations
  WORKITEM_LIST: 'workitem:list',
  WORKITEM_GET: 'workitem:get',

  // CLI operations
  CLI_SPAWN: 'cli:spawn',
  CLI_KILL: 'cli:kill',
  CLI_LIST: 'cli:list',
  CLI_WRITE: 'cli:write',

  // CLI events (main -> renderer)
  CLI_OUTPUT: 'cli:output',
  CLI_EXIT: 'cli:exit',
  CLI_ERROR: 'cli:error',

  // Settings operations
  SETTINGS_LOAD: 'settings:load',
  SETTINGS_SAVE: 'settings:save',

  // Dialog operations
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
