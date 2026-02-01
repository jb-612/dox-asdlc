/**
 * LLM Config API client functions for LLM Admin Configuration (P05-F13)
 *
 * Handles providers, models, API keys, and agent configs.
 * Supports mock mode for development via dataSource toggle.
 *
 * T18: Connect frontend to backend API
 * - Checks useLLMConfigStore.getState().dataSource before each API call
 * - When 'real', calls actual backend endpoints at /api/llm/*
 * - When 'mock', uses existing mock data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  getMockProviders,
  getMockModels,
  getMockAllModels,
  getMockKeyModels,
  getMockAPIKeys,
  addMockAPIKey,
  deleteMockAPIKey,
  testMockAPIKey,
  getMockAgentConfigs,
  updateMockAgentConfig,
  simulateLLMConfigDelay,
} from './mocks/index';
import {
  getMockIntegrationCredentials,
  addMockIntegrationCredential,
  deleteMockIntegrationCredential,
  testMockIntegrationCredential,
  sendMockTestMessage,
} from './mocks/llmConfig';
import { shouldUseMocks, useLLMConfigStore } from '../stores/llmConfigStore';
import type {
  LLMProvider,
  LLMProviderInfo,
  LLMModel,
  APIKey,
  AgentLLMConfig,
  AgentRole,
  AddAPIKeyRequest,
  TestAPIKeyResponse,
  ProvidersResponse,
  ModelsResponse,
  APIKeysResponse,
  AgentConfigsResponse,
  AddAPIKeyResponse,
  IntegrationCredential,
  AddIntegrationCredentialRequest,
  TestIntegrationCredentialResponse,
  SecretsHealthResponse,
  SecretsEnvironment,
  EnhancedTestIntegrationCredentialResponse,
  SendTestMessageResponse,
} from '../types/llmConfig';

// ============================================================================
// Types for config export/import (T18)
// ============================================================================

/** Response from GET /api/llm/config/export */
export interface ConfigExportResponse {
  agents: Record<string, {
    provider: string;
    model: string;
    api_key_id: string;
    temperature: number;
    max_tokens: number;
    top_p?: number;
    top_k?: number;
    enabled: boolean;
  }>;
}

/** Response from GET /api/llm/config/export/env */
export interface EnvExportResponse {
  content: string;
  filename: string;
}

/** Response from POST /api/llm/config/validate */
export interface ValidationResponse {
  valid: boolean;
  errors: Array<{ loc: string[]; msg: string; type: string }>;
}

/** Response from POST /api/llm/config/import */
export interface ImportResponse {
  imported: boolean;
  agents: number;
}

// ============================================================================
// Error handling helper (T18)
// ============================================================================

/**
 * Create a user-friendly error message from API errors
 */
function createErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    // Check for axios error with response
    const axiosError = error as { response?: { data?: { detail?: string }; status?: number } };
    if (axiosError.response?.data?.detail) {
      return axiosError.response.data.detail;
    }
    if (axiosError.response?.status === 404) {
      return 'Resource not found';
    }
    if (axiosError.response?.status === 500) {
      return 'Server error. Please try again later.';
    }
    if (axiosError.response?.status === 401) {
      return 'Authentication required';
    }
    if (error.message) {
      return error.message;
    }
  }
  return defaultMessage;
}

// ============================================================================
// Query Keys
// ============================================================================

export const llmConfigQueryKeys = {
  all: ['llmConfig'] as const,
  providers: () => [...llmConfigQueryKeys.all, 'providers'] as const,
  models: (provider?: LLMProvider) => [...llmConfigQueryKeys.all, 'models', provider] as const,
  allModels: () => [...llmConfigQueryKeys.all, 'allModels'] as const,
  keyModels: (keyId?: string) => [...llmConfigQueryKeys.all, 'keyModels', keyId] as const,
  keys: () => [...llmConfigQueryKeys.all, 'keys'] as const,
  key: (id: string) => [...llmConfigQueryKeys.all, 'key', id] as const,
  agentConfigs: () => [...llmConfigQueryKeys.all, 'agentConfigs'] as const,
  agentConfig: (role: AgentRole) => [...llmConfigQueryKeys.all, 'agentConfig', role] as const,
  configExport: () => [...llmConfigQueryKeys.all, 'configExport'] as const,
};

