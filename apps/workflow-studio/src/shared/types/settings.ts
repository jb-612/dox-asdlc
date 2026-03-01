// ---------------------------------------------------------------------------
// AI Provider configuration (P15-F08)
// ---------------------------------------------------------------------------

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'azure';

export interface ProviderModelParams {
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderConfig {
  /** Provider identifier */
  id: ProviderId;
  /** Default model to use for this provider */
  defaultModel?: string;
  /** Model-level parameters */
  modelParams?: ProviderModelParams;
  /**
   * Whether an API key has been stored (never expose the raw key to renderer).
   * The actual key lives in electron.safeStorage; renderer only sees this flag.
   */
  hasKey?: boolean;
  /** Whether this provider is enabled (user can disable a configured provider) */
  enabled?: boolean;
  /** Azure OpenAI endpoint URL */
  azureEndpoint?: string;
  /** Azure OpenAI deployment name (maps to model) */
  azureDeployment?: string;
}

/** Known model IDs per provider */
export const PROVIDER_MODELS: Record<ProviderId, readonly string[]> = {
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  openai: ['gpt-4o', 'o1', 'o3-mini'],
  google: ['gemini-2.0-flash', 'gemini-pro'],
  azure: [], // deployment names are user-defined
} as const;

/** Context window sizes (informational, keyed by model ID) */
export const MODEL_CONTEXT_WINDOW: Record<string, number> = {
  'claude-sonnet-4-6': 200_000,
  'claude-opus-4-6': 200_000,
  'claude-haiku-4-5': 200_000,
  'gpt-4o': 128_000,
  'o1': 200_000,
  'o3-mini': 200_000,
  'gemini-2.0-flash': 1_048_576,
  'gemini-pro': 1_048_576,
};

// ---------------------------------------------------------------------------
// App settings
// ---------------------------------------------------------------------------

export interface AppSettings {
  // General (retained from current settings)
  workflowDirectory: string;
  templateDirectory: string;
  autoSaveIntervalSeconds: number;
  cliDefaultCwd: string;
  redisUrl: string;
  cursorAgentUrl: string;
  executionMockMode: boolean;

  /**
   * Directory containing .workitems/ subdirectories.
   * Used by F03 Execute Launcher to populate the work-item picker.
   */
  workItemDirectory?: string;

  /**
   * Per-provider configuration (keys stored separately via safeStorage).
   * Keyed by ProviderId.
   */
  providers?: Partial<Record<ProviderId, ProviderConfig>>;

  // Environment fields (P15-F08)
  /** Path to the Docker socket (default: /var/run/docker.sock) */
  dockerSocketPath?: string;
  /** Default mount path for repo volumes inside containers */
  defaultRepoMountPath?: string;
  /** Workspace directory for agent execution */
  workspaceDirectory?: string;
  /** Timeout in seconds for agent execution (default: 300) */
  agentTimeoutSeconds?: number;
  /** Application log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Port for the telemetry HTTP receiver (default: 9292) */
  telemetryReceiverPort?: number;
  /** Docker image for container pool (default: asdlc-agent:1.0.0) */
  containerImage?: string;
  /** Dormancy timeout in ms before idle containers are terminated (default: 300000) */
  dormancyTimeoutMs?: number;
  /** Default max retries for node execution (default: 0 = no retry) (P15-F14) */
  defaultMaxRetries?: number;
  /** Base backoff in ms between retries (default: 1000) (P15-F14) */
  retryBackoffMs?: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  workflowDirectory: '',
  templateDirectory: '',
  autoSaveIntervalSeconds: 30,
  cliDefaultCwd: '',
  redisUrl: 'redis://localhost:6379',
  cursorAgentUrl: 'http://localhost:8090',
  executionMockMode: false,
  workItemDirectory: '',
  providers: {
    anthropic: { id: 'anthropic', defaultModel: 'claude-sonnet-4-6', modelParams: { temperature: 0.7, maxTokens: 4096 } },
    openai: { id: 'openai', defaultModel: 'gpt-4o', modelParams: { temperature: 0.7, maxTokens: 4096 } },
    google: { id: 'google', defaultModel: 'gemini-2.0-flash', modelParams: { temperature: 0.7, maxTokens: 4096 } },
    azure: { id: 'azure', modelParams: { temperature: 0.7, maxTokens: 4096 } },
  },
  dockerSocketPath: '/var/run/docker.sock',
  defaultRepoMountPath: '',
  workspaceDirectory: '',
  agentTimeoutSeconds: 300,
  containerImage: 'asdlc-agent:1.0.0',
  dormancyTimeoutMs: 300_000,
  defaultMaxRetries: 0,
  retryBackoffMs: 1000,
};
