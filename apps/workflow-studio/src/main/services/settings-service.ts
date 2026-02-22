import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { app } from 'electron';
import type { AppSettings } from '../../shared/types/settings';
import { DEFAULT_SETTINGS } from '../../shared/types/settings';

// ---------------------------------------------------------------------------
// SettingsService
//
// Manages application settings stored as a JSON file in the Electron
// userData directory. Settings are loaded once at startup and cached in
// memory. Partial updates are merged with the current state and persisted
// immediately.
// ---------------------------------------------------------------------------

function getDefaultSettings(): AppSettings {
  const userDataPath = app?.getPath('userData') || join(process.env.HOME || '~', '.asdlc');
  return {
    workflowDirectory: join(userDataPath, 'workflows'),
    templateDirectory: join(userDataPath, 'templates'),
    autoSaveIntervalSeconds: 60,
    cliDefaultCwd: process.cwd(),
    redisUrl: DEFAULT_SETTINGS.redisUrl,
    cursorAgentUrl: DEFAULT_SETTINGS.cursorAgentUrl,
    executionMockMode: DEFAULT_SETTINGS.executionMockMode,
  };
}

export class SettingsService {
  private settingsPath: string;
  private settings: AppSettings;

  constructor() {
    const configDir = app?.getPath('userData') || join(process.env.HOME || '~', '.asdlc');
    this.settingsPath = join(configDir, 'electron-config.json');
    this.settings = getDefaultSettings();
  }

  /**
   * Load settings from disk. Missing keys are filled with defaults.
   * If the file does not exist or is invalid, the full default set is used.
   */
  async load(): Promise<AppSettings> {
    try {
      const content = await readFile(this.settingsPath, 'utf-8');
      this.settings = { ...getDefaultSettings(), ...JSON.parse(content) };
    } catch {
      this.settings = getDefaultSettings();
    }
    return this.settings;
  }

  /**
   * Merge partial updates into the current settings and persist to disk.
   */
  async save(updates: Partial<AppSettings>): Promise<AppSettings> {
    this.settings = { ...this.settings, ...updates };
    const dir = dirname(this.settingsPath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    return this.settings;
  }

  /**
   * Return the in-memory settings snapshot (synchronous).
   */
  get(): AppSettings {
    return this.settings;
  }
}