export const integrationQueryKeys = {
  all: ['integrations'] as const,
  credentials: () => [...integrationQueryKeys.all, 'credentials'] as const,
  credential: (id: string) => [...integrationQueryKeys.all, 'credential', id] as const,
  credentialsByType: (type: string) => [...integrationQueryKeys.all, 'byType', type] as const,
};

// ============================================================================
// Provider API Functions
// ============================================================================

/**
 * Fetch all available LLM providers
 */
export async function fetchProviders(): Promise<LLMProviderInfo[]> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(50, 150);
    return getMockProviders();
  }

  try {
    // Backend returns list of provider strings, need to convert to LLMProviderInfo
    const response = await apiClient.get<string[]>('/llm/providers');
    const providers = response.data;

    // Map string providers to LLMProviderInfo format
    return providers.map((id) => ({
      id: id as LLMProvider,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      description: getProviderDescription(id as LLMProvider),
      enabled: true,
    }));
  } catch (error) {
    console.error('Failed to fetch LLM providers:', error);
    throw new Error(createErrorMessage(error, 'Failed to fetch LLM providers'));
  }
}

function getProviderDescription(provider: LLMProvider): string {
  const descriptions: Record<LLMProvider, string> = {
    anthropic: 'Claude models for advanced reasoning and analysis',
    openai: 'GPT models for general-purpose tasks',
    google: 'Gemini models for multimodal capabilities',
  };
  return descriptions[provider] || '';
}

/**
 * Hook to fetch providers
 */
export function useProviders() {
  const dataSource = useLLMConfigStore((state) => state.dataSource);
  return useQuery({
    queryKey: [...llmConfigQueryKeys.providers(), dataSource],
    queryFn: fetchProviders,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================================
// Model API Functions
// ============================================================================

/**
 * Map backend model response (snake_case) to frontend LLMModel type (camelCase)
 */
function mapBackendModelToFrontend(m: Record<string, unknown>): LLMModel {
  return {
    id: m.id as string,
    name: m.name as string,
    provider: m.provider as LLMProvider,
    maxContextTokens: (m.context_window as number) || (m.maxContextTokens as number) || 0,
    maxOutputTokens: (m.max_output as number) || (m.maxOutputTokens as number) || 0,
    costPer1MInput: (m.cost_per_1m_input as number) || (m.costPer1MInput as number) || 0,
    costPer1MOutput: (m.cost_per_1m_output as number) || (m.costPer1MOutput as number) || 0,
    supportsExtendedThinking: (m.supports_extended_thinking as boolean) || (m.supportsExtendedThinking as boolean),
    capabilities: Array.isArray(m.capabilities) ? m.capabilities.join(', ') : (m.capabilities as string),
  };
}

/**
 * Fetch models for a specific provider
 */
export async function fetchModels(provider: LLMProvider): Promise<LLMModel[]> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(50, 150);
    return getMockModels(provider);
  }

  try {
    const response = await apiClient.get<Record<string, unknown>[]>('/llm/providers/' + provider + '/models');
    // Map backend snake_case to frontend camelCase and filter out any undefined
    return (response.data || [])
      .filter((m): m is NonNullable<typeof m> => m != null)
      .map(mapBackendModelToFrontend);
  } catch (error) {
    console.error('Failed to fetch models for provider ' + provider + ':', error);
    throw new Error(createErrorMessage(error, 'Failed to fetch models for ' + provider));
  }
}

/**
 * Fetch all models from all providers
 */
export async function fetchAllModels(): Promise<LLMModel[]> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(50, 150);
    return getMockAllModels();
  }

  try {
    // Fetch from all providers in parallel
    const providers: LLMProvider[] = ['anthropic', 'openai', 'google'];
    const results = await Promise.all(
      providers.map((p) => apiClient.get<Record<string, unknown>[]>('/llm/providers/' + p + '/models'))
    );
    // Map backend snake_case to frontend camelCase and filter out any undefined
    return results.flatMap((r) =>
      (r.data || [])
        .filter((m): m is NonNullable<typeof m> => m != null)
        .map(mapBackendModelToFrontend)
    );
  } catch (error) {
    console.error('Failed to fetch all models:', error);
    throw new Error(createErrorMessage(error, 'Failed to fetch models'));
  }
}

