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
  },

  /** Workflow execution control */
  execution: {
    start: (config: unknown) => ipcRenderer.invoke('execution:start', config),
    pause: () => ipcRenderer.invoke('execution:pause'),
    resume: () => ipcRenderer.invoke('execution:resume'),
    abort: () => ipcRenderer.invoke('execution:abort'),
    gateDecision: (decision: unknown) =>
      ipcRenderer.invoke('execution:gate-decision', decision),
  },

  /** Work item access */
  workitem: {
    list: (type: string) => ipcRenderer.invoke('workitem:list', type),
    get: (id: string) => ipcRenderer.invoke('workitem:get', id),
  },

  /** CLI session management */
  cli: {
    spawn: (config: unknown) => ipcRenderer.invoke('cli:spawn', config),
    kill: (sessionId: string) => ipcRenderer.invoke('cli:kill', sessionId),
    list: () => ipcRenderer.invoke('cli:list'),
    write: (sessionId: string, data: string) =>
      ipcRenderer.invoke('cli:write', sessionId, data),
  },

  /** Application settings */
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
  },

  /** Native dialog access */
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),
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
