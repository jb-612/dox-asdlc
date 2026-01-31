/**
 * LLM Config Store (P05-F13)
 *
 * Zustand store for managing LLM admin configuration state.
 */

import { create } from 'zustand';
import type {
  LLMProvider,
  LLMProviderInfo,
  LLMModel,
  APIKey,
  AgentLLMConfig,
  AgentRole,
  AgentLLMSettings,
} from '../types/llmConfig';

// ============================================================================
// State Types
// ============================================================================

/** Data source type for API calls */
export type DataSource = 'mock' | 'real';

/**
 * Get initial data source from localStorage or default to 'mock'
 */
function getInitialDataSource(): DataSource {
  if (typeof window === 'undefined') return 'mock';
  const stored = localStorage.getItem('llm-data-source');
  return stored === 'real' ? 'real' : 'mock';
}

interface LLMConfigState {
  // Data state
  providers: LLMProviderInfo[];
  models: Record<LLMProvider, LLMModel[]>;
  apiKeys: APIKey[];
  agentConfigs: AgentLLMConfig[];

  // UI state
  selectedAgentRole: AgentRole | null;
  expandedAgentRole: AgentRole | null;
  isAddKeyDialogOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Data source toggle (mock vs real backend)
  dataSource: DataSource;

  // Unsaved changes tracking
  pendingChanges: Partial<Record<AgentRole, Partial<AgentLLMConfig>>>;
  hasUnsavedChanges: boolean;
}

interface LLMConfigActions {
  // Data setters
  setProviders: (providers: LLMProviderInfo[]) => void;
  setModels: (provider: LLMProvider, models: LLMModel[]) => void;
  setAPIKeys: (keys: APIKey[]) => void;
  setAgentConfigs: (configs: AgentLLMConfig[]) => void;

  // UI actions
  selectAgentRole: (role: AgentRole | null) => void;
  toggleAgentExpanded: (role: AgentRole) => void;
  setAddKeyDialogOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Data source toggle
  setDataSource: (source: DataSource) => void;

  // Config modification actions
  updateAgentConfigLocal: (role: AgentRole, updates: Partial<AgentLLMConfig>) => void;
  updateAgentSettings: (role: AgentRole, settings: Partial<AgentLLMSettings>) => void;
  clearPendingChanges: () => void;
  revertChanges: () => void;

  // Key actions
  addAPIKey: (key: APIKey) => void;
  removeAPIKey: (id: string) => void;
  updateAPIKeyStatus: (id: string, status: APIKey['status'], message?: string) => void;

  // Helpers
  getModelsForProvider: (provider: LLMProvider) => LLMModel[];
  getKeysForProvider: (provider: LLMProvider) => APIKey[];
  getConfigForRole: (role: AgentRole) => AgentLLMConfig | undefined;
  getPendingConfigForRole: (role: AgentRole) => AgentLLMConfig | undefined;

  // Reset
  reset: () => void;
}

type LLMConfigStore = LLMConfigState & LLMConfigActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: LLMConfigState = {
  providers: [],
  models: {
    anthropic: [],
    openai: [],
    google: [],
  },
  apiKeys: [],
  agentConfigs: [],
  selectedAgentRole: null,
  expandedAgentRole: null,
  isAddKeyDialogOpen: false,
  isLoading: false,
  error: null,
  dataSource: getInitialDataSource(),
  pendingChanges: {},
  hasUnsavedChanges: false,
};

// ============================================================================
// Store
// ============================================================================