/**
 * Fetch models for a specific API key (dynamic model discovery)
 */
export async function fetchKeyModels(keyId: string): Promise<LLMModel[]> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(100, 300);
    // Use getMockKeyModels for dynamic model discovery simulation
    return getMockKeyModels(keyId);
  }

  try {
    const response = await apiClient.get<Record<string, unknown>[]>('/llm/keys/' + keyId + '/models');
    // Map backend snake_case to frontend camelCase and filter out any undefined
    return (response.data || [])
      .filter((m): m is NonNullable<typeof m> => m != null)
      .map(mapBackendModelToFrontend);
  } catch (error) {
    console.error('Failed to fetch models for key ' + keyId + ':', error);
    throw new Error(createErrorMessage(error, 'Failed to fetch models for key'));
  }
}

/**
 * Force model discovery for an API key
 */
export async function forceDiscoverModels(keyId: string): Promise<LLMModel[]> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(500, 1000);
    // Use getMockKeyModels for dynamic model discovery simulation
    return getMockKeyModels(keyId);
  }

  try {
    const response = await apiClient.post<Record<string, unknown>[]>('/llm/keys/' + keyId + '/discover');
    // Map backend snake_case to frontend camelCase and filter out any undefined
    return (response.data || [])
      .filter((m): m is NonNullable<typeof m> => m != null)
      .map(mapBackendModelToFrontend);
  } catch (error) {
    console.error('Failed to discover models for key ' + keyId + ':', error);
    throw new Error(createErrorMessage(error, 'Failed to discover models'));
  }
}

/**
 * Hook to fetch models for a provider
 */
export function useModels(provider: LLMProvider | null) {
  const dataSource = useLLMConfigStore((state) => state.dataSource);
  return useQuery({
    queryKey: [...llmConfigQueryKeys.models(provider || undefined), dataSource],
    queryFn: () => (provider ? fetchModels(provider) : Promise.resolve([])),
    enabled: !!provider,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch all models
 */
export function useAllModels() {
  const dataSource = useLLMConfigStore((state) => state.dataSource);
  return useQuery({
    queryKey: [...llmConfigQueryKeys.allModels(), dataSource],
    queryFn: fetchAllModels,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch models for a specific API key (T27)
 */
export function useKeyModels(keyId: string | null) {
  const dataSource = useLLMConfigStore((state) => state.dataSource);
  return useQuery({
    queryKey: [...llmConfigQueryKeys.keyModels(keyId || undefined), dataSource],
    queryFn: () => (keyId ? fetchKeyModels(keyId) : Promise.resolve([])),
    enabled: !!keyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to force discover models for a key
 */
export function useForceDiscoverModels() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: forceDiscoverModels,
    onSuccess: (_, keyId) => {
      queryClient.invalidateQueries({ queryKey: llmConfigQueryKeys.keyModels(keyId) });
    },
  });
}

// ============================================================================
// API Key Functions
// ============================================================================

/**
 * Fetch all API keys (masked)
 */
export async function fetchAPIKeys(): Promise<APIKey[]> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(50, 150);
    return getMockAPIKeys();
  }

  try {
    const response = await apiClient.get<APIKey[]>('/llm/keys');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    throw new Error(createErrorMessage(error, 'Failed to fetch API keys'));
  }
}

/**
 * Add a new API key
 */
export async function addAPIKey(request: AddAPIKeyRequest): Promise<APIKey> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(200, 400);
    return addMockAPIKey(request);
  }

  try {
    const response = await apiClient.post<APIKey>('/llm/keys', request);
    return response.data;
  } catch (error) {
    console.error('Failed to add API key:', error);
    throw new Error(createErrorMessage(error, 'Failed to add API key'));
  }
}

/**
 * Delete an API key
 */
export async function deleteAPIKey(id: string): Promise<void> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(100, 200);
    deleteMockAPIKey(id);
    return;
  }

  try {
    await apiClient.delete('/llm/keys/' + id);
  } catch (error) {
    console.error('Failed to delete API key:', error);
    throw new Error(createErrorMessage(error, 'Failed to delete API key'));
  }
}

