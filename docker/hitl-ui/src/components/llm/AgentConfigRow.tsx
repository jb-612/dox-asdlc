/**
 * AgentConfigRow Component (P05-F13 T08)
 *
 * Row displaying agent role config with provider/model dropdowns.
 * Uses dynamic model fetching based on selected API key.
 */

import { useCallback, useMemo } from 'react';
import clsx from 'clsx';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type {
  AgentLLMConfig,
  AgentRole,
  LLMProvider,
  LLMModel,
  APIKey,
} from '../../types/llmConfig';
import { AGENT_ROLE_NAMES, AGENT_ROLE_DESCRIPTIONS, PROVIDER_NAMES } from '../../types/llmConfig';
import { useKeyModels } from '../../api/llmConfig';
import Spinner from '../common/Spinner';

export interface AgentConfigRowProps {
  /** Agent configuration */
  config: AgentLLMConfig;
  /** Available models keyed by provider */
  modelsByProvider: Record<LLMProvider, LLMModel[]>;
  /** Available API keys */
  apiKeys: APIKey[];
  /** Whether this row is expanded */
  isExpanded?: boolean;
  /** Whether config has unsaved changes */
  hasChanges?: boolean;
  /** Callback when provider changes */
  onProviderChange?: (role: AgentRole, provider: LLMProvider) => void;
  /** Callback when model changes */
  onModelChange?: (role: AgentRole, model: string) => void;
  /** Callback when API key changes */
  onApiKeyChange?: (role: AgentRole, keyId: string) => void;
  /** Callback when enabled state changes */
  onEnabledChange?: (role: AgentRole, enabled: boolean) => void;
  /** Callback when settings button clicked */
  onToggleExpanded?: (role: AgentRole) => void;
  /** Custom class name */
  className?: string;
}

const PROVIDERS: LLMProvider[] = ['anthropic', 'openai', 'google'];

