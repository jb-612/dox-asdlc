import { create } from 'zustand';
import type {
  AppSettings,
  ProviderId,
  ProviderConfig,
} from '../../shared/types/settings';
import { DEFAULT_SETTINGS } from '../../shared/types/settings';

export interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  isDirty: boolean;

  loadSettings: (settings: AppSettings) => void;
  saveSettings: () => AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateProvider: (providerId: ProviderId, config: Partial<ProviderConfig>) => void;
  markClean: () => void;
  getConfiguredProviders: () => ProviderId[];
  getProviderConfig: (providerId: ProviderId) => ProviderConfig | undefined;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  isLoading: false,
  isDirty: false,

  loadSettings: (settings) =>
    set({ settings, isLoading: false, isDirty: false }),

  saveSettings: () => {
    const { settings } = get();
    set({ isDirty: false });
    return settings;
  },

  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
      isDirty: true,
    })),

  updateProvider: (providerId, config) =>
    set((state) => {
      const existing = state.settings.providers?.[providerId] ?? { id: providerId };
      return {
        settings: {
          ...state.settings,
          providers: {
            ...state.settings.providers,
            [providerId]: { ...existing, ...config },
          },
        },
        isDirty: true,
      };
    }),

  markClean: () => set({ isDirty: false }),

  getConfiguredProviders: () => {
    const providers = get().settings.providers;
    if (!providers) return [];
    return (Object.keys(providers) as ProviderId[]).filter(
      (id) => providers[id]?.hasKey,
    );
  },

  getProviderConfig: (providerId) => {
    return get().settings.providers?.[providerId];
  },
}));