/**
 * Test an API key
 */
export async function testAPIKey(id: string): Promise<TestAPIKeyResponse> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(500, 1500); // Simulate actual API call
    return testMockAPIKey(id);
  }

  try {
    const response = await apiClient.post<TestAPIKeyResponse>('/llm/keys/' + id + '/test');
    return response.data;
  } catch (error) {
    console.error('Failed to test API key:', error);
    throw new Error(createErrorMessage(error, 'Failed to test API key'));
  }
}

/**
 * Hook to fetch API keys
 */
export function useAPIKeys() {
  const dataSource = useLLMConfigStore((state) => state.dataSource);
  return useQuery({
    queryKey: [...llmConfigQueryKeys.keys(), dataSource],
    queryFn: fetchAPIKeys,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to add an API key
 */
export function useAddAPIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addAPIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: llmConfigQueryKeys.keys() });
    },
  });
}

/**
 * Hook to delete an API key
 */
export function useDeleteAPIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAPIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: llmConfigQueryKeys.keys() });
    },
  });
}

/**
 * Hook to test an API key
 */
export function useTestAPIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: testAPIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: llmConfigQueryKeys.keys() });
    },
  });
}

// ============================================================================
// Agent Config Functions
// ============================================================================

/**
 * Map backend snake_case config to frontend camelCase
 */
function mapBackendConfigToFrontend(data: Record<string, unknown>): AgentLLMConfig {
  return {
    role: data.role as AgentRole,
    provider: data.provider as LLMProvider,
    model: data.model as string,
    apiKeyId: (data.api_key_id as string) || '',
    settings: {
      temperature: (data.settings as Record<string, unknown>)?.temperature as number ?? data.temperature as number ?? 0.7,
      maxTokens: (data.settings as Record<string, unknown>)?.max_tokens as number ?? data.max_tokens as number ?? 4096,
      topP: (data.settings as Record<string, unknown>)?.top_p as number ?? data.top_p as number,
      topK: (data.settings as Record<string, unknown>)?.top_k as number ?? data.top_k as number,
    },
    enabled: data.enabled as boolean ?? true,
  };
}

/**
 * Fetch all agent configurations
 */
export async function fetchAgentConfigs(): Promise<AgentLLMConfig[]> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(50, 150);
    return getMockAgentConfigs();
  }

  try {
    const response = await apiClient.get<Record<string, unknown>[]>('/llm/agents');
    return response.data.map(mapBackendConfigToFrontend);
  } catch (error) {
    console.error('Failed to fetch agent configs:', error);
    throw new Error(createErrorMessage(error, 'Failed to fetch agent configurations'));
  }
}

/**
 * Map frontend camelCase config to backend snake_case
 */
function mapConfigToBackend(config: Partial<AgentLLMConfig>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (config.provider !== undefined) result.provider = config.provider;
  if (config.model !== undefined) result.model = config.model;
  if (config.apiKeyId !== undefined) result.api_key_id = config.apiKeyId;
  if (config.enabled !== undefined) result.enabled = config.enabled;

  if (config.settings) {
    // Settings must be a nested object with snake_case keys
    const settings: Record<string, unknown> = {};
    if (config.settings.temperature !== undefined) settings.temperature = config.settings.temperature;
    if (config.settings.maxTokens !== undefined) settings.max_tokens = config.settings.maxTokens;
    if (config.settings.topP !== undefined) settings.top_p = config.settings.topP;
    if (config.settings.topK !== undefined) settings.top_k = config.settings.topK;
    result.settings = settings;
  }

  return result;
}

