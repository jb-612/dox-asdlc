/**
 * Tests for FeatureFlagsPanel component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FeatureFlagsPanel from './FeatureFlagsPanel';
import { clearFeatureOverrides, setFeatureOverride, FEATURE_FLAGS } from '../../utils/featureFlags';

describe('FeatureFlagsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    clearFeatureOverrides();
  });

  afterEach(() => {
    localStorage.clear();
    clearFeatureOverrides();
  });

  describe('Rendering', () => {
    it('renders the panel title', () => {
      render(<FeatureFlagsPanel />);
      expect(screen.getByText('Feature Flags')).toBeInTheDocument();
    });

    it('renders all feature flag toggles', () => {
      render(<FeatureFlagsPanel />);

      // Use exact labels to avoid matching descriptions
      expect(screen.getByText('Discovery Studio')).toBeInTheDocument();
      expect(screen.getByText('Agent Cockpit')).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();
      expect(screen.getByText('Artifacts')).toBeInTheDocument();
      expect(screen.getByText('RLM Trajectory')).toBeInTheDocument();
    });

    it('renders toggle switches for each feature', () => {
      render(<FeatureFlagsPanel />);

      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBe(5);
    });

    it('renders reset button', () => {
      render(<FeatureFlagsPanel />);
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('toggles feature flag on click', () => {
      render(<FeatureFlagsPanel />);

      const docsSwitch = screen.getAllByRole('switch')[2]; // Docs is third
      const initialState = docsSwitch.getAttribute('aria-checked');

      fireEvent.click(docsSwitch);

      const newState = docsSwitch.getAttribute('aria-checked');
      expect(newState).not.toBe(initialState);
    });

    it('persists toggle to localStorage', () => {
      render(<FeatureFlagsPanel />);

      // Find and click the docs toggle
      const docsSwitch = screen.getAllByRole('switch')[2];
      fireEvent.click(docsSwitch);

      expect(localStorage.getItem('asdlc:feature_docs')).toBe('false');
    });

    it('resets all flags on reset button click', () => {
      // Set some overrides first
      setFeatureOverride(FEATURE_FLAGS.DOCS, false);
      setFeatureOverride(FEATURE_FLAGS.COCKPIT, false);

      render(<FeatureFlagsPanel />);

      const resetButton = screen.getByRole('button', { name: /reset/i });
      fireEvent.click(resetButton);

      // All flags should be reset to defaults
      expect(localStorage.getItem('asdlc:feature_docs')).toBeNull();
      expect(localStorage.getItem('asdlc:feature_cockpit')).toBeNull();
    });
  });

  describe('Props', () => {
    it('calls onChange when a flag is toggled', () => {
      const onChange = vi.fn();
      render(<FeatureFlagsPanel onChange={onChange} />);

      const docsSwitch = screen.getAllByRole('switch')[2];
      fireEvent.click(docsSwitch);

      expect(onChange).toHaveBeenCalledWith('docs', false);
    });

    it('applies custom className', () => {
      render(<FeatureFlagsPanel className="custom-class" />);
      const panel = screen.getByTestId('feature-flags-panel');
      expect(panel).toHaveClass('custom-class');
    });

    it('shows compact mode without descriptions', () => {
      render(<FeatureFlagsPanel compact />);

      // In compact mode, descriptions should not be visible
      const descriptions = screen.queryByText(/AI-assisted PRD creation/i);
      expect(descriptions).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible labels for all switches', () => {
      render(<FeatureFlagsPanel />);

      const switches = screen.getAllByRole('switch');
      switches.forEach((switchEl) => {
        expect(switchEl).toHaveAttribute('aria-checked');
      });
    });

    it('announces state changes', () => {
      render(<FeatureFlagsPanel />);

      const docsSwitch = screen.getAllByRole('switch')[2];

      // Initial state
      expect(docsSwitch.getAttribute('aria-checked')).toBe('true');

      // After toggle
      fireEvent.click(docsSwitch);
      expect(docsSwitch.getAttribute('aria-checked')).toBe('false');
    });
  });
});
