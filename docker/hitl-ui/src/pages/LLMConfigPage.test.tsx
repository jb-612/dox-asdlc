/**
 * Tests for LLMConfigPage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LLMConfigPage from './LLMConfigPage';
import { useLLMConfigStore } from '../stores/llmConfigStore';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock the llm components
vi.mock('../components/llm', () => ({
  APIKeysSection: () => <div data-testid="api-keys-section">API Keys Section</div>,
  AgentConfigSection: () => <div data-testid="agent-config-section">Agent Config Section</div>,
  DataSourceToggle: () => <div data-testid="data-source-toggle">Data Source Toggle</div>,
  IntegrationCredentialsSection: () => <div data-testid="integration-credentials-section">Integration Credentials Section</div>,
}));

// Default mock data
const mockProviders = [
  { id: 'anthropic', name: 'Anthropic', description: 'Claude models', enabled: true },
  { id: 'openai', name: 'OpenAI', description: 'GPT models', enabled: true },
];

const mockModels = [
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', contextWindow: 200000, inputCost: 15, outputCost: 75 },
  { id: 'gpt-4', name: 'GPT-4', provider: 'openai', contextWindow: 128000, inputCost: 30, outputCost: 60 },
];

const mockAPIKeys = [
  { id: 'key-1', provider: 'anthropic', name: 'Production Key', maskedKey: 'sk-...abc', status: 'valid', lastUsed: '2024-01-15T10:00:00Z' },
];

const mockAgentConfigs = [
  { role: 'planner', provider: 'anthropic', model: 'claude-3-opus', apiKeyId: 'key-1', enabled: true, settings: { temperature: 0.7, maxTokens: 4096 } },
];

// Mock hooks state
let mockState = {
  providersError: null as Error | null,
  modelsError: null as Error | null,
  keysError: null as Error | null,
  configsError: null as Error | null,
  providersLoading: false,
  modelsLoading: false,
  keysLoading: false,
  configsLoading: false,
};

// Mock the API hooks
vi.mock('../api/llmConfig', () => ({
  useProviders: () => ({
    data: mockState.providersError ? undefined : mockProviders,
    isLoading: mockState.providersLoading,
    error: mockState.providersError,
  }),
  useAllModels: () => ({
    data: mockState.modelsError ? undefined : mockModels,
    isLoading: mockState.modelsLoading,
    error: mockState.modelsError,
  }),
  useAPIKeys: () => ({
    data: mockState.keysError ? undefined : mockAPIKeys,
    isLoading: mockState.keysLoading,
    error: mockState.keysError,
  }),
  useAgentConfigs: () => ({
    data: mockState.configsError ? undefined : mockAgentConfigs,
    isLoading: mockState.configsLoading,
    error: mockState.configsError,
  }),
  useIntegrationCredentials: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useAddAPIKey: () => ({ mutateAsync: vi.fn() }),
  useDeleteAPIKey: () => ({ mutateAsync: vi.fn() }),
  useTestAPIKey: () => ({ mutateAsync: vi.fn() }),
  useUpdateAgentConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddIntegrationCredential: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIntegrationCredential: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTestIntegrationCredentialEnhanced: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendTestMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSecretsHealth: () => ({
    data: { status: 'healthy', backend: 'env', details: { source: 'environment variables' } },
    isLoading: false,
    error: null,
  }),
  llmConfigQueryKeys: {
    all: ['llmConfig'],
    providers: () => ['llmConfig', 'providers'],
    models: () => ['llmConfig', 'models'],
    allModels: () => ['llmConfig', 'allModels'],
    keys: () => ['llmConfig', 'keys'],
    agentConfigs: () => ['llmConfig', 'agentConfigs'],
  },
  integrationQueryKeys: {
    all: ['integrations'],
    credentials: () => ['integrations', 'credentials'],
    credentialsByType: (type: string) => ['integrations', 'credentials', type],
  },
  secretsQueryKeys: {
    all: ['secrets'],
    health: () => ['secrets', 'health'],
  },
}));

describe('LLMConfigPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    // Reset mock state to default (successful loading)
    mockState = {
      providersError: null,
      modelsError: null,
      keysError: null,
      configsError: null,
      providersLoading: false,
      modelsLoading: false,
      keysLoading: false,
      configsLoading: false,
    };
    vi.clearAllMocks();
  });

  const renderWithProviders = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <LLMConfigPage />
      </QueryClientProvider>
    );
  };

  describe('Page Structure', () => {
    it('renders with data-testid', () => {
      renderWithProviders();
      expect(screen.getByTestId('llm-config-page')).toBeInTheDocument();
    });

    it('renders page title', () => {
      renderWithProviders();
      expect(screen.getByText('LLM Configuration')).toBeInTheDocument();
    });

    it('renders page subtitle', () => {
      renderWithProviders();
      expect(screen.getByText('Manage API keys and agent model settings')).toBeInTheDocument();
    });

    it('has role="main" for accessibility', () => {
      renderWithProviders();
      expect(screen.getByTestId('llm-config-page')).toHaveAttribute('role', 'main');
    });

    it('renders refresh button', () => {
      renderWithProviders();
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('renders data source toggle', () => {
      renderWithProviders();
      expect(screen.getByTestId('data-source-toggle')).toBeInTheDocument();
    });
  });

  describe('Content Sections', () => {
    it('renders API keys section when data loads successfully', () => {
      renderWithProviders();
      expect(screen.getByTestId('api-keys-section')).toBeInTheDocument();
    });

    it('renders agent config section when data loads successfully', () => {
      renderWithProviders();
      expect(screen.getByTestId('agent-config-section')).toBeInTheDocument();
    });
  });

  describe('Refresh Button', () => {
    it('has aria-label for accessibility', () => {
      renderWithProviders();
      const refreshBtn = screen.getByTestId('refresh-button');
      expect(refreshBtn).toHaveAttribute('aria-label', 'Refresh data');
    });
  });

  describe('Error States', () => {
    it('displays error state when providers fetch fails', async () => {
      mockState.providersError = new Error('Failed to fetch LLM providers');

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('Failed to load configuration')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch LLM providers')).toBeInTheDocument();
    });

    it('displays error state when API keys fetch fails', async () => {
      mockState.keysError = new Error('Failed to fetch API keys');

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('Failed to fetch API keys')).toBeInTheDocument();
    });

    it('displays error state when models fetch fails', async () => {
      mockState.modelsError = new Error('Failed to fetch models');

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('Failed to fetch models')).toBeInTheDocument();
    });

    it('displays error state when agent configs fetch fails', async () => {
      mockState.configsError = new Error('Failed to fetch agent configurations');

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('Failed to fetch agent configurations')).toBeInTheDocument();
    });

    it('renders Try Again button in error state', async () => {
      mockState.configsError = new Error('Connection failed');

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('try-again-button')).toBeInTheDocument();
      });
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('still shows header with data source toggle in error state', async () => {
      mockState.providersError = new Error('Connection failed');

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByTestId('data-source-toggle')).toBeInTheDocument();
      expect(screen.getByText('LLM Configuration')).toBeInTheDocument();
    });

    it('displays default error message when error has no message', async () => {
      // Create an error without a message
      mockState.providersError = new Error('');

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('Unable to connect to the backend API')).toBeInTheDocument();
    });

    it('does not show error state while loading', () => {
      mockState.providersLoading = true;
      mockState.providersError = new Error('Some error');

      renderWithProviders();

      // Should not show error state while loading
      expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
    });
  });
});
