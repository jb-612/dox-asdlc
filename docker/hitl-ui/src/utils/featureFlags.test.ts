/**
 * Tests for feature flag system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FeatureFlags,
  getFeatureFlag,
  isFeatureEnabled,
  setFeatureOverride,
  clearFeatureOverrides,
  getAllFeatureFlags,
  FEATURE_FLAGS,
} from './featureFlags';

describe('Feature Flags', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    clearFeatureOverrides();
  });

  afterEach(() => {
    localStorage.clear();
    clearFeatureOverrides();
  });

  describe('FEATURE_FLAGS constant', () => {
    it('defines all feature flags', () => {
      expect(FEATURE_FLAGS).toHaveProperty('DISCOVERY_STUDIO');
      expect(FEATURE_FLAGS).toHaveProperty('COCKPIT');
      expect(FEATURE_FLAGS).toHaveProperty('DOCS');
      expect(FEATURE_FLAGS).toHaveProperty('ARTIFACTS');
      expect(FEATURE_FLAGS).toHaveProperty('RLM_TRAJECTORY');
    });

    it('has consistent naming convention', () => {
      Object.keys(FEATURE_FLAGS).forEach((key) => {
        expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
      });
    });
  });

  describe('getFeatureFlag', () => {
    it('returns default value for undefined flags', () => {
      const result = getFeatureFlag('unknown_flag', true);
      expect(result).toBe(true);
    });

    it('returns false when no default provided', () => {
      const result = getFeatureFlag('unknown_flag');
      expect(result).toBe(false);
    });
  });

  describe('isFeatureEnabled', () => {
    it('returns true for enabled features by default', () => {
      // Default features should be enabled
      expect(isFeatureEnabled(FEATURE_FLAGS.DISCOVERY_STUDIO)).toBe(true);
      expect(isFeatureEnabled(FEATURE_FLAGS.COCKPIT)).toBe(true);
      expect(isFeatureEnabled(FEATURE_FLAGS.DOCS)).toBe(true);
      expect(isFeatureEnabled(FEATURE_FLAGS.ARTIFACTS)).toBe(true);
    });

    it('respects localStorage overrides', () => {
      localStorage.setItem('feature_discovery_studio', 'false');
      expect(isFeatureEnabled(FEATURE_FLAGS.DISCOVERY_STUDIO)).toBe(false);

      localStorage.setItem('feature_discovery_studio', 'true');
      expect(isFeatureEnabled(FEATURE_FLAGS.DISCOVERY_STUDIO)).toBe(true);
    });
  });

  describe('setFeatureOverride', () => {
    it('enables a feature', () => {
      setFeatureOverride(FEATURE_FLAGS.RLM_TRAJECTORY, true);
      expect(isFeatureEnabled(FEATURE_FLAGS.RLM_TRAJECTORY)).toBe(true);
    });

    it('disables a feature', () => {
      setFeatureOverride(FEATURE_FLAGS.DOCS, false);
      expect(isFeatureEnabled(FEATURE_FLAGS.DOCS)).toBe(false);
    });

    it('persists to localStorage', () => {
      setFeatureOverride(FEATURE_FLAGS.COCKPIT, false);
      expect(localStorage.getItem('feature_cockpit')).toBe('false');
    });
  });

  describe('clearFeatureOverrides', () => {
    it('clears all feature overrides', () => {
      setFeatureOverride(FEATURE_FLAGS.DOCS, false);
      setFeatureOverride(FEATURE_FLAGS.COCKPIT, false);

      clearFeatureOverrides();

      // Should return to defaults
      expect(isFeatureEnabled(FEATURE_FLAGS.DOCS)).toBe(true);
      expect(isFeatureEnabled(FEATURE_FLAGS.COCKPIT)).toBe(true);
    });

    it('removes feature flags from localStorage', () => {
      setFeatureOverride(FEATURE_FLAGS.DOCS, false);
      clearFeatureOverrides();

      expect(localStorage.getItem('feature_docs')).toBeNull();
    });
  });

  describe('getAllFeatureFlags', () => {
    it('returns all feature flags with their current values', () => {
      const flags = getAllFeatureFlags();

      expect(flags).toHaveProperty(FEATURE_FLAGS.DISCOVERY_STUDIO);
      expect(flags).toHaveProperty(FEATURE_FLAGS.COCKPIT);
      expect(flags).toHaveProperty(FEATURE_FLAGS.DOCS);
      expect(flags).toHaveProperty(FEATURE_FLAGS.ARTIFACTS);
      expect(flags).toHaveProperty(FEATURE_FLAGS.RLM_TRAJECTORY);
    });

    it('reflects overrides', () => {
      setFeatureOverride(FEATURE_FLAGS.DOCS, false);

      const flags = getAllFeatureFlags();
      expect(flags[FEATURE_FLAGS.DOCS]).toBe(false);
    });
  });

  describe('Feature Flag Types', () => {
    it('FeatureFlags type includes all flags', () => {
      const flagsObj: FeatureFlags = {
        discovery_studio: true,
        cockpit: true,
        docs: true,
        artifacts: true,
        rlm_trajectory: true,
      };

      expect(Object.keys(flagsObj)).toHaveLength(5);
    });
  });
});
