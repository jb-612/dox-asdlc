// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppSettings, ProviderId } from '../../src/shared/types/settings';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => '1.0.0'),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------

import { ipcMain, app } from 'electron';
import { registerSettingsHandlers } from '../../src/main/ipc/settings-handlers';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsLoadResult extends AppSettings {}

interface SettingsSaveResult {
  success: boolean;
  error?: string;
}

interface SetApiKeyResult {
  success: boolean;
  error?: string;
}

interface DeleteApiKeyResult {
  success: boolean;
  error?: string;
}

interface KeyStatusResult {
  providerId: ProviderId;
  hasKey: boolean;
  encryptionAvailable: boolean;
}

interface TestProviderResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

interface GetVersionResult {
  app: string;
  electron: string;
  node: string;
}

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock ApiKeyStore with overridable method implementations.
 */
function makeMockApiKeyStore(overrides?: {
  hasKey?: (provider: ProviderId) => Promise<boolean>;
  getKey?: (provider: ProviderId) => Promise<string | null>;
  setKey?: (provider: ProviderId, key: string) => Promise<void>;
  deleteKey?: (provider: ProviderId) => Promise<void>;
  encryptionAvailable?: boolean;
}) {
  return {
    encryptionAvailable: overrides?.encryptionAvailable ?? true,
    hasKey: vi.fn(overrides?.hasKey ?? (async (_p: ProviderId) => false)),
    getKey: vi.fn(overrides?.getKey ?? (async (_p: ProviderId) => null)),
    setKey: vi.fn(overrides?.setKey ?? (async (_p: ProviderId, _k: string) => {})),
    deleteKey: vi.fn(overrides?.deleteKey ?? (async (_p: ProviderId) => {})),
  };
}

const MOCK_SETTINGS: AppSettings = {
  workflowDirectory: '/tmp/workflows',
  templateDirectory: '/tmp/templates',
  autoSaveIntervalSeconds: 30,
  cliDefaultCwd: '/tmp',
  redisUrl: 'redis://localhost:6379',
  cursorAgentUrl: 'http://localhost:8090',
  executionMockMode: false,
};

/**
 * Build a mock SettingsService with controllable apiKeyStore.
 */
