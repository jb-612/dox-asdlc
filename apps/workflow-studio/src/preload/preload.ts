import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script for Electron context bridge.
 *
 * Exposes a structured API to the renderer process via window.electronAPI.
 * All communication uses ipcRenderer.invoke (request/response pattern)
 * and ipcRenderer.on (push events from main process).
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /** Workflow CRUD operations */
  workflow: {
    list: () => ipcRenderer.invoke('workflow:list'),
    load: (id: string) => ipcRenderer.invoke('workflow:load', id),
    save: (workflow: unknown) => ipcRenderer.invoke('workflow:save', workflow),
    delete: (id: string) => ipcRenderer.invoke('workflow:delete', id),
    /** Update lastUsedAt timestamp (P15-F03) */
    touch: (id: string) => ipcRenderer.invoke('workflow:touch', id),
  },

  /** Template CRUD operations (P15-F02) */
  template: {
    list: () => ipcRenderer.invoke('template:list'),
    load: (id: string) => ipcRenderer.invoke('template:load', id),
    save: (workflow: unknown) => ipcRenderer.invoke('template:save', workflow),
    delete: (id: string) => ipcRenderer.invoke('template:delete', id),
    toggleStatus: (id: string) => ipcRenderer.invoke('template:toggle-status', id),
    duplicate: (id: string) => ipcRenderer.invoke('template:duplicate', id),
  },

  /** Workflow execution control */
  execution: {
    start: (config: unknown) => ipcRenderer.invoke('execution:start', config),
    pause: () => ipcRenderer.invoke('execution:pause'),
    resume: () => ipcRenderer.invoke('execution:resume'),
    abort: () => ipcRenderer.invoke('execution:abort'),
    gateDecision: (decision: unknown) =>
      ipcRenderer.invoke('execution:gate-decision', decision),
    /** P15-F04: Send revision feedback for a block in gate mode */
    revise: (config: { executionId: string; nodeId: string; feedback: string }) =>
      ipcRenderer.invoke('execution:revise', config),
    /** P15-F09: Resolve merge conflicts */
    mergeConflictResolve: (resolutions: unknown) =>
      ipcRenderer.invoke('execution:merge-resolve', resolutions),
  },

  /** Work item access */
  workitem: {
    list: (type: string) => ipcRenderer.invoke('workitem:list', type),
    get: (id: string) => ipcRenderer.invoke('workitem:get', id),
    /** Check GitHub CLI availability and auth status (P15-F12) */
    checkGhAvailable: () => ipcRenderer.invoke('workitem:check-gh'),
    /** Read work items from a filesystem directory (P15-F03) */
    listFs: (directory?: string) => ipcRenderer.invoke('workitem:list-fs', directory),
    /** Load full content of a single work item from a filesystem path (P15-F03) */
    loadFs: (itemPath: string) => ipcRenderer.invoke('workitem:load-fs', itemPath),
  },

  /** CLI session management */
  cli: {
    spawn: (config: unknown) => ipcRenderer.invoke('cli:spawn', config),
    kill: (sessionId: string) => ipcRenderer.invoke('cli:kill', sessionId),
    list: () => ipcRenderer.invoke('cli:list'),
    write: (sessionId: string, data: string) =>
      ipcRenderer.invoke('cli:write', sessionId, data),
    /** P15-F06: List available Docker images */
    listImages: () => ipcRenderer.invoke('cli:list-images'),
    /** P15-F06: Save a completed session to history */
    saveSession: (session: unknown) => ipcRenderer.invoke('cli:session-save', session),
    /** P15-F06: Load recent session history */
    getHistory: (limit?: number) => ipcRenderer.invoke('cli:session-history', limit),
    /** P15-F06: Load quick-launch presets */
    loadPresets: () => ipcRenderer.invoke('cli:presets-load'),
    /** P15-F06: Save quick-launch presets */
    savePresets: (presets: unknown[]) => ipcRenderer.invoke('cli:presets-save', presets),
    /** P15-F06: Check Docker availability and version */
    getDockerStatus: () => ipcRenderer.invoke('cli:docker-status'),
  },

  /** Application settings */
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
    setApiKey: (providerId: string, key: string) =>
      ipcRenderer.invoke('settings:set-api-key', { provider: providerId, key }),
    deleteApiKey: (providerId: string) =>
      ipcRenderer.invoke('settings:delete-api-key', { provider: providerId }),
    getKeyStatus: (providerId: string) =>
      ipcRenderer.invoke('settings:get-key-status', { provider: providerId }),
    testProvider: (providerId: string) =>
      ipcRenderer.invoke('settings:test-provider', { provider: providerId }),
    getVersion: () => ipcRenderer.invoke('settings:get-version'),
  },

  /** Container pool operations (P15-F05) */
  containerPool: {
    /** Get current pool snapshot */
    getStatus: () => ipcRenderer.invoke('container:pool-status'),
    /** Pre-warm containers for parallel execution */
    start: (count: number) => ipcRenderer.invoke('container:pool-start', { count }),
    /** Teardown all containers */
    stop: () => ipcRenderer.invoke('container:pool-stop'),
  },

  /** Repository operations (P15-F03) */
  repo: {
    /** Clone a GitHub repo into a temp directory */
    clone: (url: string, branch?: string, depth?: number) =>
      ipcRenderer.invoke('repo:clone', url, branch, depth),
    /** Cancel an in-progress clone */
    cancelClone: () => ipcRenderer.invoke('repo:clone-cancel'),
    /** Validate that a local path is a directory (and optionally a git repo) */
    validate: (path: string) => ipcRenderer.invoke('repo:validate-path', path),
  },

  /** Native dialog access */
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),
  },

  /** Monitoring / telemetry queries (P15-F07) */
  monitoring: {
    getEvents: (filter?: unknown) => ipcRenderer.invoke('monitoring:get-events', filter),
    getSessions: () => ipcRenderer.invoke('monitoring:get-sessions'),
    getStats: () => ipcRenderer.invoke('monitoring:get-stats'),
    startReceiver: () => ipcRenderer.invoke('monitoring:receiver-start'),
    stopReceiver: () => ipcRenderer.invoke('monitoring:receiver-stop'),
    onEvent: (callback: (...args: unknown[]) => void) =>
      ipcRenderer.on('monitoring:event', (_event, ...args) => callback(...args)),
  },

  /** Subscribe to push events from the main process */
  onEvent: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },

  /** Remove all listeners for a given channel */
  removeListener: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
