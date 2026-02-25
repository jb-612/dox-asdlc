export type CLISessionStatus = 'starting' | 'running' | 'exited' | 'error';

/** Spawn mode: local PTY on host or inside a Docker container. */
export type CLISpawnMode = 'local' | 'docker';

/** Optional context attached to a CLI session for focus/enrichment. */
export interface CLISessionContext {
  repoPath?: string;
  githubIssue?: string;
  workflowTemplate?: string;
  systemPrompt?: string;
  /** Mount the repo read-only (appends :ro to Docker bind mount, T23). */
  readOnly?: boolean;
}

export interface CLISpawnConfig {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  instanceId?: string;

  /** Spawn mode — defaults to 'local'. */
  mode: CLISpawnMode;
  /** Optional session context (repo, issue, template). */
  context?: CLISessionContext;
  /** Docker image override for docker mode. */
  dockerImage?: string;
  /** Existing container ID for `docker exec` mode. */
  dockerContainerId?: string;
}

export interface CLISession {
  id: string;
  config: CLISpawnConfig;
  status: CLISessionStatus;
  pid?: number;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number;

  /** Spawn mode used for this session. */
  mode: CLISpawnMode;
  /** Session context if provided at spawn time. */
  context?: CLISessionContext;
  /** Docker container ID (populated for docker-mode sessions). */
  containerId?: string;
}

/** Summary of a session's output, populated on exit. */
export interface SessionSummary {
  toolCallCount: number;
  filesModified: string[];
  exitStatus: 'success' | 'error' | 'killed';
  durationSeconds: number;
}

/** Persisted history entry for a completed session. */
export interface SessionHistoryEntry {
  id: string;
  config: CLISpawnConfig;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number;
  mode: CLISpawnMode;
  context?: CLISessionContext;
  sessionSummary?: SessionSummary;
}

/** Quick-launch preset configuration. */
export interface CLIPreset {
  id: string;
  name: string;
  config: Partial<CLISpawnConfig>;
}
