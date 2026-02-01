/**
 * Tests for EnvironmentSelector Component (P09-F01 T10)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EnvironmentSelector from './EnvironmentSelector';

describe('EnvironmentSelector', () => {
  it('renders with default value', () => {
    const onChange = vi.fn();
    render(<EnvironmentSelector value="all" onChange={onChange} />);

    expect(screen.getByTestId('environment-selector')).toBeInTheDocument();
    expect(screen.getByText('All Environments')).toBeInTheDocument();
  });

  it('renders dev environment when selected', () => {
    const onChange = vi.fn();
    render(<EnvironmentSelector value="dev" onChange={onChange} />);

    expect(screen.getByText('Development')).toBeInTheDocument();
  });

  it('renders staging environment when selected', () => {
    const onChange = vi.fn();
    render(<EnvironmentSelector value="staging" onChange={onChange} />);

    expect(screen.getByText('Staging')).toBeInTheDocument();
  });

  it('renders prod environment when selected', () => {
    const onChange = vi.fn();
    render(<EnvironmentSelector value="prod" onChange={onChange} />);

    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', async () => {
    const onChange = vi.fn();
    render(<EnvironmentSelector value="all" onChange={onChange} />);

    const button = screen.getByTestId('environment-selector');
    fireEvent.click(button);

    // All options should be visible
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('calls onChange when option is selected', async () => {
    const onChange = vi.fn();
    render(<EnvironmentSelector value="all" onChange={onChange} />);

    const button = screen.getByTestId('environment-selector');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const devOption = screen.getByRole('option', { name: /development/i });
    fireEvent.click(devOption);

    expect(onChange).toHaveBeenCalledWith('dev');
  });

  it('disables selector when disabled prop is true', () => {
    const onChange = vi.fn();
    render(<EnvironmentSelector value="all" onChange={onChange} disabled={true} />);

    const button = screen.getByTestId('environment-selector');
    expect(button).toBeDisabled();
  });
});