/**
 * Update an agent configuration
 */
export async function updateAgentConfig(
  role: AgentRole,
  config: Partial<AgentLLMConfig>
): Promise<AgentLLMConfig> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(100, 300);
    const updated = updateMockAgentConfig(role, config);
    if (!updated) {
      throw new Error('Agent config not found for role: ' + role);
    }
    return updated;
  }

  try {
    // Map camelCase frontend fields to snake_case backend fields
    const backendConfig = mapConfigToBackend(config);
    const response = await apiClient.put<Record<string, unknown>>('/llm/agents/' + role, backendConfig);
    // Map snake_case response back to camelCase
    return mapBackendConfigToFrontend(response.data);
  } catch (error) {
    console.error('Failed to update agent config:', error);
    throw new Error(createErrorMessage(error, 'Failed to update agent configuration'));
  }
}

/**
 * Hook to fetch agent configs
 */
export function useAgentConfigs() {
  const dataSource = useLLMConfigStore((state) => state.dataSource);
  return useQuery({
    queryKey: [...llmConfigQueryKeys.agentConfigs(), dataSource],
    queryFn: fetchAgentConfigs,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to update an agent config
 */
export function useUpdateAgentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ role, config }: { role: AgentRole; config: Partial<AgentLLMConfig> }) =>
      updateAgentConfig(role, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: llmConfigQueryKeys.agentConfigs() });
    },
  });
}

// ============================================================================
// Config Export/Import Functions (T18)
// ============================================================================

/**
 * Export full LLM configuration as JSON
 */
export async function exportConfig(): Promise<ConfigExportResponse> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(100, 200);
    const agentConfigs = getMockAgentConfigs();
    const agents: ConfigExportResponse['agents'] = {};
    for (const config of agentConfigs) {
      agents[config.role] = {
        provider: config.provider,
        model: config.model,
        api_key_id: config.apiKeyId,
        temperature: config.settings.temperature,
        max_tokens: config.settings.maxTokens,
        top_p: config.settings.topP,
        top_k: config.settings.topK,
        enabled: config.enabled,
      };
    }
    return { agents };
  }

  try {
    const response = await apiClient.get<ConfigExportResponse>('/llm/config/export');
    return response.data;
  } catch (error) {
    console.error('Failed to export config:', error);
    throw new Error(createErrorMessage(error, 'Failed to export configuration'));
  }
}

/**
 * Export configuration as .env format
 */
export async function exportConfigEnv(): Promise<EnvExportResponse> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(100, 200);
    const agentConfigs = getMockAgentConfigs();
    let content = '# LLM Configuration - Generated by aSDLC Admin\n';
    content += '# Generated: ' + new Date().toISOString() + '\n\n';

    for (const config of agentConfigs) {
      const roleUpper = config.role.toUpperCase();
      content += '# ' + config.role.charAt(0).toUpperCase() + config.role.slice(1) + ' Agent\n';
      content += 'LLM_' + roleUpper + '_PROVIDER=' + config.provider + '\n';
      content += 'LLM_' + roleUpper + '_MODEL=' + config.model + '\n';
      content += 'LLM_' + roleUpper + '_API_KEY_ID=' + config.apiKeyId + '\n';
      content += 'LLM_' + roleUpper + '_TEMPERATURE=' + config.settings.temperature + '\n';
      content += 'LLM_' + roleUpper + '_MAX_TOKENS=' + config.settings.maxTokens + '\n\n';
    }

    content += '# API Keys (IDs only - actual keys stored securely)\n';
    content += '# To use in deployment, set these environment variables:\n';
    content += '# ANTHROPIC_API_KEY=your-key-here\n';
    content += '# OPENAI_API_KEY=your-key-here\n';
    content += '# GOOGLE_API_KEY=your-key-here\n';

    return { content, filename: 'llm-config.env' };
  }

  try {
    const response = await apiClient.get<EnvExportResponse>('/llm/config/export/env');
    return response.data;
  } catch (error) {
    console.error('Failed to export config as env:', error);
    throw new Error(createErrorMessage(error, 'Failed to export configuration'));
  }
}

