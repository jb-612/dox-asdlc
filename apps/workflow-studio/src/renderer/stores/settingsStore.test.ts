import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { DEFAULT_SETTINGS } from '../../shared/types/settings';

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS },
      isLoading: false,
      isDirty: false,
    });
  });

  it('starts with default settings', () => {
    const state = useSettingsStore.getState();
    expect(state.settings.autoSaveIntervalSeconds).toBe(30);
    expect(state.isDirty).toBe(false);
  });

  it('loadSettings replaces settings and clears dirty', () => {
    useSettingsStore.getState().loadSettings({
      ...DEFAULT_SETTINGS,
      workflowDirectory: '/tmp/workflows',
    });
    const state = useSettingsStore.getState();
    expect(state.settings.workflowDirectory).toBe('/tmp/workflows');
    expect(state.isDirty).toBe(false);
  });

  it('updateSettings merges partial update and marks dirty', () => {
    useSettingsStore.getState().updateSettings({ redisUrl: 'redis://other:6379' });
    const state = useSettingsStore.getState();
    expect(state.settings.redisUrl).toBe('redis://other:6379');
    expect(state.isDirty).toBe(true);
  });

  it('updateProvider creates or merges provider config', () => {
    useSettingsStore
      .getState()
      .updateProvider('anthropic', { defaultModel: 'claude-3', hasKey: true });

    const config = useSettingsStore.getState().settings.providers?.anthropic;
    expect(config?.defaultModel).toBe('claude-3');
    expect(config?.hasKey).toBe(true);

    // Merge additional field
    useSettingsStore
      .getState()
      .updateProvider('anthropic', { enabled: true });

    const updated = useSettingsStore.getState().settings.providers?.anthropic;
    expect(updated?.defaultModel).toBe('claude-3');
    expect(updated?.enabled).toBe(true);
  });

  it('saveSettings returns current settings and clears dirty', () => {
    useSettingsStore.getState().updateSettings({ workflowDirectory: '/tmp' });
    expect(useSettingsStore.getState().isDirty).toBe(true);

    const saved = useSettingsStore.getState().saveSettings();
    expect(saved.workflowDirectory).toBe('/tmp');
    expect(useSettingsStore.getState().isDirty).toBe(false);
  });

  it('getConfiguredProviders returns providers with keys', () => {
    useSettingsStore
      .getState()
      .updateProvider('anthropic', { hasKey: true });
    useSettingsStore
      .getState()
      .updateProvider('openai', { hasKey: false });

    const configured = useSettingsStore.getState().getConfiguredProviders();
    expect(configured).toEqual(['anthropic']);
  });

  it('getProviderConfig returns specific provider', () => {
    useSettingsStore
      .getState()
      .updateProvider('google', { defaultModel: 'gemini-pro' });

    const config = useSettingsStore.getState().getProviderConfig('google');
    expect(config?.defaultModel).toBe('gemini-pro');
  });

  it('markClean clears dirty flag', () => {
    useSettingsStore.getState().updateSettings({ redisUrl: 'x' });
    expect(useSettingsStore.getState().isDirty).toBe(true);

    useSettingsStore.getState().markClean();
    expect(useSettingsStore.getState().isDirty).toBe(false);
  });
});
