/**
 * AgentConfigSection Component (P05-F13 T10)
 *
 * Section displaying all agent configurations in a table.
 */

import { useCallback, Fragment } from 'react';
import clsx from 'clsx';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import AgentConfigRow from './AgentConfigRow';
import AdvancedSettingsPanel from './AdvancedSettingsPanel';
import type {
  AgentLLMConfig,
  AgentRole,
  LLMProvider,
  LLMModel,
  APIKey,
  AgentLLMSettings,
} from '../../types/llmConfig';
import Spinner from '../common/Spinner';
import { testLLMConnection } from '../../api/llmConfig';

export interface AgentConfigSectionProps {
  /** Agent configurations */
  configs: AgentLLMConfig[];
  /** Models keyed by provider */
  modelsByProvider: Record<LLMProvider, LLMModel[]>;
  /** Available API keys */
  apiKeys: APIKey[];
  /** Currently expanded agent role */
  expandedRole?: AgentRole | null;
  /** Roles with pending changes */
  changedRoles?: Set<AgentRole>;
  /** Whether configs are loading */
  isLoading?: boolean;
  /** Callback when provider changes */
  onProviderChange?: (role: AgentRole, provider: LLMProvider) => void;
  /** Callback when model changes */
  onModelChange?: (role: AgentRole, model: string) => void;
  /** Callback when API key changes */
  onApiKeyChange?: (role: AgentRole, keyId: string) => void;
  /** Callback when enabled state changes */
  onEnabledChange?: (role: AgentRole, enabled: boolean) => void;
  /** Callback when settings change */
  onSettingsChange?: (role: AgentRole, settings: Partial<AgentLLMSettings>) => void;
  /** Callback when expand toggle clicked */
  onToggleExpanded?: (role: AgentRole) => void;
  /** Callback when configs change from raw editor */
  onConfigsChange?: (configs: AgentLLMConfig[]) => void;
  /** Custom class name */
  className?: string;
}

export default function AgentConfigSection({
  configs,
  modelsByProvider,
  apiKeys,
  expandedRole,
  changedRoles = new Set(),
  isLoading = false,
  onProviderChange,
  onModelChange,
  onApiKeyChange,
  onEnabledChange,
  onSettingsChange,
  onToggleExpanded,
  onConfigsChange,
  className,
}: AgentConfigSectionProps) {
  const getModelForConfig = useCallback(
    (config: AgentLLMConfig): LLMModel | undefined => {
      const models = modelsByProvider[config.provider] || [];
      return models.find((m) => m.id === config.model);
    },
    [modelsByProvider]
  );

  const handleTestConnection = useCallback(
    async (role: AgentRole): Promise<{success: boolean; message: string}> => {
      return testLLMConnection(role);
    },
    []
  );

  if (isLoading) {
    return (
      <section
        data-testid="agent-config-section-loading"
        className={clsx('bg-bg-secondary rounded-lg border border-border-primary', className)}
      >
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-6 w-6" />
          <span className="ml-2 text-text-secondary">Loading agent configurations...</span>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="agent-config-section"
      className={clsx('bg-bg-secondary rounded-lg border border-border-primary', className)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-primary">
        <div className="p-2 rounded-lg bg-accent-blue/10">
          <UserGroupIcon className="h-5 w-5 text-accent-blue" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Agent Configurations</h2>
          <p className="text-sm text-text-secondary">
            Configure LLM settings for each agent role
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-primary bg-bg-tertiary/30">
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Agent Role
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted w-36">
                Provider
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted w-48">
                Model
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted w-40">
                API Key
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted w-20">
                Settings
              </th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => (
              <Fragment key={config.role}>
                <AgentConfigRow
                  config={config}
                  modelsByProvider={modelsByProvider}
                  apiKeys={apiKeys}
                  isExpanded={expandedRole === config.role}
                  hasChanges={changedRoles.has(config.role)}
                  onProviderChange={onProviderChange}
                  onModelChange={onModelChange}
                  onApiKeyChange={onApiKeyChange}
                  onEnabledChange={onEnabledChange}
                  onToggleExpanded={onToggleExpanded}
                />
                <AdvancedSettingsPanel
                  role={config.role}
                  settings={config.settings}
                  model={getModelForConfig(config)}
                  config={config}
                  allConfigs={configs}
                  isVisible={expandedRole === config.role}
                  apiKeyId={config.apiKeyId}
                  onChange={onSettingsChange}
                  onConfigChange={onConfigsChange}
                  onTestConnection={handleTestConnection}
                />
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {configs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <UserGroupIcon className="h-12 w-12 text-text-muted mb-3" />
          <p className="text-text-secondary">No agent configurations found</p>
        </div>
      )}
    </section>
  );
}
