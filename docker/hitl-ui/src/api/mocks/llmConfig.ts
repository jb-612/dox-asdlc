/**
 * Mock data for LLM Admin Configuration (P05-F13)
 *
 * Provides mock providers, models, API keys, and agent configs for development.
 */

import type {
  LLMProvider,
  LLMProviderInfo,
  LLMModel,
  APIKey,
  AgentLLMConfig,
  AgentRole,
  TestAPIKeyResponse,
  AddAPIKeyRequest,
  IntegrationType,
  IntegrationCredential,
  IntegrationCredentialStatus,
  AddIntegrationCredentialRequest,
  TestIntegrationCredentialResponse,
} from '../../types/llmConfig';

// ============================================================================
// Helper Functions
// ============================================================================

const now = new Date();

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

/**
 * Simulate network delay for realistic UX
 */
export async function simulateLLMConfigDelay(minMs = 100, maxMs = 300): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Mask an API key for display (first 7 + last 3 chars)
 */
function maskApiKey(key: string): string {
  if (key.length <= 10) {
    return '***';
  }
  const first = key.substring(0, 7);
  const last = key.substring(key.length - 3);
  return first + '...' + last;
}

// ============================================================================
// Mock Providers
// ============================================================================

export const mockProviders: LLMProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models for advanced reasoning and analysis',
    enabled: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models for general-purpose tasks',
    enabled: true,
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Gemini models for multimodal capabilities',
    enabled: true,
  },
];

export function getMockProviders(): LLMProviderInfo[] {
  return [...mockProviders];
}

// ============================================================================
// Mock Models
// ============================================================================

/**
 * Static/fallback models - used when no API key is selected
 */
export const mockModels: Record<LLMProvider, LLMModel[]> = {
  anthropic: [
    {
      id: 'claude-opus-4-20250514',
      name: 'Claude Opus 4',
      provider: 'anthropic',
      maxContextTokens: 200000,
      maxOutputTokens: 32768,
      costPer1MInput: 15.0,
      costPer1MOutput: 75.0,
      supportsExtendedThinking: true,
      capabilities: 'Most capable model, best for complex reasoning',
    },
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      provider: 'anthropic',
      maxContextTokens: 200000,
      maxOutputTokens: 16384,
      costPer1MInput: 3.0,
      costPer1MOutput: 15.0,
      supportsExtendedThinking: true,
      capabilities: 'Balanced performance and cost',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      provider: 'anthropic',
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
      costPer1MInput: 0.80,
      costPer1MOutput: 4.0,
      supportsExtendedThinking: false,
      capabilities: 'Fast and cost-effective for simple tasks',
    },
  ],
  openai: [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
      costPer1MInput: 10.0,
      costPer1MOutput: 30.0,
      capabilities: 'Most capable GPT model',
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      maxContextTokens: 128000,
      maxOutputTokens: 16384,
      costPer1MInput: 5.0,
      costPer1MOutput: 15.0,
      capabilities: 'Optimized for speed and quality',
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      maxContextTokens: 128000,
      maxOutputTokens: 16384,
      costPer1MInput: 0.15,
      costPer1MOutput: 0.60,
      capabilities: 'Cost-effective for simple tasks',
    },
  ],
  google: [
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      provider: 'google',
      maxContextTokens: 1000000,
      maxOutputTokens: 8192,
      costPer1MInput: 0.075,
      costPer1MOutput: 0.30,
      capabilities: 'Fast multimodal model with large context',
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      maxContextTokens: 2000000,
      maxOutputTokens: 8192,
      costPer1MInput: 1.25,
      costPer1MOutput: 5.0,
      capabilities: 'Most capable Gemini with massive context window',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      maxContextTokens: 1000000,
      maxOutputTokens: 8192,
      costPer1MInput: 0.075,
      costPer1MOutput: 0.30,
      capabilities: 'Fast and cost-effective',
    },
  ],
};

/**
 * Dynamically discovered models per API key - simulates what the vendor API returns
 * These are the latest models that would be discovered via the /keys/{id}/models endpoint
 */
