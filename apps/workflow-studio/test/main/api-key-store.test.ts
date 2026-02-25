// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock fns — must be declared with vi.hoisted so they exist before
// vi.mock factories run (vi.mock is hoisted to the top of the module).
// ---------------------------------------------------------------------------

const {
  mockGetPath,
  mockIsEncryptionAvailable,
  mockEncryptString,
  mockDecryptString,
  mockReadFile,
  mockWriteFile,
  mockMkdir,
} = vi.hoisted(() => ({
  mockGetPath: vi.fn().mockReturnValue('/mock/user-data'),
  mockIsEncryptionAvailable: vi.fn().mockReturnValue(true),
  mockEncryptString: vi.fn(),
  mockDecryptString: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
  mockMkdir: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock Electron — app.getPath and safeStorage
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath,
  },
  safeStorage: {
    isEncryptionAvailable: mockIsEncryptionAvailable,
    encryptString: mockEncryptString,
    decryptString: mockDecryptString,
  },
}));

// ---------------------------------------------------------------------------
// Mock fs/promises — readFile, writeFile, mkdir
// ---------------------------------------------------------------------------

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { ApiKeyStore } from '../../src/main/services/api-key-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a Buffer that round-trips through base64 as the encrypted sentinel. */
function fakeEncryptedBuffer(plaintext: string): Buffer {
  return Buffer.from(`enc:${plaintext}`);
}

