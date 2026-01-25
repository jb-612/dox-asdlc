/**
 * Unit tests for TimeRangeSelector component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimeRangeSelector from './TimeRangeSelector';
import { useMetricsStore } from '../../stores/metricsStore';

describe('TimeRangeSelector', () => {
  beforeEach(() => {
    useMetricsStore.getState().reset();
  });

  describe('Rendering', () => {
    it('renders all time range options', () => {
      render(<TimeRangeSelector />);

      expect(screen.getByTestId('time-range-15m')).toBeInTheDocument();
      expect(screen.getByTestId('time-range-1h')).toBeInTheDocument();
      expect(screen.getByTestId('time-range-6h')).toBeInTheDocument();
      expect(screen.getByTestId('time-range-24h')).toBeInTheDocument();
      expect(screen.getByTestId('time-range-7d')).toBeInTheDocument();
    });

    it('renders with data-testid', () => {
      render(<TimeRangeSelector />);
      expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<TimeRangeSelector className="custom-class" />);
      expect(screen.getByTestId('time-range-selector')).toHaveClass('custom-class');
    });

    it('has proper aria attributes', () => {
      render(<TimeRangeSelector />);
      const selector = screen.getByTestId('time-range-selector');
      expect(selector).toHaveAttribute('role', 'group');
      expect(selector).toHaveAttribute('aria-label', 'Time range selection');
    });
  });

  describe('Active State', () => {
    it('highlights default time range (1h)', () => {
      render(<TimeRangeSelector />);
      const button1h = screen.getByTestId('time-range-1h');
      expect(button1h).toHaveAttribute('aria-pressed', 'true');
      expect(button1h).toHaveClass('bg-accent-blue');
    });

    it('does not highlight non-active time ranges', () => {
      render(<TimeRangeSelector />);
      const button15m = screen.getByTestId('time-range-15m');
      expect(button15m).toHaveAttribute('aria-pressed', 'false');
      expect(button15m).not.toHaveClass('bg-accent-blue');
    });
  });

  describe('Selection', () => {
    it('updates store when time range is selected', () => {
      render(<TimeRangeSelector />);

      fireEvent.click(screen.getByTestId('time-range-6h'));

      expect(useMetricsStore.getState().timeRange).toBe('6h');
    });

    it('updates active state after selection', () => {
      render(<TimeRangeSelector />);

      fireEvent.click(screen.getByTestId('time-range-24h'));

      const button24h = screen.getByTestId('time-range-24h');
      expect(button24h).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
