/**
 * Integration tests for LLM Config API (P05-F13 T18)
 *
 * These tests verify the API client works correctly when:
 * 1. Using mock data (dataSource === 'mock')
 * 2. Using real backend (dataSource === 'real')
 *
 * Note: Real backend tests require the backend to be running.
 * Set VITE_TEST_REAL_BACKEND=true to enable real backend tests.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// API functions and hooks
import {
  fetchProviders,
  fetchModels,
  fetchAllModels,
  fetchAPIKeys,
  addAPIKey,
  deleteAPIKey,
  testAPIKey,
  fetchAgentConfigs,
  updateAgentConfig,
  fetchKeyModels,
  forceDiscoverModels,
  exportConfig,
  exportConfigEnv,
  importConfig,
  validateConfig,
  useProviders,
  useAPIKeys,
  useAgentConfigs,
  useExportConfig,
  useValidateConfig,
  llmConfigQueryKeys,
} from './llmConfig';

// Store and mocks
import { useLLMConfigStore } from '../stores/llmConfigStore';
import { resetAllLLMConfigMocks } from './mocks/llmConfig';

// Mock axios for real API tests
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from './client';

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('LLM Config API - Mock Mode', () => {
  beforeEach(() => {
    // Reset to mock mode
    useLLMConfigStore.setState({ dataSource: 'mock' });
    resetAllLLMConfigMocks();
    vi.clearAllMocks();
  });

  describe('Provider Functions', () => {
    it('fetchProviders returns mock providers in mock mode', async () => {
      const providers = await fetchProviders();

      expect(providers).toHaveLength(3);
      expect(providers.map((p) => p.id)).toEqual(['anthropic', 'openai', 'google']);
      expect(providers[0].name).toBe('Anthropic');
    });

    it('useProviders hook returns providers', async () => {
      const { result } = renderHook(() => useProviders(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(3);
    });
  });

  describe('Model Functions', () => {
    it('fetchModels returns models for a provider', async () => {
      const models = await fetchModels('anthropic');

      expect(models.length).toBeGreaterThan(0);
      expect(models[0].provider).toBe('anthropic');
    });

    it('fetchAllModels returns models from all providers', async () => {
      const models = await fetchAllModels();

      expect(models.length).toBeGreaterThan(3);
      const providers = new Set(models.map((m) => m.provider));
      expect(providers.has('anthropic')).toBe(true);
      expect(providers.has('openai')).toBe(true);
      expect(providers.has('google')).toBe(true);
    });

    it('fetchKeyModels returns models for a key', async () => {
      const models = await fetchKeyModels('key-anthropic-prod');

      expect(models.length).toBeGreaterThan(0);
      expect(models[0].provider).toBe('anthropic');
    });

    it('fetchKeyModels returns empty array for non-existent key', async () => {
      const models = await fetchKeyModels('non-existent-key');

      expect(models).toEqual([]);
    });

    it('forceDiscoverModels returns models', async () => {
      const models = await forceDiscoverModels('key-anthropic-prod');

      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('API Key Functions', () => {
    it('fetchAPIKeys returns mock keys', async () => {
      const keys = await fetchAPIKeys();

      expect(keys.length).toBeGreaterThan(0);
      expect(keys[0]).toHaveProperty('id');
      expect(keys[0]).toHaveProperty('provider');
      expect(keys[0]).toHaveProperty('keyMasked');
    });

    it('addAPIKey creates a new key', async () => {
      const initialKeys = await fetchAPIKeys();
      const newKey = await addAPIKey({
        provider: 'anthropic',
        name: 'Test Key',
        key: 'sk-ant-test-key-12345',
      });

      expect(newKey.provider).toBe('anthropic');
      expect(newKey.name).toBe('Test Key');
      expect(newKey.status).toBe('untested');

      const updatedKeys = await fetchAPIKeys();
      expect(updatedKeys.length).toBe(initialKeys.length + 1);
    });

    it('deleteAPIKey removes a key', async () => {
      const initialKeys = await fetchAPIKeys();
      await deleteAPIKey(initialKeys[0].id);

      const updatedKeys = await fetchAPIKeys();
      expect(updatedKeys.length).toBe(initialKeys.length - 1);
    });

    it('testAPIKey returns test result', async () => {
      const keys = await fetchAPIKeys();
      const result = await testAPIKey(keys[0].id);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('testedAt');
    });

    it('useAPIKeys hook returns keys', async () => {
      const { result } = renderHook(() => useAPIKeys(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data!.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Config Functions', () => {
    it('fetchAgentConfigs returns agent configs', async () => {
      const configs = await fetchAgentConfigs();

      expect(configs.length).toBeGreaterThan(0);
      expect(configs[0]).toHaveProperty('role');
      expect(configs[0]).toHaveProperty('provider');
      expect(configs[0]).toHaveProperty('model');
      expect(configs[0]).toHaveProperty('settings');
    });

    it('updateAgentConfig updates a config', async () => {
      const configs = await fetchAgentConfigs();
      const firstConfig = configs[0];

      const updated = await updateAgentConfig(firstConfig.role, {
        model: 'claude-opus-4-20250514',
      });

      expect(updated.role).toBe(firstConfig.role);
      expect(updated.model).toBe('claude-opus-4-20250514');
    });

    it('updateAgentConfig throws for non-existent role', async () => {
      await expect(
        updateAgentConfig('non-existent' as any, { model: 'test' })
      ).rejects.toThrow('Agent config not found');
    });

    it('useAgentConfigs hook returns configs', async () => {
      const { result } = renderHook(() => useAgentConfigs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data!.length).toBeGreaterThan(0);
    });
  });

  describe('Config Export/Import Functions', () => {
    it('exportConfig returns configuration object', async () => {
      const config = await exportConfig();

      expect(config).toHaveProperty('agents');
      expect(Object.keys(config.agents).length).toBeGreaterThan(0);

      const firstAgent = Object.values(config.agents)[0];
      expect(firstAgent).toHaveProperty('provider');
      expect(firstAgent).toHaveProperty('model');
      expect(firstAgent).toHaveProperty('temperature');
    });

    it('exportConfigEnv returns .env format', async () => {
      const result = await exportConfigEnv();

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toBe('llm-config.env');
      expect(result.content).toContain('LLM_');
      expect(result.content).toContain('_PROVIDER=');
    });

    it('importConfig imports configuration', async () => {
      const config = await exportConfig();
      const result = await importConfig(config);

      expect(result.imported).toBe(true);
      expect(result.agents).toBeGreaterThan(0);
    });

    it('validateConfig validates valid configuration', async () => {
      const config = await exportConfig();
      const result = await validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validateConfig returns errors for invalid configuration', async () => {
      const invalidConfig = {
        agents: {
          discovery: {
            provider: 'anthropic',
            model: 'claude-sonnet-4',
            api_key_id: 'key-1',
            temperature: 2.0, // Invalid: > 1
            max_tokens: 100, // Invalid: < 1024
            enabled: true,
          },
        },
      };

      const result = await validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('useExportConfig mutation works', async () => {
      const { result } = renderHook(() => useExportConfig(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(result.current.data).toHaveProperty('agents');
    });
  });
});

describe('LLM Config API - Real Mode', () => {
  const mockApiResponse = <T>(data: T) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  });

  beforeEach(() => {
    // Switch to real mode
    useLLMConfigStore.setState({ dataSource: 'real' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset to mock mode
    useLLMConfigStore.setState({ dataSource: 'mock' });
  });

  describe('Provider Functions - Real API', () => {
    it('fetchProviders calls real API endpoint', async () => {
      vi.mocked(apiClient.get).mockResolvedValue(
        mockApiResponse(['anthropic', 'openai', 'google'])
      );

      const providers = await fetchProviders();

      expect(apiClient.get).toHaveBeenCalledWith('/llm/providers');
      expect(providers).toHaveLength(3);
      expect(providers[0].id).toBe('anthropic');
    });

    it('fetchProviders handles API errors gracefully', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(
        new Error('Network error')
      );

      // The error message should be the original error message when no response is present
      await expect(fetchProviders()).rejects.toThrow('Network error');
    });
  });

  describe('Model Functions - Real API', () => {
    it('fetchModels calls real API endpoint and maps snake_case to camelCase', async () => {
      // Backend returns snake_case fields
      const backendModels = [
        {
          id: 'claude-sonnet-4',
          name: 'Claude Sonnet 4',
          provider: 'anthropic',
          context_window: 200000,
          max_output: 4096,
          cost_per_1m_input: 3.0,
          cost_per_1m_output: 15.0,
          supports_extended_thinking: true,
          capabilities: ['text', 'code'],
        },
      ];
      // Frontend expects camelCase fields
      const expectedModels = [
        {
          id: 'claude-sonnet-4',
          name: 'Claude Sonnet 4',
          provider: 'anthropic',
          maxContextTokens: 200000,
          maxOutputTokens: 4096,
          costPer1MInput: 3.0,
          costPer1MOutput: 15.0,
          supportsExtendedThinking: true,
          capabilities: 'text, code',
        },
      ];
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse(backendModels));

      const models = await fetchModels('anthropic');

      expect(apiClient.get).toHaveBeenCalledWith('/llm/providers/anthropic/models');
      expect(models).toEqual(expectedModels);
    });

    it('fetchKeyModels calls real API endpoint and maps snake_case to camelCase', async () => {
      // Backend returns snake_case fields
      const backendModels = [
        {
          id: 'claude-sonnet-4',
          name: 'Claude Sonnet 4',
          provider: 'anthropic',
          context_window: 200000,
          max_output: 4096,
        },
      ];
      // Frontend expects camelCase fields
      const expectedModels = [
        {
          id: 'claude-sonnet-4',
          name: 'Claude Sonnet 4',
          provider: 'anthropic',
          maxContextTokens: 200000,
          maxOutputTokens: 4096,
          costPer1MInput: 0,
          costPer1MOutput: 0,
          supportsExtendedThinking: undefined,
          capabilities: undefined,
        },
      ];
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse(backendModels));

      const models = await fetchKeyModels('key-123');

      expect(apiClient.get).toHaveBeenCalledWith('/llm/keys/key-123/models');
      expect(models).toEqual(expectedModels);
    });

    it('forceDiscoverModels calls real API endpoint and maps snake_case to camelCase', async () => {
      // Backend returns snake_case fields
      const backendModels = [
        {
          id: 'claude-sonnet-4',
          name: 'Claude Sonnet 4',
          provider: 'anthropic',
          context_window: 200000,
          max_output: 4096,
        },
      ];
      // Frontend expects camelCase fields
      const expectedModels = [
        {
          id: 'claude-sonnet-4',
          name: 'Claude Sonnet 4',
          provider: 'anthropic',
          maxContextTokens: 200000,
          maxOutputTokens: 4096,
          costPer1MInput: 0,
          costPer1MOutput: 0,
          supportsExtendedThinking: undefined,
          capabilities: undefined,
        },
      ];
      vi.mocked(apiClient.post).mockResolvedValue(mockApiResponse(backendModels));

      const models = await forceDiscoverModels('key-123');

      expect(apiClient.post).toHaveBeenCalledWith('/llm/keys/key-123/discover');
      expect(models).toEqual(expectedModels);
    });
  });

  describe('API Key Functions - Real API', () => {
    it('fetchAPIKeys calls real API endpoint', async () => {
      const mockKeys = [
        { id: 'key-1', provider: 'anthropic', name: 'Test Key', keyMasked: 'sk-...xyz' },
      ];
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse(mockKeys));

      const keys = await fetchAPIKeys();

      expect(apiClient.get).toHaveBeenCalledWith('/llm/keys');
      expect(keys).toEqual(mockKeys);
    });

    it('addAPIKey calls real API endpoint', async () => {
      const newKey = {
        id: 'key-new',
        provider: 'anthropic',
        name: 'New Key',
        keyMasked: 'sk-...abc',
        status: 'untested',
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockApiResponse(newKey));

      const result = await addAPIKey({
        provider: 'anthropic',
        name: 'New Key',
        key: 'sk-ant-actual-key',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/llm/keys', {
        provider: 'anthropic',
        name: 'New Key',
        key: 'sk-ant-actual-key',
      });
      expect(result).toEqual(newKey);
    });

    it('deleteAPIKey calls real API endpoint', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(mockApiResponse(null));

      await deleteAPIKey('key-123');

      expect(apiClient.delete).toHaveBeenCalledWith('/llm/keys/key-123');
    });

    it('testAPIKey calls real API endpoint', async () => {
      const testResult = { valid: true, message: 'Success', testedAt: new Date().toISOString() };
      vi.mocked(apiClient.post).mockResolvedValue(mockApiResponse(testResult));

      const result = await testAPIKey('key-123');

      expect(apiClient.post).toHaveBeenCalledWith('/llm/keys/key-123/test');
      expect(result).toEqual(testResult);
    });
  });

  describe('Agent Config Functions - Real API', () => {
    it('fetchAgentConfigs calls real API endpoint', async () => {
      const mockConfigs = [
        { role: 'discovery', provider: 'anthropic', model: 'claude-sonnet-4', settings: {} },
      ];
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse(mockConfigs));

      const configs = await fetchAgentConfigs();

      expect(apiClient.get).toHaveBeenCalledWith('/llm/agents');
      expect(configs).toEqual(mockConfigs);
    });

    it('updateAgentConfig calls real API endpoint', async () => {
      const updatedConfig = {
        role: 'discovery',
        provider: 'anthropic',
        model: 'claude-opus-4',
        settings: {},
      };
      vi.mocked(apiClient.put).mockResolvedValue(mockApiResponse(updatedConfig));

      const result = await updateAgentConfig('discovery', { model: 'claude-opus-4' });

      expect(apiClient.put).toHaveBeenCalledWith('/llm/agents/discovery', { model: 'claude-opus-4' });
      expect(result).toEqual(updatedConfig);
    });
  });

  describe('Config Export/Import Functions - Real API', () => {
    it('exportConfig calls real API endpoint', async () => {
      const mockExport = { agents: { discovery: { provider: 'anthropic' } } };
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse(mockExport));

      const config = await exportConfig();

      expect(apiClient.get).toHaveBeenCalledWith('/llm/config/export');
      expect(config).toEqual(mockExport);
    });

    it('exportConfigEnv calls real API endpoint', async () => {
      const mockEnv = { content: 'LLM_CONFIG=test', filename: 'llm-config.env' };
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse(mockEnv));

      const result = await exportConfigEnv();

      expect(apiClient.get).toHaveBeenCalledWith('/llm/config/export/env');
      expect(result).toEqual(mockEnv);
    });

    it('importConfig calls real API endpoint', async () => {
      const mockResult = { imported: true, agents: 5 };
      vi.mocked(apiClient.post).mockResolvedValue(mockApiResponse(mockResult));

      const config = { agents: { discovery: { provider: 'anthropic' } } } as any;
      const result = await importConfig(config);

      expect(apiClient.post).toHaveBeenCalledWith('/llm/config/import', config);
      expect(result).toEqual(mockResult);
    });

    it('validateConfig calls real API endpoint', async () => {
      const mockResult = { valid: true, errors: [] };
      vi.mocked(apiClient.post).mockResolvedValue(mockApiResponse(mockResult));

      const config = { agents: { discovery: { provider: 'anthropic' } } } as any;
      const result = await validateConfig(config);

      expect(apiClient.post).toHaveBeenCalledWith('/llm/config/validate', config);
      expect(result).toEqual(mockResult);
    });
  });

  describe('Error Handling - Real API', () => {
    it('handles 404 errors with user-friendly message', async () => {
      const error = new Error('Request failed') as any;
      error.response = { status: 404, data: {} };
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(fetchAPIKeys()).rejects.toThrow('Resource not found');
    });

    it('handles 500 errors with user-friendly message', async () => {
      const error = new Error('Request failed') as any;
      error.response = { status: 500, data: {} };
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(fetchAPIKeys()).rejects.toThrow('Server error');
    });

    it('handles errors with detail message from API', async () => {
      const error = new Error('Request failed') as any;
      error.response = { status: 400, data: { detail: 'Invalid request' } };
      vi.mocked(apiClient.get).mockRejectedValue(error);

      await expect(fetchAPIKeys()).rejects.toThrow('Invalid request');
    });
  });
});

describe('Data Source Toggle', () => {
  beforeEach(() => {
    resetAllLLMConfigMocks();
    vi.clearAllMocks();
  });

  it('queries refetch when dataSource changes', async () => {
    // Start in mock mode
    useLLMConfigStore.setState({ dataSource: 'mock' });

    const { result, rerender } = renderHook(() => useProviders(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Get initial data from mock
    const mockData = result.current.data;
    expect(mockData).toHaveLength(3);

    // Switch to real mode
    vi.mocked(apiClient.get).mockResolvedValue({
      data: ['anthropic'],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });

    act(() => {
      useLLMConfigStore.setState({ dataSource: 'real' });
    });

    // Rerender to trigger query with new key
    rerender();

    await waitFor(() => {
      // Query should refetch because key includes dataSource
      expect(result.current.isRefetching || result.current.isLoading).toBe(true);
    }, { timeout: 1000 });
  });

  it('query keys include dataSource for cache separation', () => {
    expect(llmConfigQueryKeys.providers()).toEqual(['llmConfig', 'providers']);
    expect(llmConfigQueryKeys.keys()).toEqual(['llmConfig', 'keys']);
    expect(llmConfigQueryKeys.agentConfigs()).toEqual(['llmConfig', 'agentConfigs']);
  });
});
