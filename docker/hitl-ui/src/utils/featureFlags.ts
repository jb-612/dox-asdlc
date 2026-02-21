/**
 * Feature flag system for incremental feature rollout
 *
 * Features can be controlled via:
 * 1. Environment variables (VITE_FEATURE_*)
 * 2. localStorage overrides (feature_*)
 *
 * localStorage overrides take precedence over env vars.
 */

import { EnvConfig } from './env';

// =============================================================================
// Feature Flag Constants
// =============================================================================

/**
 * All available feature flags
 */
export const FEATURE_FLAGS = {
  DISCOVERY_STUDIO: 'discovery_studio',
  COCKPIT: 'cockpit',
  DOCS: 'docs',
  ARTIFACTS: 'artifacts',
  RLM_TRAJECTORY: 'rlm_trajectory',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * Feature flags type definition
 */
export interface FeatureFlags {
  discovery_studio: boolean;
  cockpit: boolean;
  docs: boolean;
  artifacts: boolean;
  rlm_trajectory: boolean;
}

// =============================================================================
// Default Values
// =============================================================================

/**
 * Default feature flag values (from environment or defaults)
 */
const DEFAULT_FLAGS: FeatureFlags = {
  discovery_studio: EnvConfig.features.discoveryStudio,
  cockpit: EnvConfig.features.cockpit,
  docs: EnvConfig.features.docs,
  artifacts: EnvConfig.features.artifacts,
  rlm_trajectory: EnvConfig.features.rlmTrajectory,
};

// =============================================================================
// localStorage Helpers
// =============================================================================

const STORAGE_PREFIX = 'asdlc:feature_';

/**
 * Get the localStorage key for a feature flag
 */
function getStorageKey(flag: string): string {
  return `${STORAGE_PREFIX}${flag}`;
}

/**
 * Get override from localStorage
 */
function getOverride(flag: string): boolean | null {
  try {
    const value = localStorage.getItem(getStorageKey(flag));
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  } catch {
    // localStorage may not be available (SSR, privacy mode)
    return null;
  }
}

/**
 * Set override in localStorage
 */
function setOverride(flag: string, value: boolean): void {
  try {
    localStorage.setItem(getStorageKey(flag), value.toString());
  } catch {
    // localStorage may not be available
  }
}

/**
 * Remove override from localStorage
 */
function removeOverride(flag: string): void {
  try {
    localStorage.removeItem(getStorageKey(flag));
  } catch {
    // localStorage may not be available
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get a feature flag value
 *
 * Priority:
 * 1. localStorage override
 * 2. Environment variable (via EnvConfig)
 * 3. Default value parameter
 *
 * @param flag - The feature flag name
 * @param defaultValue - Default value if flag is not set
 */
export function getFeatureFlag(flag: string, defaultValue: boolean = false): boolean {
  // Check localStorage override first
  const override = getOverride(flag);
  if (override !== null) {
    return override;
  }

  // Check if it's a known flag with a default
  if (flag in DEFAULT_FLAGS) {
    return DEFAULT_FLAGS[flag as keyof FeatureFlags];
  }

  return defaultValue;
}

/**
 * Check if a feature is enabled
 *
 * Alias for getFeatureFlag with clearer semantics
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return getFeatureFlag(flag, true);
}

/**
 * Set a feature flag override (persists to localStorage)
 */
export function setFeatureOverride(flag: FeatureFlagKey, enabled: boolean): void {
  setOverride(flag, enabled);
}

/**
 * Clear all feature flag overrides
 */
export function clearFeatureOverrides(): void {
  Object.values(FEATURE_FLAGS).forEach((flag) => {
    removeOverride(flag);
  });
}

/**
 * Get all feature flags with their current values
 */
export function getAllFeatureFlags(): FeatureFlags {
  return {
    discovery_studio: isFeatureEnabled(FEATURE_FLAGS.DISCOVERY_STUDIO),
    cockpit: isFeatureEnabled(FEATURE_FLAGS.COCKPIT),
    docs: isFeatureEnabled(FEATURE_FLAGS.DOCS),
    artifacts: isFeatureEnabled(FEATURE_FLAGS.ARTIFACTS),
    rlm_trajectory: isFeatureEnabled(FEATURE_FLAGS.RLM_TRAJECTORY),
  };
}

/**
 * Feature flag descriptions for UI
 */
export const FEATURE_DESCRIPTIONS: Record<FeatureFlagKey, string> = {
  discovery_studio: 'Discovery Studio - AI-assisted PRD creation',
  cockpit: 'Agent Cockpit - Monitor agent runs and performance',
  docs: 'Documentation - View aSDLC documentation',
  artifacts: 'Artifacts - Browse and manage generated artifacts',
  rlm_trajectory: 'RLM Trajectory - Visualize agent reasoning',
};
