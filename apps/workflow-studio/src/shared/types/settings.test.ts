import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  PROVIDER_MODELS,
  MODEL_CONTEXT_WINDOW,
} from './settings';
import type { ProviderId, ProviderConfig, AppSettings } from './settings';

describe('settings types (T01)', () => {
  it('DEFAULT_SETTINGS has all required fields', () => {
    expect(DEFAULT_SETTINGS.workflowDirectory).toBeDefined();
    expect(DEFAULT_SETTINGS.templateDirectory).toBeDefined();
    expect(DEFAULT_SETTINGS.autoSaveIntervalSeconds).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SETTINGS.redisUrl).toContain('redis://');
    expect(DEFAULT_SETTINGS.executionMockMode).toBe(false);
    expect(DEFAULT_SETTINGS.dockerSocketPath).toBe('/var/run/docker.sock');
    expect(DEFAULT_SETTINGS.agentTimeoutSeconds).toBe(300);
    expect(DEFAULT_SETTINGS.workspaceDirectory).toBe('');
    expect(DEFAULT_SETTINGS.defaultRepoMountPath).toBe('');
  });

  it('DEFAULT_SETTINGS has provider configs for all 4 providers', () => {
    const providers = DEFAULT_SETTINGS.providers!;
    expect(providers.anthropic).toBeDefined();
    expect(providers.openai).toBeDefined();
    expect(providers.google).toBeDefined();
    expect(providers.azure).toBeDefined();

    expect(providers.anthropic!.id).toBe('anthropic');
    expect(providers.anthropic!.defaultModel).toBe('claude-sonnet-4-6');
    expect(providers.anthropic!.modelParams?.temperature).toBe(0.7);
    expect(providers.anthropic!.modelParams?.maxTokens).toBe(4096);
  });

  it('PROVIDER_MODELS lists models for non-Azure providers', () => {
    expect(PROVIDER_MODELS.anthropic.length).toBeGreaterThan(0);
    expect(PROVIDER_MODELS.openai.length).toBeGreaterThan(0);
    expect(PROVIDER_MODELS.google.length).toBeGreaterThan(0);
    expect(PROVIDER_MODELS.azure).toEqual([]);
  });

  it('MODEL_CONTEXT_WINDOW has entries for all listed models', () => {
    for (const provider of ['anthropic', 'openai', 'google'] as ProviderId[]) {
      for (const model of PROVIDER_MODELS[provider]) {
        expect(MODEL_CONTEXT_WINDOW[model]).toBeGreaterThan(0);
      }
    }
  });

  it('ProviderConfig types are structurally sound', () => {
    const config: ProviderConfig = {
      id: 'anthropic',
      defaultModel: 'claude-sonnet-4-6',
      modelParams: { temperature: 0.5, maxTokens: 8000 },
      hasKey: true,
    };
    expect(config.id).toBe('anthropic');
    expect(config.hasKey).toBe(true);
  });

  it('AppSettings extends with optional environment fields', () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      dockerSocketPath: '/custom/docker.sock',
      workspaceDirectory: '/workspace',
      agentTimeoutSeconds: 600,
    };
    expect(settings.dockerSocketPath).toBe('/custom/docker.sock');
    expect(settings.agentTimeoutSeconds).toBe(600);
  });
});
