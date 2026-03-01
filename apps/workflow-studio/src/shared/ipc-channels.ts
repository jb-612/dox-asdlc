export const IPC_CHANNELS = {
  // ---------------------------------------------------------------------------
  // Workflow operations
  // ---------------------------------------------------------------------------
  WORKFLOW_LIST: 'workflow:list',
  WORKFLOW_LOAD: 'workflow:load',
  WORKFLOW_SAVE: 'workflow:save',
  WORKFLOW_DELETE: 'workflow:delete',
  WORKFLOW_EXPORT: 'workflow:export',
  WORKFLOW_IMPORT: 'workflow:import',

  // ---------------------------------------------------------------------------
  // Template operations (P15-F02)
  // ---------------------------------------------------------------------------
  TEMPLATE_LIST: 'template:list',
  TEMPLATE_LOAD: 'template:load',
  TEMPLATE_SAVE: 'template:save',
  TEMPLATE_DELETE: 'template:delete',
  TEMPLATE_TOGGLE_STATUS: 'template:toggle-status',
  TEMPLATE_DUPLICATE: 'template:duplicate',

  // ---------------------------------------------------------------------------
  // Execution operations
  // ---------------------------------------------------------------------------
  EXECUTION_START: 'execution:start',
  EXECUTION_PAUSE: 'execution:pause',
  EXECUTION_RESUME: 'execution:resume',
  EXECUTION_ABORT: 'execution:abort',
  EXECUTION_GATE_DECISION: 'execution:gate-decision',
  /** Send revision feedback for a block in gate mode (P15-F04) */
  EXECUTION_REVISE: 'execution:revise',
  /** Signals that a block-level gate is open and awaiting decision (P15-F04) */
  EXECUTION_BLOCK_GATE: 'execution:block-gate',

  // Execution events (main -> renderer)
  EXECUTION_EVENT: 'execution:event',
  EXECUTION_STATE_UPDATE: 'execution:state-update',
  /** Parallel lane fan-out notification */
  EXECUTION_LANE_START: 'execution:lane-start',
  /** Parallel lane fan-in notification */
  EXECUTION_LANE_COMPLETE: 'execution:lane-complete',
  /** Per-block error notification */
  EXECUTION_BLOCK_ERROR: 'execution:block-error',
  /** Execution abort confirmation */
  EXECUTION_ABORTED: 'execution:aborted',
  /** Merge conflict resolution request (P15-F09) */
  EXECUTION_MERGE_CONFLICT: 'execution:merge-conflict',
  /** Merge conflict resolution response (P15-F09) */
  EXECUTION_MERGE_RESOLVE: 'execution:merge-resolve',

  // ---------------------------------------------------------------------------
  // Work item operations
  // ---------------------------------------------------------------------------
  WORKITEM_LIST: 'workitem:list',
  WORKITEM_GET: 'workitem:get',
  /** Check whether the GitHub CLI is installed and authenticated (P15-F12) */
  WORKITEM_CHECK_GH: 'workitem:check-gh',
  /** Reads work items from the filesystem workItemDirectory (P15-F03) */
  WORKITEM_LIST_FS: 'workitem:list-fs',
  /** Loads full content of a single work item from the filesystem (P15-F03) */
  WORKITEM_LOAD_FS: 'workitem:load-fs',

  // ---------------------------------------------------------------------------
  // CLI operations
  // ---------------------------------------------------------------------------
  CLI_SPAWN: 'cli:spawn',
  CLI_KILL: 'cli:kill',
  CLI_LIST: 'cli:list',
  CLI_WRITE: 'cli:write',
  /** List available Docker images for Docker-mode spawn (P15-F06) */
  CLI_LIST_IMAGES: 'cli:list-images',
  /** Persist a completed session to ring-buffer history (P15-F06) */
  CLI_SESSION_SAVE: 'cli:session-save',
  /** Load the last-N sessions from the history ring buffer (P15-F06) */
  CLI_SESSION_HISTORY: 'cli:session-history',
  /** Load quick-launch presets from disk (P15-F06) */
  CLI_PRESETS_LOAD: 'cli:presets-load',
  /** Save quick-launch presets to disk (P15-F06) */
  CLI_PRESETS_SAVE: 'cli:presets-save',

  /** Check Docker availability and version */
  CLI_DOCKER_STATUS: 'cli:docker-status',

  // CLI events (main -> renderer)
  CLI_OUTPUT: 'cli:output',
  CLI_EXIT: 'cli:exit',
  CLI_ERROR: 'cli:error',

  // ---------------------------------------------------------------------------
  // Redis events (main -> renderer)
  // ---------------------------------------------------------------------------
  REDIS_EVENT: 'redis:event',

  // ---------------------------------------------------------------------------
  // Settings operations
  // ---------------------------------------------------------------------------
  SETTINGS_LOAD: 'settings:load',
  SETTINGS_SAVE: 'settings:save',
  /** App/Electron/Node version info */
  SETTINGS_GET_VERSION: 'settings:get-version',
  /** Store an encrypted API key via electron.safeStorage (P15-F08) */
  SETTINGS_SET_API_KEY: 'settings:set-api-key',
  /** Remove a stored API key (P15-F08) */
  SETTINGS_DELETE_API_KEY: 'settings:delete-api-key',
  /** Returns only whether a key exists — never the raw key (P15-F08) */
  SETTINGS_GET_KEY_STATUS: 'settings:get-key-status',
  /** Validates connectivity to an AI provider using its stored key (P15-F08) */
  SETTINGS_TEST_PROVIDER: 'settings:test-provider',

  // ---------------------------------------------------------------------------
  // Dialog operations
  // ---------------------------------------------------------------------------
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
  DIALOG_OPEN_FILE: 'dialog:open-file',

  // ---------------------------------------------------------------------------
  // Workflow touch (P15-F03)
  // ---------------------------------------------------------------------------
  /** Update lastUsedAt timestamp on a workflow/template (P15-F03) */
  WORKFLOW_TOUCH: 'workflow:touch',

  // ---------------------------------------------------------------------------
  // Repo operations (P15-F03)
  // ---------------------------------------------------------------------------
  REPO_CLONE: 'repo:clone',
  REPO_CLONE_CANCEL: 'repo:clone-cancel',
  REPO_VALIDATE_PATH: 'repo:validate-path',
  // Repo events (main -> renderer)
  REPO_CLONE_PROGRESS: 'repo:clone-progress',

  // ---------------------------------------------------------------------------
  // Container pool operations (P15-F05)
  // ---------------------------------------------------------------------------
  CONTAINER_POOL_STATUS: 'container:pool-status',
  CONTAINER_POOL_START: 'container:pool-start',
  CONTAINER_POOL_STOP: 'container:pool-stop',
  /** Docker image pull progress event (main -> renderer) */
  CONTAINER_PULL_PROGRESS: 'container:pull-progress',

  // ---------------------------------------------------------------------------
  // Monitoring / telemetry (P15-F07)
  // ---------------------------------------------------------------------------
  MONITORING_GET_EVENTS: 'monitoring:get-events',
  MONITORING_GET_SESSIONS: 'monitoring:get-sessions',
  MONITORING_GET_STATS: 'monitoring:get-stats',
  /** Start the telemetry receiver process */
  MONITORING_RECEIVER_START: 'monitoring:receiver-start',
  /** Stop the telemetry receiver process */
  MONITORING_RECEIVER_STOP: 'monitoring:receiver-stop',
  // Monitoring events (main -> renderer)
  MONITORING_EVENT: 'monitoring:event',

  // ---------------------------------------------------------------------------
  // Execution history + replay (P15-F14)
  // ---------------------------------------------------------------------------
  EXECUTION_HISTORY_LIST: 'execution:history-list',
  EXECUTION_HISTORY_GET: 'execution:history-get',
  EXECUTION_HISTORY_CLEAR: 'execution:history-clear',
  EXECUTION_REPLAY: 'execution:replay',

  // ---------------------------------------------------------------------------
  // Analytics / cost tracking (P15-F16)
  // ---------------------------------------------------------------------------
  ANALYTICS_GET_EXECUTIONS: 'analytics:get-executions',
  ANALYTICS_GET_DAILY_COSTS: 'analytics:get-daily-costs',
  ANALYTICS_GET_EXECUTION: 'analytics:get-execution',
  /** Notification that new analytics data is available (main -> renderer) */
  ANALYTICS_DATA_UPDATED: 'analytics:data-updated',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
