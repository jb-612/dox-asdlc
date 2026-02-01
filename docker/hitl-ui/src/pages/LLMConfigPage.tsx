/**
 * LLMConfigPage - LLM Admin Configuration Page (P05-F13 T11, T33)
 *
 * Full page for managing LLM providers, API keys, and agent configurations.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Cog6ToothIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { APIKeysSection, AgentConfigSection, DataSourceToggle, IntegrationCredentialsSection } from '../components/llm';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';

import {
  useProviders,
  useAllModels,
  useAPIKeys,
  useAgentConfigs,
  useAddAPIKey,
  useDeleteAPIKey,
  useTestAPIKey,
  useUpdateAgentConfig,
  llmConfigQueryKeys,
  useIntegrationCredentials,
  useAddIntegrationCredential,
  useDeleteIntegrationCredential,
  useTestIntegrationCredentialEnhanced,
  useSendTestMessage,
  integrationQueryKeys,
  useSecretsHealth,
  secretsQueryKeys,
} from '../api/llmConfig';
import { useLLMConfigStore, selectAllPendingConfigs } from '../stores/llmConfigStore';
import { useState } from 'react';
import type {
  LLMModel,
  LLMProvider,
  AgentRole,
  AddAPIKeyRequest,
  AgentLLMSettings,
  AddIntegrationCredentialRequest,
  SecretsEnvironment,
} from '../types/llmConfig';

export interface LLMConfigPageProps {
  /** Custom class name */
  className?: string;
}

