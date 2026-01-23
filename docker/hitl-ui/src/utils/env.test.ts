/**
 * Tests for environment variable utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Utilities', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    // Reset env to known state using Vitest's stubEnv
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    vi.stubEnv('VITE_USE_MOCKS', 'true');
    vi.stubEnv('VITE_POLLING_INTERVAL', '5000');
    vi.stubEnv('VITE_FEATURE_DOCS', 'true');
    vi.stubEnv('VITE_FEATURE_COCKPIT', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Import dynamically to get fresh module with stubbed env
  async function getEnvUtils() {
    // Clear module cache to get fresh imports with current env
    vi.resetModules();
    return await import('./env');
  }

  describe('getEnvVar', () => {
    it('returns env var value', async () => {
      const { getEnvVar } = await getEnvUtils();
      const result = getEnvVar('VITE_API_BASE_URL');
      expect(result).toBe('/api');
    });

    it('returns default for missing var', async () => {
      const { getEnvVar } = await getEnvUtils();
      const result = getEnvVar('VITE_MISSING', 'default');
      expect(result).toBe('default');
    });

    it('returns undefined for missing var without default', async () => {
      const { getEnvVar } = await getEnvUtils();
      const result = getEnvVar('VITE_MISSING');
      expect(result).toBeUndefined();
    });
  });

  describe('getBoolEnv', () => {
    it('returns true for "true"', async () => {
      const { getBoolEnv } = await getEnvUtils();
      const result = getBoolEnv('VITE_USE_MOCKS');
      expect(result).toBe(true);
    });

    it('returns false for "false"', async () => {
      const { getBoolEnv } = await getEnvUtils();
      const result = getBoolEnv('VITE_FEATURE_COCKPIT');
      expect(result).toBe(false);
    });

    it('returns default for missing var', async () => {
      const { getBoolEnv } = await getEnvUtils();
      const result = getBoolEnv('VITE_MISSING', true);
      expect(result).toBe(true);
    });
  });

  describe('getNumericEnv', () => {
    it('returns number value', async () => {
      const { getNumericEnv } = await getEnvUtils();
      const result = getNumericEnv('VITE_POLLING_INTERVAL');
      expect(result).toBe(5000);
    });

    it('returns default for missing var', async () => {
      const { getNumericEnv } = await getEnvUtils();
      const result = getNumericEnv('VITE_MISSING', 1000);
      expect(result).toBe(1000);
    });

    it('returns default for non-numeric var', async () => {
      const { getNumericEnv } = await getEnvUtils();
      const result = getNumericEnv('VITE_API_BASE_URL', 100);
      expect(result).toBe(100);
    });
  });

  describe('getFeatureFlag', () => {
    it('returns true for enabled feature', async () => {
      const { getFeatureFlag } = await getEnvUtils();
      const result = getFeatureFlag('docs');
      expect(result).toBe(true);
    });

    it('returns false for disabled feature', async () => {
      const { getFeatureFlag } = await getEnvUtils();
      const result = getFeatureFlag('cockpit');
      expect(result).toBe(false);
    });

    it('returns default for missing feature', async () => {
      const { getFeatureFlag } = await getEnvUtils();
      const result = getFeatureFlag('unknown', true);
      expect(result).toBe(true);
    });
  });

  describe('validateEnv', () => {
    it('returns valid for complete config', async () => {
      const { validateEnv } = await getEnvUtils();
      const result = validateEnv(['VITE_API_BASE_URL']);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('returns invalid for missing required vars', async () => {
      const { validateEnv } = await getEnvUtils();
      const result = validateEnv(['VITE_API_BASE_URL', 'VITE_REQUIRED_MISSING']);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('VITE_REQUIRED_MISSING');
    });
  });

  describe('EnvConfig', () => {
    it('provides typed config access', async () => {
      const { EnvConfig } = await getEnvUtils();
      expect(EnvConfig.apiBaseUrl).toBeDefined();
    });

    it('provides feature flags', async () => {
      const { EnvConfig } = await getEnvUtils();
      expect(typeof EnvConfig.features.docs).toBe('boolean');
    });
  });
});
