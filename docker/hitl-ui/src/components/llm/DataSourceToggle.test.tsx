/**
 * DataSourceToggle Component Tests (P05-F13 T33)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataSourceToggle from './DataSourceToggle';
import { useLLMConfigStore } from '../../stores/llmConfigStore';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('DataSourceToggle', () => {
  beforeEach(() => {
    // Reset store to initial state
    useLLMConfigStore.setState({ dataSource: 'mock' });
    vi.clearAllMocks();
  });

  it('renders with default mock data source', () => {
    render(<DataSourceToggle />);

    const toggle = screen.getByTestId('data-source-toggle');
    expect(toggle).toBeInTheDocument();

    const mockButton = screen.getByTestId('data-source-mock');
    const realButton = screen.getByTestId('data-source-real');

    expect(mockButton).toBeInTheDocument();
    expect(realButton).toBeInTheDocument();
  });

  it('shows mock button as active when dataSource is mock', () => {
    useLLMConfigStore.setState({ dataSource: 'mock' });
    render(<DataSourceToggle />);

    const mockButton = screen.getByTestId('data-source-mock');
    expect(mockButton).toHaveClass('bg-accent-teal/20');
  });

  it('shows real button as active when dataSource is real', () => {
    useLLMConfigStore.setState({ dataSource: 'real' });
    render(<DataSourceToggle />);

    const realButton = screen.getByTestId('data-source-real');
    expect(realButton).toHaveClass('bg-accent-teal/20');
  });

  it('switches to real when real button is clicked', () => {
    useLLMConfigStore.setState({ dataSource: 'mock' });
    render(<DataSourceToggle />);

    const realButton = screen.getByTestId('data-source-real');
    fireEvent.click(realButton);

    expect(useLLMConfigStore.getState().dataSource).toBe('real');
  });

  it('switches to mock when mock button is clicked', () => {
    useLLMConfigStore.setState({ dataSource: 'real' });
    render(<DataSourceToggle />);

    const mockButton = screen.getByTestId('data-source-mock');
    fireEvent.click(mockButton);

    expect(useLLMConfigStore.getState().dataSource).toBe('mock');
  });

  it('persists selection to localStorage', () => {
    render(<DataSourceToggle />);

    const realButton = screen.getByTestId('data-source-real');
    fireEvent.click(realButton);

    expect(localStorageMock.setItem).toHaveBeenCalledWith('llm-data-source', 'real');
  });

  it('applies custom className', () => {
    render(<DataSourceToggle className="custom-class" />);

    const toggle = screen.getByTestId('data-source-toggle');
    expect(toggle).toHaveClass('custom-class');
  });

  it('displays data source label', () => {
    render(<DataSourceToggle />);

    expect(screen.getByText('Data Source:')).toBeInTheDocument();
  });
});
