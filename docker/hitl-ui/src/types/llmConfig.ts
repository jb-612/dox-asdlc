/**
 * LLM Admin Configuration Types (P05-F13)
 *
 * Type definitions for LLM providers, API keys, models,
 * and per-agent LLM configuration.
 */

// ============================================================================
// Provider Types
// ============================================================================

/** Supported LLM Providers */
export type LLMProvider = 'anthropic' | 'openai' | 'google';

/** Provider display information */
export interface LLMProviderInfo {
  /** Provider ID */
  id: LLMProvider;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Whether provider is enabled */
  enabled: boolean;
}

/** Provider display names */
export const PROVIDER_NAMES: Record<LLMProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

/** Provider descriptions */
export const PROVIDER_DESCRIPTIONS: Record<LLMProvider, string> = {
  anthropic: 'Claude models for advanced reasoning and analysis',
  openai: 'GPT models for general-purpose tasks',
  google: 'Gemini models for multimodal capabilities',
};

// ============================================================================
// Model Types
// ============================================================================

/** LLM Model information */
export interface LLMModel {
  /** Model ID (e.g., "claude-opus-4-20250514") */
  id: string;
  /** Display name */
  name: string;
  /** Provider this model belongs to */
  provider: LLMProvider;
  /** Maximum context window tokens */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Cost per 1M input tokens (USD) */
  costPer1MInput: number;
  /** Cost per 1M output tokens (USD) */
  costPer1MOutput: number;
  /** Whether model supports extended thinking */
  supportsExtendedThinking?: boolean;
  /** Model capabilities description */
  capabilities?: string;
}

// ============================================================================
// API Key Types
// ============================================================================

/** API Key status */
export type APIKeyStatus = 'valid' | 'invalid' | 'untested';

/** API Key (stored encrypted, returned masked) */
export interface APIKey {
  /** Unique key identifier */
  id: string;
  /** Provider this key belongs to */
  provider: LLMProvider;
  /** User-friendly name */
  name: string;
  /** Masked key value (e.g., "sk-ant-...xyz") */
  keyMasked: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last used timestamp (null if never used) */
  lastUsed: string | null;
  /** Key validation status */
  status: APIKeyStatus;
  /** Last test result message */
  lastTestMessage?: string;
}

/** Request to add a new API key */
export interface AddAPIKeyRequest {
  /** Provider for this key */
  provider: LLMProvider;
  /** User-friendly name */
  name: string;
  /** The actual API key value (sent only during creation) */
  key: string;
}

/** Response from testing an API key */
export interface TestAPIKeyResponse {
  /** Whether the key is valid */
  valid: boolean;
  /** Message describing the result */
  message: string;
  /** Timestamp of the test */
  testedAt: string;
}

// ============================================================================
// Agent Role Types
// ============================================================================

/** Agent roles that can be configured */
export type AgentRole =
  | 'discovery'    // Ideation: initial exploration
  | 'design'       // Ideation: architecture/planning
  | 'utest'        // P04-F03: test writing
  | 'coding'       // P04-F03: implementation
  | 'debugger'     // P04-F03: failure analysis
  | 'reviewer'     // P04-F03: code review
  | 'ideation';    // Ideation orchestrator

/** All agent roles */
export const AGENT_ROLES: AgentRole[] = [
  'discovery',
  'design',
  'utest',
  'coding',
  'debugger',
  'reviewer',
  'ideation',
];

/** Agent role display names */
export const AGENT_ROLE_NAMES: Record<AgentRole, string> = {
  discovery: 'Discovery Agent',
  design: 'Design Agent',
  utest: 'Unit Test Agent',
  coding: 'Coding Agent',
  debugger: 'Debugger Agent',
  reviewer: 'Reviewer Agent',
  ideation: 'Ideation Orchestrator',
};

/** Agent role descriptions */
export const AGENT_ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  discovery: 'Initial exploration and context gathering',
  design: 'Architecture and planning tasks',
  utest: 'Writing unit and integration tests',
  coding: 'Implementing code changes',
  debugger: 'Analyzing and fixing failures',
  reviewer: 'Code review and quality checks',
  ideation: 'Orchestrating the ideation workflow',
};

// ============================================================================
// Agent Configuration Types
// ============================================================================

/** LLM settings for an agent */
export interface AgentLLMSettings {
  /** Temperature (0.0 - 1.0) */
  temperature: number;
  /** Maximum tokens for output (1024 - 32768) */
  maxTokens: number;
  /** Top P for nucleus sampling (optional) */
  topP?: number;
  /** Top K for sampling (optional) */
  topK?: number;
}

/** Default settings for agents */
export const DEFAULT_AGENT_SETTINGS: AgentLLMSettings = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
};

