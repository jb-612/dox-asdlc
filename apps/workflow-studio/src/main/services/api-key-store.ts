import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { app, safeStorage } from 'electron';
import type { ProviderId } from '../../shared/types/settings';

/**
 * ApiKeyStore — encrypts/decrypts API keys using Electron's safeStorage API.
 *
 * Keys are stored in `{userData}/api-keys.json` as base64-encoded encrypted
 * blobs. When `safeStorage.isEncryptionAvailable()` is false, keys are stored
 * as plaintext with a console warning (graceful degradation).
 *
 * Main-process only — never import in renderer.
 */
export class ApiKeyStore {
  private filePath: string;
  private keys: Record<string, string> = {};
  private loaded = false;

  /** Whether OS-level encryption is available */
  encryptionAvailable: boolean;

  constructor() {
    const configDir = app?.getPath('userData') || join(process.env.HOME || '~', '.asdlc');
    this.filePath = join(configDir, 'api-keys.json');
    this.encryptionAvailable = safeStorage?.isEncryptionAvailable?.() ?? false;

    if (!this.encryptionAvailable) {
      console.warn('[ApiKeyStore] safeStorage encryption unavailable — keys will be stored in plaintext');
    }
  }

  /** Load keys from disk (lazy, called once). */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const content = await readFile(this.filePath, 'utf-8');
      this.keys = JSON.parse(content);
    } catch {
      this.keys = {};
    }
    this.loaded = true;
  }

  /** Persist the current key map to disk. */
  private async persist(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.keys, null, 2), 'utf-8');
  }

  /** Returns true if a key is stored for this provider. */
  async hasKey(provider: ProviderId): Promise<boolean> {
    await this.ensureLoaded();
    return provider in this.keys && this.keys[provider] !== '';
  }

  /** Store (or overwrite) an encrypted API key. */
  async setKey(provider: ProviderId, plaintext: string): Promise<void> {
    await this.ensureLoaded();

    if (this.encryptionAvailable) {
      const encrypted = safeStorage.encryptString(plaintext);
      this.keys[provider] = encrypted.toString('base64');
    } else {
      // Graceful degradation — store plaintext
      this.keys[provider] = plaintext;
    }

    await this.persist();
  }

  /** Retrieve and decrypt a stored key. Returns null if not set. */
  async getKey(provider: ProviderId): Promise<string | null> {
    await this.ensureLoaded();

    const stored = this.keys[provider];
    if (!stored) return null;

    if (this.encryptionAvailable) {
      try {
        const buffer = Buffer.from(stored, 'base64');
        return safeStorage.decryptString(buffer);
      } catch {
        console.error(`[ApiKeyStore] Failed to decrypt key for ${provider}`);
        return null;
      }
    }

    // Degraded mode — stored as plaintext
    return stored;
  }

  /** Delete stored key for a provider. */
  async deleteKey(provider: ProviderId): Promise<void> {
    await this.ensureLoaded();
    delete this.keys[provider];
    await this.persist();
  }

  /** Return key status for all known providers. */
  async getAllKeyStatus(): Promise<Record<ProviderId, boolean>> {
    await this.ensureLoaded();
    const providers: ProviderId[] = ['anthropic', 'openai', 'google', 'azure'];
    const result = {} as Record<ProviderId, boolean>;
    for (const p of providers) {
      result[p] = p in this.keys && this.keys[p] !== '';
    }
    return result;
  }

  /** Return list of provider IDs that have stored keys. */
  async getConfiguredProviders(): Promise<ProviderId[]> {
    await this.ensureLoaded();
    const providers: ProviderId[] = ['anthropic', 'openai', 'google', 'azure'];
    return providers.filter((p) => p in this.keys && this.keys[p] !== '');
  }
}