export default function LLMConfigPage({ className }: LLMConfigPageProps) {
  const queryClient = useQueryClient();

  // Store state
  const {
    expandedAgentRole,
    pendingChanges,
    hasUnsavedChanges,
    dataSource,
    setProviders,
    setModels,
    setAPIKeys,
    setAgentConfigs,
    toggleAgentExpanded,
    updateAgentConfigLocal,
    updateAgentSettings,
    clearPendingChanges,
    revertChanges,
  } = useLLMConfigStore();

  // Data fetching
  const { data: providers, isLoading: providersLoading, error: providersError } = useProviders();
  const { data: allModels, isLoading: modelsLoading, error: modelsError } = useAllModels();
  const { data: apiKeys, isLoading: keysLoading, error: keysError } = useAPIKeys();
  const { data: agentConfigs, isLoading: configsLoading, error: configsError } = useAgentConfigs();
  const {
    data: integrationCredentials,
    isLoading: credentialsLoading,
    error: credentialsError,
  } = useIntegrationCredentials();

  // Secrets backend health (P09-F01 T08)
  const {
    data: secretsHealth,
    isLoading: secretsHealthLoading,
  } = useSecretsHealth();

  // Environment selector state (P09-F01 T10)
  const [selectedEnvironment, setSelectedEnvironment] = useState<SecretsEnvironment | 'all'>('all');

  // Mutations
  const addKeyMutation = useAddAPIKey();
  const deleteKeyMutation = useDeleteAPIKey();
  const testKeyMutation = useTestAPIKey();
  const updateConfigMutation = useUpdateAgentConfig();
  const addCredentialMutation = useAddIntegrationCredential();
  const deleteCredentialMutation = useDeleteIntegrationCredential();
  const testCredentialMutation = useTestIntegrationCredentialEnhanced();
  const sendTestMessageMutation = useSendTestMessage();

  // Sync fetched data to store
  useEffect(() => {
    if (providers) setProviders(providers);
  }, [providers, setProviders]);

  useEffect(() => {
    if (allModels) {
      // Group models by provider
      const byProvider: Record<LLMProvider, typeof allModels> = {
        anthropic: [],
        openai: [],
        google: [],
      };
      allModels.forEach((model) => {
        if (model && model.provider && byProvider[model.provider]) {
          byProvider[model.provider].push(model);
        }
      });
      Object.entries(byProvider).forEach(([provider, models]) => {
        setModels(provider as LLMProvider, models);
      });
    }
  }, [allModels, setModels]);

  useEffect(() => {
    if (apiKeys) setAPIKeys(apiKeys);
  }, [apiKeys, setAPIKeys]);

  useEffect(() => {
    if (agentConfigs) setAgentConfigs(agentConfigs);
  }, [agentConfigs, setAgentConfigs]);

  // Refetch data when data source changes
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: llmConfigQueryKeys.all });
  }, [dataSource, queryClient]);

  // Organize models by provider for components
  const modelsByProvider = useMemo(() => {
    const result: Record<LLMProvider, LLMModel[]> = {
      anthropic: [],
      openai: [],
      google: [],
    };
    if (allModels) {
      allModels.forEach((model) => {
        if (model && model.provider && result[model.provider]) {
          result[model.provider].push(model);
        }
      });
    }
    return result;
  }, [allModels]);

  // Merge pending changes with configs
  const displayConfigs = useMemo(() => {
    if (!agentConfigs) return [];
    return agentConfigs.map((config) => {
      const pending = pendingChanges[config.role];
      if (!pending) return config;
      return {
        ...config,
        ...pending,
        settings: {
          ...config.settings,
          ...(pending.settings || {}),
        },
      };
    });
  }, [agentConfigs, pendingChanges]);

  // Track which roles have changes
  const changedRoles = useMemo(
    () => new Set(Object.keys(pendingChanges) as AgentRole[]),
    [pendingChanges]
  );

  // Handlers
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: llmConfigQueryKeys.all });
    queryClient.invalidateQueries({ queryKey: integrationQueryKeys.all });
    queryClient.invalidateQueries({ queryKey: secretsQueryKeys.all });
  }, [queryClient]);

  const handleAddKey = useCallback(
    async (request: AddAPIKeyRequest) => {
      await addKeyMutation.mutateAsync(request);
    },
    [addKeyMutation]
  );

  const handleDeleteKey = useCallback(
    async (keyId: string) => {
      await deleteKeyMutation.mutateAsync(keyId);
    },
    [deleteKeyMutation]
  );

  const handleTestKey = useCallback(
    async (keyId: string) => {
      await testKeyMutation.mutateAsync(keyId);
    },
    [testKeyMutation]
  );

  const handleProviderChange = useCallback(
    (role: AgentRole, provider: LLMProvider) => {
      updateAgentConfigLocal(role, { provider });
    },
    [updateAgentConfigLocal]
  );

  const handleModelChange = useCallback(
    (role: AgentRole, model: string) => {
      updateAgentConfigLocal(role, { model });
    },
    [updateAgentConfigLocal]
  );

  const handleApiKeyChange = useCallback(
    (role: AgentRole, apiKeyId: string) => {
      updateAgentConfigLocal(role, { apiKeyId });
    },
    [updateAgentConfigLocal]
  );

  const handleEnabledChange = useCallback(
    (role: AgentRole, enabled: boolean) => {
      updateAgentConfigLocal(role, { enabled });
    },
    [updateAgentConfigLocal]
  );

  const handleSettingsChange = useCallback(
    (role: AgentRole, settings: Partial<AgentLLMSettings>) => {
      updateAgentSettings(role, settings);
    },
    [updateAgentSettings]
  );

  const handleSaveChanges = useCallback(async () => {
    // Save all pending changes
    const promises = Object.entries(pendingChanges).map(([role, changes]) =>
      updateConfigMutation.mutateAsync({ role: role as AgentRole, config: changes })
    );
    await Promise.all(promises);
    clearPendingChanges();
  }, [pendingChanges, updateConfigMutation, clearPendingChanges]);

  const handleResetChanges = useCallback(() => {
    revertChanges();
  }, [revertChanges]);

  const handleAddCredential = useCallback(
    async (request: AddIntegrationCredentialRequest) => {
      await addCredentialMutation.mutateAsync(request);
    },
    [addCredentialMutation]
  );

  const handleDeleteCredential = useCallback(
    async (credentialId: string) => {
      await deleteCredentialMutation.mutateAsync(credentialId);
    },
    [deleteCredentialMutation]
  );

  const handleTestCredential = useCallback(
    async (credentialId: string) => {
      // Use enhanced test that returns detailed results for Slack
      const result = await testCredentialMutation.mutateAsync(credentialId);
      return result;
    },
    [testCredentialMutation]
  );

  const handleSendTestMessage = useCallback(
    async (credentialId: string, channel: string) => {
      const result = await sendTestMessageMutation.mutateAsync({ credentialId, channel });
      return result;
    },
    [sendTestMessageMutation]
  );

  // Environment change handler (P09-F01 T10)
  const handleEnvironmentChange = useCallback((env: SecretsEnvironment | 'all') => {
    setSelectedEnvironment(env);
    // TODO: When backend supports environment filtering, refetch credentials with filter
  }, []);

  const isLoading = providersLoading || modelsLoading || keysLoading || configsLoading || credentialsLoading;
  const isSaving = updateConfigMutation.isPending;

  // Error state handling
  const hasError = providersError || modelsError || keysError || configsError || credentialsError;
  const errorMessage = (providersError as Error)?.message
    || (modelsError as Error)?.message
    || (keysError as Error)?.message
    || (configsError as Error)?.message
    || (credentialsError as Error)?.message;

  // Render error state
  if (hasError && !isLoading) {
    return (
      <div
        data-testid="llm-config-page"
        role="main"
        className={clsx('h-full flex flex-col bg-bg-primary', className)}
      >
        {/* Header */}
        <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-purple/10">
                <Cog6ToothIcon className="h-6 w-6 text-accent-purple" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">LLM Configuration</h1>
                <p className="text-sm text-text-secondary mt-1">
                  Manage API keys and agent model settings
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Data Source Toggle */}
              <DataSourceToggle />

              {/* Refresh Button */}
              <button
                data-testid="refresh-button"
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                aria-label="Refresh data"
              >
                <ArrowPathIcon className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
              </button>
            </div>
          </div>
        </header>

        {/* Error Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center" data-testid="error-state">
            <ExclamationTriangleIcon className="h-12 w-12 text-status-error mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Failed to load configuration
            </h2>
            <p className="text-text-secondary mb-4">
              {errorMessage || 'Unable to connect to the backend API'}
            </p>
            <Button onClick={handleRefresh} data-testid="try-again-button">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="llm-config-page"
      role="main"
      className={clsx('h-full flex flex-col bg-bg-primary', className)}
    >
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-purple/10">
              <Cog6ToothIcon className="h-6 w-6 text-accent-purple" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">LLM Configuration</h1>
              <p className="text-sm text-text-secondary mt-1">
                Manage API keys and agent model settings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Data Source Toggle */}
            <DataSourceToggle />

            {/* Refresh Button */}
            <button
              data-testid="refresh-button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              aria-label="Refresh data"
            >
              <ArrowPathIcon className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* API Keys Section */}
          <APIKeysSection
            keys={apiKeys || []}
            isLoading={keysLoading}
            providers={['anthropic', 'openai', 'google']}
            onAddKey={handleAddKey}
            onDeleteKey={handleDeleteKey}
            onTestKey={handleTestKey}
          />

          {/* Integration Credentials Section */}
          <IntegrationCredentialsSection
            credentials={integrationCredentials || []}
            isLoading={credentialsLoading}
            onAddCredential={handleAddCredential}
            onDeleteCredential={handleDeleteCredential}
            onTestCredential={handleTestCredential}
            onSendTestMessage={handleSendTestMessage}
            secretsHealth={secretsHealth}
            secretsHealthLoading={secretsHealthLoading}
            selectedEnvironment={selectedEnvironment}
            onEnvironmentChange={handleEnvironmentChange}
          />

          {/* Agent Configs Section */}
          <AgentConfigSection
            configs={displayConfigs}
            modelsByProvider={modelsByProvider}
            apiKeys={apiKeys || []}
            expandedRole={expandedAgentRole}
            changedRoles={changedRoles}
            isLoading={configsLoading}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
            onApiKeyChange={handleApiKeyChange}
            onEnabledChange={handleEnabledChange}
            onSettingsChange={handleSettingsChange}
            onToggleExpanded={toggleAgentExpanded}
          />
        </div>
      </div>

      {/* Footer with Save/Reset */}
      {hasUnsavedChanges && (
        <footer
          data-testid="unsaved-changes-footer"
          className="bg-bg-secondary border-t border-border-primary px-6 py-4"
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-status-warning">
              <span className="text-sm font-medium">You have unsaved changes</span>
              <span className="text-xs text-text-muted">
                ({changedRoles.size} agent{changedRoles.size !== 1 ? 's' : ''} modified)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                data-testid="reset-changes-button"
                variant="secondary"
                onClick={handleResetChanges}
                disabled={isSaving}
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button
                data-testid="save-changes-button"
                variant="primary"
                onClick={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
