import { useState, useCallback } from 'react';
import type { ProviderId, ProviderConfig, ProviderModelParams } from '../../../shared/types/settings';
import { PROVIDER_MODELS } from '../../../shared/types/settings';
import ModelParamsForm from './ModelParamsForm';

// ---------------------------------------------------------------------------
// Provider display metadata
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google AI',
  azure: 'Azure OpenAI',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProviderCardProps {
  provider: ProviderId;
  config: ProviderConfig;
  hasKey: boolean;
  encryptionAvailable: boolean;
  onChange: (config: ProviderConfig) => void;
  onSaveKey: (key: string) => void;
  onDeleteKey: () => void;
  onTest: () => void;
  testResult?: { ok: boolean; latencyMs?: number; error?: string } | null;
  testLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProviderCard({
  provider,
  config,
  hasKey,
  encryptionAvailable: _enc,
  onChange,
  onSaveKey,
  onDeleteKey,
  onTest,
  testResult,
  testLoading,
}: ProviderCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  const models = PROVIDER_MODELS[provider];
  const isAzure = provider === 'azure';
  const selectedModel = config.defaultModel ?? (models[0] || '');
  const modelParams = config.modelParams ?? { temperature: 0.7, maxTokens: 4096 };

  const canTest = hasKey && (!isAzure || !!config.azureEndpoint);

  const handleSaveKey = useCallback(() => {
    if (keyInput.trim()) {
      onSaveKey(keyInput.trim());
      setKeyInput('');
    }
  }, [keyInput, onSaveKey]);

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      onChange({ ...config, defaultModel: e.target.value });
    },
    [config, onChange],
  );

  const handleParamsChange = useCallback(
    (params: ProviderModelParams) => {
      onChange({ ...config, modelParams: params });
    },
    [config, onChange],
  );

  const handleAzureEndpoint = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, azureEndpoint: e.target.value });
    },
    [config, onChange],
  );

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Header (clickable to expand/collapse) */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-100">{PROVIDER_LABELS[provider]}</span>
          {/* Key status badge */}
          {hasKey ? (
            <span className="text-[10px] bg-green-900/50 text-green-400 rounded-full px-2 py-0.5">
              Key stored
            </span>
          ) : (
            <span className="text-[10px] bg-gray-700 text-gray-500 rounded-full px-2 py-0.5">
              No key
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 py-4 bg-gray-850 space-y-4">
          {/* Azure-specific: Endpoint URL */}
          {isAzure && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Endpoint URL</label>
              <input
                type="url"
                value={config.azureEndpoint ?? ''}
                onChange={handleAzureEndpoint}
                placeholder="https://my-resource.openai.azure.com"
                className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded px-3 py-1.5 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
              />
            </div>
          )}

          {/* API Key section */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={hasKey ? '••••••••••••••••' : 'Enter API key'}
                className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded px-3 py-1.5 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveKey();
                }}
              />
              <button
                type="button"
                onClick={handleSaveKey}
                disabled={!keyInput.trim()}
                className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 transition-colors"
              >
                Save Key
              </button>
              {hasKey && (
                <button
                  type="button"
                  onClick={onDeleteKey}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-red-900/50 text-red-400 hover:bg-red-900/70 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Model selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              {isAzure ? 'Deployment Name' : 'Default Model'}
            </label>
            {isAzure ? (
              <input
                type="text"
                value={config.azureDeployment ?? ''}
                onChange={(e) => onChange({ ...config, azureDeployment: e.target.value })}
                placeholder="my-gpt-4o-deployment"
                className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded px-3 py-1.5 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
              />
            ) : (
              <select
                value={selectedModel}
                onChange={handleModelChange}
                className="text-sm bg-gray-900 text-gray-200 border border-gray-600 rounded px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Model parameters */}
          <ModelParamsForm
            params={modelParams}
            selectedModel={isAzure ? (config.azureDeployment ?? '') : selectedModel}
            onChange={handleParamsChange}
          />

          {/* Test Connection */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-700">
            <button
              type="button"
              onClick={onTest}
              disabled={!canTest || testLoading}
              className="px-3 py-1.5 text-xs font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 transition-colors"
            >
              {testLoading ? 'Testing...' : 'Test Connection'}
            </button>

            {/* Test result badge */}
            {testResult && !testLoading && (
              <span
                className={`text-xs ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}
              >
                {testResult.ok
                  ? `Connected (${testResult.latencyMs}ms)`
                  : testResult.error ?? 'Connection failed'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
