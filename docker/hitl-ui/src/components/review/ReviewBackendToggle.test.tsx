/**
 * ReviewBackendToggle Component Tests
 *
 * Tests for the Mock/Real toggle on the Code Review page.
 * Follows the DataSourceToggle test pattern from P05-F13.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewBackendToggle from './ReviewBackendToggle';
import { useReviewStore } from '../../stores/reviewStore';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch to prevent real HTTP calls during health checks
const mockFetch = vi.fn().mockRejectedValue(new Error('Not available in test'));
vi.stubGlobal('fetch', mockFetch);

describe('ReviewBackendToggle', () => {
  beforeEach(() => {
    // Reset store to initial state with mock data source
    useReviewStore.setState({ dataSource: 'mock' });
    vi.clearAllMocks();
  });

  it('renders with default mock data source', () => {
    render(<ReviewBackendToggle showHealth={false} />);

    const toggle = screen.getByTestId('review-backend-toggle');
    expect(toggle).toBeInTheDocument();

    const mockButton = screen.getByTestId('review-source-mock');
    const realButton = screen.getByTestId('review-source-real');

    expect(mockButton).toBeInTheDocument();
    expect(realButton).toBeInTheDocument();
  });

  it('shows mock button as active when dataSource is mock', () => {
    useReviewStore.setState({ dataSource: 'mock' });
    render(<ReviewBackendToggle showHealth={false} />);

    const mockButton = screen.getByTestId('review-source-mock');
    expect(mockButton).toHaveClass('bg-accent-teal/20');
  });

  it('shows real button as active when dataSource is real', () => {
    useReviewStore.setState({ dataSource: 'real' });
    render(<ReviewBackendToggle showHealth={false} />);

    const realButton = screen.getByTestId('review-source-real');
    expect(realButton).toHaveClass('bg-accent-teal/20');
  });

  it('switches to real when real button is clicked', () => {
    useReviewStore.setState({ dataSource: 'mock' });
    render(<ReviewBackendToggle showHealth={false} />);

    const realButton = screen.getByTestId('review-source-real');
    fireEvent.click(realButton);

    expect(useReviewStore.getState().dataSource).toBe('real');
  });

  it('switches to mock when mock button is clicked', () => {
    useReviewStore.setState({ dataSource: 'real' });
    render(<ReviewBackendToggle showHealth={false} />);

    const mockButton = screen.getByTestId('review-source-mock');
    fireEvent.click(mockButton);

    expect(useReviewStore.getState().dataSource).toBe('mock');
  });

  it('persists selection to localStorage', () => {
    render(<ReviewBackendToggle showHealth={false} />);

    const realButton = screen.getByTestId('review-source-real');
    fireEvent.click(realButton);

    expect(localStorageMock.setItem).toHaveBeenCalledWith('asdlc:review-data-source', 'real');
  });

  it('applies custom className', () => {
    render(<ReviewBackendToggle className="custom-class" showHealth={false} />);

    const toggle = screen.getByTestId('review-backend-toggle');
    expect(toggle).toHaveClass('custom-class');
  });

  it('displays data source label', () => {
    render(<ReviewBackendToggle showHealth={false} />);

    expect(screen.getByText('Data Source:')).toBeInTheDocument();
  });

  it('renders health indicator when showHealth is true', () => {
    render(<ReviewBackendToggle showHealth={true} />);

    const indicator = screen.getByTestId('review-health-indicator');
    expect(indicator).toBeInTheDocument();
  });

  it('does not render health indicator when showHealth is false', () => {
    render(<ReviewBackendToggle showHealth={false} />);

    expect(screen.queryByTestId('review-health-indicator')).not.toBeInTheDocument();
  });

  it('shows green health indicator when in mock mode', () => {
    useReviewStore.setState({ dataSource: 'mock' });
    render(<ReviewBackendToggle showHealth={true} />);

    const indicator = screen.getByTestId('review-health-indicator');
    expect(indicator).toHaveClass('bg-green-500');
  });
});