function makeMockSettingsService(apiKeyStore = makeMockApiKeyStore()) {
  return {
    apiKeyStore,
    load: vi.fn(async () => MOCK_SETTINGS),
    save: vi.fn(async (_partial: Partial<AppSettings>) => MOCK_SETTINGS),
    get: vi.fn(() => MOCK_SETTINGS),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the registered IPC handlers from ipcMain.handle mock calls.
 * Returns a Map<channel, handlerFn>.
 */
function extractHandlers(): Map<string, (...args: unknown[]) => Promise<unknown>> {
  const mockHandle = ipcMain.handle as ReturnType<typeof vi.fn>;
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  for (const call of mockHandle.mock.calls) {
    handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
  }
  return handlers;
}

/**
 * Invoke a captured IPC handler simulating an ipcMain event.
 */
async function invokeHandler(
  handlers: Map<string, (...args: unknown[]) => Promise<unknown>>,
  channel: string,
  ...args: unknown[]
): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  // First arg is the IpcMainInvokeEvent (unused in all handlers — pass empty object)
  return handler({} as Electron.IpcMainInvokeEvent, ...args);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerSettingsHandlers', () => {
  let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
  let mockService: ReturnType<typeof makeMockSettingsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = makeMockSettingsService();
    registerSettingsHandlers(mockService as never);
    handlers = extractHandlers();
  });

  // -------------------------------------------------------------------------
  // 1. Channel registration
  // -------------------------------------------------------------------------

  describe('channel registration', () => {
    it('registers all 7 expected IPC channels', () => {
      const expectedChannels = [
        IPC_CHANNELS.SETTINGS_LOAD,
        IPC_CHANNELS.SETTINGS_SAVE,
        IPC_CHANNELS.SETTINGS_SET_API_KEY,
        IPC_CHANNELS.SETTINGS_DELETE_API_KEY,
        IPC_CHANNELS.SETTINGS_GET_KEY_STATUS,
        IPC_CHANNELS.SETTINGS_TEST_PROVIDER,
        IPC_CHANNELS.SETTINGS_GET_VERSION,
      ];

      for (const channel of expectedChannels) {
        expect(handlers.has(channel), `Expected handler for ${channel}`).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. SETTINGS_LOAD
  // -------------------------------------------------------------------------

  describe('SETTINGS_LOAD', () => {
    it('delegates to settingsService.load() and returns the result', async () => {
      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_LOAD)) as SettingsLoadResult;

      expect(mockService.load).toHaveBeenCalledTimes(1);
      expect(result).toEqual(MOCK_SETTINGS);
    });
  });

  // -------------------------------------------------------------------------
  // 3 & 4. SETTINGS_SAVE
  // -------------------------------------------------------------------------

  describe('SETTINGS_SAVE', () => {
    it('delegates to settingsService.save() and returns { success: true }', async () => {
      const partial: Partial<AppSettings> = { autoSaveIntervalSeconds: 60 };

      const result = (await invokeHandler(
        handlers,
        IPC_CHANNELS.SETTINGS_SAVE,
        partial,
      )) as SettingsSaveResult;

      expect(mockService.save).toHaveBeenCalledWith(partial);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns { success: false, error } when settingsService.save() throws', async () => {
      mockService.save.mockRejectedValueOnce(new Error('disk full'));

      const result = (await invokeHandler(
        handlers,
        IPC_CHANNELS.SETTINGS_SAVE,
        {},
      )) as SettingsSaveResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('disk full');
    });

    it('returns the thrown string message when error is not an Error instance', async () => {
      mockService.save.mockRejectedValueOnce('permission denied');

      const result = (await invokeHandler(
        handlers,
        IPC_CHANNELS.SETTINGS_SAVE,
        {},
      )) as SettingsSaveResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('permission denied');
    });
  });

  // -------------------------------------------------------------------------
  // 5. SETTINGS_SET_API_KEY
  // -------------------------------------------------------------------------

  describe('SETTINGS_SET_API_KEY', () => {
    it('delegates to apiKeyStore.setKey() with the correct provider and key', async () => {
      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_SET_API_KEY, {
        provider: 'anthropic' as ProviderId,
        key: 'sk-test-key',
      })) as SetApiKeyResult;

      expect(mockService.apiKeyStore.setKey).toHaveBeenCalledWith('anthropic', 'sk-test-key');
      expect(result.success).toBe(true);
    });

    it('returns { success: false, error } when apiKeyStore.setKey() throws', async () => {
      mockService.apiKeyStore.setKey.mockRejectedValueOnce(new Error('encryption failed'));

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_SET_API_KEY, {
        provider: 'openai' as ProviderId,
        key: 'sk-bad',
      })) as SetApiKeyResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('encryption failed');
    });
  });

  // -------------------------------------------------------------------------
  // 6. SETTINGS_DELETE_API_KEY
  // -------------------------------------------------------------------------

  describe('SETTINGS_DELETE_API_KEY', () => {
    it('delegates to apiKeyStore.deleteKey() with the correct provider', async () => {
      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_DELETE_API_KEY, {
        provider: 'openai' as ProviderId,
      })) as DeleteApiKeyResult;

      expect(mockService.apiKeyStore.deleteKey).toHaveBeenCalledWith('openai');
      expect(result.success).toBe(true);
    });

    it('returns { success: false, error } when apiKeyStore.deleteKey() throws', async () => {
      mockService.apiKeyStore.deleteKey.mockRejectedValueOnce(new Error('io error'));

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_DELETE_API_KEY, {
        provider: 'google' as ProviderId,
      })) as DeleteApiKeyResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('io error');
    });
  });

  // -------------------------------------------------------------------------
  // 7. SETTINGS_GET_KEY_STATUS
  // -------------------------------------------------------------------------

  describe('SETTINGS_GET_KEY_STATUS', () => {
    it('returns { providerId, hasKey: true, encryptionAvailable: true } when key exists', async () => {
      mockService.apiKeyStore.hasKey.mockResolvedValueOnce(true);

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_GET_KEY_STATUS, {
        provider: 'anthropic' as ProviderId,
      })) as KeyStatusResult;

      expect(mockService.apiKeyStore.hasKey).toHaveBeenCalledWith('anthropic');
      expect(result.providerId).toBe('anthropic');
      expect(result.hasKey).toBe(true);
      expect(result.encryptionAvailable).toBe(true);
    });

    it('returns { hasKey: false } when no key is stored', async () => {
      mockService.apiKeyStore.hasKey.mockResolvedValueOnce(false);

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_GET_KEY_STATUS, {
        provider: 'openai' as ProviderId,
      })) as KeyStatusResult;

      expect(result.hasKey).toBe(false);
    });

    it('reflects encryptionAvailable: false from apiKeyStore', async () => {
      // Re-register with a store that reports encryption unavailable
      vi.clearAllMocks();
      const storeNoEncryption = makeMockApiKeyStore({ encryptionAvailable: false });
      storeNoEncryption.hasKey.mockResolvedValueOnce(true);
      const serviceNoEncryption = makeMockSettingsService(storeNoEncryption);
      registerSettingsHandlers(serviceNoEncryption as never);
      const freshHandlers = extractHandlers();

      const result = (await invokeHandler(freshHandlers, IPC_CHANNELS.SETTINGS_GET_KEY_STATUS, {
        provider: 'azure' as ProviderId,
      })) as KeyStatusResult;

      expect(result.encryptionAvailable).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 8-12. SETTINGS_TEST_PROVIDER
  // -------------------------------------------------------------------------

  describe('SETTINGS_TEST_PROVIDER', () => {
    it('returns { ok: false, error } when no API key is stored', async () => {
      mockService.apiKeyStore.getKey.mockResolvedValueOnce(null);

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_TEST_PROVIDER, {
        provider: 'anthropic' as ProviderId,
      })) as TestProviderResult;

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/no api key/i);
    });

    it('returns { ok: true, latencyMs } when fetch succeeds with 200', async () => {
      mockService.apiKeyStore.getKey.mockResolvedValueOnce('sk-live-key');

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_TEST_PROVIDER, {
        provider: 'openai' as ProviderId,
      })) as TestProviderResult;

      expect(result.ok).toBe(true);
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      vi.unstubAllGlobals();
    });

    it('returns { ok: false, error } on non-OK fetch response', async () => {
      mockService.apiKeyStore.getKey.mockResolvedValueOnce('sk-bad-key');

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_TEST_PROVIDER, {
        provider: 'google' as ProviderId,
      })) as TestProviderResult;

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/401/);

      vi.unstubAllGlobals();
    });

    it('returns { ok: false, error } when fetch throws a network error', async () => {
      mockService.apiKeyStore.getKey.mockResolvedValueOnce('sk-net-err');

      const mockFetch = vi.fn().mockRejectedValueOnce(new Error('network error'));
      vi.stubGlobal('fetch', mockFetch);

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_TEST_PROVIDER, {
        provider: 'anthropic' as ProviderId,
      })) as TestProviderResult;

      expect(result.ok).toBe(false);
      expect(result.error).toBe('network error');

      vi.unstubAllGlobals();
    });

    it('returns { ok: false, error: "Connection timed out" } on AbortError', async () => {
      mockService.apiKeyStore.getKey.mockResolvedValueOnce('sk-slow-key');

      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      const mockFetch = vi.fn().mockRejectedValueOnce(abortError);
      vi.stubGlobal('fetch', mockFetch);

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_TEST_PROVIDER, {
        provider: 'openai' as ProviderId,
      })) as TestProviderResult;

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/timed out/i);

      vi.unstubAllGlobals();
    });

    it('returns { ok: false, error } for Azure when no endpoint is configured', async () => {
      mockService.apiKeyStore.getKey.mockResolvedValueOnce('sk-azure-key');
      // get() returns MOCK_SETTINGS which has no providers.azure.azureEndpoint
      mockService.get.mockReturnValueOnce({
        ...MOCK_SETTINGS,
        providers: {
          azure: { id: 'azure' as ProviderId },
        },
      });

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_TEST_PROVIDER, {
        provider: 'azure' as ProviderId,
      })) as TestProviderResult;

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/azure endpoint/i);
    });

    it('succeeds for Azure when endpoint is configured and fetch returns 200', async () => {
      mockService.apiKeyStore.getKey.mockResolvedValueOnce('sk-azure-key');
      mockService.get.mockReturnValueOnce({
        ...MOCK_SETTINGS,
        providers: {
          azure: {
            id: 'azure' as ProviderId,
            azureEndpoint: 'https://my-resource.openai.azure.com',
          },
        },
      });

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = (await invokeHandler(handlers, IPC_CHANNELS.SETTINGS_TEST_PROVIDER, {
        provider: 'azure' as ProviderId,
      })) as TestProviderResult;

      expect(result.ok).toBe(true);
      // URL should include the configured endpoint
      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain('my-resource.openai.azure.com');

      vi.unstubAllGlobals();
    });
  });

  // -------------------------------------------------------------------------
  // 13. SETTINGS_GET_VERSION
  // -------------------------------------------------------------------------

  describe('SETTINGS_GET_VERSION', () => {
    it('returns app, electron, and node version strings', async () => {
      const mockGetVersion = app.getVersion as ReturnType<typeof vi.fn>;
      mockGetVersion.mockReturnValue('2.5.1');

      const result = (await invokeHandler(
        handlers,
        IPC_CHANNELS.SETTINGS_GET_VERSION,
      )) as GetVersionResult;

      expect(result.app).toBe('2.5.1');
      // process.versions.electron and process.versions.node are set by the Node/Electron runtime
      expect(typeof result.electron).toBe('string');
      expect(typeof result.node).toBe('string');
    });

    it('falls back to "0.0.0" for app version when app.getVersion returns undefined', async () => {
      const mockGetVersion = app.getVersion as ReturnType<typeof vi.fn>;
      mockGetVersion.mockReturnValue(undefined as unknown as string);

      const result = (await invokeHandler(
        handlers,
        IPC_CHANNELS.SETTINGS_GET_VERSION,
      )) as GetVersionResult;

      // The handler uses: app?.getVersion() ?? '0.0.0'
      expect(result.app).toBe('0.0.0');
    });

    it('falls back to "unknown" for electron/node when process.versions values are absent', async () => {
      const originalElectron = process.versions.electron;
      const originalNode = process.versions.node;

      // Temporarily remove the version strings
      Object.defineProperty(process.versions, 'electron', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(process.versions, 'node', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const result = (await invokeHandler(
        handlers,
        IPC_CHANNELS.SETTINGS_GET_VERSION,
      )) as GetVersionResult;

      expect(result.electron).toBe('unknown');
      expect(result.node).toBe('unknown');

      // Restore
      Object.defineProperty(process.versions, 'electron', {
        value: originalElectron,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(process.versions, 'node', {
        value: originalNode,
        configurable: true,
        writable: true,
      });
    });
  });
});
