// @vitest-environment node
// ---------------------------------------------------------------------------
// T15: Verify container settings round-trip persistence
//
// Tests that saving settings with containerImage and dormancyTimeoutMs
// persists them correctly, that loading returns saved values, and that
// defaults are used when the settings file lacks those fields.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppSettings } from '../../src/shared/types/settings';
import { DEFAULT_SETTINGS } from '../../src/shared/types/settings';

// ---------------------------------------------------------------------------
// In-memory filesystem mock
// ---------------------------------------------------------------------------

let fileStore: Record<string, string> = {};

vi.mock('fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    if (path in fileStore) {
      return fileStore[path];
    }
    const err = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  }),
  writeFile: vi.fn(async (path: string, content: string) => {
    fileStore[path] = content;
  }),
  mkdir: vi.fn(async () => {}),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock-user-data'),
  },
}));

// We do NOT mock api-key-store at the module level. Instead, we inject a
// mock apiKeyStore directly into the SettingsService constructor, which
// accepts an optional ApiKeyStore parameter.

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { SettingsService } from '../../src/main/services/settings-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock ApiKeyStore that satisfies the SettingsService contract.
 * Injected directly via the constructor to avoid module-mock pitfalls.
 */
function createMockApiKeyStore() {
  return {
    encryptionAvailable: false,
    hasKey: vi.fn(async () => false),
    getKey: vi.fn(async () => null),
    setKey: vi.fn(async () => {}),
    deleteKey: vi.fn(async () => {}),
    getAllKeyStatus: vi.fn(async () => ({
      anthropic: false,
      openai: false,
      google: false,
      azure: false,
    })),
    getConfiguredProviders: vi.fn(async () => []),
  };
}

