import type { AppSettings, ProviderId, ProviderConfig } from '../shared/types/settings';
import type { CLISession, CLISpawnConfig, SessionHistoryEntry, CLIPreset } from '../shared/types/cli';
import type { WorkflowDefinition } from '../shared/types/workflow';
import type { WorkItemReference } from '../shared/types/workitem';
import type { RepoMount } from '../shared/types/repo';
import type { TelemetryEvent, AgentSession, TelemetryStats } from '../shared/types/monitoring';

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  version?: string;
  updatedAt: string;
  nodeCount: number;
  tags?: string[];
  /** P15-F02: active/paused status */
  status?: 'active' | 'paused';
}

export interface KeyStatus {
  providerId: ProviderId;
  hasKey: boolean;
}

export interface ProviderTestResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
}

export interface CloneProgress {
  phase: 'counting' | 'receiving' | 'resolving' | 'done';
  percent: number;
  message?: string;
}

export interface ElectronAPI {
  workflow: {
    list: () => Promise<WorkflowSummary[]>;
    load: (id: string) => Promise<WorkflowDefinition | null>;
    save: (workflow: WorkflowDefinition) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    export: (id: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    import: (filePath: string) => Promise<{ success: boolean; workflow?: WorkflowDefinition; error?: string }>;
    /** Update lastUsedAt timestamp on a workflow/template (P15-F03) */
    touch: (id: string) => Promise<{ success: boolean; lastUsedAt?: string; error?: string }>;
  };

  template: {
    list: () => Promise<WorkflowSummary[]>;
    load: (id: string) => Promise<WorkflowDefinition | null>;
    save: (workflow: WorkflowDefinition) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    toggleStatus: (id: string) => Promise<{ success: boolean; status?: 'active' | 'paused'; error?: string }>;
    duplicate: (id: string) => Promise<{ success: boolean; workflow?: WorkflowDefinition; error?: string }>;
  };

  execution: {
    start: (config: {
      workflowId: string;
      workflow?: WorkflowDefinition;
      workItem?: WorkItemReference;
      repoMount?: RepoMount;
      variables?: Record<string, unknown>;
    }) => Promise<{ success: boolean; executionId?: string; error?: string }>;
    pause: () => Promise<{ success: boolean; error?: string }>;
    resume: () => Promise<{ success: boolean; error?: string }>;
    abort: () => Promise<{ success: boolean; executionId?: string; error?: string }>;
    gateDecision: (decision: {
      executionId: string;
      gateId: string;
      nodeId: string;
      selectedOption: string;
      decidedBy: string;
      reason?: string;
    }) => Promise<{ success: boolean; error?: string }>;
    /** Send revision feedback for a block in gate mode (P15-F04) */
    revise: (config: {
      executionId: string;
      nodeId: string;
      feedback: string;
    }) => Promise<{ success: boolean; error?: string }>;
    /** Resolve merge conflicts (P15-F09) */
    mergeConflictResolve: (resolutions: unknown) => Promise<{ success: boolean; error?: string }>;
  };

  workitem: {
    list: (type: string) => Promise<unknown[]>;
    get: (id: string) => Promise<unknown>;
    /** Check GitHub CLI availability and auth status (P15-F12) */
    checkGhAvailable: () => Promise<{ available: boolean; authenticated: boolean }>;
    /** Read work items from the configured workItemDirectory (P15-F03) */
    listFs: (directory?: string) => Promise<unknown[]>;
    /** Load full content of a single work item from a filesystem path (P15-F03) */
    loadFs: (itemPath: string) => Promise<unknown>;
  };

  cli: {
    spawn: (config: CLISpawnConfig) => Promise<{ success: boolean; sessionId?: string; pid?: number; error?: string }>;
    kill: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
    list: () => Promise<CLISession[]>;
    write: (sessionId: string, data: string) => Promise<{ success: boolean; error?: string }>;
    /** P15-F06: List available Docker images for Docker-mode spawning */
    listImages: () => Promise<{ id: string; name: string; tag: string }[]>;
    /** P15-F06: Save a completed session to history ring buffer */
    saveSession: (session: CLISession) => Promise<{ success: boolean; error?: string }>;
    /** P15-F06: Load recent session history (last N sessions) */
    getHistory: (limit?: number) => Promise<SessionHistoryEntry[]>;
    /** P15-F06: Load quick-launch presets */
    loadPresets: () => Promise<CLIPreset[]>;
    /** P15-F06: Save quick-launch presets */
    savePresets: (presets: CLIPreset[]) => Promise<{ success: boolean; error?: string }>;
    /** Check Docker availability and version */
    getDockerStatus: () => Promise<{ available: boolean; version?: string }>;
  };

  settings: {
    load: () => Promise<AppSettings>;
    save: (settings: Partial<AppSettings>) => Promise<{ success: boolean; error?: string }>;
    /** P15-F08: Store an encrypted API key (key never exposed to renderer) */
    setApiKey: (providerId: ProviderId, key: string) => Promise<{ success: boolean; error?: string }>;
    /** P15-F08: Delete a stored API key */
    deleteApiKey: (providerId: ProviderId) => Promise<{ success: boolean; error?: string }>;
    /** P15-F08: Check whether a key is stored (never returns the raw key) */
    getKeyStatus: (providerId: ProviderId) => Promise<KeyStatus>;
    /** P15-F08: Validate connectivity to an AI provider using its stored key */
    testProvider: (providerId: ProviderId) => Promise<ProviderTestResult>;
    /** Get app, Electron, and Node version info */
    getVersion: () => Promise<{ app: string; electron: string; node: string }>;
  };

  dialog: {
    openDirectory: () => Promise<string | null>;
    openFile: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  };

  repo: {
    /** Clone a GitHub repo into a temp directory (P15-F03) */
    clone: (url: string, branch?: string, depth?: number) => Promise<{ success: boolean; localPath?: string; error?: string }>;
    /** Cancel an in-progress clone (P15-F03) */
    cancelClone: () => Promise<{ success: boolean; error?: string }>;
    /** Validate that a local path is a directory, optionally a git repo (P15-F03) */
    validate: (path: string) => Promise<{ valid: boolean; hasGit?: boolean; error?: string }>;
  };

  containerPool: {
    /** P15-F05: Get container pool status */
    getStatus: () => Promise<{ running: number; idle: number; dormant: number; total: number }>;
    /** P15-F05: Start the container pool */
    start: (count: number) => Promise<{ success: boolean; error?: string }>;
    /** P15-F05: Stop all containers in the pool */
    stop: () => Promise<{ success: boolean; error?: string }>;
  };

  monitoring: {
    /** P15-F07: Get buffered telemetry events */
    getEvents: (options?: { limit?: number; agentId?: string; since?: string }) => Promise<TelemetryEvent[]>;
    /** P15-F07: Get agent sessions */
    getSessions: () => Promise<AgentSession[]>;
    /** P15-F07: Get aggregate stats */
    getStats: () => Promise<TelemetryStats>;
    /** Start the telemetry receiver process */
    startReceiver: () => Promise<void>;
    /** Stop the telemetry receiver process */
    stopReceiver: () => Promise<void>;
  };

  onEvent: (channel: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