/**
 * Import configuration from JSON
 */
export async function importConfig(config: ConfigExportResponse): Promise<ImportResponse> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(200, 400);
    // In mock mode, update each agent config
    let count = 0;
    for (const [role, agentConfig] of Object.entries(config.agents)) {
      updateMockAgentConfig(role as AgentRole, {
        provider: agentConfig.provider as LLMProvider,
        model: agentConfig.model,
        apiKeyId: agentConfig.api_key_id,
        settings: {
          temperature: agentConfig.temperature,
          maxTokens: agentConfig.max_tokens,
          topP: agentConfig.top_p,
          topK: agentConfig.top_k,
        },
        enabled: agentConfig.enabled,
      });
      count++;
    }
    return { imported: true, agents: count };
  }

  try {
    const response = await apiClient.post<ImportResponse>('/llm/config/import', config);
    return response.data;
  } catch (error) {
    console.error('Failed to import config:', error);
    throw new Error(createErrorMessage(error, 'Failed to import configuration'));
  }
}

/**
 * Validate configuration JSON
 */
export async function validateConfig(config: ConfigExportResponse): Promise<ValidationResponse> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(50, 100);
    // Basic validation in mock mode
    const errors: ValidationResponse['errors'] = [];

    if (!config.agents || typeof config.agents !== 'object') {
      errors.push({ loc: ['agents'], msg: 'agents is required', type: 'value_error.missing' });
    } else {
      for (const [role, agentConfig] of Object.entries(config.agents)) {
        if (agentConfig.temperature < 0 || agentConfig.temperature > 1) {
          errors.push({
            loc: ['agents', role, 'temperature'],
            msg: 'temperature must be between 0 and 1',
            type: 'value_error'
          });
        }
        if (agentConfig.max_tokens < 1024 || agentConfig.max_tokens > 32768) {
          errors.push({
            loc: ['agents', role, 'max_tokens'],
            msg: 'max_tokens must be between 1024 and 32768',
            type: 'value_error'
          });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  try {
    const response = await apiClient.post<ValidationResponse>('/llm/config/validate', config);
    return response.data;
  } catch (error) {
    console.error('Failed to validate config:', error);
    throw new Error(createErrorMessage(error, 'Failed to validate configuration'));
  }
}

/**
 * Hook to export config
 */
export function useExportConfig() {
  return useMutation({
    mutationFn: exportConfig,
  });
}

/**
 * Hook to export config as env
 */
export function useExportConfigEnv() {
  return useMutation({
    mutationFn: exportConfigEnv,
  });
}

/**
 * Hook to import config
 */
export function useImportConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: llmConfigQueryKeys.agentConfigs() });
    },
  });
}

/**
 * Hook to validate config
 */
export function useValidateConfig() {
  return useMutation({
    mutationFn: validateConfig,
  });
}

// ============================================================================
// Integration Credentials API Functions
// ============================================================================

/**
 * Fetch all integration credentials
 */
export async function fetchIntegrationCredentials(
  integrationType?: string
): Promise<IntegrationCredential[]> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(50, 150);
    const all = getMockIntegrationCredentials();
    if (integrationType) {
      return all.filter((c) => c.integrationType === integrationType);
    }
    return all;
  }

  try {
    const url = integrationType
      ? '/integrations?integration_type=' + integrationType
      : '/integrations';
    const response = await apiClient.get<IntegrationCredential[]>(url);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch integration credentials:', error);
    throw new Error(createErrorMessage(error, 'Failed to fetch integration credentials'));
  }
}

/**
 * Add a new integration credential
 */
