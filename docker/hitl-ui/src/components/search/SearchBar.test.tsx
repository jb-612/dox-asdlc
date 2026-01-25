/**
 * Tests for SearchBar component (P05-F08 Task 2.1)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SearchBar from './SearchBar';

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders input with placeholder', () => {
      render(<SearchBar onSearch={vi.fn()} />);
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      render(<SearchBar onSearch={vi.fn()} placeholder="Find code..." />);
      expect(screen.getByPlaceholderText('Find code...')).toBeInTheDocument();
    });

    it('renders with initial query', () => {
      render(<SearchBar onSearch={vi.fn()} initialQuery="test query" />);
      expect(screen.getByRole('textbox')).toHaveValue('test query');
    });

    it('has proper aria-label', () => {
      render(<SearchBar onSearch={vi.fn()} />);
      expect(screen.getByLabelText(/search knowledge/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<SearchBar onSearch={vi.fn()} className="my-custom-class" />);
      expect(screen.getByTestId('search-bar')).toHaveClass('my-custom-class');
    });
  });

  describe('Debounced Search', () => {
    it('debounces onSearch callback', async () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} debounceMs={100} />);
      const input = screen.getByRole('textbox');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });
      expect(onSearch).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('only calls onSearch once for rapid input', async () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} debounceMs={300} />);
      const input = screen.getByRole('textbox');

      await act(async () => {
        fireEvent.change(input, { target: { value: 't' } });
        vi.advanceTimersByTime(100);
        fireEvent.change(input, { target: { value: 'te' } });
        vi.advanceTimersByTime(100);
        fireEvent.change(input, { target: { value: 'tes' } });
        vi.advanceTimersByTime(100);
        fireEvent.change(input, { target: { value: 'test' } });
        vi.advanceTimersByTime(300);
      });

      // Should only be called once with final value
      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('uses default debounce of 300ms', async () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} />);
      const input = screen.getByRole('textbox');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(onSearch).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(onSearch).toHaveBeenCalledWith('test');
    });
  });

  describe('Clear Button', () => {
    it('shows clear button when query is present', () => {
      render(<SearchBar onSearch={vi.fn()} initialQuery="test" />);
      expect(screen.getByTestId('clear-button')).toBeInTheDocument();
    });

    it('hides clear button when input is empty', () => {
      render(<SearchBar onSearch={vi.fn()} />);
      expect(screen.queryByTestId('clear-button')).not.toBeInTheDocument();
    });

    it('clears input when clear button is clicked', () => {
      render(<SearchBar onSearch={vi.fn()} initialQuery="test" />);

      const clearButton = screen.getByTestId('clear-button');
      fireEvent.click(clearButton);

      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('calls onClear when clear button is clicked', () => {
      const onClear = vi.fn();
      render(<SearchBar onSearch={vi.fn()} onClear={onClear} initialQuery="test" />);

      fireEvent.click(screen.getByTestId('clear-button'));
      expect(onClear).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('submits immediately on Enter', async () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} />);
      const input = screen.getByRole('textbox');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'query' } });
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      expect(onSearch).toHaveBeenCalledWith('query');
    });

    it('clears input on Escape', async () => {
      render(<SearchBar onSearch={vi.fn()} initialQuery="query" />);
      const input = screen.getByRole('textbox');

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Escape' });
      });

      expect(input).toHaveValue('');
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      render(<SearchBar onSearch={vi.fn()} isLoading />);
      expect(screen.getByTestId('search-loading')).toBeInTheDocument();
    });

    it('hides clear button when loading', () => {
      render(<SearchBar onSearch={vi.fn()} isLoading initialQuery="test" />);
      expect(screen.queryByTestId('clear-button')).not.toBeInTheDocument();
    });
  });

  describe('Filters Toggle', () => {
    it('shows filters toggle button when showFiltersToggle is true', () => {
      render(<SearchBar onSearch={vi.fn()} showFiltersToggle onFiltersToggle={vi.fn()} />);
      expect(screen.getByTestId('filters-toggle')).toBeInTheDocument();
    });

    it('calls onFiltersToggle when filter button is clicked', () => {
      const onFiltersToggle = vi.fn();
      render(<SearchBar onSearch={vi.fn()} showFiltersToggle onFiltersToggle={onFiltersToggle} />);

      fireEvent.click(screen.getByTestId('filters-toggle'));
      expect(onFiltersToggle).toHaveBeenCalled();
    });

    it('hides filters toggle button when showFiltersToggle is false', () => {
      render(<SearchBar onSearch={vi.fn()} showFiltersToggle={false} />);
      expect(screen.queryByTestId('filters-toggle')).not.toBeInTheDocument();
    });
  });
});