export const useLLMConfigStore = create<LLMConfigStore>((set, get) => ({
  ...initialState,

  // Data setters
  setProviders: (providers) => set({ providers }),

  setModels: (provider, models) =>
    set((state) => ({
      models: {
        ...state.models,
        [provider]: models,
      },
    })),

  setAPIKeys: (apiKeys) => set({ apiKeys }),

  setAgentConfigs: (agentConfigs) => set({ agentConfigs }),

  // UI actions
  selectAgentRole: (role) => set({ selectedAgentRole: role }),

  toggleAgentExpanded: (role) =>
    set((state) => ({
      expandedAgentRole: state.expandedAgentRole === role ? null : role,
    })),

  setAddKeyDialogOpen: (open) => set({ isAddKeyDialogOpen: open }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  // Data source toggle
  setDataSource: (source) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('llm-data-source', source);
    }
    set({ dataSource: source });
  },

  // Config modification actions
  updateAgentConfigLocal: (role, updates) =>
    set((state) => {
      const existingChanges = state.pendingChanges[role] || {};
      const newChanges = {
        ...state.pendingChanges,
        [role]: {
          ...existingChanges,
          ...updates,
        },
      };
      return {
        pendingChanges: newChanges,
        hasUnsavedChanges: true,
      };
    }),

  updateAgentSettings: (role, settings) =>
    set((state) => {
      const existingChanges = state.pendingChanges[role] || {};
      const existingSettings = existingChanges.settings || {};
      const currentConfig = state.agentConfigs.find((c) => c.role === role);
      const baseSettings = currentConfig?.settings || {};

      const newChanges = {
        ...state.pendingChanges,
        [role]: {
          ...existingChanges,
          settings: {
            ...baseSettings,
            ...existingSettings,
            ...settings,
          },
        },
      };
      return {
        pendingChanges: newChanges,
        hasUnsavedChanges: true,
      };
    }),

  clearPendingChanges: () =>
    set({
      pendingChanges: {},
      hasUnsavedChanges: false,
    }),

  revertChanges: () =>
    set({
      pendingChanges: {},
      hasUnsavedChanges: false,
    }),

  // Key actions
  addAPIKey: (key) =>
    set((state) => ({
      apiKeys: [...state.apiKeys, key],
    })),

  removeAPIKey: (id) =>
    set((state) => ({
      apiKeys: state.apiKeys.filter((key) => key.id !== id),
    })),

  updateAPIKeyStatus: (id, status, message) =>
    set((state) => ({
      apiKeys: state.apiKeys.map((key) =>
        key.id === id
          ? {
              ...key,
              status,
              lastTestMessage: message || key.lastTestMessage,
            }
          : key
      ),
    })),

  // Helpers
  getModelsForProvider: (provider) => {
    const state = get();
    return state.models[provider] || [];
  },

  getKeysForProvider: (provider) => {
    const state = get();
    return state.apiKeys.filter((key) => key.provider === provider);
  },

  getConfigForRole: (role) => {
    const state = get();
    return state.agentConfigs.find((config) => config.role === role);
  },

  getPendingConfigForRole: (role) => {
    const state = get();
    const baseConfig = state.agentConfigs.find((config) => config.role === role);
    const pendingChanges = state.pendingChanges[role];

    if (!baseConfig) return undefined;
    if (!pendingChanges) return baseConfig;

    return {
      ...baseConfig,
      ...pendingChanges,
      settings: {
        ...baseConfig.settings,
        ...(pendingChanges.settings || {}),
      },
    };
  },

  // Reset
  reset: () => set(initialState),
}));

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select pending config for a role, merged with base config
 */
export function selectPendingConfig(
  state: LLMConfigState,
  role: AgentRole
): AgentLLMConfig | undefined {
  const baseConfig = state.agentConfigs.find((c) => c.role === role);
  const pending = state.pendingChanges[role];

  if (!baseConfig) return undefined;
  if (!pending) return baseConfig;

  return {
    ...baseConfig,
    ...pending,
    settings: {
      ...baseConfig.settings,
      ...(pending.settings || {}),
    },
  };
}

/**
 * Select all pending configs merged
 */
export function selectAllPendingConfigs(state: LLMConfigState): AgentLLMConfig[] {
  return state.agentConfigs.map((config) => {
    const pending = state.pendingChanges[config.role];
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
}

/**
 * Check if mocks should be used based on store data source
 */
export function shouldUseMocks(): boolean {
  const state = useLLMConfigStore.getState();
  return state.dataSource === 'mock';
}
