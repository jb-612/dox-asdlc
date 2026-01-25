/**
 * Tests for SearchService interface and factory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSearchService,
  registerSearchService,
  hasSearchService,
  getDefaultBackendMode,
  type SearchService,
} from './searchService';

// Mock implementation for testing
const createMockService = (): SearchService => ({
  search: vi.fn().mockResolvedValue({ results: [], total: 0, query: 'test' }),
  getDocument: vi.fn().mockResolvedValue(null),
  healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', backend: 'test' }),
});

describe('searchService', () => {
  beforeEach(() => {
    // Clear registry between tests by re-importing
    vi.resetModules();
  });

  describe('registerSearchService', () => {
    it('registers a service for a mode', async () => {
      const { registerSearchService, hasSearchService } = await import('./searchService');
      const mockService = createMockService();

      registerSearchService('mock', mockService);

      expect(hasSearchService('mock')).toBe(true);
    });

    it('allows overwriting existing registration', async () => {
      const { registerSearchService, getSearchService } = await import('./searchService');
      const service1 = createMockService();
      const service2 = createMockService();

      registerSearchService('mock', service1);
      registerSearchService('mock', service2);

      expect(getSearchService('mock')).toBe(service2);
    });
  });

  describe('getSearchService', () => {
    it('returns registered service for mode', async () => {
      const { registerSearchService, getSearchService } = await import('./searchService');
      const mockService = createMockService();

      registerSearchService('rest', mockService);

      expect(getSearchService('rest')).toBe(mockService);
    });

    it('throws error for unregistered mode', async () => {
      const { getSearchService } = await import('./searchService');

      expect(() => getSearchService('graphql')).toThrow(
        'No search service registered for mode: graphql'
      );
    });
  });

  describe('hasSearchService', () => {
    it('returns true for registered mode', async () => {
      const { registerSearchService, hasSearchService } = await import('./searchService');
      const mockService = createMockService();

      registerSearchService('mcp', mockService);

      expect(hasSearchService('mcp')).toBe(true);
    });

    it('returns false for unregistered mode', async () => {
      const { hasSearchService } = await import('./searchService');

      expect(hasSearchService('graphql')).toBe(false);
    });
  });

  describe('getDefaultBackendMode', () => {
    it('returns mock when VITE_USE_MOCKS is true', async () => {
      vi.stubEnv('VITE_USE_MOCKS', 'true');
      vi.stubEnv('VITE_SEARCH_BACKEND', 'rest');

      const { getDefaultBackendMode } = await import('./searchService');

      expect(getDefaultBackendMode()).toBe('mock');

      vi.unstubAllEnvs();
    });

    it('returns mode from VITE_SEARCH_BACKEND when valid', async () => {
      vi.stubEnv('VITE_USE_MOCKS', 'false');
      vi.stubEnv('VITE_SEARCH_BACKEND', 'rest');

      const { getDefaultBackendMode } = await import('./searchService');

      expect(getDefaultBackendMode()).toBe('rest');

      vi.unstubAllEnvs();
    });

    it('returns mock when VITE_SEARCH_BACKEND is invalid', async () => {
      vi.stubEnv('VITE_USE_MOCKS', 'false');
      vi.stubEnv('VITE_SEARCH_BACKEND', 'invalid');

      const { getDefaultBackendMode } = await import('./searchService');

      expect(getDefaultBackendMode()).toBe('mock');

      vi.unstubAllEnvs();
    });

    it('returns mock when no environment variables set', async () => {
      vi.stubEnv('VITE_USE_MOCKS', '');
      vi.stubEnv('VITE_SEARCH_BACKEND', '');

      const { getDefaultBackendMode } = await import('./searchService');

      expect(getDefaultBackendMode()).toBe('mock');

      vi.unstubAllEnvs();
    });
  });
});