const discoveredModelsByKey: Record<string, LLMModel[]> = {
  'key-google-design-sdlc': [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'google',
      maxContextTokens: 1000000,
      maxOutputTokens: 16384,
      costPer1MInput: 0.10,
      costPer1MOutput: 0.40,
      capabilities: 'Latest fast multimodal model with improved reasoning',
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'google',
      maxContextTokens: 2000000,
      maxOutputTokens: 16384,
      costPer1MInput: 2.0,
      costPer1MOutput: 8.0,
      capabilities: 'Most capable Gemini model with enhanced context understanding',
    },
    {
      id: 'gemini-2.0-flash-thinking',
      name: 'Gemini 2.0 Flash Thinking',
      provider: 'google',
      maxContextTokens: 1000000,
      maxOutputTokens: 32768,
      costPer1MInput: 0.15,
      costPer1MOutput: 0.60,
      supportsExtendedThinking: true,
      capabilities: 'Flash model with extended thinking capabilities',
    },
  ],
  'key-google-test': [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'google',
      maxContextTokens: 1000000,
      maxOutputTokens: 16384,
      costPer1MInput: 0.10,
      costPer1MOutput: 0.40,
      capabilities: 'Latest fast multimodal model with improved reasoning',
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'google',
      maxContextTokens: 2000000,
      maxOutputTokens: 16384,
      costPer1MInput: 2.0,
      costPer1MOutput: 8.0,
      capabilities: 'Most capable Gemini model with enhanced context understanding',
    },
  ],
};

export function getMockModels(provider: LLMProvider): LLMModel[] {
  return [...(mockModels[provider] || [])];
}

export function getMockAllModels(): LLMModel[] {
  return Object.values(mockModels).flat();
}

/**
 * Get dynamically discovered models for a specific API key
 * This simulates calling the vendor API to get the latest available models
 */
export function getMockKeyModels(keyId: string): LLMModel[] {
  // Check if we have specific discovered models for this key
  if (discoveredModelsByKey[keyId]) {
    return [...discoveredModelsByKey[keyId]];
  }
  // Fall back to static models for the key's provider
  const key = getMockAPIKeyById(keyId);
  if (!key) return [];
  return getMockModels(key.provider);
}

// ============================================================================
// Mock API Keys
// ============================================================================

let mockAPIKeys: APIKey[] = [
  {
    id: 'key-anthropic-prod',
    provider: 'anthropic',
    name: 'Production Key',
    keyMasked: 'sk-ant-...xyz',
    createdAt: daysAgo(30),
    lastUsed: hoursAgo(2),
    status: 'valid',
    lastTestMessage: 'Successfully authenticated with Anthropic API',
  },
  {
    id: 'key-anthropic-dev',
    provider: 'anthropic',
    name: 'Development Key',
    keyMasked: 'sk-ant-...abc',
    createdAt: daysAgo(15),
    lastUsed: hoursAgo(5),
    status: 'valid',
    lastTestMessage: 'Successfully authenticated with Anthropic API',
  },
  {
    id: 'key-openai-main',
    provider: 'openai',
    name: 'Main OpenAI Key',
    keyMasked: 'sk-proj...def',
    createdAt: daysAgo(45),
    lastUsed: daysAgo(1),
    status: 'valid',
    lastTestMessage: 'Successfully authenticated with OpenAI API',
  },
  {
    id: 'key-google-test',
    provider: 'google',
    name: 'Test Google Key',
    keyMasked: 'AIzaSy...ghi',
    createdAt: daysAgo(7),
    lastUsed: null,
    status: 'untested',
  },
  {
    id: 'key-google-design-sdlc',
    provider: 'google',
    name: 'design-sdlc',
    keyMasked: 'AIzaSy...jkl',
    createdAt: daysAgo(3),
    lastUsed: hoursAgo(1),
    status: 'valid',
    lastTestMessage: 'Successfully authenticated with Google AI API',
  },
];

export function getMockAPIKeys(): APIKey[] {
  return [...mockAPIKeys];
}

export function getMockAPIKeyById(id: string): APIKey | undefined {
  return mockAPIKeys.find((key) => key.id === id);
}

export function getMockAPIKeysByProvider(provider: LLMProvider): APIKey[] {
  return mockAPIKeys.filter((key) => key.provider === provider);
}

export function addMockAPIKey(request: AddAPIKeyRequest): APIKey {
  const newKey: APIKey = {
    id: 'key-' + request.provider + '-' + Date.now(),
    provider: request.provider,
    name: request.name,
    keyMasked: maskApiKey(request.key),
    createdAt: new Date().toISOString(),
    lastUsed: null,
    status: 'untested',
  };
  mockAPIKeys = [...mockAPIKeys, newKey];
  return newKey;
}

export function deleteMockAPIKey(id: string): boolean {
  const initialLength = mockAPIKeys.length;
  mockAPIKeys = mockAPIKeys.filter((key) => key.id !== id);
  return mockAPIKeys.length < initialLength;
}

