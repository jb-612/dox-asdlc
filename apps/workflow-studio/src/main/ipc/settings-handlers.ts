import { ipcMain, app } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { SettingsService } from '../services/settings-service';
import type { AppSettings, ProviderId } from '../../shared/types/settings';

// ---------------------------------------------------------------------------
// Provider test endpoints
// ---------------------------------------------------------------------------

const PROVIDER_TEST_URLS: Record<ProviderId, (endpoint?: string) => { url: string; method: string; headers: (key: string) => Record<string, string>; body?: string }> = {
  anthropic: () => ({
    url: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }),
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
  }),
  openai: () => ({
    url: 'https://api.openai.com/v1/models',
    method: 'GET',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  }),
  google: () => ({
    url: 'https://generativelanguage.googleapis.com/v1/models',
    method: 'GET',
    headers: (key) => ({ 'x-goog-api-key': key }),
  }),
  azure: (endpoint) => ({
    url: `${endpoint}/openai/models?api-version=2024-02-01`,
    method: 'GET',
    headers: (key) => ({ 'api-key': key }),
  }),
};

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

export function registerSettingsHandlers(settingsService: SettingsService): void {
  const apiKeyStore = settingsService.apiKeyStore;

  // Load settings (existing)
  ipcMain.handle(IPC_CHANNELS.SETTINGS_LOAD, async () => {
    return settingsService.load();
  });

  // Save settings (existing)
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, settings: Partial<AppSettings>) => {
    try {
      await settingsService.save(settings);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // Set API key (T05)
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET_API_KEY,
    async (_event, args: { provider: ProviderId; key: string }) => {
      try {
        await apiKeyStore.setKey(args.provider, args.key);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  );

  // Delete API key (T05)
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_DELETE_API_KEY,
    async (_event, args: { provider: ProviderId }) => {
      try {
        await apiKeyStore.deleteKey(args.provider);
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  );

  // Get key status (T05 + T11)
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET_KEY_STATUS,
    async (_event, args: { provider: ProviderId }) => {
      const hasKey = await apiKeyStore.hasKey(args.provider);
      return {
        providerId: args.provider,
        hasKey,
        encryptionAvailable: apiKeyStore.encryptionAvailable,
      };
    },
  );

  // Test provider connection (T05)
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_TEST_PROVIDER,
    async (_event, args: { provider: ProviderId }) => {
      const key = await apiKeyStore.getKey(args.provider);
      if (!key) {
        return { ok: false, error: 'No API key stored for this provider' };
      }

      // For Azure, we need the endpoint from settings
      let azureEndpoint: string | undefined;
      if (args.provider === 'azure') {
        const settings = settingsService.get();
        azureEndpoint = settings.providers?.azure?.azureEndpoint;
        if (!azureEndpoint) {
          return { ok: false, error: 'Azure endpoint URL not configured' };
        }
      }

      const testConfig = PROVIDER_TEST_URLS[args.provider](azureEndpoint);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const start = Date.now();
        const response = await fetch(testConfig.url, {
          method: testConfig.method,
          headers: testConfig.headers(key),
          body: testConfig.body,
          signal: controller.signal,
        });
        const latencyMs = Date.now() - start;

        if (response.ok || response.status === 200 || response.status === 201) {
          return { ok: true, latencyMs };
        }

        const text = await response.text().catch(() => '');
        return { ok: false, latencyMs, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return { ok: false, error: 'Connection timed out (10s)' };
        }
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      } finally {
        clearTimeout(timeout);
      }
    },
  );

  // Get app version info (T05 + T14)
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_VERSION, async () => {
    return {
      app: app?.getVersion() ?? '0.0.0',
      electron: process.versions.electron ?? 'unknown',
      node: process.versions.node ?? 'unknown',
    };
  });
}