export async function addIntegrationCredential(
  request: AddIntegrationCredentialRequest
): Promise<IntegrationCredential> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(200, 400);
    return addMockIntegrationCredential(request);
  }

  try {
    const response = await apiClient.post<IntegrationCredential>('/integrations', request);
    return response.data;
  } catch (error) {
    console.error('Failed to add integration credential:', error);
    throw new Error(createErrorMessage(error, 'Failed to add integration credential'));
  }
}

/**
 * Delete an integration credential
 */
export async function deleteIntegrationCredential(id: string): Promise<void> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(100, 200);
    deleteMockIntegrationCredential(id);
    return;
  }

  try {
    await apiClient.delete('/integrations/' + id);
  } catch (error) {
    console.error('Failed to delete integration credential:', error);
    throw new Error(createErrorMessage(error, 'Failed to delete integration credential'));
  }
}

/**
 * Test an integration credential
 */
export async function testIntegrationCredential(
  id: string
): Promise<TestIntegrationCredentialResponse> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(500, 1500);
    return testMockIntegrationCredential(id);
  }

  try {
    const response = await apiClient.post<TestIntegrationCredentialResponse>(
      '/integrations/' + id + '/test'
    );
    return response.data;
  } catch (error) {
    console.error('Failed to test integration credential:', error);
    throw new Error(createErrorMessage(error, 'Failed to test integration credential'));
  }
}

/**
 * Hook to fetch integration credentials
 */
export function useIntegrationCredentials(integrationType?: string) {
  const dataSource = useLLMConfigStore((state) => state.dataSource);
  return useQuery({
    queryKey: integrationType
      ? [...integrationQueryKeys.credentialsByType(integrationType), dataSource]
      : [...integrationQueryKeys.credentials(), dataSource],
    queryFn: () => fetchIntegrationCredentials(integrationType),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to add an integration credential
 */
export function useAddIntegrationCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addIntegrationCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationQueryKeys.credentials() });
    },
  });
}

/**
 * Hook to delete an integration credential
 */
export function useDeleteIntegrationCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteIntegrationCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationQueryKeys.credentials() });
    },
  });
}

/**
 * Hook to test an integration credential
 */
export function useTestIntegrationCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: testIntegrationCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationQueryKeys.credentials() });
    },
  });
}

// ============================================================================
// Secrets Backend Health API Functions (P09-F01)
// ============================================================================

export const secretsQueryKeys = {
  all: ['secrets'] as const,
  health: () => [...secretsQueryKeys.all, 'health'] as const,
};

/**
 * Fetch secrets backend health status
 */
export async function fetchSecretsHealth(): Promise<SecretsHealthResponse> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(50, 150);
    return getMockSecretsHealth();
  }

  try {
    const response = await apiClient.get<SecretsHealthResponse>('/integrations/health');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch secrets health:', error);
    // Return a degraded status on error rather than throwing
    return {
      status: 'unhealthy',
      backend: 'env',
      error: createErrorMessage(error, 'Failed to check secrets backend health'),
    };
  }
}

/**
 * Hook to fetch secrets backend health
 */
export function useSecretsHealth() {
  const dataSource = useLLMConfigStore((state) => state.dataSource);
  return useQuery({
    queryKey: [...secretsQueryKeys.health(), dataSource],
    queryFn: fetchSecretsHealth,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Test an integration credential with enhanced result handling
 * Returns more detailed information for Slack tests including channel and timestamp
 */
export async function testIntegrationCredentialEnhanced(
  id: string
): Promise<EnhancedTestIntegrationCredentialResponse> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(500, 1500);
    return testMockIntegrationCredentialEnhanced(id);
  }

  try {
    const response = await apiClient.post<EnhancedTestIntegrationCredentialResponse>(
      '/integrations/' + id + '/test'
    );
    return response.data;
  } catch (error) {
    console.error('Failed to test integration credential:', error);
    throw new Error(createErrorMessage(error, 'Failed to test integration credential'));
  }
}

/**
 * Hook to test an integration credential with enhanced results
 */
export function useTestIntegrationCredentialEnhanced() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: testIntegrationCredentialEnhanced,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationQueryKeys.credentials() });
    },
  });
}

