/**
 * AdvancedSettingsPanel Component (P05-F13 T09, T32)
 *
 * Collapsible panel for advanced LLM settings (temperature, max tokens, etc.).
 * Now includes tabs for Parameters vs Raw Config.
 * Includes Test Connection button to verify LLM connectivity.
 */

import { useState, useCallback } from 'react';
import clsx from 'clsx';
import type { AgentLLMSettings, AgentRole, LLMModel, AgentLLMConfig } from '../../types/llmConfig';
import { TEMPERATURE_PRESETS, MAX_TOKENS_PRESETS } from '../../types/llmConfig';
import RawConfigEditor from './RawConfigEditor';
import EnvExportDialog from './EnvExportDialog';
import Spinner from '../common/Spinner';
import {
  ArrowDownTrayIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

export interface AdvancedSettingsPanelProps {
  /** Agent role this panel is for */
  role: AgentRole;
  /** Current settings */
  settings: AgentLLMSettings;
  /** Selected model (for max token limits) */
  model?: LLMModel;
  /** Full agent config (for raw editor) */
  config?: AgentLLMConfig;
  /** All agent configs (for raw editor) */
  allConfigs?: AgentLLMConfig[];
  /** Whether panel is visible */
  isVisible?: boolean;
  /** The API key ID for testing connection */
  apiKeyId?: string;
  /** Callback when settings change */
  onChange?: (role: AgentRole, settings: Partial<AgentLLMSettings>) => void;
  /** Callback when config changes from raw editor */
  onConfigChange?: (configs: AgentLLMConfig[]) => void;
  /** Callback to test LLM connection */
  onTestConnection?: (role: AgentRole) => Promise<{success: boolean; message: string}>;
  /** Custom class name */
  className?: string;
}

type TabValue = 'parameters' | 'raw';

export default function AdvancedSettingsPanel({
  role,
  settings,
  model,
  config,
  allConfigs,
  isVisible = true,
  apiKeyId,
  onChange,
  onConfigChange,
  onTestConnection,
  className,
}: AdvancedSettingsPanelProps) {
  const { temperature, maxTokens, topP, topK } = settings;
  const [activeTab, setActiveTab] = useState<TabValue>('parameters');
  const [envExportOpen, setEnvExportOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  const maxOutputTokens = model?.maxOutputTokens || 32768;

  const handleTemperatureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value >= 0 && value <= 1) {
        onChange?.(role, { temperature: value });
      }
    },
    [role, onChange]
  );

  const handleTemperaturePreset = useCallback(
    (value: number) => {
      onChange?.(role, { temperature: value });
    },
    [role, onChange]
  );

  const handleMaxTokensChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1 && value <= maxOutputTokens) {
        onChange?.(role, { maxTokens: value });
      }
    },
    [role, maxOutputTokens, onChange]
  );

  const handleMaxTokensPreset = useCallback(
    (value: number) => {
      const clamped = Math.min(value, maxOutputTokens);
      onChange?.(role, { maxTokens: clamped });
    },
    [role, maxOutputTokens, onChange]
  );

  const handleTopPChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value >= 0 && value <= 1) {
        onChange?.(role, { topP: value });
      }
    },
    [role, onChange]
  );

  const handleTopKChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 0) {
        onChange?.(role, { topK: value });
      }
    },
    [role, onChange]
  );

  const handleOpenEnvExport = useCallback(() => {
    setEnvExportOpen(true);
  }, []);

  const handleCloseEnvExport = useCallback(() => {
    setEnvExportOpen(false);
  }, []);

  const handleTestConnection = useCallback(async () => {
    if (!onTestConnection) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTestConnection(role);
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  }, [role, onTestConnection]);

  if (!isVisible) return null;

  return (
    <tr data-testid={'advanced-settings-' + role}>
      <td colSpan={5} className={clsx('p-0', className)}>
        <div className="bg-bg-tertiary/50 border-t border-border-subtle px-6 py-4">
          {/* Tabs */}
          <div className="flex border-b border-border-subtle mb-4">
            <button
              data-testid="tab-parameters"
              type="button"
              onClick={() => setActiveTab('parameters')}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'parameters'
                  ? 'border-accent-teal text-accent-teal'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              Parameters
            </button>
            <button
              data-testid="tab-raw-config"
              type="button"
              onClick={() => setActiveTab('raw')}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'raw'
                  ? 'border-accent-teal text-accent-teal'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              Raw Config
            </button>
          </div>

          {/* Parameters Tab Content */}
          {activeTab === 'parameters' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Temperature
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        data-testid={'temperature-slider-' + role}
                        min="0"
                        max="1"
                        step="0.1"
                        value={temperature}
                        onChange={handleTemperatureChange}
                        className="flex-1 h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-accent-teal"
                      />
                      <input
                        type="number"
                        data-testid={'temperature-input-' + role}
                        min="0"
                        max="1"
                        step="0.1"
                        value={temperature}
                        onChange={handleTemperatureChange}
                        className="w-16 px-2 py-1 text-sm rounded bg-bg-primary border border-border-primary text-text-primary text-center"
                      />
                    </div>
                    <div className="flex gap-2">
                      {TEMPERATURE_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          data-testid={'temp-preset-' + preset.value}
                          onClick={() => handleTemperaturePreset(preset.value)}
                          className={clsx(
                            'px-2 py-0.5 rounded text-xs transition-colors',
                            temperature === preset.value
                              ? 'bg-accent-teal text-white'
                              : 'bg-bg-primary text-text-secondary hover:bg-bg-tertiary'
                          )}
                          title={preset.description}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Max Tokens
                    <span className="text-text-muted ml-1">(max: {maxOutputTokens.toLocaleString()})</span>
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        data-testid={'max-tokens-slider-' + role}
                        min="1024"
                        max={maxOutputTokens}
                        step="1024"
                        value={maxTokens}
                        onChange={handleMaxTokensChange}
                        className="flex-1 h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-accent-teal"
                      />
                      <input
                        type="number"
                        data-testid={'max-tokens-input-' + role}
                        min="1024"
                        max={maxOutputTokens}
                        value={maxTokens}
                        onChange={handleMaxTokensChange}
                        className="w-20 px-2 py-1 text-sm rounded bg-bg-primary border border-border-primary text-text-primary text-center"
                      />
                    </div>
                    <div className="flex gap-2">
                      {MAX_TOKENS_PRESETS.filter((p) => p.value <= maxOutputTokens).map((preset) => (
                        <button
                          key={preset.value}
                          data-testid={'tokens-preset-' + preset.value}
                          onClick={() => handleMaxTokensPreset(preset.value)}
                          className={clsx(
                            'px-2 py-0.5 rounded text-xs transition-colors',
                            maxTokens === preset.value
                              ? 'bg-accent-teal text-white'
                              : 'bg-bg-primary text-text-secondary hover:bg-bg-tertiary'
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Top P */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Top P (Nucleus Sampling)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      data-testid={'top-p-slider-' + role}
                      min="0"
                      max="1"
                      step="0.05"
                      value={topP || 1}
                      onChange={handleTopPChange}
                      className="flex-1 h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-accent-teal"
                    />
                    <input
                      type="number"
                      data-testid={'top-p-input-' + role}
                      min="0"
                      max="1"
                      step="0.05"
                      value={topP || 1}
                      onChange={handleTopPChange}
                      className="w-16 px-2 py-1 text-sm rounded bg-bg-primary border border-border-primary text-text-primary text-center"
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    Controls diversity. Lower values make output more focused.
                  </p>
                </div>

                {/* Top K (optional) */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Top K (Optional)
                  </label>
                  <input
                    type="number"
                    data-testid={'top-k-input-' + role}
                    min="0"
                    max="100"
                    value={topK || ''}
                    onChange={handleTopKChange}
                    placeholder="Not set"
                    className="w-24 px-2 py-1 text-sm rounded bg-bg-primary border border-border-primary text-text-primary"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Limits vocabulary to top K tokens. Leave empty for default.
                  </p>
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <button
                  data-testid={'test-connection-' + role}
                  onClick={handleTestConnection}
                  disabled={!apiKeyId || isTesting}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                    'bg-accent-blue text-white',
                    'hover:bg-accent-blue/90',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors'
                  )}
                >
                  {isTesting ? (
                    <>
                      <Spinner size="sm" className="h-4 w-4" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </button>
                {testResult && (
                  <div className={clsx(
                    'mt-2 p-2 rounded text-sm',
                    testResult.success ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'
                  )}>
                    {testResult.message}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Raw Config Tab Content */}
          {activeTab === 'raw' && allConfigs && (
            <div className="space-y-4">
              <RawConfigEditor
                configs={allConfigs}
                onChange={onConfigChange}
              />
              <div className="flex justify-end">
                <button
                  data-testid="export-env-button"
                  type="button"
                  onClick={handleOpenEnvExport}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                    'border border-border-primary',
                    'bg-bg-primary text-text-primary',
                    'hover:bg-bg-tertiary transition-colors'
                  )}
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Export to .env
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Env Export Dialog */}
        {allConfigs && (
          <EnvExportDialog
            open={envExportOpen}
            onClose={handleCloseEnvExport}
            configs={allConfigs}
          />
        )}
      </td>
    </tr>
  );
}
