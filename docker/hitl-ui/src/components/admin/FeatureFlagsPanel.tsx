/**
 * Feature Flags Panel Component
 *
 * Allows users to view and toggle feature flags.
 * Changes are persisted to localStorage.
 */

import { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import {
  FEATURE_FLAGS,
  FEATURE_DESCRIPTIONS,
  FeatureFlagKey,
  getAllFeatureFlags,
  setFeatureOverride,
  clearFeatureOverrides,
} from '../../utils/featureFlags';
import Button from '../common/Button';

export interface FeatureFlagsPanelProps {
  /** Custom class name */
  className?: string;
  /** Callback when a flag is changed */
  onChange?: (flag: string, enabled: boolean) => void;
  /** Compact mode without descriptions */
  compact?: boolean;
}

interface FeatureFlagItemProps {
  flag: FeatureFlagKey;
  enabled: boolean;
  onToggle: (flag: FeatureFlagKey, enabled: boolean) => void;
  compact?: boolean;
}

function FeatureFlagItem({ flag, enabled, onToggle, compact }: FeatureFlagItemProps) {
  const description = FEATURE_DESCRIPTIONS[flag];
  const [label, ...rest] = description.split(' - ');
  const fullDescription = rest.join(' - ');

  return (
    <div className="flex items-center justify-between py-3 border-b border-border-subtle last:border-b-0">
      <div className="flex-1">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {!compact && fullDescription && (
          <p className="text-xs text-text-secondary mt-0.5">{fullDescription}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onToggle(flag, !enabled)}
        className={clsx(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-teal focus:ring-offset-2',
          enabled ? 'bg-accent-teal' : 'bg-bg-tertiary'
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0',
            'transition duration-200 ease-in-out',
            enabled ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

export default function FeatureFlagsPanel({
  className,
  onChange,
  compact = false,
}: FeatureFlagsPanelProps) {
  const [flags, setFlags] = useState(getAllFeatureFlags());

  // Sync state with actual flag values on mount
  useEffect(() => {
    setFlags(getAllFeatureFlags());
  }, []);

  const handleToggle = useCallback(
    (flag: FeatureFlagKey, enabled: boolean) => {
      setFeatureOverride(flag, enabled);
      setFlags(getAllFeatureFlags());
      onChange?.(flag, enabled);
    },
    [onChange]
  );

  const handleReset = useCallback(() => {
    clearFeatureOverrides();
    setFlags(getAllFeatureFlags());
  }, []);

  return (
    <div
      data-testid="feature-flags-panel"
      className={clsx('bg-bg-secondary rounded-lg border border-border-subtle p-4', className)}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Feature Flags</h3>
        <Button variant="outline" size="sm" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>

      <div className="divide-y divide-border-subtle">
        {Object.values(FEATURE_FLAGS).map((flag) => (
          <FeatureFlagItem
            key={flag}
            flag={flag}
            enabled={flags[flag as keyof typeof flags]}
            onToggle={handleToggle}
            compact={compact}
          />
        ))}
      </div>

      {!compact && (
        <p className="text-xs text-text-tertiary mt-4">
          Changes are saved to localStorage and persist across sessions.
        </p>
      )}
    </div>
  );
}