export default function AgentConfigRow({
  config,
  modelsByProvider,
  apiKeys,
  isExpanded = false,
  hasChanges = false,
  onProviderChange,
  onModelChange,
  onApiKeyChange,
  onEnabledChange,
  onToggleExpanded,
  className,
}: AgentConfigRowProps) {
  const { role, provider, model, apiKeyId, enabled } = config;

  // Fetch models dynamically based on selected API key
  const { data: keyModels, isLoading: modelsLoading } = useKeyModels(apiKeyId || null);

  // Use keyModels if available, otherwise fall back to static models
  const availableModels = useMemo(() => {
    if (apiKeyId && keyModels?.length) {
      return keyModels;
    }
    return modelsByProvider[provider] || [];
  }, [apiKeyId, keyModels, modelsByProvider, provider]);

  // Get keys for current provider
  const availableKeys = useMemo(
    () => apiKeys.filter((key) => key.provider === provider),
    [apiKeys, provider]
  );

  // Get current model name
  const currentModelName = useMemo(() => {
    const m = availableModels.find((m) => m.id === model);
    return m?.name || model;
  }, [availableModels, model]);

  // Get current key name
  const currentKeyName = useMemo(() => {
    const k = apiKeys.find((k) => k.id === apiKeyId);
    return k?.name || 'No key selected';
  }, [apiKeys, apiKeyId]);

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newProvider = e.target.value as LLMProvider;
      onProviderChange?.(role, newProvider);
      // Reset model to first available for new provider
      const newModels = modelsByProvider[newProvider] || [];
      if (newModels.length > 0) {
        onModelChange?.(role, newModels[0].id);
      }
      // Reset API key to first available for new provider
      const newKeys = apiKeys.filter((k) => k.provider === newProvider);
      if (newKeys.length > 0) {
        onApiKeyChange?.(role, newKeys[0].id);
      }
    },
    [role, modelsByProvider, apiKeys, onProviderChange, onModelChange, onApiKeyChange]
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onModelChange?.(role, e.target.value);
    },
    [role, onModelChange]
  );

  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onApiKeyChange?.(role, e.target.value);
    },
    [role, onApiKeyChange]
  );

  const handleEnabledToggle = useCallback(() => {
    onEnabledChange?.(role, !enabled);
  }, [role, enabled, onEnabledChange]);

  const handleSettingsClick = useCallback(() => {
    onToggleExpanded?.(role);
  }, [role, onToggleExpanded]);

  return (
    <tr
      data-testid={'agent-config-row-' + role}
      className={clsx(
        'border-b border-border-subtle transition-colors',
        enabled ? 'hover:bg-bg-tertiary/50' : 'opacity-60 bg-bg-tertiary/30',
        hasChanges && 'bg-status-warning/5',
        className
      )}
    >
      {/* Role Name & Description */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <button
            data-testid={'toggle-enabled-' + role}
            onClick={handleEnabledToggle}
            className={clsx(
              'p-1 rounded transition-colors',
              enabled
                ? 'text-status-success hover:bg-status-success/10'
                : 'text-text-muted hover:bg-bg-tertiary'
            )}
            title={enabled ? 'Disable agent' : 'Enable agent'}
          >
            {enabled ? (
              <CheckIcon className="h-5 w-5" />
            ) : (
              <XMarkIcon className="h-5 w-5" />
            )}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-primary">
                {AGENT_ROLE_NAMES[role]}
              </span>
              {hasChanges && (
                <span className="text-xs text-status-warning">Modified</span>
              )}
            </div>
            <span className="text-xs text-text-muted">
              {AGENT_ROLE_DESCRIPTIONS[role]}
            </span>
          </div>
        </div>
      </td>

      {/* Provider Select */}
      <td className="py-3 px-4">
        <select
          data-testid={'provider-select-' + role}
          value={provider}
          onChange={handleProviderChange}
          disabled={!enabled}
          className={clsx(
            'w-full px-2 py-1.5 rounded text-sm',
            'bg-bg-primary border border-border-primary',
            'text-text-primary',
            'focus:outline-none focus:ring-1 focus:ring-accent-teal',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_NAMES[p]}
            </option>
          ))}
        </select>
      </td>

      {/* Model Select */}
      <td className="py-3 px-4">
        <div className="relative">
          <select
            data-testid={'model-select-' + role}
            value={model}
            onChange={handleModelChange}
            disabled={!enabled || availableModels.length === 0 || modelsLoading}
            className={clsx(
              'w-full px-2 py-1.5 rounded text-sm',
              'bg-bg-primary border border-border-primary',
              'text-text-primary',
              'focus:outline-none focus:ring-1 focus:ring-accent-teal',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              modelsLoading && 'pr-8'
            )}
          >
            {modelsLoading ? (
              <option value="">Loading models...</option>
            ) : availableModels.length === 0 ? (
              <option value="">No models available</option>
            ) : (
              availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))
            )}
          </select>
          {modelsLoading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Spinner size="sm" className="h-4 w-4" />
            </div>
          )}
        </div>
      </td>

      {/* API Key Select */}
      <td className="py-3 px-4">
        <select
          data-testid={'api-key-select-' + role}
          value={apiKeyId}
          onChange={handleApiKeyChange}
          disabled={!enabled || availableKeys.length === 0}
          className={clsx(
            'w-full px-2 py-1.5 rounded text-sm',
            'bg-bg-primary border border-border-primary',
            'text-text-primary',
            'focus:outline-none focus:ring-1 focus:ring-accent-teal',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            availableKeys.length === 0 && 'text-status-warning'
          )}
        >
          {availableKeys.length === 0 ? (
            <option value="">No keys for provider</option>
          ) : (
            availableKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))
          )}
        </select>
      </td>

      {/* Settings Button */}
      <td className="py-3 px-4">
        <button
          data-testid={'settings-button-' + role}
          onClick={handleSettingsClick}
          disabled={!enabled}
          className={clsx(
            'flex items-center gap-1 px-2 py-1 rounded text-sm',
            'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary',
            'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Cog6ToothIcon className="h-4 w-4" />
          {isExpanded ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronRightIcon className="h-3 w-3" />
          )}
        </button>
      </td>
    </tr>
  );
}