function setupEncryptionMocks(plaintext: string): void {
  const buf = fakeEncryptedBuffer(plaintext);
  mockEncryptString.mockReturnValue(buf);
  mockDecryptString.mockReturnValue(plaintext);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApiKeyStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Restore safe defaults: encryption available, disk empty
    mockGetPath.mockReturnValue('/mock/user-data');
    mockIsEncryptionAvailable.mockReturnValue(true);
    mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // 1. Constructor sets encryptionAvailable based on safeStorage
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('sets encryptionAvailable true when safeStorage reports available', () => {
      mockIsEncryptionAvailable.mockReturnValue(true);
      const store = new ApiKeyStore();
      expect(store.encryptionAvailable).toBe(true);
    });

    it('sets encryptionAvailable false when safeStorage reports unavailable', () => {
      mockIsEncryptionAvailable.mockReturnValue(false);
      const store = new ApiKeyStore();
      expect(store.encryptionAvailable).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 2. hasKey returns false when no keys stored
  // -------------------------------------------------------------------------

  describe('hasKey', () => {
    it('returns false for an unknown provider when store is empty', async () => {
      const store = new ApiKeyStore();
      const result = await store.hasKey('anthropic');
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. setKey + hasKey returns true after key stored
  // -------------------------------------------------------------------------

  describe('setKey then hasKey', () => {
    it('returns true for a provider after its key has been set', async () => {
      setupEncryptionMocks('sk-test-key');
      const store = new ApiKeyStore();

      await store.setKey('anthropic', 'sk-test-key');
      const result = await store.hasKey('anthropic');

      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. setKey encrypts when safeStorage available
  // -------------------------------------------------------------------------

  describe('setKey with encryption', () => {
    it('calls safeStorage.encryptString and stores base64 blob when encryption is available', async () => {
      mockIsEncryptionAvailable.mockReturnValue(true);
      const plaintext = 'sk-anthropic-secret';
      const encBuf = fakeEncryptedBuffer(plaintext);
      mockEncryptString.mockReturnValue(encBuf);

      const store = new ApiKeyStore();
      await store.setKey('anthropic', plaintext);

      expect(mockEncryptString).toHaveBeenCalledWith(plaintext);

      // The value persisted to disk should be base64, not the raw plaintext
      const writtenJson = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(writtenJson.anthropic).toBe(encBuf.toString('base64'));
      expect(writtenJson.anthropic).not.toBe(plaintext);
    });
  });

  // -------------------------------------------------------------------------
  // 5. setKey stores plaintext when safeStorage unavailable
  // -------------------------------------------------------------------------

  describe('setKey without encryption', () => {
    it('stores the raw plaintext value when encryption is unavailable', async () => {
      mockIsEncryptionAvailable.mockReturnValue(false);
      const plaintext = 'sk-openai-secret';

      const store = new ApiKeyStore();
      await store.setKey('openai', plaintext);

      expect(mockEncryptString).not.toHaveBeenCalled();

      const writtenJson = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(writtenJson.openai).toBe(plaintext);
    });
  });

  // -------------------------------------------------------------------------
  // 6. getKey decrypts when safeStorage available
  // -------------------------------------------------------------------------

  describe('getKey with encryption', () => {
    it('calls safeStorage.decryptString and returns the original plaintext', async () => {
      const plaintext = 'sk-google-secret';
      setupEncryptionMocks(plaintext);
      mockIsEncryptionAvailable.mockReturnValue(true);

      const store = new ApiKeyStore();
      await store.setKey('google', plaintext);
      const retrieved = await store.getKey('google');

      expect(mockDecryptString).toHaveBeenCalled();
      expect(retrieved).toBe(plaintext);
    });
  });

  // -------------------------------------------------------------------------
  // 7. getKey returns plaintext when safeStorage unavailable
  // -------------------------------------------------------------------------

  describe('getKey without encryption', () => {
    it('returns the stored plaintext value directly when encryption is unavailable', async () => {
      mockIsEncryptionAvailable.mockReturnValue(false);
      const plaintext = 'sk-azure-secret';

      const store = new ApiKeyStore();
      await store.setKey('azure', plaintext);
      const retrieved = await store.getKey('azure');

      expect(mockDecryptString).not.toHaveBeenCalled();
      expect(retrieved).toBe(plaintext);
    });
  });

  // -------------------------------------------------------------------------
  // 8. getKey returns null for unknown provider
  // -------------------------------------------------------------------------

  describe('getKey for unknown provider', () => {
    it('returns null when no key has been stored for the provider', async () => {
      const store = new ApiKeyStore();
      const result = await store.getKey('openai');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 9. deleteKey removes the key
  // -------------------------------------------------------------------------

  describe('deleteKey', () => {
    it('removes the key so hasKey returns false afterwards', async () => {
      setupEncryptionMocks('sk-delete-me');
      const store = new ApiKeyStore();

      await store.setKey('anthropic', 'sk-delete-me');
      expect(await store.hasKey('anthropic')).toBe(true);

      await store.deleteKey('anthropic');
      expect(await store.hasKey('anthropic')).toBe(false);
    });

    it('persists the updated key map to disk after deletion', async () => {
      setupEncryptionMocks('sk-delete-me');
      const store = new ApiKeyStore();

      await store.setKey('anthropic', 'sk-delete-me');
      const writeCountBeforeDelete = mockWriteFile.mock.calls.length;

      await store.deleteKey('anthropic');
      expect(mockWriteFile.mock.calls.length).toBe(writeCountBeforeDelete + 1);

      const writtenJson = JSON.parse(
        mockWriteFile.mock.calls[mockWriteFile.mock.calls.length - 1][1] as string
      );
      expect(writtenJson).not.toHaveProperty('anthropic');
    });
  });

  // -------------------------------------------------------------------------
  // 10. getAllKeyStatus returns status for all 4 providers
  // -------------------------------------------------------------------------

  describe('getAllKeyStatus', () => {
    it('returns false for all providers when store is empty', async () => {
      const store = new ApiKeyStore();
      const status = await store.getAllKeyStatus();

      expect(status).toEqual({
        anthropic: false,
        openai: false,
        google: false,
        azure: false,
      });
    });

    it('returns true only for providers that have stored keys', async () => {
      setupEncryptionMocks('sk-value');
      const store = new ApiKeyStore();

      await store.setKey('anthropic', 'sk-value');
      const status = await store.getAllKeyStatus();

      expect(status.anthropic).toBe(true);
      expect(status.openai).toBe(false);
      expect(status.google).toBe(false);
      expect(status.azure).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 11. getConfiguredProviders returns only providers with keys
  // -------------------------------------------------------------------------

  describe('getConfiguredProviders', () => {
    it('returns empty array when no keys are stored', async () => {
      const store = new ApiKeyStore();
      const providers = await store.getConfiguredProviders();
      expect(providers).toEqual([]);
    });

    it('returns only providers whose keys have been set', async () => {
      setupEncryptionMocks('sk-value');
      const store = new ApiKeyStore();

      await store.setKey('openai', 'sk-value');
      await store.setKey('google', 'sk-value');

      const providers = await store.getConfiguredProviders();
      expect(providers).toHaveLength(2);
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
      expect(providers).not.toContain('anthropic');
      expect(providers).not.toContain('azure');
    });
  });

  // -------------------------------------------------------------------------
  // 12. Lazy-loads from disk on first operation
  // -------------------------------------------------------------------------

  describe('lazy disk loading', () => {
    it('reads the file on the first call and does not re-read on subsequent calls', async () => {
      const diskKeys = { anthropic: Buffer.from('enc:persisted-key').toString('base64') };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(diskKeys));
      mockDecryptString.mockReturnValue('persisted-key');

      const store = new ApiKeyStore();

      // No disk read yet
      expect(mockReadFile).not.toHaveBeenCalled();

      // First operation triggers lazy load
      const hasFirst = await store.hasKey('anthropic');
      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(hasFirst).toBe(true);

      // Second operation does NOT trigger another read
      await store.hasKey('openai');
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('correctly uses keys loaded from disk', async () => {
      const encBuf = fakeEncryptedBuffer('on-disk-secret');
      const diskKeys = { openai: encBuf.toString('base64') };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(diskKeys));
      mockDecryptString.mockReturnValue('on-disk-secret');

      const store = new ApiKeyStore();
      const result = await store.getKey('openai');

      expect(result).toBe('on-disk-secret');
    });
  });

  // -------------------------------------------------------------------------
  // 13. Handles corrupt JSON on disk gracefully
  // -------------------------------------------------------------------------

  describe('corrupt JSON on disk', () => {
    it('treats a corrupt JSON file as an empty store without throwing', async () => {
      mockReadFile.mockResolvedValueOnce('{ this is not valid json }}}}');

      const store = new ApiKeyStore();

      // Should not throw
      const status = await store.getAllKeyStatus();
      expect(status).toEqual({
        anthropic: false,
        openai: false,
        google: false,
        azure: false,
      });
    });

    it('treats an ENOENT error as an empty store without throwing', async () => {
      mockReadFile.mockRejectedValueOnce(
        Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
      );

      const store = new ApiKeyStore();
      const providers = await store.getConfiguredProviders();
      expect(providers).toEqual([]);
    });
  });
});