function createService() {
  return new SettingsService(createMockApiKeyStore() as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Settings round-trip persistence (T15)', () => {
  let service: SettingsService;

  beforeEach(() => {
    fileStore = {};
    service = createService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Saving settings with containerImage and dormancyTimeoutMs persists them
  // -------------------------------------------------------------------------

  it('persists containerImage and dormancyTimeoutMs when saved', async () => {
    await service.load();

    const saved = await service.save({
      containerImage: 'my-custom-agent:2.0.0',
      dormancyTimeoutMs: 600_000,
    });

    expect(saved.containerImage).toBe('my-custom-agent:2.0.0');
    expect(saved.dormancyTimeoutMs).toBe(600_000);

    // Verify the data was written to the file store
    const settingsPath = '/mock-user-data/electron-config.json';
    expect(fileStore[settingsPath]).toBeDefined();

    const written = JSON.parse(fileStore[settingsPath]);
    expect(written.containerImage).toBe('my-custom-agent:2.0.0');
    expect(written.dormancyTimeoutMs).toBe(600_000);
  });

  // -------------------------------------------------------------------------
  // 2. Loading settings after save returns the saved values
  // -------------------------------------------------------------------------

  it('loading after save returns the previously saved containerImage and dormancyTimeoutMs', async () => {
    await service.load();

    // Save custom values
    await service.save({
      containerImage: 'custom-image:3.0.0',
      dormancyTimeoutMs: 120_000,
    });

    // Create a fresh service instance to simulate a cold load from disk
    const freshService = createService();
    const loaded = await freshService.load();

    expect(loaded.containerImage).toBe('custom-image:3.0.0');
    expect(loaded.dormancyTimeoutMs).toBe(120_000);
  });

  // -------------------------------------------------------------------------
  // 3. Default values are used when the file has no containerImage/dormancyTimeoutMs
  // -------------------------------------------------------------------------

  it('uses default containerImage when settings file omits the field', async () => {
    // Seed the file store with settings that lack containerImage
    const settingsPath = '/mock-user-data/electron-config.json';
    const partialSettings = {
      workflowDirectory: '/some/dir',
      templateDirectory: '/some/templates',
      autoSaveIntervalSeconds: 45,
    };
    fileStore[settingsPath] = JSON.stringify(partialSettings);

    const loaded = await service.load();

    // Should fall back to the default from DEFAULT_SETTINGS
    expect(loaded.containerImage).toBe(DEFAULT_SETTINGS.containerImage);
    expect(loaded.containerImage).toBe('asdlc-agent:1.0.0');
  });

  it('uses default dormancyTimeoutMs when settings file omits the field', async () => {
    const settingsPath = '/mock-user-data/electron-config.json';
    const partialSettings = {
      workflowDirectory: '/some/dir',
      autoSaveIntervalSeconds: 30,
    };
    fileStore[settingsPath] = JSON.stringify(partialSettings);

    const loaded = await service.load();

    expect(loaded.dormancyTimeoutMs).toBe(DEFAULT_SETTINGS.dormancyTimeoutMs);
    expect(loaded.dormancyTimeoutMs).toBe(300_000);
  });

  // -------------------------------------------------------------------------
  // 4. Full round-trip: save, cold reload, verify all fields survive
  // -------------------------------------------------------------------------

  it('full round-trip preserves all container-related settings alongside general settings', async () => {
    await service.load();

    // Save a mix of general and container-related settings
    await service.save({
      autoSaveIntervalSeconds: 90,
      containerImage: 'roundtrip-agent:4.0.0',
      dormancyTimeoutMs: 45_000,
      dockerSocketPath: '/custom/docker.sock',
      agentTimeoutSeconds: 600,
    });

    // Cold reload
    const freshService = createService();
    const loaded = await freshService.load();

    expect(loaded.autoSaveIntervalSeconds).toBe(90);
    expect(loaded.containerImage).toBe('roundtrip-agent:4.0.0');
    expect(loaded.dormancyTimeoutMs).toBe(45_000);
    expect(loaded.dockerSocketPath).toBe('/custom/docker.sock');
    expect(loaded.agentTimeoutSeconds).toBe(600);
  });

  // -------------------------------------------------------------------------
  // 5. Defaults are used when settings file does not exist at all
  // -------------------------------------------------------------------------

  it('returns default settings when no settings file exists', async () => {
    // fileStore is empty, so readFile will throw ENOENT
    const loaded = await service.load();

    expect(loaded.containerImage).toBe(DEFAULT_SETTINGS.containerImage);
    expect(loaded.dormancyTimeoutMs).toBe(DEFAULT_SETTINGS.dormancyTimeoutMs);
  });

  // -------------------------------------------------------------------------
  // 6. Partial save merges rather than overwrites
  // -------------------------------------------------------------------------

  it('partial save of containerImage does not erase dormancyTimeoutMs', async () => {
    await service.load();

    // First save: set both fields
    await service.save({
      containerImage: 'first-image:1.0.0',
      dormancyTimeoutMs: 99_000,
    });

    // Second save: only update containerImage
    await service.save({
      containerImage: 'second-image:2.0.0',
    });

    // dormancyTimeoutMs should still be 99_000
    const current = service.get();
    expect(current.containerImage).toBe('second-image:2.0.0');
    expect(current.dormancyTimeoutMs).toBe(99_000);

    // Verify disk persistence as well
    const freshService = createService();
    const loaded = await freshService.load();
    expect(loaded.containerImage).toBe('second-image:2.0.0');
    expect(loaded.dormancyTimeoutMs).toBe(99_000);
  });

  // -------------------------------------------------------------------------
  // 7. get() returns in-memory snapshot after save
  // -------------------------------------------------------------------------

  it('get() returns updated values synchronously after save()', async () => {
    await service.load();

    await service.save({
      containerImage: 'sync-test:1.0.0',
      dormancyTimeoutMs: 55_000,
    });

    const snapshot = service.get();
    expect(snapshot.containerImage).toBe('sync-test:1.0.0');
    expect(snapshot.dormancyTimeoutMs).toBe(55_000);
  });
});