/** Per-agent LLM configuration */
export interface AgentLLMConfig {
  /** Agent role */
  role: AgentRole;
  /** Provider to use */
  provider: LLMProvider;
  /** Model ID to use */
  model: string;
  /** API key ID to use */
  apiKeyId: string;
  /** LLM settings */
  settings: AgentLLMSettings;
  /** Whether this agent is enabled */
  enabled: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

/** Response for GET /api/llm/providers */
export interface ProvidersResponse {
  providers: LLMProviderInfo[];
}

/** Response for GET /api/llm/providers/{id}/models */
export interface ModelsResponse {
  models: LLMModel[];
}

/** Response for GET /api/llm/keys */
export interface APIKeysResponse {
  keys: APIKey[];
}

/** Response for GET /api/llm/agents */
export interface AgentConfigsResponse {
  configs: AgentLLMConfig[];
}

/** Response for POST /api/llm/keys */
export interface AddAPIKeyResponse {
  key: APIKey;
}

// ============================================================================
// UI Helper Constants
// ============================================================================

/** Status to color mapping for badges */
export const KEY_STATUS_COLORS: Record<APIKeyStatus, string> = {
  valid: 'bg-status-success',
  invalid: 'bg-status-error',
  untested: 'bg-status-warning',
};

/** Status to label mapping */
export const KEY_STATUS_LABELS: Record<APIKeyStatus, string> = {
  valid: 'Valid',
  invalid: 'Invalid',
  untested: 'Untested',
};

/** Temperature presets */
export const TEMPERATURE_PRESETS = [
  { value: 0.0, label: 'Deterministic', description: 'Most focused and consistent' },
  { value: 0.3, label: 'Low', description: 'More focused, less random' },
  { value: 0.7, label: 'Balanced', description: 'Good balance of creativity' },
  { value: 1.0, label: 'Creative', description: 'Most creative and varied' },
];

/** Max tokens presets */
export const MAX_TOKENS_PRESETS = [
  { value: 1024, label: '1K' },
  { value: 2048, label: '2K' },
  { value: 4096, label: '4K' },
  { value: 8192, label: '8K' },
  { value: 16384, label: '16K' },
  { value: 32768, label: '32K' },
];

// ============================================================================
// Integration Credential Types (P05-F13 Extension)
// ============================================================================

/** Supported Integration Types */
export type IntegrationType = 'slack' | 'teams' | 'github';

/** Integration type display names */
export const INTEGRATION_NAMES: Record<IntegrationType, string> = {
  slack: 'Slack',
  teams: 'Microsoft Teams',
  github: 'GitHub',
};

/** Integration type descriptions */
export const INTEGRATION_DESCRIPTIONS: Record<IntegrationType, string> = {
  slack: 'Slack workspace integration for HITL notifications',
  teams: 'Microsoft Teams integration for enterprise workflows',
  github: 'GitHub integration for issue and PR automation',
};

/** Credential types per integration */
export const INTEGRATION_CREDENTIAL_TYPES: Record<IntegrationType, string[]> = {
  slack: ['bot_token', 'app_token', 'signing_secret'],
  teams: ['client_id', 'client_secret', 'tenant_id'],
  github: ['personal_access_token', 'app_private_key'],
};

/** Integration credential status (same as API key status for consistency) */
export type IntegrationCredentialStatus = 'valid' | 'invalid' | 'untested';

/** Integration credential (stored encrypted, returned masked) */
export interface IntegrationCredential {
  /** Unique credential identifier */
  id: string;
  /** Integration this credential belongs to */
  integrationType: IntegrationType;
  /** User-friendly name (e.g., "Production Slack") */
  name: string;
  /** Credential type (e.g., "bot_token", "app_token") */
  credentialType: string;
  /** Masked credential value (e.g., "xoxb-...xyz") */
  keyMasked: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last used timestamp (null if never used) */
  lastUsed: string | null;
  /** Credential validation status */
  status: IntegrationCredentialStatus;
  /** Last test result message */
  lastTestMessage?: string;
}

/** Request to add a new integration credential */
export interface AddIntegrationCredentialRequest {
  /** Integration type for this credential */
  integrationType: IntegrationType;
  /** User-friendly name */
  name: string;
  /** Credential type (e.g., "bot_token") */
  credentialType: string;
  /** The actual credential value (sent only during creation) */
  key: string;
}

/** Response from testing an integration credential */
export interface TestIntegrationCredentialResponse {
  /** Whether the credential is valid */
  valid: boolean;
  /** Message describing the result */
  message: string;
  /** Timestamp of the test */
  testedAt: string;
  /** Additional details (e.g., Slack team name on success) */
  details?: Record<string, string>;
}

/** Response for GET /api/integrations */
export interface IntegrationCredentialsResponse {
  credentials: IntegrationCredential[];
}

/** Response for POST /api/integrations */
export interface AddIntegrationCredentialResponse {
  credential: IntegrationCredential;
}

/** Status to color mapping for integration badges (same as API key) */
export const INTEGRATION_STATUS_COLORS: Record<IntegrationCredentialStatus, string> = {
  valid: 'bg-status-success',
  invalid: 'bg-status-error',
  untested: 'bg-status-warning',
};

/** Status to label mapping for integrations */
export const INTEGRATION_STATUS_LABELS: Record<IntegrationCredentialStatus, string> = {
  valid: 'Valid',
  invalid: 'Invalid',
  untested: 'Untested',
};
