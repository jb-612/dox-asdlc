/**
 * Tests for BackendSelector component (P05-F08 Task 2.5)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BackendSelector from './BackendSelector';
import type { SearchBackendMode } from '../../api/types';

describe('BackendSelector', () => {
  const defaultProps = {
    mode: 'mock' as SearchBackendMode,
    onChange: vi.fn(),
  };

  describe('Basic Rendering', () => {
    it('renders selector', () => {
      render(<BackendSelector {...defaultProps} />);
      expect(screen.getByTestId('backend-selector')).toBeInTheDocument();
    });

    it('renders with current mode selected', () => {
      render(<BackendSelector {...defaultProps} mode="rest" />);
      expect(screen.getByRole('combobox')).toHaveValue('rest');
    });

    it('shows all backend options', () => {
      render(<BackendSelector {...defaultProps} />);

      expect(screen.getByRole('option', { name: /rest/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /graphql/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /mcp/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /mock/i })).toBeInTheDocument();
    });
  });

  describe('Mode Selection', () => {
    it('calls onChange when mode is selected', () => {
      const onChange = vi.fn();
      render(<BackendSelector {...defaultProps} onChange={onChange} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rest' } });
      expect(onChange).toHaveBeenCalledWith('rest');
    });

    it('calls onChange with mock mode', () => {
      const onChange = vi.fn();
      render(<BackendSelector {...defaultProps} mode="rest" onChange={onChange} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mock' } });
      expect(onChange).toHaveBeenCalledWith('mock');
    });
  });

  describe('Disabled State', () => {
    it('can be disabled', () => {
      render(<BackendSelector {...defaultProps} disabled />);
      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('prevents selection when disabled', () => {
      const onChange = vi.fn();
      render(<BackendSelector {...defaultProps} disabled onChange={onChange} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });
  });

  describe('Health Indicator', () => {
    it('shows health indicator when showHealth is true', () => {
      render(<BackendSelector {...defaultProps} showHealth />);
      expect(screen.getByTestId('health-indicator')).toBeInTheDocument();
    });

    it('hides health indicator when showHealth is false', () => {
      render(<BackendSelector {...defaultProps} showHealth={false} />);
      expect(screen.queryByTestId('health-indicator')).not.toBeInTheDocument();
    });

    it('shows green indicator for mock backend', () => {
      render(<BackendSelector {...defaultProps} mode="mock" showHealth />);
      expect(screen.getByTestId('health-indicator')).toHaveClass('bg-green-500');
    });

    it('shows yellow indicator for rest backend without connection', () => {
      render(<BackendSelector {...defaultProps} mode="rest" showHealth healthStatus="unknown" />);
      expect(screen.getByTestId('health-indicator')).toHaveClass('bg-yellow-500');
    });

    it('shows red indicator for unhealthy backend', () => {
      render(<BackendSelector {...defaultProps} mode="rest" showHealth healthStatus="unhealthy" />);
      expect(screen.getByTestId('health-indicator')).toHaveClass('bg-red-500');
    });

    it('shows green indicator for healthy backend', () => {
      render(<BackendSelector {...defaultProps} mode="rest" showHealth healthStatus="healthy" />);
      expect(screen.getByTestId('health-indicator')).toHaveClass('bg-green-500');
    });
  });

  describe('Option Labels', () => {
    it('shows descriptive labels for each option', () => {
      render(<BackendSelector {...defaultProps} />);

      // Check that options have meaningful names
      const options = screen.getAllByRole('option');
      expect(options.length).toBe(4);
    });
  });

  describe('Custom ClassName', () => {
    it('applies custom className', () => {
      render(<BackendSelector {...defaultProps} className="custom-class" />);
      expect(screen.getByTestId('backend-selector')).toHaveClass('custom-class');
    });
  });
});