export function testMockAPIKey(id: string): TestAPIKeyResponse {
  const key = mockAPIKeys.find((k) => k.id === id);
  if (!key) {
    return {
      valid: false,
      message: 'API key not found',
      testedAt: new Date().toISOString(),
    };
  }

  // Simulate 90% success rate for testing
  const isValid = Math.random() > 0.1;
  const providerName = key.provider.charAt(0).toUpperCase() + key.provider.slice(1);
  const message = isValid
    ? 'Successfully authenticated with ' + providerName + ' API'
    : 'Authentication failed: Invalid API key';

  // Update the mock key status
  mockAPIKeys = mockAPIKeys.map((k) =>
    k.id === id
      ? {
          ...k,
          status: isValid ? 'valid' as const : 'invalid' as const,
          lastTestMessage: message,
        }
      : k
  );

  return {
    valid: isValid,
    message,
    testedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Mock Agent Configurations
// ============================================================================

const defaultAgentConfigs: AgentLLMConfig[] = [
  {
    role: 'discovery',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyId: 'key-anthropic-prod',
    settings: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
    },
    enabled: true,
  },
  {
    role: 'design',
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    apiKeyId: 'key-anthropic-prod',
    settings: {
      temperature: 0.5,
      maxTokens: 8192,
      topP: 0.9,
    },
    enabled: true,
  },
  {
    role: 'utest',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyId: 'key-anthropic-dev',
    settings: {
      temperature: 0.3,
      maxTokens: 4096,
      topP: 1.0,
    },
    enabled: true,
  },
  {
    role: 'coding',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyId: 'key-anthropic-dev',
    settings: {
      temperature: 0.3,
      maxTokens: 8192,
      topP: 1.0,
    },
    enabled: true,
  },
  {
    role: 'debugger',
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    apiKeyId: 'key-anthropic-prod',
    settings: {
      temperature: 0.2,
      maxTokens: 8192,
      topP: 0.95,
    },
    enabled: true,
  },
  {
    role: 'reviewer',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyId: 'key-anthropic-prod',
    settings: {
      temperature: 0.3,
      maxTokens: 4096,
      topP: 1.0,
    },
    enabled: true,
  },
  {
    role: 'ideation',
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    apiKeyId: 'key-anthropic-prod',
    settings: {
      temperature: 0.7,
      maxTokens: 16384,
      topP: 1.0,
    },
    enabled: true,
  },
];

let mockAgentConfigs: AgentLLMConfig[] = [...defaultAgentConfigs];

export function getMockAgentConfigs(): AgentLLMConfig[] {
  return [...mockAgentConfigs];
}

export function getMockAgentConfig(role: AgentRole): AgentLLMConfig | undefined {
  return mockAgentConfigs.find((config) => config.role === role);
}

export function updateMockAgentConfig(role: AgentRole, updates: Partial<AgentLLMConfig>): AgentLLMConfig | undefined {
  const index = mockAgentConfigs.findIndex((config) => config.role === role);
  if (index === -1) {
    return undefined;
  }

  const updated = {
    ...mockAgentConfigs[index],
    ...updates,
    role, // Ensure role cannot be changed
  };
  mockAgentConfigs = [
    ...mockAgentConfigs.slice(0, index),
    updated,
    ...mockAgentConfigs.slice(index + 1),
  ];
  return updated;
}

export function resetMockAgentConfigs(): void {
  mockAgentConfigs = [...defaultAgentConfigs];
}

// ============================================================================
// Mock Integration Credentials
// ============================================================================

let mockIntegrationCredentials: IntegrationCredential[] = [
  {
    id: 'cred-slack-prod-bot',
    integrationType: 'slack',
    name: 'Production Slack Bot',
    credentialType: 'bot_token',
    keyMasked: 'xoxb-12...abc',
    createdAt: daysAgo(14),
    lastUsed: hoursAgo(1),
    status: 'valid',
    lastTestMessage: 'Valid bot token for team: MyCompany',
  },
  {
    id: 'cred-slack-prod-app',
    integrationType: 'slack',
    name: 'Production Slack App',
    credentialType: 'app_token',
    keyMasked: 'xapp-1-...xyz',
    createdAt: daysAgo(14),
    lastUsed: hoursAgo(1),
    status: 'valid',
    lastTestMessage: 'App token format is valid',
  },
  {
    id: 'cred-slack-prod-signing',
    integrationType: 'slack',
    name: 'Production Signing Secret',
    credentialType: 'signing_secret',
    keyMasked: 'abc123...def',
    createdAt: daysAgo(14),
    lastUsed: null,
    status: 'untested',
  },
  {
    id: 'cred-github-main',
    integrationType: 'github',
    name: 'Main GitHub PAT',
    credentialType: 'personal_access_token',
    keyMasked: 'ghp_abc...xyz',
    createdAt: daysAgo(30),
    lastUsed: daysAgo(2),
    status: 'valid',
    lastTestMessage: 'Valid token for user: myuser',
  },
  {
    id: 'cred-teams-dev',
    integrationType: 'teams',
    name: 'Dev Teams Client',
    credentialType: 'client_id',
    keyMasked: 'abc-def...ghi',
    createdAt: daysAgo(7),
    lastUsed: null,
    status: 'untested',
  },
];

export function getMockIntegrationCredentials(): IntegrationCredential[] {
  return [...mockIntegrationCredentials];
}

export function getMockIntegrationCredentialsByType(
  integrationType: IntegrationType
): IntegrationCredential[] {
  return mockIntegrationCredentials.filter((c) => c.integrationType === integrationType);
}

export function getMockIntegrationCredentialById(id: string): IntegrationCredential | undefined {
  return mockIntegrationCredentials.find((c) => c.id === id);
}

export function addMockIntegrationCredential(
  request: AddIntegrationCredentialRequest
): IntegrationCredential {
  const newCred: IntegrationCredential = {
    id: 'cred-' + request.integrationType + '-' + Date.now(),
    integrationType: request.integrationType,
    name: request.name,
    credentialType: request.credentialType,
    keyMasked: maskApiKey(request.key),
    createdAt: new Date().toISOString(),
    lastUsed: null,
    status: 'untested',
  };
  mockIntegrationCredentials = [...mockIntegrationCredentials, newCred];
  return newCred;
}

export function deleteMockIntegrationCredential(id: string): boolean {
  const initialLength = mockIntegrationCredentials.length;
  mockIntegrationCredentials = mockIntegrationCredentials.filter((c) => c.id !== id);
  return mockIntegrationCredentials.length < initialLength;
}

export function testMockIntegrationCredential(id: string): TestIntegrationCredentialResponse {
  const cred = mockIntegrationCredentials.find((c) => c.id === id);
  if (!cred) {
    return {
      valid: false,
      message: 'Credential not found',
      testedAt: new Date().toISOString(),
    };
  }

  // Simulate 90% success rate
  const isValid = Math.random() > 0.1;

  // Generate success message based on integration type
  let message: string;
  let details: Record<string, string> | undefined;

  if (isValid) {
    switch (cred.integrationType) {
      case 'slack':
        if (cred.credentialType === 'bot_token') {
          message = 'Token is valid. Test message sent to #asdlc-notifications';
          details = {
            team: 'TestTeam',
            team_id: 'T12345',
            bot_id: 'B12345',
            channel: '#asdlc-notifications',
            timestamp: new Date().getTime().toString().slice(0, 10) + '.123456',
          };
        } else {
          message = cred.credentialType + ' format is valid';
        }
        break;
      case 'github':
        message = 'Valid token for user: testuser';
        details = { login: 'testuser', name: 'Test User', id: '12345' };
        break;
      case 'teams':
        message = cred.credentialType + ' format is valid';
        break;
      default:
        message = 'Credential is valid';
    }
  } else {
    message = 'Authentication failed: Invalid credential';
  }

  // Update the mock credential status
  mockIntegrationCredentials = mockIntegrationCredentials.map((c) =>
    c.id === id
      ? {
          ...c,
          status: isValid ? 'valid' as const : 'invalid' as const,
          lastTestMessage: message,
        }
      : c
  );

  return {
    valid: isValid,
    message,
    testedAt: new Date().toISOString(),
    details,
  };
}

const defaultIntegrationCredentials: IntegrationCredential[] = [
  {
    id: 'cred-slack-prod-bot',
    integrationType: 'slack',
    name: 'Production Slack Bot',
    credentialType: 'bot_token',
    keyMasked: 'xoxb-12...abc',
    createdAt: daysAgo(14),
    lastUsed: hoursAgo(1),
    status: 'valid',
    lastTestMessage: 'Valid bot token for team: MyCompany',
  },
  {
    id: 'cred-slack-prod-app',
    integrationType: 'slack',
    name: 'Production Slack App',
    credentialType: 'app_token',
    keyMasked: 'xapp-1-...xyz',
    createdAt: daysAgo(14),
    lastUsed: hoursAgo(1),
    status: 'valid',
    lastTestMessage: 'App token format is valid',
  },
  {
    id: 'cred-slack-prod-signing',
    integrationType: 'slack',
    name: 'Production Signing Secret',
    credentialType: 'signing_secret',
    keyMasked: 'abc123...def',
    createdAt: daysAgo(14),
    lastUsed: null,
    status: 'untested',
  },
  {
    id: 'cred-github-main',
    integrationType: 'github',
    name: 'Main GitHub PAT',
    credentialType: 'personal_access_token',
    keyMasked: 'ghp_abc...xyz',
    createdAt: daysAgo(30),
    lastUsed: daysAgo(2),
    status: 'valid',
    lastTestMessage: 'Valid token for user: myuser',
  },
  {
    id: 'cred-teams-dev',
    integrationType: 'teams',
    name: 'Dev Teams Client',
    credentialType: 'client_id',
    keyMasked: 'abc-def...ghi',
    createdAt: daysAgo(7),
    lastUsed: null,
    status: 'untested',
  },
];

// ============================================================================
// Reset All Mocks (useful for testing)
// ============================================================================

export function resetAllLLMConfigMocks(): void {
  mockAPIKeys = [
    {
      id: 'key-anthropic-prod',
      provider: 'anthropic',
      name: 'Production Key',
      keyMasked: 'sk-ant-...xyz',
      createdAt: daysAgo(30),
      lastUsed: hoursAgo(2),
      status: 'valid',
      lastTestMessage: 'Successfully authenticated with Anthropic API',
    },
    {
      id: 'key-anthropic-dev',
      provider: 'anthropic',
      name: 'Development Key',
      keyMasked: 'sk-ant-...abc',
      createdAt: daysAgo(15),
      lastUsed: hoursAgo(5),
      status: 'valid',
      lastTestMessage: 'Successfully authenticated with Anthropic API',
    },
    {
      id: 'key-openai-main',
      provider: 'openai',
      name: 'Main OpenAI Key',
      keyMasked: 'sk-proj...def',
      createdAt: daysAgo(45),
      lastUsed: daysAgo(1),
      status: 'valid',
      lastTestMessage: 'Successfully authenticated with OpenAI API',
    },
    {
      id: 'key-google-test',
      provider: 'google',
      name: 'Test Google Key',
      keyMasked: 'AIzaSy...ghi',
      createdAt: daysAgo(7),
      lastUsed: null,
      status: 'untested',
    },
    {
      id: 'key-google-design-sdlc',
      provider: 'google',
      name: 'design-sdlc',
      keyMasked: 'AIzaSy...jkl',
      createdAt: daysAgo(3),
      lastUsed: hoursAgo(1),
      status: 'valid',
      lastTestMessage: 'Successfully authenticated with Google AI API',
    },
  ];
  mockAgentConfigs = [...defaultAgentConfigs];
  mockIntegrationCredentials = [...defaultIntegrationCredentials];
}

// ============================================================================
// Mock Send Test Message (Slack Bot Token)
// ============================================================================

export interface SendTestMessageResponse {
  success: boolean;
  message: string;
  channel?: string;
  timestamp?: string;
  testedAt: string;
  error?: string | null;
}

export function sendMockTestMessage(credentialId: string, channel?: string): SendTestMessageResponse {
  const cred = mockIntegrationCredentials.find((c) => c.id === credentialId);
  
  if (!cred) {
    return {
      success: false,
      message: 'Credential not found',
      testedAt: new Date().toISOString(),
      error: 'Credential not found',
    };
  }
  
  if (cred.integrationType !== 'slack' || cred.credentialType !== 'bot_token') {
    return {
      success: false,
      message: 'Only Slack bot tokens can send test messages',
      testedAt: new Date().toISOString(),
      error: 'Invalid credential type',
    };
  }
  
  // Simulate 90% success rate
  const isSuccess = Math.random() > 0.1;
  const targetChannel = channel || 'general';
  
  if (isSuccess) {
    return {
      success: true,
      message: 'Test message sent successfully to #' + targetChannel,
      channel: targetChannel,
      timestamp: new Date().getTime().toString().slice(0, 10) + '.' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
      testedAt: new Date().toISOString(),
      error: null,
    };
  } else {
    return {
      success: false,
      message: 'Failed to send test message',
      testedAt: new Date().toISOString(),
      error: 'channel_not_found: The channel #' + targetChannel + ' was not found or bot is not a member',
    };
  }
}
