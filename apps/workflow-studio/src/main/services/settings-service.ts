import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { app } from 'electron';
import type { AppSettings, ProviderId } from '../../shared/types/settings';
import { DEFAULT_SETTINGS } from '../../shared/types/settings';
import { ApiKeyStore } from './api-key-store';

// ---------------------------------------------------------------------------
// SettingsService
//
// Manages application settings stored as a JSON file in the Electron
// userData directory. Settings are loaded once at startup and cached in
// memory. Partial updates are merged with the current state and persisted
// immediately.
//
// API keys are stored separately via ApiKeyStore (safeStorage). The
// providers field in settings contains config (model, params) but never
// raw key values.
// ---------------------------------------------------------------------------

function getDefaultSettings(): AppSettings {
  const userDataPath = app?.getPath('userData') || join(process.env.HOME || '~', '.asdlc');
  return {
    ...DEFAULT_SETTINGS,
    workflowDirectory: join(userDataPath, 'workflows'),
    templateDirectory: join(userDataPath, 'templates'),
    autoSaveIntervalSeconds: 60,
    cliDefaultCwd: process.cwd(),
  };
}

/**
 * Migrate old settings formats to current schema (T13).
 *
 * - No `providers` key → add default providers
 * - Old `ProviderConfig.enabled` → remove (hasKey derived from ApiKeyStore)
 * - Old `ProviderConfig.params` → rename to `modelParams`
 */
function migrateSettings(raw: Record<string, unknown>): Record<string, unknown> {
  const migrated = { ...raw };

  // Migration 1: No providers key → add defaults
  if (!migrated.providers) {
    migrated.providers = { ...DEFAULT_SETTINGS.providers };
    console.log('[SettingsService] Migration: added default providers config');
  }

  // Migration 2+3: Fix individual provider configs
  const providers = migrated.providers as Record<string, Record<string, unknown>> | undefined;
  if (providers && typeof providers === 'object') {
    for (const [id, config] of Object.entries(providers)) {
      if (!config || typeof config !== 'object') continue;

      // Remove old `enabled` field (hasKey derived from ApiKeyStore)
      if ('enabled' in config) {
        delete config.enabled;
        console.log(`[SettingsService] Migration: removed 'enabled' from provider ${id}`);
      }

      // Rename old `params` → `modelParams`
      if ('params' in config && !('modelParams' in config)) {
        config.modelParams = config.params;
        delete config.params;
        console.log(`[SettingsService] Migration: renamed 'params' to 'modelParams' for provider ${id}`);
      }
    }
  }

  // Migration 4: Add environment defaults if missing
  if (!('dockerSocketPath' in migrated)) {
    migrated.dockerSocketPath = DEFAULT_SETTINGS.dockerSocketPath;
  }
  if (!('agentTimeoutSeconds' in migrated)) {
    migrated.agentTimeoutSeconds = DEFAULT_SETTINGS.agentTimeoutSeconds;
  }

  return migrated;
}

export class SettingsService {
  private settingsPath: string;
  private settings: AppSettings;
  readonly apiKeyStore: ApiKeyStore;

  constructor(apiKeyStore?: ApiKeyStore) {
    const configDir = app?.getPath('userData') || join(process.env.HOME || '~', '.asdlc');
    this.settingsPath = join(configDir, 'electron-config.json');
    this.settings = getDefaultSettings();
    this.apiKeyStore = apiKeyStore ?? new ApiKeyStore();
  }

  /**
   * Load settings from disk. Missing keys are filled with defaults.
   * If the file does not exist or is invalid, the full default set is used.
   * Provider `hasKey` flags are populated from ApiKeyStore.
   */
  async load(): Promise<AppSettings> {
    try {
      const content = await readFile(this.settingsPath, 'utf-8');
      const raw = JSON.parse(content) as Record<string, unknown>;
      const migrated = migrateSettings(raw);
      this.settings = { ...getDefaultSettings(), ...migrated } as AppSettings;
    } catch {
      this.settings = getDefaultSettings();
    }

    // Populate hasKey flags from ApiKeyStore (never expose raw keys)
    await this.populateKeyStatus();

    return this.settings;
  }

  /**
   * Merge partial updates into the current settings and persist to disk.
   * Never persists raw API key values — those go through ApiKeyStore.
   */
  async save(updates: Partial<AppSettings>): Promise<AppSettings> {
    // Strip any accidentally-included key data from providers
    const sanitized = { ...updates };
    if (sanitized.providers) {
      const cleanProviders = { ...sanitized.providers };
      for (const [id, config] of Object.entries(cleanProviders)) {
        if (config) {
          // hasKey is derived, not stored
          const { hasKey: _h, ...rest } = config;
          cleanProviders[id as ProviderId] = rest;
        }
      }
      sanitized.providers = cleanProviders;
    }

    this.settings = { ...this.settings, ...sanitized };

    // Persist without key values
    const toWrite = { ...this.settings };
    if (toWrite.providers) {
      const cleanProviders = { ...toWrite.providers };
      for (const [id, config] of Object.entries(cleanProviders)) {
        if (config) {
          const { hasKey: _h, ...rest } = config;
          cleanProviders[id as ProviderId] = rest;
        }
      }
      toWrite.providers = cleanProviders;
    }

    const dir = dirname(this.settingsPath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.settingsPath, JSON.stringify(toWrite, null, 2), 'utf-8');

    // Re-populate hasKey for the returned value
    await this.populateKeyStatus();

    return this.settings;
  }

  /**
   * Return the in-memory settings snapshot (synchronous).
   */
  get(): AppSettings {
    return this.settings;
  }

  /**
   * Returns provider IDs that have a stored API key (T15).
   */
  async getConfiguredProviders(): Promise<ProviderId[]> {
    return this.apiKeyStore.getConfiguredProviders();
  }

  /**
   * Populate hasKey flags in providers from ApiKeyStore.
   */
  private async populateKeyStatus(): Promise<void> {
    const providers = this.settings.providers ?? {};
    const allStatus = await this.apiKeyStore.getAllKeyStatus();

    for (const pid of ['anthropic', 'openai', 'google', 'azure'] as ProviderId[]) {
      const existing = providers[pid] ?? { id: pid };
      providers[pid] = { ...existing, hasKey: allStatus[pid] ?? false };
    }

    this.settings.providers = providers;
  }
}