// Mock function for secrets health
function getMockSecretsHealth(): SecretsHealthResponse {
  // Randomly pick a backend type for demo purposes
  const backends: Array<'env' | 'infisical' | 'gcp'> = ['env', 'infisical', 'gcp'];
  const backend = backends[Math.floor(Math.random() * backends.length)];

  if (backend === 'env') {
    return {
      status: 'healthy',
      backend: 'env',
      details: { source: 'environment variables' },
    };
  } else if (backend === 'infisical') {
    return {
      status: 'healthy',
      backend: 'infisical',
      details: { connected: true, version: '0.78.0' },
    };
  } else {
    return {
      status: 'healthy',
      backend: 'gcp',
      details: { project: 'my-project', location: 'us-central1' },
    };
  }
}

// Mock function for enhanced credential test
function testMockIntegrationCredentialEnhanced(id: string): EnhancedTestIntegrationCredentialResponse {
  const result = testMockIntegrationCredential(id);

  // For Slack bot tokens, add enhanced details
  if (id.includes('slack') && id.includes('bot')) {
    return {
      ...result,
      details: {
        team: 'TestTeam',
        team_id: 'T12345',
        channel: '#asdlc-notifications',
        timestamp: new Date().getTime().toString().slice(0, 10) + '.123456',
      },
    };
  }

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format cost for display
 */
export function formatCost(amount: number): string {
  if (amount < 0.01) {
    return '<$0.01';
  }
  return '$' + amount.toFixed(2);
}

/**
 * Format token count for display
 */
export function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(0) + 'K';
  }
  return count.toString();
}

/**
 * Get relative time string
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) {
    return 'Never';
  }

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return diffMins + ' min ago';
  }
  if (diffHours < 24) {
    return diffHours + 'h ago';
  }
  if (diffDays < 7) {
    return diffDays + 'd ago';
  }
  return date.toLocaleDateString();
}

// ============================================================================
// Test Connection Functions
// ============================================================================

/** Response from POST /api/llm/agents/:role/test */
export interface TestConnectionResponse {
  success: boolean;
  message: string;
}

/**
 * Test LLM connection for an agent config
 */
export async function testLLMConnection(role: AgentRole): Promise<TestConnectionResponse> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(1000, 2000);
    // Simulate random success/failure for testing
    const success = Math.random() > 0.2;
    return {
      success,
      message: success
        ? 'Connection successful (mock)'
        : 'Connection failed: API key invalid or expired (mock)',
    };
  }

  try {
    const response = await apiClient.post<TestConnectionResponse>('/llm/agents/' + role + '/test');
    return response.data;
  } catch (error) {
    console.error('Failed to test LLM connection:', error);
    throw new Error('Failed to test connection');
  }
}

/**
 * Hook to test LLM connection
 */
export function useTestLLMConnection() {
  return useMutation({
    mutationFn: testLLMConnection,
  });
}


// ============================================================================
// Send Test Message Functions (Slack Bot Token)
// ============================================================================

/**
 * Send a test message to Slack using a bot token credential
 */
export async function sendTestMessage(
  credentialId: string,
  channel?: string
): Promise<SendTestMessageResponse> {
  if (shouldUseMocks()) {
    await simulateLLMConfigDelay(500, 1500);
    return sendMockTestMessage(credentialId, channel);
  }

  try {
    const url = channel
      ? '/integrations/' + credentialId + '/test-message?channel=' + encodeURIComponent(channel)
      : '/integrations/' + credentialId + '/test-message';
    const response = await apiClient.post<SendTestMessageResponse>(url);
    return response.data;
  } catch (error) {
    console.error('Failed to send test message:', error);
    throw new Error(createErrorMessage(error, 'Failed to send test message'));
  }
}

/**
 * Hook to send a test message
 */
export function useSendTestMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ credentialId, channel }: { credentialId: string; channel?: string }) =>
      sendTestMessage(credentialId, channel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationQueryKeys.credentials() });
    },
  });
}
